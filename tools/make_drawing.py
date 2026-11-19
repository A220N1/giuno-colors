"""Turn OpenMoji pictures, alone or placed on a background, into a Giuno Colors drawing."""
import argparse
import colorsys
import copy
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from array import array
from pathlib import Path
from xml.sax.saxutils import escape

SVG_NS = "http://www.w3.org/2000/svg"
SHAPES = {"path", "rect", "circle", "ellipse", "polygon"}
NAMED = {"white": "#ffffff", "black": "#000000", "red": "#ff0000", "green": "#008000", "blue": "#0000ff",
         "yellow": "#ffff00", "gray": "#808080", "grey": "#808080", "orange": "#ffa500"}
CREDIT = "OpenMoji (openmoji.org), CC BY-SA 4.0"
INHERITED = ("fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit")


def local(tag):
    return tag.split("}")[-1]


# ---- colours ----

def parse_color(value):
    """'#rrggbb' in lower case, or None for none, gradients and unknown values."""
    if not value:
        return None
    v = value.strip().lower()
    v = NAMED.get(v, v)
    if re.fullmatch(r"#[0-9a-f]{3}", v):
        return "#" + "".join(c * 2 for c in v[1:])
    if re.fullmatch(r"#[0-9a-f]{6}", v):
        return v
    return None


def lab(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = [t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116 for t in (x, y, z)]
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def delta_e(a, b):
    return math.dist(lab(a), lab(b))


# ---- geometry ----

NUM = r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|" + NUM)


def parse_transform(text):
    """2x3 matrix (a, b, c, d, e, f) of an SVG transform attribute."""
    m = (1, 0, 0, 1, 0, 0)
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", text or ""):
        v = [float(x) for x in re.findall(NUM, args)]
        if name == "matrix":
            t = tuple(v)
        elif name == "translate":
            t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == "scale":
            t = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == "rotate":
            a = math.radians(v[0])
            cx, cy = (v[1], v[2]) if len(v) > 2 else (0, 0)
            ca, sa = math.cos(a), math.sin(a)
            t = (ca, sa, -sa, ca, cx - ca * cx + sa * cy, cy - sa * cx - ca * cy)
        else:
            continue
        m = multiply(m, t)
    return m


def multiply(m, t):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = t
    return (a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f)


def apply(m, p):
    return m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]


def flatten_path(d):
    """Path data as polylines, curves sampled."""
    toks = TOKEN.findall(d)
    i, cmd = 0, None
    polys, cur = [], []
    x = y = sx = sy = 0.0
    last_c = last_q = None

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    def flag():
        nonlocal i
        t = toks[i]
        if t in ("0", "1"):
            i += 1
            return int(t)
        toks[i] = t[1:]  # flags may be packed with the next number, as in "a2 2 0 01.5 3"
        return int(t[0])

    while i < len(toks):
        if re.fullmatch(r"[A-Za-z]", toks[i]):
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                if cur:
                    polys.append(cur)
                cur = []
                x, y = sx, sy
                last_c = last_q = None
                continue
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = (x, y) if rel else (0.0, 0.0)
        if c == "M":
            if cur:
                polys.append(cur)
            x, y = ox + num(), oy + num()
            sx, sy = x, y
            cur = [(x, y)]
            cmd = "l" if rel else "L"
            last_c = last_q = None
        elif c == "L":
            x, y = ox + num(), oy + num()
            cur.append((x, y))
            last_c = last_q = None
        elif c == "H":
            x = ox + num()
            cur.append((x, y))
            last_c = last_q = None
        elif c == "V":
            y = (y if rel else 0.0) + num()
            cur.append((x, y))
            last_c = last_q = None
        elif c in "CS":
            if c == "C":
                x1, y1 = ox + num(), oy + num()
            else:
                x1, y1 = (2 * x - last_c[0], 2 * y - last_c[1]) if last_c else (x, y)
            x2, y2, ex, ey = ox + num(), oy + num(), ox + num(), oy + num()
            for k in range(1, 13):
                t = k / 12
                u = 1 - t
                cur.append((u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * ex,
                            u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * ey))
            last_c, last_q = (x2, y2), None
            x, y = ex, ey
        elif c in "QT":
            if c == "Q":
                x1, y1 = ox + num(), oy + num()
            else:
                x1, y1 = (2 * x - last_q[0], 2 * y - last_q[1]) if last_q else (x, y)
            ex, ey = ox + num(), oy + num()
            for k in range(1, 11):
                t = k / 10
                u = 1 - t
                cur.append((u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey))
            last_q, last_c = (x1, y1), None
            x, y = ex, ey
        elif c == "A":
            rx, ry, rot = abs(num()), abs(num()), num()
            large, sweep = flag(), flag()
            ex, ey = ox + num(), oy + num()
            cur.extend(arc_points(x, y, rx, ry, rot, large, sweep, ex, ey))
            x, y = ex, ey
            last_c = last_q = None
        else:
            raise ValueError(f"path command {cmd!r}")
    if cur:
        polys.append(cur)
    return polys


