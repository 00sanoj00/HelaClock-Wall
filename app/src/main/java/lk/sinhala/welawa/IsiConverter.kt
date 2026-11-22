package lk.sinhala.welawa

/**
 * Unicode සිංහල → "Isi" legacy font encoding (IsiAbhaya, IsiDharanee ...).
 *
 * FM encoding එකට වඩා වෙනස්: consonants Y..~ පිළිවෙළට, pilla වලට Latin-1 / Windows-1252
 * අක්ෂර (උදා. ා = £, ි = Œ), සහ ගොඩක් අකුරු වලට සම්පූර්ණ (precomposed) glyphs තියෙනවා.
 * Mapping එක font file එකේ glyphs Unicode සිංහල font එකක් එක්ක image-match කරලා,
 * ඊට පස්සේ ඇසින් පරීක්ෂා කරලා හැදුවේ.
 */
object IsiConverter {

    private val CONSONANTS = mapOf(
        'ක' to "Y", 'ඛ' to "Z", 'ග' to "[", 'ඝ' to "]", 'ඞ' to "ö",
        'ච' to "a", 'ඡ' to "b", 'ජ' to "c", 'ඣ' to "„", 'ඤ' to "d", 'ඥ' to "e",
        'ට' to "f", 'ඨ' to "g", 'ඩ' to "h", 'ඪ' to "i", 'ණ' to "j", 'ඬ' to "k",
        'ත' to "l", 'ථ' to "m", 'ද' to "n", 'ධ' to "o", 'න' to "p", 'ඳ' to "q",
        'ප' to "r", 'ඵ' to "s", 'බ' to "t", 'භ' to "u", 'ම' to "v", 'ඹ' to "w",
        'ය' to "x", 'ර' to "y", 'ල' to "z", 'ව' to "{", 'ශ' to "|", 'ෂ' to "}",
        'ස' to "~", 'හ' to "ƒ", 'ළ' to "…", 'ෆ' to "‡",
        'ඟ' to "`",
    )

    private const val AELA = "£"      // ා
    private const val AEDA = "¥"      // ැ
    private const val AEDA2 = "¦"     // ෑ
    private const val ISPILLA = "Œ"   // ි
    private const val ISPILLA2 = "œ"  // ී
    private const val PAPILLA = "§"   // ු
    private const val PAPILLA2 = "ª"  // ූ
    private const val HAL_MARK = "Š"  // ්
    private const val KOMBU = "»"     // ෙ
    private const val RAKAR = "\u00AE"     // ්‍ර (රකාරාංශය)
    private const val YANSA = "³"     // ්‍ය (යංශය)

    private val INDEPENDENT_VOWELS = mapOf(
        'අ' to "R", 'ආ' to "R$AELA", 'ඇ' to "R$AEDA", 'ඈ' to "R$AEDA2",
        'ඉ' to "S", 'ඊ' to "T", 'උ' to "U", 'ඌ' to "U\u00B0", 'ඍ' to "V",
        'එ' to "W", 'ඒ' to "A", 'ඔ' to "X", 'ඕ' to "B", 'ඖ' to "X\u00B0",
    )

    private val SIGNS = mapOf(
        'ා' to AELA, 'ැ' to AEDA, 'ෑ' to AEDA2, 'ි' to ISPILLA, 'ී' to ISPILLA2,
        'ු' to PAPILLA, 'ූ' to PAPILLA2, '්' to HAL_MARK, 'ං' to "¹", 'ඃ' to "º",
    )

    /** කොම්බුව (ෙ) consonant එකට කලින්: sign → consonant එකට පස්සේ එන කොටස. */
    private val KOMBUWA_SIGNS = mapOf('ෙ' to "", 'ේ' to HAL_MARK, 'ො' to AELA, 'ෝ' to AELA + HAL_MARK, 'ෛ' to "")

    /** Font එකේ තියෙන සම්පූර්ණ අකුරු (pilla එක වෙනම දැම්මොත් වැරදි තැනක වැටෙන ඒවා). */
    private val PRECOMPOSED = mapOf(
        "කි" to "Ã", "කී" to "Ä",
        "චි" to "Ç", "චී" to "È",
        "ඡි" to "É", "ඡී" to "Ê",
        "ජි" to "Ë", "ජී" to "Ì",
        "ඤා" to "Í", "ඤු" to "Î", "ඤූ" to "Ï", "ඥා" to "Ð",
        "ටි" to "Ñ", "ටී" to "Ò",
        "ඩි" to "Õ", "ඩී" to "Ö",
        "ණි" to "Ú", "ණී" to "Û",
        "ති" to "Ü", "තී" to "Ý",
        "දු" to "ã", "දූ" to "ä",
        "දි" to "ç", "දී" to "è",
        "ධි" to "é", "ධී" to "ê",
        "නි" to "ë", "නී" to "ì",
        "බි" to "ï", "බී" to "ð",
        "මි" to "ñ", "මී" to "ò",
        "ඹි" to "ó", "ඹී" to "ô",
        "රැ" to "÷", "රෑ" to "ø",
        "රි" to "ù", "රී" to "ú",
        "ලු" to "û", "ලූ" to "ü",
        "වි" to "ý", "වී" to "þ",
        "ළු" to "†",
    )

    /** "ද්‍ර" වගේ රකාරාංශය සමග සම්පූර්ණ glyph එකක් තියෙන අකුරු. */
    private val PRECOMPOSED_RAKAR = mapOf('ද' to "æ")

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
                        'ර' -> {
                            i += 3
                            // ශ්‍රී එකට font එකේ වෙනම සම්පූර්ණ glyph එකක් තියෙනවා
                            if (c == 'ශ' && i < n && text[i] == 'ී') { out.append("Q"); i++; continue }
                            base = PRECOMPOSED_RAKAR[c] ?: (base + RAKAR); conjunct = true
                        }
                        'ය' -> { base += YANSA; conjunct = true; i += 3 }
                    }
                }
                val sign = if (i < n) text[i] else '\u0000'
                val kombu = KOMBUWA_SIGNS[sign]
                if (kombu != null) {
                    if (sign == 'ෛ') out.append(KOMBU)
                    out.append(KOMBU).append(base).append(kombu)
                    i++
                    continue
                }
                if (!conjunct) {
                    val pre = PRECOMPOSED["$c$sign"]
                    if (pre != null) { out.append(pre); i++; continue }
                }
                val g = SIGNS[sign]
                if (g != null) {
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
