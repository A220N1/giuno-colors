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


# ---- the very big pages and the mystery pages

import random  # noqa: E402


def wall(x, y, w, h, rows, cols, colors):
    """Wall of bricks in staggered rows, each brick a zone."""
    layers, bh, bw = [], h / rows, w / cols
    for r in range(rows):
        off = 0.5 * (r % 2)
        xs = sorted({0.0, float(w)} | {round((k + off) * bw, 1) for k in range(cols + 1) if 0 < (k + off) * bw < w})
        for i, (a, b) in enumerate(zip(xs, xs[1:])):
            layers.append(zone(rect(round(x + a, 1), round(y + r * bh, 1), round(b - a, 1), round(bh, 1)), colors[(r + i) % len(colors)]))
    return layers


def battlements(x, y, w, n, h, color):
    """Merlons along the top of a wall."""
    step = w / (2 * n - 1)
    return [zone(rect(round(x + 2 * k * step, 1), y - h, round(step, 1), h), color) for k in range(n)]


def tower(x, y, w, h, rows, cols, stones, roof, window):
    """Round tower seen from the front: stones, merlons, a pointed roof and a lit window."""
    return [*wall(x, y, w, h, rows, cols, stones), *battlements(x - 6, y, w + 12, 4, 18, stones[0]),
            zone(path([(x - 14, y - 18), (x + w / 2, y - 18 - 0.9 * w), (x + w + 14, y - 18)]), roof),
            zone(f"M{x + w / 2 - 11} {y + 0.42 * h}V{y + 0.42 * h - 22}A11 11 0 0 1 {x + w / 2 + 11} {y + 0.42 * h - 22}V{y + 0.42 * h}Z", window)]


def gift(x, bottom, w, h, box, ribbon):
    """Wrapped present: a box, a ribbon and its bow."""
    return [zone(rect(x, bottom - h, w, h), box), zone(rect(x + w / 2 - 6, bottom - h, 12, h), ribbon),
            zone(ellipse(x + w / 2 - 10, bottom - h - 7, 10, 7), ribbon), zone(ellipse(x + w / 2 + 10, bottom - h - 7, 10, 7), ribbon)]


def flames(cx, bottom, w, h, colors):
    """A fire: flames one inside the other."""
    def one(s):
        return (f"M{cx - w * s / 2:.0f} {bottom}C{cx - w * s * 0.7:.0f} {bottom - h * s * 0.5:.0f} {cx - w * s * 0.1:.0f} {bottom - h * s * 0.6:.0f} "
                f"{cx + w * s * 0.05:.0f} {bottom - h * s:.0f}C{cx + w * s * 0.25:.0f} {bottom - h * s * 0.6:.0f} {cx + w * s * 0.7:.0f} "
                f"{bottom - h * s * 0.45:.0f} {cx + w * s / 2:.0f} {bottom}Z")
    return [zone(one(s), c) for s, c in zip((1, 0.66, 0.36), colors)]


def peak(cx, base, w, h, rock, snow):
    """Mountain with a snow cap."""
    return [zone(path([(cx - w / 2, base), (cx, base - h), (cx + w / 2, base)]), rock),
            zone(path([(cx - 0.16 * w, base - 0.68 * h), (cx, base - h), (cx + 0.16 * w, base - 0.68 * h), (cx + 0.07 * w, base - 0.6 * h),
                       (cx, base - 0.7 * h), (cx - 0.07 * w, base - 0.6 * h)]), snow)]