def arc_points(x1, y1, rx, ry, rot, large, sweep, x2, y2):
    if rx == 0 or ry == 0 or (x1, y1) == (x2, y2):
        return [(x2, y2)]
    phi = math.radians(rot)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    coef = math.sqrt(max(0.0, num / den)) * (-1 if large == sweep else 1)
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(4, int(abs(dt) / (math.pi / 16)))
    pts = []
    for k in range(1, n + 1):
        t = t1 + dt * k / n
        px, py = rx * math.cos(t), ry * math.sin(t)
        pts.append((cp * px - sp * py + cx, sp * px + cp * py + cy))
    return pts


def shape_polys(el):
    n = lambda a: float(el.get(a) or 0)  # noqa: E731
    tag = local(el.tag)
    if tag == "path":
        return flatten_path(el.get("d") or "")
    if tag == "rect":
        x, y, w, h = n("x"), n("y"), n("width"), n("height")
        return [[(x, y), (x + w, y), (x + w, y + h), (x, y + h)]]
    if tag in ("circle", "ellipse"):
        rx = n("r") if tag == "circle" else n("rx")
        ry = n("r") if tag == "circle" else n("ry")
        return [[(n("cx") + rx * math.cos(t), n("cy") + ry * math.sin(t))
                 for t in (2 * math.pi * k / 48 for k in range(48))]]
    if tag in ("polygon", "polyline", "line"):
        if tag == "line":
            return [[(n("x1"), n("y1")), (n("x2"), n("y2"))]]
        v = [float(a) for a in re.findall(NUM, el.get("points") or "")]
        return [list(zip(v[0::2], v[1::2]))]
    return []


def area(polys):
    total = 0.0
    for p in polys:
        total += sum(p[k][0] * p[k + 1 - len(p)][1] - p[k + 1 - len(p)][0] * p[k][1] for k in range(len(p))) / 2
    return abs(total)


# ---- drawing ----

def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def load_emoji(path):
    root = ET.parse(path).getroot()
    if local(root.tag) != "svg":
        raise ValueError(f"{path}: not an svg")
    return root


def emoji_parts(root, recolor):
    """Elements of one emoji with their colour, area and outline points, in its own 72-unit grid."""
    parts = []

    def walk(el, m, in_color, inherited_fill, style):
        tag = local(el.tag)
        if tag in ("title", "desc", "metadata", "defs"):
            return
        fill = el.get("fill", inherited_fill)
        if tag == "g":
            gm = multiply(m, parse_transform(el.get("transform"))) if el.get("transform") else m
            gstyle = {**style, **{k: el.get(k) for k in INHERITED if el.get(k) is not None}}
            for child in el:
                walk(child, gm, in_color or el.get("id") == "color", fill, gstyle)
            return
        own = multiply(m, parse_transform(el.get("transform"))) if el.get("transform") else m
        color = parse_color(fill)
        if color:
            color = recolor.get(color, color)
        polys = shape_polys(el)
        parts.append({
            "el": el, "in_color": in_color and tag in SHAPES, "color": color,
            "area": area(polys) * abs(own[0] * own[3] - own[1] * own[2]),
            "points": [apply(own, p) for poly in polys for p in poly],
            "polys": [[apply(own, p) for p in poly] for poly in polys], "fill": fill, "tag": tag,
            "stretch": math.sqrt(abs(own[0] * own[3] - own[1] * own[2])),
            # what the element gets from its groups, which are not copied into the drawing; a group style
            # without paint (some files set only line widths there) changes nothing and is left out
            "inherit": {k: v for k, v in style.items() if el.get(k) is None}
            if {"fill", "stroke"} & set(style) else {},
        })

    for child in root:
        walk(child, (1, 0, 0, 1, 0, 0), False, None, {})
    return parts


