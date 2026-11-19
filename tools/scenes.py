"""Write the OpenMoji scenes of Giuno Colors into drawings/<category>/ (layouts in an 800 x 1000 frame)."""
import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I leaves the script's folder out
from make_drawing import make  # noqa: E402
from make_sample_drawings import blade, blob, cloud, ellipse, star  # noqa: E402

DARK = "#3a3a3a"


def rect(x, y, w, h):
    return f"M{x} {y}H{x + w}V{y + h}H{x}Z"


def zone(d, color):
    return {"d": d, "color": color}


def line(d, color=DARK, width=6):
    return {"d": d, "fill": "none", "stroke": color, "stroke-width": width,
            "stroke-linecap": "round", "stroke-linejoin": "round"}


def emo(code, cx, h=None, w=None, cy=None, bottom=None, flip=False, **extra):
    layer = {"emoji": code, "cx": cx, "flip": flip, **extra}
    layer.update({"h": h} if h is not None else {"w": w})
    layer.update({"cy": cy} if cy is not None else {"bottom": bottom})
    return layer


def sun(cx, cy, r, color="#FFD23F"):
    return zone(ellipse(cx, cy, r), color)


def birds(*spots):
    return [line(f"M{x} {y}q{s} -{s} {2 * s} 0q{s} -{s} {2 * s} 0", width=5) for x, y, s in spots]


SKY = "#9ED8FF"
NIGHT = "#1E2A4A"


def tree(cx, h, bottom, trunk_color="#8D5A35"):
    """OpenMoji tree with a trunk to colour behind its outline."""
    w, top = 0.11 * h, bottom - 0.42 * h
    trunk = f"M{cx - w / 2:.0f} {bottom}L{cx - w * 0.32:.0f} {top:.0f}L{cx + w * 0.32:.0f} {top:.0f}L{cx + w / 2:.0f} {bottom}Z"
    return [zone(trunk, trunk_color), emo("1F333", cx, h=h, bottom=bottom)]


def puff(d):
    """White shape with a soft outline, already coloured (clouds, bubbles)."""
    return {"d": d, "fill": "#ffffff", "stroke": "#a9b8c8", "stroke-width": 3}


def stars(*spots):
    return [emo("2B50", x, h=h, cy=y) for x, y, h in spots]


def building(x, w, top, wall, window, cols, rows, base, roof=None):
    """Town building with a grid of windows to colour."""
    layers = [zone(rect(x, top, w, base - top), wall)]
    if roof:
        layers.append(zone(f"M{x - 8} {top}L{x + w / 2:.0f} {top - 0.4 * w:.0f}L{x + w + 8} {top}Z", roof))
    ww, wh = 14, 18
    gap = (w - cols * ww) / (cols + 1)
    for r in range(rows):
        for c in range(cols):
            layers.append(zone(rect(round(x + gap + c * (ww + gap)), top + 12 + r * (wh + 10), ww, wh), window))
    return layers


def path(points):
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in points) + "Z"


def kelp(x0, base, h, w, amp, waves, phase, colors, n=6):
    """Wavy seaweed cut into n pieces, coloured in turn."""
    def edge(t, side):
        xc = x0 + amp * math.sin(2 * math.pi * waves * t + phase)
        return xc + side * w * (1 - t) ** 0.7 / 2, base - h * t

    layers = []
    for k in range(n):
        ts = [(k + j / 6) / n for j in range(7)]
        layers.append(zone(path([edge(t, -1) for t in ts] + [edge(t, 1) for t in reversed(ts)]), colors[k % len(colors)]))
    return layers


def flower(cx, cy, r, petal, heart, n=5, turn=0.0):
    """Flower to colour: round petals, then the heart over them."""
    layers = []
    for k in range(n):
        a = 2 * math.pi * k / n - math.pi / 2 + turn
        layers.append(zone(ellipse(cx + 0.55 * r * math.cos(a), cy + 0.55 * r * math.sin(a), 0.45 * r), petal))
    layers.append(zone(ellipse(cx, cy, 0.36 * r), heart))
    return layers


def plant(cx, cy, r, bottom, petal, heart, leaf, n=5):
    """Flower on a stem with a leaf."""
    return [line(f"M{cx} {bottom}L{cx} {cy}", "#3E6B2E", 5),
            zone(f"M{cx} {bottom - 18}Q{cx + 30} {bottom - 40} {cx + 38} {bottom - 26}Q{cx + 22} {bottom - 8} {cx} {bottom - 18}Z", leaf),
            *flower(cx, cy, r, petal, heart, n)]


def bunting(x0, x1, y, sag, n, colors):
    """A string of triangle flags."""
    def at(t):
        return x0 + (x1 - x0) * t, y + 4 * sag * t * (1 - t)

    layers = [line(f"M{x0} {y}Q{(x0 + x1) / 2} {y + 2 * sag} {x1} {y}", width=3)]
    for k in range(n):
        a, b = at((k + 0.1) / n), at((k + 0.9) / n)
        tip = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 32)
        layers.append(zone(path([a, b, tip]), colors[k % len(colors)]))
    return layers


def air_balloon(cx, cy, rx, ry, colors, basket):
    """Hot air balloon: gores side by side, then a basket on ropes."""
    n = len(colors)
    layers = []
    for k in range(n):
        s0, s1 = -1 + 2 * k / n, -1 + 2 * (k + 1) / n
        ts = [0.85 * math.pi * j / 16 for j in range(17)]

        def at(sk, t):
            return cx + sk * rx * math.sin(t), cy - ry * math.cos(t) * (0.8 if math.cos(t) < 0 else 1)

        layers.append(zone(path([at(s0, t) for t in ts] + [at(s1, t) for t in reversed(ts)]), colors[k]))
    bottom = cy + 0.713 * ry
    layers.append(line(f"M{cx - 0.3 * rx:.0f} {bottom:.0f}L{cx - 0.2 * rx:.0f} {bottom + 0.35 * ry:.0f}"
                       f"M{cx + 0.3 * rx:.0f} {bottom:.0f}L{cx + 0.2 * rx:.0f} {bottom + 0.35 * ry:.0f}", width=3))
    layers.append(zone(rect(round(cx - 0.24 * rx), round(bottom + 0.35 * ry), round(0.48 * rx), round(0.25 * ry)), basket))
    return layers


