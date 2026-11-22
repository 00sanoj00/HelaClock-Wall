import subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
V=sys.argv[1]; W,H=1080,1920
SIN='/usr/share/fonts/truetype/noto/NotoSansSinhala-Bold.ttf'
ENG='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
ENGR='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
R=ImageFont.Layout.RAQM
def font(p,s): return ImageFont.truetype(p,s,layout_engine=R)
def text_layer(items, bars=()):
    """items: (text, fontpath, size, colour, y). bars: (y, h, alpha)."""
    base=Image.new('RGBA',(W,H),(0,0,0,0))
    d=ImageDraw.Draw(base)
    for (y,h,a) in bars: d.rectangle([0,y,W,y+h],fill=(0,0,0,a))
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); ds=ImageDraw.Draw(sh)
    tx=Image.new('RGBA',(W,H),(0,0,0,0)); dt=ImageDraw.Draw(tx)
    for (t,fp,sz,colr,y) in items:
        f=font(fp,sz); w=dt.textlength(t,font=f); x=(W-w)/2
        ds.text((x+3,y+4),t,font=f,fill=(0,0,0,210))
        dt.text((x,y),t,font=f,fill=colr)
    sh=sh.filter(ImageFilter.GaussianBlur(4))
    return Image.alpha_composite(Image.alpha_composite(base,sh),tx)
clips=[
 ('01_dawn',0.3,6.0,'පාන්දර මීදුම ගලාගෙන යනවා','Flowing dawn mist'),
 ('02_morning',0.3,6.0,'උදේ පොකුණේ ඔරු පදිනවා','Morning boats on the pond'),
 ('03_croc',0.3,8.0,'කිඹුලා! ඔරුව දුවනවා','Easter egg: the crocodile'),
 ('04_noon',0.3,6.0,'දහවල් - රාජාලියා, ගිරවු, සමනලයෝ','Wildlife all day long'),
 ('05_tuk',0.3,8.0,'දවසට එක වතාවක්... ත්‍රීවීල් එක','Once a day: the tuk-tuk'),
 ('06_rain',0.3,7.0,'දහවල් වැස්ස සහ අකුණු','Rain and lightning'),
 ('07_evening',0.3,8.5,'සවසට අලි රංචුව වතුර බොන්න එනවා','Elephants at dusk'),
 ('08_pink',0.3,5.0,'අප්‍රේල් 1 - රෝස අලියා','April 1: the pink elephant'),
 ('09_night',0.3,7.0,'රෑට පන්දම් එළිය','Torches and boats at night'),
 ('10_ghost',0.3,14.5,'හරියටම රෑ 12ට...','Exactly at midnight...'),
 ('11_fireworks',0.3,8.0,'අලුත් අවුරුද්දට ගිනිකෙළි','New Year fireworks'),
 ('12_outro',0.3,5.5,None,None),
]
# overlays
ov=[]
for f,st,du,si,en in clips:
    if si:
        p=f'{V}/ov_{f}.png'
        text_layer([(si,SIN,62,(255,255,255,255),92),(en,ENGR,36,(255,226,176,255),200)],bars=[(70,200,80)]).save(p)
        ov.append((f,p,0.0,du))
t0=f'{V}/ov_title.png'
text_layer([('සිංහල වේලාව',SIN,124,(255,255,255,255),int(H*0.40)+20),
            ('Sinhala Clock Live Wallpaper',ENG,50,(255,210,122,255),int(H*0.40)+205)],bars=[(int(H*0.40),320,95)]).save(t0)
to=f'{V}/ov_outro.png'
text_layer([('සිංහල වේලාව',SIN,124,(255,255,255,255),int(H*0.28)),
            ('HelaClock Wall',ENG,60,(255,210,122,255),int(H*0.28)+190),
            ('Free  |  No ads  |  Up to 120Hz',ENGR,42,(255,255,255,255),int(H*0.28)+320),
            ('නොමිලේ බාගන්න',SIN,60,(255,255,255,255),int(H*0.28)+440),
            ('github.com/00sanoj00/HelaClock-Wall',ENG,40,(159,216,255,255),int(H*0.28)+560)],bars=[(0,H,120)]).save(to)
XF=0.6
import os
seg=[]
for i,(f,st,du,si,en) in enumerate(clips):
    layers=[]
    if False and si: layers.append((f'{V}/ov_{f}.png',du,0.4,0.6))
    pass
    pass
    inp=['-ss',f'{st}','-t',f'{du}','-i',f'{V}/{f}.mp4']
    fc=[f'[0:v]fps=30,crop=1076:1913:62:40,scale=1080:1920:flags=lanczos,setsar=1,format=yuva420p[b]']
    cur='b'
    for j,(pth,d0,fi,fo) in enumerate(layers):
        inp+=['-loop','1','-t',f'{d0}','-i',pth]
        fade=f'fade=t=in:st=0:d={fi}:alpha=1'+(f',fade=t=out:st={d0-fo}:d={fo}:alpha=1' if fo>0 else '')
        fc.append(f'[{j+1}:v]format=rgba,{fade}[o{j}]')
        fc.append(f'[{cur}][o{j}]overlay=0:0:eof_action=pass[c{j}]'); cur=f'c{j}'
    fc.append(f'[{cur}]format=yuv420p[out]')
    out=f'{V}/seg_{i:02d}.mp4'
    cmd=['ffmpeg','-v','error','-y',*inp,'-filter_complex',';'.join(fc),'-map','[out]','-t',f'{du}','-r','30',
         '-c:v','libx264','-preset','fast','-crf','14','-pix_fmt','yuv420p',out]
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode: print(f, r.stderr[-600:]); sys.exit(1)
    seg.append((out,du)); print('seg',f)
inputs=[]; parts=[]
for i,(o,du) in enumerate(seg):
    inputs+=['-i',o]; parts.append(f'[{i}:v]settb=AVTB,fps=30[v{i}]')
prev='v0'; off=seg[0][1]-XF
for i in range(1,len(seg)):
    parts.append(f'[{prev}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{i}]'); prev=f'x{i}'; off+=seg[i][1]-XF
total=off+XF
parts.append(f'[{prev}]fade=t=out:st={total-0.8:.3f}:d=0.8[vout]')
cmd=['ffmpeg','-v','error','-y',*inputs,'-f','lavfi','-i','anullsrc=r=44100:cl=stereo',
     '-filter_complex',';'.join(parts),'-map','[vout]','-map',f'{len(seg)}:a','-t',f'{total:.3f}',
     '-c:v','libx264','-preset','slow','-crf','19','-profile:v','high','-pix_fmt','yuv420p','-r','30',
     '-c:a','aac','-b:a','128k','-movflags','+faststart',V+'/HelaClock-Wall-clean.mp4']
r=subprocess.run(cmd,capture_output=True,text=True); print(r.stderr[-1500:]); print('total',round(total,1))
