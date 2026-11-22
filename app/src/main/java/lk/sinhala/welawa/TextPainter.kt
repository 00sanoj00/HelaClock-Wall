package lk.sinhala.welawa

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.graphics.Typeface
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * වෙලාවේ text එක FM font එකෙන් Bitmap එකකට අඳිනවා (GL texture එකක් විදිහට යවන්න).
 * Fonts: assets/fonts/ (මුල් ෆෝල්ඩරය: live/font/).
 */
class TextPainter(private val context: Context) {

    var typeface: Typeface = loadTypeface(context, null)
        private set
    private var fontName: String? = null

    class Result(val bitmap: Bitmap, val heightPx: Int)

    /** Font එකේ encoding එකට ගැලපෙන converter එක (Isi fonts වෙනම encoding එකක්, අනිත් ඒවා FM). */
    private fun convert(s: String): String =
        if (isIsiFont(fontName)) IsiConverter.convert(s) else FmConverter.convert(s)

    fun setFont(name: String?) {
        if (name == fontName && name != null) return
        typeface = loadTypeface(context, name)
        fontName = name ?: fonts(context).firstOrNull()
    }

    /**
     * @param width  screen පළල (px)
     * @param base   අකුරු ප්‍රමාණය ගණනය කරන මූලික දිග (min(පළල, උස*0.62) × පරිශීලක scale)
     */
    fun paint(
        phrase: SinhalaTime.Phrase, width: Int, base: Float, style: Int, showLabel: Boolean,
        colors: Settings.TextColors = Settings.TextColors(0, 0, 0, 0),
    ): Result {
        val bigSize = base * 0.105f
        val smallSize = base * 0.064f
        val maxLine = width * 0.88f

        val big = paint(bigSize)
        val small = paint(smallSize)   // FM අකුරු වලට letterSpacing දාන්න එපා — පිලි වෙන් වෙනවා

        val lines = balance(phrase.main.split(' '), big, maxLine)
        val topFm = convert(phrase.top)

        val bigLineH = bigSize * 1.28f
        val glowy = style == Settings.STYLE_GLOW || style == Settings.STYLE_NEON || style == Settings.STYLE_EMBER ||
            colors.glow != Settings.AUTO_COLOR
        val pad = bigSize * (if (glowy) 0.85f else if (style == Settings.STYLE_3D) 0.7f else 0.55f)
        val gap = smallSize * 0.9f
        val dividerGap = smallSize * 0.7f
        val labelH = if (showLabel) smallSize * 1.2f + gap + dividerGap else 0f
        val h = ceil(pad + labelH + bigLineH * lines.size + pad).toInt()

        val bmp = Bitmap.createBitmap(width, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val cx = width / 2f
        var y = pad

        if (showLabel) {
            // උඩ පේළිය: "වේලාව" + ලස්සන ඉරක්
            y += smallSize
            drawStyled(c, topFm, cx, y, small, style, 0.92f, colors)
            y += gap
            drawDivider(c, cx, y, base, style, colors)
            y += dividerGap
        }

        for (ln in lines) {
            y += bigLineH
            drawStyled(c, ln, cx, y - bigLineH * 0.22f, big, style, 1f, colors)
        }
        return Result(bmp, h)
    }

    // ---------------------------------------------------------------- styles
    /**
     * අකුරු මෝස්තර 10. Custom පාට (AUTO නොවන) දුන්නොත්:
     *  text → අකුරු පිරවුම (gradient styles වලට ඒ පාටෙන්ම gradient එකක්),
     *  shadow → සෙවණැල්ල, glow → ආලෝක වළල්ල (glow නැති styles වලටත් එකතු වෙනවා),
     *  outline → දාරය (outline නැති styles වලටත් සිහින් දාරයක් එකතු වෙනවා).
     */
    private fun drawStyled(c: Canvas, s: String, cx: Float, y: Float, p: Paint, style: Int, alpha: Float, col: Settings.TextColors) {
        val size = p.textSize
        val auto = Settings.AUTO_COLOR
        fun pick(custom: Int, def: Int) = if (custom != auto) custom else def
        val textC = col.text; val shadowC = col.shadow; val glowC = col.glow; val outlineC = col.outline

        // ---- පොදු කොටස්
        fun shadow(def: Int, r: Float = 0.16f, dy: Float = 0.05f) {
            val sp = Paint(p).apply {
                val sa = if (shadowC != auto) 205 else Color.alpha(def)
                color = withAlpha(pick(shadowC, def), (sa * alpha).toInt())
                maskFilter = BlurMaskFilter(size * r, BlurMaskFilter.Blur.NORMAL)
            }
            drawFm(c, s, cx, y + size * dy, sp)
        }
        fun glow(def: Int, r: Float, a: Float) {
            val gp = Paint(p).apply {
                color = withAlpha(pick(glowC, def), (255 * a * alpha).toInt())
                maskFilter = BlurMaskFilter(size * r, BlurMaskFilter.Blur.NORMAL)
            }
            drawFm(c, s, cx, y, gp)
        }
        fun stroke(def: Int, w: Float, a: Float = 1f) {
            val st = Paint(p).apply {
                this.style = Paint.Style.STROKE
                strokeWidth = max(1.5f, size * w)
                strokeJoin = Paint.Join.ROUND
                color = withAlpha(pick(outlineC, def), (255 * a * alpha).toInt())
            }
            drawFm(c, s, cx, y, st)
        }
        fun fill(def: Int, a: Float = 1f) {
            val fp = Paint(p).apply { color = withAlpha(pick(textC, def), (255 * a * alpha).toInt()) }
            drawFm(c, s, cx, y, fp)
        }
        /** උඩ සිට පහළට gradient පිරවුම; text පාටක් දුන්නොත් ඒ පාටෙන්ම හදපු gradient එකක්. */
        fun gradFill(stops: IntArray, pos: FloatArray) {
            val cols = if (textC != auto) intArrayOf(lighten(textC, 0.45f), textC, darken(textC, 0.35f), lighten(textC, 0.25f)) else stops
            val ps = if (textC != auto) floatArrayOf(0f, 0.45f, 0.75f, 1f) else pos
            val fp = Paint(p).apply {
                color = Color.argb((255 * alpha).toInt(), 255, 255, 255)
                shader = LinearGradient(0f, y - size * 1.05f, 0f, y + size * 0.3f, cols, ps, Shader.TileMode.CLAMP)
            }
            drawFm(c, s, cx, y, fp)
        }
        val styleHasGlow = style == Settings.STYLE_GLOW || style == Settings.STYLE_NEON || style == Settings.STYLE_EMBER
        val styleHasOutline = style == Settings.STYLE_GOLD || style == Settings.STYLE_OUTLINE || style == Settings.STYLE_SILVER ||
            style == Settings.STYLE_STONE || style == Settings.STYLE_3D || style == Settings.STYLE_GLASS
        // custom glow එකක් තෝරලා නම්, glow නැති styles වලටත් මෘදු වළල්ලක්
        if (glowC != auto && !styleHasGlow) { glow(glowC, 0.26f, 0.65f); glow(glowC, 0.09f, 0.45f) }

        when (style) {
            Settings.STYLE_GLOW -> {
                shadow(Color.argb(110, 20, 12, 30), 0.12f, 0.04f)
                glow(Color.rgb(255, 236, 200), 0.28f, 0.67f)
                glow(Color.rgb(255, 236, 200), 0.08f, 0.67f)
                fill(Color.WHITE)
            }
            Settings.STYLE_GOLD -> {
                shadow(Color.argb(170, 20, 8, 0), 0.16f, 0.05f)
                stroke(Color.rgb(70, 38, 8), 0.07f)
                gradFill(intArrayOf(Color.rgb(255, 240, 180), Color.rgb(246, 200, 90), Color.rgb(200, 132, 30), Color.rgb(250, 214, 120)),
                    floatArrayOf(0f, 0.45f, 0.75f, 1f))
            }
            Settings.STYLE_OUTLINE -> {
                shadow(Color.argb(90, 0, 0, 0), 0.12f, 0.04f)
                fill(Color.WHITE, 0.22f)
                // outline style එකේ ප්‍රධාන දේ දාරය: outline පාට, නැත්නම් text පාට, නැත්නම් සුදු
                stroke(if (textC != auto) textC else Color.WHITE, 0.035f)
            }
            Settings.STYLE_SILVER -> {
                // සඳ එළියේ රිදී: සීතල ලෝහ gradient, තද අළු දාරය, තියුණු සෙවණැල්ල
                shadow(Color.argb(180, 5, 10, 25), 0.14f, 0.05f)
                stroke(Color.rgb(45, 52, 66), 0.06f)
                gradFill(intArrayOf(Color.rgb(255, 255, 255), Color.rgb(205, 212, 224), Color.rgb(130, 138, 156), Color.rgb(236, 240, 248)),
                    floatArrayOf(0f, 0.42f, 0.72f, 1f))
            }
            Settings.STYLE_NEON -> {
                // නියොන් නළය: පළල් පාට glow + පාට නළය + සුදු මධ්‍යය
                val tube = if (glowC != auto) glowC else Color.rgb(0, 225, 255)
                glow(tube, 0.45f, 0.55f)
                glow(tube, 0.16f, 0.85f)
                val st = Paint(p).apply {
                    this.style = Paint.Style.STROKE; strokeWidth = max(2f, size * 0.07f); strokeJoin = Paint.Join.ROUND
                    color = withAlpha(pick(outlineC, tube), (255 * alpha).toInt())
                }
                drawFm(c, s, cx, y, st)
                fill(lighten(tube, 0.85f))
            }
            Settings.STYLE_STONE -> {
                // සීගිරි ගලේ කොටපු අකුරු: වැලිගල් gradient + emboss (උඩ එළිය, පහළ සෙවණ)
                shadow(Color.argb(200, 25, 12, 4), 0.10f, 0.06f)
                stroke(Color.rgb(78, 44, 22), 0.05f)
                val hi = Paint(p).apply { color = Color.argb((150 * alpha).toInt(), 255, 236, 205) }
                drawFm(c, s, cx - size * 0.015f, y - size * 0.02f, hi)
                val lo = Paint(p).apply { color = Color.argb((170 * alpha).toInt(), 60, 32, 14) }
                drawFm(c, s, cx + size * 0.015f, y + size * 0.02f, lo)
                gradFill(intArrayOf(Color.rgb(232, 190, 140), Color.rgb(205, 150, 98), Color.rgb(160, 102, 60), Color.rgb(196, 140, 90)),
                    floatArrayOf(0f, 0.45f, 0.78f, 1f))
            }
            Settings.STYLE_GLASS -> {
                // Frosted වීදුරු: විනිවිද පිරවුම + දිලිසෙන දාරය + උඩ highlight
                shadow(Color.argb(80, 0, 0, 0), 0.20f, 0.05f)
                fill(Color.WHITE, 0.30f)
                stroke(Color.WHITE, 0.03f, 0.85f)
                val hl = Paint(p).apply {
                    shader = LinearGradient(0f, y - size * 1.0f, 0f, y - size * 0.35f,
                        Color.argb((150 * alpha).toInt(), 255, 255, 255), Color.argb(0, 255, 255, 255), Shader.TileMode.CLAMP)
                }
                drawFm(c, s, cx, y, hl)
            }
            Settings.STYLE_EMBER -> {
                // ගිනි පුපුරු: තැඹිලි glow + කහ-සුදු → තැඹිලි → රතු gradient
                shadow(Color.argb(160, 60, 8, 0), 0.14f, 0.05f)
                glow(Color.rgb(255, 110, 20), 0.40f, 0.60f)
                glow(Color.rgb(255, 170, 60), 0.12f, 0.75f)
                gradFill(intArrayOf(Color.rgb(255, 250, 215), Color.rgb(255, 200, 80), Color.rgb(240, 100, 25), Color.rgb(255, 170, 60)),
                    floatArrayOf(0f, 0.40f, 0.78f, 1f))
            }
            Settings.STYLE_3D -> {
                // ගැඹුරු 3D: පහළ-දකුණට පියවර 9ක extrude එකක් + මුහුණත
                shadow(Color.argb(170, 0, 0, 0), 0.18f, 0.16f)
                val depth = pick(outlineC, Color.rgb(38, 44, 62))
                val steps = 9
                for (i in steps downTo 1) {
                    val k = i / steps.toFloat()
                    val ep = Paint(p).apply { color = withAlpha(darken(depth, 0.25f * k), (255 * alpha).toInt()) }
                    drawFm(c, s, cx + size * 0.012f * i, y + size * 0.012f * i, ep)
                }
                fill(Color.WHITE)
            }
            else -> {
                // Shadow (සාමාන්‍ය): දීප්තිමත් අහසේත් කියවන්න පුළුවන් වෙන්න යටින් මෘදු අඳුරු blur එකක්
                shadow(Color.argb(95, 10, 8, 16), 0.30f, 0f)
                shadow(Color.argb(190, 0, 0, 0), 0.16f, 0.05f)
                fill(Color.WHITE)
            }
        }
        // custom outline එකක් තෝරලා නම්, outline නැති styles වලටත් සිහින් දාරයක්
        if (outlineC != auto && !styleHasOutline && style != Settings.STYLE_NEON) stroke(outlineC, 0.03f)
    }

    private fun drawDivider(c: Canvas, cx: Float, y: Float, base: Float, style: Int, colors: Settings.TextColors) {
        val lw = c.width * 0.11f
        val dia = base * 0.0085f
        val col = when {
            colors.text != Settings.AUTO_COLOR -> colors.text
            style == Settings.STYLE_GOLD -> Color.rgb(240, 200, 110)
            style == Settings.STYLE_STONE -> Color.rgb(215, 165, 110)
            style == Settings.STYLE_EMBER -> Color.rgb(255, 170, 70)
            style == Settings.STYLE_NEON -> if (colors.glow != Settings.AUTO_COLOR) colors.glow else Color.rgb(0, 225, 255)
            style == Settings.STYLE_SILVER -> Color.rgb(215, 222, 235)
            else -> Color.WHITE
        }
        val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            strokeWidth = max(1.5f, base * 0.0028f)
            setShadowLayer(3f, 0f, 1f, Color.argb(120, 0, 0, 0))
        }
        val clear = col and 0x00FFFFFF
        val solid = (col and 0x00FFFFFF) or (200 shl 24)
        line.shader = LinearGradient(cx - lw - dia * 2, y, cx - dia * 2, y, clear, solid, Shader.TileMode.CLAMP)
        c.drawLine(cx - lw - dia * 2, y, cx - dia * 2, y, line)
        line.shader = LinearGradient(cx + dia * 2, y, cx + lw + dia * 2, y, solid, clear, Shader.TileMode.CLAMP)
        c.drawLine(cx + dia * 2, y, cx + lw + dia * 2, y, line)
        line.shader = null
        line.color = (col and 0x00FFFFFF) or (230 shl 24)
        line.style = Paint.Style.FILL
        val path = Path().apply {
            moveTo(cx, y - dia); lineTo(cx + dia, y); lineTo(cx, y + dia); lineTo(cx - dia, y); close()
        }
        c.drawPath(path, line)
    }

