package lk.sinhala.welawa

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class SinhalaTimeTest {

    private fun say(h: Int, m: Int) = SinhalaTime.phrase(h, m).full

    @Test fun userExamples() {
        assertEquals("වේලාව දහවල් එකයි", say(13, 0))
        assertEquals("වේලාව දහවල් එක පසුවී විනාඩි පහයි", say(13, 5))
        assertEquals("වේලාව දහවල් එක පසුවී විනාඩි දහයයි", say(13, 10))
        assertEquals("වේලාව දහවල් එකයි කාලයි", say(13, 15))
        assertEquals("වේලාව දහවල් එක පසුවී විනාඩි විසි පහයි", say(13, 25))
        assertEquals("වේලාව දහවල් එක හමාරයි", say(13, 30))
        assertEquals("වේලාව දහවල් එක පසුවී විනාඩි හතළිස් පහයි", say(13, 45))
        assertEquals("වේලාව දහවල් දෙකට විනාඩි දහයයි", say(13, 50))
        assertEquals("වේලාව දහවල් දෙකට විනාඩි පහයි", say(13, 55))
        assertEquals("වේලාව දහවල් එක පසුවී විනාඩි පනස් හයයි", say(13, 56))
        assertEquals("වේලාව සවස දෙකයි", say(14, 0))
        assertEquals("වේලාව දහවල් එකයි හතළිහයි", say(13, 40))
    }

    @Test fun periodsAndEdges() {
        val rathri = SinhalaTime.Period.RATHRI.word
        assertEquals("වේලාව $rathri දොළහයි", say(0, 0))
        assertEquals("වේලාව $rathri හය හමාරයි", say(18, 30))
        assertEquals("වේලාව සවස හය පසුවී විනාඩි විසි නවයයි", say(18, 29))
        assertEquals("වේලාව දහවල් දොළහයි", say(12, 0))
        assertEquals("වේලාව පාන්දර හතරයි", say(4, 0))
        assertEquals("වේලාව උදේ හයයි", say(6, 0))
        assertEquals("වේලාව උදේ දොළහට විනාඩි දහයයි", say(11, 50))
        assertEquals("වේලාව පාන්දර හයට විනාඩි පහයි", say(5, 55))
        assertEquals("වේලාව උදේ එකොළහ පසුවී විනාඩි දාහතරයි", say(11, 14))
    }

    @Test fun fmConversion() {
        assertEquals("fja,dj", FmConverter.convert("වේලාව"))
        assertEquals("rd;%S", FmConverter.convert(SinhalaTime.Period.RATHRI.word))
        assertEquals("tfld<yhs", FmConverter.convert("එකොළහයි"))
        assertEquals(";=khs", FmConverter.convert("තුනයි"))
        assertEquals("mdkaor", FmConverter.convert("පාන්දර"))
        assertEquals("Wfoa", FmConverter.convert("උදේ"))
        assertEquals("úkdä", FmConverter.convert("විනාඩි"))
        assertEquals("miqù", FmConverter.convert("පසුවී"))
        assertEquals("úiaihs", FmConverter.convert("විස්සයි"))
    }

    /** සියලු මිනිත්තු 1440 ම file එකකට ලියනවා (font එකෙන් render කරලා බලන්න). */
    @Test fun dumpAll() {
        val out = StringBuilder()
        for (h in 0 until 24) for (m in 0 until 60) {
            val p = SinhalaTime.phrase(h, m)
            out.append("%02d:%02d\t%s\t%s\n".format(h, m, p.full, FmConverter.convert(p.full)))
        }
        File("build/all_phrases.tsv").writeText(out.toString())
    }
}
