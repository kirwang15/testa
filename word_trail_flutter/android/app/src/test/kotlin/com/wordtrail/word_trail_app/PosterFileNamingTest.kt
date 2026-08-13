package com.wordtrail.word_trail_app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PosterFileNamingTest {
    @Test
    fun `normalizes unsafe and missing file names`() {
        assertEquals(
            "word-trail-vocabulary.png",
            PosterFileNaming.normalizePngName(null),
        )
        assertEquals(
            "result-test.png",
            PosterFileNaming.normalizePngName(" ../result/test.PNG "),
        )
        assertEquals(
            "vocabulary.png",
            PosterFileNaming.normalizePngName("vocabulary"),
        )
    }

    @Test
    fun `accepts only bytes with a PNG signature`() {
        val valid = byteArrayOf(
            0x89.toByte(),
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
        )

        assertTrue(PosterFileNaming.hasPngSignature(valid))
        assertFalse(PosterFileNaming.hasPngSignature(byteArrayOf(1, 2, 3)))
        assertFalse(
            PosterFileNaming.hasPngSignature(valid.copyOf().also { it[1] = 0 }),
        )
    }

    @Test
    fun `adds a suffix instead of replacing an existing poster`() {
        val existing = setOf("result.png", "result (1).png")

        assertEquals(
            "result (2).png",
            PosterFileNaming.uniquePngName("result.png", existing::contains),
        )
    }
}