def placement(layer, parts):
    """Matrix putting the emoji where the layer asks: by grid position (x, y, size) or by its drawn box."""
    if "cx" not in layer:
        size = layer.get("size", 72)
        s = size / 72
        x, y = layer.get("x", 0), layer.get("y", 0)
        return ((-s, 0, 0, s, x + size, y) if layer.get("flip") else (s, 0, 0, s, x, y)), s
    pts = [p for part in parts for p in part["points"]]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    s = layer["h"] / (y1 - y0) if "h" in layer else layer["w"] / (x1 - x0)
    cy = layer["cy"] if "cy" in layer else layer["bottom"] - s * (y1 - y0) / 2
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    if layer.get("flip"):
        return (-s, 0, 0, s, layer["cx"] + s * mx, cy - s * my), s
    return (s, 0, 0, s, layer["cx"] - s * mx, cy - s * my), s


def build_palette(weights, max_colors, merge_below, protected=frozenset()):
    """Map each colour to its palette colour: close colours merge into the more used one.

    Two protected colours (the background's) never merge, and a protected colour absorbs the other.
    """
    groups = {c: [c] for c in weights}
    w = dict(weights)

    def closest():
        keys = list(groups)
        best = None
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                if a in protected and b in protected:
                    continue
                d = delta_e(a, b)
                if best is None or d < best[0]:
                    best = (d, a, b)
        return best

    while len(groups) > 1:
        found = closest()
        if found is None:
            break
        d, a, b = found
        if d >= merge_below and len(groups) <= max_colors:
            break
        if (a in protected) != (b in protected):
            keep, drop = (a, b) if a in protected else (b, a)
        else:
            keep, drop = (a, b) if w[a] >= w[b] else (b, a)
        groups[keep] += groups.pop(drop)
        w[keep] += w.pop(drop)
    mapping = {c: rep for rep, members in groups.items() for c in members}

    def order(c):
        r, g, b = (int(c[i:i + 2], 16) / 255 for i in (1, 3, 5))
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        return (1, v, 0) if s < 0.18 else (0, h, v)

    return mapping, sorted(groups, key=order)


# ---- what can be seen of each zone ----

class Raster:
    """Painter's raster of a drawing: the zone seen at each pixel, 0 where a decoration or nothing shows."""

    def __init__(self, vb, k):
        self.x0, self.y0, self.k = vb[0], vb[1], k
        self.w, self.h = math.ceil(vb[2] * k), math.ceil(vb[3] * k)
        self.lab = array("H", bytes(2 * self.w * self.h))

    def span(self, r, xa, xb, value):
        c0, c1 = max(0, math.ceil(xa - 0.5)), min(self.w, math.ceil(xb - 0.5))
        if c1 > c0:
            self.lab[r * self.w + c0:r * self.w + c1] = array("H", [value]) * (c1 - c0)

    def fill(self, polys, value, evenodd=False):
        k, rows = self.k, {}
        for poly in polys:
            pts = [((x - self.x0) * k, (y - self.y0) * k) for x, y in poly]
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                if ay == by:
                    continue
                d = 1 if by > ay else -1
                if ay > by:
                    ax, ay, bx, by = bx, by, ax, ay
                slope = (bx - ax) / (by - ay)
                for r in range(max(0, math.ceil(ay - 0.5)), min(self.h, math.ceil(by - 0.5))):
                    rows.setdefault(r, []).append((ax + (r + 0.5 - ay) * slope, d))
        for r, xs in rows.items():
            xs.sort()
            wind = 0
            for (x, d), (nx, _) in zip(xs, xs[1:]):
                wind += d
                if (wind % 2 if evenodd else wind):
                    self.span(r, x, nx, value)

    def stroke(self, polys, width, value, closed):
        """Round-capped strokes: each segment is a capsule, so each row meets it in one interval."""
        k, rad = self.k, width * self.k / 2
        for poly in polys:
            pts = [((x - self.x0) * k, (y - self.y0) * k) for x, y in poly]
            segs = list(zip(pts, pts[1:] + pts[:1])) if closed else list(zip(pts, pts[1:])) or [(pts[0], pts[0])]
            for (ax, ay), (bx, by) in segs:
                n = math.hypot(bx - ax, by - ay)
                nx, ny = ((ay - by) / n * rad, (bx - ax) / n * rad) if n > 1e-9 else (0, 0)
                quad = [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]
                lo = max(0, math.ceil(min(ay, by) - rad - 0.5))
                hi = min(self.h, math.ceil(max(ay, by) + rad - 0.5))
                for r in range(lo, hi):
                    yc = r + 0.5
                    xs = []
                    for cx, cy in ((ax, ay), (bx, by)):
                        dy = yc - cy
                        if abs(dy) <= rad:
                            s = math.sqrt(rad * rad - dy * dy)
                            xs += [cx - s, cx + s]
                    for (px, py), (qx, qy) in zip(quad, quad[1:] + quad[:1]):
                        if (py <= yc < qy) or (qy <= yc < py):
                            xs.append(px + (yc - py) * (qx - px) / (qy - py))
                    if xs:
                        self.span(r, min(xs), max(xs), value)

    def radii(self, n):
        """Inscribed radius of what shows of zones 1 to n, in drawing units (chamfer 3-4 distance)."""
        w, h, lab = self.w, self.h, self.lab
        dist = array("f", [0.0]) * (w * h)
        for p in range(w * h):
            if lab[p]:
                dist[p] = 1e9
        for y in range(h):
            row = y * w
            for x in range(w):
                p = row + x
                v = lab[p]
                if not v:
                    continue
                best = dist[p]
                for q, step, ok in ((p - 1, 3, x > 0), (p - w - 1, 4, x > 0 and y > 0), (p - w, 3, y > 0),
                                    (p - w + 1, 4, y > 0 and x < w - 1)):
                    c = (dist[q] if lab[q] == v else 0) + step if ok else step
                    if c < best:
                        best = c
                dist[p] = best
        out = [0.0] * (n + 1)
        for y in range(h - 1, -1, -1):
            row = y * w
            for x in range(w - 1, -1, -1):
                p = row + x
                v = lab[p]
                if not v:
                    continue
                best = dist[p]
                for q, step, ok in ((p + 1, 3, x < w - 1), (p + w + 1, 4, x < w - 1 and y < h - 1),
                                    (p + w, 3, y < h - 1), (p + w - 1, 4, y < h - 1 and x > 0)):
                    c = (dist[q] if lab[q] == v else 0) + step if ok else step
                    if c < best:
                        best = c
                dist[p] = best
                if best > out[v]:
                    out[v] = best
        return [r / 3 / self.k for r in out]


