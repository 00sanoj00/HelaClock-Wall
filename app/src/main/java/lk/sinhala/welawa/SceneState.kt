package lk.sinhala.welawa

import kotlin.math.max
import kotlin.math.min

/**
 * දවසේ වෙලාව (මිනිත්තු, 0..1440) අනුව පසුබිම් image 5 කොච්චර පේනවද,
 * effects (තරු, කළාමැදිරි, සමනලුන්, මීදුම ...) කොච්චර තියෙනවද කියලා ගණනය කරනවා.
 *
 * Image පිළිවෙළ: 0 පාන්දර, 1 උදේ, 2 දහවල්, 3 සවස, 4 රාත්‍රී
 */
class SceneState {

    /** image 5ට අදාළ බර (එකතුව = 1). */
    val weights = FloatArray(5)

    // shader එකට යන අගයන්
    val cloudTint = FloatArray(3)
    val mistTint = FloatArray(3)
    val sunColor = FloatArray(3)
    val sunPos = FloatArray(2)
    val textTint = FloatArray(3)
    var cloudAmount = 0f
    var sunAmount = 0f
    var ambient = 1f
    /** පාන්දර / උදෑසන ඝන මීදුම (0..1): 3:30 සිට වැඩි වෙලා, 9:45 වෙනකොට නැති වෙනවා. */
    var earlyMist = 0f
    /** සුළඟේ ශක්තිය (0..1): දහවල් වෙලාවට තදයි, වැස්සට තවත් තදයි. */
    var wind = 0f
    /** වැස්ස (0..1). */
    var rain = 0f
    /** තද සුළඟ (0..1): ගස් වේගයෙන් නැවෙනවා, වතුර කැළඹෙනවා, දූවිලි. */
    var storm = 0f
    /** අකුණු (0..1): තද වැස්ස + සුළඟ, නැත්නම් ඇත්ත කාලගුණයේ ගිගුරුම්. */
    var thunder = 0f
    /** දේදුන්න (0..1): වැස්ස ඉවර වෙලා හිරු එළිය එනකොට ටික වෙලාවකට. */
    var rainbow = 0f
    private var rainbowT = 0f
    private var rainArmed = false

    /** ඇත්ත කාලගුණය (Live weather on නම්) — එතකොට Random/On settings වෙනුවට මේක. */
    var live: LiveWeather.Snapshot? = null

    /** image දෙක මිශ්‍ර කරන්න: imgA, imgB, mix */
    var imgA = 0; var imgB = 0; var mix = 0f

