package lk.sinhala.welawa

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.os.SystemClock
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.TimeZone
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Wallpaper එකයි preview එකයි දෙකටම පාවිච්චි වෙන renderer එක.
 */
class SceneRenderer(context: Context) : GLSurfaceView.Renderer {

    private val ctx = context.applicationContext
    private val textPainter = TextPainter(ctx)
    private val state = SceneState()

    // ---- සැකසුම් (preview එකෙන් වෙනස් කළාම wallpaper එකත් ඉබේම, live update වෙනවා)
    private var settings = Settings.read(ctx)
    @Volatile private var seenSettings = -1

    /** සැකසුම් disk එකෙන් ආයේ කියවන්න බල කරනවා (wallpaper එක පේන්න ගත්තාම). */
    fun reloadSettings() { seenSettings = -1 }

    /** Launcher එකේ home screen scroll එක (0..1) — parallax. */
    @Volatile var parallaxX = 0.5f

    /** Preview එකේ වෙලාව බලෙන් දාන්න (මිනිත්තු 0..1440). < 0 නම් ඇත්ත වෙලාව. */
    @Volatile var overrideMinute = -1f

    // ---- දින දර්ශනය (විනාඩියකට වරක් ගණනය කරනවා)
    private var skyKey = Int.MIN_VALUE
    private var sunRise = SCENE_RISE
    private var sunSet = SCENE_SET
    private var moonAge = 0.5f
    private var moonIllum = 1f
    private var poya = false
    private var vesak = false
    private var avurudu = false

    /** පරීක්ෂා කිරීමට (preview intent එකෙන්): පොහොය/වෙසක්/අවුරුදු/සඳ/අකුණු/දේදුන්න බලෙන් දාන්න. */
    @Volatile var debugPoya = false
    // easter eggs පරීක්ෂා කිරීමට (preview එකෙන් විතරයි)
    @Volatile var debugGhost = false
    @Volatile var debugTuk = false
    @Volatile var debugCroc = false
    @Volatile var debugAprilFool = false
    @Volatile var debugNewYear = false
    private var aprilFool = false
    private var newYearDay = false
    private var ghostT = -1f
    private var tukT = -1f
    private var tukColor = 0f
    private var fireT = -1f
    private var crocShift = Float.NaN
    @Volatile var debugVesak = false
    @Volatile var debugAvurudu = false
    @Volatile var debugMoonAge = -1f
    @Volatile var debugThunder = false
    @Volatile var debugRainbow = false

    // ---- lock screen
    private val keyguard = ctx.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
    private var locked = false
    private var lastLockPoll = 0L

    // ---- adaptive resolution: frame එකක් ප්‍රමාද නම් scene එකේ resolution එක අඩු කරනවා, ඉඩ තියෙනවා නම් වැඩි කරනවා.
    //      (පසුබිම් photo එක 768px පළලයි — ඊට වඩා ගොඩක් වැඩි resolution එකකින් අඳින එක GPU නාස්තියක්.)
    /** ඉලක්ක frame කාලය (ns) — wallpaper service එකෙන් (display refresh / fps සීමාව). 0 = display එකෙන් ගන්නවා. */
    @Volatile var targetFrameNs = 0f
    private var renderScale = 0f
    private var lastDrawNs = 0L
    private var slowCount = 0
    private var fastCount = 0

    /** ෆෝන් එක ඇලවීම (-1..1) — TiltSensor එකෙන්. */
    @Volatile var tiltX = 0f
    @Volatile var tiltY = 0f
    private var smTiltX = 0f
    private var smTiltY = 0f

    // ---------------------------------------------------------------- GL objects
    private var sceneProg = 0
    private var textProg = 0
    private lateinit var quad: FloatBuffer
    private val sceneU = HashMap<String, Int>()
    private val textU = HashMap<String, Int>()

    private val imageTex = LinkedHashMap<Int, Int>()   // image index → texture id
    private var maskTex = 0

    // battery saver: scene එක අඩු resolution offscreen buffer එකකට අඳිනවා
    private var blitProg = 0
    private var fbo = 0
    private var fboTex = 0
    private var fboW = 0
    private var fboH = 0
    private var maxTexSize = 2048

    private var width = 1
    private var height = 1
    private var imgW = 768
    private var imgH = 1376

