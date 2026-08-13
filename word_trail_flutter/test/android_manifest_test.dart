import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android poster saving uses only the bounded legacy permission', () {
    final manifest = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync();

    expect(manifest, contains('android.permission.WRITE_EXTERNAL_STORAGE'));
    expect(manifest, contains('android:maxSdkVersion="28"'));
    expect(manifest, isNot(contains('android.permission.INTERNET')));
    expect(manifest, isNot(contains('MANAGE_EXTERNAL_STORAGE')));
    expect(manifest, isNot(contains('READ_EXTERNAL_STORAGE')));
    expect(manifest, isNot(contains('READ_MEDIA_IMAGES')));
  });
}
