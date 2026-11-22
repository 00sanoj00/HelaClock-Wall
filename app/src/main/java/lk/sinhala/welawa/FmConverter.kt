package lk.sinhala.welawa

/**
 * Unicode සිංහල → FM (legacy) font encoding.
 *
 * FM fonts (FM Malithi, FM Abhaya, FM Derana ...) ඔක්කොම එකම mapping එක පාවිච්චි කරන නිසා
 * font/ ෆෝල්ඩර් එකේ ඕනම FM font එකක් දැම්මාම වැඩ කරනවා.
 * (DL fonts වල mapping එක වෙනස්.)
 */
object FmConverter {

    private val CONSONANTS = mapOf(
        'ක' to "l", 'ඛ' to "L", 'ග' to ".", 'ඝ' to ">", 'ච' to "p", 'ඡ' to "P",
        'ජ' to "c", 'ට' to "g", 'ඨ' to "G", 'ඩ' to "v", 'ඪ' to "V", 'ණ' to "K",
        'ත' to ";", 'ථ' to ":", 'ද' to "o", 'ධ' to "O", 'න' to "k", 'ඳ' to "|",
        'ප' to "m", 'ඵ' to "M", 'බ' to "n", 'භ' to "N", 'ම' to "u", 'ය' to "h",
        'ර' to "r", 'ල' to ",", 'ව' to "j", 'ශ' to "Y", 'ෂ' to "I", 'ස' to "i",
        'හ' to "y", 'ළ' to "<", 'ෆ' to "*",
        // render කරලා තහවුරු කළ අමතර අකුරු
        'ඹ' to "U", 'ඬ' to "~", 'ඞ' to "X", 'ඟ' to "\u00D5", 'ඣ' to "\u00AE", 'ඤ' to "[", 'ඥ' to "{",
    )

    private val INDEPENDENT_VOWELS = mapOf(
        'අ' to "w", 'ආ' to "wd", 'ඇ' to "we", 'ඈ' to "wE", 'ඉ' to "b", 'ඊ' to "B",
        'උ' to "W", 'ඌ' to "W!", 'එ' to "t", 'ඒ' to "ta", 'ඔ' to "T", 'ඕ' to "Ta",
    )

    private val SIGNS = mapOf(
        'ා' to "d", 'ැ' to "e", 'ෑ' to "E", 'ි' to "s", 'ී' to "S", 'ු' to "q",
        'ූ' to "Q", 'ෘ' to "D", '්' to "a", 'ං' to "x", 'ඃ' to "#",
    )

    /** කොම්බුව (ෙ) consonant එකට කලින් ලියවෙන ඒවා: sign → consonant එකට පස්සේ එන කොටස. */
    private val KOMBUWA_SIGNS = mapOf('ෙ' to "", 'ේ' to "a", 'ො' to "d", 'ෝ' to "da", 'ෛ' to "")

    /**
     * ඉස්පිල්ල / දීර්ඝ ඉස්පිල්ල සහිත අකුරු වලට font එකේ තියෙන සම්පූර්ණ glyphs.
     * (සාමාන්‍ය "s"/"S" glyph එක මේ අකුරු වල වැරදි තැනක වැටෙනවා — "වි" "වී" වගේ පේනවා.)
     */
    private val PRECOMPOSED = mapOf(
        "වි" to "ú", "වී" to "ù",
        "ඩි" to "ä", "ඩී" to "ã",
        "බි" to "ì", "බී" to "î",
        "ටි" to "Ü", "ටී" to "à",
        "මි" to "ï", "මී" to "ó",
        "චි" to "Ñ", "චී" to "Ö",
        "ධි" to "ê", "ධී" to "ë",
    )

    /** පාපිල්ල වෙනම හැඩයක් ගන්නා අකුරු (කු, ගු, තු, භු, ශු). */
    private val ALT_PAPILLA = setOf('ක', 'ග', 'ත', 'භ', 'ශ')

    private const val HAL = '්'
    private const val ZWJ = '‍'

    fun convert(text: String): String {
        val out = StringBuilder(text.length + 8)
        var i = 0
        val n = text.length
        while (i < n) {
            val c = text[i]
            val cons = CONSONANTS[c]
            if (cons != null) {
                var base = cons
                var conjunct = false
                i++
                // රකාරාංශය (්‍ර) සහ යංශය (්‍ය)
                if (i + 2 < n && text[i] == HAL && text[i + 1] == ZWJ) {
                    when (text[i + 2]) {
                        'ර' -> { base += "%"; conjunct = true; i += 3 }
                        'ය' -> { base += "H"; conjunct = true; i += 3 }
                    }
                }
                val sign = if (i < n) text[i] else '\u0000'
                val kombu = KOMBUWA_SIGNS[sign]
                if (kombu != null) {
                    out.append(if (sign == 'ෛ') "ff" else "f").append(base).append(kombu)
                    i++
                    continue
                }
                if (!conjunct) {
                    val pre = PRECOMPOSED["$c$sign"]
                    if (pre != null) { out.append(pre); i++; continue }
                }
                var g = SIGNS[sign]
                if (g != null) {
                    if (!conjunct && c in ALT_PAPILLA) {
                        if (sign == 'ු') g = "="
                        if (sign == 'ූ') g = "+"
                    }
                    out.append(base).append(g)
                    i++
                } else {
                    out.append(base)
                }
                continue
            }
            val v = INDEPENDENT_VOWELS[c] ?: SIGNS[c]
            when {
                v != null -> out.append(v)
                c == ZWJ -> Unit
                else -> out.append(c)
            }
            i++
        }
        return out.toString()
    }
}
