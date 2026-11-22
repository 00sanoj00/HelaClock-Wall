// සීගිරිය පසුබිම: photo + depth parallax + ජීවමාන effects + සිනමා පෙනුම.
// (precision header + common.glsl එක Kotlin එකෙන් ඉස්සරහට එකතු වෙනවා)

varying vec2 vUv;               // screen uv (0,0 = උඩ වම)

uniform sampler2D uImgA;
uniform sampler2D uImgB;
uniform sampler2D uMask;        // R = අහස, G = පොකුණ, B = depth (1 = ළඟ)
uniform float uMix;
uniform vec2  uScale;           // screen uv → image uv
uniform vec2  uOffset;
uniform float uTime;            // තත්පර
uniform float uAspect;          // image height / width (isotropic noise සඳහා)

uniform float uDawn;
uniform float uMorning;
uniform float uNoon;
uniform float uEvening;
uniform float uNight;

uniform vec3  uCloudTint;
uniform float uCloudAmt;
uniform vec3  uMistTint;
uniform vec2  uSunPos;
uniform vec3  uSunCol;
uniform float uSunAmt;
uniform float uAmbient;
uniform float uTextY;           // text එකේ මැද (screen uv y)
uniform vec2  uPar;             // depth parallax විස්ථාපනය (image uv, depth 1 ට)
uniform float uFocus;           // චලනය නොවන depth එක (පර්වතය)
uniform vec2  uMoonPos;         // සඳ (image uv)
uniform vec2  uMoonRefl;        // සඳ ජලයේ (image uv)
uniform float uCine;            // 1 = සිනමා පෙනුම
uniform float uEarlyMist;       // පාන්දර/උදෑසන ඝන මීදුම (0..1)
uniform float uWind;            // සුළඟේ ශක්තිය (0..1, දහවල් තදයි)
uniform float uRain;            // වැස්ස (0..1)
uniform float uStorm;           // තද සුළඟ (0..1)
uniform float uWindT;           // සුළං කාලය (තත්පර, තද සුළඟට වේගයෙන් ගලනවා)
uniform float uScrAspect;       // screen height / width
uniform float uMoonAge;         // සඳේ වයස 0..1 (0.5 = පසළොස්වක)
uniform float uThunder;         // අකුණු 0..1
uniform float uRainbow;         // දේදුන්න 0..1
uniform float uPoya;            // පොහොය දිනය (පහන්)
uniform float uVesak;           // වෙසක් කාලය (කූඩු)
uniform float uAvurudu;         // අවුරුදු කාලය (එරබදු මල්)
uniform float uGhostT;          // හොල්මන් සීන් එක (රෑ 12:00 සිට තත්පර, -1 = නෑ)
uniform float uTukT;            // ත්‍රීවීල් එක (දවසට වරක්, තත්පර, -1 = නෑ)
uniform float uTukColor;        // 0 කහ, 1 කොළ, 2 මෙරූන්, 3 නිල්
uniform float uFireT;           // අලුත් අවුරුදු ගිනිකෙළි (ජනවාරි 1 මධ්‍යම රාත්‍රියේ සිට තත්පර, -1 = නෑ)
uniform float uCrocShift;       // කිඹුලාගේ චක්‍රය (debug එකට shift)
uniform float uAprilFool;       // අප්‍රේල් 1: රෝස අලියා
uniform float uEleT;            // අලි රංචුව: හිරු බැසීමට විනාඩි 30කට කලින් සිට තත්පර (-1 = නෑ)

#define MOON_R 0.027

float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

vec3 hue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

// වඳුරා (පැනීමේ ඉරියව්ව) — q: ශරීර ප්‍රමාණයෙන්, +x ඉදිරියට, +y පහළට
float monkey(vec2 q, float st) {
    float body = smoothstep(1.0, 0.8, length(q * vec2(1.0 / (1.0 + 0.35 * st), 1.7)));
    float head = smoothstep(0.42, 0.30, length(q - vec2(1.05 + 0.3 * st, -0.28)));
    float arm  = smoothstep(0.16, 0.08, sdSeg(q, vec2(0.55, 0.05), vec2(1.45 + 0.5 * st, 0.15 - 0.55 * st)));
    float leg  = smoothstep(0.17, 0.09, sdSeg(q, vec2(-0.6, 0.15), vec2(-1.35 - 0.45 * st, 0.45 - 0.2 * st)));
    float tail = smoothstep(0.10, 0.04, min(sdSeg(q, vec2(-0.8, -0.1), vec2(-1.9, -0.7)), sdSeg(q, vec2(-1.9, -0.7), vec2(-2.2, -0.25))));
    return max(max(max(body, head), max(arm, leg)), tail);
}

// මොනරා (සිනමාත්මක) — q: ශරීර ප්‍රමාණයෙන්, ඉදිරිය +x, +y පහළට, කකුල් අග y = 1.15
// disp: 0 = පිල් අදිනවා .. 1 = විදහලා; walk: පියවර phase; wAmt: ඇවිදීමේ ප්‍රමාණය; peck: බිම කොටනවා 0..1
vec4 peacock(vec2 q, float disp, float t, float walk, float wAmt, float peck) {
    float aa = 0.08;                                     // ~pixel එකක් (මෘදු දාර)
    vec4 o = vec4(0.0);

    // ---- විදහපු පිල් කලඹ: පිහාටු 34ක්, ඇස් (ocelli) පේළි 3ක්, අග හිරු එළියට රන්වන්, වෙව්ලනවා
    if (disp > 0.01) {
        vec2 fq = q - vec2(-0.40, 0.15);
        fq.y *= 1.06;
        float fr = length(fq);
        float R = 3.0 * disp;
        float spread = 0.15 + 1.40 * disp;
        float fa = atan(fq.x, -fq.y);
        fa += sin(t * 36.0 + fr * 5.0) * 0.010 * smoothstep(0.5, 1.0, fr / max(R, 0.01)) * disp;   // පිල් සොලවනවා
        if (fr < R + 0.3 && abs(fa) < spread + 0.12 && fq.y < 0.7) {
            float nF = 56.0;
            float fpos = (fa + spread) / (2.0 * spread) * nF;
            float fi = floor(fpos);
            float fu = fract(fpos);
            float rn = fr / max(R, 1e-3);
            float tipR = R * (0.94 + 0.06 * sin(fu * 3.14159));                 // වටකුරු පිහාටු අග
            float edge = smoothstep(tipR + aa, tipR - aa, fr)
                       * smoothstep(spread + 0.05, spread - 0.05, abs(fa));
            vec3 c = mix(vec3(0.07, 0.20, 0.08), vec3(0.42, 0.40, 0.13), rn * 0.8);
            c *= 0.70 + 0.45 * noise(vec2(fr * 14.0, fa * 90.0));               // සියුම් රෝම (barbs) — සමාන නෑ
            c *= 0.80 + 0.20 * smoothstep(0.0, 0.10, abs(fu - 0.5));            // මැද කටුව (rachis)
            float arcW = 2.0 * spread / nF * fr;                                // එක පිහාටුවක පළල
            for (int k = 0; k < 3; k++) {
                float fk = float(k);
                float rk = 0.91 - fk * 0.19 - mod(fi, 2.0) * 0.09 + (hash(vec2(fi, fk)) - 0.5) * 0.05;
                float er = 0.085 * R * (1.0 - fk * 0.15) * (0.9 + 0.2 * hash(vec2(fk, fi)));
                vec2 e = vec2((fu - 0.5 + (hash(vec2(fi, fk + 7.0)) - 0.5) * 0.15) * arcW, fr - rk * R) / er;
                float d = length(e * vec2(1.25, 0.85));
                vec3 ec = mix(vec3(0.02, 0.05, 0.22), vec3(0.04, 0.42, 0.55), smoothstep(0.28, 0.40, d));   // තද නිල් හදවත → තුර්කි
                ec = mix(ec, vec3(0.55, 0.38, 0.12), smoothstep(0.50, 0.60, d));                          // ලෝකඩ වළල්ල
                ec = mix(ec, c, smoothstep(0.72, 0.90, d));
                c = mix(c, ec, smoothstep(1.0, 0.80, d) * smoothstep(0.25, 0.45, rk));   // ශරීරය ළඟ ඇස් නෑ
            }
            // iridescence: බලන කෝණය අනුව කොළ ↔ රන් දිලිසීම, අග හිරු එළිය වදිනවා (backlight)
            c *= 0.85 + 0.35 * pow(max(sin(fa * 2.3 + fr * 0.8 + t * 0.25), 0.0), 3.0);
            c += uSunCol * uSunAmt * 0.30 * smoothstep(0.80, 1.0, rn) * vec3(1.0, 0.85, 0.45);
            c *= mix(0.80, 1.0, rn);                                            // ශරීරය ළඟ සෙවණ
            o = vec4(c, edge);
        }
    }

    // ---- අදින පිල් කලඹ: උකුලේ සිට බිමට වැටිලා දිගට, ඇස් තිත් පේළියක් සමග
    vec2 tA = vec2(-0.50, 0.05), tM = vec2(-1.75, 0.70), tB = vec2(-3.05, 1.05);
    float d1 = sdSeg(q, tA, tM), d2 = sdSeg(q, tM, tB);
    float onSecond = step(d2, d1);
    vec2 sa = mix(tA, tM, onSecond), sb = mix(tM, tB, onSecond);
    float sk = clamp(dot(q - sa, sb - sa) / dot(sb - sa, sb - sa), 0.0, 1.0);
    float tk = (sk + onSecond) * 0.5;                                           // 0 උකුල → 1 අග
    float tw = mix(0.30, 0.09, tk);
    vec2 axisP = mix(sa, sb, sk);
    float train = smoothstep(aa, -aa, min(d1, d2) - tw) * (1.0 - smoothstep(0.0, 0.35, disp));
    float across = (q.y - axisP.y) / tw;                                       // -1 උඩ .. 1 යට
    vec3 trc = mix(vec3(0.14, 0.32, 0.12), vec3(0.38, 0.36, 0.12), tk);
    float spot = smoothstep(0.55, 0.20, length(vec2((fract(tk * 11.0) - 0.5) * 1.6, across * 0.8)));
    trc = mix(trc, vec3(0.03, 0.10, 0.32), spot * 0.55 * step(0.18, tk));
    trc *= mix(1.15, 0.62, smoothstep(-1.0, 1.0, across));                     // උඩ එළිය, යට සෙවණ
    trc *= 0.80 + 0.35 * noise(vec2(tk * 60.0, across * 4.0));                // දිගට පිහාටු ඉරි
    o = mix(o, vec4(trc, 1.0), train);

    // ---- කකුල් (ඇවිදිනවා, දණහිස නැවෙනවා)
    float legs = 0.0;
    for (int i = 0; i < 2; i++) {
        float ph = walk + float(i) * 3.14159;
        vec2 hip = vec2(0.02 + float(i) * 0.12, 0.30);
        vec2 foot = vec2(hip.x + sin(ph) * 0.20 * wAmt, 1.15 - max(cos(ph), 0.0) * 0.10 * wAmt);
        vec2 knee = mix(hip, foot, 0.5) + vec2(0.07, 0.0);
        legs = max(legs, smoothstep(0.055, 0.025, min(sdSeg(q, hip, knee), sdSeg(q, knee, foot))));
    }
    o = mix(o, vec4(vec3(0.46, 0.40, 0.34), 1.0), legs);

    // ---- ශරීරය (බිත්තර හැඩය, ඉදිරිය උස්): ලෝකඩ-කොළ කොරපොතු පිට, ඉරි තියෙන පියාපත, දුඹුරු ප්‍රාථමික පිහාටු
    vec2 bq = rot2(q, -0.30);
    vec2 bn = bq / vec2(0.62, 0.40);
    float bl = length(bn);
    float body = smoothstep(1.0 + aa * 1.8, 1.0 - aa * 1.8, bl);
    vec3 bc = vec3(0.18, 0.34, 0.13) * (0.85 + 0.15 * sin(bq.x * 38.0) * sin(bq.y * 38.0));
    float wingZone = smoothstep(0.75, 0.4, length((bn - vec2(-0.15, 0.10)) / vec2(0.85, 0.55)));
    vec3 bar = mix(vec3(0.70, 0.60, 0.42), vec3(0.14, 0.11, 0.08), step(0.5, fract(bq.x * 7.0 + bq.y * 2.0)));
    bc = mix(bc, bar, wingZone * 0.55);
    bc = mix(bc, vec3(0.55, 0.28, 0.10), smoothstep(0.55, 0.95, -bn.x) * smoothstep(-0.2, 0.4, bn.y) * 0.8);
    bc *= mix(1.18, 0.55, smoothstep(-0.9, 0.9, bn.y));                         // උඩින් එළිය
    o = mix(o, vec4(bc, 1.0), body);

    // ---- බෙල්ල + හිස (ඇවිදින විට ඉදිරියට පිටුපසට, කොටන විට බිමට)
    float bob = sin(walk * 2.0) * 0.06 * wAmt;
    vec2 hp = mix(vec2(0.68 + bob, -1.12), vec2(1.15, 0.92), peck);
    vec2 nb = vec2(0.36, -0.12);
    vec2 nm = mix(vec2(0.56 + bob * 0.5, -0.62), vec2(0.95, 0.30), peck);
    float n1 = sdSeg(q, nb, nm), n2 = sdSeg(q, nm, hp);
    float nk = n2 < n1 ? 0.5 + 0.5 * clamp(dot(q - nm, hp - nm) / dot(hp - nm, hp - nm), 0.0, 1.0)
                       : 0.5 * clamp(dot(q - nb, nm - nb) / dot(nm - nb, nm - nb), 0.0, 1.0);
    float neck = smoothstep(aa, -aa, min(n1, n2) - mix(0.19, 0.075, nk));
    float head = smoothstep(0.12 + aa * 0.5, 0.12 - aa * 0.5, length(q - hp));
    // දිලිසෙන නිල් බෙල්ල: කෝණය අනුව නිල් ↔ කොළ-නිල් මාරු වෙනවා, එක පැත්තක highlight
    vec3 nc = vec3(0.04, 0.20, 0.62);
    float sheen = 0.5 + 0.5 * sin(q.x * 6.0 - q.y * 4.0 + t * 0.35);
    nc = mix(nc, vec3(0.05, 0.48, 0.58), sheen * 0.45);
    nc += vec3(0.10, 0.25, 0.40) * smoothstep(0.02, -0.06, sdSeg(q, nb + vec2(0.06, -0.05), hp + vec2(0.04, -0.02)) - 0.06) * 0.6;
    o = mix(o, vec4(nc, 1.0), max(neck, head));
    // මූණේ සුදු ඉරි + හොට
    float face = smoothstep(0.045, 0.015, abs(length(q - hp - vec2(0.02, 0.0)) - 0.07)) * step(hp.x + 0.0, q.x) * head;
    o.rgb = mix(o.rgb, vec3(0.92, 0.92, 0.88), face * 0.8);
    vec2 bk = hp + mix(vec2(0.20, 0.03), vec2(0.10, 0.18), peck);
    float beak = smoothstep(0.04, 0.015, sdSeg(q, hp + vec2(0.08, 0.0), bk));
    o = mix(o, vec4(0.55, 0.50, 0.42, 1.0), beak);
    // කිරුළ: කූරු 5ක්, අග නිල් තිත්
    float crest = 0.0;
    for (int i = 0; i < 5; i++) {
        float fi = float(i) - 2.0;
        vec2 ct = hp + rot2(vec2(0.0, -0.34), fi * 0.16 - 0.15 + peck * 1.2);
        crest = max(crest, smoothstep(0.025, 0.008, sdSeg(q, hp + vec2(0.0, -0.08), ct)) * 0.8);
        crest = max(crest, smoothstep(0.055, 0.03, length(q - ct)));
    }
    o = mix(o, vec4(0.06, 0.24, 0.62, 1.0), crest);
    return o;
}

// වෙසක් කූඩුව — q: කූඩුවේ ප්‍රමාණයෙන්
vec4 lantern(vec2 q, vec3 c1, vec3 c2, float fl) {
    float body = smoothstep(1.0, 0.9, max(abs(q.x) * 0.95 + abs(q.y) * 0.5, abs(q.y) * 1.08));
    vec3 c = mix(c1, c2, step(0.0, sin(q.x * 5.0 + q.y * 2.0)));
    c *= 0.75 + 0.6 * exp(-dot(q, q) * 1.5) * fl;                     // ඇතුළේ පහන
    float tas = step(0.88, q.y) * step(q.y, 2.3) * step(abs(q.x), 0.75)
              * smoothstep(0.16, 0.05, abs(fract(q.x * 2.2 + 0.5) - 0.5)) * (1.0 - (q.y - 0.88) / 1.6);
    float str = smoothstep(0.05, 0.02, abs(q.x)) * step(q.y, -0.85) * step(-6.0, q.y);
    vec4 o = vec4(c, body);
    o = mix(o, vec4(mix(c1, c2, 0.5) * 0.9, 1.0), tas * (1.0 - body));
    o = mix(o, vec4(0.08, 0.06, 0.05, 1.0), str * 0.8 * (1.0 - body));
    return o;
}

// ---------------------------------------------------------------- අලුත් සතුන් / ස්වභාවය

// ත්‍රිකෝණයක් පුරවනවා (මෘදු දාර)
float triFill(vec2 p, vec2 a, vec2 b, vec2 c) {
    float s = sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    vec2 e0 = b - a, e1 = c - b, e2 = a - c;
    float d0 = s * (e0.x * (p.y - a.y) - e0.y * (p.x - a.x)) / max(length(e0), 1e-4);
    float d1 = s * (e1.x * (p.y - b.y) - e1.y * (p.x - b.x)) / max(length(e1), 1e-4);
    float d2 = s * (e2.x * (p.y - c.y) - e2.y * (p.x - c.x)) / max(length(e2), 1e-4);
    return smoothstep(-0.015, 0.025, min(min(d0, d1), d2));
}

// පැත්තෙන් පේන කුරුල්ලා (ගිරවා, පිළිහුඩුවා) — q: ප්‍රමාණයෙන්, හිස +x, +y පහළට, flap -1..1
float sideBird(vec2 q, float flap, float bodyH, float tailL, float beakL) {
    float body = smoothstep(1.0, 0.7, length(q / vec2(0.5, bodyH)));
    float head = smoothstep(bodyH + 0.02, bodyH - 0.05, length(q - vec2(0.46, -0.07)));
    float beak = smoothstep(0.05, 0.015, sdSeg(q, vec2(0.58, -0.06), vec2(0.58 + beakL, -0.01)));
    vec2 te = vec2(-0.38 - tailL, 0.04 + tailL * 0.08);
    float tk = clamp(dot(q - vec2(-0.38, 0.0), te - vec2(-0.38, 0.0)) / dot(te - vec2(-0.38, 0.0), te - vec2(-0.38, 0.0)), 0.0, 1.0);
    float tail = smoothstep(0.02, 0.0, sdSeg(q, vec2(-0.38, 0.0), te) - mix(0.07, 0.015, tk));   // අගට සිහින් වෙනවා
    // පියාපත: උරහිසේ සිට අගට පළල් ත්‍රිකෝණයක් (ගහනකොට උඩ/යට)
    vec2 tip = vec2(-0.22 - 0.10 * abs(flap), -0.04 - flap * 0.95);
    float wing = triFill(q, vec2(0.20, -0.06), vec2(-0.26, -0.03), tip);
    return max(max(body, head), max(max(beak, tail), wing));
}

// රාජාලියා / බමුණු පියා (යටින් පේන, පාවෙන) — q: පියාපත් අඩ දිග = 1, ඉදිරිය -y
// span: පියාපත් දිග (පියාපත් ගහනකොට කෙටි වෙනවා), bank: -1..1 (ඇල වෙද්දී එක පියාපතක් කෙටි වෙනවා)
// trans: පිහාටු හරහා එළිය එන කොටස (backlight)
vec4 eagle(vec2 q, float span, float bank, out float trans) {
    float aa = 0.035;
    float side = q.x < 0.0 ? -1.0 : 1.0;
    float fs = 1.0 - 0.30 * max(bank * side, 0.0);
    vec2 w = vec2(q.x / (span * fs), q.y);
    float ax = abs(w.x);
    // ඉදිරි දාරය (මැණික් කටුව ළඟ ඉදිරියට), පසු දාරය (මැදින් පුළුල්, අතට එනකොට පටු)
    float le = -0.12 + 0.06 * ax - 0.05 * exp(-pow((ax - 0.48) / 0.14, 2.0));
    float te = 0.15 + 0.06 * sin(min(ax, 0.8) / 0.8 * 3.14159) - 0.08 * smoothstep(0.55, 0.95, ax);
    te += 0.018 * abs(sin(ax * 42.0)) * (1.0 - smoothstep(0.70, 0.80, ax));      // ද්විතීයික පිහාටු අග (දත් වගේ)
    float inWing = smoothstep(le - aa, le + aa, w.y) * smoothstep(te + aa, te - aa, w.y);
    float u = clamp((w.y - le) / max(te - le, 0.01), 0.0, 1.0);      // 0 ඉදිරිය → 1 පිටුපස
    // අතේ ප්‍රාථමික පිහාටු "ඇඟිලි" 6ක්, අතර හිඩැස්
    float fpos = u * 5.0;
    float fid = floor(fpos);
    float fu = fract(fpos);
    float hand = smoothstep(0.78, 0.86, ax);
    float taper = smoothstep(0.78, 1.0, ax);                                      // ඇඟිලි අගට සිහින් වෙනවා
    float slot = smoothstep(0.5 - 0.12 * taper, 0.40 - 0.20 * taper, abs(fu - 0.5));
    float fingerLen = 0.99 - 0.09 * abs(fid - 1.6) / 2.4 + 0.02 * sin(fid * 2.7);
    float wing = inWing * mix(1.0, slot, hand) * smoothstep(fingerLen + aa, fingerLen - aa, ax);
    float body = smoothstep(1.0, 0.82, length((q - vec2(0.0, 0.02)) / vec2(0.10, 0.33)));
    float head = smoothstep(0.095, 0.065, length(q - vec2(0.0, -0.35)));
    vec2 tq = q - vec2(0.0, 0.26);
    float tail = smoothstep(aa, -aa, abs(tq.x) - (0.07 + max(tq.y, 0.0) * 0.32))
               * smoothstep(-0.03, 0.02, tq.y) * smoothstep(aa, -aa, length(tq * vec2(0.75, 1.0)) - 0.36);
    float a = max(max(wing, body), max(head, tail));
    // පාට: තඹ-දුඹුරු පියාපත්, පිහාටු ඉරි, පසු දාරය තද, අතේ ලා "කවුළුව", කළු අග
    vec3 c = vec3(0.52, 0.25, 0.10) * (0.85 + 0.3 * noise(w * vec2(18.0, 30.0)));   // යට පියාපත් පිහාටු (කැළැල්)
    c *= 0.86 + 0.14 * sin(w.x * 80.0) * smoothstep(0.45, 0.9, u) * (1.0 - hand); // පිහාටු ඉරි
    c = mix(c, vec3(0.30, 0.15, 0.07), smoothstep(0.75, 1.0, u) * (1.0 - hand));
    // ප්‍රාථමික පිහාටු: පාමුල ලා (එළිය යන "කවුළුව"), අග කළු
    float prim = smoothstep(0.60, 0.70, ax);
    c = mix(c, vec3(0.58, 0.42, 0.28), prim * smoothstep(0.86, 0.74, ax) * 0.45);
    c = mix(c, vec3(0.05, 0.04, 0.035), smoothstep(0.80, 0.90, ax));
    // සුදු හිස සහ පපුව (සියුම් ඉරි)
    float wh = max(head, smoothstep(1.0, 0.65, length((q - vec2(0.0, -0.18)) / vec2(0.10, 0.21))));
    c = mix(c, vec3(0.88, 0.86, 0.80) * (0.95 + 0.05 * noise(q * 60.0)), wh * (1.0 - step(0.12, abs(q.x)) * wing));
    c = mix(c, vec3(0.56, 0.30, 0.13), tail * (1.0 - body));
    trans = wing * (smoothstep(0.50, 1.0, u) * 0.6 + prim * smoothstep(0.86, 0.74, ax) * 1.4) + tail * 0.5;
    return vec4(c, a);
}

