package com.wordtrail.word_trail_app

import android.Manifest
import android.app.Activity
import android.content.ContentResolver
import android.content.ContentValues
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

internal class PosterChannel(
    private val activity: Activity,
    private val resolver: ContentResolver = activity.contentResolver,
    private val ioExecutor: ExecutorService = Executors.newSingleThreadExecutor(),
) {
    companion object {
        const val CHANNEL_NAME = "word_trail/poster"
        const val LEGACY_PERMISSION_REQUEST_CODE = 7402
        private const val ALBUM_NAME = "WordTrail"
        private const val MIME_TYPE_PNG = "image/png"
    }

    private data class SaveRequest(
        val bytes: ByteArray,
        val requestedFileName: String?,
        val result: MethodChannel.Result,
    )

    private var channel: MethodChannel? = null
    private var pendingPermissionRequest: SaveRequest? = null
    private var saveInProgress = false

    fun register(flutterEngine: FlutterEngine) {
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL_NAME).also {
            it.setMethodCallHandler(::onMethodCall)
        }
    }

    fun dispose() {
        pendingPermissionRequest?.result?.success(status("cancelled"))
        pendingPermissionRequest = null
        channel?.setMethodCallHandler(null)
        channel = null
        ioExecutor.shutdown()
    }

    fun onRequestPermissionsResult(
        requestCode: Int,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != LEGACY_PERMISSION_REQUEST_CODE) return false

        val request = pendingPermissionRequest ?: return true
        pendingPermissionRequest = null
        val granted = grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        if (granted) {
            save(request)
        } else {
            request.result.success(status("permissionDenied"))
        }
        return true
    }

    private fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "savePng" -> startSave(call, result)
            "cancelPendingSave" -> {
                val pending = pendingPermissionRequest
                pendingPermissionRequest = null
                pending?.result?.success(status("cancelled"))
                result.success(pending != null)
            }
            else -> result.notImplemented()
        }
    }

    private fun startSave(call: MethodCall, result: MethodChannel.Result) {
        val bytes = call.argument<ByteArray>("bytes")
        if (bytes == null || !PosterFileNaming.hasPngSignature(bytes)) {
            result.success(status("failed", errorCode = "invalidPng"))
            return
        }
        if (saveInProgress || pendingPermissionRequest != null) {
            result.success(status("busy"))
            return
        }

        val request = SaveRequest(
            bytes = bytes,
            requestedFileName = call.argument<String>("fileName"),
            result = result,
        )
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingPermissionRequest = request
            activity.requestPermissions(
                arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                LEGACY_PERMISSION_REQUEST_CODE,
            )
            return
        }
        save(request)
    }

    private fun save(request: SaveRequest) {
        saveInProgress = true
        ioExecutor.execute {
            val response = try {
                saveToMediaStore(request.bytes, request.requestedFileName)
            } catch (_: SecurityException) {
                status("permissionDenied")
            } catch (_: IOException) {
                status("failed", errorCode = "writeFailed")
            } catch (_: RuntimeException) {
                status("failed", errorCode = "platformFailure")
            }
            activity.runOnUiThread {
                saveInProgress = false
                request.result.success(response)
            }
        }
    }

    private fun saveToMediaStore(
        pngBytes: ByteArray,
        requestedFileName: String?,
    ): Map<String, String> {
        val normalized = PosterFileNaming.normalizePngName(requestedFileName)
        val fileName = uniqueFileName(normalized)
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Images.Media.MIME_TYPE, MIME_TYPE_PNG)
            put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    "${Environment.DIRECTORY_PICTURES}/$ALBUM_NAME",
                )
                put(MediaStore.Images.Media.IS_PENDING, 1)
            } else {
                val directory = legacyAlbumDirectory()
                if (!directory.exists() && !directory.mkdirs()) {
                    throw IOException("Unable to create poster directory")
                }
                put(MediaStore.Images.Media.DATA, File(directory, fileName).absolutePath)
            }
        }

        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
        val uri = resolver.insert(collection, values)
            ?: return status("failed", errorCode = "insertFailed")

        try {
            resolver.openOutputStream(uri, "w")?.use { stream ->
                stream.write(pngBytes)
                stream.flush()
            } ?: throw IOException("Unable to open poster output stream")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val published = ContentValues().apply {
                    put(MediaStore.Images.Media.IS_PENDING, 0)
                }
                if (resolver.update(uri, published, null, null) <= 0) {
                    throw IOException("Unable to publish saved poster")
                }
            }
        } catch (error: Exception) {
            resolver.delete(uri, null, null)
            throw error
        }

        return status("saved", uri = uri.toString(), fileName = fileName)
    }

    private fun uniqueFileName(normalized: String): String {
        return PosterFileNaming.uniquePngName(normalized, ::fileNameExists)
    }

    private fun fileNameExists(fileName: String): Boolean {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            return File(legacyAlbumDirectory(), fileName).exists()
        }

        val collection = MediaStore.Images.Media.getContentUri(
            MediaStore.VOLUME_EXTERNAL_PRIMARY,
        )
        val relativePath = "${Environment.DIRECTORY_PICTURES}/$ALBUM_NAME/"
        resolver.query(
            collection,
            arrayOf(MediaStore.Images.Media._ID),
            "${MediaStore.Images.Media.DISPLAY_NAME} = ? AND " +
                "${MediaStore.Images.Media.RELATIVE_PATH} = ?",
            arrayOf(fileName, relativePath),
            null,
        )?.use { cursor ->
            return cursor.moveToFirst()
        }
        return false
    }

    @Suppress("DEPRECATION")
    private fun legacyAlbumDirectory(): File = File(
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
        ALBUM_NAME,
    )

    private fun status(
        value: String,
        uri: String? = null,
        fileName: String? = null,
        errorCode: String? = null,
    ): Map<String, String> = buildMap {
        put("status", value)
        if (uri != null) put("uri", uri)
        if (fileName != null) put("fileName", fileName)
        if (errorCode != null) put("errorCode", errorCode)
    }
}

internal object PosterFileNaming {
    private val invalidCharacters = Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]")
    private val pngSignature = byteArrayOf(
        0x89.toByte(),
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
    )

    fun normalizePngName(requested: String?): String {
        val cleaned = requested
            ?.trim()
            ?.replace(invalidCharacters, "-")
            ?.trim('.', ' ', '-')
            .orEmpty()
        val withoutExtension = if (cleaned.endsWith(".png", ignoreCase = true)) {
            cleaned.dropLast(4)
        } else {
            cleaned
        }
        val stem = withoutExtension.take(96).trim('.', ' ', '-')
        return "${stem.ifEmpty { "word-trail-vocabulary" }}.png"
    }

    fun hasPngSignature(bytes: ByteArray): Boolean {
        if (bytes.size < pngSignature.size) return false
        return pngSignature.indices.all { bytes[it] == pngSignature[it] }
    }

    fun uniquePngName(
        normalized: String,
        exists: (String) -> Boolean,
        fallbackToken: Long = System.currentTimeMillis(),
    ): String {
        if (!exists(normalized)) return normalized
        val stem = normalized.removeSuffix(".png")
        for (suffix in 1..9999) {
            val candidate = "$stem ($suffix).png"
            if (!exists(candidate)) return candidate
        }
        return "$stem-$fallbackToken.png"
    }
}
