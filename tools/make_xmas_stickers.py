"""Write the Christmas stickers drawn for the app, in the OpenMoji style: a 72 x 72 grid, flat colours
from the OpenMoji palette and black outlines 2 units wide with round ends."""
import argparse
from pathlib import Path

RED, DARK_RED = "#EA5A47", "#D22F27"
GREEN, LIGHT_GREEN = "#5C9E31", "#B1CC33"
YELLOW, GOLD = "#FCEA2B", "#F1B31C"
BROWN, DARK_BROWN = "#A57939", "#6A462F"
BLUE = "#92D3F5"
WHITE, GREY, BLACK = "#FFFFFF", "#D0CFCE", "#000000"


def shape(d, fill, width=2):
    """A filled path with its outline."""
    return f'<path fill="{fill}" stroke="{BLACK}" stroke-width="{width}" d="{d}"/>'


def flat(d, fill):
    return f'<path fill="{fill}" d="{d}"/>'


def line(d, stroke=BLACK, width=2, extra=""):
    return f'<path fill="none" stroke="{stroke}" stroke-width="{width}"{extra} d="{d}"/>'


def tube(d, colour, width):
    """A thick line with an outline: the union of several of them reads as one outlined shape."""
    return [line(d, BLACK, width + 4), line(d, colour, width)]


def tubes(ds, colour, width):
    """Thick lines merged into one shape: all the outlines first, then all the colours."""
    return [line(d, BLACK, width + 4) for d in ds] + [line(d, colour, width) for d in ds]


def circle(cx, cy, r, fill, outline=True):
    stroke = f' stroke="{BLACK}" stroke-width="2"' if outline else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{stroke}/>'


def rect(x, y, w, h, fill, rx=0):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{BLACK}" stroke-width="2"/>'


def chalet():
    return [
        rect(45, 13, 7, 14, RED),
        rect(43.5, 9.5, 10, 4.5, WHITE, 2.2),
        shape("M16 60V38L36 21l20 17v22z", BROWN),
        line("M17 46h7M48 56h7M17 53h4M50 42h5", DARK_BROWN, 1.6),
        shape("M36 9L4 37c2 3.5 5 3.5 7 .5c1.5 3 5 3 6.5-.5L36 21l18.5 16c1.5 3.5 5 3.5 6.5.5c2 3 5 3 7-.5z", WHITE),
        circle(36, 31.5, 3.2, YELLOW),
        rect(22, 46, 9, 14, DARK_BROWN),
        circle(28.4, 53.5, 0.9, GOLD, False),
        rect(37, 44, 12, 9.5, YELLOW),
        line("M43 44v9.5M37 48.750h12", BLACK, 1.6),
        shape("M5 63c6-5 14-5.5 21-3c9-4.5 28-4 41 3z", WHITE),
    ]


def elf():
    return [
        shape("M15 63c0-8 6-13 13-13h16c7 0 13 5 13 13z", GREEN),
        shape("M24 50l4 7 4-5 4 6 4-6 4 5 4-7z", RED),
        shape("M24 35.5L14 30l9.5 13.5z", YELLOW),
        shape("M48 35.5L58 30l-9.5 13.5z", YELLOW),
        circle(36, 38, 13, YELLOW),
        shape("M21.5 30C22 17 31 7 43 7c9 0 15 5 16 13c-4-4-8-5-11-3c2 4 2.5 9 2.5 13z", GREEN),
        rect(19, 26.5, 34, 6.5, RED, 3.2),
        circle(59, 22, 3.6, GOLD),
        circle(31, 39, 2, BLACK, False),
        circle(41, 39, 2, BLACK, False),
        line("M30 44.5q6 5 12 0"),
    ]


def snowy_fir():
    return [
        rect(33, 57, 6, 7, BROWN),
        shape("M36 8L25 25h5L19 41h6L13 58h46L47 41h6L42 25h5z", GREEN),
        shape("M36 8l-6.5 10q3.2 3 6.5 0q3.3 3 6.5 0z", WHITE),
        shape("M30 25l-3.5 5.5q3 2.5 6 0q3.5 3 7 0q3 2.5 6 0L42 25z", WHITE),
        shape("M25 41l-3.8 6q3.5 3 7.2 0q3.8 3 7.6 0q3.8 3 7.6 0q3.7 3 7.2 0L47 41z", WHITE),
    ]


