# Authoring tool (not loaded by the game): writes games/racer/content/patterns/<genre>.json. Run: python3 games/racer/tools/genpatterns.py games/racer/content/patterns [genre ...] Every pattern is in C and follows the shared
# progression for its mode, so patterns from different genres can be mixed in one section and still agree harmonically.
import json, random, sys, zlib, os

OUT = sys.argv[1]
PROG = {
    'major': [(0, [0, 4, 7]), (7, [0, 4, 7]), (9, [0, 3, 7]), (5, [0, 4, 7])],
    'minor': [(0, [0, 3, 7]), (8, [0, 4, 7]), (3, [0, 4, 7]), (10, [0, 4, 7])],
}
SCALE = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10]}
PENT = {'major': [0, 2, 4, 7, 9], 'minor': [0, 3, 5, 7, 10]}

def bass_note(root, octave_up=0, fifth=False):
    n = 36 + root
    if n > 46: n -= 12
    return n + (7 if fifth else 0) + 12 * octave_up

def bass_bar(root, tpl, bars_len=16):
    out = [0] * bars_len
    i = 0
    last = None
    for i, c in enumerate(tpl[:bars_len]):
        if c == 'R': out[i] = bass_note(root)
        elif c == 'O': out[i] = bass_note(root, 1)
        elif c == '5': out[i] = bass_note(root, 0, True)
        elif c == '-': out[i] = -1
    return out

def bass_pattern(mode, tpl, meter):
    n = 16 if meter == 4 else 12
    out = []
    for root, _ in PROG[mode]:
        out += bass_bar(root, tpl, n)
    return out

def drum_pattern(bar, fill, meter):
    out = []
    n = len(bar)
    for b in range(4):
        out += bar
    # fill replaces the last four steps of the fourth bar
    out[-4:] = fill
    return out

def pad_pattern(mode, style, meter):
    n = 16 if meter == 4 else 12
    out = []
    for bi, (root, chord) in enumerate(PROG[mode]):
        base = 60 + root
        if base > 66: base -= 12
        if style == 'hold':
            out += [base + chord[1] if False else base + chord[2]] + [-1] * (n - 1)
        elif style == 'arp':
            seq = [chord[0], chord[1], chord[2], chord[1]]
            per = n // 4
            for k in range(4):
                out += [base + seq[k]] + [-1] * (per - 1)
        else:  # fifths, very slow
            out += [base + chord[2]] + [-1] * (n - 1)
    return out

def lead_pattern(pid, mode, rhythms, meter, pent=False):
    rnd = random.Random(zlib.crc32(pid.encode()))
    n = 16 if meter == 4 else 12
    scale = (PENT if pent else SCALE)[mode]
    out = []
    pos = 72
    for bi, (root, chord) in enumerate(PROG[mode]):
        rh = rnd.choice(rhythms)
        bar = [0] * n
        tones = [(72 + root + t) if (72 + root + t) <= 79 else (60 + root + t) for t in chord]
        for k, (st, ln) in enumerate(rh):
            if st >= n: continue
            if k == 0:
                pos = rnd.choice(tones)
            else:
                # stepwise motion in the scale
                cand = [p for p in range(66, 85) if ((p - 0) % 12) in [(s) % 12 for s in scale]]
                cand.sort(key=lambda p: abs(p - pos))
                pos = rnd.choice(cand[1:4]) if cand else pos
            if bi == 3 and k == len(rh) - 1:
                pos = 72 + (0 if mode == 'minor' else 0)
            bar[st] = pos
            for h in range(1, ln):
                if st + h < n and bar[st + h] == 0: bar[st + h] = -1
        out += bar
    return out

# One spec per variant. Genre keys map to variants 1 and 2 (ids <genre>_<role>_1 / _2). Meter 3 genres use 12-step bars.
def V(bpm, mode, bass, drums, fill, lead, pad, pent=False, meter=4):
    return dict(bpm=bpm, mode=mode, bass=bass, drums=drums, fill=fill, lead=lead, pad=pad, pent=pent, meter=meter)

