import subprocess, time, re, sys, os
ADB=['/home/rtxpc/Software/AndroidStudio/SDK/platform-tools/adb','-s','127.0.0.1:6555']
OUT=sys.argv[1]
def sh(*a, check=False):
    return subprocess.run(ADB+['shell',*a],capture_output=True,text=True).stdout
def nodes():
    sh('uiautomator','dump','/sdcard/ui.xml')
    x=sh('cat','/sdcard/ui.xml')
    return [(m.group(1),int(m.group(2)),int(m.group(3)),int(m.group(4)),int(m.group(5))) for m in re.finditer(r'text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',x) if m.group(1)]
def tap(x,y): sh('input','tap',str(x),str(y))
def launch(minute, extras='', ui=False):
    sh('am','force-stop','lk.sinhala.welawa')
    args=['am','start','-n','lk.sinhala.welawa/.MainActivity','--ei','minute',str(minute)]
    if not ui: args+=['--ez','hideui','true']
    args+=extras.split()
    sh(*args)
def set_option(row_prefix, option):
    launch(720, ui=True); time.sleep(3)
    for attempt in range(12):
        ns=nodes()
        idx=[i for i,t in enumerate(ns) if t[0].startswith(row_prefix)]
        if idx:
            for t in ns[idx[0]+1:idx[0]+4]:
                if t[0]==option:
                    tap((t[1]+t[3])//2,(t[2]+t[4])//2); time.sleep(1); print('set',row_prefix,option); return True
        st=[t for t in ns if t[0]=='Settings']
        has_rows=any(t[0]=='Font' or t[0].startswith('Rain') or t[0].startswith('Shadow') for t in ns)
        if st and not has_rows:
            tap((st[0][1]+st[0][3])//2,(st[0][2]+st[0][4])//2); time.sleep(2); continue
        if not st:
            tap(600,600); time.sleep(1.5); continue
        sh('input','swipe','600','1500','600','1150','400'); time.sleep(1)
    print('FAILED',row_prefix,option); return False
def rec(name, minute, extras, wait, dur):
    launch(minute, extras); time.sleep(wait)
    sh('screenrecord','--time-limit',str(dur),'--bit-rate','16000000',f'/sdcard/{name}.mp4')
    subprocess.run(ADB+['pull',f'/sdcard/{name}.mp4',f'{OUT}/{name}.mp4'],capture_output=True)
    print('rec',name, os.path.getsize(f'{OUT}/{name}.mp4'))


import sys as _s
for cmd in _s.argv[2:]:
    if cmd.startswith('set:'):
        _,row,opt=cmd.split(':'); set_option(row,opt)
    elif cmd=='rain':
        rec('06_rain',760,'--ez thunder true',7,9)
