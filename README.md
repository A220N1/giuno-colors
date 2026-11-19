<img src="icons/logo.svg" alt="Giuno Colors logo" width="220">

# Giuno Colors

Color by number for children, and a blank page to draw on. It is a web app that installs on a phone like any other app and keeps working offline. The interface is in French by default and in English on request: the FR / EN switch at the top of the start screen changes it, and the phone remembers the choice for the next time.

Use it at https://a220n1.github.io/giuno-colors/ and add it to the home screen from the browser menu.

## What it does

- 59 drawings in nine categories, from 12 zones for a young child to about 500 in the big coloring pages, whose details only show once zoomed in. Nine of them are traced from public-domain paintings and prints (Hokusai, Hiroshige, Audubon), and 25 from Jean Matet's coloring albums of the 1920s, with the colors of their printed models.
- Pick a color, then tap the zones that carry its number; they show a checkerboard until they are filled. Holding a zone picks its color.
- Pinch to zoom and drag to move. Numbers too small to read appear as you zoom in, and the magnifier jumps to a zone that is left.
- A blank page for free drawing, with ten kinds of brush (felt pen, pen, pencil, pastel, paintbrush, glitter, neon, a trail of hearts, grass that grows up from the stroke and puffy clouds), a paint bucket for closed areas, an eraser, a finger that spreads the paint it is dragged through, five shapes, 48 stickers (clouds and tufts of grass in the color in use, OpenMoji emojis and the profile animals), four line sizes, 16 colors and a pastel rainbow. A rainbow stroke changes hue along its length and leaves a trail of twinkling stars while it is drawn; the paint bucket and the shapes fill or outline in a rainbow gradient. A mirror repeats every stroke, shape, eraser stroke and fill on the other side of the page, in its four quarters, or six times round the middle like a kaleidoscope, with its axes shown as dashed lines. The page can be white or colored paper, a starry night sky, squared or dotted paper. Two fingers zoom in on the page. A replay button draws the picture again, stroke by stroke, in a few seconds. Undo and redo reach back to the first stroke, even after the drawing was closed. Each child's drawings come first in the gallery.
- Any coloring page can also be painted freely with these tools: its outlines stay on top of the paint and hold the paint bucket.
- A padlock on the coloring and drawing screens hides the buttons that leave the drawing and stops the phone's Back gesture from leaving it. Holding the padlock for a little over a second unlocks it. The app cannot block the home button: Android's app pinning does that.
- Each child gets a profile with its own animal, progress and drawings. There are 15 animals to pick from. Progress, profiles and the language are kept in the browser's localStorage, drawings in its IndexedDB. The grown-ups' corner at the bottom of the gallery saves all of it in a JSON file and puts it back from such a file, for instance on a new phone. It can also add a color-by-number page from an SVG file in the format below: the page stays on that phone, first in the gallery, and only its shapes, groups, gradients and their drawing attributes are kept, so a file cannot run anything in the app. Holding its card removes it. With more than 12 colors, the palette scrolls on one row.
- A drawing can be shared or saved as a PNG image.

## Build

The build needs Python 3 and nothing else.

```sh
python3 build.py --out site
```

This writes the app (HTML, CSS, JavaScript modules, manifest, service worker, icons and drawings) into a new or empty folder. The version number shown at the bottom of the gallery, with the build date, comes from the `VERSION` file; the service worker's cache name is a hash of the files, so phones only download an update when something changed. Service workers and installation need HTTPS or `localhost`, so try it through a local server:

```sh
python3 -m http.server --directory site 8000
```

## Drawings

Drawings are SVG files grouped by category. `drawings/categories.json` lists the categories in gallery order, each with its folder and the name shown in the app, and each folder holds the drawings of its category. `drawings/english.json` gives the English name of each category (by folder) and the English title of each drawing (by file name). These names live outside the SVG files because the app keys a child's progress on the content of the file: editing a drawing starts it over.

The root `<svg>` of a drawing has a `viewBox`, a `data-title`, a `data-level` (1 easy, 2 medium, 3 hard) and a `data-palette` listing `#rrggbb` colors. Any `path`, `rect`, `circle`, `ellipse` or `polygon` with `data-c="n"` is a zone to fill with palette color `n`, counted from 1. Later zones may cover earlier ones. Other elements are drawn as they are and do not react to taps. A zone that cannot be seen, or that stays too small to touch even at full zoom, starts already colored. `build.py` checks every drawing before bundling it.

