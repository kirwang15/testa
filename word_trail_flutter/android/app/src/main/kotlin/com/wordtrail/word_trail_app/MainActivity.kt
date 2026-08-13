package com.wordtrail.word_trail_app

import android.speech.tts.TextToSpeech
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

class MainActivity : FlutterActivity(), TextToSpeech.OnInitListener {
    private var textToSpeech: TextToSpeech? = null
    private var speechReady = false
    private var posterChannel: PosterChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        textToSpeech = TextToSpeech(this, this)
        posterChannel = PosterChannel(this).also { it.register(flutterEngine) }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "word_trail/speech")
            .setMethodCallHandler { call, result ->
                if (call.method != "speak") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val text = call.argument<String>("text")?.trim().orEmpty()
                val locale = call.argument<String>("locale") ?: "en-US"
                if (!speechReady || text.isEmpty()) {
                    result.success(false)
                    return@setMethodCallHandler
                }
                textToSpeech?.language = Locale.forLanguageTag(locale)
                val status = textToSpeech?.speak(
                    text,
                    TextToSpeech.QUEUE_FLUSH,
                    null,
                    "word-trail-${System.currentTimeMillis()}"
                )
                result.success(status == TextToSpeech.SUCCESS)
            }
    }

    override fun onInit(status: Int) {
        speechReady = status == TextToSpeech.SUCCESS
        if (speechReady) textToSpeech?.language = Locale.US
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (posterChannel?.onRequestPermissionsResult(requestCode, grantResults) == true) {
            return
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    override fun onDestroy() {
        posterChannel?.dispose()
        posterChannel = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        super.onDestroy()
    }
}
