"""Turn public-domain paintings and prints into Giuno Colors drawings: flat zones that follow the picture's shapes."""
import argparse
import heapq
import math
import random
import re
import sys
from array import array
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageMath, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python -I leaves the script's folder out
from make_drawing import Raster, flatten_path  # noqa: E402

PAGE_W = 800
RUN = re.compile(rb"(.)\1*", re.S)
RUN4 = re.compile(rb"(....)\1*", re.S)
LINE = 255  # shade of the pixels on a printed line
PLUS1 = [min(255, v + 1) for v in range(256)]

# crop: left, top, right, bottom as fractions of the source image; the page is 800 wide and as tall as the crop,
# or page_h tall, the crop then taking the width this needs around its centre.
# kuwahara: radius of the edge-preserving smoothing; fh: scale of the graph segmentation (larger, bigger segments),
# fh_min its smallest segment in half-size pixels; without fh each pixel takes its nearest shade instead;
# shades: colour clusters, which draw the borders; colors: palette entries the shades are grouped into (min_delta
# apart); seeds: colours the clustering starts from; lines: contrast from which a thin dark stroke is a printed line,
# kept as a border; zones: target count; min_radius: smallest inscribed radius of a zone;
# arm: parts of a zone narrower than twice this are given to the neighbours; lift and chroma brighten the palette;
# paint: shapes laid over the picture before anything else (page units), to flatten text and seals.
NGA = "Courtesy National Gallery of Art, Washington, open access"


def rect(x0, y0, x1, y1, color="auto"):
    return {"points": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], "color": color}


PAINTINGS = {
    "81_chat": {
        "source": "chat/image.jpg",
        "title": "Le Chat à la fenêtre (Hiroshige)",
        "level": 2,
        "credit": "Utagawa Hiroshige, Asakusa Rice Fields and Torinomachi Festival, 1857. "
                  "Art Institute of Chicago, CC0",
        "crop": [0.16, 0.42, 0.56, 0.72],
        "kuwahara": 4, "fh": 400, "fh_min": 30, "shades": 24, "colors": 12, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 100, "min_radius": 8, "arm": 4,
        "lift": 0.1, "chroma": 1.1,
    },
    "83_flamant_rose": {
        "source": "flamant_rose/image.jpg",
        "title": "Le Flamant rose (Audubon)",
        "level": 3,
        "credit": f"Robert Havell after John James Audubon, American Flamingo, 1838. {NGA}",
        "crop": [0.5, 0.10, 0.5, 0.90], "page_h": 1000,
        # the pencil sketches of the bill and foot above the bird
        "paint": [rect(0, 0, 170, 150), rect(170, 0, 520, 80), rect(520, 0, 800, 215), rect(400, 60, 540, 115)],
        "kuwahara": 4, "fh": 110, "fh_min": 10, "shades": 24, "colors": 12, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 220, "min_radius": 4, "arm": 3,
        "lift": 0.05, "chroma": 1.1,
    },
    "84_fuji_rouge": {
        "source": "fuji_rouge/image.jpg",
        "title": "Le Fuji rouge (Hokusai)",
        "level": 3,
        "credit": "Katsushika Hokusai, South Wind, Clear Sky (Red Fuji), ca. 1830-32. "
                  "The Metropolitan Museum of Art, CC0",
        "crop": [0.6, 0.035, 0.6, 0.965], "page_h": 1000,
        "kuwahara": 4, "fh": 300, "fh_min": 15, "shades": 20, "colors": 11, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 220, "min_radius": 4, "arm": 3,
        "lift": 0.15, "chroma": 1.15,
    },
    "85_vague": {
        "source": "vague/image.jpg",
        "title": "La Vague (Hokusai)",
        "level": 3,
        "credit": "Katsushika Hokusai, Under the Wave off Kanagawa (The Great Wave), 1830-33. "
                  "Art Institute of Chicago, CC0",
        "crop": [0.012, 0.02, 0.988, 0.98],
        "kuwahara": 4, "fh": 300, "fh_min": 15, "shades": 20, "colors": 10, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 250, "min_radius": 4, "arm": 3,
        "lift": 0.1, "chroma": 1.2,
    },
    "87_aigle": {
        "source": "aigle/image.jpg",
        "title": "L'Aigle dans la neige (Hiroshige)",
        "level": 3,
        "credit": "Utagawa Hiroshige, Fukagawa Susaki and Jumantsubo, 1857. Art Institute of Chicago, CC0",
        "crop": [0.018, 0.012, 0.982, 0.82],
        "kuwahara": 4, "fh": 300, "fh_min": 15, "shades": 20, "colors": 12, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 250, "min_radius": 4, "arm": 3,
        "lift": 0.08, "chroma": 1.15,
    },
    "88_pelican": {
        "source": "pelican/image.jpg",
        "title": "Le Pélican (Audubon)",
        "level": 2,
        "credit": f"Robert Havell after John James Audubon, Brown Pelican, 1835. {NGA}",
        "crop": [0.04, 0.05, 0.96, 0.86],
        "kuwahara": 4, "fh": 300, "fh_min": 25, "shades": 20, "colors": 12, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 100, "min_radius": 8, "arm": 4,
        "lift": 0.05, "chroma": 1.12,
    },
    "89_cardinaux": {
        "source": "cardinal/image.jpg",
        "title": "Les Cardinaux (Audubon)",
        "level": 2,
        "credit": f"Robert Havell after John James Audubon, Cardinal Grosbeak, 1833. {NGA}",
        "crop": [0.06, 0.15, 0.96, 0.84],
        # no line detection: it would take the male's black mask for a printed stroke
        "kuwahara": 4, "fh": 150, "fh_min": 15, "shades": 22, "colors": 12, "min_delta": 8, "mode": 5,
        "zones": 100, "min_radius": 9, "arm": 4,
        "lift": 0.05, "chroma": 1.12,
    },
    "90_passerin": {
        "source": "passerin/image.jpg",
        "title": "Le Passerin (Audubon)",
        "level": 2,
        "credit": f"Robert Havell after John James Audubon, Painted Bunting, 1829. {NGA}",
        "crop": [0.40, 0.55, 0.85, 0.76],
        "kuwahara": 4, "fh": 250, "fh_min": 25, "shades": 20, "colors": 12, "min_delta": 8, "mode": 5, "lines": 40,
        "zones": 100, "min_radius": 8, "arm": 4,
        "lift": 0.05, "chroma": 1.12,
    },
    "91_oiseau_bleu": {
        "source": "merle_bleu/image.jpg",
        "title": "L'Oiseau bleu (Audubon)",
        "level": 2,
        "credit": f"Robert Havell after John James Audubon, Blue-Bird, 1831. {NGA}",
        "crop": [0.18, 0.06, 0.76, 0.40],
        "kuwahara": 4, "fh": 120, "fh_min": 15, "shades": 24, "colors": 12, "min_delta": 6, "mode": 5, "lines": 40,
        "zones": 100, "min_radius": 8, "arm": 4,
        "lift": 0.05, "chroma": 1.12,
    },
}