    // ---------------------------------------------------------------- text state
    private var curKey = -1
    private var curTex = 0
    private var curTexH = 0
    private var prevTex = 0
    private var prevTexH = 0
    private var textChangeAt = 0L

    private val startMs = SystemClock.elapsedRealtime()
    private var eleT = -1f
    private var lastOverride = -2f
    private var overrideT0 = 0f
    private var lastFrameMs = 0L
    private var windT = 0f

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        // context එක අලුත් නිසා පරණ texture ids වැඩ නෑ
        imageTex.clear(); curTex = 0; prevTex = 0; curKey = -1; maskTex = 0

        val ib = IntArray(1)
        GLES20.glGetIntegerv(GLES20.GL_MAX_TEXTURE_SIZE, ib, 0)
        maxTexSize = max(2048, ib[0])

        quad = ByteBuffer.allocateDirect(8 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
            .apply { put(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)); position(0) }

        val common = FRAG_HEADER + readAsset("shaders/common.glsl") + "\n"
        sceneProg = buildProgram(SCENE_VERT, common + readAsset("shaders/scene.frag"))
        textProg = buildProgram(TEXT_VERT, TEXT_FRAG)
        blitProg = buildProgram(BLIT_VERT, BLIT_FRAG)
        fbo = 0; fboTex = 0; fboW = 0; fboH = 0
        sceneU.clear(); textU.clear()

