"""Write the geometric drawings of Giuno Colors (mandalas, stained glass) into drawings/details/ (800 x 1000)."""
import argparse
import math
from pathlib import Path
from xml.sax.saxutils import escape

W, H = 800, 1000
TAU = 2 * math.pi
STEP = math.radians(6)  # angle between the knots of a curved edge; divides a full turn
USTEP = 1 / 8           # the same across a band
LEAD = "#2f2b2b"


def f(v):
    s = f"{v:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    return "0" if s == "-0" else s


def pt(p):
    return f"{f(p[0])} {f(p[1])}"


class Drawing:
    """Zones and decorations of one drawing over a named palette."""

    def __init__(self, title, palette):
        self.title, self.palette = title, palette
        self.index = {name: k + 1 for k, name in enumerate(palette)}
        self.items = []
        self.paths = []
        self.led = 0

    def zone(self, d, color):
        self.items.append(f'  <path data-c="{self.index[color]}" fill="{self.palette[color]}" d="{d}"/>')
        self.paths.append(d)

    def deco(self, element):
        self.items.append("  " + element)

    def leads(self, width, frame=False):
        """Lead lines of a stained-glass window over the zones added since the last call (and around the page).

        Called once per layer, so that the pieces laid on top hide the lead under them.
        """
        d = "".join(self.paths[self.led:]) + (f"M0 0H{W}V{H}H0Z" if frame else "")
        self.led = len(self.paths)
        self.deco(f'<path fill="none" stroke="{LEAD}" stroke-width="{width}" stroke-linejoin="round" d="{d}"/>')

    def svg(self):
        title = escape(self.title, {'"': "&quot;"})
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"\n'
                f'     data-title="{title}" data-level="3"\n'
                f'     data-palette="{" ".join(self.palette.values())}">\n'
                + "\n".join(self.items) + "\n</svg>\n")


# ---- shapes ----

def circle(x, y, r):
    return (f"M{f(x - r)} {f(y)}A{f(r)} {f(r)} 0 1 0 {f(x + r)} {f(y)}"
            f"A{f(r)} {f(r)} 0 1 0 {f(x - r)} {f(y)}Z")


def lens(p, q, w):
    """Two circular arcs from p to q, bulging w on each side."""
    c = math.dist(p, q)
    r = (c * c / 4 + w * w) / (2 * w)
    return f"M{pt(p)}A{f(r)} {f(r)} 0 0 1 {pt(q)}A{f(r)} {f(r)} 0 0 1 {pt(p)}Z"


def curve(fn, ts):
    """Cubic segments through fn(t) for t in ts, from fn(ts[0]) (not written), tangents taken from fn itself."""
    out = []
    for s0, s1 in zip(ts, ts[1:]):
        p0, p3 = fn(s0), fn(s1)
        e = (s1 - s0) * 0.01
        chord = math.dist(p0, p3)
        if chord < 1e-6:
            continue
        handles = []
        for a, b in ((p0, fn(s0 + e)), (fn(s1 - e), p3)):
            n = math.dist(a, b)
            v = ((b[0] - a[0]) / n, (b[1] - a[1]) / n) if n > 1e-9 else ((p3[0] - p0[0]) / chord, (p3[1] - p0[1]) / chord)
            handles.append(v)
        c1 = (p0[0] + handles[0][0] * chord / 3, p0[1] + handles[0][1] * chord / 3)
        c2 = (p3[0] - handles[1][0] * chord / 3, p3[1] - handles[1][1] * chord / 3)
        out.append(f"C{pt(c1)} {pt(c2)} {pt(p3)}")
    return out


# ---- polar grid ----

def radius(p, t):
    return p(t) if callable(p) else p


def angle(d, u):
    return d(u) if callable(d) else d


def turn(d, a):
    return (lambda u: d(u) + a) if callable(d) else d + a