def santa_hat():
    return [
        shape("M14 49C14 28 24 12 40 12c12 0 20 10 20 24c-4-6-9-8-13-7c4 5 7 13 7 20z", RED),
        flat("M40 13c11 0 19 9 19.5 21c-4-5-9-6.5-13-6C44 22 43 17 40 13z", DARK_RED),
        line("M14 49C14 28 24 12 40 12c12 0 20 10 20 24c-4-6-9-8-13-7c4 5 7 13 7 20"),
        rect(9, 46, 50, 12, WHITE, 6),
        circle(60, 39, 5.5, WHITE),
    ]


def candy_cane():
    d = "M26 62V27a11 11 0 0 1 22 0v5"
    return [
        '<g transform="rotate(14 36 36)">',
        line(d, BLACK, 13),
        line(d, WHITE, 9),
        line(d, RED, 9, ' stroke-linecap="butt" stroke-dasharray="5 6.2" stroke-dashoffset="-3"'),
        "</g>",
    ]


def gingerbread():
    body = ["M19 34h34", "M36 27v18", "M36 45l-9 13", "M36 45l9 13"]
    return [
        *tubes(body, BROWN, 9),
        line("M36 28v16", BROWN, 14),
        circle(36, 18, 9.5, BROWN),
        circle(32.5, 16.5, 1.5, BLACK, False),
        circle(39.5, 16.5, 1.5, BLACK, False),
        line("M32 21q4 3.5 8 0", BLACK, 1.6),
        circle(36, 34, 2, RED, False),
        circle(36, 41, 2, GREEN, False),
        line("M18.5 30.5l2.5 3-2.5 3M53.5 30.5l-2.5 3 2.5 3M24.5 54l3.5 1 1.5 3.5M47.5 54l-3.5 1-1.5 3.5", WHITE, 1.8),
    ]


def bauble():
    return [
        line("M36 13.5a3.5 3.5 0 1 0-.010 0"),
        circle(36, 41, 20, RED),
        flat("M49.5 27.5a19 19 0 0 1-13.5 32.5a24 24 0 0 0 13.5-32.5z", DARK_RED),
        line("M18 41l5.2-4 5.2 4 5.2-4 5.2 4 5.2-4 5.2 4 4.8-3.7", WHITE, 2.6),
        circle(23.2, 47.5, 1.7, YELLOW, False),
        circle(33.6, 47.5, 1.7, YELLOW, False),
        circle(44, 47.5, 1.7, YELLOW, False),
        rect(31, 15.5, 10, 6.5, GOLD, 1.5),
    ]


def stocking():
    return [
        line("M27 16c-6-7-11-1-4 4"),
        shape("M26 22h18v18l11.5 8.5a8.5 8.5 0 0 1-9.5 14L29 53a6 6 0 0 1-3-5z", RED),
        flat("M55.5 48.5a8.5 8.5 0 0 1-9.5 14l-3.5-2c5-1 8-5 7-12z", GREEN),
        line("M26 22h18v18l11.5 8.5a8.5 8.5 0 0 1-9.5 14L29 53a6 6 0 0 1-3-5z"),
        circle(35, 32, 1.6, WHITE, False),
        circle(31, 43, 1.6, WHITE, False),
        circle(39.5, 45, 1.6, WHITE, False),
        circle(40, 36.5, 1.2, WHITE, False),
        rect(23, 14, 24, 10, WHITE, 3.5),
    ]


def sleigh():
    return [
        rect(21, 22, 13, 19, LIGHT_GREEN),
        line("M27.5 22v19M21 30h13", GOLD, 2),
        line("M27.5 22c-5-6-8-1-3 0zM27.5 22c5-6 8-1 3 0z", BLACK, 1.6),
        rect(34, 28, 10, 13, BLUE),
        line("M39 28v13M34 34h10", RED, 2),
        line("M14 59c-4 0-6-3-4-6M14 59h42c4 0 6-2 6-5M26 50v9M44 50v9"),
        shape("M12 28c4-4 8-2 8 4v8h22l6-14h10c0 14-4 24-12 24H22c-8 0-12-8-10-22z", RED),
        line("M15.5 44.5h37", YELLOW, 2.6),
    ]


