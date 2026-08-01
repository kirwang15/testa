import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let speechSynthesizer = AVSpeechSynthesizer()

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(
      name: "word_trail/speech",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard call.method == "speak" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let arguments = call.arguments as? [String: Any],
        let text = arguments["text"] as? String,
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      else {
        result(false)
        return
      }
      let utterance = AVSpeechUtterance(string: text)
      let locale = arguments["locale"] as? String ?? "en-US"
      utterance.voice = AVSpeechSynthesisVoice(language: locale)
        ?? AVSpeechSynthesisVoice(language: "en-US")
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.88
      self?.speechSynthesizer.stopSpeaking(at: .immediate)
      self?.speechSynthesizer.speak(utterance)
      result(true)
    }
  }
}
