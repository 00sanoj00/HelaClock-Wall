package lk.sinhala.welawa

import android.content.Context
import android.content.SharedPreferences

/** App සැකසුම් — preview එකයි wallpaper එකයි දෙකම එකම ගොනුව කියවනවා. */
object Settings {
    private const val FILE = "welawa"
    private const val K_SCALE = "text_scale"
    private const val K_LABEL = "show_label"
    private const val K_STYLE = "text_style"
    private const val K_FONT = "font"
    private const val K_CINE = "cinematic"
    private const val K_RAIN = "rain"
    private const val K_STORM = "storm"
    private const val K_TEXT_Y = "text_y"
    private const val K_FEST = "festivals"
    private const val K_SAVER = "battery_saver"
    private const val K_FPS = "frame_rate"
    private const val K_LIVE_WX = "live_weather"
    private const val K_CITY = "city"
    private const val K_LOCK_BIG = "lock_big"
    private const val K_C_TEXT = "color_text"
    private const val K_C_SHADOW = "color_shadow"
    private const val K_C_GLOW = "color_glow"
    private const val K_C_OUTLINE = "color_outline"

    /** Text එක උඩ/පහළ කරන සීමාව (screen උසින් කොටසක්). 0 = ඉබේම තෝරන තැන. */
    const val TEXT_Y_RANGE = 0.30f

    /** තද සුළං (Off / Random / Always) — RAIN_* අගයන්ම පාවිච්චි කරනවා */
    const val STORM_OFF = 0
    const val STORM_RANDOM = 1   // දවසට අහඹු වෙලාවට + වැස්සට කලින්
    const val STORM_ALWAYS = 2   // "On": ඕනෑම වෙලාවක දිගටම තද සුළඟ

    /** දහවල් වැස්ස */
    const val RAIN_OFF = 0
    const val RAIN_RANDOM = 1    // සමහර දවස් වලට, අහඹු වෙලාවක (දවසටම එකම රටාව)
    const val RAIN_ALWAYS = 2    // "On": ඕනෑම වෙලාවක දිගටම වහිනවා

    /** අකුරු මෝස්තර */
    const val STYLE_SHADOW = 0   // සාමාන්‍ය (සෙවණැලි)
    const val STYLE_GLOW = 1     // දිලිසෙන
    const val STYLE_GOLD = 2     // රන්වන්
    const val STYLE_OUTLINE = 3  // රේඛා
    const val STYLE_SILVER = 4   // රිදී (සඳ එළිය)
    const val STYLE_NEON = 5     // නියොන් නළ
    const val STYLE_STONE = 6    // සීගිරි ගලේ කොටපු
    const val STYLE_GLASS = 7    // frosted වීදුරු
    const val STYLE_EMBER = 8    // ගිනි පුපුරු
    const val STYLE_3D = 9       // ගැඹුරු 3D
    const val STYLE_COUNT = 10

    /** පාට: 0 = Auto (style එකේ default පාට). */
    const val AUTO_COLOR = 0
    const val FPS_MAX = 0

    data class Values(
        val textScale: Float,
        val showLabel: Boolean,
        val style: Int,
        val font: String?,
        val cinematic: Boolean,
        val rain: Int,
        val storm: Int,
        /** -RANGE (උඩට) .. +RANGE (පහළට) */
        val textY: Float,
        /** පොහොය පහන්, වෙසක් කූඩු, අවුරුදු එරබදු මල් */
        val festivals: Boolean,
        val batterySaver: Boolean,
        /** Frame rate සීමාව: FPS_MAX (0) = display එකේ උපරිමය (120Hz දක්වා), නැත්නම් 30 / 60 */
        val fps: Int,
        /** ඇත්ත කාලගුණය (internet) — city එකේ */
        val liveWeather: Boolean,
        /** SkyCalendar.CITIES index — හිරු වෙලාවන්, කාලගුණය */
        val city: Int,
        /** Lock screen එකේ අකුරු ලොකුවට */
        val lockBig: Boolean,
        val colors: TextColors,
    )

    /** Custom පාට (ARGB). AUTO_COLOR (0) = style එකේ default. */
    data class TextColors(val text: Int, val shadow: Int, val glow: Int, val outline: Int)

