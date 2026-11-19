"""Turn a line drawing and a coloured copy of it into a Giuno Colors drawing.

The areas closed by the lines become the zones, each with the colour the coloured copy gives it
(an area left open by a gap in the lines is cut along the colours of the copy); VectorCraft traces
the lines themselves, which are laid over the zones as in a colouring book.
"""
import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageFilter

WIDTH = 800             # page units across, one pixel per unit while working out the zones
INK = 140               # grey level under which a pixel is line
MIN_RADIUS = 4.0        # inscribed radius of a zone, in units; smaller areas come already coloured
MERGE_DE = 7.0          # colours closer than this (CIE76) become one palette entry
SIMPLIFY = 0.9          # largest gap allowed between a zone's outline and its pixels
JOIN_DE = 22.0          # a small area joins a neighbour whose colour is this close (hatching cells)
MODEL_COLOURS = 12      # colours the model is reduced to when looking for patches of one colour
SPLIT_RADIUS = 6.0      # a patch of one colour this wide, in an area the lines leave open, is an area of its own
SPLIT_DE = 14.0         # patches closer in colour than this (CIE76) stay together: paper grain, uneven inking
LINE_STEP = 10          # the traced lines are written in whole tenths of a traced pixel


def load(path, width):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    im = im.convert("RGB")
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


def label_regions(wall, w, h):
    """Connected areas between the lines (4-neighbours): label per pixel, 0 on lines, and pixel lists."""
    lab = [0] * (w * h)
    regions = [None]
    for start in range(w * h):
        if wall[start] or lab[start]:
            continue
        n = len(regions)
        pix = []
        stack = [start]
        lab[start] = n
        while stack:
            p = stack.pop()
            pix.append(p)
            x, y = p % w, p // w
            for q, ok in ((p - 1, x > 0), (p + 1, x < w - 1), (p - w, y > 0), (p + w, y < h - 1)):
                if ok and not wall[q] and not lab[q]:
                    lab[q] = n
                    stack.append(q)
        regions.append(pix)
    return lab, regions


def colour_classes(colour_im, n):
    """Each pixel's class among n colours of the model, paper grain and print dots smoothed away."""
    q = colour_im.filter(ImageFilter.MedianFilter(5)).quantize(n, method=Image.Quantize.MEDIANCUT)
    return list(Image.frombytes("L", q.size, q.tobytes()).filter(ImageFilter.ModeFilter(5)).getdata())


def split_by_colour(lab, regions, classes, colour, w, h):
    """An area left open by a gap in the lines spreads over several colours of the model (a sack and
    the ground around it). Wide patches of one colour, grouped when their colours are close, become
    areas, the rest of the area goes to the nearest group; areas with a single group stay whole."""
    new_lab = [0] * (w * h)
    new_regions = [None]
    seen = bytearray(w * h)
    step = lambda p: ((p - 1, p % w > 0), (p + 1, p % w < w - 1), (p - w, p >= w), (p + w, p < w * (h - 1)))
    for n in range(1, len(regions)):
        pix = regions[n]
        big = []
        if len(pix) >= 2 * (2 * SPLIT_RADIUS) ** 2:
            for start in pix:
                if seen[start]:
                    continue
                c, patch, stack = classes[start], [], [start]
                seen[start] = 1
                while stack:
                    p = stack.pop()
                    patch.append(p)
                    for q, ok in step(p):
                        if ok and not seen[q] and lab[q] == n and classes[q] == c:
                            seen[q] = 1
                            stack.append(q)
                if len(patch) >= (2 * SPLIT_RADIUS) ** 2 and inscribed_radius(patch, w) >= SPLIT_RADIUS:
                    big.append(patch)
        groups = []  # [Lab colour of the first patch, patches]
        for patch in big:
            mean = srgb_to_lab(tuple(sum(c) / len(patch) for c in zip(*(colour[p] for p in patch))))
            near = [g for g in groups if math.dist(g[0], mean) < SPLIT_DE]
            if near:
                near[0][1].append(patch)
            else:
                groups.append([mean, [patch]])
        if len(groups) < 2:
            new_regions.append(pix)
            for p in pix:
                new_lab[p] = len(new_regions) - 1
            continue
        frontier = []
        for _, patches in groups:
            new_regions.append([])
            for patch in patches:
                for p in patch:
                    new_lab[p] = len(new_regions) - 1
                frontier += patch
        while frontier:
            nxt = []
            for p in frontier:
                for q, ok in step(p):
                    if ok and lab[q] == n and not new_lab[q]:
                        new_lab[q] = new_lab[p]
                        nxt.append(q)
            frontier = nxt
        for p in pix:
            new_regions[new_lab[p]].append(p)
    # a group can lie in pieces (the ground on both sides of a sack): each piece is an area
    out_lab = [0] * (w * h)
    out = [None]
    for pix in new_regions[1:]:
        for start in pix:
            if out_lab[start]:
                continue
            n, piece, stack = len(out), [], [start]
            out_lab[start] = n
            while stack:
                p = stack.pop()
                piece.append(p)
                for q, ok in step(p):
                    if ok and not out_lab[q] and new_lab[q] == new_lab[start]:
                        out_lab[q] = n
                        stack.append(q)
            out.append(piece)
    return out_lab, out


