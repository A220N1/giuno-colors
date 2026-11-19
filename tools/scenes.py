"""Write the OpenMoji scenes of Giuno Colors into drawings/<category>/ (layouts in an 800 x 1000 frame)."""
import argparse
from pathlib import Path

from make_drawing import make
from make_sample_drawings import cloud, ellipse, star

DARK = "#3a3a3a"


def rect(x, y, w, h):
    return f"M{x} {y}H{x + w}V{y + h}H{x}Z"


def zone(d, color):
    return {"d": d, "color": color}


def line(d, color=DARK, width=6):
    return {"d": d, "fill": "none", "stroke": color, "stroke-width": width,
            "stroke-linecap": "round", "stroke-linejoin": "round"}


def emo(code, cx, h=None, w=None, cy=None, bottom=None, flip=False, **extra):
    layer = {"emoji": code, "cx": cx, "flip": flip, **extra}
    layer.update({"h": h} if h is not None else {"w": w})
    layer.update({"cy": cy} if cy is not None else {"bottom": bottom})
    return layer


def sun(cx, cy, r, color="#FFD23F"):
    return zone(ellipse(cx, cy, r), color)


def birds(*spots):
    return [line(f"M{x} {y}q{s} -{s} {2 * s} 0q{s} -{s} {2 * s} 0", width=5) for x, y, s in spots]


SKY = "#9ED8FF"
NIGHT = "#1E2A4A"


def tree(cx, h, bottom):
    """OpenMoji tree with a trunk to colour behind its outline."""
    w, top = 0.11 * h, bottom - 0.42 * h
    trunk = f"M{cx - w / 2:.0f} {bottom}L{cx - w * 0.32:.0f} {top:.0f}L{cx + w * 0.32:.0f} {top:.0f}L{cx + w / 2:.0f} {bottom}Z"
    return [zone(trunk, "#8D5A35"), emo("1F333", cx, h=h, bottom=bottom)]


def puff(d):
    """White shape with a soft outline, already coloured (clouds, bubbles)."""
    return {"d": d, "fill": "#ffffff", "stroke": "#a9b8c8", "stroke-width": 3}


def stars(*spots):
    return [emo("2B50", x, h=h, cy=y) for x, y, h in spots]