def candy_cane(x, bottom, h, colors):
    """Candy cane: a striped stick with a hook, cut into pieces coloured in turn."""
    w, n = 0.2 * h, 6
    layers = [zone(rect(round(x - w / 2, 1), round(bottom - (k + 1) * 0.7 * h / n, 1), round(w, 1), round(0.7 * h / n, 1)), colors[k % 2]) for k in range(n)]
    r0, r1, cy = 0.5 * w, 1.5 * w, bottom - 0.7 * h
    for k in range(3):
        a0, a1 = math.pi * (1 - k / 3), math.pi * (1 - (k + 1) / 3)
        arc = [(x + w + r * math.cos(a), cy - r * math.sin(a)) for r, aa in ((r1, (a0, (a0 + a1) / 2, a1)), (r0, (a1, (a0 + a1) / 2, a0))) for a in aa]
        layers.append(zone(path(arc), colors[k % 2]))
    return layers


def heart(cx, cy, r):
    return (f"M{cx} {cy + r:.0f}C{cx - 1.6 * r:.0f} {cy - 0.2 * r:.0f} {cx - 0.8 * r:.0f} {cy - 1.3 * r:.0f} {cx} {cy - 0.45 * r:.0f}"
            f"C{cx + 0.8 * r:.0f} {cy - 1.3 * r:.0f} {cx + 1.6 * r:.0f} {cy - 0.2 * r:.0f} {cx} {cy + r:.0f}Z")


def scatter(n, x0, x1, y0, y1, seed, gap):
    """n spots in a box, none closer than gap to another: the same ones on every run."""
    rng, spots, tries = random.Random(seed), [], 0
    while len(spots) < n and tries < 4000:
        tries += 1
        s = (rng.randint(x0, x1), rng.randint(y0, y1))
        if all((s[0] - q[0]) ** 2 + (s[1] - q[1]) ** 2 >= gap * gap for q in spots):
            spots.append(s)
    return spots


def meadow(n, x0, x1, y0, y1, seed, petals, hearts=("#FCEA2B", "#D22F27")):
    """Flowers strewn over a field."""
    rng = random.Random(seed + 1)
    return [layer for x, y in scatter(n, x0, x1, y0, y1, seed, 60)
            for layer in flower(x, y, rng.choice((22, 24, 26)), rng.choice(petals), rng.choice(hearts), 5)]


def coins(spots, r, color):
    return [zone(ellipse(x, y, r, 0.8 * r), color) for x, y in spots]


STONES = ("#9B9B9A", "#D0CFCE", "#9B9B9A", "#6A462F")
PETALS = ("#FFA7C0", "#B399C8", "#F4AA41", "#61B2E4", "#D22F27")