def steps(a, b, step, extra=()):
    """Values strictly between a and b on a fixed grid (plus extra), then b, in the order a to b."""
    lo, hi = min(a, b), max(a, b)
    grid = [k * step for k in range(math.floor(lo / step) + 1, math.ceil(hi / step))]
    vals = sorted({v for v in grid if lo + 1e-9 < v < hi - 1e-9} | {v for v in extra if lo + 1e-9 < v < hi - 1e-9})
    return (vals if b > a else vals[::-1]) + [b]


def corners(p, a, b):
    """Angles between a and b where the profile p has a corner."""
    out = []
    for k in getattr(p, "kinks", ()):
        m = math.floor((min(a, b) - k) / TAU)
        while k + m * TAU < max(a, b):
            out.append(k + m * TAU)
            m += 1
    return out


class Box:
    """Distance from a centre to the edge of a rectangle, as a radius profile."""

    def __init__(self, cx, cy, x0, y0, x1, y1):
        self.c, self.r = (cx, cy), (x0, y0, x1, y1)
        self.kinks = [math.atan2(y - cy, x - cx) % TAU for x, y in ((x1, y1), (x0, y1), (x0, y0), (x1, y0))]

    def __call__(self, t):
        (cx, cy), (x0, y0, x1, y1) = self.c, self.r
        c, s = math.cos(t), math.sin(t)
        out = math.inf
        if c > 1e-12:
            out = min(out, (x1 - cx) / c)
        if c < -1e-12:
            out = min(out, (x0 - cx) / c)
        if s > 1e-12:
            out = min(out, (y1 - cy) / s)
        if s < -1e-12:
            out = min(out, (y0 - cy) / s)
        return out


class Polar:
    """Cells of a polar grid: bands between two radius profiles around a centre, split by dividers."""

    def __init__(self, cx, cy):
        self.cx, self.cy = cx, cy

    def at(self, r, t):
        return self.cx + r * math.cos(t), self.cy + r * math.sin(t)

    def cell(self, rin, rout, d0, d1, u0=0.0, u1=1.0):
        """Path of the cell between dividers d0 and d1 (angles growing from d0 to d1), across the band from u0 to u1."""
        def r(t, u):
            return (1 - u) * radius(rin, t) + u * radius(rout, t)

        def p(t, u):
            return self.at(r(t, u), t)

        def along(d, ua, ub):
            if not callable(d):
                return [f"L{pt(p(d, ub))}"]
            return curve(lambda u: p(d(u), u), [ua, *steps(ua, ub, USTEP)])

        def iso(u, ta, tb):
            if abs(tb - ta) < 1e-9:
                return []
            if not callable(rin) and not callable(rout):
                rr = r(0, u)
                if rr < 1e-6:
                    return []
                sweep = int(tb > ta)
                arc = f"A{f(rr)} {f(rr)} 0 "
                if abs(tb - ta) > math.pi * 1.999:
                    return [arc + f"0 {sweep} {pt(p((ta + tb) / 2, u))}", arc + f"0 {sweep} {pt(p(tb, u))}"]
                return [arc + f"{int(abs(tb - ta) > math.pi)} {sweep} {pt(p(tb, u))}"]
            kinks = corners(rin, ta, tb) + corners(rout, ta, tb)
            return curve(lambda t: p(t, u), [ta, *steps(ta, tb, STEP, kinks)])

        a0, b0, a1, b1 = angle(d0, u0), angle(d1, u0), angle(d0, u1), angle(d1, u1)
        segs = [f"M{pt(p(a0, u0))}", *along(d0, u0, u1), *iso(u1, a1, b1), *along(d1, u1, u0), *iso(u0, b0, a0)]
        return "".join(segs) + "Z"

    def ring(self, drawing, rin, rout, dividers, color, cuts=()):
        """One cell after each divider, all round, cut across at cuts (a list, or cuts(j)); color(j, k) names its colour."""
        self.fan(drawing, rin, rout, [*dividers, turn(dividers[0], TAU)], color, cuts)

    def fan(self, drawing, rin, rout, dividers, color, cuts=()):
        """Like ring, between the first and the last divider only."""
        for j in range(len(dividers) - 1):
            us = [0.0, *(cuts(j) if callable(cuts) else cuts), 1.0]
            for k in range(len(us) - 1):
                c = color(j, k)
                if c:
                    drawing.zone(self.cell(rin, rout, dividers[j], dividers[j + 1], us[k], us[k + 1]), c)

    def circle(self, t, r, size):
        return circle(*self.at(r, t), size)

    def lens(self, t, r0, r1, w):
        return lens(self.at(r0, t), self.at(r1, t), w)