def close_gaps(wall, w, h, r):
    """Lines thickened then thinned back by r pixels: openings narrower than about 2r are bridged."""
    if r <= 0:
        return wall
    im = Image.frombytes("L", (w, h), bytes(v * 255 for v in wall))
    im = im.filter(ImageFilter.MaxFilter(2 * r + 1)).filter(ImageFilter.MinFilter(2 * r + 1))
    return bytearray(1 if v else 0 for v in im.tobytes())


def neighbours(lab, w, h):
    """Pairs of tiles that touch."""
    pairs = set()
    for p in range(w * h):
        a = lab[p]
        if p % w < w - 1 and lab[p + 1] != a:
            pairs.add((min(a, lab[p + 1]), max(a, lab[p + 1])))
        if p + w < w * h and lab[p + w] != a:
            pairs.add((min(a, lab[p + w]), max(a, lab[p + w])))
    return pairs


def grow_into_lines(lab, w, h):
    """Give each line pixel to the nearest area, so the zones tile the page and meet under the lines."""
    frontier = [p for p in range(w * h) if lab[p]]
    while frontier:
        nxt = []
        for p in frontier:
            x, y = p % w, p // w
            for q, ok in ((p - 1, x > 0), (p + 1, x < w - 1), (p - w, y > 0), (p + w, y < h - 1)):
                if ok and not lab[q]:
                    lab[q] = lab[p]
                    nxt.append(q)
        frontier = nxt