def wreath():
    import math
    puffs = [(36 + 16 * math.cos(a), 37 + 16 * math.sin(a)) for a in (i * math.pi / 6 for i in range(12))]
    out = [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="{BLACK}"/>' for x, y in puffs]
    out += [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{GREEN}"/>' for x, y in puffs]
    berries = [(24.5, 26), (47, 25), (52.5, 40), (20, 41), (36, 20.5)]
    out += [circle(x, y, 2.1, RED, False) for x, y in berries]
    out += [
        shape("M36 54l-10-5.5v11z", RED),
        shape("M36 54l10-5.5v11z", RED),
        shape("M34 56l-5 8.5 4.5-1 1.5 3.5 3-9z", RED),
        shape("M38 56l5 8.5-4.5-1-1.5 3.5-3-9z", RED),
        circle(36, 54, 3, RED),
    ]
    return out


def holly():
    leaf = "M0 0Q-3-4-9-4Q-6-9-10.5-14Q-5-17-7.5-23Q-2-24.5 0-32Q2-24.5 7.5-23Q5-17 10.5-14Q6-9 9-4Q3-4 0 0z"
    out = []
    for angle in (-58, 58, 0):
        out += [f'<g transform="translate(36 44) rotate({angle})">', shape(leaf, GREEN), line("M0-4v-21", BLACK, 1.4), "</g>"]
    for x, y in ((30, 49), (42, 49), (36, 56)):
        out += [circle(x, y, 5.2, RED), circle(x - 1.6, y - 1.8, 1.1, WHITE, False)]
    return out


def reindeer():
    antlers = ["M29 27C28 20 24 14 19 10", "M26.5 19.5l-8.5.5", "M22.5 13.5L23 6",
               "M43 27c1-7 5-13 10-17", "M45.5 19.5l8.5.5", "M49.5 13.5L49 6"]
    return [
        *tubes(antlers, DARK_BROWN, 2.4),
        shape("M24 34c-6-5-12-4-14 0c2 4 8 6 14 5z", BROWN),
        shape("M48 34c6-5 12-4 14 0c-2 4-8 6-14 5z", BROWN),
        shape("M36 25c-9 0-14 6-14 14c0 6 3 10 5 14c2 5 5 9 9 9s7-4 9-9c2-4 5-8 5-14c0-8-5-14-14-14z", BROWN),
        flat("M36 47c-5 0-8 3-8 7c1.5 4 4.5 7 8 7s6.5-3 8-7c0-4-3-7-8-7z", "#E0BB95"),
        circle(30, 39, 2.1, BLACK, False),
        circle(42, 39, 2.1, BLACK, False),
        circle(36, 51, 5, RED),
        circle(34.3, 49.2, 1.2, WHITE, False),
    ]


STICKERS = {
    "xmas-chalet": chalet, "xmas-elf": elf, "xmas-snowy-fir": snowy_fir, "xmas-santa-hat": santa_hat,
    "xmas-candy-cane": candy_cane, "xmas-gingerbread": gingerbread, "xmas-bauble": bauble, "xmas-stocking": stocking,
    "xmas-sleigh": sleigh, "xmas-wreath": wreath, "xmas-holly": holly, "xmas-reindeer": reindeer,
}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("out", type=Path, help="folder to write the SVG files into")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for name, draw in STICKERS.items():
        body = "\n    ".join(draw())
        svg = (f'<svg width="72" height="72" id="emoji" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">\n'
               f'  <g stroke-linecap="round" stroke-linejoin="round">\n    {body}\n  </g>\n</svg>\n')
        (args.out / f"{name}.svg").write_text(svg, encoding="utf-8")
        print(f"{name}.svg")


if __name__ == "__main__":
    main()
