"""Generate the three hand-made drawings (fish, house, hot air balloon) into their category folders."""
import argparse
import math
from pathlib import Path

DARK = "#3a3a3a"


def f(v):
    s = f"{v:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    return "0" if s in ("-0", "-0.0") else s


def pt(p):
    return f"{f(p[0])} {f(p[1])}"


def catmull_segments(pts):
    """Cubic segments through pts (open curve), as a 'C ...' string starting at pts[0]."""
    out = []
    n = len(pts)
    for i in range(n - 1):
        p0 = pts[max(i - 1, 0)]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f"C{pt(c1)} {pt(c2)} {pt(p2)}")
    return "".join(out)


def catmull_closed(pts):
    n = len(pts)
    d = [f"M{pt(pts[0])}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{pt(c1)} {pt(c2)} {pt(p2)}")
    return "".join(d) + "Z"


def ellipse(cx, cy, rx, ry=None):
    ry = rx if ry is None else ry
    return (f"M{f(cx - rx)} {f(cy)}A{f(rx)} {f(ry)} 0 1 0 {f(cx + rx)} {f(cy)}"
            f"A{f(rx)} {f(ry)} 0 1 0 {f(cx - rx)} {f(cy)}Z")


def polar(cx, cy, rfun, n=36):
    return [(cx + rfun(t) * math.cos(t), cy + rfun(t) * math.sin(t))
            for t in (2 * math.pi * j / n for j in range(n))]


def blob(cx, cy, r, bumps, depth, n=42):
    return catmull_closed(polar(cx, cy, lambda t: r * (1 + depth * math.sin(bumps * t)), n))


def flower(cx, cy, r, n=40):
    return catmull_closed(polar(
        cx, cy, lambda t: r * (0.58 + 0.42 * abs(math.cos(2.5 * (t + math.pi / 2)))), n))


def star(cx, cy, ro, ri):
    pts = []
    for j in range(10):
        a = -math.pi / 2 + j * math.pi / 5
        r = ro if j % 2 == 0 else ri
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return "M" + "L".join(pt(p) for p in pts) + "Z"


def blade(x0, ybase, h, wmax, amp, waves, phase=0.0, n=14):
    left, right = [], []
    for j in range(n + 1):
        t = j / n
        y = ybase - h * t
        xc = x0 + amp * math.sin(2 * math.pi * waves * t + phase)
        hw = wmax * (1 - t) ** 0.8
        left.append((xc - hw, y))
        right.append((xc + hw, y))
    return catmull_closed(left + right[::-1][1:])


def cloud(cx, cy, w):
    x0 = cx - w / 2
    return (f"M{pt((x0, cy))}"
            f"A{f(0.2 * w)} {f(0.2 * w)} 0 0 1 {pt((x0 + 0.28 * w, cy - 0.18 * w))}"
            f"A{f(0.26 * w)} {f(0.26 * w)} 0 0 1 {pt((x0 + 0.68 * w, cy - 0.2 * w))}"
            f"A{f(0.2 * w)} {f(0.2 * w)} 0 0 1 {pt((x0 + w, cy))}Z")


def rrect(x, y, w, h, r):
    return (f"M{f(x + r)} {f(y)}H{f(x + w - r)}A{f(r)} {f(r)} 0 0 1 {f(x + w)} {f(y + r)}"
            f"V{f(y + h - r)}A{f(r)} {f(r)} 0 0 1 {f(x + w - r)} {f(y + h)}"
            f"H{f(x + r)}A{f(r)} {f(r)} 0 0 1 {f(x)} {f(y + h - r)}"
            f"V{f(y + r)}A{f(r)} {f(r)} 0 0 1 {f(x + r)} {f(y)}Z")


def zone(c, d):
    return f'  <path data-c="{c}" d="{d}"/>'


def deco_path(d, stroke=DARK, width=4, fill="none", extra=""):
    return (f'  <path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round"{extra}/>')


def line(x1, y1, x2, y2, stroke=DARK, width=4):
    return (f'  <line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" '
            f'stroke="{stroke}" stroke-width="{width}" stroke-linecap="round"/>')


def svg(title, level, palette, body):
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"\n'
            f'     data-title="{title}" data-level="{level}"\n'
            f'     data-palette="{" ".join(palette)}">\n')
    return head + "\n".join(body) + "\n</svg>\n"


