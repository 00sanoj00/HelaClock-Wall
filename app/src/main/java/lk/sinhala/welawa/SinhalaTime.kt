package lk.sinhala.welawa

/**
 * වෙලාව කතා කරන සිංහලෙන් හදන තැන.
 *
 * නීති (ඕන වෙලාවක මෙතනින් වෙනස් කරන්න පුළුවන්):
 *   :00 → "එකයි"
 *   :15 → "එකයි කාලයි"
 *   :20 → "එකයි විස්සයි"
 *   :30 → "එක හමාරයි"
 *   :40 → "එකයි හතළිහයි"
 *   :50 → "දෙකට විනාඩි දහයයි"
 *   :55 → "දෙකට විනාඩි පහයි"
 *   අනිත් ඒවා → "එක පසුවී විනාඩි <X>යි"
 */
object SinhalaTime {

    enum class Period(val word: String) {
        PANDARA("පාන්දර"),
        UDE("උදේ"),
        DAHAWAL("දහවල්"),
        SAWASA("සවස"),
        RATHRI("රාත්‍රී"), // රාත්‍රී (ZWJ සමඟ)
    }

    /** වෙලාව අනුව කාල කොටස (මිනිත්තු, දවසේ 0..1439). */
    fun periodOf(minuteOfDay: Int): Period = when (minuteOfDay) {
        in 240 until 360 -> Period.PANDARA   // 4:00 – 6:00
        in 360 until 720 -> Period.UDE       // 6:00 – 12:00
        in 720 until 840 -> Period.DAHAWAL   // 12:00 – 2:00
        in 840 until 1110 -> Period.SAWASA   // 2:00 – 6:30
        else -> Period.RATHRI                // 6:30 – 4:00
    }

    private val HOUR = arrayOf(
        "", "එක", "දෙක", "තුන", "හතර", "පහ", "හය",
        "හත", "අට", "නවය", "දහය", "එකොළහ", "දොළහ",
    )
    private val ONES = arrayOf("", "එක", "දෙක", "තුන", "හතර", "පහ", "හය", "හත", "අට", "නවය")
    private val TEENS = arrayOf(
        "දහය", "එකොළහ", "දොළහ", "දහතුන", "දාහතර",
        "පහළොව", "දහසය", "දාහත", "දහඅට", "දහනවය",
    )
    private val TENS_WHOLE = arrayOf("", "", "විස්ස", "තිහ", "හතළිහ", "පනහ")
    private val TENS_PREFIX = arrayOf("", "", "විසි", "තිස්", "හතළිස්", "පනස්")

    /** 1..59 → "පහ", "විසි පහ", "හතළිහ" ... */
    fun number(n: Int): String = when {
        n < 10 -> ONES[n]
        n < 20 -> TEENS[n - 10]
        n % 10 == 0 -> TENS_WHOLE[n / 10]
        else -> TENS_PREFIX[n / 10] + " " + ONES[n % 10]
    }

    private fun to12(h24: Int): Int = (h24 % 12).let { if (it == 0) 12 else it }

    /** පෙන්වන text එක: උඩ පොඩි පේළිය + ලොකු පේළිය. */
    data class Phrase(val top: String, val main: String) {
        val full: String get() = "$top $main"
    }

    fun phrase(hour24: Int, minute: Int): Phrase {
        val period = periodOf(hour24 * 60 + minute)
        val h = HOUR[to12(hour24)]
        val next = HOUR[to12((hour24 + 1) % 24)]
        val body = when (minute) {
            0 -> "${h}යි"
            15 -> "${h}යි කාලයි"
            20, 40 -> "${h}යි ${number(minute)}යි"
            30 -> "$h හමාරයි"
            50, 55 -> "${next}ට විනාඩි ${number(60 - minute)}යි"
            else -> "$h පසුවී විනාඩි ${number(minute)}යි"
        }
        return Phrase("වේලාව", "${period.word} $body")
    }
}