    /**
     * @param day      දවසේ අංකය (epoch එකේ සිට) — අහඹු වැස්ස දවසටම එකම විදිහට එන්න
     * @param rainMode Settings.RAIN_*
     * @param stormMode Settings.STORM_*
     */
    fun update(
        minuteOfDay: Float, day: Long = 0L,
        rainMode: Int = Settings.RAIN_OFF, stormMode: Int = Settings.STORM_OFF,
        dt: Float = 1f,
    ) {
        val m = ((minuteOfDay % 1440f) + 1440f) % 1440f
        weights.fill(0f)
        // (පටන් ගන්න මිනිත්තුව, ඉවර වෙන මිනිත්තුව, from image, to image)
        var placed = false
        for (t in TRANSITIONS) {
            if (m >= t[0] && m < t[1]) {
                val k = smooth((m - t[0]) / (t[1] - t[0]))
                weights[t[2].toInt()] = 1f - k
                weights[t[3].toInt()] += k
                placed = true
                break
            }
        }
        if (!placed) weights[holdImage(m)] = 1f

        // ලොකුම බර දෙක
        var a = 0; var b = 1
        if (weights[b] > weights[a]) { a = 1; b = 0 }
        for (i in 2 until 5) {
            if (weights[i] > weights[a]) { b = a; a = i } else if (weights[i] > weights[b]) b = i
        }
        val sum = weights[a] + weights[b]
        imgA = a; imgB = b
        mix = if (sum > 0f) weights[b] / sum else 0f

        blend3(cloudTint, CLOUD_TINT)
        blend3(mistTint, MIST_TINT)
        blend3(textTint, TEXT_TINT)
        earlyMist = ramp(m, 210f, 280f) * (1f - ramp(m, 450f, 585f))
        wind = 0.18f + 0.82f * ramp(m, 570f, 690f) * (1f - ramp(m, 900f, 1020f))
        cloudAmount = blend1(CLOUD_AMOUNT)
        ambient = blend1(AMBIENT)
        val lw = live
        if (lw != null) {
            cloudAmount = 0.15f + 0.85f * lw.cloud
            earlyMist = max(earlyMist, lw.fog)
        }

        // ---- දහවල් වැස්ස: වලාකුළු අඳුරු වෙනවා, හිරු නැති වෙනවා, සුළඟ තද වෙනවා
        // setting එක මාරු කළාම එකපාරටම පනින්නේ නැතුව තත්පර ~2කින් සුමටව එනවා
        // පරිශීලකයාගේ තේරීම මුලින්: On = හැමවිටම, Off = කවදාවත් නෑ. Live weather වැඩ කරන්නේ "Random" එකේදී විතරයි.
        // (කලින් live weather on නම් On/Off දෙකම නොසලකා හැරියා — ඒකයි On කළාට වැස්ස/සුළඟ නොපෙනුණේ.)
        val liveRain = if (rainMode == Settings.RAIN_RANDOM) lw?.rain else null
        val liveStorm = if (stormMode == Settings.STORM_RANDOM) lw?.storm else null
        rain = approach(rain, liveRain ?: rainAt(m, day, rainMode), dt * 0.6f)
        if (rain > 0f) {
            val r = rain
            for (c in 0 until 3) {
                cloudTint[c] += (RAIN_CLOUD[c] - cloudTint[c]) * r
                mistTint[c] += (RAIN_MIST[c] - mistTint[c]) * r
            }
            cloudAmount += (1f - cloudAmount) * r
            ambient *= 1f - 0.28f * r
            wind = max(wind, 0.35f + 0.65f * r)
        }

        storm = approach(storm, liveStorm ?: stormAt(m, day, stormMode, rainMode), dt * 0.6f)
        wind = max(wind, 0.5f + 0.5f * storm)
        thunder = if (liveRain != null && lw?.thunder == true) rain else rain * smoothStep(0.25f, 0.7f, storm)

        // ---- දේදුන්න: වැස්සක් (>0.4) ඉවර වුණාම, දවල් නම්, විනාඩි ~5ක් පේනවා
        val sunUp = weights[1] + weights[2] + weights[3] * 0.8f
        if (rain > 0.4f) rainArmed = true
        if (rainArmed && rain < 0.06f) {
            rainArmed = false
            if (sunUp > 0.3f) rainbowT = 1f
        }
        rainbowT = max(0f, rainbowT - dt / 300f)
        rainbow = (rainbowT * (1f - rainbowT) * 5f).coerceIn(0f, 1f) * min(1f, sunUp * 1.5f) * (1f - rain)

        // හිරු එළිය (උදේ වම් පැත්තෙන්, සවස දකුණු පැත්තෙන්)
        val sw = FloatArray(5) { weights[it] * SUN_AMOUNT[it] }
        val st = sw.sum()
        sunAmount = st * (1f - rain)
        if (st > 1e-4f) {
            sunPos[0] = 0f; sunPos[1] = 0f
            sunColor.fill(0f)
            for (i in 0 until 5) {
                val w = sw[i] / st
                sunPos[0] += SUN_POS[i][0] * w
                sunPos[1] += SUN_POS[i][1] * w
                for (c in 0 until 3) sunColor[c] += SUN_COLOR[i][c] * w
            }
        }
    }

    val dawn get() = weights[0]
    val morning get() = weights[1]
    val noon get() = weights[2]
    val evening get() = weights[3]
    val night get() = weights[4]

    private fun blend3(out: FloatArray, table: Array<FloatArray>) {
        out.fill(0f)
        for (i in 0 until 5) for (c in 0 until 3) out[c] += table[i][c] * weights[i]
    }

    private fun blend1(table: FloatArray): Float {
        var s = 0f
        for (i in 0 until 5) s += table[i] * weights[i]
        return s
    }