G = {
 'chip_pop': [
  V((90, 175), 'major', 'R.R.O.R.R.R.O.5.', [1,0,3,0,2,0,3,0,1,0,1,3,2,0,3,3], [2,2,5,5], [[(0,2),(2,2),(4,4),(8,2),(10,2),(12,4)], [(0,4),(4,2),(6,2),(8,4),(12,2),(14,2)], [(0,2),(2,2),(4,2),(6,2),(8,8)]], 'arp'),
  V((90, 175), 'minor', 'R.R.R.O.R.R.5.R.', [1,0,3,0,2,0,3,3,1,0,3,0,2,0,3,5], [2,5,5,2], [[(0,1),(2,1),(4,2),(8,1),(10,1),(12,4)], [(0,4),(4,4),(8,2),(10,2),(12,4)]], 'hold'),
 ],
 'funk': [
  V((95, 125), 'minor', 'R..R..R.R.R..R.5', [1,0,3,1,0,0,2,3,0,1,3,0,2,0,3,3], [2,3,2,5], [[(0,1),(3,2),(6,2),(10,1),(12,3)], [(0,2),(4,1),(7,2),(10,2),(14,2)]], 'hold', True),
  V((95, 125), 'major', 'R.R.5..R.R..5.R.', [1,0,3,3,2,0,3,0,1,3,0,1,2,0,3,3], [2,2,3,2], [[(0,2),(3,1),(5,2),(9,2),(12,2)], [(1,1),(4,2),(8,1),(10,2),(14,2)]], 'arp', True),
 ],
 'techno': [
  V((120, 150), 'minor', '..R...R...R...R.', [1,3,4,3,1,3,4,3,1,3,4,3,1,3,4,3], [1,2,2,5], [[(0,3),(3,3),(6,2),(8,3),(11,3),(14,2)], [(0,1),(2,1),(4,1),(6,1),(8,4),(12,4)]], 'arp', True),
  V((120, 150), 'minor', 'R.R.R.R.R.R.R.R.', [1,0,4,0,1,0,4,0,1,0,4,0,1,2,4,2], [1,1,2,5], [[(0,1),(1,1),(2,2),(4,4),(8,1),(9,1),(10,2),(12,4)], [(0,6),(6,2),(8,6),(14,2)]], 'hold', True),
 ],
 'surf': [
  V((130, 175), 'minor', 'R.RR.RR.R.RR.RR.', [1,0,2,2,1,0,2,2,1,0,2,2,1,2,2,2], [2,2,2,5], [[(0,1),(1,1),(2,1),(3,1),(4,4),(8,1),(9,1),(10,1),(11,1),(12,4)], [(0,2),(2,2),(4,2),(6,2),(8,2),(10,2),(12,2),(14,2)]], 'hold', True),
  V((130, 175), 'major', 'R.R.R.R.R.R.R.R.', [1,0,2,0,1,0,2,0,1,0,2,0,1,0,2,2], [2,2,5,5], [[(0,2),(2,1),(3,1),(4,4),(8,2),(10,1),(11,1),(12,4)], [(0,1),(1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,8)]], 'arp'),
 ],
 'march': [
  V((100, 135), 'major', 'R...5...R...5...', [1,0,2,2,1,0,2,0,1,0,2,2,1,2,2,2], [2,2,2,5], [[(0,3),(3,1),(4,4),(8,3),(11,1),(12,4)], [(0,2),(2,2),(4,2),(6,2),(8,4),(12,4)]], 'hold'),
  V((100, 135), 'minor', 'R.......5.......', [1,0,2,2,1,0,2,2,1,0,2,2,1,0,2,2], [2,2,2,2], [[(0,4),(4,4),(8,2),(10,2),(12,4)], [(0,3),(3,1),(4,3),(7,1),(8,8)]], 'hold'),
 ],
 'ambient': [
  V((60, 150), 'major', 'R---------------', [1,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0], [0,0,0,3], [[(0,8),(8,8)], [(0,6),(6,2),(8,8)]], 'fifths', True),
  V((60, 150), 'minor', 'R-------5-------', [1,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0], [0,0,3,0], [[(0,4),(4,4),(8,8)], [(0,8),(8,4),(12,4)]], 'fifths', True),
 ],
 'metal': [
  V((120, 175), 'minor', 'RRRRRRRRRRRRRRRR', [1,3,2,3,1,1,2,3,1,3,2,3,1,1,2,5], [2,5,5,1], [[(0,2),(2,2),(4,4),(8,2),(10,2),(12,4)], [(0,1),(1,1),(2,2),(4,2),(6,2),(8,4)]], 'hold', True),
  V((120, 175), 'minor', 'R.RR.RR.R.RR.R5R', [1,1,2,3,1,1,2,3,1,1,2,3,1,1,2,2], [2,2,5,1], [[(0,4),(4,2),(6,2),(8,4),(12,4)], [(0,2),(2,1),(3,1),(4,4),(8,2),(10,2),(12,4)]], 'arp', True),
 ],
 'reggae': [
  V((80, 130), 'major', 'R..R..R...R..5..', [3,0,3,0,0,0,3,0,1,2,3,0,3,0,3,0], [2,0,2,3], [[(2,1),(6,1),(10,1),(14,1)], [(0,2),(4,2),(8,2),(12,2)]], 'hold'),
  V((80, 130), 'minor', 'R...R.5.R...R.5.', [1,0,3,0,2,0,3,0,1,0,3,0,2,0,3,3], [2,0,3,3], [[(2,2),(6,2),(10,2),(14,2)], [(0,4),(4,2),(8,4),(12,2)]], 'hold', True),
 ],
 'polka': [
  V((110, 160), 'major', 'R.5.R.5.R.5.R.5.', [1,0,2,0,1,0,2,0,1,0,2,0,1,0,2,2], [2,2,2,5], [[(0,2),(2,2),(4,2),(6,2),(8,2),(10,2),(12,4)], [(0,1),(2,1),(4,2),(8,1),(10,1),(12,4)]], 'hold'),
  V((110, 160), 'minor', 'R.5.R.5.R.5.R.O.', [1,0,2,0,1,0,2,0,1,0,2,0,1,2,2,2], [2,2,5,5], [[(0,2),(2,2),(4,4),(8,2),(10,2),(12,4)], [(0,1),(2,1),(4,1),(6,1),(8,4),(12,4)]], 'arp'),
 ],
 'dnb': [
  V((150, 180), 'minor', 'R.....R...R.....', [1,0,3,0,2,0,3,1,0,1,3,0,2,0,3,3], [2,3,2,5], [[(0,2),(2,1),(3,1),(4,4),(8,2),(10,2),(12,4)], [(0,1),(2,1),(4,1),(6,2),(8,4),(12,4)]], 'hold', True),
  V((150, 180), 'minor', 'R.R.R.R.O.R.R.5.', [1,0,3,3,2,0,3,0,0,1,3,0,2,0,3,3], [2,2,3,5], [[(0,4),(4,2),(6,2),(8,4),(12,4)], [(0,2),(2,2),(4,2),(6,2),(8,2),(10,2),(12,4)]], 'arp', True),
 ],
 'blues': [
  V((80, 140), 'minor', 'R.R.R.5.R.R.R.O.', [1,0,3,0,2,0,3,0,1,0,3,0,2,0,3,3], [2,3,2,5], [[(0,3),(4,1),(6,1),(8,4),(12,4)], [(0,2),(3,1),(4,2),(8,2),(11,1),(12,4)]], 'hold', True),
  V((80, 140), 'major', 'R...5...R...5.O.', [1,0,0,3,2,0,3,0,1,0,0,3,2,0,3,3], [2,0,3,5], [[(0,4),(4,2),(6,2),(8,4),(12,4)], [(0,2),(2,2),(4,4),(8,4),(12,4)]], 'arp', True),
 ],
 'waltz': [
  V((100, 190), 'major', 'R...5...5...', [1,0,0,0,3,0,0,0,3,0,0,0], [2,0,3,3], [[(0,4),(4,2),(6,2),(8,4)], [(0,2),(2,2),(4,4),(8,4)]], 'arp', False, 3),
  V((100, 190), 'minor', 'R.......5...', [1,0,3,0,2,0,0,0,2,0,3,0], [2,0,3,3], [[(0,6),(6,2),(8,4)], [(0,2),(2,2),(4,2),(6,2),(8,4)]], 'hold', False, 3),
 ],
}
only = sys.argv[2:]
os.makedirs(OUT, exist_ok=True)
for g, variants in G.items():
    if only and g not in only: continue
    pats = []
    for vi, s in enumerate(variants, 1):
        meter = s['meter']
        for role in ['drums', 'bass', 'lead', 'pad']:
            pid = f'{g}_{role}_{vi}'
            if role == 'drums': steps = drum_pattern(s['drums'], s['fill'], meter); mode = 'any'
            elif role == 'bass': steps = bass_pattern(s['mode'], s['bass'], meter); mode = s['mode']
            elif role == 'lead': steps = lead_pattern(pid, s['mode'], s['lead'], meter, s['pent']); mode = s['mode']
            else: steps = pad_pattern(s['mode'], s['pad'], meter); mode = s['mode']
            assert len(steps) == 16 * 4 * meter // 4, (pid, len(steps))
            p = dict(id=pid, role=role, genre=g, mode=mode, bpmMin=s['bpm'][0], bpmMax=s['bpm'][1])
            if meter != 4: p['meter'] = meter
            p['steps'] = steps
            pats.append(p)
    with open(os.path.join(OUT, f'{g}.json'), 'w') as f:
        f.write('[\n' + ',\n'.join(' ' + json.dumps(p, separators=(',', ':')) for p in pats) + '\n]\n')
print('ok')
