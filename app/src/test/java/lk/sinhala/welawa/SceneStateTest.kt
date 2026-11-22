package lk.sinhala.welawa

import org.junit.Assert.assertEquals
import org.junit.Test

/** Rain / Strong wind settings: On/Off හැමවිටම පරිශීලකයාගේ තේරීම; live weather වැඩ කරන්නේ Random එකේදී විතරයි. */
class SceneStateTest {

    private fun settle(s: SceneState, rain: Int, storm: Int) {
        repeat(200) { s.update(720f, 20000L, rain, storm, 0.1f) }
    }

    private val clearSky = LiveWeather.fromValues(code = 0, precipMm = 0f, cloudPct = 10f, gustKmh = 5f)
    private val heavyRain = LiveWeather.fromValues(code = 65, precipMm = 6f, cloudPct = 100f, gustKmh = 70f)

    @Test fun onOverridesClearLiveWeather() {
        val s = SceneState().apply { live = clearSky }
        settle(s, Settings.RAIN_ALWAYS, Settings.STORM_ALWAYS)
        assertEquals(1f, s.rain, 0.001f)
        assertEquals(1f, s.storm, 0.001f)
    }

    @Test fun offOverridesRainyLiveWeather() {
        val s = SceneState().apply { live = heavyRain }
        settle(s, Settings.RAIN_OFF, Settings.STORM_OFF)
        assertEquals(0f, s.rain, 0.001f)
        assertEquals(0f, s.storm, 0.001f)
    }

    @Test fun randomFollowsLiveWeather() {
        val s = SceneState().apply { live = heavyRain }
        settle(s, Settings.RAIN_RANDOM, Settings.STORM_RANDOM)
        assertEquals(1f, s.rain, 0.001f)
        assertEquals(1f, s.storm, 0.001f)
    }
}