Many drawings are scenes: [OpenMoji](https://openmoji.org) emojis placed on a drawn background, from a dozen emojis in the simple ones to about forty in the big coloring pages. `tools/scenes.py` describes them and writes their files with `tools/make_drawing.py`, which turns each color shape of an emoji into a zone, keeps the outlines, gives close colors one palette entry and leaves shapes too small to color as they are. Background colors never merge with each other. The scenes need the OpenMoji color SVG of each emoji they use, named `<hexcode>.svg`, from the [`color/svg`](https://github.com/hfg-gmuend/openmoji/tree/master/color/svg) folder of the OpenMoji repository:

```sh
python3 tools/scenes.py --list-emoji          # codes of the emojis to download
python3 tools/scenes.py --sources <folder> --out drawings [--only details/74_ville ...]
```

`tools/patterns.py` draws the mandalas and the stained-glass pages from polar grids, with the colors placed symmetrically. It needs no source file:

```sh
python3 tools/patterns.py --out drawings [--only 70_mandala_fleuri ...]
```

`tools/from_painting.py` turns paintings and prints into drawings: it smooths the picture, splits it into regions that follow its shapes, keeps at most 12 colors taken from it, merges the regions too small to tap and traces the borders once for both neighbors. It needs Pillow besides the standard library, and the images listed in its table, which come from the open-access collections of the Art Institute of Chicago, the Metropolitan Museum of Art and the National Gallery of Art (CC0):

```sh
python3 tools/from_painting.py --sources <folder> --out drawings [--only 85_vague ...]
```

Two more scripts drive VectorCraft (the vector illustration app of the ArtCraft suite, through `vectorcraft-cli.exe` and its Image Trace, without a window) and need it besides Pillow:

- `tools/from_trace.py` traces a flat-color illustration in a few colors, each traced shape becoming a zone. It suits pictures with clear flat areas and soft cel shading; photos, 3D renders and textured paintings give blotches.
- `tools/from_lineart.py` takes a line drawing and a colored copy of it with the same framing: the areas closed by the lines become the zones, colored from the copy, and the lines, traced by VectorCraft, are laid over them. Where a gap in the lines leaves an area open, the area is cut along the colors of the copy.

`tools/prepare_scan.py` gets a scanned album page and its printed colored model ready for `from_lineart.py`, with numpy rather than VectorCraft. It turns the line scan into black lines on white and crops it to the drawing, or just inside the frame drawn around it with `--inside-frame`. It whitens the areas given with `--blank`, such as a library stamp, and scales and moves the colored scan so that its lines fall on those of the line scan.

```sh
python3 tools/from_trace.py --image <picture> --out <drawing.svg> --work <folder on a Windows drive> --vectorcraft <vectorcraft-cli.exe> --title <title>
python3 tools/prepare_scan.py --lines <line scan> --colours <colored scan> --out-lines <lines.png> --out-colours <colored.png> [--blank X0 Y0 X1 Y1] [--inside-frame]
python3 tools/from_lineart.py --lines <lines.png> --colours <colored.png> --out <drawing.svg> --work <folder> --vectorcraft <vectorcraft-cli.exe> --title <title>
```

These scripts write the same files on every run, so regenerating a drawing does not reset a child's progress unless its layout changed.

`tools/make_sample_drawings.py` regenerates the three hand-made drawings.

## Tests

`tools/test/run.py` builds the site, serves it on a local port and opens it in headless Firefox once per test case. The colouring cases fill every drawing with simulated taps, and the drawing cases use every tool and kind of brush, the rainbow, the mirror, stickers, backgrounds, the replay, zooming, a coloring page painted freely and the padlock, save, reopen and delete a drawing, each at three window sizes. The gallery case starts with two profiles, saved progress and saved drawings, switches the language, creates a profile with an animal, and saves and restores a backup. Each case writes a screenshot and a log. The tests need Python 3 and Firefox.

```sh
python3 tools/test/run.py --firefox <firefox executable> --profile <folder> --out <empty folder>
```

The profile folder holds a Firefox profile that only the tests use. Under WSL, run the Windows `firefox.exe` and keep the profile on a Windows drive, because a profile inside the Linux file system gets no localStorage or IndexedDB. `--list` shows the cases and `--only <case>` runs one of them. The service worker is off during the tests, so offline use can only be checked on a phone.

## Layout

| Path | Content |
|---|---|
| `src/` | app source: page, styles, modules, manifest, service worker, animal avatars in `src/avatars/`, emoji stickers in `src/stamps/` |
| `drawings/` | the drawings |
| `icons/` | logo and app icons; the PNG icons are exports of `icon.svg` and `icon-maskable.svg` |
| `build.py` | builds the site |
| `tools/` | helper scripts |
| `tools/test/` | browser tests |

## License

The code is under the GNU General Public License, version 3 or later (see `LICENSE`). The drawings in `drawings/`, the animal avatars in `src/avatars/` and the logo and icons in `icons/` are under CC BY-SA 4.0, and the stickers in `src/stamps/` are OpenMoji emojis under CC BY-SA 4.0 (see `LICENSE-ART.md`).
