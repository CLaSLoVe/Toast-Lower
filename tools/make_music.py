"""Original 16-bar banquet shuffle; deterministic CPU-only synthesis.
Run: python3 tools/make_music.py /tmp/toast-banquet.wav
Requires numpy. No samples, external melodies or audio services.
"""
import sys, wave
import numpy as np
SR, BPM = 44100, 126
BEAT = 60 / BPM
N = round(64 * BEAT * SR)
mix = np.zeros((N, 2), dtype=np.float64)
rng = np.random.default_rng(34)

def freq(m): return 440 * 2 ** ((m - 69) / 12)
def add(voice, beat, pan=0):
    start = round(beat * BEAT * SR)
    gain = np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])
    np.add.at(mix, (start + np.arange(len(voice))) % N, voice[:, None] * gain)
def note(m, beat, dur, kind, amp, pan=0, slide=0):
    t = np.arange(round(dur*BEAT*SR))/SR
    attack = np.minimum(t/.008, 1)
    release = np.minimum((t[-1]-t)/.035, 1).clip(0,1)
    if kind == 'reed':
        hz = freq(m) * 2 ** ((slide*np.exp(-t*24) + .11*np.sin(2*np.pi*5.7*t))/12)
        ph = 2*np.pi*np.cumsum(hz)/SR
        v = sum(np.sin(ph*h)*a for h,a in [(1,1),(2,.30),(3,.24),(4,.10),(5,.09)])
        env = attack*release*(.62+.38*np.exp(-t*11))
    elif kind == 'bass':
        ph = 2*np.pi*freq(m)*t
        v = np.sin(ph)+.25*np.sin(ph*2)+.09*np.sin(ph*3)
        env = attack*release*np.exp(-t*4)
    elif kind == 'organ':
        ph = 2*np.pi*freq(m)*t
        v = np.sin(ph)+.22*np.sin(ph*2)+.18*np.sin(ph*3)
        env = attack*release*np.exp(-t*9)
    else: # little tuned cup/wooden-block accent, softer than the game's clink
        v = np.sin(2*np.pi*freq(m)*t)+.18*np.sin(2*np.pi*freq(m)*2.76*t)
        env = attack*release*np.exp(-t*22)
    add(amp*v*env, beat, pan)
def drum(beat, kind, amp):
    length={'kick':.24,'snare':.14,'hat':.055}[kind]
    t=np.arange(round(length*SR))/SR
    if kind=='kick':
        hz=48+95*np.exp(-t*32); v=np.sin(2*np.pi*np.cumsum(hz)/SR)*np.exp(-t*18)
    else:
        noise=rng.normal(0,.6,len(t)); noise=np.r_[0,np.diff(noise)]
        v=noise*np.exp(-t*(48 if kind=='snare' else 95))
        if kind=='snare': v+=.35*np.sin(2*np.pi*185*t)*np.exp(-t*27)
    v*=np.minimum(t/.0015,1)*np.minimum((t[-1]-t)/.008,1).clip(0,1)
    add(v*amp,beat, .22 if kind=='hat' else -.1)

# D minor / Bb / G minor / A7, then an answering phrase. All pitches composed here.
roots=[38,38,34,33,38,43,34,33,38,38,34,33,43,38,33,33]
chords=[[62,65,69],[62,65,69],[62,65,70],[61,64,67],[62,65,69],[62,67,70],[62,65,70],[61,64,67]]
phrases=[
 [(0,74,.45),(.55,77,.30),(1,74,.30),(1.55,69,.45),(2.5,72,.30),(3,74,.60)],
 [(0,74,.28),(.55,74,.28),(1.5,77,.32),(2,76,.35),(2.55,72,.28),(3.5,69,.35)],
 [(0,77,.40),(.55,74,.30),(1.5,70,.40),(2.5,74,.28),(3,72,.30),(3.55,70,.28)],
 [(0,73,.35),(1,76,.30),(1.55,73,.30),(2.5,69,.35),(3,67,.28),(3.55,69,.28)],
 [(0,74,.35),(.55,77,.30),(1.5,81,.48),(2.5,77,.30),(3,74,.45)],
 [(0,79,.45),(1,77,.28),(1.55,74,.30),(2.5,70,.4),(3.5,74,.28)],
 [(0,77,.3),(.55,74,.28),(1,70,.45),(2.5,72,.28),(3,74,.45)],
 [(0,73,.30),(.55,76,.28),(1.5,73,.35),(2.5,69,.28),(3,67,.28),(3.55,73,.28)]
]
for bar in range(16):
    base=bar*4; root=roots[bar]
    for b,pitch in [(0,root),(1.5,root+12),(2,root+7),(3.5,root+12)]:
        note(pitch,base+b,.40,'bass',.23)
    for b in [0,1,2,3]: drum(base+b,'kick',.36 if b%2==0 else .25)
    for b in [1,3]: drum(base+b,'snare',.095)
    for b in [0,.55,1,1.55,2,2.55,3,3.55]: drum(base+b,'hat',.035)
    for b in [.55,1.55,2.55,3.55]:
        for m in chords[bar%8]: note(m,base+b,.22,'organ',.043, -.28)
    for i,(b,m,d) in enumerate(phrases[bar%8]):
        # Second half answers with a low, rubbery voice at the ends of phrases.
        lower=12 if bar>=8 and bar%2 else 0
        note(m-lower,base+b,d,'reed',.115 if lower else .10,.15, -1.4 if i==0 else -.35)
    if bar%2: note(86,base+2.55,.22,'glass',.035,-.4)
    if bar in [7,15]:
        for j in range(3): note(74-j*2,base+3+j*.25,.20,'glass',.05,.4)

mix=np.tanh(mix*1.25)
mix*=.78/np.max(np.abs(mix))
audio=(mix*32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv)>1 else '/tmp/toast-banquet.wav','wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes(audio.tobytes())
print(f'{N/SR:.3f}s; peak {np.max(np.abs(mix)):.3f}; RMS {np.sqrt(np.mean(mix**2)):.3f}; loop seam {np.max(np.abs(mix[-1]-mix[0])):.5f}')