def picket_fence(x0, x1, top, bottom, color, width=22, gap=8):
    """Pointed pickets in a row."""
    layers = [line(f"M{x0} {top + 22}H{x1}M{x0} {bottom - 14}H{x1}", "#8D5A35", 6)]
    x = x0
    while x + width <= x1:
        layers.append(zone(path([(x, bottom), (x, top + 10), (x + width / 2, top), (x + width, top + 10), (x + width, bottom)]), color))
        x += width + gap
    return layers


def lights(x0, x1, y, sag, n, colors):
    """Garland of round lamps."""
    def at(t):
        return x0 + (x1 - x0) * t, y + 4 * sag * t * (1 - t)

    layers = [line(f"M{x0} {y}Q{(x0 + x1) / 2} {y + 2 * sag} {x1} {y}", width=3)]
    for k in range(n):
        x, yy = at((k + 0.5) / n)
        layers.append(zone(ellipse(x, yy + 11, 8, 10), colors[k % len(colors)]))
    return layers


def clip_x(poly, a, b):
    """Part of a convex polygon between x = a and x = b."""
    for x_cut, keep in ((a, lambda q: q[0] >= a), (b, lambda q: q[0] <= b)):
        out = []
        for p, q in zip(poly, poly[1:] + poly[:1]):
            if keep(p):
                out.append(p)
            if keep(p) != keep(q):
                t = (x_cut - p[0]) / (q[0] - p[0])
                out.append((x_cut, p[1] + t * (q[1] - p[1])))
        poly = out
    return poly


def striped_fish(cx, cy, length, stripes, tail, flip=False):
    """Fish with a striped body, a tail and an eye."""
    s = -1 if flip else 1
    h = 0.4 * length
    x0, x1 = cx - 0.3 * length, cx + 0.5 * length  # tail end and nose, before flipping
    body = []
    for side in (-1, 1):
        for k in range(17):
            t = k / 16 if side < 0 else 1 - k / 16
            x = x0 + (x1 - x0) * t
            body.append((x, cy + side * h * 4 * t * (1 - t) / 1.1))
    n = len(stripes)
    layers = [zone(path([(cx - s * 0.22 * length, cy), (cx - s * 0.5 * length, cy - 0.3 * length),
                         (cx - s * 0.5 * length, cy + 0.3 * length)]), tail)]
    for k in range(n):
        piece = clip_x(body, x0 + (x1 - x0) * k / n, x0 + (x1 - x0) * (k + 1) / n)
        if flip:
            piece = [(2 * cx - x, y) for x, y in piece]
        layers.append(zone(path(piece), stripes[k]))
    layers.append({"d": f"M{cx + s * 0.3 * length:.1f} {cy - 0.06 * length:.1f}h0.1", "fill": "none", "stroke": DARK,
                   "stroke-width": 7, "stroke-linecap": "round"})
    return layers


def shell(cx, cy, r, a0, a1, colors):
    """Scallop shell or fan coral: ribs fanning out from the hinge, each with a rounded rim."""
    n = len(colors)
    layers = []
    for k in range(n):
        b0, b1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
        rim = [(cx + r * (1 + 0.1 * math.sin(math.pi * j / 6)) * math.cos(b0 + (b1 - b0) * j / 6),
                cy + r * (1 + 0.1 * math.sin(math.pi * j / 6)) * math.sin(b0 + (b1 - b0) * j / 6)) for j in range(7)]
        layers.append(zone(path([(cx, cy), *rim]), colors[k]))
    return layers


def anemone(cx, bottom, size, arms, foot):
    """Sea anemone: arms fanning up from a round foot."""
    n = len(arms)
    layers = []
    for k in range(n):
        a = math.pi * (1.1 + 0.8 * k / (n - 1))
        tip = (cx + size * math.cos(a), bottom - 0.3 * size + size * math.sin(a))
        base = (cx, bottom - 0.3 * size)
        mid = ((tip[0] + base[0]) / 2, (tip[1] + base[1]) / 2)
        nx, ny = -(tip[1] - base[1]) * 0.16, (tip[0] - base[0]) * 0.16
        layers.append(zone(f"M{base[0]:.1f} {base[1]:.1f}Q{mid[0] + nx:.1f} {mid[1] + ny:.1f} {tip[0]:.1f} {tip[1]:.1f}"
                           f"Q{mid[0] - nx:.1f} {mid[1] - ny:.1f} {base[0]:.1f} {base[1]:.1f}Z", arms[k]))
    layers.append(zone(f"M{cx - 0.45 * size:.1f} {bottom}A{0.45 * size:.1f} {0.4 * size:.1f} 0 0 1 {cx + 0.45 * size:.1f} {bottom}Z", foot))
    return layers


def jelly(cx, cy, r, colors, legs="#B399C8"):
    """Jellyfish: a striped bell over wavy legs."""
    layers = [line("".join(f"M{x:.0f} {cy}q6 {r * 0.4:.0f} 0 {r * 0.8:.0f}t0 {r * 0.8:.0f}"
                           for x in (cx - 0.6 * r, cx - 0.2 * r, cx + 0.2 * r, cx + 0.6 * r)), legs, 5)]
    bell = [(cx + r * math.cos(math.pi + math.pi * k / 24), cy + 0.9 * r * math.sin(math.pi + math.pi * k / 24))
            for k in range(25)]
    n = len(colors)
    for k in range(n):
        layers.append(zone(path(clip_x(bell, cx - r + 2 * r * k / n, cx - r + 2 * r * (k + 1) / n)), colors[k]))
    return layers


