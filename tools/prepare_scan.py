"""Prepare a scanned colouring page and its coloured model for from_lineart.py.

The line scan becomes black lines on white, cropped to the drawing; the coloured scan is scaled and
moved so that its black lines fall on those of the line scan (two prints are never framed alike).
Needs Pillow and numpy.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

WORK_W = 500  # width at which the two scans are matched


def grey(path):
    return np.asarray(Image.open(path).convert("L"), dtype=np.float32)


def inked_span(counts, share, gap):
    """First and last index of the run holding the most ink, among indexes over `share` of ink, runs
    split by blanks longer than `gap`: a dark scan edge or a stamp below the drawing is left out."""
    idx = np.where(counts > share)[0]
    runs, start = [], 0
    for i in range(1, len(idx) + 1):
        if i == len(idx) or idx[i] - idx[i - 1] > gap:
            runs.append((idx[start], idx[i - 1]))
            start = i
    return max(runs, key=lambda r: counts[r[0]:r[1] + 1].sum())


def drawing_box(mask, margin, inside_frame=False):
    """Rows and columns holding a fair share of ink: stamps and specks along the edges drop out."""
    h, w = mask.shape
    y0, y1 = inked_span(mask.sum(axis=1), w * 0.004, h * 0.03)
    x0, x1 = inked_span(mask[y0:y1 + 1].sum(axis=0), h * 0.004, w * 0.03)
    y0, y1 = inked_span(mask[:, x0:x1 + 1].sum(axis=1), w * 0.004, h * 0.03)
    # thin ends (a tail, a whip) hold too little ink to count: the box grows while the next line has ink
    cols = mask[y0:y1 + 1].sum(axis=0)
    while x0 > 0 and cols[x0 - 1]:
        x0 -= 1
    while x1 < w - 1 and cols[x1 + 1]:
        x1 += 1
    rows = mask[:, x0:x1 + 1].sum(axis=1)
    while y0 > 0 and rows[y0 - 1]:
        y0 -= 1
    while y1 < h - 1 and rows[y1 + 1]:
        y1 += 1
    if inside_frame:
        return frame_inside(mask, x0, y0, x1, y1)
    return max(0, x0 - margin), max(0, y0 - margin), min(w, x1 + margin + 1), min(h, y1 + margin + 1)


def frame_inside(mask, x0, y0, x1, y1):
    """The box shrunk past the frame drawn around a picture, so the page edge becomes the frame and the
    colours that overflow it in the coloured print are cut off with it."""
    band_y, band_x = max(4, (y1 - y0) // 30), max(4, (x1 - x0) // 30)
    def last_inked(lines, n):
        hits = [i for i, v in enumerate(lines[:n]) if v > 0.3]
        return hits[-1] + 3 if hits else 0
    top = last_inked(mask[y0:y1 + 1, x0:x1 + 1].mean(axis=1), band_y)
    bottom = last_inked(mask[y0:y1 + 1, x0:x1 + 1].mean(axis=1)[::-1], band_y)
    left = last_inked(mask[y0:y1 + 1, x0:x1 + 1].mean(axis=0), band_x)
    right = last_inked(mask[y0:y1 + 1, x0:x1 + 1].mean(axis=0)[::-1], band_x)
    if not (top and bottom and left and right):
        sys.exit("error: no frame found around the picture")
    return x0 + left, y0 + top, x1 - right + 1, y1 - bottom + 1


def shift_score(a, b):
    """Best translation of b over a by cross-correlation (FFT), with its score."""
    h, w = a.shape
    fa = np.fft.rfft2(a, s=(2 * h, 2 * w))
    fb = np.fft.rfft2(b, s=(2 * h, 2 * w))
    corr = np.fft.irfft2(fa * np.conj(fb), s=(2 * h, 2 * w))
    i = np.unravel_index(np.argmax(corr), corr.shape)
    dy = i[0] if i[0] < h else i[0] - 2 * h
    dx = i[1] if i[1] < w else i[1] - 2 * w
    return corr[i] / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9), dx, dy


def register(line_mask, colour_mask):
    """Scale and offset (in line-scan pixels) putting the coloured scan's ink on the line scan's."""
    f = WORK_W / line_mask.shape[1]
    small = lambda m, k: np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(
        (max(1, round(m.shape[1] * k)), max(1, round(m.shape[0] * k))), Image.BILINEAR), dtype=np.float32) / 255
    a = small(line_mask, f)
    best = None
    base = line_mask.shape[1] / colour_mask.shape[1]
    for s in np.linspace(0.85, 1.15, 61):
        b = small(colour_mask, f * base * s)
        score, dx, dy = shift_score(a, b)
        if best is None or score > best[0]:
            best = (score, base * s, dx / f, dy / f)
    return best


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--lines", type=Path, required=True, help="scan of the line drawing")
    ap.add_argument("--colours", type=Path, required=True, help="scan of the same drawing coloured")
    ap.add_argument("--out-lines", type=Path, required=True)
    ap.add_argument("--out-colours", type=Path, required=True)
    ap.add_argument("--ink", type=float, default=110, help="grey level under which a pixel is ink")
    ap.add_argument("--blank", type=int, nargs=4, action="append", default=[], metavar=("X0", "Y0", "X1", "Y1"),
                    help="area of the line scan to whiten first (a caption, a stamp); may be repeated")
    ap.add_argument("--inside-frame", action="store_true", help="crop inside the frame drawn around the picture")
    args = ap.parse_args()

    g = grey(args.lines)
    for x0, y0, x1, y1 in args.blank:
        g[y0:y1, x0:x1] = 255
    ink = (g < args.ink).astype(np.float32)
    x0, y0, x1, y1 = drawing_box(ink, margin=12, inside_frame=args.inside_frame)
    cg = grey(args.colours)
    score, s, dx, dy = register(ink, (cg < args.ink).astype(np.float32))
    print(f"coloured scan: scale {s:.4f}, offset {dx:.1f}, {dy:.1f}, match {score:.3f}")

    lines = np.where(ink > 0, 0, 255).astype(np.uint8)[y0:y1, x0:x1]
    Image.fromarray(lines).save(args.out_lines)
    colour = Image.open(args.colours).convert("RGB")
    colour = colour.resize((round(colour.width * s), round(colour.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", (g.shape[1], g.shape[0]), "white")
    canvas.paste(colour, (round(dx), round(dy)))
    canvas.crop((x0, y0, x1, y1)).save(args.out_colours)
    print(f"{args.out_lines}: {x1 - x0} x {y1 - y0}")


if __name__ == "__main__":
    main()
