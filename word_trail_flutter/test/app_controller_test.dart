import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/app_controller.dart';
import 'package:word_trail_app/models/player_state.dart';
import 'package:word_trail_app/services/local_store.dart';

class MemoryStore extends LocalStore {
  MemoryStore([this.value]);
  String? value;
  String? futureBackup;
  bool failWrites = false;

  @override
  Future<String?> read() async => value;

  @override
  Future<bool> write(String value) async {
    if (failWrites) return false;
    this.value = value;
    return true;
  }

  @override
  Future<void> preserveFutureSave(String value) async {
    futureBackup = value;
  }
}

void main() {
  test('recovers from malformed local save without a blank screen', () async {
    final controller = AppController(store: MemoryStore('{broken'));
    await controller.initialize();
    expect(controller.storageStatus, StorageStatus.recovered);
    expect(controller.hasProfile, isFalse);
  });

  test('future save is preserved and never overwritten', () async {
    final raw = jsonEncode({'storageVersion': 999, 'profiles': {}});
    final store = MemoryStore(raw);
    final controller = AppController(store: store);
    await controller.initialize();
    expect(controller.storageStatus, StorageStatus.unsupportedVersion);
    expect(store.futureBackup, raw);
    expect(store.value, raw);
  });

  test('profiles keep progress isolated', () async {
    final store = MemoryStore();
    final controller = AppController(store: store);
    await controller.initialize();
    controller.createProfile(
      nickname: 'One',
      ageBand: AgeBand.tenToTwelve,
      uiLanguage: UiLanguage.english,
    );
    final firstId = controller.activeProfile!.id;
    controller.recordWrong(
      levelId: 'nce-1997-b1-level-001',
      wordId: 'nce-1997-b1-what',
    );
    controller.createProfile(
      nickname: 'Two',
      ageBand: AgeBand.sevenToNine,
      uiLanguage: UiLanguage.chinese,
    );
    expect(controller.activeProfile!.review, isEmpty);
    controller.switchProfile(firstId);
    expect(controller.activeProfile!.review, contains('nce-1997-b1-what'));
  });
}

