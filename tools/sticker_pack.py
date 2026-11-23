"""Make a sticker pack for the free drawing from cut-out pictures (transparent background).

Each picture is cropped to what it shows, scaled down, given the white edge of a die-cut sticker and
written as WebP inside one JSON file, to add on the phone from the grown-ups' corner."""
import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

SCALE = 2  # the edge is worked out at twice the final size, then scaled down, so it comes out smooth
EDGE_GREY = (176, 176, 176)


def grown(alpha, radius):
    """The mask spread by `radius` pixels, with round corners and a soft rim."""
    if radius <= 0:
        return alpha
    blurred = alpha.filter(ImageFilter.GaussianBlur(radius))
    # a pixel `radius` outside a straight edge keeps about 16 % of the mask after this blur
    return blurred.point(lambda v: max(0, min(255, round((v - 26) * 8))))


def make_sticker(path, size, border, shrink):
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A").point(lambda v: 0 if v < 12 else v)
    if shrink > 0:  # shave the rim, where the old background shows through
        alpha = alpha.filter(ImageFilter.GaussianBlur(shrink)).point(lambda v: max(0, min(255, round((v - 128) * 3 + 128))))
    box = alpha.getbbox()
    if box is None:
        raise ValueError("nothing to see in this picture")
    im.putalpha(alpha)
    im = im.crop(box)

    pad = round((border + 1.5) * SCALE) + 2
    inner = size * SCALE - 2 * pad
    k = inner / max(im.size)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    if border > 0:
        alpha = canvas.getchannel("A")
        white = grown(alpha, border * SCALE)
        rim = grown(white, 1.2 * SCALE)
        out = Image.new("RGBA", canvas.size, EDGE_GREY + (0,))
        out.putalpha(rim.point(lambda v: v * 150 // 255))  # a thin grey line, so the white shows on white paper
        sheet = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
        sheet.putalpha(white)
        out.alpha_composite(sheet)
        out.alpha_composite(canvas)
        canvas = out
    canvas = canvas.resize((round(canvas.width / SCALE), round(canvas.height / SCALE)), Image.LANCZOS)
    box = canvas.getchannel("A").getbbox()
    return canvas.crop(box)


def data_url(im, quality):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def preview(stickers, path):
    """The stickers side by side, on white and on blue, to check their edges."""
    h = max(im.height for im in stickers) + 40
    w = sum(im.width + 40 for im in stickers)
    sheet = Image.new("RGBA", (w, 2 * h), (255, 255, 255, 255))
    sheet.paste((70, 120, 200, 255), (0, h, w, 2 * h))
    x = 20
    for im in stickers:
        for row in range(2):
            sheet.alpha_composite(im, (x, row * h + 20))
        x += im.width + 40
    sheet.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pictures", nargs="+", type=Path, help="cut-out pictures with a transparent background (PNG, WebP)")
    ap.add_argument("--out", type=Path, required=True, help="the pack file to write (.json), not overwritten")
    ap.add_argument("--name", default="", help="name of the pack, kept in the file")
    ap.add_argument("--size", type=int, default=512, help="longest side of a sticker in pixels (default 512, at most 640)")
    ap.add_argument("--border", type=float, default=5, help="width of the white edge in pixels, 0 for none (default 5)")
    ap.add_argument("--shrink", type=float, default=1.5,
                    help="pixels shaved off the rim of each picture before anything else, 0 for none (default 1.5)")
    ap.add_argument("--quality", type=int, default=90, help="WebP quality (default 90)")
    ap.add_argument("--preview", type=Path, help="also write the stickers side by side in this PNG file")
    args = ap.parse_args()

    if args.out.exists():
        sys.exit(f"error: {args.out} already exists")
    if not 64 <= args.size <= 640:
        sys.exit("error: --size must be between 64 and 640, the app scales bigger pictures down")
    stickers, entries = [], []
    for path in args.pictures:
        try:
            im = make_sticker(path, args.size, args.border, args.shrink)
        except (OSError, ValueError) as e:
            sys.exit(f"error: {path}: {e}")
        url = data_url(im, args.quality)
        stickers.append(im)
        entries.append({"name": path.stem, "image": url})
        print(f"{path.name}: {im.width} x {im.height}, {len(url) * 3 // 4 // 1024} KB")
    pack = {"app": "giuno-colors", "kind": "stickers", "version": 1, "name": args.name, "stickers": entries}
    args.out.write_text(json.dumps(pack), encoding="utf-8")
    print(f"{args.out}: {len(entries)} stickers, {args.out.stat().st_size // 1024} KB")
    if args.preview:
        preview(stickers, args.preview)


if __name__ == "__main__":
    main()
