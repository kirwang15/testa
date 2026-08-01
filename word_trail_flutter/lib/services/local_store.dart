import 'package:shared_preferences/shared_preferences.dart';

class LocalStore {
  static const saveKey = 'word_trail_flutter_save_v3';
  static const futureBackupKey = 'word_trail_flutter_future_save_backup';

  Future<String?> read() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      return preferences.getString(saveKey);
    } catch (_) {
      return null;
    }
  }

  Future<bool> write(String value) async {
    try {
      final preferences = await SharedPreferences.getInstance();
      return preferences.setString(saveKey, value);
    } catch (_) {
      return false;
    }
  }

  Future<void> preserveFutureSave(String value) async {
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setString(futureBackupKey, value);
    } catch (_) {
      // Recovery must never make the app fail to open.
    }
  }

  Future<void> clear() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.remove(saveKey);
    } catch (_) {
      // The in-memory reset still leaves the app usable.
    }
  }
}