    fun prefs(c: Context): SharedPreferences = c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /**
     * සැකසුමක් වෙනස් වෙන හැම වතාවකම වැඩි වෙනවා. Renderers මේක හැම frame එකකම බලලා
     * අලුත් අගයන් ගන්නවා. (SharedPreferences listener එක weak reference එකක් නිසා
     * release build එකේ GC වෙලා නැති වුණා — ඒකයි live update නොවුණේ.)
     */
    @Volatile var version = 0
        private set

    private fun edit(c: Context, block: SharedPreferences.Editor.() -> Unit) {
        prefs(c).edit().apply(block).apply()
        version++
    }

    fun read(c: Context): Values {
        val p = prefs(c)
        return Values(
            textScale = p.getFloat(K_SCALE, 1f).coerceIn(0.6f, 1.5f),
            showLabel = p.getBoolean(K_LABEL, true),
            style = p.getInt(K_STYLE, STYLE_SHADOW).coerceIn(0, STYLE_COUNT - 1),
            font = p.getString(K_FONT, null),
            cinematic = p.getBoolean(K_CINE, true),
            rain = p.getInt(K_RAIN, RAIN_RANDOM).coerceIn(RAIN_OFF, RAIN_ALWAYS),
            storm = p.getInt(K_STORM, STORM_RANDOM).coerceIn(STORM_OFF, STORM_ALWAYS),
            textY = p.getFloat(K_TEXT_Y, 0f).coerceIn(-TEXT_Y_RANGE, TEXT_Y_RANGE),
            festivals = p.getBoolean(K_FEST, true),
            batterySaver = p.getBoolean(K_SAVER, false),
            fps = p.getInt(K_FPS, FPS_MAX).let { if (it == 30 || it == 60) it else FPS_MAX },
            liveWeather = p.getBoolean(K_LIVE_WX, false),
            city = p.getInt(K_CITY, 0).coerceIn(0, SkyCalendar.CITIES.lastIndex),
            lockBig = p.getBoolean(K_LOCK_BIG, true),
            colors = TextColors(
                p.getInt(K_C_TEXT, AUTO_COLOR), p.getInt(K_C_SHADOW, AUTO_COLOR),
                p.getInt(K_C_GLOW, AUTO_COLOR), p.getInt(K_C_OUTLINE, AUTO_COLOR),
            ),
        )
    }

    fun setTextScale(c: Context, v: Float) = edit(c) { putFloat(K_SCALE, v) }
    fun setShowLabel(c: Context, v: Boolean) = edit(c) { putBoolean(K_LABEL, v) }
    fun setStyle(c: Context, v: Int) = edit(c) { putInt(K_STYLE, v) }
    fun setFont(c: Context, v: String) = edit(c) { putString(K_FONT, v) }
    fun setCinematic(c: Context, v: Boolean) = edit(c) { putBoolean(K_CINE, v) }
    fun setRain(c: Context, v: Int) = edit(c) { putInt(K_RAIN, v) }
    fun setStorm(c: Context, v: Int) = edit(c) { putInt(K_STORM, v) }
    fun setTextY(c: Context, v: Float) = edit(c) { putFloat(K_TEXT_Y, v) }
    fun setFestivals(c: Context, v: Boolean) = edit(c) { putBoolean(K_FEST, v) }
    fun setBatterySaver(c: Context, v: Boolean) = edit(c) { putBoolean(K_SAVER, v) }
    fun setFps(c: Context, v: Int) = edit(c) { putInt(K_FPS, v) }
    fun setLiveWeather(c: Context, v: Boolean) = edit(c) { putBoolean(K_LIVE_WX, v) }
    fun setCity(c: Context, v: Int) = edit(c) { putInt(K_CITY, v) }
    fun setLockBig(c: Context, v: Boolean) = edit(c) { putBoolean(K_LOCK_BIG, v) }
    fun setTextColor(c: Context, v: Int) = edit(c) { putInt(K_C_TEXT, v) }
    fun setShadowColor(c: Context, v: Int) = edit(c) { putInt(K_C_SHADOW, v) }
    fun setGlowColor(c: Context, v: Int) = edit(c) { putInt(K_C_GLOW, v) }
    fun setOutlineColor(c: Context, v: Int) = edit(c) { putInt(K_C_OUTLINE, v) }
}
