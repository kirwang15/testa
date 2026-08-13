import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/services/poster_saver.dart';

class FakePosterSaver implements PosterSaver {
  FakePosterSaver(this.nextResult);

  PosterSaveResult nextResult;
  Uint8List? lastBytes;
  String? lastFileName;
  bool cancelled = false;

  @override
  Future<PosterSaveResult> savePng(
    Uint8List pngBytes, {
    String? fileName,
  }) async {
    lastBytes = pngBytes;
    lastFileName = fileName;
    return nextResult;
  }

  @override
  Future<bool> cancelPendingSave() async {
    cancelled = true;
    return true;
  }
}

Uint8List validPngBytes() => Uint8List.fromList(const <int>[
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('word_trail/poster-test');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  tearDown(() {
    messenger.setMockMethodCallHandler(channel, null);
  });

  test('returns an explicit saved result from the platform channel', () async {
    MethodCall? received;
    messenger.setMockMethodCallHandler(channel, (call) async {
      received = call;
      return <String, String>{
        'status': 'saved',
        'uri': 'content://media/poster/1',
        'fileName': 'result.png',
      };
    });
    final saver = MethodChannelPosterSaver(channel: channel);

    final result = await saver.savePng(validPngBytes(), fileName: 'result.png');

    expect(result.status, PosterSaveStatus.saved);
    expect(result.isSaved, isTrue);
    expect(result.uri, 'content://media/poster/1');
    expect(result.fileName, 'result.png');
    expect(received?.method, 'savePng');
    expect(received?.arguments['fileName'], 'result.png');
    expect(received?.arguments['bytes'], isA<Uint8List>());
  });

  test('maps all non-success platform outcomes without throwing', () {
    for (final entry in const <String, PosterSaveStatus>{
      'permissionDenied': PosterSaveStatus.permissionDenied,
      'cancelled': PosterSaveStatus.cancelled,
      'unsupported': PosterSaveStatus.unsupported,
      'busy': PosterSaveStatus.busy,
      'failed': PosterSaveStatus.failed,
    }.entries) {
      final result = PosterSaveResult.fromPlatform({
        'status': entry.key,
        'errorCode': 'example',
      });
      expect(result.status, entry.value);
      expect(result.errorCode, 'example');
      expect(result.isSaved, isFalse);
    }
  });

  test('rejects invalid PNG data before crossing the channel', () async {
    var platformCalled = false;
    messenger.setMockMethodCallHandler(channel, (call) async {
      platformCalled = true;
      return null;
    });
    final saver = MethodChannelPosterSaver(channel: channel);

    final result = await saver.savePng(Uint8List.fromList([1, 2, 3]));

    expect(result.status, PosterSaveStatus.failed);
    expect(result.errorCode, 'invalidPng');
    expect(platformCalled, isFalse);
  });

  test('a missing native implementation is reported as unsupported', () async {
    final saver = MethodChannelPosterSaver(channel: channel);

    final result = await saver.savePng(validPngBytes());

    expect(result.status, PosterSaveStatus.unsupported);
  });

  test('cancelPendingSave forwards cancellation safely', () async {
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'cancelPendingSave');
      return true;
    });
    final saver = MethodChannelPosterSaver(channel: channel);

    expect(await saver.cancelPendingSave(), isTrue);
  });

  test('PosterSaver is directly injectable through a fake', () async {
    final fake = FakePosterSaver(
      const PosterSaveResult(status: PosterSaveStatus.permissionDenied),
    );

    final result = await fake.savePng(
      validPngBytes(),
      fileName: 'diagnosis.png',
    );
    expect(result.status, PosterSaveStatus.permissionDenied);
    expect(fake.lastFileName, 'diagnosis.png');
    expect(await fake.cancelPendingSave(), isTrue);
    expect(fake.cancelled, isTrue);
  });

  test('invalid native payloads fail closed', () {
    expect(
      PosterSaveResult.fromPlatform(null).errorCode,
      'invalidPlatformResponse',
    );
    expect(
      PosterSaveResult.fromPlatform({'status': 'futureStatus'}).status,
      PosterSaveStatus.failed,
    );
  });
}
