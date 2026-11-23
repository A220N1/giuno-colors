# Making Giuno Colors

How the app is built and tested, and how its drawings, stickers and sticker packs are made.

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

The root `<svg>` of a drawing has a `viewBox`, a `data-title`, a `data-level` (1 easy, 2 medium, 3 hard) and a `data-palette` listing `#rrggbb` colors. A `data-mystery` attribute makes it a mystery page. Any `path`, `rect`, `circle`, `ellipse` or `polygon` with `data-c="n"` is a zone to fill with palette color `n`, counted from 1. Later zones may cover earlier ones. Other elements are drawn as they are and do not react to taps. A zone that cannot be seen, or that stays too small to touch even at full zoom, starts already colored. `build.py` checks every drawing before bundling it.

Many drawings are scenes: [OpenMoji](https://openmoji.org) emojis placed on a drawn background, from a dozen emojis in the simple ones to about forty in the big coloring pages. `tools/scenes.py` describes them, along with scenes the app no longer includes, and writes their files with `tools/make_drawing.py`, which turns each color shape of an emoji into a zone, keeps the outlines, gives close colors one palette entry and leaves shapes too small to color as they are. Background colors never merge with each other. The scenes need the OpenMoji color SVG of each emoji they use, named `<hexcode>.svg`, from the [`color/svg`](https://github.com/hfg-gmuend/openmoji/tree/master/color/svg) folder of the OpenMoji repository:

```sh
python3 tools/scenes.py --list-emoji          # codes of the emojis to download
python3 tools/scenes.py --sources <folder> --out drawings [--only details/74_ville ...]
```

`tools/patterns.py` draws stained-glass pages and mandalas, which the app no longer includes, from polar grids, with the colors placed symmetrically. It needs no source file:

```sh
python3 tools/patterns.py --out drawings [--only 72_rosace ...]
```

`tools/from_painting.py` turns paintings and prints into drawings (the app no longer includes the ones it made, and it writes to a `drawings/tableaux/` folder that needs its line in `categories.json` again): it smooths the picture, splits it into regions that follow its shapes, keeps at most 12 colors taken from it, merges the regions too small to tap and traces the borders once for both neighbors. It needs Pillow besides the standard library, and the images listed in its table, which come from the open-access collections of the Art Institute of Chicago, the Metropolitan Museum of Art and the National Gallery of Art (CC0):

```sh
python3 tools/from_painting.py --sources <folder> --out drawings [--only 85_vague ...]
```

Two more scripts drive VectorCraft (the vector illustration app of the ArtCraft suite, through `vectorcraft-cli.exe` and its Image Trace, without a window) and need it besides Pillow:

- `tools/from_trace.py` traces a flat-color illustration in a few colors, each traced shape becoming a zone. It suits pictures with clear flat areas and soft cel shading; photos, 3D renders and textured paintings give blotches.
- `tools/from_lineart.py` takes a line drawing and a colored copy of it with the same framing: the areas closed by the lines become the zones, colored from the copy, and the lines, traced by VectorCraft, are laid over them. Where a gap in the lines leaves an area open, the area is cut along the colors of the copy.

`tools/prepare_scan.py` gets a scanned album page and its printed colored model ready for `from_lineart.py`, with numpy and scipy rather than VectorCraft. It turns the line scan into black lines on white and crops it to the drawing, or just inside the frame drawn around it with `--inside-frame`. It whitens the areas given with `--blank`, such as a library stamp, and scales and moves the colored scan so that its lines fall on those of the line scan.

```sh
python3 tools/from_trace.py --image <picture> --out <drawing.svg> --work <folder on a Windows drive> --vectorcraft <vectorcraft-cli.exe> --title <title>
python3 tools/prepare_scan.py --lines <line scan> --colours <colored scan> --out-lines <lines.png> --out-colours <colored.png> [--blank X0 Y0 X1 Y1] [--inside-frame]
python3 tools/from_lineart.py --lines <lines.png> --colours <colored.png> --out <drawing.svg> --work <folder> --vectorcraft <vectorcraft-cli.exe> --title <title>
```

These scripts write the same files on every run, so regenerating a drawing does not reset a child's progress unless its layout changed.

`tools/make_sample_drawings.py` regenerates the three hand-made drawings.

## Stickers

The stickers of the free drawing are SVG files in `src/stamps/`: OpenMoji emojis named after their code, and the Christmas stickers `xmas-*.svg`, drawn for the app on the OpenMoji grid with its palette. `tools/make_xmas_stickers.py <folder>` writes the Christmas stickers again. `src/js/images.js` lists the stickers of each page of the menu.

A sticker pack is a JSON file that holds pictures as data URLs:

```json
{ "app": "giuno-colors", "kind": "stickers", "version": 1, "name": "Family",
  "stickers": [{ "name": "grandma", "image": "data:image/webp;base64,..." }] }
```

`tools/sticker_pack.py` makes a pack from cut-out pictures, PNG or WebP files with a transparent background. It crops each picture to what it shows, scales it to 512 pixels, adds the white edge of a die-cut sticker and writes it as WebP. It needs Pillow.

```sh
python3 tools/sticker_pack.py <cut-out pictures> --out <pack.json> [--name <name>] [--size 512] [--border 5] [--preview <sheet.png>]
```

The app takes PNG, WebP and JPEG pictures. It keeps a picture of 640 pixels or less as it is and scales a bigger one down. A pack is added on each phone from the grown-ups' corner and is never part of the site.

## Tests

`tools/test/run.py` builds the site, serves it on a local port and opens it in headless Firefox once per test case. The colouring cases fill every drawing with simulated taps, and the drawing cases use every tool and kind of brush, the rainbow, the mirror, the pages of the sticker menu, a personal sticker from a pack, the bricks, a stencil, the scratch card, the sounds, backgrounds, the replay, zooming, a coloring page painted freely and the padlock, save, reopen and delete a drawing, each at three window sizes. The gallery case starts with two profiles, saved progress and saved drawings, switches the language, creates a profile with an animal, saves and restores a backup, and adds and removes a coloring page and personal stickers. Each case writes a screenshot and a log. The tests need Python 3 and Firefox.

```sh
python3 tools/test/run.py --firefox <firefox executable> --profile <folder> --out <empty folder>
```

The profile folder holds a Firefox profile that only the tests use. Under WSL, run the Windows `firefox.exe` and keep the profile on a Windows drive, because a profile inside the Linux file system gets no localStorage or IndexedDB. `--list` shows the cases and `--only <case>` runs one of them. The service worker is off during the tests, so offline use can only be checked on a phone.

## Layout

| Path | Content |
|---|---|
| `src/` | app source: page, styles, modules, manifest, service worker, animal avatars in `src/avatars/`, stickers in `src/stamps/` |
| `drawings/` | the drawings |
| `icons/` | logo and app icons; the PNG icons are exports of `icon.svg` and `icon-maskable.svg` |
| `build.py` | builds the site |
| `tools/` | helper scripts |
| `tools/test/` | browser tests |
| `docs/` | this page and the screenshots of the README |