    /**
     * FM string එක අකුරෙන් අකුර අඳිනවා (මැදට align කරලා).
     * FM Malithi එකේ "ව" උඩ හල් කිරීම (්) ව සහ ඊළඟ අකුර අතරට වැටෙන නිසා ඒක ටිකක් වමට ගන්නවා.
     */
    private fun drawFm(c: Canvas, s: String, cx: Float, y: Float, p: Paint) {
        val align = p.textAlign
        p.textAlign = Paint.Align.LEFT
        val fmSize = p.textSize
        var x = cx - p.measureText(s) / 2f
        // "වේ" හල් කිරීම ව උඩට ගන්න (render කරලා Unicode එක්ක සසඳලා තෝරපු අගයන්)
        val halShift = when {
            fontName?.contains("malithi", true) != false -> -0.21f
            fontName?.contains("emanee", true) == true -> -0.11f
            else -> 0f
        } * fmSize
        var prev = ' '
        val one = CharArray(1)
        for (ch in s) {
            one[0] = ch
            val dx = if (ch == 'a' && prev == 'j') halShift else 0f
            c.drawText(one, 0, 1, x + dx, y, p)
            x += p.measureText(one, 0, 1)
            prev = ch
        }
        p.textAlign = align
    }



    private fun paint(size: Float) = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
        typeface = this@TextPainter.typeface
        textSize = size
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
    }

    /**
     * වචන ටික පේළි වලට බෙදනවා: අවම පේළි ගණනින්, පේළි වල දිග හැකි තරම් සමානව.
     * Return කරන්නේ FM encoding එකට හරවපු පේළි.
     */
    private fun balance(words: List<String>, p: Paint, maxW: Float): List<String> {
        val fm = words.map { convert(it) }
        val n = fm.size
        fun width(a: Int, b: Int) = p.measureText(fm.subList(a, b).joinToString(" "))
        for (lines in 1..min(4, n)) {
            var best: List<Int>? = null
            var bestScore = Float.MAX_VALUE
            fun search(start: Int, left: Int, cuts: List<Int>) {
                if (left == 1) {
                    val all = cuts + n
                    var prev = 0
                    var worst = 0f
                    for (e in all) { worst = max(worst, width(prev, e)); prev = e }
                    if (worst <= maxW && worst < bestScore) { bestScore = worst; best = all }
                    return
                }
                for (cut in start + 1 until n - left + 2) search(cut, left - 1, cuts + cut)
            }
            search(0, lines, emptyList())
            best?.let { ends ->
                var prev = 0
                return ends.map { e -> fm.subList(prev, e).joinToString(" ").also { prev = e } }
            }
        }
        return listOf(fm.joinToString(" "))
    }

    companion object {
        fun withAlpha(c: Int, a: Int) = (c and 0x00FFFFFF) or (a.coerceIn(0, 255) shl 24)
        fun lighten(c: Int, k: Float) = Color.rgb(
            (Color.red(c) + (255 - Color.red(c)) * k).toInt(), (Color.green(c) + (255 - Color.green(c)) * k).toInt(),
            (Color.blue(c) + (255 - Color.blue(c)) * k).toInt())
        fun darken(c: Int, k: Float) = Color.rgb(
            (Color.red(c) * (1 - k)).toInt(), (Color.green(c) * (1 - k)).toInt(), (Color.blue(c) * (1 - k)).toInt())


        /** assets/fonts එකේ තියෙන fonts (Malithi මුලින්ම). */
        fun fonts(context: Context): List<String> =
            (context.assets.list("fonts") ?: emptyArray())
                .filter { it.endsWith(".ttf", true) || it.endsWith(".otf", true) }
                .sortedBy { if (it.contains("malithi", true)) 0 else 1 }

        fun loadTypeface(context: Context, name: String? = null): Typeface {
            val list = fonts(context)
            val pick = name?.takeIf { it in list } ?: list.firstOrNull()
            return if (pick != null) Typeface.createFromAsset(context.assets, "fonts/$pick") else Typeface.DEFAULT_BOLD
        }

        /** Isi encoding එක පාවිච්චි කරන fonts (IsiAbhaya, IsiDharanee ...). Apex fonts FM encoding එකමයි. */
        fun isIsiFont(file: String?): Boolean = file?.startsWith("isi", ignoreCase = true) == true

        /** Settings එකේ පෙන්වන සිංහල නම. */
        fun displayName(file: String): String = when {
            file.contains("malithi", true) -> "Malithi"
            file.contains("emanee", true) -> "Emanee"
            else -> file.substringBeforeLast('.')
                .replace(Regex("^(fm|isi)[-_ ]?", RegexOption.IGNORE_CASE), "")
                .replace(Regex("[-_]+"), " ")
                .replace(Regex("([a-zA-Z])(\\d)"), "$1 $2")
                .split(' ').joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }
        }
    }
}