SCENES = {
    "animaux/10_lion": {
        "title": "Le lion",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(655, 150, 80),
            puff(cloud(230, 230, 220)),
            *birds((470, 170, 14), (540, 130, 11)),
            zone("M0 600C200 560 520 590 800 550L800 1000L0 1000Z", "#E9C46A"),
            *tree(150, 300, 640),
            zone("M0 790C260 750 560 815 800 770L800 1000L0 1000Z", "#C9973F"),
            emo("1F981", 490, h=440, bottom=940),
        ],
    },
    "animaux/11_tortue": {
        "title": "La tortue",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(650, 140, 70),
            puff(cloud(250, 200, 200)),
            zone("M0 420C200 400 600 440 800 410L800 1000L0 1000Z", "#4FA3E0"),
            emo("26F5", 560, h=200, bottom=470, recolor={"#92d3f5": "#4FA3E0"}),
            zone("M0 640C220 600 560 670 800 620L800 1000L0 1000Z", "#E8C887"),
            emo("1F422", 400, h=300, bottom=900),
            emo("1F980", 660, h=140, bottom=965),
            emo("1F41A", 130, h=130, bottom=965),
        ],
    },
    "animaux/12_chouette": {
        "title": "La chouette",
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            emo("1F319", 610, h=220, cy=170),
            *stars((150, 120, 70), (300, 260, 50), (720, 400, 55), (90, 340, 45)),
            zone("M0 820C220 770 560 800 800 760L800 1000L0 1000Z", "#3E6B48"),
            *tree(340, 760, 960),
            emo("1F989", 360, h=330, cy=540),
        ],
    },
    "animaux/13_dinosaure": {
        "title": "Le dinosaure",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            emo("2604", 620, h=180, cy=160),
            zone("M0 560L140 380L280 520L420 330L600 560L720 420L800 500L800 1000L0 1000Z", "#9C7B5B"),
            zone("M0 700C250 660 550 720 800 680L800 1000L0 1000Z", "#8BC34A"),
            *tree(110, 280, 760),
            *tree(735, 200, 735),
            emo("1F996", 380, h=520, bottom=950),
        ],
    },
    "vehicules/20_train": {
        "title": "Le train",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(130, 140, 70),
            puff(cloud(520, 180, 200)),
            puff(cloud(700, 300, 140)),
            zone("M0 560C200 500 420 540 560 520C660 505 740 520 800 500L800 1000L0 1000Z", "#8BC34A"),
            *tree(660, 260, 600),
            zone(rect(0, 690, 800, 60), "#B08D6B"),
            line("M0 704H800", width=5), line("M0 736H800", width=5),
            emo("1F682", 400, w=640, bottom=712),
            zone(rect(0, 750, 800, 250), "#5C9E31"),
            emo("1F337", 120, h=150, bottom=960),
            emo("1F337", 300, h=130, bottom=985),
            emo("1F337", 680, h=150, bottom=970),
        ],
    },
    "vehicules/21_fusee": {
        "title": "La fusée",
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            emo("1F319", 160, h=200, cy=170),
            emo("1FA90", 620, h=260, cy=800),
            *stars((560, 120, 60), (720, 260, 45), (90, 480, 50), (300, 880, 55), (680, 560, 40)),
            emo("1F680", 400, h=560, cy=470),
        ],
    },
    "vehicules/22_voilier": {
        "title": "Le voilier",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(640, 150, 75),
            puff(cloud(230, 180, 220)),
            puff(cloud(600, 330, 150)),
            zone("M0 560C220 540 580 580 800 550L800 1000L0 1000Z", "#4FA3E0"),
            emo("26F5", 380, h=480, bottom=700, recolor={"#92d3f5": "#4FA3E0"}),
            zone("M0 700C200 670 600 720 800 690L800 1000L0 1000Z", "#2F7FC1"),
            emo("1F433", 600, h=220, bottom=930),
            emo("1F41F", 190, h=110, cy=880),
        ],
    },
    "vehicules/23_pompiers": {
        "title": "Les pompiers",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(680, 130, 65),
            puff(cloud(380, 170, 200)),
            zone("M0 600C250 570 550 610 800 580L800 1000L0 1000Z", "#7FB04B"),
            emo("1F3E0", 250, h=380, bottom=700),
            *tree(640, 320, 680),
            zone(rect(0, 740, 800, 180), "#8C8C8C"),
            {**line("M20 830H780", "#FFFFFF", 8), "stroke-dasharray": "40 30"},
            emo("1F692", 460, w=560, bottom=880),
            zone(rect(0, 920, 800, 80), "#5C9E31"),
        ],
    },
    "nature/30_jardin": {
        "title": "Le jardin",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(680, 130, 70),
            puff(cloud(250, 170, 200)),
            zone("M0 520C250 490 550 530 800 500L800 1000L0 1000Z", "#B1CC33"),
            *[zone(rect(30 + 130 * k, 450, 70, 170), "#E0C097") for k in range(6)],
            zone(rect(0, 500, 800, 30), "#A57939"),
            emo("1F337", 110, h=260, bottom=760),
            emo("1F337", 240, h=230, bottom=790),
            emo("1F33B", 660, h=380, bottom=760),
            emo("1F33B", 520, h=300, bottom=800),
            zone("M0 780C250 750 550 800 800 760L800 1000L0 1000Z", "#5C9E31"),
            emo("1F344", 150, h=150, bottom=960),
            emo("1F40C", 400, h=140, bottom=955),
            emo("1F41E", 650, h=110, bottom=960),
            emo("1F98B", 380, h=200, cy=330),
            emo("1F41D", 560, h=120, cy=250),
        ],
    },
    "fetes/40_anniversaire": {
        "title": "L'anniversaire",
        "layers": [
            zone(rect(0, 0, 800, 1000), "#F9D9E3"),
            line("M20 90Q400 260 780 90", width=4),
            *[zone(f"M{x - 32} {y}L{x + 32} {y}L{x} {y + 70}Z", c) for x, y, c in [
                (90, 118, "#E8483B"), (200, 160, "#FFD23F"), (310, 182, "#4FA3E0"), (420, 186, "#5CBF60"),
                (530, 172, "#E8483B"), (640, 140, "#FFD23F"), (740, 105, "#4FA3E0")]],
            *stars((120, 380, 70), (690, 400, 60)),
            zone(rect(40, 760, 720, 40), "#C68B59"),
            zone(rect(70, 800, 660, 200), "#BDE6FF"),
            emo("1F382", 400, h=400, bottom=770),
            emo("1F368", 150, h=220, bottom=770),
            emo("1F353", 630, h=120, bottom=770),
            emo("1F353", 710, h=100, bottom=770),
        ],
    },
    "magie/50_licorne": {
        "title": "La licorne",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            emo("1F308", 500, w=600, bottom=790),
            puff(cloud(170, 170, 200)),
            *stars((110, 380, 60), (230, 560, 45), (90, 640, 40)),
            zone("M0 760C250 720 550 770 800 730L800 1000L0 1000Z", "#A5D86E"),
            emo("1F984", 460, h=520, bottom=950, recolor={"#ffffff": "#fce4f1"}),
            emo("1F337", 110, h=130, bottom=960),
            emo("1F337", 720, h=120, bottom=970),
        ],
    },
    "magie/51_chateau": {
        "title": "Le château",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(130, 140, 70),
            puff(cloud(520, 120, 200)),
            emo("1F409", 590, h=190, cy=250, flip=True),
            zone("M0 690C180 630 400 650 560 690C660 715 740 690 800 670L800 1000L0 1000Z", "#7FB04B"),
            emo("1F3F0", 380, h=440, bottom=760),
            zone("M0 820C230 780 520 830 800 790L800 1000L0 1000Z", "#5C9E31"),
            zone("M330 1000C350 920 380 860 400 760L440 760C450 860 500 920 540 1000Z", "#D9B98A"),
        ],
    },
    "scenes/60_mer": {
        "title": "Sous la mer",
        "layers": [
            zone(rect(0, 0, 800, 1000), "#92D3F5"),
            zone("M0 300C250 280 550 320 800 290L800 1000L0 1000Z", "#4FA3E0"),
            zone("M0 600C250 580 550 620 800 590L800 1000L0 1000Z", "#1E63A8"),
            emo("1F433", 560, h=190, cy=140),
            emo("1F422", 230, h=150, cy=200),
            emo("1F41F", 200, h=100, cy=360),
            emo("1F41F", 640, h=90, cy=430, flip=True),
            emo("1F420", 400, h=140, cy=470),
            emo("1F420", 170, h=110, cy=640, flip=True),
            zone("M0 860C220 830 560 880 800 840L800 1000L0 1000Z", "#E8C887"),
            emo("1FAB8", 110, h=260, bottom=910),
            emo("1FAB8", 700, h=220, bottom=900),
            emo("1F419", 450, h=290, bottom=890),
            emo("1F980", 250, h=110, bottom=980),
            emo("1F41A", 610, h=100, bottom=980),
            *[puff(ellipse(x, y, r)) for x, y, r in [(690, 560, 18), (712, 515, 13), (728, 478, 10),
                                                                 (330, 300, 14), (345, 265, 10)]],
        ],
    },
    "scenes/61_ferme": {
        "title": "La ferme",
        "layers": [
            zone(rect(0, 0, 800, 1000), SKY),
            sun(130, 120, 65),
            puff(cloud(520, 140, 200)),
            puff(cloud(700, 250, 130)),
            zone("M0 430C200 380 420 410 560 400C680 390 750 380 800 370L800 1000L0 1000Z", "#A5D86E"),
            emo("1F3E0", 560, h=260, bottom=500),
            *tree(150, 260, 520),
            *tree(760, 170, 470),
            zone("M0 560C220 520 520 570 800 530L800 1000L0 1000Z", "#7FB04B"),
            emo("1F69C", 220, w=260, bottom=660),
            emo("1F404", 560, w=300, bottom=730),
            zone("M0 760C260 730 560 780 800 740L800 1000L0 1000Z", "#5C9E31"),
            emo("1F416", 360, w=220, bottom=910),
            emo("1F411", 660, w=200, bottom=920),
            emo("1F414", 130, h=170, bottom=950),
        ],
    },
    "scenes/62_espace": {
        "title": "Dans l'espace",
        "layers": [
            zone(rect(0, 0, 800, 1000), NIGHT),
            *stars((80, 90, 45), (330, 70, 55), (740, 80, 40), (420, 380, 45), (90, 700, 50), (740, 640, 45),
                   (300, 950, 40)),
            emo("1F319", 620, h=170, cy=160),
            emo("2604", 420, h=150, cy=200),
            emo("1FA90", 170, h=220, cy=300),
            emo("1F6F8", 620, h=150, cy=450),
            emo("1F680", 330, h=380, cy=620),
            emo("1F30D", 640, h=300, cy=820),
        ],
    },
}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sources", type=Path, help="folder of OpenMoji colour SVGs named <hexcode>.svg")
    ap.add_argument("--out", type=Path, help="drawings folder (one sub-folder per category)")
    ap.add_argument("--only", nargs="*", help="scene names to write, such as animaux/10_lion")
    ap.add_argument("--list-emoji", action="store_true", help="print the OpenMoji codes the scenes use, then stop")
    args = ap.parse_args()
    if args.list_emoji:
        print(" ".join(sorted({layer["emoji"] for scene in SCENES.values() for layer in scene["layers"] if "emoji" in layer})))
        return
    if not args.sources or not args.out:
        ap.error("--sources and --out are required")
    for name, scene in SCENES.items():
        if args.only and name not in args.only:
            continue
        spec = {"viewBox": [0, 0, 800, 1000], "lineWidth": 6, "maxColors": 12, "minArea": 150, **scene}
        svg, zones, colors, level, merges = make(spec, args.sources)
        out = args.out / f"{name}.svg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(svg, encoding="utf-8")
        print(f"{name}: {zones} zones, {colors} colours, level {level}")
        for c, rep in merges:
            print(f"    {c} drawn as {rep}")


if __name__ == "__main__":
    main()