def fish():
    palette = ["#4FA3E0", "#FF8A1F", "#FFD23F", "#43A047", "#E8C887", "#BDE6FF"]
    cx, cy, rx, ry = 400, 470, 240, 150

    def ytop(x):
        return cy - ry * math.sqrt(1 - ((x - cx) / rx) ** 2)

    def ybot(x):
        return cy + ry * math.sqrt(1 - ((x - cx) / rx) ** 2)

    def stripe(a, b, bow=22):
        return (f"M{f(a)} {f(ytop(a))}Q{f(a - bow)} {cy} {f(a)} {f(ybot(a))}"
                f"A{rx} {ry} 0 0 0 {f(b)} {f(ybot(b))}"
                f"Q{f(b - bow)} {cy} {f(b)} {f(ytop(b))}"
                f"A{rx} {ry} 0 0 0 {f(a)} {f(ytop(a))}Z")

    body = [
        '  <rect data-c="1" x="0" y="0" width="800" height="1000"/>',
        zone(4, blade(90, 900, 330, 32, 18, 1.5)),
        zone(4, blade(160, 900, 230, 28, 14, 1.2, 1.0)),
        zone(4, blade(720, 900, 300, 30, 16, 1.4, 2.0)),
        zone(5, "M0 850C130 815 260 880 400 855C540 830 660 880 800 845L800 1000L0 1000Z"),
        zone(2, star(600, 925, 46, 20)),
        zone(3, "M280 352C300 270 370 220 440 232C420 270 440 315 500 350Z"),
        zone(3, "M210 470C150 420 100 360 55 350C85 420 85 520 55 590C100 580 150 520 210 470Z"),
        zone(2, ellipse(cx, cy, rx, ry)),
        zone(3, stripe(300, 345)),
        zone(3, stripe(430, 475)),
        deco_path("M505 405Q485 470 505 535", width=4, extra=' stroke-opacity="0.45"'),
        f'  <circle cx="560" cy="430" r="26" fill="#fff" stroke="{DARK}" stroke-width="4"/>',
        f'  <circle cx="566" cy="431" r="11" fill="{DARK}"/>',
        '  <circle cx="570" cy="426" r="4" fill="#fff"/>',
        deco_path("M612 494Q628 506 646 490", width=5),
        zone(6, ellipse(678, 392, 24)),
        zone(6, ellipse(705, 320, 28)),
        zone(6, ellipse(680, 225, 36)),
    ]
    return svg("Le poisson", 1, palette, body)


def house():
    palette = ["#8FD3FF", "#5CBF60", "#FFD23F", "#E8483B", "#9C6B3F", "#F7A8C8"]
    rays = []
    for j in range(8):
        a = j * math.pi / 4
        rays.append(line(640 + 95 * math.cos(a), 150 + 95 * math.sin(a),
                         640 + 128 * math.cos(a), 150 + 128 * math.sin(a), "#F5A623", 8))
    flowers = []
    spots = [(95, 845), (215, 900), (570, 875)]
    for (x, y) in spots:
        flowers.append(line(x, y + 30, x, y + 95, "#2E7D32", 6))
    for (x, y) in spots:
        flowers.append(zone(4, flower(x, y, 40)))
    body = [
        '  <rect data-c="1" x="0" y="0" width="800" height="1000"/>',
        '  <circle data-c="3" cx="640" cy="150" r="75"/>',
        *rays,
        zone(2, "M0 720C200 690 600 750 800 715L800 1000L0 1000Z"),
        '  <rect data-c="5" x="645" y="560" width="40" height="190"/>',
        zone(2, blob(665, 500, 90, 7, 0.07)),
        '  <rect data-c="5" x="440" y="330" width="50" height="120"/>',
        '  <polygon data-c="4" points="120,475 340,300 560,475"/>',
        '  <rect data-c="6" x="150" y="470" width="380" height="290"/>',
        '  <rect data-c="5" x="300" y="600" width="80" height="160"/>',
        f'  <circle cx="365" cy="685" r="6" fill="{DARK}"/>',
        '  <rect data-c="3" x="178" y="520" width="94" height="94"/>',
        '  <rect data-c="3" x="408" y="520" width="94" height="94"/>',
        line(225, 520, 225, 614, "#6b6b6b", 4), line(178, 567, 272, 567, "#6b6b6b", 4),
        line(455, 520, 455, 614, "#6b6b6b", 4), line(408, 567, 502, 567, "#6b6b6b", 4),
        *flowers,
    ]
    return svg("La maison", 1, palette, body)