def spokes(n, phase=0.0, twist=0.0):
    """n dividers evenly spaced, straight or twisted by `twist` radians across the band."""
    angles = [phase + TAU * j / n for j in range(n)]
    if twist:
        return [(lambda u, a=a: a + twist * u) for a in angles]
    return angles


def petals(n, shape, phase=0.0, rib=False, span=TAU):
    """Dividers of n petals centred from phase over span, half-width shape(u) (1 fills the sector).

    The cells go petal, gap (or left half, right half, gap).
    """
    h = span / n / 2
    out = []
    for j in range(n):
        a = phase + span * j / n + (h if span < TAU else 0)
        out.append(lambda u, a=a: a - h * shape(u))
        if rib:
            out.append(a)
        out.append(lambda u, a=a: a + h * shape(u))
    return out


def zigzag(n, phase=0.0):
    """Dividers of 2n triangles: teeth pointing out (even cells) and in (odd cells)."""
    h = math.pi / n
    out = []
    for j in range(n):
        a = phase + TAU * j / n
        out.append(lambda u, a=a: a + h * u)
        out.append(lambda u, a=a: a + 2 * h - h * u)
    return out


def zigzag_span(n, phase, span):
    """Inner dividers of a zigzag of n teeth over a span (for fan, which adds the two ends)."""
    h = span / n / 2
    out = []
    for j in range(n):
        a = phase + span * j / n
        out.append(lambda u, a=a: a + h * u)
        if j < n - 1:
            out.append(lambda u, a=a: a + 2 * h - h * u)
    return out


def pointed(u):
    return 1 - u ** 2.4


def rounded(u):
    return math.sqrt(max(0.0, 1 - u ** 2.2))


def straight(u):
    return 1 - u


def lancet(u, spring=0.625):
    """Gothic window: straight sides, then an equilateral pointed arch."""
    if u <= spring:
        return 1.0
    t = (u - spring) / (1 - spring)
    return -1 + math.sqrt(4 - 3 * t * t)


def scaled(shape, k):
    return lambda u: k * shape(u)


def alternate(*names):
    return lambda j, k: names[j % len(names)]


def checker(*names):
    return lambda j, k: names[(j + k) % len(names)]


def frame_rays(box, counts):
    """Ray dividers through the four corners of the box, the same on both sides of the vertical axis.

    counts gives the cells from the top axis to the top corner, between the corners, and from the bottom
    corner to the bottom axis; the two axis cells straddle the axis. Also returns each cell's rank from the top.
    """
    na, nb, nc = counts
    tr, br = box.kinks[3] - TAU, box.kinks[0]
    w = (tr + math.pi / 2) / (na - 0.5)
    right = [-math.pi / 2 + w * (k + 0.5) for k in range(na)]
    right += [tr + (br - tr) * k / nb for k in range(1, nb + 1)]
    w = (math.pi / 2 - br) / (nc - 0.5)
    right += [br + w * k for k in range(1, nc)]
    n = len(right)
    rank = [j + 1 for j in range(n - 1)] + [n] + [n - 1 - i for i in range(n - 1)] + [0]
    return right + [math.pi - a for a in reversed(right)], rank


def corner_fans(d, layers):
    """Quarter rosettes in the four corners of the page; layers(a) lists (rin, rout, dividers, color) from angle a."""
    for (x, y), a in (((0, 0), 0), ((W, 0), math.pi / 2), ((W, H), math.pi), ((0, H), 3 * math.pi / 2)):
        c = Polar(x, y)
        for rin, rout, dividers, color in layers(a):
            c.fan(d, rin, rout, [a, *dividers, a + math.pi / 2], color)


