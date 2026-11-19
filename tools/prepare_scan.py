"""Prepare a scanned colouring page and its coloured model for from_lineart.py.

The line scan becomes black lines on white, cropped to the drawing; the coloured scan is scaled and
moved so that its black lines fall on those of the line scan (two prints are never framed alike).
Needs Pillow, numpy and scipy.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

WORK_W = 500  # width at which the two scans are matched
SHAPE_SHARE = 0.03  # a shape of ink lighter than this share of the heaviest is not part of the drawing
FRAME_ZONE = 0.3  # share of the scan, from each edge, where a frame drawn round the picture is looked for


def grey(path):
    return np.asarray(Image.open(path).convert("L"), dtype=np.float32)


def drawing_box(mask, margin):
    """Box around the shapes of ink that weigh at least SHAPE_SHARE of the heaviest one, leaving out
    those that touch the edge of the scan (its dark border): stamps, specks and shelf marks drop out,
    while every object of a page of separate objects stays in."""
    h, w = mask.shape
    lab, n = ndimage.label(ndimage.binary_dilation(mask > 0, iterations=4))
    weights = ndimage.sum(mask, lab, range(1, n + 1))
    # each shape's box around its ink itself, so that thickening the lines to join them up does not
    # make a shape near the edge of the scan touch it
    boxes = ndimage.find_objects(np.where(mask > 0, lab, 0), max_label=n)
    inner = [i for i, sl in enumerate(boxes) if sl and sl[0].start > 0 and sl[1].start > 0 and sl[0].stop < h and sl[1].stop < w]
    if not inner:
        inner = [i for i, sl in enumerate(boxes) if sl]
    heaviest = max(weights[i] for i in inner)
    keep = [i for i in inner if weights[i] >= SHAPE_SHARE * heaviest]
    y0 = min(boxes[i][0].start for i in keep)
    y1 = max(boxes[i][0].stop for i in keep) - 1
    x0 = min(boxes[i][1].start for i in keep)
    x1 = max(boxes[i][1].stop for i in keep) - 1
    return max(0, x0 - margin), max(0, y0 - margin), min(w, x1 + margin + 1), min(h, y1 + margin + 1)


def frame_inside(mask):
    """The box just inside the frame drawn around a picture: from each edge of the scan, past the first
    band of lines with a fair share of ink, after a dark border along the edge of the scan if there is
    one. The page edge becomes the frame, and the colours that overflow it in the coloured print go."""
    h, w = mask.shape
    def past_frame(cover):
        inked = cover[:int(len(cover) * FRAME_ZONE)] > 0.2
        i = 0
        while i < len(inked) and inked[i]:
            i += 1
        while i < len(inked) and not inked[i]:
            i += 1
        if i == len(inked):
            sys.exit("error: no frame found around the picture")
        while i < len(inked) and inked[i]:
            i += 1
        return i + 4
    rows, cols = mask.mean(axis=1), mask.mean(axis=0)
    return past_frame(cols), past_frame(rows), w - past_frame(cols[::-1]), h - past_frame(rows[::-1])


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
    x0, y0, x1, y1 = frame_inside(ink) if args.inside_frame else drawing_box(ink, margin=12)
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
