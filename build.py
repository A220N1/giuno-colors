"""Build the Giuno Colors site (an installable web app) into a folder ready to publish."""
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
ICONS = ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "logo.svg"]


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


def fill_once(files, name, marker, value):
    text = files[name].decode("utf-8")
    if text.count(marker) != 1:
        sys.exit(f"error: {name} must contain {marker} exactly once")
    files[name] = text.replace(marker, value).encode("utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, required=True, help="folder to write, new or empty")
    ap.add_argument("--drawings", type=Path, default=HERE / "drawings",
                    help="drawings folder: categories.json and one sub-folder of SVG files per category "
                         "(default: drawings/ next to this script)")
    args = ap.parse_args()

    if args.out.exists() and any(args.out.iterdir()):
        sys.exit(f"error: {args.out} is not empty")
    categories = json.loads((args.drawings / "categories.json").read_text(encoding="utf-8"))
    folders = {c["folder"] for c in categories}
    stray = [p for p in args.drawings.rglob("*.svg") if p.parent.parent != args.drawings or p.parent.name not in folders]
    if stray:
        sys.exit("error: drawings outside a category folder of categories.json: "
                 + ", ".join(str(p.relative_to(args.drawings)) for p in stray))

    entries = []
    for cat in categories:
        for path in sorted((args.drawings / cat["folder"]).glob("*.svg")):
            try:
                entry, n_zones, n_colors = load_drawing(path)
            except (ValueError, ET.ParseError) as e:
                sys.exit(f"error: {cat['folder']}/{path.name}: {e}")
            entry["category"] = cat["name"]
            entries.append(entry)
            print(f"{cat['folder']}/{path.name}: {n_zones} zones, {n_colors} colours")
    if not entries:
        sys.exit(f"error: no drawing in {args.drawings}")
    ids = [e["id"] for e in entries]
    if len(set(ids)) != len(ids):
        sys.exit("error: two drawings share a file name: " + ", ".join(sorted({i for i in ids if ids.count(i) > 1})))

    files = {}
    src = HERE / "src"
    for p in sorted(src.rglob("*")):
        if p.is_file():
            files[p.relative_to(src).as_posix()] = p.read_bytes()
    for name in ICONS:
        files[f"icons/{name}"] = (HERE / "icons" / name).read_bytes()
    files["js/drawings-data.js"] = (
        "export const DRAWINGS = " + json.dumps(entries, ensure_ascii=False) + ";\n").encode("utf-8")

    # the version changes only when some file does, so phones download an update only then
    digest = hashlib.sha256(b"".join(k.encode() + v for k, v in sorted(files.items()))).hexdigest()[:8]
    cached = ["./"] + sorted(k for k in files if k != "sw.js")
    fill_once(files, "index.html", "__BUILD__", f"{datetime.now():%d/%m/%Y %H:%M} ({digest})")
    fill_once(files, "sw.js", "__VERSION__", digest)
    fill_once(files, "sw.js", "__FILES__", json.dumps(cached))
    files[".nojekyll"] = b""  # GitHub Pages: serve the files as they are

    for name, data in files.items():
        out = args.out / name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
    size = sum(len(v) for v in files.values())
    print(f"{args.out}: {len(files)} files, {size // 1024} KB, version {digest}")


if __name__ == "__main__":
    main()
