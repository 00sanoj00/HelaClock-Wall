package lk.sinhala.welawa

import android.os.SystemClock
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import org.json.JSONObject

/**
 * ඇත්ත කාලගුණය (Open-Meteo — API key නැති, නොමිලේ). Settings එකේ "Live weather" on කළොත් විතරයි.
 * යවන්නේ තෝරපු නගරයේ අක්ෂාංශ/දේශාංශ විතරයි; පරිශීලකයාගේ කිසිම තොරතුරක් නැහැ.
 * විනාඩි 30කට වරක් background thread එකක ගන්නවා.
 */
object LiveWeather {

    class Snapshot(
        val rain: Float,      // 0..1
        val storm: Float,     // 0..1 (තද සුළඟ)
        val cloud: Float,     // 0..1
        val fog: Float,       // 0..1
        val thunder: Boolean,
    )

    @Volatile var current: Snapshot? = null
        private set
    @Volatile private var lastCity = -1
    @Volatile private var lastFetchMs = 0L
    @Volatile private var busy = false

    private const val INTERVAL_MS = 30 * 60_000L
    private const val RETRY_MS = 5 * 60_000L

    /** හැම frame එකකම කතා කළාට කමක් නැහැ — ඕන වෙලාවට විතරයි network එකට යන්නේ. */
    fun maybeFetch(cityIndex: Int) {
        val now = SystemClock.elapsedRealtime()
        if (busy) return
        val due = cityIndex != lastCity ||
            (current != null && now - lastFetchMs > INTERVAL_MS) ||
            (current == null && now - lastFetchMs > RETRY_MS) ||
            lastFetchMs == 0L
        if (!due) return
        if (cityIndex != lastCity) current = null
        busy = true
        lastCity = cityIndex
        lastFetchMs = now
        val city = SkyCalendar.city(cityIndex)
        Thread({
            try {
                val snap = fetch(city.lat, city.lon)
                current = snap
                Log.i("Welawa", "weather ${city.name}: rain=${snap.rain} storm=${snap.storm} cloud=${snap.cloud} fog=${snap.fog} thunder=${snap.thunder}")
            } catch (e: Exception) {
                Log.w("Welawa", "weather fetch failed: ${e.message}")
            } finally {
                busy = false
            }
        }, "welawa-weather").apply { isDaemon = true }.start()
    }

    private fun fetch(lat: Double, lon: Double): Snapshot {
        val url = URL(String.format(Locale.US,
            "https://api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f" +
                "&current=precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m&timezone=auto",
            lat, lon))
        val con = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000; readTimeout = 10_000
            setRequestProperty("User-Agent", "SinhalaWelawa-Wallpaper")
        }
        try {
            val body = con.inputStream.bufferedReader().use { it.readText() }
            val cur = JSONObject(body).getJSONObject("current")
            return fromValues(
                code = cur.optInt("weather_code", 0),
                precipMm = cur.optDouble("precipitation", 0.0).toFloat(),
                cloudPct = cur.optDouble("cloud_cover", 0.0).toFloat(),
                gustKmh = cur.optDouble("wind_gusts_10m", cur.optDouble("wind_speed_10m", 0.0)).toFloat(),
            )
        } finally {
            con.disconnect()
        }
    }

    /** WMO weather code + අගයන් → wallpaper එකේ කාලගුණය (unit test කරන්න පුළුවන් වෙන්න වෙනම). */
    fun fromValues(code: Int, precipMm: Float, cloudPct: Float, gustKmh: Float): Snapshot {
        val codeRain = when (code) {
            in 51..57 -> 0.45f
            61, 66, 80 -> 0.6f
            63, 81 -> 0.8f
            65, 67, 82 -> 1f
            in 95..99 -> 1f
            else -> 0f
        }
        val rain = maxOf(codeRain, (precipMm / 3f).coerceIn(0f, 1f))
        val thunder = code in 95..99
        val storm = maxOf(((gustKmh - 25f) / 35f).coerceIn(0f, 1f), if (thunder) 0.8f else 0f)
        val fog = if (code == 45 || code == 48) 1f else 0f
        return Snapshot(rain, storm, (cloudPct / 100f).coerceIn(0f, 1f), fog, thunder)
    }
}