def toadstool_house(cx, bottom, w, cap, spots, stem, door):
    """Fairy house in a mushroom: stem with a door and a window, spotted cap."""
    h = 0.7 * w
    top = bottom - h
    layers = [zone(path([(cx - 0.3 * w, bottom), (cx - 0.26 * w, top), (cx + 0.26 * w, top), (cx + 0.3 * w, bottom)]), stem),
              zone(f"M{cx - 0.12 * w:.1f} {bottom}V{bottom - 0.32 * w:.1f}A{0.12 * w:.1f} {0.12 * w:.1f} 0 0 1 "
                   f"{cx + 0.12 * w:.1f} {bottom - 0.32 * w:.1f}V{bottom}Z", door),
              zone(ellipse(cx + 0.19 * w, bottom - 0.5 * w, 0.06 * w), door)]
    layers.append(zone(f"M{cx - 0.62 * w:.1f} {top + 0.08 * w:.1f}Q{cx - 0.55 * w:.1f} {top - 0.62 * w:.1f} {cx:.1f} {top - 0.62 * w:.1f}"
                       f"Q{cx + 0.55 * w:.1f} {top - 0.62 * w:.1f} {cx + 0.62 * w:.1f} {top + 0.08 * w:.1f}Z", cap))
    for dx, dy, r in ((-0.32, -0.12, 0.08), (0, -0.4, 0.09), (0.3, -0.16, 0.08), (-0.14, -0.26, 0.06), (0.17, -0.38, 0.05)):
        layers.append(zone(ellipse(cx + dx * w, top + dy * w, r * w), spots))
    return layers


def oval(cx, cy, rx, ry, angle):
    a = math.radians(angle)
    return path([(cx + rx * math.cos(t) * math.cos(a) - ry * math.sin(t) * math.sin(a),
                  cy + rx * math.cos(t) * math.sin(a) + ry * math.sin(t) * math.cos(a))
                 for t in (2 * math.pi * k / 24 for k in range(24))])


def butterfly(cx, cy, size, upper, lower, body):
    """Butterfly seen from above: four wings and a body."""
    layers = []
    for s in (-1, 1):
        layers.append(zone(oval(cx + s * 0.42 * size, cy - 0.22 * size, 0.42 * size, 0.3 * size, s * -35), upper))
        layers.append(zone(oval(cx + s * 0.32 * size, cy + 0.3 * size, 0.28 * size, 0.22 * size, s * 30), lower))
    layers.append(zone(oval(cx, cy, 0.09 * size, 0.42 * size, 0), body))
    layers.append(line(f"M{cx - 3:.0f} {cy - 0.4 * size:.0f}q-6 -14 -14 -18M{cx + 3:.0f} {cy - 0.4 * size:.0f}q6 -14 14 -18", width=3))
    return layers


def tuft(cx, bottom, h, colors):
    """Grass tuft: three blades."""
    return [zone(blade(cx + dx, bottom, h * k, 9, 6 * dx / 10, 0.4), c)
            for dx, k, c in ((-10, 0.8, colors[0]), (10, 0.85, colors[1 % len(colors)]), (0, 1.0, colors[2 % len(colors)]))]



def mushroom(cx, bottom, w, cap, spots, stem):
    """Small toadstool: stem, cap and three spots."""
    top = bottom - 0.6 * w
    return [zone(path([(cx - 0.16 * w, bottom), (cx - 0.12 * w, top), (cx + 0.12 * w, top), (cx + 0.16 * w, bottom)]), stem),
            zone(f"M{cx - 0.5 * w:.1f} {top:.1f}Q{cx - 0.45 * w:.1f} {top - 0.55 * w:.1f} {cx:.1f} {top - 0.55 * w:.1f}"
                 f"Q{cx + 0.45 * w:.1f} {top - 0.55 * w:.1f} {cx + 0.5 * w:.1f} {top:.1f}Z", cap),
            *[zone(ellipse(cx + dx * w, top + dy * w, 0.09 * w), spots) for dx, dy in ((-0.24, -0.14), (0.05, -0.33), (0.27, -0.13))]]


def cobbles(points, widths, colors):
    """Stones paving a path: rows across it, from (centre, width) pairs."""
    layers = []
    for row, ((x, y), w) in enumerate(zip(points, widths)):
        n = max(1, round(w / 34))
        for k in range(n):
            cx = x - w / 2 + w * (k + 0.5) / n
            layers.append(zone(blob(cx + (6 if row % 2 else -6), y, min(w / n, 30) * 0.42, 5, 0.1), colors[(row + k) % len(colors)]))
    return layers



def sailboat(cx, water, size, hull, sails, flag):
    """Sailboat: a hull of two planks, striped sails and a flag."""
    top = water - 0.2 * size
    layers = [zone(path([(cx - 0.5 * size, top), (cx + 0.55 * size, top), (cx + 0.47 * size, water - 0.1 * size),
                         (cx - 0.44 * size, water - 0.1 * size)]), hull[0]),
              zone(path([(cx - 0.44 * size, water - 0.1 * size), (cx + 0.47 * size, water - 0.1 * size),
                         (cx + 0.38 * size, water), (cx - 0.36 * size, water)]), hull[1]),
              line(f"M{cx:.0f} {top:.0f}V{water - 1.15 * size:.0f}", width=5)]
    main = [(cx + 0.03 * size, top - 0.06 * size), (cx + 0.03 * size, water - 1.08 * size), (cx + 0.48 * size, top - 0.06 * size)]
    jib = [(cx - 0.03 * size, top - 0.06 * size), (cx - 0.03 * size, water - 0.95 * size), (cx - 0.4 * size, top - 0.06 * size)]
    for k in range(3):
        layers.append(zone(path(clip_x(main, cx + 0.03 * size + 0.45 * size * k / 3, cx + 0.03 * size + 0.45 * size * (k + 1) / 3)),
                           sails[k % len(sails)]))
    for k in range(2):
        layers.append(zone(path(clip_x(jib, cx - 0.4 * size + 0.37 * size * k / 2, cx - 0.4 * size + 0.37 * size * (k + 1) / 2)),
                           sails[(k + 1) % len(sails)]))
    layers.append(zone(path([(cx, water - 1.15 * size), (cx + 0.22 * size, water - 1.1 * size), (cx, water - 1.04 * size)]), flag))
    return layers


DETAILED = {"lineWidth": 4, "minArea": 30, "minRadius": 4.3}  # the big pages: finer lines, smaller zones