def quatrefoil(d, x, y, r, t, ring, leaf, leaf2, heart):
    """Round window: a ring with four leaves and a heart."""
    d.zone(circle(x, y, r), ring)
    for q in range(4):
        b = t + q * math.pi / 2
        p0 = (x + 0.2 * r * math.cos(b), y + 0.2 * r * math.sin(b))
        p1 = (x + 0.8 * r * math.cos(b), y + 0.8 * r * math.sin(b))
        d.zone(lens(p0, p1, 0.22 * r), leaf if q % 2 == 0 else leaf2)
    d.zone(circle(x, y, 0.2 * r), heart)


# ---- drawings ----

def mandala_fleuri():
    pal = {
        "rose": "#f7a8c4", "framboise": "#d94f7c", "peche": "#ffc49b", "beurre": "#ffe58a",
        "menthe": "#a8e6cf", "feuille": "#5fb86b", "ciel": "#a9d8ff", "bleu": "#5b8fd9",
        "lavande": "#cdb4f0", "violet": "#8e5cc9", "corail": "#ff8a6b", "creme": "#fff6e0",
    }
    d = Drawing("Le mandala fleuri", pal)
    c = Polar(400, 500)
    d.zone(circle(400, 500, 22), "beurre")
    c.ring(d, 22, 58, petals(8, pointed), alternate("rose", "menthe"))
    c.ring(d, 58, 82, spokes(16, math.pi / 16), alternate("violet", "lavande"))
    c.ring(d, 82, 125, petals(16, pointed, rib=True), alternate("peche", "corail", "beurre"))
    c.ring(d, 125, 148, spokes(32), checker("ciel", "creme"), cuts=[0.5])
    c.ring(d, 148, 224, petals(16, pointed, math.pi / 16), alternate("framboise", "menthe"))
    for j in range(16):
        t = TAU * j / 16
        d.zone(c.lens(t + math.pi / 16, 162, 208, 10.5), "rose")
    c.ring(d, 224, 244, spokes(32), alternate("bleu", "ciel"))
    c.ring(d, 244, 300, petals(32, pointed), alternate("lavande", "feuille"))
    c.ring(d, 300, 340, petals(40, rounded), alternate("rose", "creme"))
    rays, rank = frame_rays(Box(400, 500, 0, 0, W, H), (3, 7, 3))
    c.ring(d, 340, Box(400, 500, 0, 0, W, H), rays, lambda j, k: ("ciel", "menthe")[(rank[j] + k) % 2], cuts=[0.5])
    corner_fans(d, lambda a: [
        (0, 46, [], alternate("beurre")),
        (46, 100, petals(3, pointed, a, span=math.pi / 2), alternate("creme", "rose")),
        (100, 136, petals(5, rounded, a, span=math.pi / 2), alternate("creme", "lavande")),
    ])
    return d


