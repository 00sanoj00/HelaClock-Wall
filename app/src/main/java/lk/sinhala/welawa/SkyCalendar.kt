package lk.sinhala.welawa

import java.util.Calendar
import java.util.TimeZone
import kotlin.math.PI
import kotlin.math.acos
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.tan

/**
 * Internet නැතුව ගණනය කරන ලාංකීය දින දර්ශන දේවල්:
 * හිරු උදාව / බැසීම, සඳේ කලාව, පොහොය, වෙසක් / අවුරුදු කාලය.
 */
object SkyCalendar {

    /** නගරයක්: settings එකේ පෙන්වන නම (English), අක්ෂාංශ, දේශාංශ. */
    class City(val name: String, val lat: Double, val lon: Double)

    val CITIES = listOf(
        City("Sigiriya", 7.957, 80.760),
        City("Colombo", 6.927, 79.861),
        City("Kandy", 7.291, 80.636),
        City("Galle", 6.053, 80.221),
        City("Jaffna", 9.661, 80.026),
        City("Anuradhapura", 8.311, 80.404),
        City("Kurunegala", 7.487, 80.365),
        City("Nuwara Eliya", 6.970, 80.783),
        City("Trincomalee", 8.588, 81.211),
        City("Batticaloa", 7.731, 81.674),
        City("Ratnapura", 6.683, 80.399),
        City("Matara", 5.949, 80.535),
        City("Badulla", 6.989, 81.055),
    )

    fun city(i: Int) = CITIES[i.coerceIn(0, CITIES.lastIndex)]

    // ------------------------------------------------------------------ හිරු
    /**
     * හිරු උදාව සහ බැසීම (දවසේ මිනිත්තු, local time). NOAA සරල සූත්‍රය — විනාඩි 1–2 ක් ඇතුළත නිවැරදියි.
     */
    fun sunTimes(cal: Calendar, lat: Double, lon: Double): Pair<Float, Float> {
        val doy = cal.get(Calendar.DAY_OF_YEAR)
        val g = 2 * PI / 365.0 * (doy - 1)
        val eqTime = 229.18 * (0.000075 + 0.001868 * cos(g) - 0.032077 * sin(g) -
            0.014615 * cos(2 * g) - 0.040849 * sin(2 * g))
        val decl = 0.006918 - 0.399912 * cos(g) + 0.070257 * sin(g) - 0.006758 * cos(2 * g) +
            0.000907 * sin(2 * g) - 0.002697 * cos(3 * g) + 0.00148 * sin(3 * g)
        val latR = Math.toRadians(lat)
        val cosHa = (cos(Math.toRadians(90.833)) / (cos(latR) * cos(decl)) - tan(latR) * tan(decl)).coerceIn(-1.0, 1.0)
        val ha = Math.toDegrees(acos(cosHa))
        val tz = cal.timeZone.getOffset(cal.timeInMillis) / 60_000.0
        val rise = 720 - 4 * (lon + ha) - eqTime + tz
        val set = 720 - 4 * (lon - ha) - eqTime + tz
        return Pair(rise.toFloat(), set.toFloat())
    }

    // ------------------------------------------------------------------ සඳ
    private const val SYNODIC = 29.530588853
    private const val NEW_MOON_JD = 2451550.1        // 2000-01-06 නව සඳ

    /** සඳේ වයස 0..1 (0 = අමාවක, 0.5 = පසළොස්වක). */
    fun moonAge(epochMs: Long): Double {
        val jd = epochMs / 86_400_000.0 + 2440587.5
        val a = (jd - NEW_MOON_JD) / SYNODIC
        return a - floor(a)
    }

    /** සඳේ ආලෝකමත් කොටස 0..1. */
    fun moonIllumination(epochMs: Long) = ((1 - cos(2 * PI * moonAge(epochMs))) / 2).toFloat()

    /** දවසේ (local) ආරම්භයේ epoch ms. */
    private fun dayStart(cal: Calendar): Long = (cal.clone() as Calendar).apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    /**
     * k වෙනි පූර්ණ සඳ මොහොත (Julian day). Meeus, Astronomical Algorithms, 49 පරිච්ඡේදය —
     * විනාඩි කීපයක් ඇතුළත නිවැරදියි (සරල සාමාන්‍ය චක්‍රය පැය 14ක් දක්වා වැරදෙනවා).
     */
    fun fullMoonJd(kInt: Long): Double {
        val k = kInt + 0.5
        val t = k / 1236.85
        val r = PI / 180
        val m = (2.5534 + 29.10535670 * k - 0.0000014 * t * t) * r
        val mp = (201.5643 + 385.81693528 * k + 0.0107582 * t * t) * r
        val f = (160.7108 + 390.67050284 * k - 0.0016118 * t * t) * r
        val om = (124.7746 - 1.56375588 * k + 0.0020672 * t * t) * r
        val e = 1 - 0.002516 * t - 0.0000074 * t * t
        var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * t * t
        jde += -0.40614 * sin(mp) + 0.17302 * e * sin(m) + 0.01614 * sin(2 * mp) + 0.01043 * sin(2 * f) +
            0.00734 * e * sin(mp - m) - 0.00515 * e * sin(mp + m) + 0.00209 * e * e * sin(2 * m) -
            0.00111 * sin(mp - 2 * f) - 0.00057 * sin(mp + 2 * f) + 0.00056 * e * sin(2 * mp + m) -
            0.00042 * sin(3 * mp) + 0.00042 * e * sin(m + 2 * f) + 0.00038 * e * sin(m - 2 * f) -
            0.00024 * e * sin(2 * mp - m) - 0.00017 * sin(om)
        return jde
    }

    /** අද පසළොස්වක (පොහොය) දවසද — පූර්ණ සඳ මොහොත අද (local) දවස ඇතුළේ නම්. */
    fun isPoya(cal: Calendar): Boolean {
        val s = dayStart(cal)
        val jd = s / 86_400_000.0 + 2440587.5
        val k0 = floor((jd - 2451550.09766) / 29.530588861).toLong()
        for (k in k0 - 1..k0 + 1) {
            val ms = ((fullMoonJd(k) - 2440587.5) * 86_400_000.0).toLong()
            if (ms >= s && ms < s + 86_400_000L) return true
        }
        return false
    }


    /** වෙසක් කාලය: වෙසක් පොහොයට දවසකට කලින් සිට දවස් 2කට පසුව දක්වා (වෙසක් කූඩු). */
    fun isVesakSeason(cal: Calendar): Boolean {
        for (d in -2..1) {
            val c = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, d) }
            if (c.get(Calendar.MONTH) == Calendar.MAY && isPoya(c)) return true
        }
        return false
    }

    /** සිංහල-දෙමළ අලුත් අවුරුදු කාලය (අප්‍රේල් 10 – 17): එරබදු මල්. */
    fun isAvurudu(cal: Calendar): Boolean =
        cal.get(Calendar.MONTH) == Calendar.APRIL && cal.get(Calendar.DAY_OF_MONTH) in 10..17

    fun now(): Calendar = Calendar.getInstance(TimeZone.getDefault())
}
