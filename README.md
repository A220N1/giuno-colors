<img src="icons/logo.svg" alt="Giuno Colors logo" width="220">

# Giuno Colors

Color by number for children. It is a web app that installs on a phone like any other app and keeps working offline. The interface is in French.

Use it at https://a220n1.github.io/giuno-colors/ and add it to the home screen from the browser menu.

## What it does

- Pick a color, then tap the zones that carry its number. Holding a zone picks its color.
- Pinch to zoom and drag to move. Numbers too small to read appear as you zoom in, and the magnifier jumps to a zone that is left.
- Each child gets a profile with its own progress.
- A drawing can be shared or saved as a PNG image.

## Build

The build needs Python 3 and nothing else.

```sh
python3 build.py --out site
```

This writes the app (HTML, CSS, JavaScript modules, manifest, service worker, icons and drawings) into a new or empty folder. Service workers and installation need HTTPS or `localhost`, so try it through a local server:

```sh
python3 -m http.server --directory site 8000
```

## Drawings

Each drawing is an SVG file in `drawings/`. The root `<svg>` has a `viewBox`, a `data-title`, a `data-level` (1 easy, 2 medium, 3 hard) and a `data-palette` listing `#rrggbb` colors. Any `path`, `rect`, `circle`, `ellipse` or `polygon` with `data-c="n"` is a zone to fill with palette color `n`, counted from 1. Later zones may cover earlier ones. Other elements are drawn as they are and do not react to taps.

`build.py` checks every drawing before bundling it. `tools/make_sample_drawings.py` regenerates the three sample drawings.

## Layout

| Path | Content |
|---|---|
| `src/` | app source: page, styles, modules, manifest, service worker |
| `drawings/` | the drawings |
| `icons/` | logo and app icons; the PNG icons are exports of `icon.svg` and `icon-maskable.svg` |
| `build.py` | builds the site |
| `tools/` | helper scripts |

## License

The code is under the GNU General Public License, version 3 or later (see `LICENSE`). The drawings in `drawings/` and the logo and icons in `icons/` are under CC BY-SA 4.0 (see `LICENSE-ART.md`).