// නෙළුම / මානෙල් මල (පැත්තෙන්) — q: ප්‍රමාණයෙන්, +y පහළට (පාමුල y = 0.4), open 0..1
vec4 waterFlower(vec2 q, float open, vec3 tipC, vec3 baseC) {
    vec2 b = q - vec2(0.0, 0.40);
    float a = 0.0;
    vec3 c = baseC;
    for (int i = 0; i < 5; i++) {
        float fi = float(i) - 2.0;
        vec2 p = rot2(b, fi * mix(0.10, 0.36, open));
        float wdt = 0.22 * (1.0 - 0.18 * abs(fi));
        vec2 e = (p - vec2(0.0, -0.46)) / vec2(wdt, 0.48);
        float pe = smoothstep(1.0, 0.8, length(e) + abs(e.x) * max(-e.y, 0.0) * 0.7);   // උල් අග
        float front = 1.0 - 0.25 * step(1.5, abs(fi));                                   // පිටුපස පෙති අඳුරුයි
        vec3 pc = mix(baseC, tipC, smoothstep(0.4, -0.8, e.y)) * front;
        c = mix(c, pc, pe * step(a, pe + 0.001));
        a = max(a, pe);
    }
    // මල විවෘත වුණාම මැද කහ රේණු
    float st = smoothstep(0.13, 0.06, length((q - vec2(0.0, 0.0)) / vec2(1.0, 0.6))) * open;
    c = mix(c, vec3(1.0, 0.80, 0.20), st * 0.9);
    return vec4(c, a);
}

// මාළුවා (ජලයෙන් පනින) — q: ප්‍රමාණයෙන්, හිස +x
float fishShape(vec2 q) {
    float body = smoothstep(1.0, 0.75, length(q / vec2(0.62, 0.22)));
    vec2 tq = q - vec2(-0.62, 0.0);
    float tail = step(-0.32, tq.x) * step(tq.x, 0.04) * smoothstep(0.03, 0.0, abs(tq.y) - (0.04 - tq.x * 0.75));
    return max(body, tail);
}

// ---- අලියා (3D හැඩැති) — කොටස් වටකුරු හැඩවලින්, ආලෝකය + සෙවණ + සම texture
// සිලින්ඩරයක් (කකුල, හොඬවැල, වලිගය): x = mask, y = ආලෝකය, z = දාරයේ rim
vec3 eleCyl(vec2 q, vec2 a, vec2 b, float wa, float wb, float aa, vec3 ld) {
    vec2 ba = b - a;
    float h = clamp(dot(q - a, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 p = q - (a + ba * h);
    float w = mix(wa, wb, h);
    float m = smoothstep(aa, -aa, length(p) - w);
    vec2 side = normalize(vec2(-ba.y, ba.x));
    float tt = clamp(dot(p, side) / w, -1.0, 1.0);
    vec3 n = vec3(side * tt, sqrt(max(1.0 - tt * tt, 0.0)));
    float rim = pow(1.0 - n.z, 2.0) * max(dot(side * sign(tt), normalize(ld.xy)), 0.0);
    return vec3(m, max(dot(n, ld), 0.0), rim);
}
// ඉලිප්සාකාර ගෝලයක් (ශරීරය, හිස)
vec3 eleBlob(vec2 q, vec2 c, vec2 r, float aa, vec3 ld) {
    vec2 p = (q - c) / r;
    float l = length(p);
    float e = aa / min(r.x, r.y);
    float m = smoothstep(1.0 + e, 1.0 - e, l);
    vec3 n = normalize(vec3(p * vec2(r.y / r.x, 1.0), sqrt(max(1.0 - l * l, 0.0))));
    float rim = pow(1.0 - n.z, 2.0) * max(dot(normalize(p + 1e-5), normalize(ld.xy)), 0.0);
    return vec3(m, max(dot(n, ld), 0.0), rim);
}

// q: ප්‍රමාණයෙන්, හිස +x, +y පහළට, කකුල් අග y = 1.0; aa: pixel එකක ප්‍රමාණය (q ඒකක);
// ld: ආලෝකය එන දිශාව (local, y පහළට). rgb = පාට (ආලෝකය එක්ක), a = mask
vec4 elephant(vec2 q, float walk, float sway, float drink, float aa, vec3 ld) {
    vec3 skin = vec3(0.30, 0.255, 0.22);                               // අළු-දුඹුරු සම (ලංකාවේ අලි — රතු පස් ගෑවිලා)
    vec3 mud = vec3(0.40, 0.26, 0.17);
    vec4 o = vec4(0.0);
    q.y += abs(sin(walk)) * 0.035;                                     // පියවරෙන් පියවර ශරීරය සෙලවෙනවා
    float tex = 0.88 + 0.24 * noise(q * vec2(9.0, 13.0)) + 0.06 * sin(q.x * 70.0 + q.y * 30.0);   // සමේ රැළි
    // ---- කකුල් 4: 0 ළඟ පසු, 1 ඈත පසු, 2 ළඟ ඉදිරි, 3 ඈත ඉදිරි (විකර්ණ යුගල එකට)
    for (int pass = 0; pass < 2; pass++) {
        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float far = mod(fi, 2.0);
            if ((pass == 0) != (far > 0.5)) continue;
            float lx = fi < 1.0 ? -0.50 : fi < 2.0 ? -0.34 : fi < 3.0 ? 0.40 : 0.55;
            float ph = walk + ((fi < 1.0 || fi > 2.5) ? 0.0 : 3.14159);
            vec2 hip = vec2(lx, 0.18);
            // ඉදිරියට යද්දී කකුල උස්සලා (cos > 0), ආපහු බිම තියලා පස්සට තල්ලු කරනවා
            float lift = max(cos(ph), 0.0);
            vec2 foot = vec2(lx + sin(ph) * 0.22, 1.0 - lift * 0.12);
            vec2 knee = mix(hip, foot, 0.55) + vec2(0.03 + lift * 0.07, -lift * 0.03);
            vec3 l1 = eleCyl(q, hip, knee, 0.15, 0.13, aa, ld);
            vec3 l2 = eleCyl(q, knee, foot, 0.13, 0.12, aa, ld);
            float m = max(l1.x, l2.x);
            float lit = l1.x > l2.x ? l1.y : l2.y;
            vec3 c = mix(skin, mud, smoothstep(0.45, 0.95, q.y) * 0.7) * tex;
            c *= (0.32 + 0.65 * lit) * (far > 0.5 ? 0.60 : 1.0);        // ඈත කකුල් සෙවණේ
            c *= 0.85 + 0.15 * sin(q.y * 45.0);                        // කකුලේ රැළි
            o = vec4(mix(o.rgb, c, m), max(o.a, m));
        }
        if (pass == 0) {
            // ---- ශරීරය + පිට උස
            vec3 b1 = eleBlob(q, vec2(0.0, 0.05), vec2(0.80, 0.50), aa, ld);
            vec3 b2 = eleBlob(q, vec2(-0.12, -0.18), vec2(0.52, 0.32), aa, ld);
            float m = max(b1.x, b2.x);
            float lit = max(b1.y * b1.x, b2.y * b2.x);
            float rim = max(b1.z * b1.x, b2.z * b2.x);
            vec3 c = skin * tex * (0.32 + 0.70 * lit);
            c *= mix(1.0, 0.55, smoothstep(0.15, 0.55, q.y));          // බඩ යට සෙවණ
            c = mix(c, mud * (0.40 + 0.6 * lit), smoothstep(0.35, 0.55, q.y) * 0.35);
            c += vec3(1.0, 0.78, 0.55) * rim * 0.25;
            // වලිගය (ශරීරයට පිටුපසින්)
            vec3 tl = eleCyl(q, vec2(-0.78, -0.05), vec2(-0.86 + sway * 0.03, 0.45), 0.035, 0.02, aa, ld);
            o = vec4(mix(o.rgb, skin * 0.7 * (0.5 + 0.6 * tl.y), tl.x), max(o.a, tl.x));
            o = vec4(mix(o.rgb, c, m), max(o.a, m));
        }
    }
    // ---- හිස (බොනකොට පහත් වෙනවා)
    vec2 hc = vec2(0.80, -0.12 + 0.10 * drink);
    vec3 hd = eleBlob(q, hc, vec2(0.32, 0.34), aa, ld);
    vec3 cH = skin * tex * (0.34 + 0.70 * hd.y) + vec3(1.0, 0.78, 0.55) * hd.z * 0.22;
    o = vec4(mix(o.rgb, cH, hd.x), max(o.a, hd.x));
    // ---- කන (පැතලි, ටිකක් අඳුරු, දාරය ලා, හිමින් සෙලවෙනවා)
    float flap = 0.92 + 0.08 * sin(walk * 0.7 + sway);
    vec2 ep = (q - (hc + vec2(-0.20, 0.13))) / vec2(0.19 * flap, 0.31);
    float el = length(ep);
    float ear = smoothstep(1.0 + aa * 4.0, 1.0 - aa * 4.0, el);
    vec3 cE = skin * tex * (0.45 + 0.20 * ep.y) * mix(0.85, 1.12, smoothstep(0.7, 1.0, el));
    o = vec4(mix(o.rgb, cE, ear), max(o.a, ear));
    // ---- හොඬවැල (වළලු සහිතව, බොනකොට වතුරට)
    vec2 t0 = hc + vec2(0.22, 0.12), t1 = vec2(1.08 + sway * 0.06 + 0.10 * drink, 0.48 + 0.25 * drink);
    vec2 t2 = vec2(1.0 + sway * 0.12 + 0.12 * drink, 0.80 + 0.50 * drink);
    vec3 tr1 = eleCyl(q, t0, t1, 0.11, 0.075, aa, ld);
    vec3 tr2 = eleCyl(q, t1, t2, 0.075, 0.05, aa, ld);
    float tm = max(tr1.x, tr2.x);
    float tlit = tr1.x > tr2.x ? tr1.y : tr2.y;
    vec3 cT = skin * tex * (0.32 + 0.70 * tlit) * (0.82 + 0.18 * sin(q.y * 80.0));
    o = vec4(mix(o.rgb, cT, tm), max(o.a, tm));
    // ---- ඇස
    float eye = smoothstep(0.05, 0.02, length((q - hc - vec2(0.10, -0.04)) / vec2(1.0, 0.7)));
    o.rgb = mix(o.rgb, vec3(0.05, 0.04, 0.03), eye * hd.x);
    return o;
}

// දිය පිපිරීම (පිළිහුඩුවා / මාළුවා) — p: ජලය ස්පර්ශ වූ තැන, age: තත්පර, sz: උස (image uv)
float splash(vec2 uv, vec2 p, float age, float sz) {
    if (age < 0.0 || age > 0.9) return 0.0;
    vec2 isq = vec2(1.0, uAspect);
    float a = 0.0;
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float vx = (fi - 3.0) / 3.0 * 0.9 + (hash(vec2(fi, p.x * 97.0)) - 0.5) * 0.5;
        float vy = 2.0 + hash(vec2(fi, p.y * 53.0)) * 1.6;
        vec2 off = vec2(vx * age, -vy * age + 4.6 * age * age) * sz;
        if (off.y > 0.0) continue;                                        // ආයෙත් ජලයට වැටුණා
        float r = length((uv - p - off) * isq) / (sz * 0.10);
        a += smoothstep(1.0, 0.2, r) * (1.0 - age / 0.9);
    }
    vec2 f = (uv - p) * isq / (sz * vec2(0.9, 0.35 * uAspect));
    a += smoothstep(1.0, 0.3, length(f)) * exp(-age * 4.0) * 0.8;          // පෙණ
    vec2 col = (uv - p) * isq / (sz * vec2(0.18, 1.0));                    // උඩට විසිවෙන දිය කඳ
    a += smoothstep(1.0, 0.4, length(col + vec2(0.0, 0.6 * smoothstep(0.0, 0.25, age)))) * exp(-age * 7.0);
    return clamp(a, 0.0, 1.0);
}

// ජලයේ රවුම් රැළි (සිදුවීමකින්) — c: screen ට සමාන image uv
void eventRipple(vec2 c, float age, float amp, vec2 uv, float water, inout vec2 ripple, inout float ringLight) {
    if (age < 0.0 || age > 3.2) return;
    vec2 d = (uv - c) * vec2(1.0, uAspect * 3.0);
    float r = length(d);
    float ph = age / 3.2;
    for (int k = 0; k < 2; k++) {
        float R = age * 0.040 - float(k) * 0.018;
        if (R < 0.0) continue;
        float wave = sin((r - R) * 360.0) * exp(-pow((r - R) * 60.0, 2.0)) * (1.0 - ph) * (1.0 - ph);
        ripple += (d / max(r, 1e-4)) * vec2(1.0, 0.35) * wave * 0.005 * amp * water;
        ringLight += max(wave, 0.0) * 1.2 * amp;
    }
}

// ---- පිළිහුඩුවාගේ චක්‍රය (ගහෙන් → ජලයට උඩින් පාවෙනවා → කිමිදෙනවා → ඉගිලෙනවා)
#define KF_PERIOD 29.0
#define KF_DIVE 3.7
#define KF_UP 4.3
#define KF_END 6.9
vec2 kfWater(float c) { return vec2(0.37 + 0.24 * hash(vec2(c, 81.0)), 0.755 + 0.065 * hash(vec2(c, 82.0))); }
float kfOn(float c) { return step(0.25, hash(vec2(c, 83.0))); }
vec2 kfPos(float c, float s) {
    vec2 W = kfWater(c);
    vec2 H = W - vec2(0.0, 0.05);
    float side = hash(vec2(c, 84.0)) > 0.5 ? 1.0 : -1.0;
    vec2 S0 = vec2(0.5 + side * 0.30, 0.69);
    vec2 E = vec2(0.5 - side * 0.50, 0.58);
    if (s < 2.2) { float k = smoothstep(0.0, 1.0, s / 2.2); return mix(S0, H, k) - vec2(0.0, sin(k * 3.14159) * 0.03); }
    if (s < 3.4) return H + vec2(sin(s * 9.0) * 0.0012, sin(s * 13.0) * 0.0009);
    if (s < KF_DIVE) { float k = (s - 3.4) / (KF_DIVE - 3.4); return mix(H, W, k * k); }
    if (s < KF_UP) return W;
    float k = clamp((s - KF_UP) / (KF_END - KF_UP), 0.0, 1.0);
    return mix(W, E, k) - vec2(0.0, sin(k * 1.6) * 0.05);
}

// ---- මාළු පැනීම
#define FISH_PERIOD 8.5
#define FISH_JUMP 0.6
vec2 fishSpot(float c) { return vec2(0.33 + 0.33 * hash(vec2(c, 91.0)), 0.745 + 0.10 * hash(vec2(c, 92.0))); }
float fishDir(float c) { return hash(vec2(c, 93.0)) > 0.5 ? 1.0 : -1.0; }

// ---------------------------------------------------------------- මිනිස්සු (ඈතින් පේන)
// පාරක් (ලක්ෂ්‍ය 5) දිගේ d දුරක් (iso ඒකක) ගිය තැන
vec2 path5(float d, vec2 p0, vec2 p1, vec2 p2, vec2 p3, vec2 p4) {
    vec2 isq = vec2(1.0, uAspect);
    float l0 = length((p1 - p0) * isq), l1 = length((p2 - p1) * isq);
    float l2 = length((p3 - p2) * isq), l3 = length((p4 - p3) * isq);
    if (d < l0) return mix(p0, p1, d / l0);
    d -= l0;
    if (d < l1) return mix(p1, p2, d / l1);
    d -= l1;
    if (d < l2) return mix(p2, p3, d / l2);
    d -= l2;
    return mix(p3, p4, clamp(d / l3, 0.0, 1.0));
}
float path5Len(vec2 p0, vec2 p1, vec2 p2, vec2 p3, vec2 p4) {
    vec2 isq = vec2(1.0, uAspect);
    return length((p1 - p0) * isq) + length((p2 - p1) * isq) + length((p3 - p2) * isq) + length((p4 - p3) * isq);
}

// ඈතින් පේන මිනිහෙක් — q: උසින් (කකුල් අග y = 0, හිස මුදුන y = -1), ඉදිරිය +x
// x = ඇඳුම, y = සම (හිස/අත්), z = කකුල්, w = පන්දම් කූර
vec4 person(vec2 q, float walk, float torch) {
    float aa = 0.07;
    float sw = sin(walk);
    vec2 hip = vec2(0.0, -0.47);
    float legs = min(sdSeg(q, hip, vec2(sw * 0.13, 0.0)), sdSeg(q, hip, vec2(-sw * 0.13, 0.0)));
    float legA = smoothstep(0.065 + aa, 0.065 - aa * 0.5, legs);
    float body = smoothstep(0.11 + aa, 0.11 - aa * 0.5, sdSeg(q, vec2(0.0, -0.50), vec2(0.01, -0.79)));
    vec2 sh = vec2(0.0, -0.77);
    vec2 hand2 = mix(vec2(sw * 0.12, -0.50), vec2(0.13, -0.97), torch);     // පන්දම අල්ලන් ඉන්න අත උඩට
    float arms = min(sdSeg(q, sh, vec2(-sw * 0.12, -0.50)), sdSeg(q, sh, hand2));
    float armA = smoothstep(0.045 + aa, 0.045 - aa * 0.5, arms);
    float head = smoothstep(0.085 + aa, 0.085 - aa * 0.5, length(q - vec2(0.02, -0.89)));
    float stick = torch * smoothstep(0.03 + aa * 0.6, 0.0, sdSeg(q, hand2, hand2 + vec2(0.04, -0.26)));
    return vec4(body, max(head, armA), legA, stick);
}

// ---------------------------------------------------------------- ඔරුව (පොකුණේ)
// පොකුණේ මතුපිට (ලෝකය) රවුමක් දිගේ යනවා; ඉහළ සිට බලන නිසා screen එකේ ඉලිප්සයක් (BOAT_SQ).
#define BOAT_SQ 0.45
#define BOAT_LH 0.017            // අඩ දිග (iso)
#define BOAT_WH 0.0032           // අඩ පළල
#define BOAT_HH 0.0012           // දාරයේ උස
// k = 0 උදේ ඔරුව (දෙදෙනා හබල් ගහනවා), 1 රෑ ඔරුව (හිමින්, ඉස්සරහ පන්දම)
float boatTime(float t);
float boatAng(float t, float k) {
    t = boatTime(t);
    return k < 0.5 ? t * 0.055 + sin(t * 0.031) * 0.6 : -(t * 0.035 + sin(t * 0.023) * 0.5) + 2.0;
}
vec2 boatPos(float a, float k) {
    vec2 c = k < 0.5 ? vec2(0.505, 0.790) : vec2(0.515, 0.782);
    float R = k < 0.5 ? 0.12 : 0.105;
    return c + vec2(cos(a), sin(a) * BOAT_SQ / uAspect) * R;
}
vec2 boatFwd(float a, float k) { return (k < 0.5 ? 1.0 : -1.0) * vec2(-sin(a), cos(a)); }   // ලෝක තලයේ දිශාව
// ලෝක තලයේ ලක්ෂ්‍යයක් → screen (iso) offset, උස z
vec2 boatScr(vec2 w, float z) { return vec2(w.x, w.y * BOAT_SQ - z); }
// ඔරුවේ කඳ (lens හැඩය, දෙකෙළවර උල්) — l: (දිගට, හරහට) ලෝක ඒකක
float boatLens(vec2 l, float wScale) {
    float x = l.x / BOAT_LH;
    float hw = BOAT_WH * wScale * pow(max(1.0 - x * x, 0.0), 0.7);
    float aa = 0.0005;
    return smoothstep(aa, -aa, abs(l.y) - hw) * smoothstep(1.0, 0.96, abs(x));
}

// ---------------------------------------------------------------- easter eggs
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// ---- කිඹුලා: CROC_PERIOD එකකට වරක්, ඔරුවක් යනකොට ළඟින් මතු වෙනවා → ඔරුව දෙගුණ වේගයෙන් හබල් ගහනවා
#define CROC_PERIOD 420.0
#define CROC_START 20.0
#define CROC_DUR 16.0
// ඔරුවේ "කාලය": කිඹුලා පේනකොට (තත්පර 10ක්) දෙගුණ වේගයෙන් යනවා
float boatTime(float t) {
    float tc = t + uCrocShift;
    float n = floor(tc / CROC_PERIOD);
    float ph = tc - n * CROC_PERIOD;
    return t + n * 10.0 + clamp(ph - (CROC_START + 4.0), 0.0, 10.0);
}