    companion object {
        /** මාරු වීම්: [පටන්ගන්න, ඉවරයි, from, to] (මිනිත්තු) */
        private val TRANSITIONS = arrayOf(
            floatArrayOf(255f, 315f, 4f, 0f),   // 4:15 – 5:15  රාත්‍රී → පාන්දර
            floatArrayOf(350f, 400f, 0f, 1f),   // 5:50 – 6:40  පාන්දර → උදේ
            floatArrayOf(540f, 630f, 1f, 2f),   // 9:00 – 10:30 උදේ → දහවල්
            floatArrayOf(930f, 1050f, 2f, 3f),  // 15:30 – 17:30 දහවල් → සවස
            floatArrayOf(1110f, 1170f, 3f, 4f), // 18:30 – 19:30 සවස → රාත්‍රී
        )

        private fun holdImage(m: Float): Int = when {
            m < 255f -> 4
            m < 350f -> 0
            m < 540f -> 1
            m < 930f -> 2
            m < 1110f -> 3
            else -> 4
        }

        private val RAIN_CLOUD = floatArrayOf(.50f, .53f, .58f)
        private val RAIN_MIST = floatArrayOf(.66f, .70f, .74f)

        /** එක වැස්සක්: පටන්ගන්න මිනිත්තුව, කාලය, ශක්තිය. */
        private class Shower(val start: Float, val dur: Float, val strength: Float)

        /**
         * දවසේ වැසි. RANDOM: වැසි 2ක් වෙන්න පුළුවන් (හැම එකක්ම ~45% ඉඩක්), 10:00 – 15:00 අතර,
         * විනාඩි 25 – 85ක්. දවසේ අංකයෙන් seed කරන නිසා wallpaper එකටයි preview එකටයි එකම රටාව.
         */
        private fun showers(day: Long, mode: Int): List<Shower> = when (mode) {
            Settings.RAIN_ALWAYS -> emptyList()   // "On" එක rainAt එකේ
            Settings.RAIN_RANDOM -> (0 until 2).mapNotNull { k ->
                val rnd = java.util.Random(day * 7919L + k * 104729L + 17L)
                val chance = rnd.nextFloat()
                val start = 600f + rnd.nextFloat() * 240f + k * 60f
                val dur = 25f + rnd.nextFloat() * 60f
                val strength = 0.65f + rnd.nextFloat() * 0.35f
                if (chance < 0.45f) Shower(start, dur, strength) else null
            }
            else -> emptyList()
        }

        /** වැස්ස කොච්චරද (0..1). */
        fun rainAt(m: Float, day: Long, mode: Int): Float {
            if (mode == Settings.RAIN_ALWAYS) return 1f
            var r = 0f
            for (s in showers(day, mode)) {
                r = max(r, ramp(m, s.start, s.start + 9f) * (1f - ramp(m, s.start + s.dur - 10f, s.start + s.dur)) * s.strength)
            }
            return r
        }

        /**
         * තද සුළඟ (0..1).
         * RANDOM: දවසට සුළං 2ක් වෙන්න පුළුවන් (~40% ඉඩක්), 9:30 – 16:30 අතර, විනාඩි 10 – 25.
         *         ඒ වගේම හැම වැස්සකටම විනාඩි 15කට කලින් සුළඟ එනවා, වැස්ස පටන් අරන් ටිකකින් අඩු වෙනවා.
         * ALWAYS ("On"): ඕනෑම වෙලාවක දිගටම.
         */
        fun stormAt(m: Float, day: Long, mode: Int, rainMode: Int): Float {
            fun window(a: Float, b: Float, fade: Float) = ramp(m, a, a + fade) * (1f - ramp(m, b - fade, b))
            return when (mode) {
                Settings.STORM_ALWAYS -> 1f
                Settings.STORM_RANDOM -> {
                    var st = 0f
                    for (k in 0 until 2) {
                        val rnd = java.util.Random(day * 6151L + k * 92821L + 5L)
                        val chance = rnd.nextFloat()
                        val start = 570f + rnd.nextFloat() * 400f
                        val dur = 10f + rnd.nextFloat() * 15f
                        val strength = 0.7f + rnd.nextFloat() * 0.3f
                        if (chance < 0.40f) st = max(st, window(start, start + dur, 3f) * strength)
                    }
                    for (s in showers(day, rainMode)) st = max(st, window(s.start - 15f, s.start + 8f, 5f) * 0.9f)
                    st
                }
                else -> 0f
            }
        }

        private fun smoothStep(a: Float, b: Float, x: Float): Float = smooth((x - a) / (b - a))

        private fun approach(cur: Float, target: Float, step: Float) =
            if (cur < target) min(target, cur + step) else max(target, cur - step)

        /** a → b අතර 0 → 1 (smooth). */
        private fun ramp(m: Float, a: Float, b: Float) = smooth((m - a) / (b - a))

        private fun smooth(x: Float): Float {
            val t = min(1f, max(0f, x))
            return t * t * (3f - 2f * t)
        }

        //                         පාන්දර                 උදේ                    දහවල්               සවස                    රාත්‍රී
        private val CLOUD_TINT = arrayOf(
            floatArrayOf(.78f, .70f, .86f), floatArrayOf(1f, .95f, .88f), floatArrayOf(1f, 1f, 1f),
            floatArrayOf(1f, .74f, .56f), floatArrayOf(.20f, .24f, .34f),
        )
        private val MIST_TINT = arrayOf(
            floatArrayOf(.80f, .80f, .90f), floatArrayOf(1f, .93f, .80f), floatArrayOf(.95f, .96f, .97f),
            floatArrayOf(1f, .82f, .66f), floatArrayOf(.36f, .44f, .58f),
        )
        private val TEXT_TINT = arrayOf(
            floatArrayOf(.96f, .94f, 1f), floatArrayOf(1f, .97f, .90f), floatArrayOf(1f, 1f, 1f),
            floatArrayOf(1f, .93f, .84f), floatArrayOf(.88f, .93f, 1f),
        )
        private val CLOUD_AMOUNT = floatArrayOf(.55f, .48f, .50f, .60f, .45f)
        private val AMBIENT = floatArrayOf(.60f, .95f, 1f, .82f, .30f)
        private val SUN_AMOUNT = floatArrayOf(.07f, .24f, 0f, .16f, 0f)
        // image uv (x: 0..1 වමේ සිට, y: 0..1 උඩ සිට)
        private val SUN_POS = arrayOf(
            floatArrayOf(.95f, .48f), floatArrayOf(.02f, .43f), floatArrayOf(.5f, .1f),
            floatArrayOf(.80f, .46f), floatArrayOf(.65f, .2f),
        )
        private val SUN_COLOR = arrayOf(
            floatArrayOf(1f, .72f, .62f), floatArrayOf(1f, .86f, .62f), floatArrayOf(1f, 1f, 1f),
            floatArrayOf(1f, .62f, .36f), floatArrayOf(.7f, .8f, 1f),
        )
    }
}
