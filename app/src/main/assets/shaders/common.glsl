// පොදු functions: noise, සමනලයා, බත්කූරා, කුරුල්ලා (shaders දෙකටම)
// ---------------------------------------------------------------- noise
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

vec2 rot2(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// ---------------------------------------------------------------- සමනලයා
// එක පියාපතක්: base පාට, දාරයේ පාට, දාරයේ සුදු තිත්, නහර
vec4 bfWing(vec2 q, vec2 c, vec2 r, float rot, vec3 base, vec3 edge, float spots, float veins) {
    vec2 d = rot2(q - c, rot) / r;
    float rr = length(d);
    float a = smoothstep(1.0, 0.78, rr);                    // මෘදු දාරය (outline නෑ)
    if (a <= 0.0) return vec4(0.0);
    float ang = atan(d.y, d.x);
    vec3 col = mix(base, edge, smoothstep(0.70, 0.95, rr) * 0.85);
    col = mix(col, edge, veins * 0.7 * smoothstep(0.85, 0.98, abs(sin(ang * 5.0))) * smoothstep(0.25, 0.5, rr));
    float sp = step(0.68, rr) * step(rr, 0.80) * smoothstep(0.25, 0.10, abs(fract(ang * 1.9) - 0.5));
    col = mix(col, vec3(0.95, 0.94, 0.88), spots * sp * 0.8);
    // පියාපතේ ස්වභාවික වර්ණ වෙනස (මුල අඳුරු, මැද එළිය, පොඩි texture එකක්)
    col *= mix(0.62, 1.05, smoothstep(0.0, 0.55, rr)) * (0.92 + 0.08 * sin(rr * 25.0 + ang * 3.0));
    return vec4(col, a * 0.96);
}

// q: local (size එකෙන් බෙදපු, හිස -y පැත්තට), open: 0 (වැහිලා) .. 1 (ඇරිලා)
vec4 butterfly(vec2 q, float open, vec3 base, vec3 edge, float spots, float veins) {
    float s = mix(0.10, 1.0, open);                         // පියාපත් ගහනකොට 3D වගේ හැකිලෙනවා
    vec2 wq = vec2(abs(q.x) / s, q.y);
    vec4 fw = bfWing(wq, vec2(0.52, -0.22), vec2(0.62, 0.40), -0.50, base, edge, spots, veins);
    vec4 hw = bfWing(wq, vec2(0.40,  0.30), vec2(0.42, 0.33),  0.55, base * 0.88, edge, spots * 0.6, veins);
    vec3 wc = mix(hw.rgb, fw.rgb, fw.a);
    float wa = max(fw.a, hw.a);
    wc *= 0.65 + 0.35 * open;                               // ඇලවෙනකොට එළිය අඩුයි
    float body = smoothstep(1.0, 0.6, length(q / vec2(0.065, 0.44)));
    float head = smoothstep(1.0, 0.5, length((q - vec2(0.0, -0.48)) / 0.08));
    vec2 aq = vec2(abs(q.x), q.y + 0.52);                   // ඇන්ටෙනා (සියුම්)
    float ant = smoothstep(0.03, 0.0, abs(aq.x - (-aq.y) * 0.45)) * step(aq.y, 0.0) * step(-0.36, aq.y) * 0.6;
    float b = max(max(body, head), ant);
    return vec4(mix(wc, vec3(0.10, 0.08, 0.07), b), max(wa, b));
}

// ---------------------------------------------------------------- බත්කූරා
// q: local (size එකෙන් බෙදපු, හිස +x පැත්තට)
vec4 dragonfly(vec2 q, float t, vec3 bodyCol) {
    // බඩ (දිගයි, සිහින්, කොටස් කොටස්)
    float th = mix(0.035, 0.065, smoothstep(-1.0, 0.1, q.x));
    float ab = smoothstep(th, th * 0.45, abs(q.y)) * smoothstep(-1.06, -0.98, q.x) * smoothstep(0.2, 0.12, q.x);
    float seg = 0.78 + 0.22 * smoothstep(0.35, 0.5, abs(fract(q.x * 9.0) - 0.5));
    float thorax = smoothstep(1.0, 0.6, length((q - vec2(0.22, 0.0)) / vec2(0.15, 0.095)));
    float head = smoothstep(1.0, 0.5, length((q - vec2(0.41, 0.0)) / vec2(0.075, 0.10)));
    float body = max(ab, max(thorax, head));
    // දිලිසෙන ඇඟ (උඩ පැත්තේ highlight එකක්)
    float gloss = smoothstep(0.0, -th * 0.8, q.y) * 0.35;
    vec3 bc = bodyCol * mix(seg, 1.0, max(thorax, head)) + gloss * ab;
    bc = mix(bc, bodyCol * 0.35, head * 0.7);           // ලොකු ඇස්
    // පියාපත් 4 — සිහින්, විනිවිද, ටිකක් පිටිපස්සට නැවිලා
    vec2 wq = vec2(q.x - 0.22, abs(q.y));
    float flut = 0.8 + 0.2 * sin(t * 90.0 + q.y * 5.0);
    float w1 = smoothstep(1.0, 0.7, length(rot2(wq - vec2(0.02, 0.33), 0.22) / vec2(0.06, 0.32)));
    float w2 = smoothstep(1.0, 0.7, length(rot2(wq - vec2(-0.11, 0.31), 0.40) / vec2(0.07, 0.30)));
    float vein = 0.85 + 0.15 * sin(wq.y * 60.0);
    float wa = max(w1, w2) * 0.26 * flut * vein;
    float irid = 0.5 + 0.5 * sin(wq.y * 14.0 + t * 1.5);
    vec3 wc = mix(vec3(0.80, 0.92, 1.0), vec3(0.95, 0.88, 1.0), irid) * 1.15;
    vec3 c = mix(wc, bc, body);
    return vec4(c, max(wa, body));
}

// ---------------------------------------------------------------- කුරුල්ලා (silhouette)
float bird(vec2 q, float flap) {
    float x = abs(q.x);
    if (x > 1.0) return 0.0;
    float y = q.y + flap * 0.55 * x - 0.35 * x * x;
    float th = 0.16 * (1.0 - x) + 0.03;
    return smoothstep(th, th * 0.4, abs(y));
}

