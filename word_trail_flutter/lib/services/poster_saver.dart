import 'package:flutter/services.dart';

enum PosterSaveStatus {
  saved,
  permissionDenied,
  cancelled,
  unsupported,
  busy,
  failed,
}

class PosterSaveResult {
  const PosterSaveResult({
    required this.status,
    this.uri,
    this.fileName,
    this.errorCode,
  });

  final PosterSaveStatus status;
  final String? uri;
  final String? fileName;
  final String? errorCode;

  bool get isSaved => status == PosterSaveStatus.saved;

  factory PosterSaveResult.fromPlatform(Object? value) {
    if (value is! Map) {
      return const PosterSaveResult(
        status: PosterSaveStatus.failed,
        errorCode: 'invalidPlatformResponse',
      );
    }

    final statusValue = value['status'];
    final status = switch (statusValue) {
      'saved' => PosterSaveStatus.saved,
      'permissionDenied' => PosterSaveStatus.permissionDenied,
      'cancelled' => PosterSaveStatus.cancelled,
      'unsupported' => PosterSaveStatus.unsupported,
      'busy' => PosterSaveStatus.busy,
      _ => PosterSaveStatus.failed,
    };

    return PosterSaveResult(
      status: status,
      uri: value['uri'] as String?,
      fileName: value['fileName'] as String?,
      errorCode: value['errorCode'] as String?,
    );
  }
}

abstract interface class PosterSaver {
  Future<PosterSaveResult> savePng(Uint8List pngBytes, {String? fileName});

  Future<bool> cancelPendingSave();
}

class MethodChannelPosterSaver implements PosterSaver {
  MethodChannelPosterSaver({MethodChannel? channel})
    : _channel = channel ?? const MethodChannel(_channelName);

  static const String _channelName = 'word_trail/poster';
  static const List<int> _pngSignature = <int>[
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ];

  final MethodChannel _channel;

  @override
  Future<PosterSaveResult> savePng(
    Uint8List pngBytes, {
    String? fileName,
  }) async {
    if (!_hasPngSignature(pngBytes)) {
      return const PosterSaveResult(
        status: PosterSaveStatus.failed,
        errorCode: 'invalidPng',
      );
    }

    try {
      final response = await _channel.invokeMethod<Object?>('savePng', {
        'bytes': pngBytes,
        'fileName': ?fileName,
      });
      return PosterSaveResult.fromPlatform(response);
    } on MissingPluginException {
      return const PosterSaveResult(status: PosterSaveStatus.unsupported);
    } on PlatformException catch (error) {
      return PosterSaveResult(
        status: PosterSaveStatus.failed,
        errorCode: error.code,
      );
    }
  }

  @override
  Future<bool> cancelPendingSave() async {
    try {
      return await _channel.invokeMethod<bool>('cancelPendingSave') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  static bool _hasPngSignature(Uint8List bytes) {
    if (bytes.length < _pngSignature.length) return false;
    for (var index = 0; index < _pngSignature.length; index += 1) {
      if (bytes[index] != _pngSignature[index]) return false;
    }
    return true;
  }
}