def mandala_soleil():
    pal = {
        "or": "#ffc93c", "orange": "#ff9a3c", "rouge": "#e8483b", "rose": "#ff9fb8",
        "prune": "#9b4f96", "violet": "#7b6fd6", "nuit": "#34508f", "ciel": "#9fd8ff",
        "turquoise": "#2ec4b6", "vert": "#8ccf6a", "sable": "#f6e3b4", "peche": "#ffc2a1",
    }
    d = Drawing("Le mandala soleil", pal)
    c = Polar(400, 500)
    d.zone(circle(400, 500, 26), "rouge")
    c.ring(d, 26, 68, zigzag(12), alternate("or", "sable"))
    c.ring(d, 68, 94, spokes(24, 0, 0.35), alternate("turquoise", "ciel"))
    diamond = scaled(lambda u: 1 - abs(2 * u - 1), 0.82)
    c.ring(d, 94, 152, petals(12, diamond), lambda j, k: "violet" if j % 2 == 0 else ("or", "orange")[k],
           cuts=lambda j: [0.5] if j % 2 else [])
    for j in range(12):
        d.zone(c.circle(TAU * j / 12, 123, 8), "rose")
    c.ring(d, 152, 172, spokes(36), alternate("rouge", "or"))
    c.ring(d, 172, 252, petals(24, straight, math.pi / 24, rib=True), alternate("or", "orange", "sable"))
    for j in range(24):
        d.zone(c.circle(TAU * j / 24, 232, 9), "turquoise")
    c.ring(d, 252, 278, zigzag(24), alternate("nuit", "ciel"))
    c.ring(d, 278, 345, petals(24, pointed, rib=True), alternate("rose", "prune", "or"))
    for j in range(24):
        d.zone(c.lens(TAU * (j + 0.5) / 24, 300, 338, 6.5), "vert")
    rays, rank = frame_rays(Box(400, 500, 0, 0, W, H), (2, 5, 2))
    c.ring(d, 345, Box(400, 500, 0, 0, W, H), rays, lambda j, k: ("ciel", "sable")[(rank[j] + k) % 2], cuts=[0.5])
    corner_fans(d, lambda a: [
        (0, 52, [], alternate("rouge")),
        (52, 112, petals(4, straight, a, span=math.pi / 2), alternate("peche", "or")),
        (112, 150, zigzag_span(6, a, math.pi / 2), alternate("turquoise", "peche")),
    ])
    return d


