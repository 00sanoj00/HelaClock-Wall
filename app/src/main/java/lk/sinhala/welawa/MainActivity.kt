package lk.sinhala.welawa

import android.animation.ValueAnimator
import android.app.Activity
import android.app.WallpaperManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast

/**
 * Preview + සැකසුම්: දවසේ ඕනම වෙලාවක් slider එකෙන් බලන්න, ඊට පස්සේ බිතුපත ලෙස දාන්න.
 * Settings UI එක English (user ඉල්ලුවා). Wallpaper එකේ වෙලාව විතරයි සිංහලෙන්.
 */
class MainActivity : Activity() {

    private lateinit var glView: GLSurfaceView
    private lateinit var renderer: SceneRenderer
    private lateinit var seek: SeekBar
    private val uiFont: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    private var timelapse: ValueAnimator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        renderer = SceneRenderer(this)
        tilt = TiltSensor(this) { x, y -> renderer.tiltX = x; renderer.tiltY = y }

        glView = GLSurfaceView(this).apply {
            setEGLContextClientVersion(2)
            preserveEGLContextOnPause = true
            setRenderer(renderer)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(18))
            background = GradientDrawable().apply {
                cornerRadius = dp(24).toFloat()
                setColor(Color.argb(150, 10, 12, 18))
            }
        }

        panel.addView(label("Preview any time of day", 15f, 0.8f))

        seek = SeekBar(this).apply {
            max = 1439
            progressTintList = ColorStateList.valueOf(Color.rgb(255, 214, 150))
            thumbTintList = ColorStateList.valueOf(Color.WHITE)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar, p: Int, fromUser: Boolean) {
                    if (fromUser) { stopTimelapse(); renderer.overrideMinute = p.toFloat() }
                }
                override fun onStartTrackingTouch(s: SeekBar) {}
                override fun onStopTrackingTouch(s: SeekBar) {}
            })
        }
        panel.addView(seek, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
            topMargin = dp(6); bottomMargin = dp(10)
        })

        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(button("Current time", false) { stopTimelapse(); renderer.overrideMinute = -1f; syncSeek() },
            LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(6) })
        row.addView(button("Play full day", false) { toggleTimelapse() },
            LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginStart = dp(6) })
        panel.addView(row)

        // ---- සැකසුම් (button එක ඔබනකොට පේනවා / හැංගෙනවා)
        val settingsBox = buildSettings().apply { visibility = View.GONE }
        panel.addView(button("Settings", false) {
            settingsBox.visibility = if (settingsBox.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }, LinearLayout.LayoutParams(MATCH_PARENT, dp(44)).apply { topMargin = dp(10) })
        // settings දිග නිසා පොඩි screens වලට scroll වෙන්න (උපරිම උස screen එකෙන් 45%)
        val settingsScroll = object : android.widget.ScrollView(this) {
            override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                val maxH = (resources.displayMetrics.heightPixels * 0.45f).toInt()
                super.onMeasure(widthMeasureSpec, View.MeasureSpec.makeMeasureSpec(maxH, View.MeasureSpec.AT_MOST))
            }
        }.apply { isVerticalScrollBarEnabled = true; addView(settingsBox) }
        panel.addView(settingsScroll, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))

        panel.addView(button("Set as wallpaper", true) { setWallpaper() },
            LinearLayout.LayoutParams(MATCH_PARENT, dp(54)).apply { topMargin = dp(12) })

        // පසුබිම tap කළාම panel එක හැංගෙනවා / පේනවා
        glView.setOnClickListener {
            val show = panel.alpha < 0.5f
            panel.animate().alpha(if (show) 1f else 0f).translationY(if (show) 0f else dp(40).toFloat())
                .setDuration(250).withStartAction { if (show) panel.visibility = View.VISIBLE }
                .withEndAction { if (!show) panel.visibility = View.INVISIBLE }.start()
        }
        panelView = panel

        val root = FrameLayout(this)
        root.addView(glView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        val lp = FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM).apply {
            setMargins(dp(14), 0, dp(14), dp(14))
        }
        root.addView(panel, lp)
        root.setOnApplyWindowInsetsListener { _, insets ->
            @Suppress("DEPRECATION")
            lp.bottomMargin = dp(14) + insets.systemWindowInsetBottom
            panel.layoutParams = lp
            insets
        }
        setContentView(root)
        syncSeek()
        applyIntentMinute(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        applyIntentMinute(intent)
    }

    /** පරීක්ෂා කිරීමට: adb shell am start -n lk.sinhala.welawa/.MainActivity --ei minute 1100 */
    private fun applyIntentMinute(i: Intent?) {
        val m = i?.getIntExtra("minute", -1) ?: -1
        if (m in 0..1439) { stopTimelapse(); renderer.overrideMinute = m.toFloat(); seek.progress = m }
        if (i?.getBooleanExtra("hideui", false) == true) panelView?.visibility = View.INVISIBLE
        if (i?.hasExtra("px") == true) renderer.parallaxX = i.getFloatExtra("px", 0.5f)
        if (i?.hasExtra("tx") == true) { tilt.stop(); tiltLocked = true; renderer.tiltX = i.getFloatExtra("tx", 0f) }
        // පරීක්ෂා කිරීමට: --ez poya true, --ez vesak true, --ez avurudu true, --ef moon 0.25, --ez thunder true, --ez rainbow true
        if (i != null) {
            renderer.debugPoya = i.getBooleanExtra("poya", false)
            renderer.debugVesak = i.getBooleanExtra("vesak", false)
            renderer.debugAvurudu = i.getBooleanExtra("avurudu", false)
            renderer.debugThunder = i.getBooleanExtra("thunder", false)
            renderer.debugRainbow = i.getBooleanExtra("rainbow", false)
            renderer.debugMoonAge = i.getFloatExtra("moon", -1f)
            // easter eggs: --ez ghost true, --ez tuk true, --ez croc true, --ez aprilfool true, --ez newyear true
            renderer.debugGhost = i.getBooleanExtra("ghost", false)
            renderer.debugTuk = i.getBooleanExtra("tuk", false)
            renderer.debugCroc = i.getBooleanExtra("croc", false)
            renderer.debugAprilFool = i.getBooleanExtra("aprilfool", false)
            renderer.debugNewYear = i.getBooleanExtra("newyear", false)
            // පරීක්ෂා කිරීමට (debug build එකේ විතරයි — release එකේ වෙන apps වලට settings වෙනස් කරන්න බැරි වෙන්න):
            // --ei style 5 --ei ctext <ARGB int> (0 = Auto)
            val debuggable = (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            if (debuggable && i.hasExtra("style")) Settings.setStyle(this, i.getIntExtra("style", 0))
            if (debuggable && i.hasExtra("ctext")) Settings.setTextColor(this, i.getIntExtra("ctext", 0))
            if (debuggable && i.hasExtra("cshadow")) Settings.setShadowColor(this, i.getIntExtra("cshadow", 0))
            if (debuggable && i.hasExtra("cglow")) Settings.setGlowColor(this, i.getIntExtra("cglow", 0))
            if (debuggable && i.hasExtra("coutline")) Settings.setOutlineColor(this, i.getIntExtra("coutline", 0))
        }
    }

    // ---------------------------------------------------------------- සැකසුම් panel එක
    private fun buildSettings(): LinearLayout {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(8), 0, 0)
        }
        val s = Settings.read(this)

        // අකුරු ප්‍රමාණය
        box.addView(label("Text size", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(SeekBar(this).apply {
            max = 90                                   // 0.60 .. 1.50
            progress = ((s.textScale - 0.6f) * 100).toInt()
            progressTintList = ColorStateList.valueOf(Color.rgb(255, 214, 150))
            thumbTintList = ColorStateList.valueOf(Color.WHITE)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar, p: Int, fromUser: Boolean) {
                    if (fromUser) Settings.setTextScale(this@MainActivity, 0.6f + p / 100f)
                }
                override fun onStartTrackingTouch(sb: SeekBar) {}
                override fun onStopTrackingTouch(sb: SeekBar) {}
            })
        }, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(6) })

        // අකුරු පිහිටීම (උඩ / පහළ) — මැද = ඉබේම තෝරන තැන
        box.addView(label("Text position  (left = up, right = down)", 13f, 0.8f).apply { gravity = Gravity.START })
        val yMax = Math.round(Settings.TEXT_Y_RANGE * 400)        // 0 .. 120, මැද 60 = ඉබේම තෝරන තැන
        val ySeek = SeekBar(this).apply {
            max = yMax
            progress = Math.round((s.textY + Settings.TEXT_Y_RANGE) * 200)
            progressTintList = ColorStateList.valueOf(Color.rgb(255, 214, 150))
            thumbTintList = ColorStateList.valueOf(Color.WHITE)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar, p: Int, fromUser: Boolean) {
                    if (fromUser) Settings.setTextY(this@MainActivity, p / 200f - Settings.TEXT_Y_RANGE)
                }
                override fun onStartTrackingTouch(sb: SeekBar) {}
                override fun onStopTrackingTouch(sb: SeekBar) {}
            })
        }
        val yRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        yRow.addView(ySeek, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        yRow.addView(label("Reset", 12f, 1f).apply {
            background = chipBg(false)
            isClickable = true
            setPadding(dp(12), dp(6), dp(12), dp(6))
            setOnClickListener {
                ySeek.progress = yMax / 2
                Settings.setTextY(this@MainActivity, 0f)
            }
        }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { marginStart = dp(8) })
        box.addView(yRow, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(6) })

        // අකුරු මෝස්තරය
        box.addView(label("Text style", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(scrollChipRow(STYLE_NAMES, s.style) { Settings.setStyle(this, it) })

        // අකුරු පාට (Auto = style එකේ default)
        box.addView(label("Text color", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(colorRow(s.colors.text) { Settings.setTextColor(this, it) })
        box.addView(label("Shadow color", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(colorRow(s.colors.shadow) { Settings.setShadowColor(this, it) })
        box.addView(label("Glow color  (adds a glow to any style)", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(colorRow(s.colors.glow) { Settings.setGlowColor(this, it) })
        box.addView(label("Outline color  (adds an outline to any style)", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(colorRow(s.colors.outline) { Settings.setOutlineColor(this, it) })

        // අකුරු වර්ගය
        val fonts = TextPainter.fonts(this)
        if (fonts.size > 1) {
            box.addView(label("Font", 13f, 0.8f).apply { gravity = Gravity.START })
            val cur = fonts.indexOf(s.font).coerceAtLeast(0)
            box.addView(chipRow(fonts.map { TextPainter.displayName(it) }, cur) {
                Settings.setFont(this, fonts[it])
            })
        }

        // දහවල් වැස්ස
        box.addView(label("Rain  (Random = live weather if on, else some days)", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(chipRow(listOf("Off", "Random", "On"), s.rain) { Settings.setRain(this, it) })

        // තද සුළඟ
        box.addView(label("Strong wind  (Random = live weather if on, else some days)", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(chipRow(listOf("Off", "Random", "On"), s.storm) { Settings.setStorm(this, it) })

        // පොහොය පහන්, වෙසක් කූඩු, අවුරුදු එරබදු මල්
        box.addView(toggleRow(
            toggleChip("Poya & festivals", s.festivals) { Settings.setFestivals(this, it) },
            null,
        ))

        // නගරය (හිරු වෙලාවන්, රාහු කාලය, කාලගුණය)
        box.addView(label("Location  (sunrise/sunset, live weather)", 13f, 0.8f).apply { gravity = Gravity.START })
        box.addView(scrollChipRow(SkyCalendar.CITIES.map { it.name }, s.city) { Settings.setCity(this, it) })
        // Frame rate (120Hz phones වලට "Max")
        box.addView(label("Frame rate  (Max = up to 120Hz, uses more battery)", 13f, 0.8f).apply { gravity = Gravity.START })
        val fpsValues = listOf(30, 60, Settings.FPS_MAX)
        box.addView(chipRow(listOf("30 fps", "60 fps", "Max"), fpsValues.indexOf(s.fps).coerceAtLeast(0)) {
            Settings.setFps(this, fpsValues[it])
        })
        box.addView(toggleRow(
            toggleChip("Live weather (internet)", s.liveWeather) { Settings.setLiveWeather(this, it) },
            toggleChip("Battery saver", s.batterySaver) { Settings.setBatterySaver(this, it) },
        ))
        box.addView(toggleRow(
            toggleChip("Lock screen: bigger & lower", s.lockBig) { Settings.setLockBig(this, it) },
            null,
        ))

        // "වේලාව" පේළිය + සිනමා පෙනුම
        box.addView(label("Display", 13f, 0.8f).apply { gravity = Gravity.START })
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(toggleChip("Show label", s.showLabel) { Settings.setShowLabel(this, it) },
            LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginEnd = dp(4) })
        row.addView(toggleChip("Cinematic look", s.cinematic) { Settings.setCinematic(this, it) },
            LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginStart = dp(4) })
        box.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(4) })
        return box
    }

    private fun chipBg(selected: Boolean) = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        if (selected) setColor(Color.argb(235, 255, 206, 140))
        else { setColor(Color.argb(50, 255, 255, 255)); setStroke(dp(1), Color.argb(70, 255, 255, 255)) }
    }

    /** එකක් තෝරන chips පේළිය. */
    private fun chipRow(items: List<String>, selected: Int, onSelect: (Int) -> Unit): LinearLayout {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val views = ArrayList<TextView>()
        fun refresh(sel: Int) = views.forEachIndexed { i, v ->
            v.background = chipBg(i == sel)
            v.setTextColor(if (i == sel) Color.rgb(40, 22, 10) else Color.WHITE)
        }
        items.forEachIndexed { i, text ->
            val v = label(text, 13f, 1f)
            v.isClickable = true
            v.setOnClickListener { refresh(i); onSelect(i) }
            views += v
            row.addView(v, LinearLayout.LayoutParams(0, dp(38), 1f).apply {
                marginStart = if (i == 0) 0 else dp(3); marginEnd = if (i == items.lastIndex) 0 else dp(3)
            })
        }
        refresh(selected)
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(4); bottomMargin = dp(8) })
        }
    }

    /**
     * පාට තෝරන පේළිය: Auto + presets 16 + custom (+). තෝරපු එක වටේ සුදු වළල්ලක්.
     * Custom එක ඔබලා Hue / Saturation / Brightness sliders වලින් ඕනම පාටක්.
     */
    private fun colorRow(selected: Int, onPick: (Int) -> Unit): View {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val items = ArrayList<Pair<View, Int?>>()     // (view, පාට; null = custom)
        var current = selected
        fun ring(v: View, color: Int?, sel: Boolean) {
            v.background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                when (color) {
                    null -> colors = intArrayOf(Color.RED, Color.YELLOW, Color.GREEN, Color.CYAN, Color.BLUE, Color.MAGENTA, Color.RED)
                        .also { gradientType = GradientDrawable.SWEEP_GRADIENT }
                    Settings.AUTO_COLOR -> setColor(Color.argb(60, 255, 255, 255))
                    else -> setColor(color)
                }
                setStroke(if (sel) dp(3) else dp(1), if (sel) Color.WHITE else Color.argb(90, 255, 255, 255))
            }
        }
        fun refresh() = items.forEach { (v, c) ->
            val sel = if (c == null) current != Settings.AUTO_COLOR && current !in PRESET_COLORS else c == current
            ring(v, if (c == null && sel) current else c, sel)
        }
        fun add(v: View, color: Int?) {
            items += Pair(v, color)
            row.addView(v, LinearLayout.LayoutParams(dp(34), dp(34)).apply { marginEnd = dp(8) })
        }
        // Auto
        add(label("A", 12f, 1f).apply { isClickable = true; setOnClickListener { current = Settings.AUTO_COLOR; refresh(); onPick(current) } },
            Settings.AUTO_COLOR)
        for (pc in PRESET_COLORS) {
            add(View(this).apply { isClickable = true; setOnClickListener { current = pc; refresh(); onPick(pc) } }, pc)
        }
        // Custom
        add(label("+", 16f, 1f).apply {
            isClickable = true
            setOnClickListener {
                val start = if (current == Settings.AUTO_COLOR) Color.WHITE else current
                showColorPicker(start) { c -> current = c; refresh(); onPick(c) }
            }
        }, null)
        refresh()
        return android.widget.HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(row)
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(4); bottomMargin = dp(8) }
        }
    }

    /** සරල HSV color picker dialog එකක්. */
    private fun showColorPicker(start: Int, onDone: (Int) -> Unit) {
        val hsv = FloatArray(3).also { Color.colorToHSV(start, it) }
        val preview = View(this)
        fun update() { preview.background = GradientDrawable().apply { cornerRadius = dp(10).toFloat(); setColor(Color.HSVToColor(hsv)) } }
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(12), dp(20), dp(4)) }
        box.addView(preview, LinearLayout.LayoutParams(MATCH_PARENT, dp(56)).apply { bottomMargin = dp(10) })
        fun slider(name: String, max: Int, value: Int, set: (Int) -> Unit) {
            box.addView(TextView(this).apply { text = name; setTextColor(Color.WHITE) })
            box.addView(SeekBar(this).apply {
                this.max = max; progress = value
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(sb: SeekBar, p: Int, fromUser: Boolean) { set(p); update() }
                    override fun onStartTrackingTouch(sb: SeekBar) {}
                    override fun onStopTrackingTouch(sb: SeekBar) {}
                })
            })
        }
        slider("Hue", 360, hsv[0].toInt()) { hsv[0] = it.toFloat() }
        slider("Saturation", 100, (hsv[1] * 100).toInt()) { hsv[1] = it / 100f }
        slider("Brightness", 100, (hsv[2] * 100).toInt()) { hsv[2] = it / 100f }
        update()
        android.app.AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Custom color")
            .setView(box)
            .setPositiveButton("OK") { _, _ -> onDone(Color.HSVToColor(hsv)) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    /** toggle chips දෙකක පේළියක් (දෙවැන්න null නම් හිස් ඉඩක්). */
    private fun toggleRow(a: View, b: View?): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        addView(a, LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginEnd = dp(4) })
        addView(b ?: View(this@MainActivity), LinearLayout.LayoutParams(0, dp(40), 1f).apply { marginStart = dp(4) })
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(4); bottomMargin = dp(4) }
    }

    /** දිග list එකකට: තිරස් scroll වෙන chips පේළිය. */
    private fun scrollChipRow(items: List<String>, selected: Int, onSelect: (Int) -> Unit): View {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val views = ArrayList<TextView>()
        fun refresh(sel: Int) = views.forEachIndexed { i, v ->
            v.background = chipBg(i == sel)
            v.setTextColor(if (i == sel) Color.rgb(40, 22, 10) else Color.WHITE)
        }
        items.forEachIndexed { i, text ->
            val v = label(text, 13f, 1f).apply { setPadding(dp(14), 0, dp(14), 0) }
            v.isClickable = true
            v.setOnClickListener { refresh(i); onSelect(i) }
            views += v
            row.addView(v, LinearLayout.LayoutParams(WRAP_CONTENT, dp(38)).apply { marginEnd = dp(6) })
        }
        refresh(selected)
        return android.widget.HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(row)
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(4); bottomMargin = dp(8) }
        }
    }

    /** on/off chip එකක්. */
    private fun toggleChip(text: String, initial: Boolean, onChange: (Boolean) -> Unit): TextView {
        var on = initial
        return label(text, 13f, 1f).apply {
            fun refresh() { background = chipBg(on); setTextColor(if (on) Color.rgb(40, 22, 10) else Color.WHITE) }
            refresh()
            isClickable = true
            setOnClickListener { on = !on; refresh(); onChange(on) }
        }
    }

    companion object {
        private val STYLE_NAMES = listOf("Shadow", "Glow", "Gold", "Outline", "Silver", "Neon", "Stone", "Glass", "Ember", "3D")
        private val PRESET_COLORS = listOf(
            0xFFFFFFFF, 0xFFFFF3D6, 0xFFF5C542, 0xFFFF8C2E, 0xFFE53935, 0xFFFF6FAE, 0xFF9C5BFF, 0xFF3F7BFF,
            0xFF4FC3F7, 0xFF00E5FF, 0xFF1DB9A0, 0xFF66D96B, 0xFFC6FF3D, 0xFF6B3E1E, 0xFF8A8F98, 0xFF000000,
        ).map { it.toInt() }
    }

    private lateinit var tilt: TiltSensor
    private var tiltLocked = false   // පරීක්ෂා කරනකොට sensor එක නවත්තලා
    private var panelView: View? = null

    private fun syncSeek() {
        val now = java.util.Calendar.getInstance()
        seek.progress = now.get(java.util.Calendar.HOUR_OF_DAY) * 60 + now.get(java.util.Calendar.MINUTE)
    }

    private fun toggleTimelapse() {
        if (timelapse != null) { stopTimelapse(); return }
        val start = seek.progress.toFloat()
        timelapse = ValueAnimator.ofFloat(0f, 1440f).apply {
            duration = 60_000L                      // පැය 24 → තත්පර 60
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener {
                val m = (start + it.animatedValue as Float) % 1440f
                renderer.overrideMinute = m
                seek.progress = m.toInt()
            }
            start()
        }
    }

    private fun stopTimelapse() {
        timelapse?.cancel()
        timelapse = null
    }

    private fun setWallpaper() {
        val component = ComponentName(this, WelawaWallpaperService::class.java)
        try {
            startActivity(Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
                .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component))
        } catch (e: ActivityNotFoundException) {
            try {
                startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
            } catch (e2: ActivityNotFoundException) {
                Toast.makeText(this, "Can't open wallpaper settings", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ---------------------------------------------------------------- UI helpers
    private fun dp(v: Int) = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun label(text: String, sp: Float, alpha: Float) = TextView(this).apply {
        this.text = text
        typeface = uiFont
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
        setTextColor(Color.WHITE)
        this.alpha = alpha
        gravity = Gravity.CENTER
    }

    private fun button(text: String, primary: Boolean, onClick: () -> Unit): View {
        val bg = GradientDrawable().apply {
            cornerRadius = dp(16).toFloat()
            if (primary) colors = intArrayOf(Color.rgb(255, 196, 120), Color.rgb(240, 150, 90))
            else setColor(Color.argb(60, 255, 255, 255))
            orientation = GradientDrawable.Orientation.LEFT_RIGHT
        }
        return label(text, if (primary) 17f else 14f, 1f).apply {
            if (primary) setTextColor(Color.rgb(40, 22, 10))
            background = RippleDrawable(ColorStateList.valueOf(Color.argb(80, 255, 255, 255)), bg, null)
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }
    }

    override fun onResume() { super.onResume(); glView.onResume(); if (!tiltLocked) tilt.start() }
    override fun onPause() { tilt.stop(); glView.onPause(); super.onPause() }
    override fun onDestroy() { stopTimelapse(); super.onDestroy() }
}
