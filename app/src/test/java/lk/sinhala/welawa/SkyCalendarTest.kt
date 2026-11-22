package lk.sinhala.welawa

import java.util.Calendar
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyCalendarTest {
    private fun cal(y: Int, m: Int, d: Int, h: Int = 12): Calendar =
        Calendar.getInstance(TimeZone.getTimeZone("Asia/Colombo")).apply { clear(); set(y, m - 1, d, h, 0, 0) }

    @Test fun sunTimesSigiriya() {
        // සීගිරිය: හිරු උදාව ~6:00–6:30, බැසීම ~17:50–18:30 (අවුරුද්ද පුරාම)
        for (m in 1..12) {
            val (rise, set) = SkyCalendar.sunTimes(cal(2026, m, 15), 7.957, 80.760)
            assertTrue("rise $m = $rise", rise in 340f..395f)
            assertTrue("set $m = $set", set in 1055f..1115f)
        }
    }

    @Test fun poyaDays2026() {
        // 2026 ඇත්ත පසළොස්වක දින කීපයක් (UTC පූර්ණ සඳ: ජන 3, මැයි 1, මැයි 31, නොවැ 24)
        assertTrue(SkyCalendar.isPoya(cal(2026, 1, 3)))
        assertTrue(SkyCalendar.isPoya(cal(2026, 5, 1)))
        assertTrue(SkyCalendar.isPoya(cal(2026, 5, 31)))
        assertTrue(SkyCalendar.isPoya(cal(2026, 11, 24)))
        assertTrue(SkyCalendar.isPoya(cal(2026, 12, 24)))
        // අවුරුද්දකට පොහොය 12–13ක්
        var n = 0
        val c = cal(2026, 1, 1)
        repeat(365) { if (SkyCalendar.isPoya(c)) n++; c.add(Calendar.DAY_OF_MONTH, 1) }
        assertTrue("poya count $n", n in 12..13)
        assertEquals(false, SkyCalendar.isPoya(cal(2026, 11, 21)))
    }

    @Test fun weatherMapping() {
        val w = LiveWeather.fromValues(code = 95, precipMm = 6f, cloudPct = 100f, gustKmh = 70f)
        assertEquals(1f, w.rain, 0.001f); assertTrue(w.thunder); assertEquals(1f, w.storm, 0.001f)
        val c = LiveWeather.fromValues(code = 0, precipMm = 0f, cloudPct = 10f, gustKmh = 10f)
        assertEquals(0f, c.rain, 0.001f); assertEquals(0f, c.storm, 0.001f)
    }

}