# ---- colours ----

def to_lab(rgb):
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (v / 255 for v in rgb)]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = [t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116 for t in (x, y, z)]
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def to_rgb(lab):
    fy = (lab[0] + 16) / 116
    fx, fz = fy + lab[1] / 500, fy - lab[2] / 200
    x, y, z = (t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787 for t in (fx, fy, fz))
    x, z = x * 0.95047, z * 1.08883
    lin = (3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z,
           0.0557 * x - 0.2040 * y + 1.0570 * z)
    out = []
    for c in lin:
        c = max(0.0, min(1.0, c))
        c = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        out.append(round(c * 255))
    return tuple(out)


def hexc(rgb):
    return "#%02x%02x%02x" % rgb


def brighten(lab, lift, chroma):
    """Lighter and a little more vivid: the children colour on a white screen, the varnish has yellowed."""
    return lab[0] + lift * (100 - lab[0]), lab[1] * chroma, lab[2] * chroma


def kmeans(samples, k, seed_colors, iters=20, weights=None):
    rnd = random.Random(1)
    weights = weights or [1] * len(samples)
    centres = [to_lab(tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))) for c in seed_colors]
    if not centres:
        centres.append(samples[rnd.randrange(len(samples))])
    d2 = [min(math.dist(s, c) ** 2 for c in centres) * wt for s, wt in zip(samples, weights)]
    while len(centres) < k and len(centres) < len(samples):
        r, acc = rnd.random() * sum(d2), 0.0
        for i, v in enumerate(d2):
            acc += v
            if acc >= r:
                break
        centres.append(samples[i])
        d2 = [min(a, math.dist(s, samples[i]) ** 2 * wt) for a, s, wt in zip(d2, samples, weights)]
    for _ in range(iters):
        sums = [[0.0, 0.0, 0.0, 0] for _ in centres]
        for s, wt in zip(samples, weights):
            j = min(range(len(centres)), key=lambda j: (s[0] - centres[j][0]) ** 2 + (s[1] - centres[j][1]) ** 2
                    + (s[2] - centres[j][2]) ** 2)
            acc = sums[j]
            acc[0] += s[0] * wt
            acc[1] += s[1] * wt
            acc[2] += s[2] * wt
            acc[3] += wt
        centres = [(a[0] / a[3], a[1] / a[3], a[2] / a[3]) if a[3] else c for a, c in zip(sums, centres)]
    return centres


# ---- picture to colour indexes ----

def load(spec, src, scale):
    im = Image.open(src).convert("RGB")
    x0, y0, x1, y1 = spec["crop"]
    if spec.get("page_h"):
        # keep the height and centre of the crop, take the width the page's proportions need
        half = (y1 - y0) * im.height * PAGE_W / spec["page_h"] / im.width / 2
        x0, x1 = (x0 + x1) / 2 - half, (x0 + x1) / 2 + half
    box = (round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height))
    im = im.crop(box)
    page_h = spec.get("page_h") or round(PAGE_W * im.height / im.width / 10) * 10
    im = im.resize((PAGE_W * scale, page_h * scale), Image.LANCZOS)
    if spec.get("paint"):
        draw = ImageDraw.Draw(im)
        for shape in spec["paint"]:
            pts = [(x * scale, y * scale) for x, y in shape["points"]]
            fill = shape["color"]
            if fill == "auto":  # the paper around faint pencil work: the median of the box it covers
                box = (min(x for x, _ in pts), min(y for _, y in pts), max(x for x, _ in pts), max(y for _, y in pts))
                fill = tuple(round(v) for v in ImageStat.Stat(im.crop(box)).median)
            draw.polygon(pts, fill=fill)
    return im, page_h


