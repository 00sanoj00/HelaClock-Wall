# සිංහල වේලාව – Live Wallpaper (Project Notes)

> අලුත් session එකක් පටන් ගන්නකොට මුලින්ම මේ file එක කියවන්න.
> අන්තිම update: 2026-11-21 (v1.1: දින දර්ශනය, ඇත්ත කාලගුණය, උත්සව, සතුන්, battery saver, Play Store)

## 1. Project එක මොකක්ද

Android live wallpaper එකක්. වෙලාව කතා කරන සිංහලෙන් පෙන්වනවා, උදා. **"වේලාව දහවල් එකයි"**.
පිටිපස්සේ සීගිරිය photo 5ක් දවසේ වෙලාව අනුව crossfade වෙනවා.

- Package: `lk.sinhala.welawa`, app නම: SinhalaWelawa
- Text එක screen එකේ මැදට ටිකක් උඩින්.

## 2. User ගේ නීති (කඩන්න එපා)

- **Wallpaper එකේ වෙලාව සිංහලෙන් විතරයි.**
- **App එකේ settings UI එක English** (2026-11-21 user ඉල්ලුවා: සිංහල වචන තේරුම් ගන්න අමාරුයි කියලා). System font එක, FM converter එක නෑ.
- **දැන්වීම් නෑ, tracking නෑ, නොමිලේ.** Network එක පාවිච්චි වෙන්නේ user "Live weather" on කළොත් විතරයි (default Off, 2026-11-21 user අනුමත කළා).
- **Realistic / cinematic** පෙනුම. කාටූන් වගේ low quality එපා.
- **Unicode සිංහල fonts එපා** (කැතයි කියනවා). Legacy FM fonts පාවිච්චි කරන්න. හැම string එකක්ම FM converter එක හරහා යන්න ඕනේ.
- **"හදපන්" කියනකම් build කරන්න පටන් ගන්න එපා.** අලුත් feature එකකට කලින් අදහස කතා කරලා, ප්‍රශ්න සිංහලෙන් අහන්න.
- User කතා කරන්නේ casual සිංහලෙන් ("මචං", "උඹ"). උත්තරත් ඒ විදිහටම.
- Code එකෙන් අඳින (procedural/raymarched) 3D සීගිරිය **reject කළා** ("සැටිස් නෑ"). ආයෙත් යෝජනා කරන්න එපා, user ඉල්ලුවොත් මිසක්.

## 3. කාල කොටස් සහ images

| කොටස | වෙලාව | Image |
|---|---|---|
| පාන්දර | 4:00 – 6:00 | base_image/1.jpg |
| උදේ | 6:00 – 12:00 | base_image/2.jpg |
| දහවල් | 12:00 – 2:00 | base_image/3.jpg |
| සවස | 2:00 – 6:30 | base_image/4.jpg |
| රාත්‍රී | 6:30 – 4:00 | base_image/5.jpg |

Images 5ම AI වලින් user හදපු ඒවා. Rock එක, පොකුණ, තල් ගස් හැම එකකම එකම තැන.

## 4. වෙලාව කියන නීති (`SinhalaTime.kt`)

| විනාඩි | උදාහරණය (1 ට) |
|---|---|
| :00 | එකයි |
| :15 | එකයි කාලයි |
| :20 | එකයි විස්සයි |
| :30 | එක හමාරයි |
| :40 | එකයි හතළිහයි |
| :50 | දෙකට විනාඩි දහයයි |
| :55 | දෙකට විනාඩි පහයි |
| අනිත් | එක පසුවී විනාඩි පහයි |

උදා: 5:52 AM → "වේලාව පාන්දර පහ පසුවී විනාඩි පනස් දෙකයි". Unit tests: `app/src/test/.../SinhalaTimeTest.kt`.

## 5. Code structure

| File | වැඩේ |
|---|---|
| `SinhalaTime.kt` | වෙලාව සිංහල වචන වලට |
| `FmConverter.kt` | Unicode සිංහල → FM font encoding |
| `TextPainter.kt` | Text එක bitmap එකකට අඳිනවා. Styles, fonts, අකුරෙන් අකුර අඳින එක |
| `SceneState.kt` | වෙලාව අනුව images 5 blend weights සහ effect weights |
| `SceneRenderer.kt` | OpenGL renderer, depth parallax, tilt |
| `TiltSensor.kt` | ෆෝන් එක ඇලවීම (screen on විතරයි) |
| `WelawaWallpaperService.kt` | Wallpaper service. Screen off වුණාම නවතිනවා, 30fps limit |
| `MainActivity.kt` | Preview app + සැකසුම් + "බිතුපත ලෙස සකසන්න" button |
| `Settings.kt` | SharedPreferences |
| `assets/shaders/scene.frag`, `common.glsl` | Effects shader එක |
| `assets/scenes/sigiriya/mask.png` | R = අහස, G = පොකුණ, B = depth (1 = ළඟ) |