SCENES = {
    "animaux/10_lion": {
        "title": "Le lion",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(655, 150, 80),
            puff(cloud(230, 230, 220)),
            *birds((470, 170, 14), (540, 130, 11)),
            zone("M0 600C200 560 520 590 800 550L800 1000L0 1000Z", "#E9C46A"),
            *tree(150, 300, 640),
            zone("M0 790C260 750 560 815 800 770L800 1000L0 1000Z", "#C9973F"),
            emo("1F981", 490, h=440, bottom=940),
        ],
    },
    "animaux/11_tortue": {
        "title": "La tortue",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(650, 140, 70),
            puff(cloud(250, 200, 200)),
            zone("M0 420C200 400 600 440 800 410L800 1000L0 1000Z", "#4FA3E0"),
            emo("26F5", 560, h=200, bottom=470, recolor={"#92d3f5": "#4FA3E0"}),
            zone("M0 640C220 600 560 670 800 620L800 1000L0 1000Z", "#E8C887"),
            emo("1F422", 400, h=300, bottom=900),
            emo("1F980", 660, h=140, bottom=965),
            emo("1F41A", 130, h=130, bottom=965),
        ],
    },
    "animaux/12_chouette": {
        "title": "La chouette",
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            emo("1F319", 610, h=220, cy=170),
            *stars((150, 120, 70), (300, 260, 50), (720, 400, 55), (90, 340, 45)),
            zone("M0 820C220 770 560 800 800 760L800 1000L0 1000Z", "#3E6B48"),
            *tree(340, 760, 960),
            emo("1F989", 360, h=330, cy=540),
        ],
    },
    "animaux/13_dinosaure": {
        "title": "Le dinosaure",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            emo("2604", 620, h=180, cy=160),
            zone("M0 560L140 380L280 520L420 330L600 560L720 420L800 500L800 1000L0 1000Z", "#9C7B5B"),
            zone("M0 700C250 660 550 720 800 680L800 1000L0 1000Z", "#8BC34A"),
            *tree(110, 280, 760),
            *tree(735, 200, 735),
            emo("1F996", 380, h=520, bottom=950),
        ],
    },
    "vehicules/20_train": {
        "title": "Le train",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(130, 140, 70),
            puff(cloud(520, 180, 200)),
            puff(cloud(700, 300, 140)),
            zone("M0 560C200 500 420 540 560 520C660 505 740 520 800 500L800 1000L0 1000Z", "#8BC34A"),
            *tree(660, 260, 600),
            zone(rect(0, 690, 800, 60), "#B08D6B"),
            line("M0 704H800", width=5), line("M0 736H800", width=5),
            emo("1F682", 400, w=640, bottom=712),
            zone(rect(0, 750, 800, 250), "#5C9E31"),
            emo("1F337", 120, h=150, bottom=960),
            emo("1F337", 300, h=130, bottom=985),
            emo("1F337", 680, h=150, bottom=970),
        ],
    },
    "vehicules/21_fusee": {
        "title": "La fusée",
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            emo("1F319", 160, h=200, cy=170),
            emo("1FA90", 620, h=260, cy=800),
            *stars((560, 120, 60), (720, 260, 45), (90, 480, 50), (300, 880, 55), (680, 560, 40)),
            emo("1F680", 400, h=560, cy=470),
        ],
    },
    "vehicules/22_voilier": {
        "title": "Le voilier",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(640, 150, 75),
            puff(cloud(230, 180, 220)),
            puff(cloud(600, 330, 150)),
            zone("M0 560C220 540 580 580 800 550L800 1000L0 1000Z", "#4FA3E0"),
            emo("26F5", 380, h=480, bottom=700, recolor={"#92d3f5": "#4FA3E0"}),
            zone("M0 700C200 670 600 720 800 690L800 1000L0 1000Z", "#2F7FC1"),
            emo("1F433", 600, h=220, bottom=930),
            emo("1F41F", 190, h=110, cy=880),
        ],
    },
    "vehicules/23_pompiers": {
        "title": "Les pompiers",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(680, 130, 65),
            puff(cloud(380, 170, 200)),
            zone("M0 600C250 570 550 610 800 580L800 1000L0 1000Z", "#7FB04B"),
            emo("1F3E0", 250, h=380, bottom=700),
            *tree(640, 320, 680),
            zone(rect(0, 740, 800, 180), "#8C8C8C"),
            {**line("M20 830H780", "#FFFFFF", 8), "stroke-dasharray": "40 30"},
            emo("1F692", 460, w=560, bottom=880),
            zone(rect(0, 920, 800, 80), "#5C9E31"),
        ],
    },
    "nature/30_jardin": {
        "title": "Le jardin",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(680, 130, 70),
            puff(cloud(250, 170, 200)),
            zone("M0 520C250 490 550 530 800 500L800 1000L0 1000Z", "#B1CC33"),
            *[zone(rect(30 + 130 * k, 450, 70, 170), "#E0C097") for k in range(6)],
            zone(rect(0, 500, 800, 30), "#A57939"),
            emo("1F337", 110, h=260, bottom=760),
            emo("1F337", 240, h=230, bottom=790),
            emo("1F33B", 660, h=380, bottom=760),
            emo("1F33B", 520, h=300, bottom=800),
            zone("M0 780C250 750 550 800 800 760L800 1000L0 1000Z", "#5C9E31"),
            emo("1F344", 150, h=150, bottom=960),
            emo("1F40C", 400, h=140, bottom=955),
            emo("1F41E", 650, h=110, bottom=960),
            emo("1F98B", 380, h=200, cy=330),
            emo("1F41D", 560, h=120, cy=250),
        ],
    },
    "fetes/40_anniversaire": {
        "title": "L'anniversaire",
        "layers": [
            zone(rect(0, 0, 800, 1000), "#F9D9E3"),
            line("M20 90Q400 260 780 90", width=4),
            *[zone(f"M{x - 32} {y}L{x + 32} {y}L{x} {y + 70}Z", c) for x, y, c in [
                (90, 118, "#E8483B"), (200, 160, "#FFD23F"), (310, 182, "#4FA3E0"), (420, 186, "#5CBF60"),
                (530, 172, "#E8483B"), (640, 140, "#FFD23F"), (740, 105, "#4FA3E0")]],
            *stars((120, 380, 70), (690, 400, 60)),
            zone(rect(40, 760, 720, 40), "#C68B59"),
            zone(rect(70, 800, 660, 200), "#BDE6FF"),
            emo("1F382", 400, h=400, bottom=770),
            emo("1F368", 150, h=220, bottom=770),
            emo("1F353", 630, h=120, bottom=770),
            emo("1F353", 710, h=100, bottom=770),
        ],
    },
    "magie/50_licorne": {
        "title": "La licorne",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            emo("1F308", 500, w=600, bottom=790),
            puff(cloud(170, 170, 200)),
            *stars((110, 380, 60), (230, 560, 45), (90, 640, 40)),
            zone("M0 760C250 720 550 770 800 730L800 1000L0 1000Z", "#A5D86E"),
            emo("1F984", 460, h=520, bottom=950, recolor={"#ffffff": "#fce4f1"}),
            emo("1F337", 110, h=130, bottom=960),
            emo("1F337", 720, h=120, bottom=970),
        ],
    },
    "magie/51_chateau": {
        "title": "Le château",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(130, 140, 70),
            puff(cloud(520, 120, 200)),
            emo("1F409", 590, h=190, cy=250, flip=True),
            zone("M0 690C180 630 400 650 560 690C660 715 740 690 800 670L800 1000L0 1000Z", "#7FB04B"),
            emo("1F3F0", 380, h=440, bottom=760),
            zone("M0 820C230 780 520 830 800 790L800 1000L0 1000Z", "#5C9E31"),
            zone("M330 1000C350 920 380 860 400 760L440 760C450 860 500 920 540 1000Z", "#D9B98A"),
        ],
    },
    "scenes/60_mer": {
        "title": "Sous la mer",
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            zone("M0 300C250 280 550 320 800 290L800 1000L0 1000Z", "#4FA3E0"),
            zone("M0 600C250 580 550 620 800 590L800 1000L0 1000Z", "#1E63A8"),
            emo("1F433", 560, h=190, cy=140),
            emo("1F422", 230, h=150, cy=200),
            emo("1F41F", 200, h=100, cy=360),
            emo("1F41F", 640, h=90, cy=430, flip=True),
            emo("1F420", 400, h=140, cy=470),
            emo("1F420", 170, h=110, cy=640, flip=True),
            zone("M0 860C220 830 560 880 800 840L800 1000L0 1000Z", "#E8C887"),
            emo("1FAB8", 110, h=260, bottom=910),
            emo("1FAB8", 700, h=220, bottom=900),
            emo("1F419", 450, h=290, bottom=890),
            emo("1F980", 250, h=110, bottom=980),
            emo("1F41A", 610, h=100, bottom=980),
            *[puff(ellipse(x, y, r)) for x, y, r in [(690, 560, 18), (712, 515, 13), (728, 478, 10),
                                                                 (330, 300, 14), (345, 265, 10)]],
        ],
    },
    "scenes/61_ferme": {
        "title": "La ferme",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(130, 120, 65),
            puff(cloud(520, 140, 200)),
            puff(cloud(700, 250, 130)),
            zone("M0 430C200 380 420 410 560 400C680 390 750 380 800 370L800 1000L0 1000Z", "#A5D86E"),
            emo("1F3E0", 560, h=260, bottom=500),
            *tree(150, 260, 520),
            *tree(760, 170, 470),
            zone("M0 560C220 520 520 570 800 530L800 1000L0 1000Z", "#7FB04B"),
            emo("1F69C", 220, w=260, bottom=660),
            emo("1F404", 560, w=300, bottom=730),
            zone("M0 760C260 730 560 780 800 740L800 1000L0 1000Z", "#5C9E31"),
            emo("1F416", 360, w=220, bottom=910),
            emo("1F411", 660, w=200, bottom=920),
            emo("1F414", 130, h=170, bottom=950),
        ],
    },
    "scenes/62_espace": {
        "title": "Dans l'espace",
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            *stars((80, 90, 45), (330, 70, 55), (740, 80, 40), (420, 380, 45), (90, 700, 50), (740, 640, 45),
                   (300, 950, 40)),
            emo("1F319", 620, h=170, cy=160),
            emo("2604", 420, h=150, cy=200),
            emo("1FA90", 170, h=220, cy=300),
            emo("1F6F8", 620, h=150, cy=450),
            emo("1F680", 330, h=380, cy=620),
            emo("1F30D", 640, h=300, cy=820),
        ],
    },
    "details/74_ville": {
        "title": "La ville",
        **DETAILED,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            sun(700, 128, 42, "#FCEA2B"),
            puff(cloud(140, 125, 130)),
            puff(cloud(480, 100, 100)),
            *bunting(0, 800, 6, 12, 20, ("#D22F27", "#FCEA2B", "#61B2E4", "#B1CC33", "#FFA7C0")),
            *birds((560, 190, 9), (600, 172, 7)),
            *air_balloon(300, 150, 34, 46, ("#D22F27", "#FCEA2B", "#61B2E4", "#FCEA2B", "#D22F27"), "#A57939"),
            *air_balloon(585, 100, 22, 30, ("#B399C8", "#FFA7C0", "#B399C8", "#FFA7C0"), "#A57939"),
            emo("1FA81", 440, h=70, cy=215),
            *building(0, 96, 280, "#B399C8", "#FCEA2B", 4, 6, 470),
            *building(104, 86, 330, "#FFA7C0", "#FCEA2B", 3, 4, 470, roof="#D22F27"),
            *building(198, 104, 240, "#61B2E4", "#FCEA2B", 4, 7, 470),
            *building(310, 88, 310, "#F4AA41", "#FCEA2B", 3, 5, 470, roof="#A57939"),
            *building(406, 100, 270, "#D0CFCE", "#FCEA2B", 4, 6, 470),
            emo("1F3A1", 660, h=270, bottom=470),
            zone(rect(0, 470, 800, 180), "#B1CC33"),
            emo("1F3EB", 110, h=150, bottom=650),
            emo("1F3E5", 300, h=150, bottom=650),
            emo("1F3EC", 490, h=160, bottom=650),
            emo("1F3E1", 672, h=140, bottom=650),
            *[zone(rect(50 * k, 650, 50, 22), "#D0CFCE") for k in range(16)],
            zone(rect(0, 672, 800, 128), "#9B9B9A"),
            {**line("M10 736H790", "#FFFFFF", 5), "stroke-dasharray": "34 26"},
            emo("1F68C", 160, w=200, bottom=732, flip=True),
            emo("1F695", 440, w=130, bottom=732, flip=True),
            emo("1F6B2", 650, w=100, bottom=732, flip=True),
            emo("1F693", 100, w=130, bottom=796),
            emo("1F697", 320, w=130, bottom=796),
            emo("1F69A", 550, w=160, bottom=796),
            emo("1F691", 740, w=110, bottom=796),
            *[zone(rect(50 * k, 800, 50, 24), "#D0CFCE") for k in range(16)],
            zone(rect(0, 824, 800, 176), "#5C9E31"),
            *picket_fence(4, 800, 830, 880, "#A57939"),
            *tree(70, 200, 975, "#A57939"),
            *tree(730, 210, 980, "#A57939"),
            emo("26F2", 400, h=140, bottom=992),
            *plant(165, 915, 26, 975, "#FFA7C0", "#FCEA2B", "#B1CC33"),
            *plant(545, 905, 24, 960, "#B399C8", "#FCEA2B", "#B1CC33"),
            *plant(625, 930, 22, 990, "#D22F27", "#FCEA2B", "#B1CC33"),
            *plant(305, 905, 20, 950, "#61B2E4", "#FCEA2B", "#B1CC33"),
            *plant(458, 940, 18, 990, "#FFA7C0", "#FCEA2B", "#B1CC33"),
            emo("1F415", 245, w=100, bottom=997),
            emo("1F408", 515, w=75, bottom=997),
            emo("E009", 140, w=46, bottom=995),
            emo("1F6A6", 22, h=120, bottom=822),
            emo("1F68F", 785, h=110, bottom=822),
        ],
    },
    "details/75_foret": {
        "title": "La forêt enchantée",
        **DETAILED,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            emo("1F308", 400, w=560, bottom=330),
            puff(cloud(110, 90, 150)),
            puff(cloud(690, 110, 140)),
            emo("1F426", 560, w=60, cy=70, flip=True),
            *air_balloon(730, 120, 30, 40, ("#D22F27", "#F4AA41", "#FCEA2B", "#B1CC33", "#61B2E4", "#B399C8"), "#A57939"),
            *butterfly(255, 165, 44, "#FFA7C0", "#B399C8", "#A57939"),
            zone("M0 380C150 300 280 330 400 360C520 320 650 290 800 350L800 1000L0 1000Z", "#B1CC33"),
            emo("1F3F0", 630, h=170, bottom=360),
            *[emo("1F332", x, h=h, bottom=b) for x, h, b in [(40, 170, 470), (130, 140, 455), (330, 150, 470),
                                                             (470, 130, 460), (760, 170, 470)]],
            zone("M0 470C200 440 600 480 800 450L800 1000L0 1000Z", "#5C9E31"),
            *tree(220, 230, 560, "#A57939"),
            *tree(600, 250, 575, "#A57939"),
            *[zone(ellipse(x, y, 9), "#D22F27") for x, y in [(180, 375), (240, 360), (262, 400), (200, 415),
                                                              (560, 380), (630, 370), (655, 415), (585, 430),
                                                              (150, 405), (285, 375), (215, 345), (230, 400),
                                                              (530, 410), (680, 390), (610, 340), (620, 410)]],
            *lights(250, 580, 470, 24, 9, ("#FCEA2B", "#FFA7C0", "#B399C8")),
            emo("1F989", 600, h=80, cy=330),
            zone(ellipse(560, 705, 190, 60), "#61B2E4"),
            *[zone(ellipse(x, y, 18, 9), "#B1CC33") for x, y in [(430, 715), (520, 740), (650, 735), (700, 690)]],
            emo("1FAB7", 470, w=70, bottom=700),
            emo("1F986", 600, w=75, bottom=705),
            emo("1F438", 700, w=55, bottom=748),
            zone("M300 1000C330 900 380 820 470 760L520 772C440 830 410 900 420 1000Z", "#E8C887"),
            *cobbles([(372, 982), (380, 948), (392, 914), (408, 882), (428, 852), (452, 824), (478, 796)],
                     [96, 88, 80, 72, 62, 52, 42], ("#9B9B9A",)),
            emo("1F984", 140, h=230, bottom=780),
            emo("1F98C", 380, h=170, bottom=650),
            *toadstool_house(760, 790, 70, "#D22F27", "#FCEA2B", "#E8C887", "#A57939"),
            emo("1F98A", 680, w=100, bottom=880),
            emo("1F407", 560, h=85, bottom=880),
            emo("1F994", 240, w=95, bottom=880),
            emo("1F43F", 55, h=80, bottom=880),
            emo("1F43B", 470, h=110, bottom=600),
            emo("1F99D", 720, h=85, bottom=600),
            *butterfly(300, 280, 40, "#F4AA41", "#FCEA2B", "#A57939"),
            *butterfly(755, 245, 34, "#61B2E4", "#B399C8", "#A57939"),
            *butterfly(40, 520, 34, "#FCEA2B", "#F4AA41", "#A57939"),
            emo("1F41D", 470, w=45, cy=410),
            *toadstool_house(110, 995, 80, "#B399C8", "#FFA7C0", "#E8C887", "#A57939"),
            *[emo("1F344", x, h=h, bottom=b) for x, h, b in [(200, 70, 990), (660, 80, 992)]],
            emo("1FAB5", 525, w=110, bottom=990),
            emo("1F40C", 760, w=55, bottom=992),
            emo("1F41E", 300, w=40, bottom=940),
            emo("1F41B", 265, w=60, bottom=997),
            *plant(30, 955, 20, 995, "#FFA7C0", "#FCEA2B", "#B1CC33"),
            *plant(595, 930, 22, 985, "#B399C8", "#FCEA2B", "#B1CC33"),
            *plant(765, 905, 20, 950, "#F4AA41", "#FCEA2B", "#B1CC33"),
            *plant(160, 900, 20, 945, "#61B2E4", "#FCEA2B", "#B1CC33"),
            *flower(40, 600, 22, "#FFA7C0", "#FCEA2B"),
            *flower(790, 650, 18, "#B399C8", "#FCEA2B"),
            *flower(300, 700, 18, "#F4AA41", "#D22F27", 6),
            *flower(250, 620, 16, "#FFA7C0", "#FCEA2B", 6),
            *flower(520, 820, 18, "#61B2E4", "#FCEA2B"),
            *flower(340, 790, 16, "#B399C8", "#FCEA2B", 6),
            *[layer for x, b in [(470, 960), (720, 990), (300, 850), (600, 830), (110, 860), (230, 960),
                                 (20, 790), (330, 650)]
              for layer in tuft(x, b, 46, ("#B1CC33", "#5C9E31", "#B1CC33"))],
            *[zone(star(x, y, r, 0.45 * r), "#FCEA2B") for x, y, r in [(120, 300, 18), (400, 250, 15),
                                                                        (40, 700, 14), (780, 560, 14),
                                                                        (60, 200, 13), (460, 150, 12)]],
            *mushroom(330, 990, 44, "#D22F27", "#FCEA2B", "#E8C887"),
            *mushroom(590, 1000, 40, "#F4AA41", "#FCEA2B", "#E8C887"),
            *mushroom(450, 900, 36, "#B399C8", "#FCEA2B", "#E8C887"),
            *flower(270, 515, 20, "#61B2E4", "#FCEA2B"),
            *flower(555, 790, 18, "#FFA7C0", "#D22F27", 6),
            *flower(770, 515, 18, "#FCEA2B", "#F4AA41"),
            *flower(25, 840, 18, "#B399C8", "#FCEA2B", 6),
            *flower(420, 690, 16, "#FCEA2B", "#D22F27", 6),
            *flower(780, 745, 16, "#FFA7C0", "#FCEA2B"),
            *flower(205, 840, 16, "#F4AA41", "#FCEA2B"),
            *flower(560, 612, 18, "#B399C8", "#FCEA2B", 6),
            *flower(275, 775, 17, "#61B2E4", "#FCEA2B"),
            *butterfly(380, 120, 30, "#B399C8", "#61B2E4", "#A57939"),
        ],
    },
    "details/76_recif": {
        "title": "Le récif de corail",
        **DETAILED,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            sun(700, 70, 40, "#FCEA2B"),
            puff(cloud(180, 60, 130)),
            *birds((300, 70, 9), (340, 50, 7)),
            *sailboat(470, 166, 120, ("#D22F27", "#F4AA41"), ("#FCEA2B", "#FFA7C0"), "#61B2E4"),
            zone("M0 160C200 145 600 175 800 155L800 1000L0 1000Z", "#61B2E4"),
            *[zone(f"M{x} {y}Q{x + 25} {y - 22} {x + 50} {y}Q{x + 25} {y + 10} {x} {y}Z", "#92D3F5")
              for x, y in ((50 * k, 168 + round(10 * math.sin(k))) for k in range(16))],
            zone("M0 520C250 500 550 540 800 510L800 1000L0 1000Z", "#1E50A0"),
            emo("1F40B", 590, w=240, cy=325, recolor={"#61b2e4": "#1E50A0"}),  # the water's own blue otherwise
            emo("1F42C", 170, w=150, cy=250),
            *jelly(60, 430, 36, ("#B399C8", "#FFA7C0", "#B399C8", "#FFA7C0")),
            *jelly(385, 395, 32, ("#FFA7C0", "#B399C8", "#FFA7C0", "#B399C8")),
            *jelly(745, 480, 30, ("#FCEA2B", "#F4AA41", "#FCEA2B", "#F4AA41")),
            emo("1F422", 230, w=150, cy=575),
            emo("1F988", 620, w=160, cy=575, flip=True),
            *[layer for x, y, size, st, t, fl in [
                (420, 480, 64, ("#FCEA2B", "#D22F27", "#FCEA2B", "#D22F27"), "#F4AA41", False),
                (520, 450, 54, ("#F4AA41", "#D22F27", "#F4AA41"), "#D22F27", False),
                (470, 515, 50, ("#FCEA2B", "#D22F27", "#FCEA2B"), "#FCEA2B", False),
                (110, 680, 64, ("#FFA7C0", "#B399C8", "#FFA7C0", "#B399C8"), "#B399C8", True),
                (190, 720, 54, ("#B399C8", "#FFA7C0", "#B399C8"), "#FFA7C0", True),
                (720, 670, 60, ("#B1CC33", "#FCEA2B", "#B1CC33", "#FCEA2B"), "#FCEA2B", False),
                (650, 705, 50, ("#FCEA2B", "#B1CC33", "#FCEA2B"), "#B1CC33", False),
                (290, 330, 58, ("#FFA7C0", "#F4AA41", "#FFA7C0"), "#F4AA41", True),
                (420, 640, 56, ("#F4AA41", "#FCEA2B", "#F4AA41", "#FCEA2B"), "#D22F27", True)]
              for layer in striped_fish(x, y, size, st, t, fl)],
            *[emo(code, x, w=w, cy=y, flip=fl) for code, x, y, w, fl in [
                ("1F421", 760, 380, 60, True), ("1F420", 540, 640, 70, True), ("1F421", 40, 300, 55, False)]],
            emo("1F420", 320, w=75, cy=455, recolor={"#61b2e4": "#1E50A0"}),
            *striped_fish(330, 730, 64, ("#61B2E4", "#FCEA2B", "#61B2E4", "#FCEA2B"), "#FCEA2B"),
            *[layer for x, y, st, fl in [(470, 595, ("#FFA7C0", "#FCEA2B", "#FFA7C0"), False),
                                         (95, 625, ("#FCEA2B", "#D22F27", "#FCEA2B"), True),
                                         (560, 715, ("#B1CC33", "#FFA7C0", "#B1CC33"), False),
                                         (250, 640, ("#61B2E4", "#F4AA41", "#61B2E4"), True)]
              for layer in striped_fish(x, y, 46, st, st[1], fl)],
            *[zone(blob(x, y, r, 6, 0.1), "#9B9B9A") for x, y, r in [(90, 830, 40), (240, 820, 34), (400, 815, 30),
                                                                       (560, 812, 34), (720, 820, 40)]],
            zone("M0 830C150 790 300 820 420 805C560 790 680 820 800 800L800 1000L0 1000Z", "#E8C887"),
            zone("M0 930C200 905 420 940 600 915C680 905 750 920 800 910L800 1000L0 1000Z", "#F4AA41"),
            *kelp(30, 880, 280, 34, 14, 1.2, 0.0, ("#5C9E31", "#B1CC33"), n=8),
            *shell(220, 985, 30, math.pi * 1.1, math.pi * 1.9, ("#FFA7C0", "#FCEA2B", "#FFA7C0", "#FCEA2B")),
            *[zone(star(x, y, r, 0.5 * r), c) for x, y, r, c in [(470, 985, 16, "#D22F27"), (300, 975, 14, "#FFA7C0"),
                                                                  (140, 955, 13, "#D22F27"), (600, 955, 13, "#FCEA2B"),
                                                                  (380, 950, 12, "#B399C8"), (720, 975, 12, "#FFA7C0")]],
            *[zone(blob(x, y, r, 5, 0.12), "#9B9B9A") for x, y, r in [(30, 950, 12), (190, 945, 10), (560, 990, 11),
                                                                        (740, 950, 10), (350, 990, 9), (660, 950, 9)]],
            *shell(110, 1000, 34, math.pi * 1.1, math.pi * 1.9, ("#FCEA2B", "#FFA7C0", "#FCEA2B", "#FFA7C0")),
            *[zone(blob(x, y, r, 5, 0.12), "#9B9B9A") for x, y, r in [(260, 945, 9), (420, 945, 10), (500, 930, 9),
                                                                        (760, 930, 9), (40, 990, 9), (620, 995, 8)]],
            *shell(700, 990, 26, math.pi * 1.1, math.pi * 1.9, ("#B399C8", "#FFA7C0", "#B399C8", "#FFA7C0")),
            *shell(470, 1002, 28, math.pi * 1.1, math.pi * 1.9, ("#B399C8", "#FCEA2B", "#B399C8", "#FCEA2B")),
            *kelp(470, 850, 120, 22, 8, 1.0, 0.4, ("#B1CC33", "#5C9E31"), n=3),
            *kelp(625, 860, 140, 22, 8, 1.2, 1.1, ("#5C9E31", "#B1CC33"), n=4),
            *kelp(775, 870, 260, 30, 12, 1.1, 1.5, ("#B1CC33", "#5C9E31"), n=8),
            *kelp(505, 850, 190, 28, 10, 1.3, 0.7, ("#5C9E31", "#B1CC33"), n=5),
            *kelp(345, 840, 150, 24, 8, 1.0, 2.0, ("#B1CC33", "#5C9E31"), n=4),
            *shell(590, 850, 80, math.pi * 1.1, math.pi * 1.9, ("#FFA7C0", "#B399C8", "#FFA7C0", "#B399C8", "#FFA7C0", "#B399C8")),
            emo("1FAB8", 150, h=200, bottom=900),
            emo("1FAB8", 430, h=150, bottom=880),
            emo("1FAB8", 690, h=140, bottom=895),
            *anemone(260, 880, 60, ("#FFA7C0", "#D22F27", "#FFA7C0", "#D22F27", "#FFA7C0"), "#B399C8"),
            emo("1F419", 330, h=120, bottom=930),
            emo("1FA8E", 520, w=100, bottom=975),
            emo("2693", 770, h=85, bottom=992),
            emo("1F980", 75, w=85, bottom=992),
            emo("1F99E", 400, w=90, bottom=998),
            emo("1F990", 650, w=60, bottom=992),
            emo("1F991", 760, h=105, cy=575),
            *[zone(ellipse(x, y, r), "#92D3F5") for x, y, r in [(470, 410, 12), (480, 380, 10), (488, 354, 8),
                                                                (360, 540, 10), (366, 514, 8), (600, 470, 9),
                                                                (250, 470, 11), (258, 442, 9), (120, 520, 10),
                                                                (128, 494, 8), (690, 440, 10), (698, 414, 8),
                                                                (560, 760, 10), (568, 734, 8), (240, 790, 10)]],
            *[layer for x, y, size, st, t, fl in [
                (90, 360, 70, ("#F4AA41", "#FCEA2B", "#F4AA41", "#FCEA2B"), "#D22F27", False),
                (645, 478, 66, ("#1E50A0", "#FCEA2B", "#1E50A0", "#FCEA2B"), "#FCEA2B", True),
                (355, 600, 62, ("#B1CC33", "#61B2E4", "#B1CC33", "#61B2E4"), "#61B2E4", True),
                (760, 760, 60, ("#FFA7C0", "#FCEA2B", "#FFA7C0", "#FCEA2B"), "#FCEA2B", True)]
              for layer in striped_fish(x, y, size, st, t, fl)],
            *[layer for x, y in [(150, 470), (205, 455), (185, 500), (240, 490)]
              for layer in striped_fish(x, y, 40, ("#F4AA41", "#FCEA2B", "#F4AA41"), "#F4AA41", True)],
        ],
    },
}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sources", type=Path, help="folder of OpenMoji colour SVGs named <hexcode>.svg")
    ap.add_argument("--out", type=Path, help="drawings folder (one sub-folder per category)")
    ap.add_argument("--only", nargs="*", help="scene names to write, such as animaux/10_lion")
    ap.add_argument("--list-emoji", action="store_true", help="print the OpenMoji codes the scenes use, then stop")
    args = ap.parse_args()
    if args.list_emoji:
        print(" ".join(sorted({layer["emoji"] for scene in SCENES.values() for layer in scene["layers"] if "emoji" in layer})))
        return
    if not args.sources or not args.out:
        ap.error("--sources and --out are required")
    for name, scene in SCENES.items():
        if args.only and name not in args.only:
            continue
        spec = {"viewBox": [0, 0, 800, 1000], "lineWidth": 6, "maxColors": 12, "minArea": 150, **scene}
        svg, zones, colors, level, merges = make(spec, args.sources)
        out = args.out / f"{name}.svg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(svg, encoding="utf-8")
        print(f"{name}: {zones} zones, {colors} colours, level {level}")
        for c, rep in merges:
            print(f"    {c} drawn as {rep}")


if __name__ == "__main__":
    main()