def inscribed_radius(pixels, w):
    """Largest distance from a pixel of the area to its edge (chamfer 3-4), in pixels."""
    xs = [p % w for p in pixels]
    ys = [p // w for p in pixels]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    bw, bh = x1 - x0 + 3, y1 - y0 + 3
    d = [0.0] * (bw * bh)
    for p in pixels:
        d[(p // w - y0 + 1) * bw + (p % w - x0 + 1)] = 1e9
    for y in range(1, bh - 1):
        for x in range(1, bw - 1):
            i = y * bw + x
            if d[i]:
                d[i] = min(d[i], d[i - 1] + 3, d[i - bw] + 3, d[i - bw - 1] + 4, d[i - bw + 1] + 4)
    best = 0.0
    for y in range(bh - 2, 0, -1):
        for x in range(bw - 2, 0, -1):
            i = y * bw + x
            if d[i]:
                d[i] = min(d[i], d[i + 1] + 3, d[i + bw] + 3, d[i + bw + 1] + 4, d[i + bw - 1] + 4)
                best = max(best, d[i])
    return best / 3


def srgb_to_lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def region_colour(pixels, lab, colour, w, h):
    """Median colour of the area's pixels away from its edge, so line antialiasing does not tint it."""
    core = []
    for p in pixels:
        x, y = p % w, p // w
        if 1 < x < w - 2 and 1 < y < h - 2 and all(lab[q] == lab[p] for q in (p - 2, p + 2, p - 2 * w, p + 2 * w)):
            core.append(p)
    use = core if len(core) >= 4 else pixels
    chans = list(zip(*(colour[p] for p in use)))
    return tuple(sorted(c)[len(c) // 2] for c in chans)


def build_palette(colours, weights, max_colours):
    """Group close colours (k-means in Lab, weighted by area, then merging of near twins)."""
    labs = [srgb_to_lab(c) for c in colours]
    dist = lambda a, b: math.dist(a, b)
    # farthest-point start, heaviest colour first
    order = sorted(range(len(labs)), key=lambda i: -weights[i])
    centres = [labs[order[0]]]
    while len(centres) < min(max_colours, len(labs)):
        far = max(range(len(labs)), key=lambda i: min(dist(labs[i], c) for c in centres))
        if min(dist(labs[far], c) for c in centres) < MERGE_DE:
            break
        centres.append(labs[far])
    for _ in range(25):
        assign = [min(range(len(centres)), key=lambda k: dist(l, centres[k])) for l in labs]
        sums = [[0.0, 0.0, 0.0, 0.0] for _ in centres]
        for i, k in enumerate(assign):
            for j in range(3):
                sums[k][j] += labs[i][j] * weights[i]
            sums[k][3] += weights[i]
        centres = [(s[0] / s[3], s[1] / s[3], s[2] / s[3]) if s[3] else c for s, c in zip(sums, centres)]
    assign = [min(range(len(centres)), key=lambda k: dist(l, centres[k])) for l in labs]
    # each group shows as the area-weighted mean of its members' colours, in RGB
    groups = {}
    for i, k in enumerate(assign):
        g = groups.setdefault(k, [0.0, 0.0, 0.0, 0.0])
        for j in range(3):
            g[j] += colours[i][j] * weights[i]
        g[3] += weights[i]
    keys = sorted(groups, key=lambda k: (srgb_to_lab(tuple(v / groups[k][3] for v in groups[k][:3]))[0]))
    hexes = ["#%02x%02x%02x" % tuple(round(v / groups[k][3]) for v in groups[k][:3]) for k in keys]
    index = {k: n for n, k in enumerate(keys)}
    return hexes, [index[k] for k in assign]


def loop_area(loop):
    return abs(sum(loop[i][0] * loop[i - 1][1] - loop[i - 1][0] * loop[i][1] for i in range(len(loop)))) / 2


def trace_outline(pixels, w, holes=False):
    """Outer outline of an area along pixel edges, as a closed list of points; with `holes`, every
    outline of the area, the outer one first."""
    inside = set(pixels)
    edges = {}
    for p in pixels:
        x, y = p % w, p // w
        if p - w not in inside or y == 0:
            edges.setdefault((x, y), []).append((x + 1, y))
        if p + 1 not in inside or x == w - 1:
            edges.setdefault((x + 1, y), []).append((x + 1, y + 1))
        if p + w not in inside:
            edges.setdefault((x + 1, y + 1), []).append((x, y + 1))
        if p - 1 not in inside or x == 0:
            edges.setdefault((x, y + 1), []).append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        loop, v = [], start
        while True:
            loop.append(v)
            nxt = edges[v].pop()
            if not edges[v]:
                del edges[v]
            v = nxt
            if v == start:
                break
        loops.append(loop)
    loops.sort(key=loop_area, reverse=True)
    return loops if holes else loops[0]


def simplify(points, eps):
    """Ramer-Douglas-Peucker on a closed loop."""
    def rdp(pts):
        if len(pts) < 3:
            return pts
        (ax, ay), (bx, by) = pts[0], pts[-1]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1e-9
        far, fd = 0, -1.0
        for i in range(1, len(pts) - 1):
            d = abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / n
            if d > fd:
                far, fd = i, d
        if fd <= eps:
            return [pts[0], pts[-1]]
        return rdp(pts[:far + 1])[:-1] + rdp(pts[far:])
    half = len(points) // 2
    out = rdp(points[:half + 1])[:-1] + rdp(points[half:] + [points[0]])[:-1]
    return out if len(out) >= 3 else points


def polygon_path(points):
    """Straight sides: the zones meet under the lines, which hide their edges anyway."""
    return "M" + "L".join(f"{x} {y}" for x, y in points) + "Z"


def compact_path(d, step):
    """Absolute M, L, C, Z path data rewritten relative, in whole 1/step of a unit: about a third of
    the size. Each point is rounded before the steps are taken, so rounding errors do not add up."""
    if re.search(r"[^MLCZ\d\s.,eE+-]", d):
        raise ValueError("unexpected path command in " + d[:60])
    out = []
    cx = cy = sx = sy = 0
    for cmd, nums in re.findall(r"([MLCZ])([^MLCZ]*)", d):
        if cmd == "Z":
            out.append("z")
            cx, cy = sx, sy
            continue
        v = [round(float(t) * step) for t in re.findall(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?", nums)]
        group = 6 if cmd == "C" else 2
        rel = []
        for i in range(0, len(v), group):
            pts = v[i:i + group]
            rel += [p - (cx if j % 2 == 0 else cy) for j, p in enumerate(pts)]
            cx, cy = pts[-2], pts[-1]
            if cmd == "M" and i == 0:
                sx, sy = cx, cy
        out.append(cmd.lower() + "".join(("" if j == 0 or n < 0 else " ") + str(n) for j, n in enumerate(rel)))
    return "".join(out)


def trace_lines(vectorcraft, png, svg_out):
    """The lines as filled outlines, traced by VectorCraft without a window."""
    win = lambda p: subprocess.run(["wslpath", "-w", str(p)], capture_output=True, text=True, check=True).stdout.strip()
    params = {"params": {"mode": "blackAndWhite", "threshold": 128, "ignoreWhite": True, "paths": 85, "corners": 40, "noise": 3}}
    res = subprocess.run([vectorcraft, "run", "--in", win(png), "--cmd", "select.all", "--cmd", "imageTrace.makeAndExpand",
                          "--params", json.dumps(params), "--export", win(svg_out)], capture_output=True, text=True)
    if res.returncode or not svg_out.exists():
        sys.exit(f"error: VectorCraft could not trace {png}:\n{res.stdout}{res.stderr}")
    text = svg_out.read_text(encoding="utf-8")
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', text).group(1).split()]
    paths = re.findall(r'<path\b[^>]*\bd="([^"]+)"', text)
    return vb, paths


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--lines", type=Path, required=True, help="the line drawing (black lines on white)")
    ap.add_argument("--colours", type=Path, required=True, help="the same drawing coloured, same framing")
    ap.add_argument("--out", type=Path, required=True, help="SVG drawing to write")
    ap.add_argument("--work", type=Path, required=True, help="folder VectorCraft can read and write (on a Windows drive)")
    ap.add_argument("--vectorcraft", required=True, help="path of vectorcraft-cli.exe")
    ap.add_argument("--title", required=True, help="title shown in the gallery (French)")
    ap.add_argument("--level", type=int, default=3, choices=(1, 2, 3))
    ap.add_argument("--max-colours", type=int, default=20)
    ap.add_argument("--min-radius", type=float, default=MIN_RADIUS, help="smallest zone, as inscribed radius in units")
    ap.add_argument("--close", type=int, default=1, help="bridge openings in the lines up to about twice this, in units")
    ap.add_argument("--credit", default="", help="data-credit of the drawing")
    args = ap.parse_args()

    lines_im = load(args.lines, WIDTH)
    colour_im = load(args.colours, WIDTH).resize(lines_im.size)
    w, h = lines_im.size
    grey = list(lines_im.convert("L").getdata())
    colour = list(colour_im.getdata())
    wall = close_gaps(bytearray(1 if v < INK else 0 for v in grey), w, h, args.close)

    lab, regions = label_regions(wall, w, h)
    lab, regions = split_by_colour(lab, regions, colour_classes(colour_im, MODEL_COLOURS), colour, w, h)
    radii = [0.0] + [inscribed_radius(px, w) for px in regions[1:]]
    colours = [None] + [region_colour(px, lab, colour, w, h) for px in regions[1:]]
    grow_into_lines(lab, w, h)

    # hatching cuts an area into small cells: each small cell joins the touching group whose colour
    # is closest in the model, if close enough, so the whole area is one zone under its hatching
    group = list(range(len(regions)))
    def root(n):
        while group[n] != n:
            group[n] = group[group[n]]
            n = group[n]
        return n
    touch = {}
    for a, b in neighbours(lab, w, h):
        touch.setdefault(a, set()).add(b)
        touch.setdefault(b, set()).add(a)
    labs = [None] + [srgb_to_lab(c) for c in colours[1:]]
    for n in sorted(range(1, len(regions)), key=lambda n: len(regions[n])):
        if radii[n] >= args.min_radius:
            continue
        near = [(math.dist(labs[n], labs[root(m)]), root(m)) for m in touch.get(n, ()) if root(m) != root(n)]
        if near:
            d, m = min(near)
            if d < JOIN_DE:
                big, other = (m, root(n)) if len(regions[m]) >= len(regions[root(n)]) else (root(n), m)
                group[other] = big
    members = {}
    for n in range(1, len(regions)):
        members.setdefault(root(n), []).append(n)
    tiles = [[] for _ in regions]
    for p, n in enumerate(lab):
        tiles[root(n)].append(p)
    area = {g: sum(len(regions[n]) for n in ms) for g, ms in members.items()}
    widest = {g: max(radii[n] for n in ms) for g, ms in members.items()}
    # a group is a zone when one of its cells is wide enough, or many cells make a big area
    is_zone = lambda g: widest[g] >= args.min_radius or (area[g] >= 40 * args.min_radius ** 2 and widest[g] >= 1.5)
    zones = [g for g in members if is_zone(g)]
    small = [g for g in members if not is_zone(g) and area[g] >= 2]
    weights = [area[g] for g in zones]
    palette, pick = build_palette([colours[g] for g in zones], weights, args.max_colours)

    # a zone is drawn whole and the zones inside it over it, so the widest outline goes first (not the
    # most pixels: the thin margin around a framed picture outlines the whole page)
    outlines = [simplify(trace_outline(tiles[g], w), SIMPLIFY) for g in zones]
    body = []
    for i in sorted(range(len(zones)), key=lambda i: -loop_area(outlines[i])):
        body.append(f'<path data-c="{pick[i] + 1}" fill="{palette[pick[i]]}" d="{polygon_path(outlines[i])}"/>')
    # drawn over the zones, so they keep their holes
    deco = []
    for g in sorted(small, key=lambda g: -len(tiles[g])):
        d = "".join(polygon_path(simplify(loop, SIMPLIFY)) for loop in trace_outline(tiles[g], w, holes=True))
        deco.append(f'<path fill="#%02x%02x%02x" fill-rule="evenodd" d="{d}"/>' % colours[g])

    # VectorCraft traces the line drawing at its own resolution, flattened on white
    args.work.mkdir(parents=True, exist_ok=True)
    png = args.work / (args.out.stem + "_lines.png")
    full = Image.open(args.lines)
    load(args.lines, max(full.width, 1600)).save(png)
    vb, line_paths = trace_lines(args.vectorcraft, png, args.work / (args.out.stem + "_lines.svg"))
    k = WIDTH / vb[2] / LINE_STEP
    ink = "".join(f'<path d="{compact_path(d, LINE_STEP)}"/>' for d in line_paths)

    credit = f'\n     data-credit="{escape(args.credit)}"' if args.credit else ""
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"\n'
           f'     data-title="{escape(args.title)}" data-level="{args.level}"\n'
           f'     data-palette="{" ".join(palette)}"{credit}>\n'
           + "\n".join(body) + "\n"
           + (f'<g class="small">{"".join(deco)}</g>\n' if deco else "")
           + f'<g fill="#2b2b2b" fill-rule="nonzero" transform="matrix({k:.7f} 0 0 {k:.7f} 0 0)">{ink}</g>\n'
           + "</svg>\n")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(svg, encoding="utf-8")
    rmin = min(widest[g] for g in zones) if zones else 0
    print(f"{args.out}: {len(zones)} zones, {len(palette)} colours, {len(small)} small areas coloured, "
          f"smallest zone radius {rmin:.1f}, {len(svg) // 1024} KB")


if __name__ == "__main__":
    main()