**Build:** `base_image/` සහ `font/` folders build එකේදී ඉබේම assets වලට sync වෙනවා. Image එකක් මාරු කරන්න folder එකේ file එක replace කළාම ඇති.

- Kotlin 2.2.0, AGP 8.10.0, compileSdk 35, minSdk 24, JVM 17
- SDK: `/home/rtxpc/Software/AndroidStudio/SDK`
- Release එක debug key එකෙන් sign වෙනවා (sideload කරන්න).
- Emulator: Fire_7 VM, `adb connect 127.0.0.1:6555`

```
./gradlew test assembleRelease
adb -s 127.0.0.1:6555 install -r app/build/outputs/apk/release/app-release.apk
```

## 6. ඉවර කරපු දේවල්

- සිංහල වේලාව, FM converter, tests, APK, emulator install.
- Effects: මීදුම, චලනය වෙන වලාකුළු, සමනලුන් (depth අනුව size), බත්කූරෝ, පොකුණේ වතුර චලනය. වෙලාව අනුව වෙනස් වෙනවා.
- **Depth parallax:** Depth Anything V2 model එක PC එකේ run කරලා depth map එක හැදුවා (build time විතරයි, app එකේ model එක නෑ). Tilt + home screen scroll + සෙමින් "හුස්ම ගන්න" චලනය.
- **Cinematic look** option එක.
- **Settings live update** (2026-11-21): Settings මාරු කළාම wallpaper එක ආයේ apply නොකර ඉබේම වෙනස් වෙනවා. පරණ SharedPreferences listener එක weak reference එකක් නිසා release build එකේ GC වෙලා නැති වුණා. දැන් `Settings.version` counter එකක් renderer එක හැම frame එකකම බලනවා. Wallpaper එක visible වුණාමත් settings ආයේ කියවනවා.
- **පාන්දර / උදෑසන ඝන මීදුම** (`uEarlyMist`): 3:30 සිට 9:45 දක්වා. ඈත කැලෑව depth fog එකෙන් වැසෙනවා, මීදුම් ස්තර ගස් අතරින් ගලනවා, පොකුණ උඩ හුමාලය.
- **සුළඟට ගස් පැද්දීම** (`uWind`): 9:30 – 17:00 අතර තදයි (දහවල් උපරිම), අනිත් වෙලාවට සියුම්. ළඟ කොළ වැඩියෙන්, සුළං රැලි කැලෑව හරහා යනවා, අහස/පොකුණ දාර ඉරිතැලෙන්නේ නැති මෘදු mask එකක්.
- **සැකසුම්:** අකුරු size, අකුරු style (සෙවණැලි / දිලිසෙන / රන්වන් / රේඛා), "වේලාව" label එක පෙන්වන්න/අයින් කරන්න, font තෝරන්න (මූලික එක).
- **Sinhala render fixes:**
  - FM ඉස්පිල්ල: වි, ඩි වගේ ඒවා font එකේ වෙනම glyphs වලින්.
  - `"` ලකුණ FM font එකේ වෙනම glyph එකකට map වෙනවා. Labels වල quotes පාවිච්චි කරන්න එපා.
  - FM Malithi එකේ "වේ" හල් කිරීම ව සහ ල අතරට වැටෙනවා. දැනට අකුරෙන් අකුර අඳිනවා.

## 7. ඊළඟට කරන්න ඕනේ (pending)

User ගේ අන්තිම ඉල්ලීම. තවම project එකට දාලා නෑ:

1. ~~Fonts වලට converters~~ ✅ 2026-11-21 හැදුවා:
   - `FM-Emanee`, `FM-Malithi-x`, `apex023`, `apex029` → **FM encoding** (`FmConverter`). Apex fonts FM එකටම ගැලපෙනවා කියලා render කරලා තහවුරු කළා.
   - `isi_abhaya`, `isi_dhara` → **Isi encoding** (`IsiConverter`). Font file name එක "isi" වලින් පටන් ගන්නවා නම් `TextPainter` එක මේක ඉබේම තෝරනවා.
   - Isi mapping එක හැදුවේ: font glyphs Noto Serif Sinhala එක්ක image-match කරලා, ඊට පස්සේ clock වචන සියල්ලම, precomposed glyphs 43ම, ස්වර ඔක්කොම render කරලා ඇසින් පරීක්ෂා කරලා. වැදගත් glyphs: ා=£ ැ=¥ ෑ=¦ ි=Œ ී=œ ු=§ ූ=ª ්=Š ෙ=» ං=¹ රකාරාංශය=® යංශය=³ ශ්‍රී=Q.
   - අලුත් font එකක් එකතු කරනවා නම්: FM ද Isi ද කියලා FM text එකක් render කරලා බලන්න. වෙන encoding එකක් නම් අලුත් converter එකක් ඕනේ.
2. ~~"වේලාව" render වැරැද්ද~~ ✅ 2026-11-21 (font අනුව hal shift). පරණ සටහන: User ගෙන් ඇහුවා හල් එක පේන්න ඕනේ කොහොමද කියලා. උත්තරයක් ආවේ නෑ:
   - C: හල් එක ඉඩ්ලා, ව සහ ල අතර පොඩි ඉඩක්
   - D: හල් එක ඉඩ්ලා ටිකක් වමට
   - F: හල් එක ගොඩක් ඉඩ්ලා, ලොකු ඉඩක්
   - G: FM Malithi වෙනුවට FM Emanee default කරන්න
   - Options image එක මැකිලා. ආයෙත් render කරලා පෙන්නලා අහන්න.
3. **"වේලාව" label එක අයින් කරන්න option එක** දැනටමත් තියෙනවා (`show_label`). හරියට වැඩ කරනවද check කරන්න.
4. ~~Text Y position slider එක~~ ✅ 2026-11-21 හැදුවා.

- **ගස් පැද්දීම (v2):** ගහේ මුදුන් (උඩින් අහස තියෙන තැන්) වැඩියෙන් පැද්දෙනවා, එක ගහක් එකට චලනය වෙනවා, වැස්සට සුළඟ තදයි.
- **දහවල් වැස්ස** (`uRain`, settings: "Rain" = Off / Random / On, default Random):
  - Random: දවසට වැසි 2ක් වෙන්න පුළුවන් (එකකට ~45% ඉඩක්), 10:00 – 15:00 අතර, විනාඩි 25 – 85. දවසේ අංකයෙන් seed කරන නිසා wallpaper එකටයි preview එකටයි එකම රටාව.
  - On: ඕනෑම වෙලාවක දිගටම වහිනවා (user ට ඉක්මනට බලන්න). පරණ "Always" (11:00 – 14:30) පේන්නේ නෑ කියලා user පැමිණිලි කළා.
  - Effects: අඳුරු වලාකුළු අහස, ක්ෂිතිජයේ වැහි මීදුම, තෙත් අඳුරු ගොඩබිම, වැහි ඉරි layers 3 (සුළඟට ඇලයි), පොකුණේ වැහි බිංදු රැළි, තද වැස්සට ඉඳහිට ඈත අකුණු එළිය. වැස්සට සමනලුන්, බත්කූරෝ, කුරුල්ලෝ, ජල දිලිසීම, හිරු කිරණ නැහැ.

- **තද සුළඟ** (`uStorm`, `uWindT`, settings: "Strong wind" = Off / Random / On, default Random):
  - Random: දවසට සුළං 2ක් වෙන්න පුළුවන් (~40% ඉඩක්), 9:30 – 16:30 අතර, විනාඩි 10 – 25. ඒ වගේම හැම වැස්සකටම විනාඩි 15කට කලින් සුළඟ එනවා.
  - On: ඕනෑම වෙලාවක දිගටම තද සුළඟ.
  - Setting මාරු කළාම වැස්ස / සුළඟ තත්පර ~2කින් සුමටව එනවා (`approach` in SceneState).
  - Effects: ගස් වේගයෙන් නැවෙනවා (පිඹුම් වලින්), පොකුණේ අඳුරු සුළං පැල්ලම් සහ තරංග ඉරි, බිමින් දූවිලි (තෙත් නම් අඩුයි), ඉගිලෙන කොළ 14ක්, වලාකුළු වේගයෙන්, වැහි ඉරි වැඩියෙන් ඇලයි. සමනලුන්, බත්කූරෝ, කුරුල්ලෝ නැහැ.
  - `uWindT` = සුළං කාලය. තද සුළඟට වේගයෙන් ගලනවා, integrate කරන නිසා වේගය මාරු වුණාම animation එක පනින්නේ නැහැ.