def visible_radii(vb, layers, line_width, k):
    """Inscribed radius of what shows of each candidate zone, drawn in order as the app does.

    Keys are (layer index, part index), the part being None for a background zone."""
    ras = Raster(vb, k)
    ids = []
    for li, layer in enumerate(layers):
        if "zone" in layer:
            ids.append((li, None))
            ras.fill(flatten_path(layer["zone"]), len(ids))
        elif "deco" in layer:
            deco = layer["deco"]
            polys = flatten_path(deco["d"])
            if deco.get("fill", "#000") != "none":
                ras.fill(polys, 0)
            if deco.get("stroke") and deco.get("stroke") != "none":
                ras.stroke(polys, float(deco.get("stroke-width", 1)), 0, closed=False)
        else:
            m, s = layer["matrix"], layer["scale"]
            for pi, p in enumerate(layer["parts"]):
                polys = [[apply(m, q) for q in poly] for poly in p["polys"]]
                if not polys or not polys[0]:
                    continue
                def attr(k, p=p):
                    return p["el"].get(k, p["inherit"].get(k))

                evenodd = attr("fill-rule") == "evenodd"
                if p["zone"]:
                    ids.append((li, pi))
                    ras.fill(polys, len(ids), evenodd)
                    continue
                if p["fill"] != "none" and p["tag"] not in ("line", "polyline"):
                    ras.fill(polys, 0, evenodd)
                stroke = attr("stroke")
                if stroke and stroke != "none":
                    if line_width and lab(parse_color(stroke) or "#000000")[0] < 30 and attr("stroke-width"):
                        width = line_width
                    else:
                        width = float(attr("stroke-width") or 1) * s * p["stretch"]
                    ras.stroke(polys, width, 0, closed=p["tag"] in ("rect", "circle", "ellipse", "polygon"))
    radii = ras.radii(len(ids))
    return {key: radii[i + 1] for i, key in enumerate(ids)}