        BitmapFactory.Options().apply {
            inJustDecodeBounds = true
            ctx.assets.open(imagePath(0)).use { BitmapFactory.decodeStream(it, null, this) }
            if (outWidth > 0) { imgW = outWidth; imgH = outHeight }
        }
        maskTex = loadTexture("scenes/sigiriya/mask.png", 1024)
        GLES20.glClearColor(0f, 0f, 0f, 1f)
    }

    override fun onSurfaceChanged(gl: GL10?, w: Int, h: Int) {
        width = max(1, w); height = max(1, h)
        GLES20.glViewport(0, 0, width, height)
        // screen size එක වෙනස් වුණාම text එක ආයේ අඳිනවා, images ආයේ load කරනවා
        curKey = -1
        deleteTex(prevTex); prevTex = 0
        deleteTex(curTex); curTex = 0; curTexH = 0
        for (id in imageTex.values) deleteTex(id)
        imageTex.clear()
    }

    override fun onDrawFrame(gl: GL10?) {
        adaptResolution()
        val nowMs = SystemClock.elapsedRealtime()
        val t = ((nowMs - startMs) % 3_600_000L) / 1000f

        val sv = Settings.version
        if (sv != seenSettings) {
            seenSettings = sv
            settings = Settings.read(ctx)
            textPainter.setFont(settings.font)
            curKey = -1                           // text එක ආයේ අඳින්න
            skyKey = Int.MIN_VALUE                // city එක වෙනස් වෙන්න පුළුවන්
        }

        // lock screen එකද (තත්පර භාගයකට වරක් බලනවා)
        if (nowMs - lastLockPoll > 500L) {
            lastLockPoll = nowMs
            val l = keyguard.isKeyguardLocked
            if (l != locked) { locked = l; curKey = -1 }
        }

        val minute = currentMinute()
        updateSky(minute)
        // අලි රංචුව: හිරු බැසීමට විනාඩි ELE_BEFORE_SUNSET කට කලින් සිට, රංචු ELE_HERDS ක් (එකකට තත්පර 170)
        // preview එකේ වෙලාව තෝරලා නම්: ඒ වෙලාව තේරුවට පස්සේ ගතවුණු තත්පර විතරක් එකතු කරනවා
        // (කලින් app එක open කරලා ගතවුණු මුළු කාලයම එකතු වුණා — ටික වෙලාවකින් අලි කවදාවත් පේන්නේ නැති වුණා)
        if (overrideMinute != lastOverride) { lastOverride = overrideMinute; overrideT0 = t }
        val sinceOverride = if (overrideMinute >= 0f) (t - overrideT0 + 3600f) % 3600f else 0f
        // අලි වතුර බොන්න එන්නේ සවසට (හිරු බැසීමට පැයකට කලින් සිට) සහ පාන්දර (හිරු උදාව වටේ)
        fun eleWindow(startMin: Float, herds: Int): Float {
            val sec = (minute - startMin) * 60f + sinceOverride
            return if (sec >= 0f && sec < herds * 170f) sec else -1f
        }
        eleT = max(eleWindow(sunSet - ELE_BEFORE_SUNSET, ELE_HERDS), eleWindow(sunRise - ELE_DAWN_BEFORE, ELE_DAWN_HERDS))

        // ---- easter eggs (තත්පර, -1 = නෑ)
        fun secIn(startMin: Float, durSec: Float): Float {
            val sec = (minute - startMin) * 60f + sinceOverride
            return if (sec >= 0f && sec < durSec) sec else -1f
        }
        // ජනවාරි 1: මධ්‍යම රාත්‍රියේ සිට විනාඩි 20ක් ගිනිකෙළි
        fireT = if (debugNewYear) sinceOverride % FIRE_DUR else if (newYearDay) secIn(0f, FIRE_DUR) else -1f
        // හරියටම රෑ 12: හොල්මන් සීන් එක (තත්පර 60) — අලුත් අවුරුද්දට නෑ
        ghostT = if (debugGhost) sinceOverride % GHOST_DUR else if (!newYearDay) secIn(0f, GHOST_DUR) else -1f
        // ත්‍රීවීල් එක: දවසට එක වතාවක්, 6:30 – 21:30 අතර අහඹු වෙලාවක (දවසට එකම වෙලාව)
        val rnd = java.util.Random(currentDay() * 7919L + 13L)
        val tukStart = 390f + rnd.nextInt(900)
        tukColor = rnd.nextInt(4).toFloat()
        tukT = if (debugTuk) sinceOverride % TUK_DUR else secIn(tukStart, TUK_DUR)
        // කිඹුලා: shader එකේ චක්‍රය (CROC_PERIOD) — debug නම් දැන්ම එන්න shift කරනවා
        if (debugCroc && crocShift.isNaN()) crocShift = ((CROC_START - (t + 2f)) % CROC_PERIOD + CROC_PERIOD) % CROC_PERIOD
        if (!debugCroc) crocShift = Float.NaN
        // frame අතර කාලය (wallpaper එක නැවතිලා ආයේ පටන් ගත්තාම ලොකු jump එකක් නොවෙන්න සීමා කරලා)
        val dt = if (lastFrameMs == 0L) 1f else ((nowMs - lastFrameMs) / 1000f).coerceIn(0f, 0.1f)
        lastFrameMs = nowMs
        if (settings.liveWeather) LiveWeather.maybeFetch(settings.city)
        state.live = if (settings.liveWeather) LiveWeather.current else null
        // scene එක ඇත්ත හිරු උදාව / බැසීම අනුව (පින්තූර හැදුවේ 6:15 උදාවට, 18:15 බැසීමට)
        state.update(sceneMinute(minute), currentDay(), settings.rain, settings.storm, dt)

        // සුළං කාලය: තද සුළඟට වේගයෙන් ගලනවා (වේගය වෙනස් වුණාම පනින්නේ නැති වෙන්න integrate කරනවා)
        windT = (windT + min(dt, 0.1f) * (1f + 2.6f * state.storm)) % 3600f

        // ---- text
        val mi = minute.toInt().coerceIn(0, 1439)
        if (mi != curKey) updateText(mi, nowMs)

        smTiltX += (tiltX - smTiltX) * 0.10f
        smTiltY += (tiltY - smTiltY) * 0.10f

        // ---- image uv mapping (cover + parallax + සෙමින් චලනය)
        val sa = width.toFloat() / height
        val ia = imgW.toFloat() / imgH
        val zoom = 1.065f                 // depth parallax එකට දාර වල ඉඩ
        val scaleX: Float
        val scaleY: Float
        if (sa < ia) { scaleY = 1f / zoom; scaleX = (sa / ia) / zoom }
        else { scaleX = 1f / zoom; scaleY = (ia / sa) / zoom }
        var cx = 0.5f + sin(t * 0.031f) * 0.004f
        // පර්වතයේ මුදුන screen එකේ ~45% ට එන්න (landscape/tablet වලදීත් text එකට අහසේ ඉඩ තියෙන්න)
        var cy = ROCK_TOP_Y - 0.45f * scaleY + scaleY / 2f + sin(t * 0.023f) * 0.004f
        cx = cx.coerceIn(scaleX / 2f, 1f - scaleX / 2f)
        cy = cy.coerceIn(scaleY / 2f, 1f - scaleY / 2f)
        val offX = cx - scaleX / 2f
        val offY = cy - scaleY / 2f

        // text එක: screen මැදට ටිකක් උඩින්, හැබැයි සීගිරි පර්වතයට උඩින් විතරයි
        val rockTop = (ROCK_TOP_Y - offY) / scaleY
        val blockH = curTexH.toFloat() / height
        val autoCenter = min(0.40f, rockTop - blockH * 0.5f + 0.03f)
            .coerceAtLeast(blockH * 0.5f + 0.05f)
        // පරිශීලකයා slider එකෙන් උඩ/පහළ කරනවා — හැබැයි text එක screen එකෙන් එළියට යන්නේ නෑ
        // (උඩ status bar එකට, පහළ dock එකට ඉඩ තියලා)
        val minC = blockH * 0.5f + 0.04f
        val maxC = max(minC, 1f - blockH * 0.5f - 0.12f)
        // lock screen එකේ system clock එකට යටින් නොවැටෙන්න පහළට
        val lockShift = if (locked && settings.lockBig) LOCK_Y_SHIFT else 0f
        val textCenter = (autoCenter + settings.textY + lockShift).coerceIn(minC, maxC)

        // ---- textures
        val texA = imageTexture(state.imgA)
        val texB = if (state.mix > 0.001f) imageTexture(state.imgB) else texA
        trimTextures(state.imgA, state.imgB)

        GLES20.glDisable(GLES20.GL_BLEND)
        val scale = if (settings.batterySaver) min(renderScale, SAVER_RES) else renderScale
        val lowRes = scale < 0.98f && ensureFbo(scale)
        if (lowRes) {
            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo)
            GLES20.glViewport(0, 0, fboW, fboH)
        }
        GLES20.glUseProgram(sceneProg)
        bindTex(0, texA, "uImgA")
        bindTex(1, texB, "uImgB")
        bindTex(2, maskTex, "uMask")
        u1("uMix", state.mix)
        u2("uScale", scaleX, scaleY)
        u2("uOffset", offX, offY)
        u1("uAspect", imgH.toFloat() / imgW)
        u2("uMoonPos", 0.651f, 0.198f)
        u2("uMoonRefl", 0.633f, 0.845f)
        u2("uSunPos", state.sunPos[0], state.sunPos[1])
        u1("uSunAmt", state.sunAmount)
        // ---- depth parallax: ෆෝන් එක ඇලවීම + home screen scroll + සෙමින් "හුස්ම ගන්න" චලනයක්
        val px = smTiltX + (parallaxX - 0.5f) * 1.2f + sin(t * 0.21f) * 0.22f
        val py = smTiltY + sin(t * 0.17f + 1.3f) * 0.14f
        u2("uPar", px.coerceIn(-1.3f, 1.3f) * PARALLAX_X, py.coerceIn(-1.3f, 1.3f) * PARALLAX_Y)
        u1("uFocus", DEPTH_FOCUS)
        u1("uCine", if (settings.cinematic) 1f else 0f)
        setCommonUniforms(t, textCenter)
        drawQuad(sceneProg)
        if (lowRes) {
            // අඩු resolution scene එක screen එකට ලොකු කරලා (linear filter) — text එක full resolution
            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
            GLES20.glViewport(0, 0, width, height)
            GLES20.glUseProgram(blitProg)
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, fboTex)
            GLES20.glUniform1i(GLES20.glGetUniformLocation(blitProg, "uTex"), 0)
            drawQuad(blitProg)
        }
        drawTextLayer(nowMs, textCenter)
    }

    private fun setCommonUniforms(t: Float, textCenter: Float) {
        u1("uTime", t)
        u1("uDawn", state.dawn); u1("uMorning", state.morning); u1("uNoon", state.noon)
        u1("uEvening", state.evening); u1("uNight", state.night)
        u3("uCloudTint", state.cloudTint); u1("uCloudAmt", state.cloudAmount)
        u3("uMistTint", state.mistTint)
        u3("uSunCol", state.sunColor)
        u1("uAmbient", state.ambient)
        u1("uEarlyMist", state.earlyMist)
        u1("uWind", state.wind)
        u1("uRain", state.rain)
        u1("uStorm", state.storm)
        u1("uWindT", windT)
        u1("uScrAspect", height.toFloat() / width)
        val fest = settings.festivals
        u1("uMoonAge", if (debugMoonAge >= 0f) debugMoonAge else moonAge)
        u1("uThunder", if (debugThunder) 1f else state.thunder)
        u1("uRainbow", if (debugRainbow) 1f else state.rainbow)
        u1("uPoya", if ((poya && fest) || debugPoya) 1f else 0f)
        u1("uVesak", if ((vesak && fest) || debugVesak) 1f else 0f)
        u1("uAvurudu", if ((avurudu && fest) || debugAvurudu) 1f else 0f)
        u1("uTextY", textCenter)
        u1("uEleT", eleT)
        u1("uGhostT", ghostT)
        u1("uTukT", tukT)
        u1("uTukColor", tukColor)
        u1("uFireT", fireT)
        u1("uCrocShift", if (crocShift.isNaN()) 0f else crocShift)
        u1("uAprilFool", if (aprilFool || debugAprilFool) 1f else 0f)
    }

    private fun drawTextLayer(nowMs: Long, textCenter: Float) {
        // ---- text (පරණ එක fade out, අලුත් එක fade in)
        GLES20.glEnable(GLES20.GL_BLEND)
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA)
        GLES20.glUseProgram(textProg)
        val k = ((nowMs - textChangeAt) / 1400f).coerceIn(0f, 1f)
        val e = k * k * (3f - 2f * k)
        val lift = 0.012f
        if (prevTex != 0 && e < 1f) drawText(prevTex, prevTexH, textCenter - lift * e, 1f - e)
        if (e >= 1f && prevTex != 0) { deleteTex(prevTex); prevTex = 0 }
        if (curTex != 0) drawText(curTex, curTexH, textCenter + lift * (1f - e), e)
    }

    // ---------------------------------------------------------------- time
    /** ඇත්ත වෙලාව → scene වෙලාව: හිරු උදාව SCENE_RISE ට, බැසීම SCENE_SET ට එන්න (piecewise linear). */
    private fun sceneMinute(m: Float): Float {
        val r = sunRise; val s = sunSet
        return when {
            m < r -> m / r * SCENE_RISE
            m < s -> SCENE_RISE + (m - r) / (s - r) * (SCENE_SET - SCENE_RISE)
            else -> SCENE_SET + (m - s) / (1440f - s) * (1440f - SCENE_SET)
        }
    }

    /** විනාඩියකට වරක්: හිරු වෙලාවන්, සඳ, පොහොය, උත්සව. */
    private fun updateSky(minute: Float) {
        val key = minute.toInt() + (if (overrideMinute >= 0f) 100_000 else 0)
        if (key == skyKey) return
        skyKey = key
        val cal = SkyCalendar.now()
        if (overrideMinute >= 0f) {
            cal.set(java.util.Calendar.HOUR_OF_DAY, (minute / 60).toInt())
            cal.set(java.util.Calendar.MINUTE, (minute % 60).toInt())
        }
        val city = SkyCalendar.city(settings.city)
        val (rise, set) = SkyCalendar.sunTimes(cal, city.lat, city.lon)
        sunRise = rise.coerceIn(300f, 450f); sunSet = set.coerceIn(1020f, 1170f)
        moonAge = SkyCalendar.moonAge(cal.timeInMillis).toFloat()
        moonIllum = SkyCalendar.moonIllumination(cal.timeInMillis)
        poya = SkyCalendar.isPoya(cal)
        vesak = SkyCalendar.isVesakSeason(cal)
        avurudu = SkyCalendar.isAvurudu(cal)
        aprilFool = cal.get(java.util.Calendar.MONTH) == java.util.Calendar.APRIL && cal.get(java.util.Calendar.DAY_OF_MONTH) == 1
        newYearDay = cal.get(java.util.Calendar.MONTH) == java.util.Calendar.JANUARY && cal.get(java.util.Calendar.DAY_OF_MONTH) == 1
    }

    private fun currentDay(): Long {
        val now = System.currentTimeMillis()
        return (now + TimeZone.getDefault().getOffset(now)) / 86_400_000L
    }

    private fun currentMinute(): Float {
        val o = overrideMinute
        if (o >= 0f) return o % 1440f
        val now = System.currentTimeMillis()
        val local = now + TimeZone.getDefault().getOffset(now)
        return ((local % 86_400_000L) / 60_000f)
    }

    // ---------------------------------------------------------------- text
    private fun updateText(minuteOfDay: Int, nowMs: Long) {
        val phrase = SinhalaTime.phrase(minuteOfDay / 60, minuteOfDay % 60)
        val lockMul = if (locked && settings.lockBig) LOCK_SCALE else 1f
        val base = min(width.toFloat(), height * 0.62f) * settings.textScale * lockMul
        val res = textPainter.paint(phrase, width, base, settings.style, settings.showLabel, settings.colors)
        val tex = uploadBitmap(res.bitmap)
        res.bitmap.recycle()

        deleteTex(prevTex); prevTex = 0
        if (curTex == 0 || curKey == -1) {
            deleteTex(curTex); curTex = 0
            textChangeAt = nowMs - 2000   // මුල් වතාවේ animation නෑ
        } else {
            prevTex = curTex; prevTexH = curTexH
            textChangeAt = nowMs
        }
        curTex = tex; curTexH = res.heightPx
        curKey = minuteOfDay
    }

    private fun drawText(tex: Int, texH: Int, centerY: Float, alpha: Float) {
        if (alpha <= 0.001f) return
        val hN = texH.toFloat() / height * 2f        // NDC උස
        val cyN = 1f - centerY * 2f
        val loc = textLoc("uRect")
        GLES20.glUniform4f(loc, -1f, cyN - hN / 2f, 1f, cyN + hN / 2f)
        GLES20.glUniform1f(textLoc("uAlpha"), alpha)
        GLES20.glUniform3f(textLoc("uTint"), state.textTint[0], state.textTint[1], state.textTint[2])
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex)
        GLES20.glUniform1i(textLoc("uTex"), 0)
        drawQuad(textProg)
    }

    /**
     * frame එකින් frame එකට කාලය මනිනවා: eglSwapBuffers GPU එක ඉවර වෙනකම් බලන් ඉන්න නිසා,
     * frames ඉලක්කයට වඩා දිගු නම් GPU එක පසුපසින් — resolution අඩු කරනවා.
     */
    private fun adaptResolution() {
        val now = System.nanoTime()
        val maxScale = min(1f, MAX_SCENE_W / max(1, width).toFloat()).coerceAtLeast(MIN_SCALE)
        if (renderScale == 0f) renderScale = maxScale
        val target = if (targetFrameNs > 0f) targetFrameNs else 1_000_000_000f / displayHz()
        val d = (now - lastDrawNs).toFloat()
        lastDrawNs = now
        if (d <= 0f || d > 250_000_000f) return                       // නැවතිලා තිබුණා — ගණන් ගන්නේ නෑ
        when {
            d > target * 1.35f -> { slowCount++; fastCount = 0 }
            d < target * 1.12f -> { fastCount++; if (slowCount > 0) slowCount-- }
        }
        if (slowCount >= 6) {
            renderScale = max(MIN_SCALE, renderScale - 0.06f); slowCount = 0; fastCount = 0
            android.util.Log.d("Welawa", "render scale ↓ $renderScale (frame ${d / 1e6f}ms, target ${target / 1e6f}ms)")
        } else if (fastCount >= 240 && renderScale < maxScale) {
            renderScale = min(maxScale, renderScale + 0.03f); fastCount = 0
            android.util.Log.d("Welawa", "render scale ↑ $renderScale")
        }
        if (renderScale > maxScale) renderScale = maxScale
    }

    private val displayHzCached: Float by lazy {
        try {
            (ctx.getSystemService(Context.DISPLAY_SERVICE) as android.hardware.display.DisplayManager)
                .getDisplay(android.view.Display.DEFAULT_DISPLAY)?.refreshRate ?: 60f
        } catch (_: Exception) { 60f }
    }
    private fun displayHz(): Float = displayHzCached

    /** අඩු resolution offscreen buffer (scale = screen එකෙන් කොටස). හදන්න බැරි වුණොත් false. */
    private fun ensureFbo(scale: Float): Boolean {
        val q = (Math.round(scale * 20f) / 20f).coerceIn(MIN_SCALE, 1f)   // 5% පියවර — නිතර buffer හදන්නේ නෑ
        val w = max(1, (width * q).toInt())
        val h = max(1, (height * q).toInt())
        if (fbo != 0 && w == fboW && h == fboH) return true
        if (fbo != 0) { GLES20.glDeleteFramebuffers(1, intArrayOf(fbo), 0); deleteTex(fboTex); fbo = 0; fboTex = 0 }
        val ids = IntArray(1)
        GLES20.glGenTextures(1, ids, 0); fboTex = ids[0]
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, fboTex)
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, w, h, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glGenFramebuffers(1, ids, 0); fbo = ids[0]
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo)
        GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, fboTex, 0)
        val ok = GLES20.glCheckFramebufferStatus(GLES20.GL_FRAMEBUFFER) == GLES20.GL_FRAMEBUFFER_COMPLETE
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
        if (!ok) {
            GLES20.glDeleteFramebuffers(1, intArrayOf(fbo), 0); deleteTex(fboTex); fbo = 0; fboTex = 0
            return false
        }
        fboW = w; fboH = h
        return true
    }

    // ---------------------------------------------------------------- textures
    private fun imagePath(i: Int) = "scenes/sigiriya/${i + 1}.jpg"

    private fun imageTexture(i: Int): Int {
        imageTex[i]?.let { return it }
        val target = min(maxTexSize, max(1600, (height * 1.1f).toInt()))
        val id = loadTexture(imagePath(i), target)
        imageTex[i] = id
        return id
    }

    /** මතකය ඉතුරු කරන්න: දැන් ඕන නැති images 3කට වැඩි නම් අයින් කරනවා. */
    private fun trimTextures(a: Int, b: Int) {
        if (imageTex.size <= 3) return
        val it = imageTex.entries.iterator()
        while (it.hasNext() && imageTex.size > 3) {
            val e = it.next()
            if (e.key != a && e.key != b) { deleteTex(e.value); it.remove() }
        }
    }

    private fun loadTexture(path: String, maxDim: Int): Int {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        ctx.assets.open(path).use { BitmapFactory.decodeStream(it, null, opts) }
        var sample = 1
        while (max(opts.outWidth, opts.outHeight) / (sample * 2) >= maxDim) sample *= 2
        val bmp = ctx.assets.open(path).use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.ARGB_8888
            })
        } ?: run { Log.e(TAG, "decode failed: $path"); return 0 }
        val scaled = if (max(bmp.width, bmp.height) > maxDim) {
            val f = maxDim.toFloat() / max(bmp.width, bmp.height)
            Bitmap.createScaledBitmap(bmp, (bmp.width * f).toInt(), (bmp.height * f).toInt(), true)
                .also { if (it !== bmp) bmp.recycle() }
        } else bmp
        return uploadBitmap(scaled).also { scaled.recycle() }
    }

    private fun uploadBitmap(bmp: Bitmap): Int {
        val ids = IntArray(1)
        GLES20.glGenTextures(1, ids, 0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, ids[0])
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0)
        return ids[0]
    }

    private fun deleteTex(id: Int) {
        if (id != 0) GLES20.glDeleteTextures(1, intArrayOf(id), 0)
    }

    private fun bindTex(unit: Int, tex: Int, name: String) {
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0 + unit)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex)
        GLES20.glUniform1i(sceneLoc(name), unit)
    }

    // ---------------------------------------------------------------- shader helpers
    private fun sceneLoc(n: String) = sceneU.getOrPut(n) { GLES20.glGetUniformLocation(sceneProg, n) }
    private fun textLoc(n: String) = textU.getOrPut(n) { GLES20.glGetUniformLocation(textProg, n) }
    private fun u1(n: String, v: Float) = GLES20.glUniform1f(sceneLoc(n), v)
    private fun u2(n: String, a: Float, b: Float) = GLES20.glUniform2f(sceneLoc(n), a, b)
    private fun u3(n: String, v: FloatArray) = GLES20.glUniform3f(sceneLoc(n), v[0], v[1], v[2])

    private fun drawQuad(prog: Int) {
        val loc = GLES20.glGetAttribLocation(prog, "aPos")
        quad.position(0)
        GLES20.glEnableVertexAttribArray(loc)
        GLES20.glVertexAttribPointer(loc, 2, GLES20.GL_FLOAT, false, 0, quad)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(loc)
    }

    private fun readAsset(path: String) = ctx.assets.open(path).bufferedReader().use { it.readText() }

    private fun compile(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        val ok = IntArray(1)
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
        if (ok[0] == 0) {
            val log = GLES20.glGetShaderInfoLog(s)
            GLES20.glDeleteShader(s)
            throw RuntimeException("Shader compile error: $log")
        }
        return s
    }

    private fun buildProgram(vs: String, fs: String): Int {
        val p = GLES20.glCreateProgram()
        GLES20.glAttachShader(p, compile(GLES20.GL_VERTEX_SHADER, vs))
        GLES20.glAttachShader(p, compile(GLES20.GL_FRAGMENT_SHADER, fs))
        GLES20.glLinkProgram(p)
        val ok = IntArray(1)
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
        if (ok[0] == 0) throw RuntimeException("Program link error: " + GLES20.glGetProgramInfoLog(p))
        return p
    }

    companion object {
        private const val TAG = "Welawa"

        /** Scene පින්තූර වල හිරු උදාව / බැසීම (මිනිත්තු). */
        private const val SCENE_RISE = 375f
        private const val SCENE_SET = 1095f
        /** Lock screen එකේ අකුරු කොච්චර ලොකුද. */
        private const val LOCK_SCALE = 1.22f
        private const val LOCK_Y_SHIFT = 0.30f
        /** Battery saver resolution. */
        private const val SAVER_RES = 0.6f
        private const val MIN_SCALE = 0.5f
        private const val MAX_SCENE_W = 920f      // scene එක මීට වඩා පළල් pixel ගණනකින් අඳින්නේ නෑ (photo 768px)

        /** සීගිරි පර්වතයේ මුදුන image එකේ (උඩ සිට) තියෙන තැන. */
        private const val ROCK_TOP_Y = 0.411f
        private const val GHOST_DUR = 60f
        private const val TUK_DUR = 75f
        private const val FIRE_DUR = 1200f
        private const val CROC_PERIOD = 420f          // shader එකේ CROC_PERIOD එකට සමානයි
        private const val CROC_START = 20f
        private const val ELE_BEFORE_SUNSET = 60f   // මිනිත්තු
        private const val ELE_HERDS = 26            // 26 × 170s ≈ විනාඩි 74 (බැසීමෙන් පස්සේ ~14ක් දක්වා)
        private const val ELE_DAWN_BEFORE = 20f     // පාන්දර: උදාවට විනාඩි 20කට කලින් සිට
        private const val ELE_DAWN_HERDS = 15       // 15 × 170s ≈ විනාඩි 42

        /** Depth parallax: උපරිම විස්ථාපනය (image uv) සහ නිශ්චල තලය (පර්වතයේ depth එක). */
        private const val PARALLAX_X = 0.020f
        private const val PARALLAX_Y = 0.012f
        private const val DEPTH_FOCUS = 0.06f

        private const val FRAG_HEADER = """
            #ifdef GL_FRAGMENT_PRECISION_HIGH
            precision highp float;
            #else
            precision mediump float;
            #endif
        """

        private const val SCENE_VERT = """
            attribute vec2 aPos;
            varying vec2 vUv;
            void main() {
                vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
                gl_Position = vec4(aPos, 0.0, 1.0);
            }
        """

        private const val TEXT_VERT = """
            attribute vec2 aPos;
            uniform vec4 uRect;
            varying vec2 vT;
            void main() {
                vec2 k = aPos * 0.5 + 0.5;
                vT = vec2(k.x, 1.0 - k.y);
                gl_Position = vec4(mix(uRect.xy, uRect.zw, k), 0.0, 1.0);
            }
        """

        private const val BLIT_VERT = """
            attribute vec2 aPos;
            varying vec2 vT;
            void main() {
                vT = aPos * 0.5 + 0.5;
                gl_Position = vec4(aPos, 0.0, 1.0);
            }
        """

        private const val BLIT_FRAG = """
            precision mediump float;
            varying vec2 vT;
            uniform sampler2D uTex;
            void main() { gl_FragColor = vec4(texture2D(uTex, vT).rgb, 1.0); }
        """

        private const val TEXT_FRAG = """
            precision mediump float;
            varying vec2 vT;
            uniform sampler2D uTex;
            uniform float uAlpha;
            uniform vec3 uTint;
            void main() {
                vec4 c = texture2D(uTex, vT);
                gl_FragColor = vec4(c.rgb * uTint, c.a) * uAlpha;
            }
        """
    }
}