// ---- හොල්මන (මෝහිනී) — q: උසින් (y = 0 ගවුමේ පහළ, -1 හිස මුදුන), +x ඉදිරිය; wave 0..1 = අත වනනවා
// rgb = පාට, a = විනිවිදභාවය. සුදු සාරියක් වගේ ගවුම: රැලි, උරහිසේ පොට, ඉරිතැලුණු පාවෙන අග, දිලිසෙන දාරය,
// සුදුමැලි මූණ (ගිලුණු අඳුරු ඇස්, "ඕ" කට), මූණ වටේ වැටෙන දිගු කළු කොණ්ඩ ගස්.
vec4 ghostShape(vec2 q, float t, float wave) {
    float aa = 0.02;
    float yy = clamp((q.y + 0.78) / 0.78, 0.0, 1.0);                  // 0 උරහිස → 1 පහළ
    float sway = 0.06 * sin(t * 1.3 + q.y * 3.0) * yy;
    float qx = q.x - sway + 0.10 * yy * yy;                             // ගමන් කරන දිශාවට පිටුපසට පාවෙනවා
    float w = mix(0.12, 0.31, yy) + 0.025 * sin(q.y * 14.0 + t * 3.0);
    float hem = -0.03 + 0.07 * sin(q.x * 25.0 + t * 4.0) + 0.05 * sin(q.x * 47.0 - t * 5.0) + 0.04 * sin(q.x * 9.0 + t * 1.7);
    float side = w - abs(qx);                                           // දාරයට දුර (ඇතුළ +)
    float gown = smoothstep(-aa, aa, side) * step(-0.80, q.y) * smoothstep(hem + 0.07, hem - 0.07, q.y);
    gown *= mix(1.0, 0.15, smoothstep(-0.40, 0.03, q.y));               // පහළට විනිවිද වෙලා මීදුමට මැකෙනවා
    // ගවුමේ රැලි (සිරස් folds) + ළය / ඉණ හැඩය
    float folds = 0.84 + 0.16 * sin(qx * 38.0 + sin(q.y * 6.0 + t) * 1.5) * yy;
    float waist = smoothstep(0.03, 0.0, abs(q.y + 0.50)) * 0.12;
    // සාරියේ පොට: වම් උරහිසේ සිට දකුණු ඉණට, දාරයේ සිහින් ඉරක්
    float pal = sdSeg(q, vec2(-0.08, -0.74), vec2(0.17, -0.40));
    float pallu = smoothstep(0.07, 0.05, pal) * step(-0.78, q.y);
    float palEdge = smoothstep(0.012, 0.0, abs(pal - 0.06)) * step(-0.78, q.y);
    vec3 c = vec3(0.84, 0.90, 1.0) * folds - waist;
    c = mix(c, vec3(0.93, 0.97, 1.0), pallu * 0.6);
    c = mix(c, vec3(0.60, 0.72, 0.88), palEdge * 0.7);
    // දිලිසෙන දාරය (හොල්මන් එළිය)
    c += vec3(0.25, 0.40, 0.55) * smoothstep(0.06, 0.0, side) * gown;
    float a = gown;
    // අත්: වම පහළට, දකුණ වනනවා (දිගු ඇඟිලි 3ක්)
    vec2 sh = vec2(0.09, -0.72);
    vec2 hand = mix(vec2(0.17, -0.40), vec2(0.30, -1.02 + 0.06 * sin(t * 9.0)), wave);
    vec2 el = mix(mix(sh, hand, 0.5) + vec2(0.04, 0.03), vec2(0.27, -0.80), wave);
    float arm = smoothstep(0.030 + aa, 0.030 - aa, min(sdSeg(q, sh, el), sdSeg(q, el, hand)));
    float fing = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i) - 1.0;
        vec2 fd = mix(vec2(0.03 * fi, 0.09), vec2(0.035 * fi + 0.02 * sin(t * 9.0 + fi), -0.10), wave);
        fing = max(fing, smoothstep(0.014, 0.004, sdSeg(q, hand, hand + fd)));
    }
    float arm2 = smoothstep(0.030 + aa, 0.030 - aa, sdSeg(q, vec2(-0.09, -0.72), vec2(-0.16 + 0.02 * sin(t), -0.40)));
    float arms = max(max(arm, arm2), fing);
    c = mix(c, vec3(0.80, 0.86, 0.95), arms);
    a = max(a, arms * 0.9);
    // හිස / මූණ
    vec2 fq = (q - vec2(0.01, -0.88)) / vec2(0.080, 0.100);
    float head = smoothstep(1.0 + aa * 10.0, 1.0 - aa * 10.0, length(fq));
    vec3 face = vec3(0.82, 0.88, 0.94) * (0.85 + 0.15 * smoothstep(0.8, -0.5, fq.y));   // සුදුමැලි, නිකට පැත්ත අඳුරු
    float eyeL = length((q - vec2(0.038, -0.895)) / vec2(0.020, 0.026));
    float eyeR = length((q - vec2(-0.012, -0.895)) / vec2(0.020, 0.026));
    float eyes = smoothstep(1.0, 0.55, min(eyeL, eyeR));
    face = mix(face, vec3(0.04, 0.05, 0.09), eyes);
    face += vec3(0.6, 0.85, 1.0) * smoothstep(0.35, 0.0, min(eyeL, eyeR)) * 0.6;          // ඇස් ඇතුළේ සීතල දිලිසීමක්
    float mouth = smoothstep(1.0, 0.6, length((q - vec2(0.015, -0.835)) / vec2(0.014, 0.020)));
    face = mix(face, vec3(0.06, 0.05, 0.08), mouth);
    c = mix(c, face, head);
    a = max(a, head);
    // කොණ්ඩය: මූණ දෙපැත්තෙන් වැටෙන ගස් + පිටුපසට සුළඟේ පාවෙන දිගු ගස් 4ක්
    float hair = smoothstep(1.0, 0.75, length((q - vec2(-0.01, -0.94)) / vec2(0.105, 0.075)));   // හිස මුදුන
    hair = max(hair, smoothstep(0.030, 0.012, sdSeg(q, vec2(0.075, -0.93), vec2(0.085 + 0.01 * sin(t * 2.0), -0.70))));   // මූණ ඉදිරියෙන්
    hair = max(hair, smoothstep(0.030, 0.012, sdSeg(q, vec2(-0.075, -0.93), vec2(-0.08, -0.68))));
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 h1 = vec2(-0.04 - fi * 0.015, -0.95 + fi * 0.02);
        vec2 h2 = vec2(-0.17 - fi * 0.04 + 0.05 * sin(t * 1.7 + fi), -0.62 + fi * 0.04);
        vec2 h3 = vec2(-0.28 - fi * 0.06 + 0.09 * sin(t * 1.9 + fi * 1.3), -0.30 + fi * 0.05);
        float wdt = 0.040 - fi * 0.006;
        float dd = min(sdSeg(q, h1, h2), sdSeg(q, h2, h3) + 0.012);
        hair = max(hair, smoothstep(wdt, wdt * 0.4, dd) * (1.0 - fi * 0.12));
    }
    vec3 hc = vec3(0.025, 0.025, 0.04) + vec3(0.05, 0.08, 0.12) * smoothstep(0.0, -1.0, q.y) * 0.5;  // කොණ්ඩයේ සීතල sheen
    c = mix(c, hc, hair);
    a = max(a, hair);
    return vec4(c, a);
}

// ---- ත්‍රීවීල් එක (Bajaj හැඩය, පැත්තෙන්) — q: උසින් (y = 0 බිම, -1 වහලය), +x ඉදිරිය; body = බොඩි පාට
// වටකුරු පිටුපස බොඩිය, ඉදිරියට නෙරපු නාසය + ඒ මැද ලයිට් එක, ඇල වින්ඩ්ස්ක්‍රීන්, ඉදිරියට එල්ලෙන කළු වහලය,
// පිටුපස කැන්වස් කොටස + පොඩි ජනේලය, විවෘත පැත්ත (රියදුරු හැන්ඩලය අල්ලන් + මගීන්), ක්‍රෝම් ඉර, ලංකාවේ stripe, කණ්ණාඩිය
vec4 tukShape(vec2 q, vec3 body, float night, float t) {
    float aa = 0.025;
    vec4 o = vec4(0.0);
    vec3 bodyHi = body * 1.25 + 0.06;
    vec3 shadeBody = body * mix(1.20, 0.62, smoothstep(-0.62, -0.12, q.y));
    // ---- ඇතුළ (පිටුපස බිත්තිය අඳුරු) — විවෘත පැත්තෙන් පේනවා
    float cabin = smoothstep(aa, -aa, sdBox(q - vec2(-0.02, -0.75), vec2(0.56, 0.18)));
    vec3 cc = vec3(0.05, 0.045, 0.045);
    // මගීන් (පිටුපස ආසනයේ) + රියදුරු (ඉදිරියේ, හැන්ඩලය අල්ලන්)
    float pas = max(smoothstep(0.070, 0.050, length(q - vec2(-0.30, -0.81))), smoothstep(aa, -aa, sdBox(q - vec2(-0.30, -0.65), vec2(0.09, 0.10)) - 0.02));
    pas = max(pas, max(smoothstep(0.065, 0.045, length(q - vec2(-0.12, -0.80))), smoothstep(aa, -aa, sdBox(q - vec2(-0.12, -0.65), vec2(0.08, 0.10)) - 0.02)) * 0.85);
    float drv = max(smoothstep(0.070, 0.050, length(q - vec2(0.32, -0.83))), smoothstep(aa, -aa, sdBox(q - vec2(0.30, -0.67), vec2(0.07, 0.10)) - 0.02));
    float drvArm = smoothstep(0.03, 0.012, sdSeg(q, vec2(0.33, -0.72), vec2(0.50, -0.66)));
    cc = mix(cc, vec3(0.22, 0.15, 0.12), clamp(pas, 0.0, 1.0));
    cc = mix(cc, vec3(0.80, 0.80, 0.76), clamp(drv, 0.0, 1.0) * step(-0.78, q.y));   // රියදුරුගේ සුදු කමිසය
    cc = mix(cc, vec3(0.25, 0.17, 0.12), clamp(drv, 0.0, 1.0) * step(q.y, -0.78));   // හිස
    cc = mix(cc, vec3(0.30, 0.20, 0.14), drvArm);
    o = mix(o, vec4(cc, 1.0), cabin);
    // ---- පිටුපස වටකුරු "බාත් ටබ්" බොඩිය (මගී ආසනය යට)
    float lower = smoothstep(aa, -aa, sdBox(q - vec2(-0.40, -0.39), vec2(0.30, 0.12)) - 0.17);
    // මැද රියදුරුගේ පහත් තට්ටුව (පැත්තෙන් කකුල් පේනවා)
    float floorB = smoothstep(aa, -aa, sdBox(q - vec2(0.28, -0.25), vec2(0.30, 0.07)) - 0.04);
    float legs = smoothstep(0.035, 0.015, min(sdSeg(q, vec2(0.30, -0.62), vec2(0.46, -0.50)), sdSeg(q, vec2(0.46, -0.50), vec2(0.48, -0.34))));
    o = mix(o, vec4(0.12, 0.10, 0.10, 1.0), legs);
    // ඉදිරි නාසය: උස, පටු, ඉදිරියට ඇල වෙලා වටකුරු
    vec2 nq = rot2(q - vec2(0.72, -0.40), -0.20);
    float nose = smoothstep(aa, -aa, sdBox(nq, vec2(0.08, 0.26)) - 0.07);
    float bodyM = max(max(lower, nose), floorB);
    // ඉදිරි රෝදයට උඩින් mudguard එක
    float guard = smoothstep(aa, -aa, abs(length(q - vec2(0.66, -0.11)) - 0.15) - 0.03) * step(q.y, -0.10) * step(0.50, q.x);
    bodyM = max(bodyM, guard);
    vec3 bc = shadeBody;
    float onRear = lower * (1.0 - nose);
    bc += vec3(0.30) * smoothstep(0.015, 0.0, abs(q.y + 0.30)) * onRear;                              // ක්‍රෝම් ඉර
    bc = mix(bc, vec3(0.92, 0.92, 0.88), smoothstep(0.03, 0.012, abs(q.y + 0.46)) * onRear * 0.85);  // සුදු stripe
    bc = mix(bc, vec3(0.85, 0.12, 0.10), smoothstep(0.014, 0.005, abs(q.y + 0.41)) * onRear * 0.85); // රතු සිහින් ඉර
    bc += vec3(0.14) * smoothstep(0.10, 0.0, abs(length((q - vec2(-0.40, -0.39)) / vec2(1.0, 0.6)) - 0.30)) * onRear * smoothstep(-0.2, -0.6, q.y);  // වටකුරු දිලිසීම
    bc += vec3(0.18) * smoothstep(0.06, 0.0, abs(nq.x - 0.02)) * nose * smoothstep(-0.2, 0.1, -nq.y);   // නාසයේ දිලිසීම
    o = mix(o, vec4(bc, 1.0), bodyM);
    // ---- වින්ඩ්ස්ක්‍රීන් (ඇල, ඉදිරියේ)
    float glass = smoothstep(aa, -aa, sdBox(rot2(q - vec2(0.64, -0.78), -0.35), vec2(0.035, 0.17)));
    vec3 gc = mix(vec3(0.55, 0.70, 0.80) + 0.15 * smoothstep(-0.9, -0.7, q.y), vec3(0.10, 0.12, 0.16), night);
    o = mix(o, vec4(gc, 1.0), glass);
    // ---- කළු වහලය: ඉදිරියට එල්ලෙනවා, පිටුපසට වටකුරු වෙලා කැන්වස් කොටසට
    float roof = smoothstep(aa, -aa, sdBox(q - vec2(-0.05, -0.965), vec2(0.66, 0.035)) - 0.04);
    float rear = smoothstep(aa, -aa, sdBox(q - vec2(-0.70, -0.80), vec2(0.10, 0.15)) - 0.10);
    float roofM = max(roof, rear);
    vec3 rc = vec3(0.06, 0.06, 0.07) + vec3(0.18) * smoothstep(-0.97, -1.02, q.y);                 // උඩ දිලිසීම
    rc = mix(rc, vec3(0.25, 0.28, 0.32), smoothstep(aa, -aa, sdBox(q - vec2(-0.70, -0.82), vec2(0.05, 0.07)) - 0.02) * rear);   // පිටුපස ජනේලය
    o = mix(o, vec4(rc, 1.0), roofM);
    // කණ්ණාඩිය
    float mir = max(smoothstep(0.012, 0.004, sdSeg(q, vec2(0.60, -0.70), vec2(0.72, -0.82))), smoothstep(0.035, 0.02, length((q - vec2(0.74, -0.84)) / vec2(1.0, 1.4))));
    o = mix(o, vec4(0.15, 0.15, 0.16, 1.0), mir);
    // ---- රෝද (ටයර් + රිම් + කැරකෙන spokes)
    for (int i = 0; i < 2; i++) {
        vec2 wc = i == 0 ? vec2(-0.55, -0.12) : vec2(0.66, -0.11);
        float r = i == 0 ? 0.12 : 0.11;
        vec2 wq = q - wc;
        float wl = length(wq);
        float tire = smoothstep(r + aa, r - aa, wl);
        float rim = smoothstep(r * 0.55, r * 0.45, wl);
        float spoke = smoothstep(0.35, 0.0, abs(sin(atan(wq.y, wq.x) * 2.5 + t * 14.0))) * rim;
        vec3 wcol = mix(vec3(0.04), vec3(0.55, 0.56, 0.58), rim);
        wcol = mix(wcol, vec3(0.25), spoke * 0.6);
        float hidden = (i == 0) ? smoothstep(-0.20, -0.17, q.y) : 1.0;          // පිටුපස රෝදය බොඩියෙන් ටිකක් වැහෙනවා
        o = mix(o, vec4(wcol, 1.0), tire * mix(1.0, hidden, lower));
    }
    // ---- ලයිට්: ඉදිරි ලයිට් එක නාසය මැද; signal; පිටුපස රතු ලයිට් (රෑට දිලිසෙනවා)
    float hl = smoothstep(0.055, 0.03, length(q - vec2(0.80, -0.46)));
    float ind = smoothstep(0.025, 0.012, length(q - vec2(0.76, -0.60)));
    float tl = smoothstep(0.035, 0.015, length(q - vec2(-0.84, -0.40)));
    o = mix(o, vec4(mix(vec3(0.95, 0.93, 0.80), vec3(2.4, 2.2, 1.5), night), 1.0), hl);
    o = mix(o, vec4(1.0, 0.55, 0.10, 1.0), ind);
    o = mix(o, vec4(mix(vec3(0.6, 0.1, 0.1), vec3(2.0, 0.25, 0.2), night), 1.0), tl);
    return o;
}

// වැහි ඉරි layer එකක් (screen space). sp = (x, y*aspect), y පහළට වැඩි වෙනවා.
float rainLayer(vec2 sp, float scale, float len, float speed, float width, float density, float t) {
    vec2 p = vec2(sp.x * scale, sp.y * scale / len - t * speed);
    vec2 id = floor(p);
    vec2 f = fract(p);
    float h = hash(id);
    if (h > density) return 0.0;
    float x = 0.15 + 0.7 * hash(id + 3.7);
    float y0 = hash(id + 9.1) * 0.4;
    float line = smoothstep(width, 0.0, abs(f.x - x));
    float seg = smoothstep(y0, y0 + 0.12, f.y) * smoothstep(y0 + 0.62, y0 + 0.30, f.y);
    return line * seg * (0.55 + 0.45 * hash(id + 1.3));
}

vec3 sceneAt(vec2 p) { return mix(texture2D(uImgA, p).rgb, texture2D(uImgB, p).rgb, uMix); }

// image uv ලක්ෂ්‍යයක depth එක (සතුන් depth එක අනුව ලොකු/පොඩි කරන්න)
float depthAt(vec2 p) { return texture2D(uMask, p).b; }

