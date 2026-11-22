package lk.sinhala.welawa

import org.junit.Assert.assertEquals
import org.junit.Test

/** Isi fonts (Abhaya, Dhara) — මේ outputs font එකෙන් render කරලා ඇසින් පරීක්ෂා කළා. */
class IsiConverterTest {
    @Test fun basicWords() {
        assertEquals("»{Šz£{", IsiConverter.convert("වේලාව"))
        assertEquals("r£pŠny", IsiConverter.convert("පාන්දර"))
        assertEquals("nƒ{zŠ", IsiConverter.convert("දහවල්"))
        assertEquals("W»Y£…ƒxŒ", IsiConverter.convert("එකොළහයි"))
        assertEquals("l§pxŒ", IsiConverter.convert("තුනයි"))
        assertEquals("ýp£Õ", IsiConverter.convert("විනාඩි"))
        assertEquals("r~§þ", IsiConverter.convert("පසුවී"))
    }

    @Test fun conjuncts() {
        assertEquals("y£l®œ", IsiConverter.convert("රාත්‍රී"))
        assertEquals("Q", IsiConverter.convert("ශ්‍රී"))
        assertEquals("Y³", IsiConverter.convert("ක්‍ය"))
        assertEquals("æ", IsiConverter.convert("ද්‍ර"))
    }

    @Test fun vowels() {
        assertEquals("A", IsiConverter.convert("ඒ"))
        assertEquals("B", IsiConverter.convert("ඕ"))
        assertEquals("U\u00B0", IsiConverter.convert("ඌ"))
        assertEquals("Q z\u00B9Y\u00A3", IsiConverter.convert("ශ්‍රී ලංකා"))
    }

    @Test fun fontDetection() {
        assertEquals(true, TextPainter.isIsiFont("isi_abhaya.ttf"))
        assertEquals(false, TextPainter.isIsiFont("apex023.ttf"))
        assertEquals(false, TextPainter.isIsiFont("FM-Malithi-x.ttf"))
    }
}
