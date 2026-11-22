package lk.sinhala.welawa

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

/**
 * ෆෝන් එක ඇලවෙන ප්‍රමාණය (gravity sensor) → parallax.
 * අල්ලගෙන ඉන්න ඕනම කෝණයක් "මැද" විදිහට හෙමින් ඉගෙන ගන්නවා, ඒ නිසා ඇලවීමේ වෙනස විතරයි චලනය වෙන්නේ.
 * Screen එක on වෙලා තියෙනකොට විතරයි register කරන්නේ (battery).
 */
class TiltSensor(context: Context, private val onTilt: (Float, Float) -> Unit) : SensorEventListener {

    private val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val sensor: Sensor? = sm.getDefaultSensor(Sensor.TYPE_GRAVITY)
        ?: sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var bx = Float.NaN
    private var by = 0f
    private var running = false

    fun start() {
        if (running || sensor == null) return
        running = true
        bx = Float.NaN
        sm.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        if (!running) return
        running = false
        sm.unregisterListener(this)
        onTilt(0f, 0f)
    }

    override fun onSensorChanged(e: SensorEvent) {
        val gx = e.values[0] / SensorManager.GRAVITY_EARTH
        val gy = e.values[1] / SensorManager.GRAVITY_EARTH
        if (bx.isNaN()) { bx = gx; by = gy }
        // මැද කෝණය හෙමින් අනුගමනය කරනවා (තත්පර කිහිපයකින්)
        bx += (gx - bx) * 0.012f
        by += (gy - by) * 0.012f
        val tx = ((gx - bx) * 3f).coerceIn(-1f, 1f)
        val ty = ((gy - by) * 3f).coerceIn(-1f, 1f)
        onTilt(-tx, ty)
    }

    override fun onAccuracyChanged(s: Sensor?, a: Int) {}
}