def rosace():
    pal = {
        "rouge": "#d93b3b", "orange": "#f39237", "or": "#ffd23f", "vert": "#3fae6a",
        "menthe": "#a6e3b8", "ciel": "#8cc8ff", "bleu": "#2f6fd0", "violet": "#8a5cc4",
        "lilas": "#d2b6f2", "rose": "#f59ab8", "pierre": "#d8cdb8", "ardoise": "#9a8f80",
    }
    d = Drawing("La rosace", pal)
    cx, cy = 400, 400
    c = Polar(cx, cy)
    d.zone(circle(cx, cy, 14), "bleu")
    c.ring(d, 14, 58, petals(6, lambda u: 0.9 * math.sin(math.pi * (0.15 + 0.85 * u)) ** 0.55), alternate("or", "rouge"))
    c.ring(d, 58, 74, spokes(12, math.pi / 12), alternate("bleu", "ciel"))
    window = scaled(lancet, 0.76)
    c.ring(d, 74, 205, petals(12, window), lambda j, k: "pierre" if j % 2 else
           (("rouge", "or", "bleu"), ("bleu", "vert", "rouge"))[j // 2 % 2][k],
           cuts=lambda j: [] if j % 2 else [0.3, 0.625])
    c.ring(d, 205, 290, spokes(12, -math.pi / 12), alternate("bleu"))
    c.ring(d, 290, 330, petals(24, rounded), alternate("lilas", "orange", "rose", "orange"))
    c.ring(d, 330, 346, spokes(48), alternate("rouge", "bleu"))
    c.ring(d, 346, 362, spokes(36), alternate("pierre"))
    c.ring(d, 362, Box(cx, cy, 0, 0, W, 790), spokes(24, math.pi / 24), checker("pierre", "ardoise"), cuts=[0.5])
    # a row of six lancet windows under the rose
    top, spring, base, sill = 790, 872, 980, H
    rise = spring - 806
    for i in range(6):
        x0 = 20 + 130 * i
        x1, xm = x0 + 110, x0 + 55
        r = (55 ** 2 + rise ** 2) / 110
        arc = f"A{f(r)} {f(r)} 0 0 1"
        back = f"A{f(r)} {f(r)} 0 0 0"
        d.zone(f"M{x0} {top}H{x1}V{spring}{back} {xm} {top + 16}{back} {x0} {spring}Z", "pierre")
        d.zone(f"M{x0} {spring}{arc} {xm} {top + 16}{arc} {x1} {spring}Z", ("violet", "rose")[i % 2])
        for y0, y1, colors in ((spring, 926, ("bleu", "ciel")), (926, base, ("or", "rouge"))):
            for half in range(2):
                xa = x0 + 55 * half
                d.zone(f"M{xa} {y0}H{xa + 55}V{y1}H{xa}Z", colors[(half + i) % 2])
    for i in range(7):
        x = 130 * i
        d.zone(f"M{x} {top}H{x + 20}V{base}H{x}Z", "ardoise")
    d.zone(f"M0 {base}H{W}V{sill}H0Z", "pierre")
    d.leads(4.5)
    for j in range(12):
        t = TAU * j / 12
        x, y = c.at(247.5, t)
        quatrefoil(d, x, y, 35, t, "ciel", "rouge" if j % 2 == 0 else "violet", "or", "vert")
    for x, y in ((64, 64), (W - 64, 64), (64, 726), (W - 64, 726)):
        quatrefoil(d, x, y, 42, math.atan2(y - cy, x - cx), "menthe", "rouge", "or", "bleu")
    d.leads(4.5, frame=True)
    return d


class Ellipse:
    """Distance from the centre to the edge of an ellipse, as a radius profile."""

    def __init__(self, rx, ry):
        self.rx, self.ry = rx, ry

    def __call__(self, t):
        return 1 / math.hypot(math.cos(t) / self.rx, math.sin(t) / self.ry)


def stripe(cx, cy, rx, ry, y0, y1):
    """Horizontal slice of an ellipse."""
    hw = [rx * math.sqrt(max(0.0, 1 - ((y - cy) / ry) ** 2)) for y in (y0, y1)]
    arc = f"A{f(rx)} {f(ry)} 0 0 1"
    return f"M{f(cx - hw[0])} {f(y0)}H{f(cx + hw[0])}{arc} {f(cx + hw[1])} {f(y1)}H{f(cx - hw[1])}{arc} {f(cx - hw[0])} {f(y0)}Z"


def hermite(table, x):
    """Smooth curve through the (x, y) points of table, x increasing."""
    xs, ys = zip(*table)
    i = max(0, min(len(xs) - 2, next((k for k in range(len(xs) - 1) if x <= xs[k + 1]), len(xs) - 2)))

    def slope(k):
        a, b = max(0, k - 1), min(len(xs) - 1, k + 1)
        return (ys[b] - ys[a]) / (xs[b] - xs[a])

    h = xs[i + 1] - xs[i]
    t = (x - xs[i]) / h
    return ((2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] + (t ** 3 - 2 * t ** 2 + t) * h * slope(i)
            + (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] + (t ** 3 - t ** 2) * h * slope(i + 1))


def papillon():
    pal = {
        "violet": "#8e63ce", "lilas": "#cbb2f2", "rose": "#ff9ec4", "rouge": "#e5484d",
        "orange": "#ff9b42", "jaune": "#ffd84d", "vert": "#8fd16a", "turquoise": "#3cc6b8",
        "bleu": "#3f7fd6", "ciel": "#bfe6ff", "brun": "#8a5a3c", "creme": "#fff1c9",
    }
    d = Drawing("Le papillon en vitrail", pal)
    cx, cy = 400, 470
    c = Polar(cx, cy)
    body = Ellipse(14, 118)
    # wing depth from the body along each angle of the right wing (-pi/2 is up)
    END = 1.4
    table = [(-END, 0), (-1.25, 80), (-1.0, 220), (-0.7, 315), (-0.45, 330), (-0.25, 295), (-0.05, 225),
             (0.15, 198), (0.4, 232), (0.7, 255), (0.95, 225), (1.25, 70), (END, 0)]

    def fold(t):
        return math.atan2(math.sin(t), abs(math.cos(t)))

    def depth(t):
        phi = fold(t)
        return hermite(table, phi) if abs(phi) < END else 0.0

    def level(k):
        return lambda t: body(t) + k * depth(t)

    def wings(rin, rout, inner, color, cuts=()):
        """Ring of wing cells: inner holds the dividers of the right wing, color and cuts get the cell's
        number on its own wing."""
        right = [-END, *inner, END]
        n = len(right)

        def side(j):
            return j if j < n - 1 else 2 * n - 2 - j if n - 1 < j < 2 * n - 1 else None

        c.ring(d, rin, rout, right + [math.pi - a for a in reversed(right)],
               lambda j, k: None if side(j) is None else color(side(j), k),
               (lambda j: [] if side(j) is None else cuts(side(j))) if callable(cuts) else cuts)

    wings(body, level(0.34), [-0.75, -0.05, 0.6], lambda j, k: ("violet", "lilas")[j % 2])
    wings(level(0.34), level(0.72), [-1.0, -0.75, -0.42, -0.05, 0.28, 0.6, 0.92],
          lambda j, k: ("rose", "orange")[k], cuts=[0.5])
    wings(level(0.72), level(1), [-1.05 + 2.1 * k / 11 for k in range(12)],
          lambda j, k: "jaune" if k == 0 and 0 < j < 12 else ("bleu", "turquoise")[j % 2],
          cuts=lambda j: [0.5] if 0 < j < 12 else [])

    box = Box(cx, cy, 0, 0, W, H)
    halo = Ellipse(335, 440)

    def mid(t):
        return max(level(1)(t) + 45, halo(t))

    divs, rank = frame_rays(box, (6, 12, 6))
    # the two rays by the top axis bend apart as antennae, then go on straight
    top = len(divs) - 1
    spread = divs[0] + math.pi / 2
    outer = list(divs)
    outer[0], outer[top] = divs[0] + spread, divs[top] - spread
    divs[0] = lambda u, a=divs[0]: a + spread * (1 - (1 - u) ** 3)
    divs[top] = lambda u, a=divs[top]: a - spread * (1 - (1 - u) ** 3)

    def bg(names):
        return lambda j, k: names[(rank[j] + k) % 2]

    c.ring(d, level(1), mid, divs, bg(("ciel", "lilas")), cuts=[0.3])
    c.ring(d, mid, box, outer, bg(("lilas", "ciel")))
    d.leads(4)
    corner_fans(d, lambda a: [
        (0, 44, [], alternate("rose")),
        (44, 104, petals(3, pointed, a, span=math.pi / 2), alternate("vert", "jaune")),
    ])
    d.leads(4)
    for div in (divs[top], divs[0]):
        def on(u, div=div):
            return c.at(level(1)(div(u)) + u * (mid(div(u)) - level(1)(div(u))), div(u))
        ts = [0, *steps(0, 0.3, USTEP)]  # the same knots as the lead it covers
        d.deco(f'<path fill="none" stroke="{LEAD}" stroke-width="7" stroke-linecap="round" '
               f'd="M{pt(on(0))}{"".join(curve(on, ts))}"/>')
        d.zone(circle(*on(0.3), 11), "rouge")
    for s in (1, -1):
        for t, u, r in ((0.7, 0.5, 23), (-0.5, 0.52, 22)):
            a = t if s == 1 else math.pi - t
            x, y = c.at(body(a) + u * depth(a), a)
            d.zone(circle(x, y, r), "creme")
            d.zone(circle(x, y, r * 0.42), "bleu")
    d.zone(circle(cx, 361, 25), "brun")
    d.zone(stripe(cx, 432, 28, 46, 386, 478), "brun")
    ys = [478, 513, 548, 583, 618, 654]
    for k in range(5):
        d.zone(stripe(cx, 562, 22, 92, ys[k], ys[k + 1]), ("brun", "jaune")[k % 2])
    d.leads(4, frame=True)
    return d


DRAWINGS = {
    "70_mandala_fleuri": mandala_fleuri,
    "71_mandala_soleil": mandala_soleil,
    "72_rosace": rosace,
    "73_papillon_vitrail": papillon,
}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, required=True, help="drawings folder (one sub-folder per category)")
    ap.add_argument("--only", nargs="*", help="drawing names to write, such as 70_mandala_fleuri")
    args = ap.parse_args()
    for name, make in DRAWINGS.items():
        if args.only and name not in args.only:
            continue
        d = make()
        out = args.out / "details" / f"{name}.svg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(d.svg(), encoding="utf-8")
        print(f"details/{name}: {len(d.paths)} zones, {len(d.palette)} colours, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