SCENES.update({
    "details/77_dragons": {
        "title": "La vallée des dragons",
        **DETAILED,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            sun(690, 90, 46),
            puff(cloud(150, 110, 170)), puff(cloud(470, 70, 130)),
            *peak(120, 430, 300, 250, "#9B9B9A", "#D0CFCE"), *peak(330, 430, 260, 190, "#6A462F", "#D0CFCE"),
            *peak(700, 430, 320, 230, "#9B9B9A", "#D0CFCE"),
            emo("1F30B", 540, h=210, bottom=440),
            emo("1F409", 300, h=120, cy=170),
            zone("M0 420C160 380 300 410 420 430C560 400 680 390 800 425L800 1000L0 1000Z", "#B1CC33"),
            *[emo("1F332", x, h=h, bottom=b) for x, h, b in [(440, 130, 500), (500, 110, 492), (740, 150, 505), (680, 110, 490)]],
            *wall(130, 400, 190, 170, 10, 10, STONES), *battlements(130, 400, 190, 6, 16, "#9B9B9A"),
            zone("M190 570V500A30 30 0 0 1 250 500V570Z", "#6A462F"),
            *tower(30, 290, 110, 280, 16, 6, STONES, "#D22F27", "#FCEA2B"),
            *tower(310, 290, 110, 280, 16, 6, STONES, "#D22F27", "#FCEA2B"),
            *bunting(85, 365, 300, 26, 12, ("#D22F27", "#FCEA2B", "#61B2E4", "#B399C8")),
            emo("1F6E1", 160, h=44, cy=455), emo("1F6E1", 290, h=44, cy=455),
            zone("M0 560C200 530 520 570 800 540L800 1000L0 1000Z", "#5C9E31"),
            zone("M200 1000C215 880 215 700 195 570L245 570C285 700 330 880 380 1000Z", "#E8C887"),
            *cobbles([(290, 985), (272, 945), (258, 905), (246, 865), (238, 825), (232, 785), (228, 745), (224, 705), (221, 665), (219, 625), (218, 590)],
                     [150, 140, 128, 116, 104, 94, 84, 74, 64, 56, 48], ("#9B9B9A", "#D0CFCE")),
            *meadow(40, 24, 776, 600, 980, 77, PETALS),
            *[layer for x, b in scatter(14, 20, 780, 620, 990, 78, 90) for layer in tuft(x, b, 52, ("#B1CC33", "#5C9E31", "#B1CC33"))],
            *picket_fence(430, 800, 548, 612, "#A57939", 24, 8),
            *wall(0, 940, 180, 60, 3, 8, STONES), *wall(470, 946, 330, 54, 3, 14, STONES),
            emo("1F409", 590, h=330, bottom=860),
            *flames(418, 700, 70, 110, ("#D22F27", "#F4AA41", "#FCEA2B")),
            *flames(372, 716, 44, 70, ("#D22F27", "#F4AA41", "#FCEA2B")),
            emo("1F409", 90, h=170, bottom=760, flip=True),
            zone(ellipse(640, 930, 130, 44), "#F4AA41"),
            *coins([(540, 925), (572, 905), (606, 935), (640, 905), (674, 932), (708, 908), (740, 930), (590, 952), (640, 955), (690, 955),
                    (556, 900), (724, 950)], 16, "#FCEA2B"),
            emo("1F48E", 575, h=46, bottom=905), emo("1F48E", 700, h=42, bottom=900), emo("1F48E", 640, h=40, bottom=975),
            emo("1F451", 640, h=64, bottom=905),
            emo("1FABA", 120, w=120, bottom=930),
            emo("1F95A", 95, h=44, bottom=905), emo("1F95A", 145, h=44, bottom=905),
            *mushroom(440, 985, 44, "#D22F27", "#FCEA2B", "#E8C887"), *mushroom(30, 800, 38, "#B399C8", "#FCEA2B", "#E8C887"),
            *mushroom(770, 990, 40, "#F4AA41", "#FCEA2B", "#E8C887"),
            *butterfly(470, 560, 34, "#FFA7C0", "#B399C8", "#A57939"), *butterfly(30, 610, 30, "#FCEA2B", "#F4AA41", "#A57939"),
            *butterfly(760, 700, 30, "#61B2E4", "#B399C8", "#A57939"),
            emo("1F9B4", 330, w=60, bottom=960),
        ],
    },
    "details/78_licornes": {
        "title": "Le pays des licornes",
        **DETAILED,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            emo("1F308", 400, w=760, bottom=470),
            sun(90, 80, 44),
            puff(cloud(250, 90, 150)), puff(cloud(620, 110, 170)), puff(cloud(740, 250, 110)), puff(cloud(60, 270, 120)),
            *[zone(heart(x, y, r), c) for x, y, r, c in [(400, 70, 18, "#D22F27"), (150, 190, 14, "#FFA7C0"), (680, 190, 14, "#B399C8"),
                                                          (520, 170, 12, "#FFA7C0"), (300, 200, 12, "#D22F27"), (60, 150, 13, "#B399C8"),
                                                          (760, 90, 13, "#D22F27"), (200, 300, 12, "#FFA7C0"), (600, 240, 12, "#D22F27"),
                                                          (720, 560, 13, "#FFA7C0"), (30, 590, 12, "#D22F27")]],
            *bunting(0, 800, 20, 26, 16, ("#FFA7C0", "#FCEA2B", "#B399C8", "#61B2E4", "#B1CC33")),
            *air_balloon(110, 380, 34, 44, ("#D22F27", "#F4AA41", "#FCEA2B", "#B1CC33", "#61B2E4", "#B399C8"), "#A57939"),
            zone("M0 470C160 420 320 450 430 470C560 430 680 420 800 460L800 1000L0 1000Z", "#B1CC33"),
            *wall(330, 330, 180, 140, 9, 10, ("#FFA7C0", "#D0CFCE", "#B399C8")), *battlements(330, 330, 180, 6, 16, "#B399C8"),
            zone("M395 470V420A25 25 0 0 1 445 420V470Z", "#A57939"),
            *tower(250, 250, 96, 220, 14, 5, ("#D0CFCE", "#FFA7C0", "#D0CFCE", "#B399C8"), "#61B2E4", "#FCEA2B"),
            *tower(494, 250, 96, 220, 14, 5, ("#D0CFCE", "#B399C8", "#D0CFCE", "#FFA7C0"), "#61B2E4", "#FCEA2B"),
            *bunting(298, 542, 260, 24, 10, ("#FCEA2B", "#FFA7C0", "#61B2E4")),
            *[emo("1F333", x, h=h, bottom=b) for x, h, b in [(180, 150, 500), (660, 150, 500), (740, 120, 485)]],
            zone("M0 560C220 520 560 580 800 540L800 1000L0 1000Z", "#5C9E31"),
            zone(ellipse(590, 700, 170, 54), "#61B2E4"),
            *[zone(ellipse(x, y, 17, 8), "#B1CC33") for x, y in [(480, 712), (700, 690), (640, 735)]],
            emo("1FAB7", 520, w=64, bottom=700), emo("1F9A2", 620, h=96, bottom=715),
            zone("M330 1000C350 900 380 800 420 680L460 690C440 800 440 900 450 1000Z", "#E8C887"),
            *cobbles([(392, 985), (396, 945), (402, 905), (408, 865), (416, 825), (424, 785), (432, 745), (440, 710)],
                     [116, 106, 96, 86, 76, 66, 56, 46], ("#FFA7C0", "#D0CFCE", "#B399C8")),
            *meadow(44, 24, 776, 590, 980, 78, PETALS),
            *[layer for x, b in scatter(10, 20, 780, 640, 990, 79, 100) for layer in tuft(x, b, 44, ("#B1CC33", "#5C9E31", "#B1CC33"))],
            *picket_fence(10, 300, 548, 604, "#D0CFCE"),
            *lights(470, 800, 520, 22, 14, ("#FCEA2B", "#FFA7C0", "#B399C8")),
            *bunting(0, 800, 500, 30, 14, ("#B399C8", "#FCEA2B", "#FFA7C0", "#61B2E4")),
            emo("1F3A0", 700, h=170, bottom=640),
            emo("1F984", 170, h=250, bottom=790),
            emo("1F984", 590, h=200, bottom=920, flip=True),
            emo("1F984", 330, h=130, bottom=640, flip=True),
            emo("1F9DA", 420, h=100, cy=170), emo("1F9DA", 60, h=96, cy=520),
            *toadstool_house(730, 880, 80, "#FFA7C0", "#FCEA2B", "#E8C887", "#A57939"),
            *toadstool_house(70, 990, 84, "#B399C8", "#FFA7C0", "#E8C887", "#A57939"),
            emo("1F388", 300, h=80, cy=330), emo("1F388", 540, h=70, cy=300), emo("1F388", 250, h=64, cy=400),
            emo("1F9C1", 270, h=70, bottom=990), emo("1F36D", 480, h=84, bottom=995), emo("1F36D", 760, h=76, bottom=998),
            *butterfly(360, 300, 40, "#FFA7C0", "#B399C8", "#A57939"), *butterfly(640, 360, 34, "#FCEA2B", "#F4AA41", "#A57939"),
            *butterfly(40, 660, 34, "#61B2E4", "#B399C8", "#A57939"), *butterfly(770, 720, 32, "#FFA7C0", "#FCEA2B", "#A57939"),
            *butterfly(450, 560, 30, "#B399C8", "#61B2E4", "#A57939"),
            *[zone(star(x, y, r, 0.45 * r), "#FCEA2B") for x, y, r in [(200, 130, 16), (560, 60, 14), (720, 150, 13), (330, 120, 12),
                                                                        (40, 180, 13), (460, 250, 12), (780, 330, 12), (20, 440, 12),
                                                                        (130, 60, 12), (660, 40, 12), (770, 200, 12), (10, 330, 12), (560, 130, 12)]],
            *plant(150, 905, 22, 960, "#FFA7C0", "#FCEA2B", "#B1CC33"), *plant(520, 945, 20, 995, "#B399C8", "#FCEA2B", "#B1CC33"),
            *plant(690, 935, 20, 985, "#F4AA41", "#FCEA2B", "#B1CC33"),
        ],
    },
    "details/79_noel": {
        "title": "Le village de Noël",
        **DETAILED,
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            zone(ellipse(660, 110, 58), "#FCEA2B"),
            *[zone(star(x, y, r, 0.45 * r), "#FCEA2B") for x, y, r in [(60, 60, 14), (170, 130, 12), (290, 50, 13), (400, 120, 12), (520, 60, 14),
                                                                        (760, 220, 12), (40, 220, 12), (230, 230, 11), (470, 210, 12), (580, 190, 11),
                                                                        (130, 300, 11), (350, 290, 11), (700, 310, 11), (780, 60, 12),
                                                                        (110, 110, 11), (340, 170, 11), (450, 60, 11), (560, 290, 11), (730, 130, 11),
                                                                        (20, 130, 11), (250, 110, 11), (600, 120, 11), (480, 330, 11), (30, 340, 11),
                                                                        (540, 140, 11), (200, 180, 11), (320, 230, 11), (90, 20, 11), (360, 30, 11),
                                                                        (640, 240, 11), (740, 30, 11), (430, 170, 11), (160, 60, 11), (560, 20, 11),
                                                                        (90, 190, 11), (270, 300, 11), (500, 250, 11), (610, 330, 11), (720, 250, 11),
                                                                        (20, 30, 11), (220, 20, 11), (480, 20, 11), (310, 150, 11), (170, 350, 11),
                                                                        (540, 370, 11), (660, 380, 11), (410, 330, 11), (60, 390, 11),
                                                                        (140, 150, 11), (370, 250, 11), (580, 240, 11), (760, 350, 11), (210, 60, 11),
                                                                        (510, 190, 11)]],
            emo("1F3D4", 150, h=230, bottom=420), emo("1F3D4", 610, h=200, bottom=410),
            zone("M0 400C180 360 330 390 440 410C570 380 690 370 800 400L800 1000L0 1000Z", "#92D3F5"),
            *[emo("1F332", x, h=h, bottom=b) for x, h, b in [(30, 150, 470), (110, 120, 455), (700, 140, 465), (775, 160, 475), (300, 110, 450)]],
            emo("26EA", 400, h=210, bottom=480),
            *building(40, 150, 470, "#D22F27", "#FCEA2B", 4, 4, 610, "#D0CFCE"),
            *building(610, 150, 480, "#5C9E31", "#FCEA2B", 4, 4, 610, "#D0CFCE"),
            *wall(210, 480, 140, 130, 10, 8, ("#D22F27", "#A57939", "#D22F27")), zone(path([(198, 480), (280, 416), (362, 480)]), "#D0CFCE"),
            zone(rect(262, 548, 36, 62), "#6A462F"), zone(rect(222, 500, 28, 28), "#FCEA2B"), zone(rect(310, 500, 28, 28), "#FCEA2B"),
            *wall(450, 490, 140, 120, 9, 8, ("#A57939", "#E8C887", "#A57939")), zone(path([(438, 490), (520, 428), (602, 490)]), "#D0CFCE"),
            zone(rect(502, 550, 36, 60), "#6A462F"), zone(rect(462, 508, 28, 26), "#FCEA2B"), zone(rect(550, 508, 28, 26), "#FCEA2B"),
            *lights(40, 190, 470, 14, 9, ("#D22F27", "#FCEA2B", "#B1CC33")), *lights(610, 760, 480, 14, 9, ("#FCEA2B", "#D22F27", "#61B2E4")),
            *lights(205, 355, 480, 12, 9, ("#FCEA2B", "#B1CC33", "#61B2E4")), *lights(445, 595, 490, 12, 9, ("#D22F27", "#FCEA2B", "#B399C8")),
            zone("M0 600C200 570 560 620 800 585L800 1000L0 1000Z", "#D0CFCE"),
            *bunting(0, 800, 610, 30, 20, ("#D22F27", "#B1CC33", "#FCEA2B", "#61B2E4")),
            zone("M330 1000C350 900 372 800 388 700L428 700C440 800 462 900 490 1000Z", "#E8C887"),
            *cobbles([(410, 985), (408, 945), (406, 905), (406, 865), (406, 825), (407, 785), (408, 745), (408, 715)],
                     [140, 126, 112, 98, 86, 74, 62, 50], ("#9B9B9A", "#A57939")),
            *wall(0, 622, 320, 68, 5, 16, ("#9B9B9A", "#D0CFCE", "#9B9B9A", "#A57939")), *wall(490, 622, 310, 68, 5, 16, ("#9B9B9A", "#D0CFCE", "#9B9B9A", "#A57939")),
            *picket_fence(20, 330, 720, 780, "#A57939"), *picket_fence(480, 790, 720, 780, "#A57939"),
            *lights(0, 330, 690, 22, 11, ("#D22F27", "#FCEA2B", "#B1CC33", "#61B2E4")), *lights(480, 800, 690, 22, 11, ("#FCEA2B", "#D22F27", "#B399C8", "#B1CC33")),
            emo("1F384", 400, h=300, bottom=745),
            emo("1F384", 110, h=170, bottom=720), emo("1F384", 700, h=160, bottom=715),
            *[zone(ellipse(x, y, 9), c) for x, y, c in [(30, 430, "#D22F27"), (48, 400, "#FCEA2B"), (20, 395, "#61B2E4"), (112, 425, "#FCEA2B"),
                                                         (98, 395, "#D22F27"), (700, 430, "#FCEA2B"), (712, 395, "#D22F27"), (690, 398, "#61B2E4"),
                                                         (775, 440, "#D22F27"), (762, 405, "#FCEA2B"), (790, 400, "#61B2E4"), (300, 425, "#D22F27"),
                                                         (310, 398, "#FCEA2B"), (288, 400, "#61B2E4")]],
            emo("2603", 230, h=150, bottom=900), emo("26C4", 620, h=130, bottom=880),
            emo("1F98C", 110, h=150, bottom=930), emo("1F6F7", 150, w=120, bottom=975),
            emo("1F385", 520, h=150, bottom=930), emo("1F936", 720, h=130, bottom=960),
            *[layer for x, b, w, h, c, r in [(300, 800, 50, 40, "#D22F27", "#FCEA2B"), (356, 806, 44, 46, "#61B2E4", "#D22F27"),
                                             (420, 800, 46, 38, "#B1CC33", "#D22F27"), (470, 808, 52, 48, "#B399C8", "#FCEA2B"),
                                             (330, 990, 60, 50, "#FCEA2B", "#D22F27"), (398, 995, 52, 60, "#D22F27", "#B1CC33"),
                                             (458, 990, 58, 46, "#61B2E4", "#FCEA2B"), (30, 995, 56, 50, "#B399C8", "#FCEA2B"),
                                             (560, 995, 50, 44, "#B1CC33", "#FCEA2B"), (616, 992, 46, 56, "#F4AA41", "#D22F27"),
                                             (90, 992, 50, 58, "#D22F27", "#B1CC33"), (146, 996, 44, 40, "#61B2E4", "#FCEA2B"),
                                             (668, 996, 44, 42, "#D22F27", "#FCEA2B"), (30, 860, 46, 40, "#F4AA41", "#D22F27"),
                                             (745, 880, 46, 44, "#B399C8", "#FCEA2B"), (640, 800, 44, 40, "#61B2E4", "#D22F27"),
                                             (20, 800, 44, 40, "#B1CC33", "#D22F27"), (590, 800, 44, 46, "#FCEA2B", "#D22F27"),
                                             (150, 800, 44, 40, "#D22F27", "#FCEA2B"), (720, 800, 46, 40, "#B1CC33", "#FCEA2B")]
              for layer in gift(x, b, w, h, c, r)],
            *candy_cane(30, 780, 90, ("#D22F27", "#D0CFCE")), *candy_cane(752, 790, 90, ("#D22F27", "#D0CFCE")),
            *candy_cane(326, 920, 76, ("#5C9E31", "#D0CFCE")), *candy_cane(470, 920, 76, ("#D22F27", "#D0CFCE")),
            emo("1F9F8", 275, h=90, bottom=995), emo("1F381", 700, h=80, bottom=998),
            emo("1F514", 400, h=56, cy=640), emo("1F56F", 60, h=70, bottom=860), emo("1F56F", 760, h=70, bottom=850),
            emo("1F36A", 205, h=44, cy=950), emo("1F36C", 540, h=44, cy=960), emo("1F36D", 250, h=70, bottom=780),
            emo("1F47C", 300, h=70, cy=360), emo("1F31F", 400, h=70, cy=430),
            *[zone(ellipse(x, y, r), "#D0CFCE") for x, y, r in [(90, 350, 9), (220, 330, 8), (520, 330, 8), (640, 350, 9), (760, 400, 8),
                                                                (360, 200, 8), (100, 160, 8), (600, 250, 8), (200, 80, 8), (480, 150, 8),
                                                                (700, 60, 8), (30, 420, 8), (560, 420, 8), (250, 400, 8), (340, 110, 8),
                                                                (620, 30, 8), (150, 240, 8), (420, 260, 8), (770, 270, 8), (300, 350, 8),
                                                                (60, 290, 8), (380, 80, 8), (530, 100, 8), (680, 170, 8), (250, 160, 8),
                                                                (120, 60, 8), (450, 380, 8), (590, 60, 8)]],
        ],
    },
    "mystere/90_pirates": {
        "title": "Le bateau des pirates",
        "mystery": True,
        "level": 2,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            sun(120, 120, 60),
            puff(cloud(430, 110, 190)), puff(cloud(690, 190, 150)),
            *birds((560, 90, 16), (620, 130, 12)),
            zone("M0 560C200 530 560 580 800 545L800 1000L0 1000Z", "#4FA3E0"),
            zone("M520 600C600 520 720 520 800 580L800 640L520 640Z", "#E8C887"),
            emo("1F334", 660, h=250, bottom=585), emo("1F334", 750, h=190, bottom=590, flip=True),
            *sailboat(300, 640, 330, ("#A57939", "#6A462F"), ("#D0CFCE", "#D22F27"), "#D22F27"),
            emo("1F99C", 470, h=110, cy=330),
            zone("M0 700C220 670 560 720 800 690L800 1000L0 1000Z", "#1E63A8"),
            *striped_fish(170, 800, 150, ("#F4AA41", "#FCEA2B", "#F4AA41", "#FCEA2B"), "#D22F27"),
            *striped_fish(600, 860, 130, ("#B399C8", "#FFA7C0", "#B399C8"), "#B399C8", flip=True),
            emo("1F40B", 420, h=150, cy=790),
            emo("1F48E", 700, h=70, bottom=640), emo("1F980", 590, h=70, bottom=650),
            zone("M0 940C220 915 560 955 800 925L800 1000L0 1000Z", "#E8C887"),
            emo("2693", 110, h=110, bottom=985), emo("1F41A", 330, h=70, bottom=990),
            *shell(570, 992, 60, 200, 340, ("#FFA7C0", "#F4AA41", "#FFA7C0", "#F4AA41", "#FFA7C0")),
        ],
    },
    "mystere/91_dinosaures": {
        "title": "Les dinosaures",
        "mystery": True,
        "level": 2,
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            sun(110, 110, 56),
            puff(cloud(380, 90, 170)),
            *peak(150, 480, 330, 240, "#9B9B9A", "#D0CFCE"),
            emo("1F30B", 600, h=330, bottom=500),
            zone("M0 470C200 430 520 480 800 450L800 1000L0 1000Z", "#B1CC33"),
            emo("1F334", 70, h=260, bottom=600), emo("1F334", 740, h=230, bottom=600, flip=True),
            zone(ellipse(250, 660, 190, 52), "#61B2E4"),
            emo("1F40A", 240, w=190, bottom=690),
            zone("M0 700C220 670 560 730 800 690L800 1000L0 1000Z", "#5C9E31"),
            emo("1F995", 560, h=360, bottom=880),
            emo("1F996", 200, h=260, bottom=960, flip=True),
            emo("1FABA", 660, w=130, bottom=985), emo("1F95A", 635, h=50, bottom=960), emo("1F95A", 690, h=50, bottom=960),
            emo("1F9B4", 420, w=80, bottom=975),
            *flower(60, 930, 22, "#FFA7C0", "#FCEA2B"), *flower(470, 900, 20, "#B399C8", "#FCEA2B", 6),
            *flower(360, 760, 18, "#F4AA41", "#D22F27"), *flower(770, 760, 18, "#FFA7C0", "#FCEA2B", 6),
            *[layer for x, b in [(120, 780), (340, 990), (520, 760), (760, 900)] for layer in tuft(x, b, 50, ("#B1CC33", "#5C9E31", "#B1CC33"))],
            *butterfly(430, 330, 44, "#F4AA41", "#FCEA2B", "#A57939"),
        ],
    },
    "mystere/92_cirque": {
        "title": "Le cirque",
        "mystery": True,
        "level": 2,
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            *[zone(star(x, y, r, 0.45 * r), "#FCEA2B") for x, y, r in [(70, 70, 18), (220, 130, 14), (590, 60, 16), (740, 150, 15),
                                                                        (400, 40, 13), (40, 260, 13), (770, 330, 13)]],
            emo("1F3AA", 400, h=440, bottom=560),
            *bunting(0, 800, 150, 40, 12, ("#D22F27", "#FCEA2B", "#61B2E4", "#B1CC33")),
            zone("M0 540C200 515 600 515 800 540L800 1000L0 1000Z", "#E8C887"),
            zone(ellipse(400, 800, 330, 120), "#D22F27"), zone(ellipse(400, 800, 270, 92), "#FCEA2B"),
            emo("1F418", 250, h=250, bottom=820),
            emo("1F981", 590, h=200, bottom=800),
            emo("1F921", 420, h=170, bottom=960),
            emo("1F412", 720, h=130, bottom=960),
            emo("1F388", 80, h=130, cy=420), emo("1F388", 150, h=110, cy=500), emo("1F388", 700, h=120, cy=440),
            emo("1F3A9", 110, h=90, bottom=960), emo("1F941", 240, h=90, bottom=985), emo("1F3BA", 600, w=120, bottom=975),
            *lights(60, 740, 590, 20, 12, ("#FCEA2B", "#D22F27", "#61B2E4", "#B1CC33")),
        ],
    },
})


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