def make(spec, sources):
    recolor = {parse_color(k): parse_color(v) for k, v in spec.get("recolor", {}).items()}
    min_area = spec.get("minArea", 4)
    line_width = spec.get("lineWidth")  # outline thickness in drawing units, the same for every emoji
    layers = []
    for layer in spec["layers"]:
        if "emoji" in layer:
            root = load_emoji(sources / f"{layer['emoji']}.svg")
            parts = emoji_parts(root, {**recolor, **{parse_color(k): parse_color(v)
                                                     for k, v in layer.get("recolor", {}).items()}})
            m, s = placement(layer, parts)
            for p in parts:
                l_star = lab(p["color"])[0] if p["color"] else 0
                p["zone"] = p["in_color"] and p["color"] is not None and 10 < l_star < 96 \
                    and p["area"] * s * s >= layer.get("minArea", min_area)
                p["points"] = [apply(m, q) for q in p["points"]]
            layers.append({"emoji": layer["emoji"], "matrix": m, "scale": s, "parts": parts})
        elif "color" in layer:
            layers.append({"zone": layer["d"], "color": parse_color(layer["color"])})
        else:
            layers.append({"deco": layer})

    if "viewBox" in spec:
        vb = spec["viewBox"]
    else:
        pts = [p for layer in layers for part in layer.get("parts", []) for p in part["points"]]
        x0, y0 = min(p[0] for p in pts) - 3, min(p[1] for p in pts) - 3
        x1, y1 = max(p[0] for p in pts) + 3, max(p[1] for p in pts) + 3
        vb = [x0, y0, x1 - x0, y1 - y0]

    if spec.get("minRadius"):
        # a zone of which too little shows becomes a decoration, already in its colour
        radii = visible_radii(vb, layers, line_width, spec.get("rasterScale", 1.5))
        for li, layer in enumerate(layers):
            if "zone" in layer and radii[(li, None)] < spec["minRadius"]:
                layers[li] = {"deco": {"fill": layer["color"], "d": layer["zone"]}}
            for pi, p in enumerate(layer.get("parts", [])):
                if p["zone"] and radii[(li, pi)] < spec["minRadius"]:
                    p["zone"] = False

    weights = {}
    for layer in layers:
        if "zone" in layer:
            weights[layer["color"]] = weights.get(layer["color"], 0) + 1
        for p in layer.get("parts", []):
            if p["zone"]:
                weights[p["color"]] = weights.get(p["color"], 0) + 1
    protected = frozenset(layer["color"] for layer in layers if "zone" in layer)
    mapping, palette = build_palette(weights, spec.get("maxColors", 10), spec.get("mergeBelow", 8), protected)
    index = {c: k + 1 for k, c in enumerate(palette)}

    out = []
    zones = 0
    for layer in layers:
        if "zone" in layer:
            c = mapping[layer["color"]]
            out.append(f'  <path data-c="{index[c]}" fill="{c}" d="{layer["zone"]}"/>')
            zones += 1
        elif "deco" in layer:
            deco = layer["deco"]
            attrs = " ".join(f'{k}="{v}"' for k, v in deco.items())
            out.append(f"  <path {attrs}/>")
        else:
            m = layer["matrix"]
            out.append(f'  <g transform="matrix({" ".join(fmt(v) for v in m)})">')
            for p in layer["parts"]:
                el = copy.deepcopy(p["el"])
                for k, v in p["inherit"].items():
                    el.set(k, v)
                for e in el.iter():
                    e.tag = local(e.tag)
                    e.attrib.pop("id", None)
                if p["zone"]:
                    c = mapping[p["color"]]
                    el.set("data-c", str(index[c]))
                    el.set("fill", c)
                    zones += 1
                elif p["color"] and p["color"] != parse_color(p["el"].get("fill")):
                    el.set("fill", p["color"])  # recoloured decoration
                stroke = parse_color(el.get("stroke"))
                if line_width and not p["zone"] and stroke and lab(stroke)[0] < 30 and el.get("stroke-width"):
                    el.set("stroke-width", fmt(line_width / layer["scale"]))
                out.append("    " + ET.tostring(el, encoding="unicode").strip())
            out.append("  </g>")
    level = spec.get("level") or (1 if zones <= 20 else 2 if zones <= 50 else 3)
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(fmt(v) for v in vb)}"\n'
            f'     data-title="{escape(spec["title"], {chr(34): "&quot;"})}" data-level="{level}"\n'
            f'     data-palette="{" ".join(palette)}"\n'
            f'     data-credit="{CREDIT}">\n')
    merges = sorted((c, rep) for c, rep in mapping.items() if c != rep)
    return head + "\n".join(out) + "\n</svg>\n", zones, len(palette), level, merges


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("spec", type=Path, help="drawing description (JSON)")
    ap.add_argument("--sources", type=Path, required=True, help="folder of OpenMoji colour SVGs named <hexcode>.svg")
    ap.add_argument("--out", type=Path, required=True, help="SVG to write")
    args = ap.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    svg, zones, colors, level, merges = make(spec, args.sources)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(svg, encoding="utf-8")
    print(f"{args.out.name}: {zones} zones, {colors} colours, level {level}")


if __name__ == "__main__":
    sys.exit(main())
