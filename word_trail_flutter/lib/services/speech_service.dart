import 'package:flutter/services.dart';

class SpeechService {
  static const MethodChannel _channel = MethodChannel('word_trail/speech');

  Future<bool> speak(String text, {String locale = 'en-US'}) async {
    try {
      final result = await _channel.invokeMethod<bool>('speak', {
        'text': text,
        'locale': locale,
      });
      return result ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
