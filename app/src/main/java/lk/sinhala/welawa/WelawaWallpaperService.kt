package lk.sinhala.welawa

import android.content.Context
import android.hardware.display.DisplayManager
import android.opengl.GLSurfaceView
import android.os.Build
import android.service.wallpaper.WallpaperService
import android.view.Choreographer
import android.view.Display
import android.view.Surface
import android.view.SurfaceHolder

class WelawaWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = GLEngine()

    inner class GLEngine : Engine() {

        private var glView: EngineGLView? = null
        private var renderer: SceneRenderer? = null
        private var tilt: TiltSensor? = null
        private var visible = false
        private var lastFrameNs = 0L
        private val choreographer = Choreographer.getInstance()

        /** FPS සීමාව (0 = සීමාවක් නෑ — display එකේ refresh rate එකටම, 120Hz දක්වා). */
        private var frameIntervalNs = 0L
        private var wantedFps = 0f
        private var seenSettings = -1
        /** ඇත්ත vsync කාලය (display එක 60/90/120Hz ද කියලා මනිනවා) */
        private var lastVsyncNs = 0L
        private var vsyncNs = 16_666_667f

        private val frameCallback = object : Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
                if (!visible) return
                applyFrameRate()
                if (lastVsyncNs != 0L) {
                    val d = (frameTimeNanos - lastVsyncNs).toFloat()
                    if (d in 4_000_000f..40_000_000f) vsyncNs += (d - vsyncNs) * 0.05f
                }
                lastVsyncNs = frameTimeNanos
                if (frameIntervalNs == 0L || frameTimeNanos - lastFrameNs >= frameIntervalNs - 2_000_000L) {
                    lastFrameNs = frameTimeNanos
                    // renderer එකට ඉලක්ක frame කාලය — adaptive resolution එකට
                    renderer?.targetFrameNs = maxOf(vsyncNs, frameIntervalNs.toFloat())
                    glView?.requestRender()
                }
                choreographer.postFrameCallback(this)
            }
        }

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            setOffsetNotificationsEnabled(true)
            val r = SceneRenderer(this@WelawaWallpaperService)
            renderer = r
            tilt = TiltSensor(this@WelawaWallpaperService) { x, y -> r.tiltX = x; r.tiltY = y }
            glView = EngineGLView(this@WelawaWallpaperService).apply {
                setEGLContextClientVersion(2)
                preserveEGLContextOnPause = true
                setRenderer(r)
                renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
            }
        }

        /**
         * Frame rate: Settings එකේ 30 / 60 / Max. Max නම් display එකේ උපරිම refresh rate එක (120Hz දක්වා)
         * surface එකට ඉල්ලනවා (Android 11+). Battery saver නම් 15fps.
         */
        private fun applyFrameRate() {
            val v = Settings.version
            if (v == seenSettings) return
            seenSettings = v
            val s = Settings.read(this@WelawaWallpaperService)
            val fps = when {
                s.batterySaver -> SAVER_FPS.toFloat()
                s.fps == Settings.FPS_MAX -> maxRefreshRate()
                else -> s.fps.toFloat()
            }
            frameIntervalNs = if (!s.batterySaver && s.fps == Settings.FPS_MAX) 0L else (1_000_000_000f / fps).toLong()
            wantedFps = fps
            requestSurfaceFrameRate()
        }

        private fun maxRefreshRate(): Float {
            val d = (getSystemService(Context.DISPLAY_SERVICE) as DisplayManager).getDisplay(Display.DEFAULT_DISPLAY)
                ?: return 60f
            val cur = d.mode
            return d.supportedModes
                .filter { it.physicalWidth == cur.physicalWidth && it.physicalHeight == cur.physicalHeight }
                .maxOfOrNull { it.refreshRate } ?: d.refreshRate
        }

        /** Android 11+: wallpaper surface එකට අපිට ඕන refresh rate එක කියනවා (120Hz phones වල 120 ලැබෙන්න). */
        private fun requestSurfaceFrameRate() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || wantedFps <= 0f) return
            try {
                val surface = surfaceHolder?.surface ?: return
                if (surface.isValid) surface.setFrameRate(wantedFps, Surface.FRAME_RATE_COMPATIBILITY_DEFAULT)
            } catch (_: Exception) {
            }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder?, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            requestSurfaceFrameRate()
        }

        override fun onVisibilityChanged(isVisible: Boolean) {
            super.onVisibilityChanged(isVisible)
            if (isVisible == visible) return
            visible = isVisible
            if (isVisible) {
                seenSettings = -1
                lastVsyncNs = 0L
                renderer?.reloadSettings()
                tilt?.start()
                glView?.onResume()
                choreographer.removeFrameCallback(frameCallback)
                choreographer.postFrameCallback(frameCallback)
            } else {
                choreographer.removeFrameCallback(frameCallback)
                tilt?.stop()
                glView?.onPause()
            }
        }

        override fun onOffsetsChanged(
            xOffset: Float, yOffset: Float, xOffsetStep: Float, yOffsetStep: Float,
            xPixelOffset: Int, yPixelOffset: Int,
        ) {
            renderer?.parallaxX = xOffset
        }

        override fun onDestroy() {
            visible = false
            choreographer.removeFrameCallback(frameCallback)
            tilt?.stop()
            glView?.release()
            glView = null
            super.onDestroy()
        }

        /** GLSurfaceView එකට wallpaper එකේ surface එක දෙන පරණ, විශ්වාසදායක ක්‍රමය. */
        inner class EngineGLView(context: Context) : GLSurfaceView(context) {
            override fun getHolder(): SurfaceHolder = surfaceHolder
            fun release() = super.onDetachedFromWindow()
        }
    }

    companion object {
        const val SAVER_FPS = 15
    }
}