def balloon():
    palette = ["#9ED8FF", "#FFD23F", "#D6E4F2", "#2E7D32", "#5CB85C",
               "#A5D86E", "#E53935", "#FB8C00", "#8D5A35", "#F48FB1"]
    cx = 470
    profile = [(0, 150), (90, 172), (148, 220), (178, 290), (185, 350), (176, 410),
               (148, 480), (104, 548), (64, 598), (46, 622)]
    # dense samples of the outline (half width, y), smoothed through the control points
    dense = [profile[0]]
    for i in range(len(profile) - 1):
        p0 = profile[max(i - 1, 0)]
        p1, p2 = profile[i], profile[i + 1]
        p3 = profile[min(i + 2, len(profile) - 1)]
        for s in (1 / 3, 2 / 3, 1.0):
            t2, t3 = s * s, s * s * s
            dense.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * s
                                      + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                                      + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                               for k in (0, 1)))
    fs = [math.sin(math.radians(a)) for a in (-90, -60, -30, 0, 30, 60, 90)]
    merid = [[(cx + fk * w, y) for (w, y) in dense] for fk in fs]
    gores = []
    for g, color in enumerate([7, 2, 7, 2, 7, 2]):
        a, b = merid[g], merid[g + 1]
        d = (f"M{pt(a[0])}" + catmull_segments(a) + f"L{pt(b[-1])}"
             + catmull_segments(b[::-1]) + "Z")
        gores.append(zone(color, d))

    rays = []
    for j in range(8):
        a = math.radians(j * 45 + 22.5)
        da = math.radians(12)
        p1 = (120 + 78 * math.cos(a - da), 130 + 78 * math.sin(a - da))
        p2 = (120 + 122 * math.cos(a), 130 + 122 * math.sin(a))
        p3 = (120 + 78 * math.cos(a + da), 130 + 78 * math.sin(a + da))
        rays.append(f'  <polygon data-c="2" points="{f(p1[0])},{f(p1[1])} {f(p2[0])},{f(p2[1])} {f(p3[0])},{f(p3[1])}"/>')

    flowers = []
    for (x, y) in [(90, 948), (250, 940), (420, 958), (690, 948)]:
        flowers.append(zone(10, flower(x, y, 34)))
        flowers.append(zone(2, ellipse(x, y, 12)))

    body = [
        '  <rect data-c="1" x="0" y="0" width="800" height="1000"/>',
        '  <circle data-c="2" cx="120" cy="130" r="60"/>',
        *rays,
        zone(3, cloud(230, 360, 210)),
        zone(3, cloud(660, 170, 170)),
        zone(3, cloud(700, 560, 170)),
        deco_path("M500 100q14 -14 28 0q14 -14 28 0"),
        deco_path("M570 62q11 -11 22 0q11 -11 22 0"),
        zone(4, "M0 760C150 690 330 700 450 745C560 780 680 700 800 720L800 1000L0 1000Z"),
        zone(5, "M0 830C160 790 320 800 470 840C600 870 700 820 800 810L800 1000L0 1000Z"),
        '  <rect data-c="9" x="102" y="760" width="16" height="70"/>',
        zone(6, blob(110, 735, 42, 6, 0.08)),
        '  <rect data-c="9" x="642" y="790" width="16" height="70"/>',
        zone(6, blob(650, 765, 45, 6, 0.08)),
        zone(6, "M0 900C200 860 420 880 560 905C680 925 740 890 800 885L800 1000L0 1000Z"),
        *flowers,
        *gores,
        zone(8, f"M{f(cx - 48)} 618L{f(cx + 48)} 618L{f(cx + 36)} 660L{f(cx - 36)} 660Z"),
        line(cx - 32, 660, cx - 40, 730, DARK, 3), line(cx - 11, 660, cx - 13, 730, DARK, 3),
        line(cx + 11, 660, cx + 13, 730, DARK, 3), line(cx + 32, 660, cx + 40, 730, DARK, 3),
        zone(9, rrect(cx - 46, 730, 92, 64, 8)),
        line(cx - 46, 762, cx + 46, 762, "#5a3a22", 3),
    ]
    return svg("La montgolfière", 2, palette, body)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("out_dir", type=Path)
    args = ap.parse_args()
    for folder, name, make in [("animaux", "01_poisson", fish), ("nature", "02_maison", house),
                               ("vehicules", "03_montgolfiere", balloon)]:
        path = args.out_dir / folder / f"{name}.svg"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(make(), encoding="utf-8")
        print(path, path.stat().st_size)


if __name__ == "__main__":
    main()
