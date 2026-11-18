"""Bundle the coloring app and its drawings into one self-contained HTML file."""
import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"
ZONE_TAGS = {"path", "rect", "circle", "ellipse", "polygon"}
HERE = Path(__file__).resolve().parent


def load_drawing(path):
    """Check one drawing and return its entry for the app, plus zone and colour counts."""
    text = path.read_text(encoding="utf-8")
    root = ET.fromstring(text)
    if root.tag != f"{{{SVG_NS}}}svg":
        raise ValueError("root element is not <svg> in the SVG namespace")
    viewbox = (root.get("viewBox") or "").replace(",", " ").split()
    if len(viewbox) != 4:
        raise ValueError("viewBox must have four numbers")
    palette = (root.get("data-palette") or "").replace(",", " ").split()
    if not palette:
        raise ValueError("data-palette is missing")
    for color in palette:
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise ValueError(f"palette colour {color!r} is not #rrggbb")
    zones = [el for el in root.iter() if el.get("data-c") is not None]
    if not zones:
        raise ValueError("no zone (element with data-c)")
    used = set()
    for el in zones:
        tag = el.tag.split("}")[-1]
        if tag not in ZONE_TAGS:
            raise ValueError(f"<{tag}> cannot be a zone, use one of {sorted(ZONE_TAGS)}")
        c = el.get("data-c")
        if not c.isdigit() or not 1 <= int(c) <= len(palette):
            raise ValueError(f"data-c={c!r} is outside the palette (1 to {len(palette)})")
        used.add(int(c))
    unused = sorted(set(range(1, len(palette) + 1)) - used)
    if unused:
        print(f"warning: {path.name}: colours {unused} have no zone", file=sys.stderr)
    text = re.sub(r"^\s*<\?xml[^>]*\?>\s*", "", text)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]
    return {"id": path.stem, "hash": digest, "svg": text}, len(zones), len(used)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, required=True, help="HTML file to write")
    ap.add_argument("--drawings", type=Path, default=HERE / "drawings",
                    help="folder of SVG drawings (default: drawings/ next to this script)")
    ap.add_argument("--force", action="store_true", help="overwrite --out if it exists")
    args = ap.parse_args()

    if args.out.exists() and not args.force:
        sys.exit(f"error: {args.out} exists (use --force or another path)")
    files = sorted(args.drawings.glob("*.svg"))
    if not files:
        sys.exit(f"error: no .svg in {args.drawings}")

    entries = []
    for path in files:
        try:
            entry, n_zones, n_colors = load_drawing(path)
        except (ValueError, ET.ParseError) as e:
            sys.exit(f"error: {path.name}: {e}")
        entries.append(entry)
        print(f"{path.name}: {n_zones} zones, {n_colors} colours")

    template = (HERE / "app.html").read_text(encoding="utf-8")
    for marker in ("__DRAWINGS__", "__BUILD__"):
        if template.count(marker) != 1:
            sys.exit(f"error: app.html must contain {marker} exactly once")
    # keep the JSON from closing its <script> element early
    payload = json.dumps(entries, ensure_ascii=False).replace("</", "<\\/").replace("<!--", "<\\u0021--")
    stamp = datetime.now().strftime("%d/%m/%Y %H:%M")
    html = template.replace("__DRAWINGS__", payload).replace("__BUILD__", stamp)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    print(f"{args.out} ({args.out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