def kuwahara(im, radius):
    """Edge-preserving smoothing: each pixel takes the mean of the calmest of its four corner windows."""
    h = max(1, radius // 2)
    mean = im.filter(ImageFilter.BoxBlur(h))
    rough = None
    for band in im.split():
        e = ImageChops.difference(band, band.filter(ImageFilter.BoxBlur(1)))
        rough = e if rough is None else ImageChops.lighter(rough, e)
    energy = rough.filter(ImageFilter.BoxBlur(h))
    corners = ((h, h), (-h, h), (h, -h), (-h, -h))
    e = [shifted(energy, dx, dy, 255) for dx, dy in corners]
    m = [shifted(mean, dx, dy, (0, 0, 0)) for dx, dy in corners]
    low = ImageMath.eval("min(min(a, b), min(c, d))", a=e[0], b=e[1], c=e[2], d=e[3])
    s0 = ImageMath.eval("a == m", a=e[0], m=low)
    s1 = ImageMath.eval("(a == m) * (1 - s0)", a=e[1], m=low, s0=s0)
    s2 = ImageMath.eval("(a == m) * (1 - s0) * (1 - s1)", a=e[2], m=low, s0=s0, s1=s1)
    s3 = ImageMath.eval("1 - s0 - s1 - s2", s0=s0, s1=s1, s2=s2)
    bands = []
    for c in range(3):
        a, b, cc, d = (x.getchannel(c) for x in m)
        bands.append(ImageMath.eval("convert(a * s0 + b * s1 + c * s2 + d * s3, 'L')",
                                    a=a, b=b, c=cc, d=d, s0=s0, s1=s1, s2=s2, s3=s3))
    return Image.merge("RGB", bands)


def dark_lines(im, size, threshold):
    """1 on thin strokes darker than their surroundings (outlines of prints), else 0."""
    lum = im.convert("L")
    closed = lum.filter(ImageFilter.MaxFilter(size)).filter(ImageFilter.MinFilter(size))
    return ImageChops.subtract(closed, lum).point(lambda v: 1 if v >= threshold else 0).tobytes()


def felzenszwalb(im, k, min_size):
    """Graph-based segmentation (Felzenszwalb and Huttenlocher, 2004): segment id of each pixel.

    Two neighbouring segments join when the colour step between them is no larger than the steps inside them,
    so painted texture stays inside a segment while the outline of a shape parts two."""
    w, h = im.size
    px = list(im.getdata())
    buckets = [[] for _ in range(3 * 255 + 1)]
    for y in range(h):
        row = y * w
        for x in range(w):
            p = row + x
            r, g, b = px[p]
            for q, ok in ((p + 1, x < w - 1), (p + w, y < h - 1), (p + w + 1, x < w - 1 and y < h - 1),
                          (p + w - 1, x > 0 and y < h - 1)):
                if ok:
                    r2, g2, b2 = px[q]
                    buckets[abs(r - r2) + abs(g - g2) + abs(b - b2)].append((p, q))
    parent = list(range(w * h))
    size = [1] * (w * h)
    inner = [0.0] * (w * h)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for wt, pairs in enumerate(buckets):
        for p, q in pairs:
            a, b = find(p), find(q)
            if a != b and wt <= min(inner[a] + k / size[a], inner[b] + k / size[b]):
                if size[a] < size[b]:
                    a, b = b, a
                parent[b] = a
                size[a] += size[b]
                inner[a] = wt
    for pairs in buckets:
        for p, q in pairs:
            a, b = find(p), find(q)
            if a != b and (size[a] < min_size or size[b] < min_size):
                if size[a] < size[b]:
                    a, b = b, a
                parent[b] = a
                size[a] += size[b]
    return [find(p) for p in range(w * h)]


def segment_shades(spec, smooth):
    """Shade index of each pixel from the mean colour of its segment, and the shades (Lab)."""
    half = smooth.resize((smooth.width // 2, smooth.height // 2), Image.BOX)
    seg = felzenszwalb(half, spec["fh"], spec.get("fh_min", 20))
    sums = {}
    for s, c in zip(seg, half.getdata()):
        acc = sums.setdefault(s, [0, 0, 0, 0])
        acc[0] += c[0]
        acc[1] += c[1]
        acc[2] += c[2]
        acc[3] += 1
    ids = sorted(sums)
    means = [to_lab(tuple(round(v / sums[s][3]) for v in sums[s][:3])) for s in ids]
    weights = [sums[s][3] for s in ids]
    centres = kmeans(means, spec.get("shades", spec["colors"]), spec.get("seeds", []), weights=weights)
    nearest = {s: min(range(len(centres)), key=lambda j: math.dist(m, centres[j])) for s, m in zip(ids, means)}
    idx = Image.frombytes("L", half.size, bytes(nearest[s] for s in seg))
    return idx.resize(smooth.size, Image.NEAREST), centres


def group_shades(centres, weights, spec):
    """Palette entry of each shade: the closest shades share one until the palette is small and distinct."""
    lift, chroma = spec.get("lift", 0), spec.get("chroma", 1)
    groups = [[i] for i in range(len(centres))]
    means = list(centres)
    mass = list(weights)

    def out(i):
        return brighten(means[i], lift, chroma)

    while True:
        pairs = [(math.dist(out(i), out(j)), i, j) for i in range(len(groups)) for j in range(i + 1, len(groups))]
        if not pairs:
            break
        d, i, j = min(pairs)
        if len(groups) <= spec["colors"] and d >= spec.get("min_delta", 12):
            break
        total = mass[i] + mass[j]
        means[i] = tuple((a * mass[i] + b * mass[j]) / total for a, b in zip(means[i], means[j]))
        mass[i] = total
        groups[i] += groups[j]
        del groups[j], means[j], mass[j]
    group = [0] * len(centres)
    for g, members in enumerate(groups):
        for s in members:
            group[s] = g
    return group, [out(i) for i in range(len(groups))]


def quantize(spec, im):
    """Shade index of each pixel, the shades (Lab), their palette entry and the palette (Lab, brightened)."""
    smooth = im
    for _ in range(spec.get("kuwahara_passes", 1) if spec.get("kuwahara") else 0):
        smooth = kuwahara(smooth, spec["kuwahara"])
    if spec.get("median"):
        smooth = smooth.filter(ImageFilter.MedianFilter(spec["median"]))
    if spec.get("fh"):
        idx, centres = segment_shades(spec, smooth)
    else:
        step = max(1, round(math.sqrt(smooth.width * smooth.height / 20000)))
        small = smooth.resize((smooth.width // step, smooth.height // step), Image.BOX)
        samples = [to_lab(p) for p in small.getdata()]
        centres = kmeans(samples, spec.get("shades", spec["colors"]), spec.get("seeds", []))
        rgb = [to_rgb(c) for c in centres]
        pal = Image.new("P", (1, 1))
        pal.putpalette([v for c in rgb for v in c] + list(rgb[0]) * (256 - len(rgb)))
        q = smooth.quantize(palette=pal, dither=Image.Dither.NONE)
        idx = Image.frombytes("L", q.size,
                              q.tobytes().translate(bytes(i if i < len(rgb) else 0 for i in range(256))))
    if spec.get("mode"):
        idx = idx.filter(ImageFilter.ModeFilter(spec["mode"]))
    counts = idx.histogram()[:len(centres)]
    group, palette = group_shades(centres, counts, spec)
    return bytearray(idx.tobytes()), centres, group, palette, smooth


# ---- regions ----

def components(values, w, h, size=1):
    """4-connected regions of equal value: label of each pixel, runs per row, original value of each region.

    values holds w * h items of size bytes (1 for shade indexes, 4 for labels)."""
    run = RUN if size == 1 else RUN4
    parent = []

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    rows, prev = [], []
    stride = w * size
    for y in range(h):
        row = values[y * stride:(y + 1) * stride]
        cur = []
        for m in run.finditer(row):
            a, b = m.span()
            cur.append((a // size, b // size, row[a:a + size], len(parent)))
            parent.append(len(parent))
        i = j = 0
        while i < len(cur) and j < len(prev):
            a0, a1, ac, ar = cur[i]
            b0, b1, bc, br = prev[j]
            if ac == bc and a0 < b1 and b0 < a1:
                ra, rb = find(ar), find(br)
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
            if a1 <= b1:
                i += 1
            else:
                j += 1
        rows.append(cur)
        prev = cur
    compact, value = {}, []
    lab = array("i", bytes(4 * w * h))
    runs = []
    for y, cur in enumerate(rows):
        base = y * w
        out = []
        for a, b, v, r in cur:
            root = find(r)
            if root not in compact:
                compact[root] = len(value)
                value.append(int.from_bytes(v, sys.byteorder, signed=True) if size == 4 else v[0])
            rid = compact[root]
            lab[base + a:base + b] = array("i", [rid]) * (b - a)
            out.append((a, b, rid))
        runs.append(out)
    return lab, runs, value


def shifted(im, dx, dy, fill):
    w, h = im.size
    out = Image.new(im.mode, im.size, fill)
    out.paste(im.crop((max(0, -dx), max(0, -dy), w - max(0, dx), h - max(0, dy))), (max(0, dx), max(0, dy)))
    return out


def cross(im, darker):
    op = ImageChops.darker if darker else ImageChops.lighter
    fill = 255 if darker else 0
    out = im
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out = op(out, shifted(im, dx, dy, fill))
    return out


def distance(lab, w, h, cap):
    """Octagonal distance in pixels from each pixel to the nearest pixel of another region (1 on the edges)."""
    im = Image.frombytes("I", (w, h), lab.tobytes())
    sides = {f"s{k}": shifted(im, dx, dy, -1) for k, (dx, dy) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1)))}
    edge = ImageMath.eval("(a != s0) | (a != s1) | (a != s2) | (a != s3)", a=im, **sides)
    d = edge.convert("L").point(lambda v: 1 if v else 255)
    for i in range(cap):
        m = d.filter(ImageFilter.MinFilter(3)) if i % 2 else cross(d, True)
        nd = ImageChops.darker(d, m.point(PLUS1))
        if ImageChops.difference(nd, d).getbbox() is None:
            break
        d = nd
    return d


def opening(d, r):
    """Pixels within r - 1 steps of a pixel at distance r or more: the parts of each region at least 2r wide."""
    core = d.point(lambda v: 255 if v >= r else 0)
    for i in range(r - 1):
        core = core.filter(ImageFilter.MaxFilter(3)) if i % 2 else cross(core, False)
    return core.tobytes()


def radii(dist, runs, n, w):
    out = [0] * n
    for y, row in enumerate(runs):
        base = y * w
        for a, b, rid in row:
            m = max(dist[base + a:base + b])
            if m > out[rid]:
                out[rid] = m
    return out


def dissolve(lab, drop, w, h):
    """Give each dropped pixel the region of the nearest kept pixel, growing the kept regions layer by layer."""
    n = w * h
    todo = drop
    pending = [p for m in re.finditer(rb"\x01+", bytes(todo)) for p in range(*m.span())]

    def around(p):
        x = p % w
        if x > 0:
            yield p - 1
        if x < w - 1:
            yield p + 1
        if p >= w:
            yield p - w
        if p + w < n:
            yield p + w

    layer = []
    for p in pending:
        for q in around(p):
            if not todo[q]:
                layer.append((p, lab[q]))
                break
    while layer:
        for p, r in layer:
            lab[p] = r
            todo[p] = 0
        nxt = []
        for p, _ in layer:
            for q in around(p):
                if todo[q] == 1:
                    todo[q] = 2  # taken by this layer
                    nxt.append((q, lab[p]))
        layer = nxt


def adjacency(runs, n, w, line):
    """Area of each region, border length shared with each neighbour, and how much of it runs along a line."""
    area = [0] * n
    shared = [dict() for _ in range(n)]
    lined = [dict() for _ in range(n)]

    def add(a, b, k, on):
        shared[a][b] = shared[a].get(b, 0) + k
        shared[b][a] = shared[b].get(a, 0) + k
        if on:
            lined[a][b] = lined[a].get(b, 0) + on
            lined[b][a] = lined[b].get(a, 0) + on

    prev, pbase = [], 0
    for y, row in enumerate(runs):
        base = y * w
        for (a0, a1, ra), nxt in zip(row, row[1:] + [None]):
            area[ra] += a1 - a0
            if nxt is not None:
                add(ra, nxt[2], 1, line[base + a1 - 1] | line[base + a1] if line else 0)
        i = j = 0
        while i < len(row) and j < len(prev):
            a0, a1, ra = row[i]
            b0, b1, rb = prev[j]
            if ra != rb and a0 < b1 and b0 < a1:
                lo, hi = max(a0, b0), min(a1, b1)
                on = max(line[base + lo:base + hi].count(1), line[pbase + lo:pbase + hi].count(1)) if line else 0
                add(ra, rb, hi - lo, on)
            if a1 <= b1:
                i += 1
            else:
                j += 1
        prev, pbase = row, base
    return area, shared, lined


def merge_labels(lab, runs, owner, w, h):
    """Relabel after merges (owner: region to the region it joins), then number the regions again."""
    def top(a):
        while owner[a] != a:
            owner[a] = owner[owner[a]]
            a = owner[a]
        return a

    for y, row in enumerate(runs):
        base = y * w
        for a, b, rid in row:
            t = top(rid)
            if t != rid:
                lab[base + a:base + b] = array("i", [t]) * (b - a)
    return components(lab.tobytes(), w, h, 4)


def fuse(lab, runs, shade, centres, w, h, line, below):
    """Join neighbours of the same shade, or of shades closer than below, unless a printed line parts them."""
    n = len(shade)
    _, shared, lined = adjacency(runs, n, w, line)
    owner = list(range(n))

    def top(a):
        while owner[a] != a:
            owner[a] = owner[owner[a]]
            a = owner[a]
        return a

    joined = False
    for a in range(n):
        for b, k in shared[a].items():
            if b <= a or lined[a].get(b, 0) > 0.4 * k or LINE in (shade[a], shade[b]):
                continue
            if shade[a] == shade[b] or (below and math.dist(centres[shade[a]], centres[shade[b]]) < below):
                ta, tb = top(a), top(b)
                if ta != tb:
                    owner[max(ta, tb)] = min(ta, tb)
                    joined = True
    if not joined:
        return lab, runs, shade
    lab, runs, old = merge_labels(lab, runs, owner, w, h)
    return lab, runs, [shade[top(o)] for o in old]


def clean(lab, runs, shade, centres, w, h, spec, line, min_r, arm):
    """Give away thin parts, lines and too narrow regions until every region is wide enough to tap."""
    for _ in range(12):
        lab, runs, shade = fuse(lab, runs, shade, centres, w, h, line, spec.get("fuse", 0))
        dist = distance(lab, w, h, max(min_r, arm) + 2)
        core = opening(dist, arm) if arm > 1 else None
        drop = bytearray(w * h) if core is None else bytearray(core.translate(bytes([1] + [0] * 255)))
        rad = radii(dist.tobytes(), runs, len(shade), w)
        for y, row in enumerate(runs):
            base = y * w
            for a, b, rid in row:
                if rad[rid] < min_r or shade[rid] == LINE:
                    drop[base + a:base + b] = b"\x01" * (b - a)
        if not any(drop):
            return lab, runs, shade
        dissolve(lab, drop, w, h)
        lab, runs, old = components(lab.tobytes(), w, h, 4)
        shade = [shade[o] for o in old]
    return lab, runs, shade


def reduce(lab, runs, shade, centres, w, h, line, target):
    """Merge regions into their most similar neighbour, small and faint ones first, until target remain."""
    n = len(shade)
    area, shared, lined = adjacency(runs, n, w, line)
    owner = list(range(n))
    col = list(shade)

    def top(a):
        while owner[a] != a:
            owner[a] = owner[owner[a]]
            a = owner[a]
        return a

    def cost(r, q, k, on):
        # a border drawn by the artist is kept as long as possible
        return math.dist(centres[col[q]], centres[col[r]]) + (40 if on > 0.4 * k else 0)

    def best_of(r):
        nbs, ons = {}, {}
        for q, k in shared[r].items():
            t = top(q)
            if t != r:
                nbs[t] = nbs.get(t, 0) + k
                ons[t] = ons.get(t, 0) + lined[r].get(q, 0)
        if not nbs:
            return None, None, 0.0
        most = max(nbs.values())
        best = min((q for q, k in nbs.items() if k >= 0.3 * most), key=lambda q: (cost(r, q, nbs[q], ons[q]), q))
        # a region that hardly stands out from its neighbour counts as smaller than it is
        weight = min(1.0, (cost(r, best, nbs[best], ons[best]) + 5) / 30)
        return best, nbs, area[r] * weight

    heap = [(best_of(r)[2], r) for r in range(n)]
    heapq.heapify(heap)
    alive = n
    while alive > target and heap:
        prio, r = heapq.heappop(heap)
        if top(r) != r:
            continue
        best, nbs, now = best_of(r)
        if best is None:
            continue
        if now > prio + 1e-9:
            heapq.heappush(heap, (now, r))
            continue
        owner[r] = best
        area[best] += area[r]
        for s, k in shared[r].items():
            shared[best][s] = shared[best].get(s, 0) + k
        for s, k in lined[r].items():
            lined[best][s] = lined[best].get(s, 0) + k
        alive -= 1
        heapq.heappush(heap, (best_of(best)[2], best))
    lab, runs, old = merge_labels(lab, runs, owner, w, h)
    return lab, runs, [col[top(o)] for o in old]


# ---- tracing ----

def trace(lab, w, h):
    """Borders between regions as chains of pixel corners: (points, left region, right region, closed)."""
    nh = (h + 1) * w
    w1 = w + 1
    bnd = bytearray(nh + h * w1)
    prev = [-1] * w
    for y in range(h + 1):
        cur = lab[y * w:(y + 1) * w].tolist() if y < h else [-1] * w
        bnd[y * w:(y + 1) * w] = bytes(a != b for a, b in zip(prev, cur))
        prev = cur
    for y in range(h):
        row = [-1] + lab[y * w:(y + 1) * w].tolist() + [-1]
        bnd[nh + y * w1:nh + (y + 1) * w1] = bytes(a != b for a, b in zip(row, row[1:]))
    seen = bytearray(len(bnd))

    def at(x, y):
        return lab[y * w + x] if 0 <= x < w and 0 <= y < h else -1

    def edge(x, y, d):
        if d == 0:
            return y * w + x if x < w else -1
        if d == 1:
            return nh + y * w1 + x if y < h else -1
        if d == 2:
            return y * w + x - 1 if x > 0 else -1
        return nh + (y - 1) * w1 + x if y > 0 else -1

    def degree(x, y):
        return sum(1 for d in range(4) if (e := edge(x, y, d)) >= 0 and bnd[e])

    def node(x, y):
        k = degree(x, y)
        return k >= 3 or (k == 2 and x in (0, w) and y in (0, h))

    sides = (lambda x, y: (at(x, y - 1), at(x, y)), lambda x, y: (at(x, y), at(x - 1, y)),
             lambda x, y: (at(x - 1, y), at(x - 1, y - 1)), lambda x, y: (at(x - 1, y - 1), at(x, y - 1)))
    steps = ((1, 0), (0, 1), (-1, 0), (0, -1))

    def walk(x, y, d, loop):
        sx, sy = x, y
        left, right = sides[d](x, y)
        pts = [(x, y)]
        e = edge(x, y, d)
        while True:
            seen[e] = 1
            x, y = x + steps[d][0], y + steps[d][1]
            pts.append((x, y))
            if (loop and (x, y) == (sx, sy)) or (not loop and node(x, y)):
                break
            for nd in (d, (d + 1) % 4, (d + 3) % 4):
                e = edge(x, y, nd)
                if e >= 0 and bnd[e]:
                    d = nd
                    break
        return pts, left, right, loop

    chains = []
    for y in range(h + 1):
        for x in range(w + 1):
            if node(x, y):
                for d in range(4):
                    e = edge(x, y, d)
                    if e >= 0 and bnd[e] and not seen[e]:
                        chains.append(walk(x, y, d, False))
    for e in range(nh):
        if bnd[e] and not seen[e]:
            chains.append(walk(e % w, e // w, 0, True))
    return chains


def smooth(pts, closed, passes):
    for _ in range(passes):
        if closed:
            n = len(pts) - 1
            ring = pts[:-1]
            ring = [((ring[i - 1][0] + 2 * ring[i][0] + ring[(i + 1) % n][0]) / 4,
                     (ring[i - 1][1] + 2 * ring[i][1] + ring[(i + 1) % n][1]) / 4) for i in range(n)]
            pts = ring + ring[:1]
        else:
            pts = [pts[0]] + [((a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4)
                              for a, b, c in zip(pts, pts[1:], pts[2:])] + [pts[-1]]
    return pts


def rdp(pts, tol):
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        (ax, ay), (bx, by) = pts[i], pts[j]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        best, at = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            d = abs(dy * (px - ax) - dx * (py - ay)) / norm if norm > 1e-9 else math.hypot(px - ax, py - ay)
            if d > best:
                best, at = d, k
        if best > tol:
            keep[at] = True
            stack += [(i, at), (at, j)]
    return [p for p, k in zip(pts, keep) if k]


def simplify(pts, closed, passes, tol):
    pts = smooth(pts, closed, passes)
    if not closed:
        return rdp(pts, tol)
    # split the ring at its farthest point from the start so both halves keep their shape
    far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    out = rdp(pts[:far + 1], tol)[:-1] + rdp(pts[far:], tol)
    return out if len(out) >= 5 else pts[::max(1, (len(pts) - 1) // 6)][:-1] + pts[-1:]


def segments(pts, closed):
    """Quadratic curves through the midpoints of the polyline, in tenths of a unit; the same curve both ways."""
    mid = [((a[0] + b[0]) // 2, (a[1] + b[1]) // 2) for a, b in zip(pts, pts[1:])]
    if closed:
        segs = [("Q", pts[i], mid[i]) for i in range(1, len(mid))] + [("Q", pts[0], mid[0])]
        return mid[0], segs
    if len(pts) == 2:
        return pts[0], [("L", pts[1])]
    segs = [("L", mid[0])] + [("Q", pts[i], mid[i]) for i in range(1, len(mid))] + [("L", pts[-1])]
    return pts[0], segs


def fmt(t):
    s = f"{abs(t) // 10}" if t % 10 == 0 else f"{abs(t) / 10:.1f}".lstrip("0")
    s = s or "0"
    return "-" + s if t < 0 else s


def path_data(loops):
    out = []
    cx = cy = 0
    for start, segs in loops:
        out.append("M" + fmt(start[0]) + " " + fmt(start[1]) if not out else
                   "m" + fmt(start[0] - cx) + " " + fmt(start[1] - cy))
        cx, cy = start
        last = None
        for seg in segs:
            nums = []
            for px, py in seg[1:]:
                nums += [px - cx, py - cy]
            cx, cy = seg[-1]
            cmd = seg[0].lower()
            text = " ".join(fmt(v) for v in nums).replace(" -", "-")
            if cmd != last:
                out.append(cmd + text)
            else:
                out.append(text if text.startswith("-") else " " + text)
            last = cmd
        out.append("z")
        cx, cy = start
    return "".join(out)


def region_paths(chains, n, scale, passes, tol):
    """One path per region; chains are simplified once, so neighbours share exactly the same edge."""
    per = [[] for _ in range(n)]
    for pts, left, right, closed in chains:
        pts = simplify(pts, closed, passes, tol)
        tenths = [(round(x * 10 / scale), round(y * 10 / scale)) for x, y in pts]
        for r, rev in ((left, False), (right, True)):
            if r >= 0:
                per[r].append((tenths[::-1] if rev else tenths, closed))
    paths = []
    for r in range(n):
        loops = []
        opens = {}
        for pts, closed in per[r]:
            if closed:
                loops.append(segments(pts, True))
            else:
                opens.setdefault(pts[0], []).append(pts)
        while opens:
            first = min(opens)
            chain = opens[first].pop()
            if not opens[first]:
                del opens[first]
            segs = []
            start = chain[0]
            while True:
                segs += segments(chain, False)[1]
                end = chain[-1]
                if end == start or end not in opens:
                    break
                chain = opens[end].pop()
                if not opens[end]:
                    del opens[end]
            loops.append((start, segs))
        paths.append((loops, sum(1 for _ in loops)))
    return paths


# ---- checks and previews ----

def visible_radii(svg_zones, vb_w, vb_h, k):
    """Inscribed radius of what shows of each zone, painted in order as the app does."""
    ras = Raster((0, 0, vb_w, vb_h), k)
    for i, (d, evenodd) in enumerate(svg_zones):
        ras.fill(flatten_path(d), i + 1, evenodd)
    return ras.radii(len(svg_zones))[1:]


def preview(path, lab, shade, group, rgb, w, h):
    im = Image.new("RGB", (w, h))
    colours = [rgb[group[s]] if s != LINE else (0, 0, 0) for s in shade]
    im.putdata([colours[v] for v in lab])
    edge = ImageMath.eval("(a != b) | (a != c)", a=Image.frombytes("I", (w, h), lab.tobytes()),
                          b=shifted(Image.frombytes("I", (w, h), lab.tobytes()), 1, 0, -1),
                          c=shifted(Image.frombytes("I", (w, h), lab.tobytes()), 0, 1, -1)).convert("L")
    im.paste((60, 60, 60), mask=edge.point(lambda v: 255 if v else 0))
    im.save(path)


def palette_order(lab):
    """Swatches from red round the hue circle to purple, greys and browns last."""
    l, a, b = lab
    chroma = math.hypot(a, b)
    hue = math.degrees(math.atan2(b, a)) % 360
    return (chroma < 12, (hue - 20) % 360 if chroma >= 12 else -l)


def write_svg(spec, lab, runs, shade, group, palette_lab, w, h, page_h, scale):
    """The SVG text, its zones (path data, even-odd) and the region of each zone, top to bottom."""
    used = sorted({group[s] for s in shade}, key=lambda g: palette_order(palette_lab[g]))
    number = {g: i + 1 for i, g in enumerate(used)}
    palette = [hexc(to_rgb(palette_lab[g])) for g in used]
    chains = trace(lab, w, h)
    paths = region_paths(chains, len(shade), scale, spec.get("smooth", 3), spec.get("tolerance", 0.7) * scale)
    first = {}
    for y, row in enumerate(runs):
        for a, b, rid in row:
            first.setdefault(rid, (y, a))
    order = sorted(range(len(shade)), key=lambda r: first[r])
    zones, lines = [], []
    for r in order:
        loops, count = paths[r]
        d = path_data(loops)
        zones.append((d, count > 1))
        c = number[group[shade[r]]]
        rule = ' fill-rule="evenodd"' if count > 1 else ""
        lines.append(f'  <path data-c="{c}" fill="{palette[c - 1]}"{rule} d="{d}"/>')
    title = escape(spec["title"], {'"': "&quot;"})
    credit = escape(spec["credit"], {'"': "&quot;"})
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE_W} {page_h}"\n'
           f'     data-title="{title}" data-level="{spec["level"]}"\n'
           f'     data-palette="{" ".join(palette)}"\n'
           f'     data-credit="{credit}">\n' + "\n".join(lines) + "\n</svg>\n")
    return svg, zones, order, len(palette)


def make(spec, src, preview_dir=None, name="drawing", scale=1):
    im, page_h = load(spec, src, scale)
    w, h = im.size
    idx, centres, group, palette_lab, smooth = quantize(spec, im)
    line = None
    if spec.get("lines"):
        line = dark_lines(im, spec.get("line_size", 5), spec["lines"])
        idx = bytearray(LINE if on else c for c, on in zip(idx, line))
    min_px = math.ceil(spec["min_radius"] * scale)
    arm = round(spec.get("arm", spec["min_radius"] * 0.6) * scale)
    lab, runs, shade = components(idx, w, h)
    lab, runs, shade = clean(lab, runs, shade, centres, w, h, spec, line, min_px, arm)
    for _ in range(6):
        if len(shade) > spec["zones"]:
            lab, runs, shade = reduce(lab, runs, shade, centres, w, h, line, spec["zones"])
            lab, runs, shade = clean(lab, runs, shade, centres, w, h, spec, line, min_px, arm)
        svg, zones, order, colors = write_svg(spec, lab, runs, shade, group, palette_lab, w, h, page_h, scale)
        k = (1600 if len(zones) > 120 else 640) / max(PAGE_W, page_h)  # the app's raster
        seen = visible_radii(zones, PAGE_W, page_h, k)
        # smoothing the borders can still pinch a zone below the limit: give those away and trace again;
        # the app loses about one pixel of its raster to antialiased edges, hence the margin
        thin = {order[i] for i, r in enumerate(seen) if r < spec["min_radius"] + 1 / k}
        if not thin:
            break
        drop = bytearray(w * h)
        for y, row in enumerate(runs):
            for a, b, rid in row:
                if rid in thin:
                    drop[y * w + a:y * w + b] = b"\x01" * (b - a)
        dissolve(lab, drop, w, h)
        lab, runs, old = components(lab.tobytes(), w, h, 4)
        shade = [shade[o] for o in old]
        lab, runs, shade = clean(lab, runs, shade, centres, w, h, spec, line, min_px, arm)
    if preview_dir:
        im.save(preview_dir / f"{name}_source.png")
        smooth.save(preview_dir / f"{name}_smooth.png")
        preview(preview_dir / f"{name}_zones.png", lab, shade, group, [to_rgb(c) for c in palette_lab], w, h)
    return svg, len(zones), colors, seen


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sources", type=Path, required=True,
                    help="folder holding one sub-folder per painting, as named in the table (image.jpg)")
    ap.add_argument("--out", type=Path, required=True, help="drawings folder; files go to its tableaux/ sub-folder")
    ap.add_argument("--only", nargs="*", help="drawing names to write, such as 84_fuji_rouge")
    ap.add_argument("--preview", type=Path, help="folder for the cropped picture and the zone map of each drawing")
    args = ap.parse_args()
    if args.preview:
        args.preview.mkdir(parents=True, exist_ok=True)
    for name, spec in PAINTINGS.items():
        if args.only and name not in args.only:
            continue
        svg, zones, colors, seen = make(spec, args.sources / spec["source"], args.preview, name)
        out = args.out / "tableaux" / f"{name}.svg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(svg, encoding="utf-8")
        small = min(seen)
        print(f"tableaux/{name}: {zones} zones, {colors} colours, smallest radius {small:.1f}, "
              f"{out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