- Settings panel එක දැන් scroll වෙනවා (උපරිම screen උසින් 45%).
- **Text position slider** (`text_y`, -0.30 .. +0.30 screen උසින්): මැද = ඉබේම තෝරන තැන, වමට = උඩට, දකුණට = පහළට, "Reset" button එක. Text එක screen එකෙන් එළියට යන්නේ නෑ (උඩ status bar, පහළ dock එකට ඉඩ තියලා).

- **v1.1 (2026-11-21) — user "කියපු හැම දේම කරහන්":**
  - `SkyCalendar.kt`: හිරු උදාව/බැසීම (NOAA), සඳේ වයස, පොහොය (Meeus full-moon algorithm — 2026 දින test කළා), වෙසක් (වෙසක් පොහොයට -2..+1), අවුරුදු (අප්‍රේල් 10–17). නගර 13ක්.
  - Scene එක ඇත්ත හිරු වෙලාව අනුව: `sceneMinute()` piecewise warp (පින්තූර හැදුවේ 6:15 උදාවට, 18:15 බැසීමට).
  - ~~වෙලාවට යටින් පේළි (දිනය, පොහොය, රාහු කාලය, හිතෝපදේශ)~~ — **user ට අකමැති නිසා 2026-11-21 සම්පූර්ණයෙන් අයින් කළා** (code + settings). ආයේ text පේළි එකතු කරන්න එපා, user ඉල්ලුවොත් මිසක්. සටහන: FM fonts වල "." = ග, ඉලක්කම් ඕනේ වුණොත් system font එකෙන් අඳින්න.
  - `LiveWeather.kt`: Open-Meteo (key නෑ), විනාඩි 30ට වරක්, city lat/lon විතරයි. Live on නම් rain/storm/cloud/fog/thunder ඒකෙන්.
  - Shader අලුත්: සඳේ කලාව (photo එකේ සඳ අඳුරු කරනවා, MOON_R 0.027), අකුණු ඉර + flash + ජල පිළිබිඹුව (uThunder), දේදුන්න (වැස්ස ඉවර වෙලා ~5 min), touch රැළි/සමනලුන් (uTap0..3, COMMAND_TAP), පොහොය පහන් 12 (පොකුණු බැම්ම y 0.711 / 0.873), වෙසක් කූඩු 5, එරබදු පෙති 30, රිළවුන් (පොකුණ දෙපැත්තේ ගස්, තත්පර 23/32ට වරක් පනිනවා), කොකුන් (උදේ/සවස පොකුණට), මොනරා (වම් තණ තීරුව 0.165,0.758 — 47s ට වරක් පිල් විදහනවා), වවුලෝ.
  - FM converter: ඹ=U ඬ=~ ඞ=X ඟ=Õ ඣ=® ඤ=[ ඥ={, ෛ. Isi: ඟ=`, ඒ=A ඕ=B ඌ=U° ඖ=X°.
  - "වේලාව" හල් fix: drawFm එකේ font එක අනුව shift (Malithi -0.21, Emanee -0.11, අනිත් 0) — render කරලා Noto එක්ක සසඳලා තෝරපු අගයන්.
  - Battery saver: 15fps + scene එක 60% offscreen FBO එකකට (wallpaper එකට setFixedSize බෑ — Android 11 crash වුණා).
  - Lock screen: keyguard poll කරලා අකුරු ×1.22 සහ 0.30 පහළට (system clock එකට යටින් නොවැටෙන්න).
  - අඳුරු blur පසුබිම default style එකේ + shader shade එක ලොකු කළා (පාන්දර/උදේ කියවන්න).
  - Preview debug intent extras: `--ez poya/vesak/avurudu/thunder/rainbow true`, `--ef moon 0.25`.
- **Play Store (v1.1, versionCode 2):** `release-keystore/` (jks + keystore.properties — **backup කරන්න, share කරන්න එපා**), `store/` (listing.md, privacy-policy.md, icon-512.png, feature-graphic-1024x500.png, screenshots/). AAB: `app/build/outputs/bundle/release/app-release.aab`. Privacy policy එක online host කරලා URL එක Play Console එකට දාන්න ඕනේ.

- **අකුරු මෝස්තර 10 + custom පාට (2026-11-21):** Shadow, Glow, Gold, Outline, Silver (සඳ එළිය ලෝහ), Neon (පාට නළය — glow පාට = නළයේ පාට), Stone (සීගිරි වැලිගල් emboss), Glass (frosted), Ember (ගිනි පුපුරු), 3D (පියවර 9 extrude — outline පාට = extrude පාට). `Settings.TextColors` (text/shadow/glow/outline, 0 = Auto). Custom text පාට gradient styles වලට ඒ පාටෙන්ම gradient එකක්; custom glow/outline glow/outline නැති styles වලටත් එකතු වෙනවා. UI: Auto + presets 16 + HSV picker dialog. Debug intent extras (`style`, `ctext` …) debug build එකේ විතරයි.

- **අලුත් සතුන් / ස්වභාවය (2026-11-21)** — ඔක්කොම `scene.frag` එකේ (helpers: `sideBird`, `triFill`, `eagle`, `waterFlower`, `fishShape`, `elephant`, `splash`, `eventRipple`, `kfPos`):
  - නෙළුම් (රෝස) / නිල් මානෙල් කොළ 16ක් සහ මල්, පොකුණේ පොකුරු 3ක (0.33,0.795), (0.655,0.765), (0.60,0.85). දවල්ට පිපෙනවා, රෑට හැකිළෙනවා, ජලයේ පිළිබිඹුව පේනවා.
  - පිළිහුඩුවා: `KF_PERIOD` 29s එකකට වරක් (75%) ගහෙන් ඇවිත් ජලයට උඩින් නවතිනවා, කිමිදෙනවා (splash + රැළි), ඉගිලෙනවා. දවල්ට විතරයි, වැස්සට/තද සුළඟට නෑ.
  - මාළුවා පනිනවා: `FISH_PERIOD` 8.5s, splash 2ක් + රැළි.
  - ගිරා රංචුව (6): 33s චක්‍රය, 6s ගමන, උදේට වැඩියෙන්.
  - රාජාලියා (බමුණු පියා): දවල්ට පර්වතයට උඩින් (y≈0.355) රවුම් ගහනවා, ~24s රවුමක්.
  - වැටෙන වියළි කොළ (18): `uWind` තද වුණාම (දහවල්), තද සුළඟට වැඩියි.
  - අලි රංචුව (3 + පැටියා): **(11-22 සිට) පොකුණේ ඉහළ බැම්මේ පහළම පඩිය (y=0.710) දිගේ තිරස්ව x 0.19↔0.83** — කඳු උඩින් යනවා වගේ පෙනුණු නිසා ක්ෂිතිජයෙන් අයින් කළා. 55s ඇවිදිනවා → 20s නවතිලා හොඬවැල වතුරට දාලා බොනවා (`elephant(..., drink)`) → 55s ඇවිදිනවා; ජලයේ පිළිබිඹුව, බිමේ සෙවණැල්ල. 130s ගමන / 170s චක්‍රය. **ඇත්ත වෙලාවට:** හිරු බැසීමට විනාඩි 30කට කලින් සිට රංචු 14ක් (~විනාඩි 40, බැසීමෙන් පස්සේ ~10ක් දක්වා). `SceneRenderer` → `uEleT` (`ELE_BEFORE_SUNSET`, `ELE_HERDS`). උදා: සීගිරිය නොවැ. 21 → 17:15–17:54, ජූනි 21 → 17:55–18:35. (Emulator එක GMT නිසා එතන 16:30ට — sunset clamp 17:00.) **Fix (11-22):** preview slider එකේ කලින් app එක open කරලා ගතවුණු මුළු කාලයම (`t`) එකතු වුණා → ටික වෙලාවකින් අලි කවදාවත් පේන්නේ නෑ. දැන් override එක වෙනස් වුණාට පස්සේ තත්පර විතරයි (`overrideT0`). අලි 20%ක් ලොකු කළා.
  - **මොනරා / රාජාලියා සිනමාත්මකව (2026-11-21):** මොනරා — iridescent බෙල්ල, කිරුළ, කොරපොතු පිට, ඉරි පියාපත, බිමට වැටෙන දිගු පිල් (පිහාටු ඉරි + ඇස් තිත්), ඇවිදින කකුල්, හිස සෙලවීම, බිම කොටනවා, බිම සෙවණැල්ල; විදහපු පිල් කලඹ පිහාටු 56ක්, අහඹු ඇස් පේළි 3ක්, barbs texture, හිරු backlight, වෙව්ලීම. රාජාලියා (බමුණු පියා) — wrist එක සහිත පියාපත් හැඩය, දත් වගේ පසු දාරය, ඇඟිලි 5ක්, කළු අග, ලා කවුළුව, පිහාටු හරහා හිරු එළිය (`trans`), අහසේ haze, අරය/වේගය වෙනස් වෙන රවුම, හැරෙද්දී ඇලවීම, ඉඳහිට පියාපත් ගැසීම.
  - Test කරන්න periods කෙටි කරලා burst screenshots (`screencap`) ගත්තා. Final එකේ periods නියම අගයන්ට.

- **චලනය වෙන පාන්දර මීදුම (2026-11-21):** `uEarlyMist` කොටස — විශාල මීදුම් කඳු (`bank`, ~0.012 uv/s), ඈත ස්තරය (~0.0125), ළඟ පෙරළෙන ස්තරය (~0.028), සිහින් ඉරි (~0.029), පොකුණ උඩ ගලන + නගින හුමාලය. සාමාන්‍ය මීදුම් ස්තරත් වේගවත් කළා.
- **මිනිස්සු + පන්දම් (2026-11-21):** කණ්ඩායම් slots 2ක් (160s / 210s චක්‍ර, 65% සම්භාවිතාව, වැස්සට අඩුයි), 2–4 දෙනා. පාර (`path5`): වම් පඩිපෙළ (0.03,0.855)→(0.175,0.775)→(0.27,0.706) හෝ දකුණෙන් (0.97,0.845)→(0.80,0.735)→(0.735,0.703), ඉහළ බැම්ම → මැද (0.508,0.699) → සීගිරිය පැත්තට (0.508,0.662) කැලෑවට යනවා. වේගය ~0.006 iso/s (~110s). පොඩි silhouette (`person()`), ඇඳුම් පාට (සුදු/කහ සිවුරු/මෙරූන්/නිල්/බෝල්), දවල් සෙවණැල්ල, තල් ගහ පිටිපස්සේ depth occlusion. රෑට (`torchAmt`) ප්‍රමුඛයා + ~55% පන්දම් — දැල්ල, halo 3ක්, බිමේ එළිය, ජලයේ පිළිබිඹුව, මිනිහාට පන්දමේ එළිය; `torchGlow` මීදුමෙන් පස්සේ එකතු වෙනවා.

- **ඔරු (2026-11-22):** පොකුණේ ලෝක තලයේ රවුමක් (`boatAng/boatPos/boatFwd`, `BOAT_SQ` 0.45 perspective). උදේ ඔරුව (`boatDayAmt` = උදේ + පාන්දර): R 0.12, ~110s වටයක්, දෙදෙනා හබල් ගහනවා. රෑ ඔරුව (`boatNightAmt`): R 0.105, අනිත් පැත්තට හිමින්, පිටුපස කෙනා හබල් ගහනවා, ඉස්සරහ කූරේ පන්දම — දැල්ල, halo, ජලයේ එළි පැල්ලම, කැඩි කැඩී යන දිගු පිළිබිඹුව, කඳට සහ මිනිස්සුන්ට එළිය. Ripple section එකේ V wake + bow wave + හබල් රැළි. වැස්සට/තද සුළඟට ඔරු නෑ. GLSL ES වල `half` reserved word එකක් — variable නමක් විදිහට පාවිච්චි කරන්න එපා.

- **Performance + 120Hz (2026-11-22):**
  - **Adaptive resolution** (`SceneRenderer.adaptResolution`): scene එක හැමවිටම offscreen FBO එකකට අඳිනවා. ඉහළම scale = `MAX_SCENE_W` 920px / screen පළල (photo 768px නිසා පේන වෙනසක් නෑ), අවම 0.5. Frame කාලය ඉලක්කයෙන් 1.35×ට වැඩි frames 6ක් → −0.06; 1.12×ට අඩු frames 240ක් → +0.03. FBO 5% පියවරවලට. Text එක හැමවිටම full resolution. Battery saver → උපරිම 0.6. Scale වෙනස් වෙද්දී `Welawa` log එකක්.
  - **Frame rate:** Settings → "Frame rate" 30 / 60 / Max (`Settings.fps`, default Max). Service එකේ 30fps සීමාව අයින් කළා; Choreographer vsync එක මනිනවා, Max නම් හැම vsync එකකම render. Android 11+ `Surface.setFrameRate()` (display එකේ උපරිම mode එක, 120Hz). `renderer.targetFrameNs` = max(vsync, fps සීමාව). Battery saver = 15fps.
  - **Click effect අයින් කළා:** tap රැළි, tap සමනලුන්, `uTap0..3`, `addTap`, `onCommand` TAP, preview touch listener.

- **Rain / Strong wind fix (2026-11-22):** Live weather on නම් කලින් Rain/Wind settings සම්පූර්ණයෙන්ම නොසලකා හැරියා (`lw?.rain ?: ...`) → On කළාට වැස්ස/සුළඟ පේන්නේ නෑ. දැන්: On = හැමවිටම, Off = කවදාවත් නෑ, Random = live weather on නම් ඇත්ත කාලගුණය, නැත්නම් අහඹු දවස්. UI labels update කළා. `SceneStateTest` (tests 3) එකතු කළා — tests 14ම pass.

- **අලි පේන්නේ නෑ fix 2 (2026-11-22):** ප්‍රධාන හේතුව වැස්ස — eleAmt × (1−0.7·rain) + වැස්සේ මීදුම් තිරය (`hz`) අලි වැහුවා. දැන්: eleAmt × (1−0.3·rain), `eleMask` එකෙන් වැස්සේ haze 70%ක් අඩු කරනවා. අලි 25% ලොකු (sz 0.0105, පැටියා 0.0072, පරතරය 0.023), හිරු rim light එකක්. කාලය: සවස **හිරු බැසීමට පැයකට කලින් සිට රංචු 26ක් (~විනාඩි 74)** + පාන්දර **උදාවට විනාඩි 20කට කලින් සිට රංචු 15ක් (~විනාඩි 42)** (`ELE_BEFORE_SUNSET` 60, `ELE_HERDS` 26, `ELE_DAWN_BEFORE` 20, `ELE_DAWN_HERDS` 15).

- **3D අලි (2026-11-22):** silhouette `elephant()` එක වෙනුවට කොටස් වලින් හදපු shaded අලියා — `eleBlob` (ඉලිප්සාකාර ගෝල: ශරීරය, පිට, හිස) සහ `eleCyl` (කකුල්, හොඬවැල, වලිගය) normal එකෙන් diffuse + rim; ඈත කකුල් ශරීරයට පිටුපසින් අඳුරුව, කන් වෙනම (සෙලවෙනවා), සමේ රැළි noise, හොඬවැලේ වළලු, කකුල්වල රතු මඩ, බඩ යට AO, ඇස, ඇවිදිද්දී bob. AA = 0.0011/sz (~1.5px මෘදු දාර). ආලෝක දිශාව `uSunPos` අනුව (සවස දකුණෙන්). පාට: skin (0.30,0.255,0.22), litC = 0.36+0.62·ambient + sun·0.40.

- **Easter eggs (2026-11-22):**
  - 👻 **රෑ 12:00 හොල්මන** (`uGhostT`, තත්පර 60): දර්ශනය සීතල අඳුරු, පොකුණ උඩ කොළ-නිල් මීදුම, පන්දම් වෙව්ලනවා; සුදු මෝහිනී (`ghostShape`: ඉරිතැලුණු ගවුම, පාද නෑ, දිගු කළු කොණ්ඩය) පොකුණ උඩින් පාවෙලා මැද නවතිලා අත වනලා දකුණට අතුරුදන් වෙනවා, ඉඳහිට flicker. ජනවාරි 1ට නෑ.
  - 🛺 **ත්‍රීවීල්** (`uTukT`, `uTukColor`): දවසට එක වතාවක් — `Random(day*7919+13)`: 6:30 + nextInt(900) මිනිත්තු, පාට nextInt(4) (0 කහ, 1 කොළ, 2 මෙරූන්, 3 නිල්; 2/3 දකුණෙන් එනවා). මිනිස්සුන්ගේ පාරේම 0.013 iso/s, 75s. දවල් සෙවණැල්ල, රෑට ඉදිරි ලයිට් + බිමේ එළිය + රතු පිටුපස ලයිට්.
  - 🐊 **කිඹුලා**: `CROC_PERIOD` 420s (shader + Kotlin), ඔරුවක් තියෙනකොට ළඟින් තත්පර 16ක් ඇස්/නාසය/පිට ගැට මතු වෙනවා (රෑට තැඹිලි eyeshine), `boatTime()` එකෙන් ඔරුව තත්පර 10ක් දෙගුණ වේගයෙන්.
  - 🐘💗 **අප්‍රේල් 1**: රංචුවේ දෙවෙනි අලියා රෝස (`uAprilFool`).
  - 🎆 **ජනවාරි 1 00:00–00:20**: සීගිරියට උඩින් ගිනිකෙළි (`uFireT`) — shells 5, රොකට් ඉර, අංශු 36 (angle-bin trick), ගුරුත්වය, flash, පොකුණේ පිළිබිඹුව.
  - Preview test extras: `--ez ghost|tuk|croc|aprilfool|newyear true` (`--ei minute N` එක්ක).

- **Polish (2026-11-22):** අලි ඇවිදීම — `walk = k * 400` (පියවර චක්‍රයක් ~2s, දුර අනුව; බොනකොට නවතිනවා), පාදය 0.22 පැද්දෙනවා + 0.12 උස්සනවා, දණහිස නැවෙනවා, bob 0.035. හොල්මන — සාරි රැලි/පොට, දිලිසෙන දාරය, සුදුමැලි මූණ (ගිලුණු දිලිසෙන ඇස්, "ඕ" කට), මූණ වටේ කොණ්ඩය + පාවෙන ගස් 4ක්, ඇඟිලි 3ක් එක්ක වනන අත, ectoplasm මීදුම් වලිගය, spirit orbs 10ක්, හිස වටේ halo, ජලය මත එළිය. ත්‍රීවීල් — Bajaj profile: වටකුරු පිටුපස "බාත් ටබ්" බොඩිය (stripe + ක්‍රෝම්), පහත් රියදුරු තට්ටුව (කකුල් පේනවා), උස ඇල නාසය + ලයිට්, ඇල වින්ඩ්ස්ක්‍රීන්, ඉදිරියට එල්ලෙන වහලය, පිටුපස කැන්වස් + ජනේලය, කණ්ණාඩිය, කැරකෙන spokes, සුදු කමිස රියදුරු හැන්ඩලය අල්ලන්.

**දන්නා ප්‍රශ්න:**
- Text size ලොකු කරලා "වේලාව" label එක on කළාම tablet screen එකේ label එක launcher search bar එකට යටින් යන්න පුළුවන්. Text position slider එකෙන් පහළට කරලා හදාගන්න පුළුවන්.
- Settings panel එක ලොකු කළාම වෙලාවේ text එක panel එකේ translucent පසුබිම හරහා පේනවා (preview එකේ විතරයි).
- Test කරන්න `adb shell am start ... --ei minute N` පාවිච්චි කරනකොට activity එක කලින් open නම් BACK කරලා ආයේ start කරන්න. නැත්නම් extras ගන්නේ නෑ.
- Emulator එකේ app එක force-stop කළොත් wallpaper එක default එකට reset වෙනවා. ආයේ set කරන්න ඕනේ.

## 8. පසුවට තියපු අදහස්

- **වෙරළ scene එක — user ගෙන් images 5ක් ඕනේ** (සීගිරිය images වගේම: portrait 9:16, අවම 1080×1920, එකම composition එක, 1 පාන්දර … 5 රාත්‍රී). ඊට පස්සේ: Depth Anything V2 එකෙන් depth map + අහස/ජල mask එක (`mask.png` R=අහස G=ජලය B=depth) හදලා, `scenes/beach/` එකට දාලා settings වලට scene selector එකක්.

- වෙරළ (beach) scene එකක්.
- තවත් parallax layers.
- Fonts fine-tune කරන එක.

## 9. වැදගත් සටහන්

- Drive එක කලින් "New Volume" නමින් mount වුණා, දැන් "New Volume1". Claude sessions path එක අනුව වෙන් වෙන නිසා පරණ session එක `~/.claude/projects/-run-media-rtxpc-New-Volume1-live/` එකට copy කළා (`ceb38493-...`).
- Depth Anything venv සහ helper scripts (fmconv.py, isiconv.py) පරණ temp folder එකේ තිබ්බේ. ඒවා දැන් මැකිලා. Depth map එක ආයෙත් හදන්න ඕනේ නම් venv එක අලුතෙන් හදන්න වෙනවා.
