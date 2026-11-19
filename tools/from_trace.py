"""Turn a flat-colour illustration into a Giuno Colors drawing.

VectorCraft traces the picture in a few colours (Image Trace, colour mode, without a window); each
traced shape becomes a zone, its colour a palette entry. Works well on illustrations with clear flat
areas and soft cel shading, badly on photos, 3D renders and textured paintings.
"""
import argparse
import colorsys
import json
import re
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image

PAGE_W = 800
TRACE_AREA = 640_000  # pixels the picture is traced at, so `noise` means the same on every picture


def win(path):
    return subprocess.run(["wslpath", "-w", str(path)], capture_output=True, text=True, check=True).stdout.strip()


def flatten(src, dst, area):
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        im = Image.alpha_composite(Image.new("RGBA", im.size, (255, 255, 255, 255)), im)
    im = im.convert("RGB")
    f = (area / (im.width * im.height)) ** 0.5
    im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS).save(dst)


def trace(vectorcraft, png, svg, params):
    res = subprocess.run([vectorcraft, "run", "--in", win(png), "--cmd", "select.all", "--cmd", "imageTrace.makeAndExpand",
                          "--params", json.dumps({"params": params}), "--export", win(svg)], capture_output=True, text=True)
    if res.returncode or not svg.exists():
        sys.exit(f"error: VectorCraft could not trace {png}:\n{res.stdout}{res.stderr}")
    return svg.read_text(encoding="utf-8")


def scaled(d, k):
    """Path data of absolute M, L, C and Z commands, every number times k and rounded, written tight.

    Whole page units are close enough: the zones are 800 units across and their outlines a pixel wide."""
    if re.search(r"[^MLCZ\d\s.,eE+-]", d):
        raise ValueError("unexpected path command in " + d[:60])
    out = []
    for cmd, nums in re.findall(r"([MLCZ])([^MLCZ]*)", d):
        values = [round(float(v) * k) for v in re.findall(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?", nums)]
        text = cmd
        for i, v in enumerate(values):
            text += ("" if i == 0 or v < 0 else " ") + str(v)
        out.append(text)
    return "".join(out)


def lightness(hexc):
    return colorsys.rgb_to_hls(*(int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)))[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--image", type=Path, required=True, help="the illustration (PNG, JPEG, WebP)")
    ap.add_argument("--out", type=Path, required=True, help="SVG drawing to write")
    ap.add_argument("--work", type=Path, required=True, help="folder VectorCraft can read and write (on a Windows drive)")
    ap.add_argument("--vectorcraft", required=True, help="path of vectorcraft-cli.exe")
    ap.add_argument("--title", required=True, help="title shown in the gallery (French)")
    ap.add_argument("--level", type=int, default=3, choices=(1, 2, 3))
    ap.add_argument("--colors", type=int, default=14, help="palette size, 2 to 24")
    ap.add_argument("--noise", type=int, default=700, help="shapes smaller than this many traced pixels are dropped")
    ap.add_argument("--fidelity", type=int, default=20, help="how closely curves follow the picture, 0 to 100")
    ap.add_argument("--credit", default="", help="data-credit of the drawing")
    args = ap.parse_args()

    args.work.mkdir(parents=True, exist_ok=True)
    png = args.work / (args.out.stem + "_trace.png")
    flatten(args.image, png, TRACE_AREA)
    params = {"mode": "color", "palette": "limited", "colors": args.colors, "paths": args.fidelity, "corners": 45,
              "noise": args.noise, "method": "abutting"}
    text = trace(args.vectorcraft, png, args.work / (args.out.stem + "_trace.svg"), params)

    vw, vh = (float(v) for v in re.search(r'viewBox="([^"]+)"', text).group(1).split()[2:])
    k = PAGE_W / vw
    shapes = re.findall(r'<path d="([^"]+)" fill="(#[0-9a-fA-F]{6})"', text)
    palette = sorted({f.lower() for _, f in shapes}, key=lightness)
    zones = [f'<path data-c="{palette.index(f.lower()) + 1}" fill="{f.lower()}" d="{scaled(d, k)}"/>' for d, f in shapes]
    # the shapes the trace dropped as noise leave holes: under everything, the colour seen most
    counts = {}
    for d, f in shapes:
        counts[f.lower()] = counts.get(f.lower(), 0) + len(d)
    under = f'<rect width="{PAGE_W}" height="{round(vh * k)}" fill="{max(counts, key=counts.get)}"/>'
    zones.insert(0, under)
    credit = f' data-credit="{escape(args.credit)}"' if args.credit else ""
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {PAGE_W} {round(vh * k)}"\n'
           f'     data-title="{escape(args.title)}" data-level="{args.level}"\n'
           f'     data-palette="{" ".join(palette)}"{credit}>\n' + "\n".join(zones) + "\n</svg>\n")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(svg, encoding="utf-8")
    print(f"{args.out}: {len(zones)} zones, {len(palette)} colours, {len(svg) // 1024} KB")


if __name__ == "__main__":
    main()