void main() {
    float moonIll = 0.5 - 0.5 * cos(6.2831853 * uMoonAge);
    vec2 suv = vUv;
    vec2 uv  = suv * uScale + uOffset;          // image uv
    // ---- depth parallax: ළඟ දේවල් වැඩියෙන් චලනය වෙනවා (inverse warp, iterate කරලා)
    vec2 uvw = uv;
    for (int i = 0; i < 4; i++) {
        float dz = texture2D(uMask, uvw).b;
        uvw = uv - uPar * (dz - uFocus);
    }
    vec4 mk = texture2D(uMask, uvw);
    float sky = mk.r;
    float water = mk.g;
    float sceneZ = mk.b;
    float t = uTime;
    vec2 iso = vec2(1.0, uAspect);              // image uv → සමාන පරිමාණ
    float day = uMorning + uNoon + uEvening * 0.6;
    float calm0 = (1.0 - uRain) * (1.0 - uStorm);
    float kfAmt = (uMorning + uNoon + uEvening * 0.6) * calm0;          // පිළිහුඩුවා
    // ඔරුවල කාලය: උදේ ඔරුව (පාන්දර සිට උදේ), රෑ ඔරුව (පන්දමක් එක්ක)
    float boatDayAmt = clamp(uMorning + uDawn * 0.6, 0.0, 1.0) * (1.0 - uRain) * (1.0 - uStorm);
    float boatNightAmt = clamp(uNight * 1.2 - 0.1, 0.0, 1.0) * (1.0 - uRain) * (1.0 - uStorm * 0.8);
    vec3 splashC = mix(vec3(0.50, 0.55, 0.60), vec3(0.95, 0.97, 1.0), uAmbient);

    // ---- සුළඟට ගස් පැද්දෙන එක: දහවල් තද සුළඟ, ළඟ ගස් වැඩියෙන්, සුළං රැලි කැලෑව හරහා යනවා
    vec2 sway = vec2(0.0);
    float nearZ = smoothstep(0.14, 0.85, sceneZ);
    if (uWind > 0.01 && nearZ > 0.001) {
        // මෘදු mask එක (taps 4ක්): අහස/පොකුණ දාර ළඟ ඉරිතැලීම් නැතුව කොළ විතරක් චලනය වෙන්න
        vec2 e = vec2(0.007, 0.007 / uAspect);
        vec2 q0 = uvw + vec2(-e.x, -e.y), q1 = uvw + vec2(e.x, -e.y);
        vec2 q2 = uvw + vec2(-e.x,  e.y), q3 = uvw + vec2(e.x,  e.y);
        vec4 m0 = texture2D(uMask, q0), m1 = texture2D(uMask, q1);
        vec4 m2 = texture2D(uMask, q2), m3 = texture2D(uMask, q3);
        float open = 1.0 - clamp((m0.r + m1.r + m2.r + m3.r) * 0.25 + (m0.g + m1.g + m2.g + m3.g) * 0.25 * 1.6, 0.0, 1.0);
        vec3 c0 = texture2D(uImgA, q0).rgb + texture2D(uImgA, q1).rgb
                + texture2D(uImgA, q2).rgb + texture2D(uImgA, q3).rgb;
        float grn = smoothstep(0.0, 0.10, (c0.g - max(c0.r, c0.b) * 0.93) / (dot(c0, vec3(0.33)) + 0.15));
        // ගහේ මුදුන් (උඩින් අහස තියෙන තැන්) වැඩියෙන් පැද්දෙනවා, පාමුල අඩුවෙන්
        float skyAbove = texture2D(uMask, uvw - vec2(0.0, 0.045)).r + texture2D(uMask, uvw - vec2(0.0, 0.09)).r * 0.5;
        float top = mix(0.65, 1.35, clamp(skyAbove, 0.0, 1.0));
        float leaf = open * mix(0.22, 1.0, grn) * mix(0.30, 1.0, nearZ) * top;

        // සුළං රැල්ල (gust) වමේ සිට දකුණට කැලෑව හරහා යනවා
        float gust = smoothstep(0.30, 0.85, noise(vec2(uv.x * 2.4 - uWindT * (0.55 + uRain * 0.3), uv.y * 1.5 + uWindT * 0.03)));
        gust = 0.30 + 0.70 * gust;
        // තද සුළඟේ හමන පිඹුම් (තත්පර කීපයකට වරක් ගස් එකපාරටම නැවෙනවා)
        float blast = smoothstep(0.35, 0.9, noise(vec2(uv.x * 1.2 - uWindT * 1.1, 3.7)));
        gust = mix(gust, 0.6 + 0.9 * blast, uStorm);
        // ගස් ඇලවීම (සුළං දිශාවට) + ගහෙන් ගහට වෙනස් වේගයෙන් පැද්දීම + කොළ සෙලවීම
        float lean = gust * (0.55 + uRain * 0.35 + uStorm * 0.9);
        float treeId = noise(uv * vec2(9.0, 9.0 * uAspect));             // එක ගහක් එකට චලනය වෙන්න
        float freq = 1.0 + treeId * 0.8;
        float rock = sin(uWindT * freq * 1.6 + treeId * 6.28) * 0.55
                   + (noise(vec2(uv.x * 5.0 + uWindT * 0.7, uv.y * 4.0 - uWindT * 0.2)) - 0.5) * 0.8;
        float flut = noise(vec2(uv.x * 160.0, uv.y * 160.0 * uAspect) + vec2(uWindT * 4.2, uWindT * 2.6)) - 0.5;
        float amp = 0.0058 * (1.0 + uStorm * 0.9);
        float bendX = (lean + rock * gust) * amp + flut * 0.0016 * (0.5 + gust) * (1.0 + uStorm);
        float bendY = abs(rock) * gust * 0.0013 * (1.0 + uStorm) + flut * 0.0010;
        sway = vec2(bendX, bendY) * leaf * uWind;
    }

    // ---- පොකුණ: සුළං රැළි (කැළැල් වශයෙන් යනවා) + මාළු පනින රවුම් රැළි
    vec2 ripple = vec2(0.0);
    float ringLight = 0.0;
    if (water > 0.001) {
        float gustW = smoothstep(0.35, 0.8, noise(uv * vec2(6.0, 18.0) + vec2(t * 0.09, t * 0.02)));
        float amp = (0.55 + 0.9 * gustW) * (1.0 + uStorm * 2.2);
        float n1 = noise(vec2(uv.x * 38.0 - uWindT * 0.25, uv.y * 170.0 - uWindT * 1.1));
        float n2 = noise(vec2(uv.x * 95.0 + uWindT * 0.45, uv.y * 320.0 + uWindT * 1.6));
        float sw = sin(uv.y * 420.0 - t * 2.2 + sin(uv.x * 30.0 + t * 0.7) * 2.0);   // දිගු තරංග
        ripple = vec2((n1 - 0.5) * 0.0050 + (n2 - 0.5) * 0.0020 + sw * 0.0007, (n1 - 0.5) * 0.0013) * water * amp;
        // රවුම් රැළි (3ක් එකවර)
        for (int k = 0; k < 3; k++) {
            float fk = float(k);
            float period = 4.5 + fk * 1.7;
            float tt = t + fk * 2.9;
            float cyc = floor(tt / period);
            float ph = fract(tt / period);
            vec2 rc = vec2(0.28 + 0.56 * hash(vec2(cyc, fk + 1.0)), 0.73 + 0.13 * hash(vec2(fk + 4.0, cyc)));
            vec2 d = (uv - rc) * vec2(1.0, uAspect * 3.2);          // perspective: තිරස් ඉලිප්සයක්
            float r = length(d);
            float R = ph * 0.055;
            float wave = sin((r - R) * 420.0) * exp(-pow((r - R) * 70.0, 2.0)) * (1.0 - ph) * (1.0 - ph);
            float inPond = step(0.5, texture2D(uMask, rc).g);
            ripple += (d / max(r, 1e-4)) * vec2(1.0, 0.35) * wave * 0.0035 * water * inPond;
            ringLight += max(wave, 0.0) * inPond;
        }
        // පිළිහුඩුවා කිමිදුණු තැනින් සහ මාළුවා පැනපු තැන් වලින් රැළි
        {
            float kc = floor(t / KF_PERIOD);
            float ks = t - kc * KF_PERIOD;
            vec2 W = kfWater(kc);
            if (kfAmt > 0.05 && kfOn(kc) > 0.5 && texture2D(uMask, W).g > 0.5) {
                W += uPar * (depthAt(W) - uFocus);
                eventRipple(W, ks - KF_DIVE, 1.3 * kfAmt, uv, water, ripple, ringLight);
                eventRipple(W, ks - KF_UP, 0.8 * kfAmt, uv, water, ripple, ringLight);
            }
            float fc = floor(t / FISH_PERIOD);
            float fs = t - fc * FISH_PERIOD;
            vec2 F = fishSpot(fc);
            if (fs < FISH_JUMP + 3.2 && texture2D(uMask, F).g > 0.5) {
                float dir = fishDir(fc);
                vec2 Fs = F + uPar * (depthAt(F) - uFocus);
                eventRipple(Fs - vec2(0.010 * dir, 0.0), fs, 0.6, uv, water, ripple, ringLight);
                eventRipple(Fs + vec2(0.010 * dir, 0.0), fs - FISH_JUMP, 0.8, uv, water, ripple, ringLight);
            }
        }
        // ඔරුවේ රැළි: පිටුපසින් V හැඩ රැල්ල (Kelvin wake) + හබල් ගහන තැන් වලින් පොඩි රවුම්
        for (int bk = 0; bk < 2; bk++) {
            float kb = float(bk);
            float bAmt = kb < 0.5 ? boatDayAmt : boatNightAmt;
            if (bAmt < 0.02) continue;
            float a = boatAng(t, kb);
            vec2 bp = boatPos(a, kb);
            vec2 d = (uv - bp) * iso;
            if (dot(d, d) > 0.012) continue;
            vec2 f = boatFwd(a, kb);
            vec2 w = vec2(d.x, d.y / BOAT_SQ);
            float u = dot(w, f), v = dot(w, vec2(f.y, -f.x));
            float sb = -u - BOAT_LH * 0.8;
            if (sb > 0.0) {
                float arm = abs(abs(v) - sb * 0.36);
                float wv = sin(sb * 900.0 - t * 6.0) * exp(-arm * arm * 4.0e6) * exp(-sb * 28.0);
                wv += sin((abs(v) + sb) * 1300.0 - t * 5.0) * smoothstep(sb * 0.36, 0.0, abs(v)) * exp(-sb * 45.0) * 0.5;
                ripple += vec2(wv * 0.0025, wv * 0.0008) * water * bAmt;
                ringLight += max(wv, 0.0) * 0.9 * bAmt;
            }
            // කඳ ළඟ ජලය තල්ලු වෙනවා (bow wave)
            float bow = exp(-pow((u - BOAT_LH) / 0.003, 2.0)) * exp(-v * v / 3.0e-5);
            ringLight += bow * 0.5 * bAmt * (kb < 0.5 ? 1.0 : 0.5);
            // හබල් වතුරට වදින තැන් වලින් රවුම් රැළි
            float stroke = boatTime(t) * (kb < 0.5 ? 2.6 : 1.6);
            for (int rw = 0; rw < 2; rw++) {
                float fr = float(rw);
                if (kb > 0.5 && fr < 0.5) continue;                       // රෑ ඔරුවේ පිටුපස කෙනා විතරයි හබල් ගහන්නේ
                float ph = fract((stroke + fr * 0.5) / 6.2831853);
                float side = mod(floor((stroke + fr * 0.5) / 6.2831853) + fr, 2.0) * 2.0 - 1.0;
                float us = fr < 0.5 ? BOAT_LH * 0.35 : -BOAT_LH * 0.40;
                vec2 pl = vec2(us - 0.004 - ph * 0.01, side * (BOAT_WH + 0.0028));    // ජලයේ ඉතුරු වෙන තැන
                vec2 dw = vec2(u, v) - pl;
                float r = length(dw);
                float R = ph * 0.006;
                float ring = sin((r - R) * 4500.0) * exp(-pow((r - R) * 1500.0, 2.0)) * (1.0 - ph);
                ringLight += max(ring, 0.0) * 0.8 * bAmt;
                ripple += (dw / max(r, 1e-5)) * ring * 0.0012 * water * bAmt;
            }
        }
        // වැහි බිංදු වැටෙන කුඩා රැළි (layer 2ක්, perspective එකට ඉලිප්සාකාර)
        if (uRain > 0.01) {
            for (int L = 0; L < 2; L++) {
                float fl = float(L);
                vec2 gv = uv * vec2(70.0 + fl * 40.0, (70.0 + fl * 40.0) * uAspect * 2.6) + fl * 13.7;
                vec2 id = floor(gv);
                vec2 f = fract(gv) - 0.5;
                float h = hash(id + fl * 5.0);
                float ph = fract(t * (1.2 + h * 0.8) + h * 7.0);
                vec2 o = (vec2(hash(id + 2.3), hash(id + 6.1)) - 0.5) * 0.4;
                vec2 d = f - o;
                float r = length(d);
                float R = ph * 0.42;
                float on = step(h, 0.25 + 0.6 * uRain);
                float rw = smoothstep(0.06, 0.0, abs(r - R)) * (1.0 - ph) * (1.0 - ph) * on;
                ripple += (d / max(r, 1e-3)) * rw * 0.0016 * water * uRain;
                ringLight += rw * 0.9 * uRain;
            }
        }
    }

    vec2 suvImg = uvw + sway + ripple;
    vec3 col = sceneAt(suvImg);

    // ---- photo එකේම තියෙන වලාකුළු සුළඟට පාවෙනවා (flow map: phase 2ක් crossfade කරනවා)
    float skyW = smoothstep(0.25, 0.85, sky);
    if (skyW > 0.001) {
        // උඩ (ළඟ) වලාකුළු වේගයෙන්, ක්ෂිතිජය ළඟ (ඈත) සෙමින්
        float hgt = 1.0 - smoothstep(0.05, 0.45, uv.y);
        float L = 0.045 * mix(0.45, 1.0, hgt);
        float jitter = noise(uv * vec2(4.0, 4.0 * uAspect)) * 0.35;           // pulse එක නොපෙනෙන්න
        float ph = uWindT * 0.028 + jitter;
        float ph1 = fract(ph);
        float ph2 = fract(ph + 0.5);
        float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
        float w2 = 1.0 - w1;
        vec2 wob = vec2(0.0, (noise(uv * 3.0 + uWindT * 0.02) - 0.5) * 0.006);  // සියුම් හැඩ වෙනස
        vec2 p1 = suvImg - vec2(L * (ph1 - 0.5), 0.0) + wob * ph1;
        vec2 p2 = suvImg - vec2(L * (ph2 - 0.5), 0.0) + wob * ph2;
        // පර්වතය / ගස් වලින් පාට අරගන්නේ නැති වෙන්න — අහස නොවන තැනකින් sample කරනවා නම් මුල් පාට
        vec3 s1 = mix(col, sceneAt(p1), smoothstep(0.4, 0.9, texture2D(uMask, p1).r));
        vec3 s2 = mix(col, sceneAt(p2), smoothstep(0.4, 0.9, texture2D(uMask, p2).r));
        col = mix(col, s1 * w1 + s2 * w2, skyW);
    }

    // ---- තද සුළඟට පොකුණ කැළඹෙනවා: අඳුරු සුළං පැල්ලම් ජලය හරහා දුවනවා + සුදු රැළි මුදුන්
    if (uStorm > 0.01 && water > 0.01) {
        float paw = smoothstep(0.45, 0.85, noise(uv * vec2(9.0, 26.0) + vec2(-uWindT * 0.9, uWindT * 0.1)));
        col *= 1.0 - paw * 0.22 * uStorm * water;
        // සුළඟට තල්ලු වෙන තරංග: ඇඹරෙන ඉරි (crest) ළඟට එනවා, තැනින් තැන දිලිසෙනවා
        float warp = noise(vec2(uv.x * 14.0 - uWindT * 0.8, uv.y * 40.0)) * 6.0;
        float crest = pow(0.5 + 0.5 * sin(uv.y * 900.0 + warp - uWindT * 5.0), 10.0);
        float patchy = smoothstep(0.35, 0.8, noise(vec2(uv.x * 22.0 - uWindT * 1.4, uv.y * 70.0)));
        col += crest * patchy * (0.4 + 0.6 * paw) * uStorm * water * 0.14 * (0.5 + uAmbient) * vec3(0.95, 0.97, 1.0);
    }
    col += ringLight * water * 0.08 * (0.4 + uAmbient);

    // ---- නෙළුම් / මානෙල් කොළ සහ මල් (පොකුණේ දාර ළඟ පොකුරු 3ක්): දවල්ට පිපිලා, රෑට හැකිළිලා, ජලයේ පාවෙනවා
    if (uv.y > 0.69 && uv.y < 0.89 && uv.x > 0.24 && uv.x < 0.76) {
        float bloom = clamp(uMorning + uNoon + uEvening * 0.45, 0.0, 1.0);
        float lit = 0.32 + 0.68 * uAmbient;
        for (int i = 0; i < 16; i++) {
            float fi = float(i);
            float cl = mod(fi, 3.0);
            vec2 cc = cl < 1.0 ? vec2(0.330, 0.795) : cl < 2.0 ? vec2(0.655, 0.765) : vec2(0.600, 0.850);
            vec2 pp = cc + (vec2(hash(vec2(fi, 31.0)), hash(vec2(fi, 32.0))) - 0.5) * vec2(0.085, 0.030);
            if (texture2D(uMask, pp).g < 0.6) continue;
            float dz = depthAt(pp);
            pp += uPar * (dz - uFocus);
            float bob = 1.0 + uStorm * 3.0 + uWind;
            pp += vec2(sin(t * 0.35 + fi) * 0.0007, sin(t * 0.9 + fi * 1.7) * 0.0004) * bob;
            float ps = (0.0085 + 0.0055 * hash(vec2(fi, 33.0))) * mix(0.8, 1.25, smoothstep(0.72, 0.87, pp.y));
            vec2 q = (uv - pp) * iso / ps;
            if (dot(q, q) > 6.0) continue;
            // කොළය: perspective එකට තිරස් ඉලිප්සයක්, එක පැත්තකින් කැපුමක්
            vec2 lq = q / vec2(1.0, 0.30);
            float lr = length(lq);
            float ang = atan(lq.y, lq.x) - hash(vec2(fi, 34.0)) * 6.28;
            float notch = smoothstep(0.10, 0.04, abs(sin(ang * 0.5))) * step(0.15, lr);
            float pad = smoothstep(1.0, 0.86, lr) * (1.0 - notch);
            vec3 pc = mix(vec3(0.16, 0.34, 0.10), vec3(0.32, 0.50, 0.16), smoothstep(0.5, 1.0, lr) * 0.6 + hash(vec2(fi, 35.0)) * 0.3);
            pc += uSunCol * uSunAmt * 0.08 * smoothstep(0.6, 1.0, lr);                // දාරයේ දිලිසීම
            col = mix(col, pc * lit, pad * water * 0.95);
            // මල (හැම කොළයකම නෑ): ඉරට්ටේ = රෝස නෙළුම, ඔත්තේ = නිල් මානෙල්
            if (hash(vec2(fi, 36.0)) < 0.45) {
                float fsz = ps * 0.80;
                vec2 fq = (uv - pp) * iso / fsz + vec2(-0.15, 0.40);
                float lotus = step(0.5, hash(vec2(fi, 37.0)));
                vec3 tipC = mix(vec3(0.42, 0.42, 0.92), vec3(0.95, 0.36, 0.56), lotus);
                vec3 baseC = mix(vec3(0.86, 0.86, 1.0), vec3(1.0, 0.90, 0.92), lotus);
                float op = bloom * (0.75 + 0.25 * sin(t * 0.05 + fi));
                vec4 fl = waterFlower(fq, op, tipC, baseC);
                vec3 fcl = fl.rgb * lit + uSunCol * uSunAmt * 0.10;
                col = mix(col, fcl, fl.a * 0.97);
                // ජලයේ පිළිබිඹුව (සෙලවෙන)
                vec2 rq = vec2(fq.x + sin(uv.y * 900.0 - t * 3.0) * 0.06, 0.80 - fq.y);
                vec4 rf = waterFlower(rq, op, tipC, baseC);
                col = mix(col, fcl * 0.7, rf.a * 0.30 * water * (1.0 - pad));
            }
        }
    }

    // ---- මාළුවා ජලයෙන් පනිනවා (පොඩි රිදී පාට, දිය පිපිරීම් දෙකක්)
    if (uv.y > 0.68 && uv.y < 0.90 && uv.x > 0.25 && uv.x < 0.75) {
        float fc = floor(t / FISH_PERIOD);
        float fs = t - fc * FISH_PERIOD;
        vec2 F = fishSpot(fc);
        if (fs < FISH_JUMP + 1.0 && texture2D(uMask, F).g > 0.5) {
            float dir = fishDir(fc);
            vec2 Fs = F + uPar * (depthAt(F) - uFocus);
            vec2 F0 = Fs - vec2(0.010 * dir, 0.0), F1 = Fs + vec2(0.010 * dir, 0.0);
            float sp = splash(uv, F0, fs, 0.010) + splash(uv, F1, fs - FISH_JUMP, 0.013);
            col = mix(col, splashC, clamp(sp, 0.0, 1.0) * 0.85);
            if (fs < FISH_JUMP) {
                float k = fs / FISH_JUMP;
                vec2 fp = mix(F0, F1, k) - vec2(0.0, sin(k * 3.14159) * 0.016);
                vec2 v = ((F1 - F0) - vec2(0.0, cos(k * 3.14159) * 3.14159 * 0.016)) * iso;
                vec2 n = normalize(v);
                vec2 pr = vec2(-n.y, n.x);
                if (n.x < 0.0) pr = -pr;
                vec2 d = (uv - fp) * iso / 0.0095;
                vec2 q = vec2(dot(d, n), dot(d, pr));
                float a = fishShape(q);
                vec3 fcol = mix(vec3(0.85, 0.88, 0.90), vec3(0.35, 0.40, 0.42), smoothstep(0.1, -0.15, q.y)) * (0.35 + 0.65 * uAmbient);
                fcol += vec3(1.0) * uSunAmt * 0.3 * smoothstep(0.05, 0.0, abs(q.y + 0.05));   // දිලිසීම
                col = mix(col, fcol, a);
            }
        }
    }

    // ---- වැස්ස: අහස අඳුරු වලාවලින් වැසෙනවා, ගොඩබිම තෙත් වෙලා අඳුරුයි, පාට අඩුයි
    if (uRain > 0.01) {
        float l0 = dot(col, vec3(0.299, 0.587, 0.114));
        vec2 op = vec2(uv.x * 2.0 + t * 0.03, uv.y * uAspect * 4.0);
        float ov = fbm(op + vec2(fbm(op * 0.7 - t * 0.015) * 1.2, 0.0));
        vec3 overcast = uCloudTint * mix(0.72, 1.08, ov);
        // ක්ෂිතිජය ළඟට එනකොට වැහි මීදුම නිසා ලා අළු (පහළ haze එකට ගැළපෙන්න)
        vec3 horizonCol = uMistTint * (0.62 + 0.38 * uAmbient);
        overcast = mix(overcast, horizonCol, smoothstep(0.22, 0.46, uv.y));
        col = mix(col, overcast, uRain * 0.92 * smoothstep(0.0, 0.55, sky));
        vec3 wet = mix(vec3(l0), col, 0.62) * vec3(0.90, 0.95, 1.0);         // අඩු පාට, සීතල
        wet = mix(wet, wet * wet * 1.25, 0.25);                               // තෙත් contrast
        col = mix(col, wet * 0.80, uRain * (1.0 - sky));
    }

    // ---- සඳේ කලාව: photo එකේ පූර්ණ සඳෙන් අඳුරු කොටස අහසේ පාටින් වහනවා, වටේ එළියත් අඩු කරනවා
    if (uNight > 0.01) {
        vec2 mq = (uv - uMoonPos) * iso / MOON_R;
        float mr = length(mq);
        if (mr < 7.0) {
            float k = cos(6.2831853 * uMoonAge);
            float sl = sqrt(max(1.0 - mq.y * mq.y, 0.0));
            float xl = uMoonAge < 0.5 ? mq.x : -mq.x;
            float lit = smoothstep(k * sl - 0.07, k * sl + 0.07, xl);
            float disc = smoothstep(1.12, 0.95, mr);
            vec2 off = vec2(MOON_R * 7.5, 0.0);
            vec3 bg = 0.5 * (sceneAt(uvw + off) + sceneAt(uvw - off));
            col = mix(col, bg + col * 0.03, disc * (1.0 - lit) * uNight);               // අඳුරු කොටස (සියුම් earthshine)
            float halo = exp(-max(mr - 1.0, 0.0) * 0.55) * (1.0 - disc);
            col = mix(col, bg, halo * (1.0 - moonIll) * 0.8 * uNight);
        }
        // ජලයේ සඳ පිළිබිඹුවත් කලාව අනුව අඳුරු
        vec2 rq = (uv - uMoonRefl) / vec2(0.04, 0.07);
        col = mix(col, col * 0.5, exp(-dot(rq, rq)) * water * (1.0 - moonIll) * uNight);
    }

    // ---- වලාකුළු සෙවණැලි ගොඩබිම උඩින් යනවා (දවල්ට)
    if (day > 0.05 && sky < 0.99 && uRain < 0.95) {
        vec2 sp = vec2(uv.x * 1.6 + t * 0.020, uv.y * uAspect * 3.2 + t * 0.004);
        float cs = smoothstep(0.48, 0.72, fbm(sp + vec2(fbm(sp * 0.7 - t * 0.01) * 0.6, 0.0)));
        col *= 1.0 - cs * 0.24 * day * (1.0 - uRain) * (1.0 - sky) * smoothstep(0.45, 0.55, uv.y);
    }

    // ---- ජලය දිලිසීම (හිරු එළියේ)
    float glintAmt = (uNoon + uMorning * 0.6 + uEvening * 0.5) * water * (1.0 - uRain);
    if (glintAmt > 0.01) {
        vec2 g  = uv * vec2(260.0, 620.0) + vec2(t * 0.6, 0.0);
        vec2 gi = floor(g);
        float h = hash(gi);
        float tw = 0.5 + 0.5 * sin(t * (2.0 + h * 5.0) + h * 40.0);
        vec2 jit = vec2(hash(gi + 2.7), hash(gi + 8.1)) - 0.5;
        float d = length(fract(g) - 0.5 - jit * 0.5);
        float cluster = smoothstep(0.45, 0.80, noise(uv * vec2(7.0, 22.0) + vec2(t * 0.09, -t * 0.03)));
        float spark = step(0.955, h) * smoothstep(0.30, 0.0, d) * pow(tw, 10.0) * cluster;
        vec3 gc = mix(vec3(1.0, 0.97, 0.90), vec3(1.0, 0.75, 0.45), uEvening);
        col += spark * glintAmt * gc * 1.5;
    }

    // ---- සඳ එළිය ජලයේ දිලිසීම
    if (uNight > 0.01 && water > 0.01) {
        vec2 md = (uv - uMoonRefl) / vec2(0.035, 0.055);
        float mr = exp(-dot(md, md));
        float sh = noise(vec2(uv.y * 260.0 - t * 2.6, uv.x * 40.0 + t * 0.5));
        col += uNight * water * mr * (sh - 0.35) * 0.4 * moonIll * vec3(0.85, 0.92, 1.0);
    }

    // ---- වලාකුළු (අහසේ): perspective cumulus layer එකක් + උඩ cirrus ඉරි
    //      ළඟ (screen එකේ උඩ) වලාකුළු ලොකුයි, වේගයෙන් යනවා; ක්ෂිතිජය ළඟ පොඩියි, සෙමින්, haze එකට මැකෙනවා.
    float cloudA = 0.0;
    float skyS = smoothstep(0.0, 0.6, sky);
    if (skyS > 0.001) {
        float h = max(0.50 - uv.y, 0.0);                       // ක්ෂිතිජයට (image y ≈ 0.5) උඩින් උස
        float z = 1.0 / (h * 3.2 + 0.10);                      // වලාකුළු තලයේ දුර
        vec2 P = vec2((uv.x - 0.5) * z * 2.6, z * 1.5);
        P.x -= uWindT * 0.11;                                  // සුළඟට දකුණට පාවෙනවා
        P.y += uWindT * 0.006;                                 // සෙමින් ළඟට එනවා
        float cov = mix(0.72, 0.40, clamp(uCloudAmt, 0.0, 1.0)); // වලාකුළු කොච්චර
        vec2 warp = vec2(fbm(P * 0.45 + vec2(uWindT * 0.012, 3.1)), fbm(P * 0.45 - vec2(1.7, uWindT * 0.009)));
        float det = (noise(P * 4.0 - uWindT * 0.04) - 0.5) * 0.12 + (noise(P * 9.0 + 4.0) - 0.5) * 0.06;
        float n = fbm(P + warp * 1.1) + det;
        float d = smoothstep(cov, cov + 0.13, n);
        // හිරු පැත්තට density එක බලලා ආලෝකය (හිරු පැත්තේ දාර දිලිසෙනවා, පිටිපස්ස අඳුරුයි)
        // ආලෝකය එන දිශාව: හිරු පේනවා නම් හිරු පැත්තෙන්, නැත්නම් උඩින් (යට පැත්ත අඳුරුයි)
        vec2 sdir = normalize(mix(vec2(0.0, -1.0), normalize((uSunPos - uv) * iso + vec2(1e-4)), clamp(uSunAmt * 4.0, 0.0, 1.0)));
        float nl = fbm(P + warp * 1.1 + vec2(sdir.x, -sdir.y) * 0.16) + det;
        float dl = smoothstep(cov, cov + 0.13, nl);
        float lightK = clamp(1.0 - dl * 0.55 + (1.0 - d) * 0.30, 0.0, 1.0);
        float fadeH = smoothstep(0.0, 0.09, h);                // ක්ෂිතිජය ළඟ මැකෙනවා

        vec2 sd = (uv - uSunPos) * iso;
        float lit = exp(-dot(sd, sd) * 10.0);
        vec2 md = (uv - uMoonPos) * iso;
        float moonLit = exp(-dot(md, md) * 16.0) * uNight * moonIll;
        float edge = clamp(d * (1.0 - d) * 4.0, 0.0, 1.0);

        vec3 shadowC = mix(uCloudTint * 0.74, col * 0.95, 0.30) + vec3(-0.02, 0.0, 0.03);   // ලා නිල්-අළු යට පැත්ත
        vec3 cc = mix(shadowC, uCloudTint * 1.06, lightK);
        cc += uSunCol * uSunAmt * (lit * 2.0 * (0.35 + 0.65 * lightK) + lit * edge * 1.6);
        cc += vec3(0.55, 0.62, 0.75) * moonLit * (0.4 + 0.6 * lightK + edge);
        cc = mix(cc, col, (1.0 - fadeH) * 0.45);                // ඈත ඒවා අහසේ පාටට

        // අකුරු පේන්න text එක පිටිපස්සේ වලාකුළු ටිකක් තුනී
        float ty0 = (suv.y - uTextY) / 0.12;
        float textClear = 1.0 - 0.35 * exp(-ty0 * ty0);
        float a = d * 0.93 * fadeH * skyS * textClear;
        col = mix(col, cc, a);

        // උඩ අහසේ සිහින් cirrus ඉරි (සෙමින්)
        vec2 cp = vec2(uv.x * 2.2 - uWindT * 0.010, uv.y * uAspect * 13.0);
        float ci = fbm(cp + vec2(fbm(cp * 0.5 + 2.3) * 2.2, 0.0));
        float cir = smoothstep(0.56, 0.86, ci) * 0.38 * smoothstep(0.40, 0.12, uv.y) * skyS * (1.0 - d);
        vec3 cic = uCloudTint * 1.04 + uSunCol * uSunAmt * lit * 1.4 + vec3(0.5, 0.58, 0.72) * moonLit * 0.6;
        col = mix(col, cic, cir * textClear);
        cloudA = clamp(a + cir, 0.0, 1.0);
    }

    // ---- දේදුන්න (වැස්සෙන් පස්සේ): ප්‍රධාන දුන්න + සියුම් දෙවැන්න
    if (uRainbow > 0.01 && skyS > 0.01) {
        vec2 rc = vec2(0.36, 0.64);
        float r = length((uv - rc) * iso);
        float R = 0.78, w = 0.055;
        float x = (r - (R - w)) / w;                         // 0 = දම් (ඇතුළ), 1 = රතු (පිට)
        float a = smoothstep(-0.25, 0.15, x) * smoothstep(1.25, 0.85, x);
        float x2 = ((R + 0.14) - r) / (w * 1.4);             // දෙවැන්න: පාට පිළිවෙළ අනිත් පැත්තට
        float a2 = smoothstep(-0.25, 0.15, x2) * smoothstep(1.25, 0.85, x2) * 0.35;
        float fadeLow = smoothstep(0.52, 0.30, uv.y) * smoothstep(0.02, 0.12, uv.y);
        // දීප්තිමත් අහසේත් පේන්න: අහසේ පාට ටිකක් අඩු කරලා දේදුනු පාට එකතු කරනවා
        vec3 rb1 = hue(mix(0.76, 0.0, clamp(x, 0.0, 1.0)));
        vec3 rb2 = hue(mix(0.76, 0.0, clamp(x2, 0.0, 1.0)));
        float k1 = a * 0.30 * uRainbow * skyS * fadeLow * (1.0 - cloudA * 0.5);
        float k2 = a2 * 0.22 * uRainbow * skyS * fadeLow * (1.0 - cloudA * 0.5);
        col = mix(col, col * 0.62 + rb1 * 0.55, k1);
        col = mix(col, col * 0.62 + rb2 * 0.55, k2);
        // දුන්න ඇතුළ ටිකක් එළියි (ඇත්ත දේදුනු වගේ)
        col += vec3(0.05) * smoothstep(R - w, R - w - 0.1, r) * uRainbow * skyS * fadeLow;
    }

    // ---- තරු (රෑට සහ පාන්දරට)
    float starAmt = (uNight + uDawn * 0.35) * sky;
    if (starAmt > 0.01) {
        vec2 sp = vec2(uv.x, uv.y * uAspect) * 170.0;
        vec2 si = floor(sp);
        float h = hash(si);
        if (h > 0.84) {
            vec2 off = vec2(hash(si + 3.1), hash(si + 7.7)) - 0.5;
            float d = length(fract(sp) - 0.5 - off * 0.6);
            float big = pow(hash(si + 1.3), 4.0);
            float size = mix(0.05, 0.20, big);
            float tw = 0.55 + 0.45 * sin(t * (0.8 + 3.0 * hash(si + 5.0)) + h * 50.0);
            float s = smoothstep(size, 0.0, d) * tw * (0.5 + big * 1.5);
            float horizon = smoothstep(0.50, 0.30, uv.y);
            float moonD = length((uv - uMoonPos) * iso);
            float moonMask = smoothstep(0.07, 0.22, moonD);
            vec3 sc = mix(vec3(0.80, 0.88, 1.0), vec3(1.0, 0.92, 0.80), hash(si + 9.0));
            col += s * starAmt * horizon * mix(1.0, moonMask, uNight) * (1.0 - cloudA * 2.5) * sc;
        }
    }

    // ---- තරු වැටීම (රෑට ඉඳහිට)
    if (uNight > 0.3 && sky > 0.01) {
        float period = 11.0;
        float cyc = floor(t / period);
        float ph  = fract(t / period) * period;
        float hs  = hash(vec2(cyc, 7.0));
        if (hs > 0.45 && ph < 1.1) {
            vec2 st  = vec2(0.15 + 0.7 * hash(vec2(cyc, 1.0)), 0.04 + 0.18 * hash(vec2(cyc, 2.0)));
            vec2 dir = normalize(vec2(hash(vec2(cyc, 3.0)) > 0.5 ? 1.0 : -1.0, 0.45));
            float k  = ph / 1.1;
            vec2 head = st + dir * k * 0.35;
            vec2 p  = (uv - head) * iso;
            vec2 dn = normalize(dir * iso);
            float along = dot(p, -dn);
            float perp  = length(p + dn * along);
            float trail = smoothstep(0.12, 0.0, along) * step(0.0, along);
            float a = trail * smoothstep(0.0025, 0.0, perp) * sin(3.14159 * k);
            col += a * uNight * sky * vec3(0.9, 0.95, 1.0) * 1.4;
        }
    }

    // ---- සඳ දිලිසීම
    if (uNight > 0.01) {
        vec2 md = (uv - uMoonPos) * iso;
        float g = exp(-dot(md, md) * 90.0);
        col += uNight * g * (0.06 + 0.03 * sin(t * 0.6)) * moonIll * vec3(0.75, 0.85, 1.0);
    }

    // ---- හිරු කිරණ (god rays) + ඒ ඇතුළේ පාවෙන දූවිලි
    float rays = 0.0, fall = 0.0;
    if (uSunAmt > 0.01) {
        vec2 d = (uv - uSunPos) * iso;
        float r = length(d);
        float ang = atan(d.y, d.x);
        rays = noise(vec2(ang * 9.0, t * 0.10)) * 0.6 + noise(vec2(ang * 23.0, -t * 0.07)) * 0.4;
        rays = smoothstep(0.35, 0.9, rays);
        fall = exp(-r * 2.6);
        float glow = exp(-r * r * 22.0);
        col += uSunCol * uSunAmt * (rays * fall * 0.55 + glow * 0.45) * (0.6 + 0.4 * sky);

        vec2 dp = uv * vec2(55.0, 55.0 * uAspect) + vec2(t * 0.06, -t * 0.035);
        vec2 di = floor(dp);
        float hh = hash(di);
        if (hh > 0.90) {
            vec2 o = vec2(hash(di + 1.0), hash(di + 2.0)) - 0.5;
            vec2 wob = 0.15 * vec2(sin(t * 0.7 + hh * 20.0), cos(t * 0.5 + hh * 10.0));
            float dd = length(fract(dp) - 0.5 - o * 0.5 - wob);
            float tw = 0.5 + 0.5 * sin(t * 1.5 + hh * 30.0);
            col += uSunCol * uSunAmt * smoothstep(0.07, 0.0, dd) * (rays * fall * 4.0 + glow) * tw * 1.6;
        }
    }

    // ---- අලි රංචුව: හිරු බැසීමට විනාඩි 30කට කලින් සිට (ඇත්ත වෙලාවට), විනාඩි 2යි තත්පර 50කට වරක් රංචුවක්.
    //      පොකුණේ ඉහළ බැම්ම දිගේ (තිරස්ව) ඇවිදිනවා, මැද නවතිලා වතුර බොනවා, ජලයේ පිළිබිඹුව + බිමේ සෙවණැල්ල. පැටියෙකුත් එක්ක.
    float eleAmt = (1.0 - uRain * 0.3) * step(0.0, uEleT);
    float eleMask = 0.0;                                                  // වැස්සේ මීදුමෙන් අලි වැහෙන්නේ නැති වෙන්න
    if (eleAmt > 0.02 && uv.y > 0.66 && uv.y < 0.75 && uv.x > 0.15 && uv.x < 0.86) {
        float ec = floor(uEleT / 170.0);
        float es = uEleT - ec * 170.0;
        if (es < 130.0) {
            // ගමන: තත්පර 55ක් ඇවිදිනවා → 20ක් නවතිලා බොනවා → 55ක් ඇවිදිනවා
            float k = es < 55.0 ? es / 55.0 * 0.45 : es < 75.0 ? 0.45 : 0.45 + (es - 75.0) / 55.0 * 0.55;
            float drinkT = smoothstep(56.0, 59.0, es) * smoothstep(74.0, 71.0, es);
            float dir = hash(vec2(ec, 111.0)) > 0.5 ? 1.0 : -1.0;
            float gy = 0.7100;                                              // පහළම පඩිය (ජලය අයින)
            float wy = gy + 0.0030;                                         // ජල මට්ටම (පිළිබිඹුවට)
            float vis = clamp(eleAmt, 0.0, 1.0);
            float sunSide = uSunPos.x > 0.5 ? 1.0 : -1.0;                   // සවස හිරු දකුණෙන්
            vec3 ldW = normalize(vec3(sunSide * 0.55, -0.70, 0.45));
            vec3 litC = vec3(0.36 + 0.62 * uAmbient) + uSunCol * uSunAmt * 0.40;     // හිරු එළිය උණුසුම්
            for (int i = 0; i < 4; i++) {
                float fi = float(i);
                float sz = fi == 2.0 ? 0.0072 : 0.0105 + 0.0014 * hash(vec2(fi, 112.0));   // තුන්වෙනියා පැටියා
                float x = dir > 0.0 ? mix(0.19, 0.83, k) - fi * 0.023 : mix(0.83, 0.19, k) + fi * 0.023;
                float fade = smoothstep(0.19, 0.23, x) * smoothstep(0.83, 0.79, x);       // කැලෑවෙන් එනවා / යනවා
                if (fade <= 0.0) continue;
                vec2 base = vec2(x, gy) + uPar * (depthAt(vec2(x, gy)) - uFocus);
                // පියවර: තත්පර ~2කට එක පූර්ණ පියවර චක්‍රයක් (දුර අනුව — නවතිලා බොනකොට කකුල් නවතිනවා)
                float walk = k * 400.0 + fi * 1.3;
                float drink = drinkT * smoothstep(0.0, 1.0, 1.0 - fi * 0.15) * step(fi, 2.5);
                float sway = sin(es * 1.1 + fi) * (1.0 - drink);
                float aa = 0.0011 / sz;                                    // pixel ~1.5ක මෘදු දාරයක්
                vec3 ld = vec3(ldW.x * dir, ldW.y, ldW.z);
                vec2 q = (uv - base) * iso / sz + vec2(0.0, 1.0);
                q.x *= dir;
                // බිමේ සෙවණැල්ල (හිරු එළිය තද නම් තදයි)
                vec2 sq4 = vec2((q.x + 0.3 * ldW.x * dir) / 1.3, (q.y - 1.0) / 0.13);
                col *= 1.0 - exp(-dot(sq4, sq4)) * 0.35 * (0.3 + 0.7 * uSunAmt) * (1.0 - water) * fade * vis;
                // ජලයේ පිළිබිඹුව (ජල මට්ටමට කණ්ණාඩියක් වගේ, රැළි එක්ක සෙලවෙනවා)
                if (uv.y > wy) {
                    vec2 um = vec2(uv.x + sin(uv.y * 700.0 - t * 2.5) * 0.0006, 2.0 * wy - uv.y);
                    vec2 qr = (um - base) * iso / sz + vec2(0.0, 1.0);
                    qr.x *= dir;
                    if (abs(qr.x) < 1.6 && qr.y > -0.8 && qr.y < 1.5) {
                        vec4 r = elephant(qr, walk, sway, drink, aa * 2.0, ld);
                        col = mix(col, r.rgb * litC * 0.55, r.a * fade * water * 0.50 * vis);
                    }
                }
                if (abs(q.x) < 1.6 && q.y > -0.8 && q.y < 1.5) {
                    vec4 e = elephant(q, walk, sway, drink, aa, ld);
                    vec3 ec3 = e.rgb * litC;
                    // අප්‍රේල් 1: එක අලියෙක් රෝස පාටයි 🐘💗 (ආලෝකය / සෙවණ එහෙමම තියෙනවා)
                    if (uAprilFool > 0.5 && fi > 0.5 && fi < 1.5)
                        ec3 = dot(ec3, vec3(0.30, 0.59, 0.11)) * vec3(2.9, 1.35, 1.85) + vec3(0.07, 0.02, 0.04);
                    ec3 = mix(ec3, uMistTint * (0.4 + 0.4 * uAmbient), 0.05);    // ඈත නිසා සියුම් haze
                    float a = e.a * fade * vis;
                    col = mix(col, ec3, a);
                    eleMask = max(eleMask, a);
                }
            }
        }
    }

    // ---- මිනිස්සු: 2–4 දෙනාගේ කණ්ඩායම් ඉඳහිට පොකුණ වටේ පාර දිගේ ඇවිදලා මැද පාරෙන් සීගිරිය පැත්තට යනවා.
    //      ලොකු දර්ශනයක් නිසා පොඩි හැඩ විතරයි. රෑට පන්දම් අරගෙන — ගිනිදැල්ල, වටේ එළිය, බිමේ එළිය, ජලයේ පිළිබිඹුව.
    vec3 torchGlow = vec3(0.0);
    float torchAmt = clamp(uNight + uEvening * 0.35 + uDawn * 0.6, 0.0, 1.0);
    if (uv.y > 0.60 && uv.y < 0.92) {
        for (int g = 0; g < 2; g++) {
            float fg = float(g);
            float period = 160.0 + fg * 50.0;
            float tt = t + fg * 83.0;
            float gc = floor(tt / period);
            float gs = tt - gc * period;
            if (hash(vec2(gc, fg + 121.0)) > 0.65 * (1.0 - 0.85 * uRain)) continue;
            float fromRight = step(0.6, hash(vec2(gc, fg + 122.0)));
            vec2 p0 = mix(vec2(0.03, 0.855), vec2(0.97, 0.845), fromRight);
            vec2 p1 = mix(vec2(0.175, 0.775), vec2(0.80, 0.735), fromRight);
            vec2 p2 = mix(vec2(0.27, 0.706), vec2(0.735, 0.703), fromRight);
            vec2 p3 = vec2(0.508, 0.699);
            vec2 p4 = vec2(0.508, 0.662);
            float L = path5Len(p0, p1, p2, p3, p4);
            float n = 2.0 + floor(hash(vec2(gc, fg + 123.0)) * 2.99);           // 2..4 දෙනා
            float speed = mix(0.0062, 0.0050, torchAmt);                        // රෑට හිමින්
            for (int i = 0; i < 4; i++) {
                float fi = float(i);
                if (fi >= n) break;
                float d = gs * speed - fi * (0.011 + 0.004 * hash(vec2(gc, fi + 124.0)));
                if (d < 0.0 || d > L + 0.01) continue;
                vec2 fp = path5(d, p0, p1, p2, p3, p4);
                vec2 dir = (path5(d + 0.004, p0, p1, p2, p3, p4) - fp) * iso;
                vec2 nrm = normalize(vec2(-dir.y, dir.x) + vec2(1e-5));
                float side = (mod(fi, 2.0) - 0.5) * 0.006;                        // දෙපැත්තට ටිකක්
                fp += vec2(nrm.x, nrm.y / uAspect) * side;
                float dz = depthAt(fp);
                fp += uPar * (dz - uFocus);
                float h = mix(0.0072, 0.0120, smoothstep(0.70, 0.86, fp.y));     // perspective උස
                float fade = smoothstep(L + 0.005, L - 0.02, d) * smoothstep(0.0, 0.02, d);   // කැලෑවට යනවා
                float walkPh = gs * 7.0 + fi * 1.7;
                float facing = dir.x < -1e-4 ? -1.0 : 1.0;
                float torch = (fi < 0.5 || hash(vec2(gc, fi + 125.0)) > 0.45) ? step(0.3, torchAmt) : 0.0;
                float vis = (1.0 - smoothstep(dz + 0.04, dz + 0.12, sceneZ)) * fade;   // තල් ගහ පිටිපස්සේ හැංගෙනවා
                vec2 pq = (uv - fp) * iso / h;
                pq.y += abs(sin(walkPh)) * 0.03;
                if (abs(pq.x) < 0.7 && pq.y > -1.45 && pq.y < 0.25) {
                    vec2 q = vec2(pq.x * facing, pq.y);
                    // බිමේ සෙවණැල්ල (දවල්ට)
                    vec2 sq3 = vec2((q.x + 0.25) / 0.35, q.y / 0.07);
                    col *= 1.0 - exp(-dot(sq3, sq3)) * 0.35 * uSunAmt * vis;
                    vec4 pr = person(q, walkPh, torch);
                    float hc = hash(vec2(gc * 3.0 + fi, 126.0));
                    vec3 cl = hc < 0.35 ? vec3(0.86, 0.85, 0.80) : hc < 0.50 ? vec3(0.85, 0.42, 0.10)
                            : hc < 0.65 ? vec3(0.45, 0.13, 0.12) : hc < 0.80 ? vec3(0.22, 0.30, 0.50) : vec3(0.68, 0.58, 0.44);
                    vec3 skin = vec3(0.32, 0.21, 0.15);
                    vec3 pc = cl;
                    pc = mix(pc, mix(cl, vec3(0.20, 0.18, 0.17), 0.5), pr.z * (1.0 - pr.x));
                    pc = mix(pc, skin, pr.y * (1.0 - pr.x));
                    pc = mix(pc, vec3(0.25, 0.17, 0.10), pr.w);
                    float a = max(max(pr.x, pr.y), max(pr.z, pr.w));
                    // දවල්ට හිරු එළිය; රෑට අඳුරු silhouette + පන්දමේ උණුසුම් එළිය එක පැත්තකින්
                    vec3 dayC = pc * (0.25 + 0.75 * uAmbient) + pc * uSunCol * uSunAmt * 0.2;
                    float warm = (0.35 + 0.65 * smoothstep(-0.25, 0.15, q.x)) * smoothstep(0.1, -1.0, q.y) * step(0.3, torchAmt);
                    vec3 nightC = pc * 0.10 + pc * vec3(1.0, 0.55, 0.22) * 0.75 * warm;    // පන්දමේ එළිය වදිනවා
                    vec3 fc = mix(dayC, nightC, torchAmt * 0.85);
                    col = mix(col, fc, a * vis * 0.95);
                }
                // පන්දම: ගිනිදැල්ල + එළිය (මීදුමෙන් පස්සේ එකතු කරනවා)
                if (torch > 0.5) {
                    vec2 fl = fp + vec2(0.18 * facing, -1.28 - abs(sin(walkPh)) * 0.03) * h / iso;
                    float flick = 0.78 + 0.22 * sin(t * 13.0 + fi * 3.0 + gc) * sin(t * 7.3 + fi) + 0.10 * (noise(vec2(t * 18.0, fi + gc)) - 0.5);
                    vec2 dd = (uv - fl) * iso;
                    float r2 = dot(dd, dd);
                    vec2 fq = dd / h;
                    fq.x += sin(t * 9.0 + fi) * 0.02 * min(-fq.y, 0.3) * 4.0;        // දැල්ල නටනවා
                    float core = smoothstep(0.11, 0.0, length(vec2(fq.x, fq.y * (fq.y < 0.0 ? 0.42 : 1.0))));
                    torchGlow += (vec3(1.0, 0.85, 0.50) * core * 2.4 + vec3(1.0, 0.52, 0.16) *
                                 (exp(-r2 * 1.5e5) * 1.2 + exp(-r2 * 2.5e4) * 0.45 + exp(-r2 * 2.2e3) * 0.20)) * flick * vis;
                    // බිමට වැටෙන එළිය
                    vec2 gq = (uv - fp) * iso / h;
                    torchGlow += vec3(1.0, 0.55, 0.20) * exp(-(gq.x * gq.x / 14.0 + gq.y * gq.y / 0.9)) * 0.22 * flick * (1.0 - water) * fade;
                    // ජලයේ පිළිබිඹුව (පොකුණ අයිනේ ඉද්දී සිරස් දිගු ඉරක්, රැළි එක්ක සෙලවෙනවා)
                    vec2 rp = vec2(fl.x, fp.y + (fp.y - fl.y) + 0.005);
                    vec2 rd = (uv - rp) * iso;
                    rd.x += sin(uv.y * 520.0 - t * 3.0) * 0.0008;
                    torchGlow += vec3(1.0, 0.55, 0.20) * (exp(-(rd.x * rd.x * 2.0e5 + rd.y * rd.y * 5.0e3)) * 1.1
                               + exp(-(rd.x * rd.x * 1.5e4 + rd.y * rd.y * 1.5e3)) * 0.15) * flick * water * fade;
                }
            }
        }
    }

    // ---- ඔරු: උදේට දෙදෙනෙක් හබල් ගහගෙන; රෑට හිමින්, ඉස්සරහ කූරක පන්දමක් (ජලයේ දිගු පිළිබිඹුවක් එක්ක)
    if (uv.y > 0.70 && uv.y < 0.88) {
        for (int bk = 0; bk < 2; bk++) {
            float kb = float(bk);
            float bAmt = kb < 0.5 ? boatDayAmt : boatNightAmt;
            if (bAmt < 0.02) continue;
            float a = boatAng(t, kb);
            vec2 bp = boatPos(a, kb);
            float dz = depthAt(bp);
            bp += uPar * (dz - uFocus);
            vec2 d = (uv - bp) * iso;
            vec2 f = boatFwd(a, kb);
            vec2 sd = vec2(f.y, -f.x);                                         // හරහට
            float lit = 0.25 + 0.75 * uAmbient;
            float night = kb;
            if (dot(d, d) < 0.0012) {
                // ජලයේ පිළිබිඹුව / සෙවණ (කඳට යටින්)
                vec2 wr = vec2(d.x, (d.y - BOAT_HH * 1.5) / BOAT_SQ);
                float refl = boatLens(vec2(dot(wr, f), dot(wr, sd)), 1.15);
                col = mix(col, col * 0.55, refl * water * 0.6 * bAmt);
                // කඳ: ජල මට්ටමේ හැඩය (පැති පේනවා) + උඩ දාරය + ඇතුළ
                vec2 w0 = vec2(d.x, d.y / BOAT_SQ);
                vec2 wt = vec2(d.x, (d.y + BOAT_HH) / BOAT_SQ);
                vec2 l0 = vec2(dot(w0, f), dot(w0, sd));
                vec2 lt = vec2(dot(wt, f), dot(wt, sd));
                float hull = max(boatLens(l0, 1.0), boatLens(lt, 1.0));
                float inner = boatLens(lt, 0.72);
                vec3 side = vec3(0.20, 0.12, 0.07) * (0.85 + 0.15 * sin(l0.x * 3000.0));   // ලී පටි
                vec3 hc = mix(side, vec3(0.46, 0.31, 0.17), boatLens(lt, 1.0));            // දාරය
                hc = mix(hc, vec3(0.28, 0.18, 0.10) * (0.9 + 0.1 * sin(lt.x * 1800.0)), inner);   // ඇතුළ
                hc *= lit;
                hc += uSunCol * uSunAmt * 0.12 * boatLens(lt, 1.0) * (1.0 - inner);
                col = mix(col, hc, hull * bAmt);
                // මිනිස්සු: උදේට 2ම හබල් ගහනවා; රෑට ඉස්සරහ කෙනා වාඩිවෙලා, පිටුපස කෙනා හබල් ගහනවා
                float stroke = boatTime(t) * (kb < 0.5 ? 2.6 : 1.6);
                for (int rw = 0; rw < 2; rw++) {
                    float fr = float(rw);
                    float us = fr < 0.5 ? BOAT_LH * 0.35 : -BOAT_LH * 0.40;
                    vec2 base = boatScr(f * us, BOAT_HH);
                    float lean = (kb > 0.5 && fr < 0.5) ? 0.0 : sin(stroke + fr * 0.5) * 0.0006;
                    vec2 top = base + vec2(f.x * lean, -0.0036);
                    float torso = smoothstep(0.00055, 0.0002, sdSeg(d, base, top));
                    float head = smoothstep(0.00075, 0.0004, length(d - top - vec2(0.0, -0.0008)));
                    float hc2 = hash(vec2(fr + kb * 2.0, 131.0));
                    vec3 cl = hc2 < 0.4 ? vec3(0.86, 0.85, 0.80) : hc2 < 0.7 ? vec3(0.80, 0.45, 0.15) : vec3(0.25, 0.32, 0.50);
                    vec3 pc = mix(cl, vec3(0.30, 0.20, 0.14), head * (1.0 - torso));
                    // හබල: අතේ සිට ජලයට, පැත්ත මාරු කරමින් පිටුපසට අදිනවා
                    float paddle = 0.0;
                    if (!(kb > 0.5 && fr < 0.5)) {
                        float ph = fract((stroke + fr * 0.5) / 6.2831853);
                        float sideK = mod(floor((stroke + fr * 0.5) / 6.2831853) + fr, 2.0) * 2.0 - 1.0;
                        float inW = smoothstep(0.0, 0.1, ph) * smoothstep(0.75, 0.6, ph);   // ජලයේ ඇති කාලය
                        vec2 bl = f * (us + 0.006 - ph * 0.012) + sd * sideK * (BOAT_WH + 0.0028);
                        vec2 blade = boatScr(bl, (1.0 - inW) * 0.002);
                        vec2 hand = top + vec2(0.0, 0.0012) + boatScr(sd * sideK * 0.0012, 0.0);
                        paddle = smoothstep(0.00035, 0.0001, sdSeg(d, hand, blade));
                        paddle = max(paddle, smoothstep(0.0007, 0.0003, length(d - blade)) * (1.0 - inW * 0.7));
                    }
                    // රෑට පන්දමේ එළිය මිනිස්සුන්ට සහ ඔරුවට වදිනවා
                    vec3 shade = mix(vec3(lit), vec3(0.10) + vec3(0.80, 0.42, 0.14) * 0.55, night * step(0.5, kb));
                    col = mix(col, pc * shade, max(torso, head) * bAmt);
                    col = mix(col, vec3(0.35, 0.24, 0.14) * shade, paddle * bAmt);
                    // පිළිබිඹුව (යටට, සෙලවෙන)
                    vec2 rb = vec2(d.x + sin(uv.y * 600.0 - t * 3.0) * 0.0004, d.y);
                    float rt = smoothstep(0.0007, 0.0002, sdSeg(rb, base + vec2(0.0, BOAT_HH * 2.0), base + vec2(f.x * lean, 0.0040 + BOAT_HH * 2.0)));
                    col = mix(col, pc * shade * 0.5, rt * water * 0.35 * bAmt);
                }
                if (kb > 0.5) col = mix(col, col + vec3(0.30, 0.15, 0.05) * hull, 0.6 * bAmt);   // කඳට පන්දම් එළිය
            }
            // රෑ ඔරුවේ පන්දම: ඉස්සරහ කූරක, ගිනිදැල්ල + එළිය + ජලයේ දිගු පිළිබිඹුව
            if (kb > 0.5) {
                vec2 pb = boatScr(f * BOAT_LH * 0.82, BOAT_HH);
                vec2 pt = pb + vec2(0.0, -0.0085);
                float pole = smoothstep(0.00035, 0.0001, sdSeg(d, pb, pt));
                col = mix(col, vec3(0.12, 0.08, 0.05), pole * bAmt);
                vec2 fq = d - pt - vec2(0.0, -0.0010);
                fq.x += sin(t * 9.0) * 0.0002 * smoothstep(0.0, -0.0015, fq.y);
                float flick = 0.78 + 0.22 * sin(t * 12.0) * sin(t * 7.7 + 1.3) + 0.10 * (noise(vec2(t * 17.0, 5.0)) - 0.5);
                float core = smoothstep(0.0012, 0.0, length(vec2(fq.x, fq.y * (fq.y < 0.0 ? 0.45 : 1.0))));
                float r2 = dot(fq, fq);
                torchGlow += (vec3(1.0, 0.85, 0.50) * core * 2.4 + vec3(1.0, 0.52, 0.16) *
                             (exp(-r2 * 1.5e5) * 1.2 + exp(-r2 * 2.5e4) * 0.45 + exp(-r2 * 2.2e3) * 0.22)) * flick * bAmt;
                // ජලය මත එළි පැල්ලම
                vec2 gq = d - pb;
                torchGlow += vec3(1.0, 0.55, 0.20) * exp(-(gq.x * gq.x * 4.0e4 + gq.y * gq.y * 2.0e5)) * 0.30 * flick * water * bAmt;
                // ජලයේ පිළිබිඹුව: සිරස් දිගු ඉරක්, රැළි එක්ක කැඩි කැඩී
                vec2 rd = d - (pb + vec2(0.0, 0.0085 + 0.0015));
                rd.x += sin(uv.y * 520.0 - t * 3.2) * 0.0007 + sin(uv.y * 1300.0 + t * 2.0) * 0.0003;
                float brk = 0.6 + 0.4 * noise(vec2(uv.y * 900.0, t * 2.0));
                torchGlow += vec3(1.0, 0.55, 0.20) * (exp(-(rd.x * rd.x * 2.0e5 + rd.y * rd.y * 3.0e3)) * 1.3 * brk
                           + exp(-(rd.x * rd.x * 1.5e4 + rd.y * rd.y * 1.0e3)) * 0.15) * flick * water * bAmt;
            }
        }
    }

    // ---- 🛺 ත්‍රීවීල් එක: දවසට එක වතාවක් අහඹු වෙලාවක පොකුණ වටේ පාර දිගේ ගිහින් සීගිරි පාරට හැරෙනවා
    //      (දවල්ට සෙවණැල්ල; රෑට ඉදිරි ලයිට් එළිය බිමට, පිටුපස රතු ලයිට්)
    if (uTukT >= 0.0 && uv.y > 0.60 && uv.y < 0.92) {
        float fromRight = step(1.5, uTukColor);
        vec2 p0 = mix(vec2(0.03, 0.855), vec2(0.97, 0.845), fromRight);
        vec2 p1 = mix(vec2(0.175, 0.775), vec2(0.80, 0.735), fromRight);
        vec2 p2 = mix(vec2(0.27, 0.706), vec2(0.735, 0.703), fromRight);
        vec2 p3 = vec2(0.508, 0.699);
        vec2 p4 = vec2(0.508, 0.662);
        float L = path5Len(p0, p1, p2, p3, p4);
        float d = uTukT * 0.013 - 0.02;
        if (d > -0.02 && d < L + 0.01) {
            vec2 fp = path5(max(d, 0.0), p0, p1, p2, p3, p4);
            float dx = path5(max(d, 0.0) + 0.004, p0, p1, p2, p3, p4).x - path5(max(d - 0.02, 0.0), p0, p1, p2, p3, p4).x;
            float facing = abs(dx) > 1e-5 ? sign(dx) : (fromRight > 0.5 ? -1.0 : 1.0);
            float dz = depthAt(fp);
            fp += uPar * (dz - uFocus);
            float h = mix(0.0072, 0.0120, smoothstep(0.70, 0.86, fp.y)) * 1.8;
            float fade = smoothstep(L + 0.005, L - 0.03, d) * smoothstep(-0.02, 0.01, d);
            float vis = (1.0 - smoothstep(dz + 0.04, dz + 0.12, sceneZ)) * fade;
            float nightK = clamp(uNight + uEvening * 0.3, 0.0, 1.0);
            vec2 pq = (uv - fp) * iso / h;
            vec2 q = vec2(pq.x * facing, pq.y + sin(uTukT * 14.0) * 0.012);        // පාරේ හෙලවෙනවා
            vec3 bodyC = uTukColor < 0.5 ? vec3(0.95, 0.72, 0.08) : uTukColor < 1.5 ? vec3(0.10, 0.50, 0.25)
                       : uTukColor < 2.5 ? vec3(0.55, 0.08, 0.10) : vec3(0.12, 0.30, 0.65);
            if (abs(q.x) < 1.2 && q.y > -1.3 && q.y < 0.3) {
                vec2 sq5 = vec2((q.x + 0.1) / 0.95, q.y / 0.08);
                col *= 1.0 - exp(-dot(sq5, sq5)) * 0.40 * uSunAmt * vis;          // සෙවණැල්ල
                vec4 tk = tukShape(q, bodyC, nightK, uTukT);
                vec3 tc = tk.rgb * (0.30 + 0.70 * uAmbient) + tk.rgb * uSunCol * uSunAmt * 0.2;
                tc = mix(tc, tk.rgb, step(1.2, max(tk.r, max(tk.g, tk.b))));         // රෑට ලයිට් දිලිසෙනවා
                col = mix(col, tc, tk.a * vis);
            }
            // රෑට ඉදිරි ලයිට් එක: දිලිසීම + බිමට වැටෙන එළිය (ඉදිරියට දිගු)
            vec2 hlp = fp + vec2(0.80 * facing, -0.46) * h / iso;
            vec2 hd = (uv - hlp) * iso;
            torchGlow += vec3(1.0, 0.90, 0.65) * (exp(-dot(hd, hd) * 6.0e5) * 1.2 + exp(-dot(hd, hd) * 2.0e4) * 0.25) * vis * nightK;
            vec2 bq = (uv - fp) * iso / h - vec2(2.0 * facing, 0.0);
            torchGlow += vec3(1.0, 0.85, 0.55) * exp(-(bq.x * bq.x / 2.2 + bq.y * bq.y / 0.06)) * 0.30 * (1.0 - water) * vis * nightK;
            vec2 tlp = fp + vec2(-0.84 * facing, -0.40) * h / iso;
            vec2 td = (uv - tlp) * iso;
            torchGlow += vec3(1.0, 0.10, 0.05) * exp(-dot(td, td) * 4.0e5) * 0.6 * vis * nightK;
        }
    }

    // ---- 🐊 කිඹුලා: ඔරුවක් යනකොට ළඟින් ඇස් දෙකයි නාසයයි මතු වෙනවා, ඔරුවේ අය දෙගුණ වේගයෙන් හබල් ගහනවා
    {
        float tc = t + uCrocShift;
        float ph = tc - floor(tc / CROC_PERIOD) * CROC_PERIOD;
        float kb = boatDayAmt >= boatNightAmt ? 0.0 : 1.0;
        float bAmt = max(boatDayAmt, boatNightAmt);
        if (ph > CROC_START && ph < CROC_START + CROC_DUR && bAmt > 0.2 && uv.y > 0.70 && uv.y < 0.89) {
            float tS = t - (ph - CROC_START);                                   // කිඹුලා මතු වුණ මොහොත
            float a0 = boatAng(tS, kb);
            vec2 bp = boatPos(a0, kb);
            vec2 f = boatFwd(a0, kb);
            vec2 sd = vec2(f.y, -f.x);
            vec2 hdir = -sd;                                                    // ඔරුව දිහා බලාගෙන
            vec2 cw = f * 0.040 + sd * 0.022 + hdir * (ph - CROC_START) * 0.0004;
            vec2 cp = bp + vec2(cw.x, cw.y * BOAT_SQ / uAspect);
            cp += uPar * (depthAt(cp) - uFocus);
            float sf = smoothstep(CROC_START, CROC_START + 2.0, ph) * smoothstep(CROC_START + CROC_DUR, CROC_START + CROC_DUR - 2.5, ph);
            vec2 dd = (uv - cp) * iso;
            vec2 w = vec2(dd.x, dd.y / BOAT_SQ);
            float u = dot(w, hdir), v = dot(w, vec2(hdir.y, -hdir.x));
            if (abs(u) < 0.05 && abs(v) < 0.02) {
                // ජලයට යටින් ශරීරයේ අඳුරු හැඩය (හිස, කඳ, වලිගය)
                float body = smoothstep(1.0, 0.55, length(vec2((u + 0.004) / 0.017, v / 0.0050)));
                body = max(body, smoothstep(1.0, 0.5, length(vec2((u - 0.008) / 0.008, v / 0.0036))));
                col *= 1.0 - body * 0.38 * sf * water;
                // පිට කොරපොතු (පේළි දෙකක ගැට — ජලයෙන් උඩට)
                float sc = 0.0;
                for (int k = 0; k < 4; k++) {
                    float uk = -0.002 - float(k) * 0.0042;
                    sc = max(sc, smoothstep(0.0014, 0.0005, length(vec2(u - uk, abs(v) - 0.0014))));
                }
                // ඇස් දෙක + නාසය (මතුපිටට, උඩ පැත්ත එළිය)
                vec2 e1 = vec2(u - 0.005, v - 0.0026), e2 = vec2(u - 0.005, v + 0.0026);
                float eyes = smoothstep(0.0024, 0.0012, min(length(e1 * vec2(0.8, 1.0)), length(e2 * vec2(0.8, 1.0))));
                float nose = smoothstep(0.0017, 0.0008, length(vec2(u - 0.0145, v)));
                vec3 cc = vec3(0.15, 0.17, 0.09) * (0.35 + 0.65 * uAmbient);
                float bump = max(max(eyes, nose), sc * 0.85);
                cc *= 1.0 + 0.6 * smoothstep(0.0, -0.002, dd.y) * bump;            // ගැටවල උඩට එළිය
                col = mix(col, cc, bump * sf * water);
                // ඇස් දිලිසෙනවා (රෑට පන්දම් එළියට තැඹිලි eyeshine)
                float glint = smoothstep(0.0009, 0.0, min(length(e1 - vec2(0.0006, 0.0)), length(e2 - vec2(0.0006, 0.0))));
                col += mix(vec3(0.9, 0.95, 0.8) * uAmbient, vec3(2.0, 0.9, 0.2), kb) * glint * sf * water;
                // මතු වෙද්දී රවුම් රැළි + ඇස් වටේ V රැල්ල
                float r = length(vec2(u - 0.005, v));
                float R = (ph - CROC_START) * 0.007;
                col += vec3(0.5, 0.55, 0.6) * (0.3 + 0.7 * uAmbient) * smoothstep(0.0006, 0.0, abs(r - R)) * exp(-(ph - CROC_START) * 0.5) * water * 0.5;
            }
        }
    }

    // ---- පාන්දර / උදෑසන ඝන මීදුම — ගලාගෙන යනවා: විශාල මීදුම් කඳු එක පැත්තකට පාවෙනවා (ප්‍රදේශ ඝන/තුනී වෙනවා),
    //      ඈත ස්තරය සෙමින්, ළඟ ස්තරය වේගයෙන් පෙරළි පෙරළී, සිහින් ඉරි ගස් අතරින් ලිස්සලා යනවා, පොකුණ උඩින් හුමාලය ගලනවා
    if (uEarlyMist > 0.01 && sky < 0.995) {
        float far = 1.0 - smoothstep(0.02, 0.75, sceneZ);
        float bank = smoothstep(0.28, 0.72, fbm(vec2(uv.x * 1.3 - t * 0.016, uv.y * uAspect * 1.6 + sin(t * 0.03) * 0.25)));
        vec2 fp1 = vec2(uv.x * 2.4 - t * 0.030, uv.y * uAspect * 6.0 - t * 0.010);
        float f1 = fbm(fp1 + vec2(fbm(fp1 * 0.6 + vec2(t * 0.04, -t * 0.02)) * 1.6, 0.0));
        vec2 fp2 = vec2(uv.x * 4.0 - t * 0.11, uv.y * uAspect * 9.0 + sin(t * 0.21 + uv.x * 3.0) * 0.4);
        float f2 = fbm(fp2 + vec2(0.0, fbm(fp2 * 0.5 + vec2(t * 0.07, t * 0.05)) * 1.2));
        vec2 fp3 = vec2(uv.x * 7.0 - t * 0.20, uv.y * uAspect * 26.0 + fbm(vec2(uv.x * 3.0 - t * 0.08, t * 0.05)) * 2.0);
        float f3 = smoothstep(0.55, 0.85, fbm(fp3));
        float wisps = smoothstep(0.38, 0.82, f1) * 0.70 + smoothstep(0.45, 0.85, f2) * 0.50 + f3 * 0.35;
        // පර්වතය පාමුල සහ කැලෑ මට්ටමේ (y 0.45 – 0.85) ඝනම, ළඟට එනකොට තුනී
        float bandE = smoothstep(0.40, 0.52, uv.y) * (1.0 - smoothstep(0.80, 0.98, uv.y));
        float fog = clamp(far * 0.55 * (0.55 + 0.65 * bank)
                        + wisps * bandE * mix(1.0, 0.45, nearZ) * (0.45 + 0.75 * bank), 0.0, 1.0);
        // පොකුණ උඩින් හුමාලය: ජලය දිගේ ගලනවා + උඩට නගිනවා
        vec2 fp4 = vec2(uv.x * 10.0 - t * 0.09, uv.y * uAspect * 30.0 + t * 0.30);
        float steam = smoothstep(0.42, 0.85, fbm(fp4 + vec2(f2 * 1.5, 0.0)));
        fog = max(fog, water * max(smoothstep(0.40, 0.85, f2) * 0.8, steam * 0.9));
        vec3 fogCol = uMistTint * mix(0.90, 1.06, f1) * (0.55 + 0.45 * uAmbient);
        vec2 sdm = (uv - uSunPos) * iso;
        fogCol += uSunCol * uSunAmt * exp(-dot(sdm, sdm) * 5.0) * 0.9;           // හිරු පැත්තෙන් දිලිසෙනවා
        col = mix(col, fogCol, fog * uEarlyMist * 0.62 * (1.0 - sky * 0.85));
    }

    // ---- මීදුම: හැම වෙලාවකම පේන තරමට පාවෙනවා (දවල්ට සියුම් hazeඑකක්, පාන්දරට ඝනයි)
    float mistAmt = uDawn * 0.85 + uMorning * 0.5 + uNoon * 0.16 + uEvening * 0.26 + uNight * 0.32;
    if (mistAmt > 0.01) {
        float m = 0.0;
        // 1. පර්වතය වටේ කැලෑව උඩින් (ඈත)
        float band1 = smoothstep(0.44, 0.52, uv.y) * smoothstep(0.74, 0.58, uv.y);
        if (band1 > 0.001) {
            vec2 mp = vec2(uv.x * 3.2 - t * 0.060, uv.y * uAspect * 7.0);
            float a = fbm(mp + vec2(fbm(mp * 0.7 + vec2(t * 0.05, t * 0.02)) * 1.3, 0.0));
            m = max(m, smoothstep(0.42, 0.85, a) * band1);
        }
        // 2. ළඟ මීදුම (අනිත් පැත්තට, ටිකක් වේගයෙන්, රෝල් වෙනවා)
        float band2 = smoothstep(0.55, 0.64, uv.y) * smoothstep(0.86, 0.70, uv.y);
        if (band2 > 0.001) {
            vec2 mp2 = vec2(uv.x * 2.0 - t * 0.060, uv.y * uAspect * 5.0 + sin(t * 0.12) * 0.4);
            float b = fbm(mp2 + vec2(0.0, fbm(mp2 * 0.5 - t * 0.025) * 0.8));
            m = max(m, smoothstep(0.50, 0.88, b) * band2 * 0.8);
        }
        // 3. පොකුණ උඩින් හුමාලය (උඩට නඟිනවා)
        if (water > 0.01) {
            vec2 sp2 = vec2(uv.x * 9.0 - t * 0.07, uv.y * uAspect * 26.0 + t * 0.25);
            float st = smoothstep(0.45, 0.9, fbm(sp2));
            m = max(m, st * water * (uDawn + uNight * 0.6 + uMorning * 0.4) * 0.8);
        }
        col = mix(col, uMistTint, clamp(m * mistAmt, 0.0, 0.85) * (1.0 - sky) * 0.75);
    }

    // ---- 👻 හරියටම රෑ 12: හොල්මන් සීන් එක — දර්ශනය සීතල අඳුරු වෙනවා, පන්දම් වෙව්ලනවා,
    //      සුදු මෝහිනියක් පොකුණ උඩින් පාවෙලා ඇවිත් මැද නවතිලා අපිට අත වනලා අතුරුදන් වෙනවා (පිළිබිඹුවක් නෑ 😱)
    float ghostEnv = 0.0;
    if (uGhostT >= 0.0) {
        float g = uGhostT;
        ghostEnv = smoothstep(0.0, 4.0, g) * smoothstep(60.0, 55.0, g);
        col = mix(col, col * vec3(0.62, 0.80, 0.92), ghostEnv * 0.7);
        // පොකුණ උඩ කොළ-නිල් හොල්මන් මීදුම
        float gm = smoothstep(0.45, 0.85, fbm(vec2(uv.x * 5.0 - t * 0.12, uv.y * uAspect * 14.0 + t * 0.05)));
        col = mix(col, vec3(0.45, 0.65, 0.62) * (0.35 + 0.4 * uAmbient), gm * water * ghostEnv * 0.45);
        float gx = g < 28.0 ? mix(0.30, 0.50, smoothstep(3.0, 28.0, g)) : g < 40.0 ? 0.50 : mix(0.50, 0.72, smoothstep(40.0, 56.0, g));
        vec2 gp = vec2(gx, 0.783 + sin(g * 1.5) * 0.003);
        gp += uPar * (depthAt(gp) - uFocus);
        float gh = 0.046;
        float flick = (0.75 + 0.25 * noise(vec2(g * 8.0, 3.0))) * step(0.12, noise(vec2(g * 2.5, 9.0)));   // ඉඳහිට අතුරුදන්
        float ga = smoothstep(3.0, 6.0, g) * smoothstep(56.0, 52.0, g) * flick;
        float facing = g > 28.0 && g < 40.0 ? 0.0 : 1.0;
        vec2 q = (uv - gp) * iso / gh;
        q.x *= g > 40.0 || g < 28.0 ? 1.0 : -1.0;
        float wave = smoothstep(29.0, 31.0, g) * smoothstep(39.0, 37.0, g);
        if (abs(q.x) < 0.8 && q.y > -1.3 && q.y < 0.3) {
            vec4 gs = ghostShape(q, t, wave);
            col = mix(col, gs.rgb * (0.55 + 0.45 * uAmbient), gs.a * ga * 0.85);
        }
        // පිටුපසට ඇදෙන මීදුම් වලිගය (ectoplasm wisps) — ගවුමේ අගෙන් ගලාගෙන යනවා
        vec2 wq = (uv - gp) * iso / gh;
        float moving = 1.0 - wave;
        float tailK = smoothstep(0.25, -0.6, wq.x) * smoothstep(-1.6, -0.2, wq.x) * smoothstep(-0.75, -0.25, wq.y) * smoothstep(0.25, -0.05, wq.y);
        float wisp = smoothstep(0.45, 0.80, fbm(vec2(wq.x * 3.0 + t * 1.2, wq.y * 6.0 + sin(wq.x * 2.0 + t) * 0.6)));
        col += vec3(0.55, 0.72, 0.90) * wisp * tailK * ga * 0.35 * (0.4 + 0.6 * moving);
        // වටේ සීතල දිලිසීම (ලොකු halo + හිස වටේ)
        vec2 gd = (uv - gp - vec2(0.0, -0.45 * gh / uAspect)) * iso;
        col += vec3(0.45, 0.65, 0.85) * exp(-dot(gd, gd) * 3.5e3) * 0.30 * ga;
        vec2 hdq = (uv - gp - vec2(0.0, -0.88 * gh / uAspect)) * iso;
        col += vec3(0.55, 0.75, 0.95) * exp(-dot(hdq, hdq) * 2.5e4) * 0.18 * ga;
        // ජලය මත ඇයගේ එළිය (පිළිබිඹුවක් නෑ — එළිය විතරයි)
        vec2 wl = (uv - gp - vec2(0.0, 0.012)) * iso;
        col += vec3(0.35, 0.55, 0.70) * exp(-(wl.x * wl.x * 3.0e3 + wl.y * wl.y * 2.0e4)) * 0.25 * ga * water;
        // වටේ උඩට පාවෙන හොල්මන් එළි තිත් (spirit orbs)
        for (int m = 0; m < 10; m++) {
            float fm = float(m);
            float life = 3.0 + 2.0 * hash(vec2(fm, 301.0));
            float mt = g + fm * 0.7;
            float mc = floor(mt / life);
            float mk = (mt - mc * life) / life;
            vec2 mo = vec2((hash(vec2(fm, mc + 302.0)) - 0.5) * 0.9 + sin(mk * 6.0 + fm) * 0.08, -mk * 1.3 + 0.1);
            vec2 mp = gp + vec2(mo.x, mo.y / uAspect) * gh;
            vec2 md = (uv - mp) * iso;
            col += vec3(0.6, 0.85, 1.0) * exp(-dot(md, md) * 2.5e6) * sin(mk * 3.14159) * ga * 0.9;
        }
    }

    // ---- 🎆 ජනවාරි 1 මධ්‍යම රාත්‍රිය: සීගිරියට උඩින් ගිනිකෙළි (විනාඩි 20ක්)
    if (uFireT >= 0.0 && uv.y < 0.60) {
        float fAmt = smoothstep(0.0, 3.0, uFireT) * smoothstep(1200.0, 1190.0, uFireT);
        float skyOcc = smoothstep(0.2, 0.7, sky);                              // පර්වතය / ගස් පිටුපසින් පේන්නේ නෑ
        for (int sh = 0; sh < 5; sh++) {
            float fs = float(sh);
            float P = 3.2 + fs * 0.55;
            float ts = uFireT + fs * 1.37;
            float cyc = floor(ts / P);
            float ph = ts - cyc * P;
            vec2 B = vec2(0.25 + 0.50 * hash(vec2(cyc, fs + 201.0)), 0.13 + 0.18 * hash(vec2(fs + 202.0, cyc)));
            vec3 fc = hue(hash(vec2(cyc, fs + 203.0)));
            fc = mix(fc, vec3(1.0), 0.25);
            if (ph < 0.9) {
                // රොකට්ටුව උඩට යනවා (දිලිසෙන තිතක් + සිහින් ඉරක්)
                float k = ph / 0.9;
                vec2 rp = mix(vec2(B.x + 0.02, 0.47), B, 1.0 - (1.0 - k) * (1.0 - k));
                vec2 rd = (uv - rp) * iso;
                float trail = smoothstep(0.0012, 0.0, sdSeg(uv * iso, rp * iso, (rp + vec2(0.0, 0.03)) * iso));
                col += vec3(1.0, 0.85, 0.6) * (exp(-dot(rd, rd) * 3.0e6) * 2.0 + trail * 0.35) * fAmt * skyOcc;
            } else {
                float bt = ph - 0.9;
                float R = 0.13 * (1.0 - exp(-bt * 2.4));
                vec2 dd = (uv - B) * iso;
                dd.y -= 0.022 * bt * bt;                                        // ගුරුත්වය
                float N = 36.0;
                float ang = atan(dd.y, dd.x);
                float bin = floor(ang / 6.2831853 * N + 0.5);
                float ab = bin / N * 6.2831853;
                float rk = R * (0.85 + 0.30 * hash(vec2(bin, cyc + fs * 7.0)));
                vec2 pp = vec2(cos(ab), sin(ab)) * rk;
                float fade = exp(-bt * 1.1) * (0.7 + 0.3 * sin(bt * 30.0 + bin));   // දිලිසෙනවා
                float spark = exp(-dot(dd - pp, dd - pp) * 4.0e5);
                float streak = smoothstep(0.0016, 0.0, sdSeg(dd, pp * 0.70, pp)) * 0.9;
                col += (fc * 2.2 + vec3(0.4)) * (spark * 3.0 + streak) * fade * fAmt * skyOcc;
                // පිපිරීමේ flash එක — අහස / පර්වතය එළිය වෙනවා
                col += fc * exp(-bt * 3.0) * exp(-dot(dd, dd) * 20.0) * 0.30 * fAmt;
                // පොකුණේ පිළිබිඹුව (සියුම්)
                vec2 rr = (vec2(uv.x, 2.0 * 0.712 - uv.y) - B) * iso;
                col += fc * exp(-bt * 2.0) * exp(-dot(rr, rr) * 60.0) * 0.12 * water * fAmt;
            }
        }
    }

    col += torchGlow * torchAmt * (1.0 - ghostEnv * 0.55 * step(0.45, noise(vec2(t * 9.0, 4.0))));   // හොල්මනට පන්දම් වෙව්ලනවා                                         // පන්දම් එළිය (මීදුම හරහා)

    // ---- කුරුල්ලෝ (උදේ සහ සවස අහසේ)
    float birdAmt = (uMorning * 0.85 + uEvening + uDawn * 0.35 + uNoon * 0.3) * (1.0 - uRain) * (1.0 - uStorm);
    if (birdAmt > 0.01 && uv.y < 0.48) {
        float period = 46.0;
        float cyc = floor(t / period);
        float ph  = fract(t / period);
        float dirS = hash(vec2(cyc, 11.0)) > 0.5 ? 1.0 : -1.0;
        float baseY = 0.20 + 0.14 * hash(vec2(cyc, 12.0));
        float fx = mix(-0.25, 1.25, ph);
        if (dirS < 0.0) fx = 1.0 - fx;
        float birds = 0.0;
        for (int i = 0; i < 7; i++) {
            float fi = float(i);
            float row = floor((fi + 1.0) / 2.0);
            float side = mod(fi, 2.0) * 2.0 - 1.0;
            vec2 off = vec2(-dirS * row * 0.035, side * row * 0.012 + sin(t * 0.7 + fi) * 0.004);
            vec2 bp = vec2(fx, baseY + sin(ph * 6.2831 + cyc) * 0.02) + off;
            float size = 0.011 * (1.0 - row * 0.06);
            vec2 q = (uv - bp) * iso / size;
            float flap = sin(t * 7.5 + fi * 1.9);
            birds = max(birds, bird(q, flap));
        }
        vec3 bc = mix(vec3(0.06, 0.05, 0.06), vec3(0.18, 0.2, 0.24), uMorning + uNoon);
        col = mix(col, bc, birds * birdAmt * 0.85 * sky);
    }

    // ---- ගිරා රංචුව (උදේට වැඩියෙන්): කොළ පාට, දිගු වලිග, වේගයෙන් ඉගිලෙනවා
    float parAmt = (uMorning + uEvening * 0.5 + uNoon * 0.25) * calm0;
    if (parAmt > 0.02 && uv.y < 0.56) {
        float period = 33.0;
        float pc = floor((t + 13.0) / period);
        float ps = (t + 13.0) - pc * period;
        if (ps < 6.0 && hash(vec2(pc, 95.0)) > 0.25) {
            float dir = hash(vec2(pc, 96.0)) > 0.5 ? 1.0 : -1.0;
            float k = ps / 6.0;
            float baseY = 0.27 + 0.16 * hash(vec2(pc, 97.0));
            float pa = 0.0;
            for (int i = 0; i < 6; i++) {
                float fi = float(i);
                float x = mix(-0.20, 1.25, k) - hash(vec2(fi, 98.0 + pc)) * 0.16 + sin(t * 1.3 + fi * 2.7) * 0.006;
                if (dir < 0.0) x = 1.0 - x;
                vec2 bp = vec2(x, baseY + (hash(vec2(fi, 99.0 + pc)) - 0.5) * 0.06
                                  + sin(t * (2.2 + fi * 0.37) + fi * 1.3) * 0.006 + sin(k * 6.2831 + pc) * 0.012);
                vec2 q = (uv - bp) * iso / 0.0110;
                if (dot(q, q) < 2.5) {
                    q.x *= dir;
                    pa = max(pa, sideBird(q, sin(t * (17.0 + fi * 1.3) + fi * 2.1), 0.19, 0.80, 0.08));
                }
            }
            vec3 gc = vec3(0.20, 0.58, 0.10) * (0.45 + 0.55 * uAmbient);
            col = mix(col, gc, pa * clamp(parAmt * 1.6, 0.0, 1.0));
        }
    }

    // ---- රාජාලියා (බමුණු පියා): දවල්ට සීගිරි පර්වතයට උඩින් තාප සුළඟේ පාවෙනවා —
    //      රවුමේ අරය වෙනස් වෙනවා, හැරෙද්දී ඇල වෙනවා, ඉඳහිට පියාපත් 3–4 පාරක් ගහනවා, පිහාටු හරහා හිරු එළිය
    float eaAmt = (uNoon + uMorning * 0.6 + uEvening * 0.35) * (1.0 - uRain) * (1.0 - uStorm * 0.8);
    if (eaAmt > 0.02 && uv.y < 0.48) {
        float ang = t * 0.24 + sin(t * 0.05) * 0.8;                     // වේගය සෙමින් වෙනස් වෙනවා
        vec2 cc = vec2(0.50 + (noise(vec2(t * 0.013, 4.0)) - 0.5) * 0.16,
                       0.355 + (noise(vec2(t * 0.011, 9.0)) - 0.5) * 0.03);
        float rad = 0.12 * (0.80 + 0.40 * noise(vec2(t * 0.02, 2.0)));
        float sq = 0.38;                                                 // ඈතින් පේන නිසා රවුම ඉලිප්සයක්
        vec2 ep = cc + vec2(cos(ang), sin(ang) * sq) * rad;
        float size = 0.028 * (0.88 + 0.12 * sin(ang));
        vec2 d = (uv - ep) * iso / size;
        if (dot(d, d) < 1.6) {
            vec2 w = vec2(d.x, d.y / 0.58);
            vec2 fwd = vec2(-sin(ang), cos(ang));
            vec2 q = vec2(dot(w, vec2(-fwd.y, fwd.x)), -dot(w, fwd));
            // ඉඳහිට පියාපත් ගැසීම (තත්පර 13කට වරක්, තත්පර 1.4ක්): යටින් බලද්දී පියාපත් කෙටි වෙනවා
            float fc = mod(t + 5.0, 13.0);
            float flapEnv = smoothstep(0.0, 0.2, fc) * smoothstep(1.4, 1.1, fc);
            float span = (0.95 + 0.05 * sin(t * 0.9)) * (1.0 - 0.30 * flapEnv * (0.5 + 0.5 * sin(t * 10.0)));
            float bank = 0.55 * sin(ang) + 0.25 * (noise(vec2(t * 0.3, 7.0)) - 0.5);
            float trans;
            vec4 e = eagle(q, span, bank, trans);
            // යට පැත්ත සෙවණේ (අහසේ එළිය විතරයි), හිරු එළිය පිහාටු හරහා, ඈත නිසා අහසේ පාටට ටිකක් මිශ්‍ර වෙනවා
            vec3 ec = e.rgb * (0.22 + 0.42 * uAmbient);
            ec += e.rgb * uSunCol * uSunAmt * trans * 0.55;
            ec += vec3(0.05, 0.07, 0.10) * uAmbient * smoothstep(0.0, -0.25, q.y);   // අහසෙන් එන නිල් එළිය
            ec = mix(ec, col, 0.14);
            col = mix(col, ec, e.a * clamp(eaAmt, 0.0, 1.0));
        }
    }

    // ---- බත්කූරෝ (පොකුණ උඩ: නවතිනවා → ඉක්මනට පනිනවා) — depth එක අනුව ප්‍රමාණය
    float dfAmt = (uMorning * 0.6 + uNoon + uEvening * 0.7) * (1.0 - uRain) * (1.0 - uStorm);
    if (dfAmt > 0.01 && uv.y > 0.60) {
        for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float dur = 2.2 + hash(vec2(fi, 3.3)) * 1.8;
            float tt = t + fi * 7.3;
            float sgi = floor(tt / dur);
            float f = fract(tt / dur);
            vec2 p0 = vec2(0.25 + 0.62 * hash(vec2(sgi - 1.0, fi)), 0.72 + 0.15 * hash(vec2(fi, sgi - 1.0)));
            vec2 p1 = vec2(0.25 + 0.62 * hash(vec2(sgi, fi)),       0.72 + 0.15 * hash(vec2(fi, sgi)));
            float k = smoothstep(0.0, 0.16, f);
            vec2 dp = mix(p0, p1, k) + vec2(sin(t * 3.1 + fi) * 0.002, sin(t * 4.7 + fi * 2.0) * 0.0015);
            float dz = depthAt(dp) + 0.06;                       // ජලයට ටිකක් උඩින්
            dp += uPar * (dz - uFocus);                          // parallax එකත් එක්ක යනවා
            float size = mix(0.010, 0.040, clamp(dz, 0.0, 1.0)) * (0.85 + 0.3 * hash(vec2(fi, 9.0)));
            vec2 dir = (p1 - p0) * iso;
            float ang = clamp(atan(dir.y, abs(dir.x)), -0.5, 0.5);
            float flip = dir.x < 0.0 ? -1.0 : 1.0;
            vec2 q = (uv - dp) * iso / size;
            if (dot(q, q) < 1.6) {
                q.x *= flip;
                q = rot2(q, -ang * 0.6);
                vec3 bcol = fi < 1.0 ? vec3(0.15, 0.38, 0.85) :
                            fi < 2.0 ? vec3(0.80, 0.16, 0.10) :
                            fi < 3.0 ? vec3(0.22, 0.58, 0.28) : vec3(0.85, 0.62, 0.15);
                vec4 d = dragonfly(q, t + fi, bcol);
                d.rgb *= 0.45 + 0.55 * uAmbient;
                float vis = 1.0 - smoothstep(dz + 0.04, dz + 0.12, sceneZ);   // ගස් පිටිපස්සේ හැංගෙනවා
                col = mix(col, d.rgb, d.a * clamp(dfAmt, 0.0, 1.0) * vis);
            }
        }
    }

    // ---- සමනලයෝ — depth එක අනුව ලොකු/පොඩි, ගස් පිටිපස්සට යනවා, අහඹු ලෙස පාවෙනවා
    float bfAmt = (uMorning + uNoon * 0.8 + uEvening * 0.3) * (1.0 - uRain) * (1.0 - uStorm);
    if (bfAmt > 0.01 && uv.y > 0.56) {
        for (int i = 0; i < 8; i++) {
            float fi = float(i);
            float h1 = hash(vec2(fi, 21.0));
            float h2 = hash(vec2(fi, 37.0));
            float sp = mod(fi, 6.0);         // 0 කහ, 1 කොටි, 2 කළු-සුදු, 3 නිල්, 4 සුදු, 5 කළු-රතු
            float phase = t * (10.0 + 5.0 * h1) + fi * 3.0;
            float glide = smoothstep(0.60, 0.72, noise(vec2(t * 0.4 + fi * 5.0, fi)));
            float open = mix(abs(cos(phase)), 0.90 + 0.08 * sin(t * 2.0 + fi), glide);
            // noise-based ගමන: ඉක්මන් හැරවීම් + සෙමින් පාවීම
            vec2 c = vec2(0.10 + 0.80 * h1, 0.66 + 0.28 * h2);
            vec2 bp = c + vec2((noise(vec2(t * 0.13 + fi * 11.0, fi)) - 0.5) * 0.55,
                               (noise(vec2(t * 0.19 + fi * 5.0, fi + 3.0)) - 0.5) * 0.16)
                        + vec2(0.0, -0.005 * sin(phase) * (1.0 - glide));
            bp.y = clamp(bp.y, 0.60, 0.98);
            float dz = depthAt(bp) + 0.03;
            vec2 bpS = bp + uPar * (dz - uFocus);
            float size = mix(0.0045, 0.030, clamp(dz, 0.0, 1.0)) * (0.8 + 0.4 * h2);
            vec2 q = (uv - bpS) * iso / size;
            if (dot(q, q) < 2.2) {
                // ගමන් කරන දිශාවට ඇල වෙනවා
                float vx = noise(vec2(t * 0.13 + 0.05 + fi * 11.0, fi)) - noise(vec2(t * 0.13 + fi * 11.0, fi));
                q = rot2(q, clamp(vx * 40.0, -0.6, 0.6) + sin(t * 0.8 + fi) * 0.15);
                vec3 base = sp < 1.0 ? vec3(1.0, 0.84, 0.12) :
                            sp < 2.0 ? vec3(0.96, 0.52, 0.10) :
                            sp < 3.0 ? vec3(0.10, 0.10, 0.12) :
                            sp < 4.0 ? vec3(0.30, 0.58, 1.00) :
                            sp < 5.0 ? vec3(0.96, 0.96, 0.92) : vec3(0.12, 0.08, 0.10);
                vec3 edge = sp < 1.0 ? vec3(0.72, 0.52, 0.06) :
                            sp < 2.0 ? vec3(0.10, 0.07, 0.05) :
                            sp < 3.0 ? vec3(0.18, 0.18, 0.20) :
                            sp < 4.0 ? vec3(0.12, 0.20, 0.45) :
                            sp < 5.0 ? vec3(0.80, 0.80, 0.74) : vec3(0.78, 0.14, 0.16);
                float spots = (sp > 0.5 && sp < 3.5) ? 1.0 : 0.0;
                float veins = (sp > 0.5 && sp < 1.5) ? 1.0 : 0.0;
                vec4 b = butterfly(q, open, base, edge, spots, veins);
                // හිරු එළිය පියාපත් හරහා (backlight) + ඈතට යනකොට වාතයේ haze
                b.rgb *= 0.35 + 0.65 * uAmbient;
                b.rgb += base * 0.25 * uSunAmt * (1.0 - open);
                b.rgb = mix(b.rgb, uMistTint * uAmbient, (1.0 - dz) * 0.25);
                float vis = 1.0 - smoothstep(dz + 0.04, dz + 0.12, sceneZ);
                col = mix(col, b.rgb, b.a * 0.95 * clamp(bfAmt, 0.0, 1.0) * vis);
            }
        }
    }

    float calm = (1.0 - uRain) * (1.0 - uStorm);

    // ---- වඳුරෝ (රිළවුන්): ඉඳහිට පොකුණ අයිනේ ගස් වල ගහෙන් ගහට පනිනවා (දවල්ට)
    float monkeyAmt = (uMorning + uNoon + uEvening * 0.7) * calm;
    if (monkeyAmt > 0.05 && uv.y > 0.52 && uv.y < 0.76) {
        for (int i = 0; i < 2; i++) {
            float fi = float(i);
            float period = 23.0 + fi * 9.0;
            float tt = t + fi * 11.0;
            float cyc = floor(tt / period);
            float ph = (tt - cyc * period) / 1.7;                         // පැනීම තත්පර 1.7
            if (ph < 1.0 && hash(vec2(cyc, fi + 40.0)) > 0.25) {
                float dir = hash(vec2(cyc, fi + 41.0)) > 0.5 ? 1.0 : -1.0;
                // පොකුණ දෙපැත්තේ ගස් වල (වම: x 0.15–0.27, දකුණ: x 0.72–0.84) — phone screen එකේත් පේන තැන්, ඇතුළට පනිනවා
                float side = hash(vec2(cyc, fi + 45.0)) > 0.5 ? 1.0 : 0.0;
                vec2 p0 = vec2(mix(0.15, 0.78, side) + 0.06 * hash(vec2(cyc, fi + 42.0)),
                               mix(0.63, 0.60, side) + 0.06 * hash(vec2(cyc, fi + 43.0)));
                dir = side > 0.5 ? -1.0 : 1.0;
                vec2 p1 = p0 + vec2(dir * (0.04 + 0.03 * hash(vec2(cyc, fi + 44.0))), 0.008);
                vec2 mp = mix(p0, p1, ph) - vec2(0.0, sin(ph * 3.14159) * 0.035);
                float dz = depthAt(mp);
                mp += uPar * (dz - uFocus);
                float size = mix(0.010, 0.019, clamp(dz * 1.3, 0.0, 1.0));
                vec2 q = (uv - mp) * iso / size;
                if (dot(q, q) < 12.0) {
                    q.x *= dir;
                    q = rot2(q, (ph - 0.5) * 0.9);
                    float st = sin(ph * 3.14159);
                    float a = monkey(q, st) * smoothstep(0.0, 0.08, ph) * smoothstep(1.0, 0.92, ph);
                    // රිළවා: දුඹුරු-රන්වන් ලොම්, පිටුපස අඳුරුයි
                    vec3 mc = mix(vec3(0.42, 0.30, 0.16), vec3(0.20, 0.14, 0.08), smoothstep(-0.6, 0.6, q.y));
                    col = mix(col, mc * (0.45 + 0.55 * uAmbient), a * monkeyAmt);
                }
            }
        }
    }

    // ---- කොකුන් (සුදු): උදේ සහ සවස පොකුණ දෙසට පියාඹලා බහිනවා
    float egretAmt = (uMorning + uEvening + uDawn * 0.4) * calm;
    if (egretAmt > 0.05 && uv.y < 0.85) {
        float period = 38.0;
        float cyc = floor(t / period);
        float ph = (t - cyc * period) / 14.0;                            // ගමන තත්පර 14
        if (ph < 1.0) {
            float fromLeft = hash(vec2(cyc, 61.0)) > 0.5 ? 1.0 : -1.0;
            for (int i = 0; i < 3; i++) {
                float fi = float(i);
                vec2 start = vec2(0.5 - fromLeft * 0.7, 0.36 + 0.04 * fi);
                vec2 end = vec2(0.42 + 0.12 * fi, 0.74);
                float k = clamp(ph * 1.15 - fi * 0.06, 0.0, 1.0);
                vec2 bp = mix(start, end, k) - vec2(0.0, sin(k * 3.14159) * 0.06);
                float size = mix(0.016, 0.030, k);
                vec2 q = (uv - bp) * iso / size;
                if (dot(q, q) < 4.0) {
                    q.x *= fromLeft;
                    float flap = sin(t * (3.2 + fi * 0.3) + fi) * (1.0 - smoothstep(0.75, 0.95, k));
                    float a = bird(q, flap) * smoothstep(1.0, 0.9, k) * smoothstep(0.0, 0.05, k);
                    // සුදු පිහාටු, යට පැත්ත ලා අළු සෙවණැල්ල (දීප්තිමත් අහසේත් පේන්න)
                    vec3 ec = mix(vec3(0.98, 0.97, 0.94), vec3(0.55, 0.56, 0.58), smoothstep(-0.3, 0.5, q.y));
                    col = mix(col, ec * (0.55 + 0.45 * uAmbient), a * egretAmt);
                }
            }
        }
    }

    // ---- පිළිහුඩුවා: ගහෙන් ඇවිත් ජලයට උඩින් පාවෙලා කිමිදෙනවා, දිය පිපිරීමක් එක්ක මාළුවෙක් අරන් ඉගිලෙනවා
    if (kfAmt > 0.05 && uv.y > 0.50 && uv.y < 0.90) {
        float kc = floor(t / KF_PERIOD);
        float ks = t - kc * KF_PERIOD;
        vec2 W = kfWater(kc);
        if (kfOn(kc) > 0.5 && ks < KF_END + 1.0 && texture2D(uMask, W).g > 0.5) {
            vec2 sh = uPar * (depthAt(W) - uFocus);
            float sp = splash(uv, W + sh, ks - KF_DIVE, 0.017) + splash(uv, W + sh, ks - KF_UP, 0.010) * 0.7;
            col = mix(col, splashC, clamp(sp, 0.0, 1.0) * 0.85 * kfAmt);
            if (ks < KF_DIVE || (ks > KF_UP && ks < KF_END)) {
                vec2 kp = kfPos(kc, ks) + sh;
                vec2 v = (kfPos(kc, ks + 0.05) - kfPos(kc, ks)) * iso;
                if (ks > 2.2 && ks < 3.4) v = vec2(sign(W.x - kfPos(kc, 0.0).x), 0.0);   // පාවෙන විට තිරස්ව
                vec2 n = normalize(v + vec2(1e-6, 0.0));
                vec2 pr = vec2(-n.y, n.x);
                if (n.x < 0.0) pr = -pr;
                vec2 d = (uv - kp) * iso / 0.0150;
                vec2 q = vec2(dot(d, n), dot(d, pr));
                if (dot(q, q) < 2.5) {
                    float flap = ks < 2.2 ? sin(t * 24.0) : ks < 3.4 ? sin(t * 42.0) : ks < KF_DIVE ? 0.15 : sin(t * 26.0);
                    float a = sideBird(q, flap, 0.26, 0.16, 0.42);
                    a *= smoothstep(0.0, 0.3, ks) * smoothstep(KF_END, KF_END - 0.4, ks);
                    vec3 kcol = vec3(0.06, 0.46, 0.88);                                         // දිලිසෙන නිල් පිට
                    float belly = smoothstep(0.0, 0.07, q.y) * smoothstep(1.0, 0.85, length((q - vec2(0.05, 0.04)) / vec2(0.50, 0.24)));
                    kcol = mix(kcol, vec3(0.92, 0.46, 0.12), belly);                                            // තැඹිලි පපුව
                    kcol = mix(kcol, vec3(0.95, 0.93, 0.88), smoothstep(0.09, 0.04, length(q - vec2(0.40, 0.07))));    // සුදු උගුර
                    kcol = mix(kcol, vec3(0.08, 0.06, 0.05), step(0.60, q.x) * step(abs(q.y + 0.03), 0.08));          // හොට
                    col = mix(col, kcol * (0.35 + 0.65 * uAmbient), a * kfAmt);
                }
            }
        }
    }

    // ---- මොනරා: පොකුණේ වම් පැත්තේ තණ තීරුවේ හිමින් ඇවිදිනවා, නවතිලා බිම කොටනවා, ඉඳහිට පිල් විදහලා සොලවනවා
    float peaAmt = (uMorning + uNoon * 0.7 + uEvening * 0.6) * calm;
    if (peaAmt > 0.05 && uv.y > 0.66 && uv.y < 0.82) {
        float vel = cos(t * 0.05);
        vec2 pp = vec2(0.165 + sin(t * 0.05) * 0.022, 0.758);
        float dz = depthAt(pp);
        pp += uPar * (dz - uFocus);
        float size = 0.0085;
        vec2 q = (uv - pp) * iso / size;
        if (dot(q, q) < 26.0) {
            q.x *= vel > 0.0 ? 1.0 : -1.0;
            float dc = mod(t, 47.0);
            float disp = smoothstep(30.0, 32.5, dc) * smoothstep(42.0, 39.5, dc);
            float pc = mod(t, 9.0);
            float peck = (1.0 - disp) * smoothstep(6.4, 6.8, pc) * smoothstep(8.1, 7.6, pc)
                       * (0.75 + 0.25 * sin(t * 9.0));
            float wAmt = clamp(abs(vel) * 1.5, 0.0, 1.0) * (1.0 - disp) * (1.0 - peck);
            // බිමේ සෙවණැල්ල (හිරු එළියේ තදයි)
            float trainS = 1.0 - disp;
            vec2 sq2 = vec2((q.x + 0.9 * trainS) / (0.9 + 1.4 * trainS + 1.2 * disp), (q.y - 1.15) / 0.17);
            col *= 1.0 - exp(-dot(sq2, sq2)) * (0.12 + 0.30 * uSunAmt) * peaAmt;
            vec4 pk = peacock(q, disp, t, t * 4.5, wAmt, peck);
            vec3 pcol = pk.rgb * (0.28 + 0.72 * uAmbient) + pk.rgb * uSunCol * uSunAmt * 0.25;
            pcol = mix(pcol, col, 0.06);                                    // වාතයේ haze
            col = mix(col, pcol, pk.a * peaAmt);
        }
    }

    // ---- වවුලෝ: සවස් වෙලාවේ සහ රෑ මුලට අහසේ අවුල් සහගතව පියාඹනවා
    float batAmt = (uEvening * 0.8 + uNight * 0.6) * (1.0 - uRain);
    if (batAmt > 0.05 && uv.y < 0.5) {
        float bats = 0.0;
        for (int i = 0; i < 7; i++) {
            float fi = float(i);
            vec2 bp = vec2(0.1 + 0.8 * noise(vec2(t * 0.09 + fi * 7.0, fi)),
                           0.12 + 0.28 * noise(vec2(fi * 3.0, t * 0.13 + fi)));
            bp += vec2(sin(t * 2.3 + fi * 4.0), cos(t * 3.1 + fi)) * 0.006;
            vec2 q = (uv - bp) * iso / 0.006;
            if (dot(q, q) < 4.0) bats = max(bats, bird(q, sin(t * 16.0 + fi * 2.0)));
        }
        col = mix(col, vec3(0.04, 0.035, 0.05), bats * batAmt * 0.9);
    }

    // ---- අවුරුදු: එරබදු මල් පෙති සුළඟේ පාවී වැටෙනවා (දවල්ට)
    if (uAvurudu > 0.5 && uv.y > 0.45) {
        float pAmt = (uMorning + uNoon + uEvening) * (1.0 - uRain);
        for (int i = 0; i < 30; i++) {
            float fi = float(i);
            float h1 = hash(vec2(fi, 71.0));
            float sp = 0.03 + 0.03 * h1;
            float y = fract(hash(vec2(fi, 72.0)) + uWindT * sp);
            float cyc = floor(hash(vec2(fi, 72.0)) + uWindT * sp);
            vec2 pp = vec2(fract(hash(vec2(fi, cyc)) + uWindT * 0.02 + sin(uWindT * 0.8 + fi) * 0.02), 0.45 + y * 0.55);
            float dz = mix(0.2, 1.0, hash(vec2(cyc, fi + 5.0)));
            float size = mix(0.004, 0.013, dz);
            vec2 q = (uv - pp) * iso / size;
            if (dot(q, q) < 4.0) {
                q = rot2(q, uWindT * (2.0 + 3.0 * h1) + fi);
                float pe = smoothstep(1.0, 0.7, length(q * vec2(1.0, 2.2)));
                col = mix(col, vec3(0.85, 0.12, 0.08) * (0.45 + 0.55 * uAmbient), pe * pAmt * 0.95);
            }
        }
    }

    // ---- සුළඟට ගස් වලින් කොළ ගැලවිලා කැරකි කැරකී වැටෙනවා (තද සුළඟට ගොඩක්)
    float lfAmt = smoothstep(0.30, 0.85, uWind) * (1.0 - uRain * 0.6) * 0.6 + uStorm * 0.6;
    if (lfAmt > 0.02 && uv.y > 0.50) {
        for (int i = 0; i < 18; i++) {
            float fi = float(i);
            float life = 6.0 + 4.0 * hash(vec2(fi, 101.0));
            float tt = t + hash(vec2(fi, 102.0)) * life;
            float cy = floor(tt / life);
            float k = (tt - cy * life) / life;
            if (hash(vec2(cy, fi + 103.0)) > lfAmt) continue;
            float src = hash(vec2(cy, fi + 104.0));
            float hx = hash(vec2(cy, fi + 105.0)), hy = hash(vec2(fi, cy + 106.0));
            vec2 p0 = src < 0.4 ? vec2(0.02 + 0.24 * hx, 0.56 + 0.12 * hy)
                    : src < 0.75 ? vec2(0.74 + 0.24 * hx, 0.62 + 0.12 * hy)
                    : vec2(0.02 + 0.40 * hx, 0.82 + 0.06 * hy);
            float dz = depthAt(p0);
            float fall = mix(0.10, 0.22, dz);
            vec2 lp = p0 + vec2(k * (0.05 + 0.10 * uWind + 0.15 * uStorm) + sin(k * 12.0 + fi) * 0.012, k * fall);
            lp += uPar * (dz - uFocus);
            float size = mix(0.0085, 0.022, dz);
            vec2 q = (uv - lp) * iso / size;
            if (dot(q, q) < 4.0) {
                float spin = t * (2.0 + 3.0 * hash(vec2(fi, 107.0))) + fi;
                q = rot2(q, spin * 0.6);
                q.x /= max(abs(cos(spin)), 0.2);                                // 3D වගේ පෙරළෙනවා
                float lf = smoothstep(1.0, 0.8, length(q * vec2(1.0, 1.9)) + abs(q.x) * 0.12);
                lf *= smoothstep(0.0, 0.08, k) * smoothstep(1.0, 0.85, k);
                // වියළි කොළ: කහ / තැඹිලි / දුඹුරු (කොළ පාට ගස් උඩින් පේන්න), ඉඳහිට කොළ පාටක්
                float hc = hash(vec2(fi, 108.0));
                vec3 lc3 = hc < 0.35 ? vec3(0.92, 0.74, 0.22) : hc < 0.65 ? vec3(0.86, 0.46, 0.14)
                         : hc < 0.88 ? vec3(0.58, 0.36, 0.16) : vec3(0.50, 0.66, 0.18);
                lc3 *= (0.40 + 0.65 * uAmbient) * (0.70 + 0.30 * cos(spin));
                lc3 += uSunCol * uSunAmt * 0.15 * max(sin(spin), 0.0);                     // පෙරළෙනකොට දිලිසෙනවා
                col = mix(col, lc3, lf * min(lfAmt * 1.5, 1.0) * 0.95);
            }
        }
    }

    // ---- වෙසක් කූඩු: රෑට ගස් වල එල්ලලා, සුළඟට පැද්දෙනවා, ඇතුළේ පහන දැල්වෙනවා
    float nightish = uNight + uEvening * 0.4;
    if (uVesak > 0.5 && nightish > 0.05) {
        for (int i = 0; i < 5; i++) {
            float fi = float(i);
            vec2 lp = fi < 1.0 ? vec2(0.10, 0.63) : fi < 2.0 ? vec2(0.90, 0.66) : fi < 3.0 ? vec2(0.24, 0.71)
                    : fi < 4.0 ? vec2(0.79, 0.60) : vec2(0.52, 0.66);
            float dz = depthAt(lp);
            lp += uPar * (dz - uFocus);
            float size = mix(0.018, 0.042, clamp(dz, 0.0, 1.0));
            lp.x += sin(t * 0.9 + fi * 2.0) * size * 0.25 * (0.5 + uWind);
            vec2 q = (uv - lp) * iso / size;
            float fl = 0.85 + 0.15 * sin(t * 7.0 + fi * 3.0) * sin(t * 3.3 + fi);
            vec3 c1 = fi < 1.0 ? vec3(1.0, 0.2, 0.15) : fi < 2.0 ? vec3(1.0, 0.8, 0.15) : fi < 3.0 ? vec3(0.2, 0.75, 0.3)
                    : fi < 4.0 ? vec3(0.25, 0.45, 1.0) : vec3(1.0, 0.45, 0.8);
            vec3 c2 = vec3(1.0, 0.95, 0.8);
            col += c1 * exp(-dot(q, q) * 0.12) * 0.30 * fl * nightish;                 // ආලෝක වළල්ල
            if (dot(q, q) < 40.0) {
                vec4 ln = lantern(q, c1, c2, fl);
                col = mix(col, ln.rgb * (0.7 + 0.5 * fl), ln.a * nightish);
            }
        }
    }

    // ---- පොහොය: පොකුණු බැම්ම දිගේ තෙල් පහන් (රෑට), ජලයේ පිළිබිඹු එක්ක
    if (uPoya > 0.5 && nightish > 0.05) {
        vec3 lamps = vec3(0.0);
        for (int i = 0; i < 12; i++) {
            float fi = float(i);
            vec2 lp = fi < 7.0 ? vec2(0.31 + fi * 0.066, 0.711) : vec2(0.47 + (fi - 7.0) * 0.06, 0.873);
            float dz = depthAt(lp);
            lp += uPar * (dz - uFocus);
            float fl = 0.75 + 0.25 * sin(t * (9.0 + fi) + fi * 5.0) * sin(t * 4.1 + fi);
            vec2 d = (uv - lp) * iso;
            lamps += vec3(1.0, 0.62, 0.22) * (exp(-dot(d, d) * 3.5e5) * 2.0 + exp(-dot(d, d) * 8.0e3) * 0.45) * fl;
            // ජලයේ පිළිබිඹුව (සිරස් දිගු ඉරක්)
            vec2 rd = (uv - lp - vec2(0.0, 0.018)) * vec2(1.0, 0.25) * iso;
            float wob = sin(uv.y * 400.0 - t * 3.0) * 0.0008;
            rd.x += wob;
            lamps += vec3(1.0, 0.6, 0.25) * exp(-dot(rd, rd) * 1.2e5) * 0.6 * fl * water;
        }
        col += lamps * nightish;
    }

    // ---- කළාමැදිරියෝ (රෑට) — depth එක අනුව ප්‍රමාණය + parallax
    float ffAmt = uNight + uEvening * 0.25 + uDawn * 0.35;
    if (ffAmt > 0.01 && uv.y > 0.52) {
        vec3 glow = vec3(0.0);
        for (int i = 0; i < 26; i++) {
            float fi = float(i);
            vec2 base = vec2(hash(vec2(fi, 1.3)), 0.58 + 0.40 * hash(vec2(fi, 4.1)));
            vec2 p = base + vec2(sin(t * 0.13 * (1.0 + hash(vec2(fi, 2.0))) + fi) * 0.05,
                                 sin(t * 0.21 * (1.0 + hash(vec2(fi, 8.0))) + fi * 1.7) * 0.018);
            float dz = smoothstep(0.55, 1.02, p.y);          // පහළට එනකොට ළඟයි (texture lookups ඉතුරු කරන්න)
            p += uPar * (dz - uFocus);
            float s = mix(0.45, 1.7, dz);
            vec2 d = (uv - p) * iso / s;
            float r2 = dot(d, d);
            float blink = smoothstep(0.1, 1.0, sin(t * (0.6 + hash(vec2(fi, 5.0))) + fi * 3.0));
            glow += vec3(0.80, 1.0, 0.40) * (exp(-r2 * 22000.0) * 1.2 + exp(-r2 * 1200.0) * 0.22) * blink;
        }
        col += glow * ffAmt;
    }

    // ---- තද සුළඟ: බිමින් දූවිලි ඇවිස්සෙනවා + කොළ / අතු කෑලි ඉගිලෙනවා
    if (uStorm > 0.01) {
        float dry = 1.0 - uRain * 0.85;                                      // තෙත් බිමෙන් දූවිලි අඩුයි
        float pulse = 0.45 + 0.55 * smoothstep(0.3, 0.8, noise(vec2(uWindT * 0.35, 7.1)));
        // බිම ළඟ දූවිලි රොටු (සුළං දිශාවට වේගයෙන් ගලනවා, උඩට කැරකෙනවා)
        vec2 dp = vec2(uv.x * 2.6 - uWindT * 0.55, uv.y * uAspect * 5.0 + sin(uWindT * 0.4 + uv.x * 3.0) * 0.35);
        float d1 = fbm(dp + vec2(fbm(dp * 0.7 + vec2(uWindT * 0.2, 0.0)) * 1.6, 0.0));
        float plume = smoothstep(0.42, 0.85, d1);
        float low = smoothstep(0.48, 0.80, uv.y);                            // බිම ළඟ ඝනයි
        float bare = smoothstep(0.0, 0.07, col.r - col.g * 0.97) * (1.0 - water); // පස් / පාරවල්
        vec3 dustCol = vec3(0.80, 0.68, 0.52) * (0.45 + 0.55 * uAmbient);
        float dust = (plume * low * (0.65 + 0.9 * bare) + plume * 0.22 + 0.10) * (1.0 - sky * 0.5);
        col = mix(col, dustCol, clamp(dust * uStorm * dry * pulse, 0.0, 0.62));
        // දූවිලි ඉරි (ඉක්මනට ගලන සියුම් ධාරා)
        float sl = fbm(vec2(uv.x * 5.0 - uWindT * 1.6, uv.y * uAspect * 18.0));  // දූවිලි ධාරා
        col = mix(col, dustCol * 1.1, smoothstep(0.55, 0.85, sl) * low * 0.22 * uStorm * dry);

        // ඉගිලෙන කොළ (ඈත පොඩියි, ළඟ ලොකුයි, කැරකෙනවා)
        for (int i = 0; i < 14; i++) {
            float fi = float(i);
            float h1 = hash(vec2(fi, 41.0));
            float h2 = hash(vec2(fi, 57.0));
            float spd = 0.10 + 0.14 * h1;
            float x = fract(h2 + uWindT * spd) * 1.3 - 0.15;
            float cyc = floor(h2 + uWindT * spd);
            float y = 0.42 + 0.52 * hash(vec2(fi, cyc)) + sin(uWindT * (2.0 + h1 * 3.0) + fi) * 0.025;
            float dz = 0.2 + 0.8 * hash(vec2(cyc, fi + 3.0));
            float size = mix(0.0035, 0.014, dz);
            vec2 q = (uv - vec2(x, y)) * iso / size;
            if (dot(q, q) < 4.0) {
                q = rot2(q, uWindT * (6.0 + 8.0 * h1) + fi);
                float lf = smoothstep(1.0, 0.75, length(q * vec2(1.0, 2.6)));
                vec3 lc = mix(vec3(0.30, 0.36, 0.12), vec3(0.45, 0.30, 0.12), hash(vec2(fi, 9.0))) * (0.4 + 0.6 * uAmbient);
                col = mix(col, lc, lf * uStorm * 0.9);
            }
        }
    }

    // ---- වැස්ස: ඈත වැහි තිරය (haze) + වැහි ඉරි layers 3ක් (ඈත සියුම්, ළඟ ලොකු සහ වේගවත්)
    if (uRain > 0.01) {
        float farR = 1.0 - smoothstep(0.0, 0.7, sceneZ);
        vec2 hp = vec2(uv.x * 3.0 + t * 0.25, uv.y * 2.0 - t * 0.05);
        float curtain = 0.75 + 0.25 * fbm(hp);                                  // වැහි තිරය ගලනවා
        vec3 hazeCol = uMistTint * (0.62 + 0.38 * uAmbient);
        // ඈත කඳු සහ ක්ෂිතිජය වැහි තිරයෙන් වැසෙනවා (අහසේ mask එකේ දාරය හැංගෙන්නත්)
        float horizon = smoothstep(0.30, 0.44, uv.y) * (1.0 - smoothstep(0.50, 0.62, uv.y));
        float hz = clamp(0.12 + 0.50 * farR * (1.0 - sky) + 0.55 * horizon * farR, 0.0, 0.85);
        col = mix(col, hazeCol, uRain * hz * curtain * (1.0 - 0.7 * eleMask));

        vec2 sp = vec2(suv.x, suv.y * uScrAspect);
        sp.x += sp.y * (0.10 + 0.08 * uWind + 0.30 * uStorm);                                   // සුළඟට ඇලවෙලා
        float r1 = rainLayer(sp, 150.0, 9.0, 34.0, 0.07, 0.55, t);              // ඈත
        float r2 = rainLayer(sp + 0.31, 85.0, 8.0, 26.0, 0.06, 0.38, t);        // මැද
        float r3 = rainLayer(sp + 0.77, 42.0, 7.0, 17.0, 0.05, 0.22, t);        // ළඟ
        vec3 dropCol = mix(vec3(0.70, 0.75, 0.82), vec3(0.92, 0.95, 1.0), uAmbient);
        float streak = r1 * 0.16 + r2 * 0.26 + r3 * 0.34;
        col = mix(col, dropCol, clamp(streak * uRain, 0.0, 0.6));

        // (අකුණු පහළින් වෙනම — uThunder)
    }

    // ---- අකුණු: දිලිසෙන ඉර (දෙබල් වෙන), මුළු අහසම එළිය වෙන flash එක, පොකුණේ පිළිබිඹුව
    if (uThunder > 0.05) {
        float period = 6.5;
        float lc = floor(t / period);
        float lph = t - lc * period;
        if (hash(vec2(lc, 3.3)) > 0.3 && lph < 1.0) {
            float fl = exp(-lph * 7.0) + 0.75 * exp(-abs(lph - 0.22) * 24.0) + 0.45 * exp(-abs(lph - 0.48) * 30.0);
            float yb = 0.38 + 0.08 * hash(vec2(lc, 8.0));
            vec2 a = vec2(0.12 + 0.76 * hash(vec2(lc, 5.1)), 0.0);
            float dmin = 1e3;
            vec2 branchFrom = a;
            for (int i = 1; i <= 9; i++) {
                float fi = float(i);
                vec2 b = vec2(a.x + (hash(vec2(lc, fi * 1.7)) - 0.5) * 0.07, fi / 9.0 * yb);
                dmin = min(dmin, sdSeg(uv * iso, a * iso, b * iso));
                if (i == 4) branchFrom = b;
                a = b;
            }
            // එක අත්තක්
            vec2 c = branchFrom;
            for (int i = 1; i <= 3; i++) {
                float fi = float(i);
                vec2 d = c + vec2((hash(vec2(lc, fi + 20.0)) > 0.5 ? 1.0 : -1.0) * 0.03, 0.04);
                dmin = min(dmin, sdSeg(uv * iso, c * iso, d * iso) * 1.6);
                c = d;
            }
            float bolt = exp(-dmin * 1400.0) * 1.6 + exp(-dmin * 120.0) * 0.30;
            vec3 lcol = vec3(0.85, 0.88, 1.0);
            col += lcol * bolt * fl * uThunder * smoothstep(0.0, 0.4, sky + 0.2 * (1.0 - smoothstep(0.35, 0.5, uv.y)));
            col += lcol * fl * 0.16 * uThunder * (0.35 + 0.65 * sky);                 // මුළු අහසම
            col += lcol * fl * 0.20 * uThunder * water;                               // පොකුණේ පිළිබිඹුව
        }
    }

    // ---- සිනමා පෙනුම: bloom, filmic contrast, teal-orange, anamorphic flare, grain
    if (uCine > 0.5) {
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col += max(col - 0.70, 0.0) * 0.6;                                   // highlights දිලිසෙනවා
        col = clamp(col, 0.0, 1.2);
        col = mix(col, col * col * (3.0 - 2.0 * min(col, 1.0)), 0.32);       // S-curve contrast
        col += vec3(-0.020, 0.020, 0.050) * (1.0 - smoothstep(0.0, 0.55, l)); // සෙවණැලි teal
        col += vec3(0.065, 0.025, -0.035) * smoothstep(0.40, 1.0, l);         // එළිය තැඹිලි
        col = mix(vec3(l), col, 0.90);                                         // සියුම් desat
        // anamorphic තිරස් flare (හිරු / සඳ)
        float sy = (uv.y - uSunPos.y) * uAspect;
        float fl = exp(-sy * sy * 6000.0) * exp(-abs(uv.x - uSunPos.x) * 2.2) * uSunAmt * 1.6;
        float my = (uv.y - uMoonPos.y) * uAspect;
        float mf = exp(-my * my * 9000.0) * exp(-abs(uv.x - uMoonPos.x) * 3.0) * uNight * 0.45;
        col += uSunCol * fl * 0.35 + vec3(0.55, 0.72, 1.0) * (fl * 0.15 + mf);
        // film grain (හැම frame එකකම වෙනස්)
        float gr = hash(floor(suv * vec2(900.0, 1900.0)) + fract(t * 7.13) * 97.0) - 0.5;
        col += gr * 0.05 * (0.4 + 0.6 * (1.0 - l));
        col = max(col - 0.012, 0.0);                                          // කළු ගැඹුරුයි
    }

    // ---- අකුරු පේන්න text එක පිටුපස සියුම් අඳුරක්
    float ty = (suv.y - uTextY) / 0.19;                 // යටින් එන පොඩි පේළිත් ආවරණය වෙන්න
    float shade = exp(-ty * ty) * (0.12 + 0.16 * (uNoon + uMorning * 0.8 + uDawn * 0.6 + uEvening * 0.5));
    col *= 1.0 - shade;

    // ---- vignette (සිනමා පෙනුමේ දී වැඩියි)
    vec2 vq = (suv - 0.5) * vec2(1.0, 1.15);
    col *= mix(1.0, smoothstep(1.15, 0.30, length(vq)), mix(0.28, 0.48, uCine));

    gl_FragColor = vec4(col, 1.0);
}
