<img src="icons/logo.svg" alt="Giuno Colors logo" width="200">

# Giuno Colors

**Color, draw and build. No ads, no account, no network needed.**

A coloring app for children that installs on a phone like any other app and keeps working offline. Free and open source.

**Try it:** https://a220n1.github.io/giuno-colors/ then "Add to home screen" in the browser menu.

<p>
  <img src="docs/gallery.png" alt="The gallery of a child" width="24%">
  <img src="docs/coloring.png" alt="A color-by-number page half colored" width="24%">
  <img src="docs/mystery.png" alt="A mystery page showing as it is colored" width="24%">
  <img src="docs/drawing.png" alt="A free drawing with Christmas stickers on a night village" width="24%">
</p>

## Color by number

*Pick a color, tap its numbers, watch the picture come.*

- 21 pages, from 12 zones for the youngest to 600 for the patient ones.
- Three mystery pages: all grey at first, the picture only shows as it is colored.
- Plain, shaded or glitter colors, at the tap of a button.
- Pinch to zoom, hold a zone to pick its color, and a magnifier finds the zones left.

## Draw

*A blank page and a box of tricks.*

- Ten brushes: felt pen, pastel, glitter, neon, hearts, shooting stars, soap bubbles that fly off and pop, paint that drips, grass, clouds.
- 85 stickers, with a Christmas page, and your own: cut-out photos of the family go in from a file.
- Sixteen pages to draw on: an underwater scene, a starry sky, five Christmas landscapes, and a scratch card whose black hides bright colors.
- Stencils, a mirror up to a kaleidoscope, a paint bucket, a finger that smudges, and a replay of the drawing stroke by stroke.
- Shake the phone and it snows.

<p>
  <img src="docs/bricks.png" alt="A dragon built with bricks" width="24%">
  <img src="docs/scratch.png" alt="A heart scratched on a scratch card" width="24%">
</p>

## Build

*Bricks that click.*

- 25 pieces in any color: bricks, plates, slopes, an arch, a wheel, a door, a window, a flag, a head with a smile.
- They snap to the studs and stack. Hold one to move it; a tap of the eraser takes it away.
- Four models to build over: a dragon, a castle, a rocket, a fir.

## For grown-ups

- One profile per child, each with its animal, its progress and its drawings.
- Everything stays on the phone. A backup file moves it to another one.
- A session timer: when the time is up, the app goes back to its start screen and says so.
- The phone's Back button never leaves the app, and a padlock keeps a small child inside a drawing.
- A loudspeaker button turns the sounds off. French or English.

## Make your own

The app is plain HTML, CSS and JavaScript, built by one Python script with nothing to install:

```sh
python3 build.py --out site
python3 -m http.server --directory site 8000
```

How to add drawings, stickers and sticker packs, and how the tests run: [docs/making.md](docs/making.md).

## License

The code is under the GNU General Public License, version 3 or later (see `LICENSE`). The drawings in `drawings/`, the animal avatars in `src/avatars/` and the logo and icons in `icons/` are under CC BY-SA 4.0, and the stickers in `src/stamps/` are OpenMoji emojis and Christmas stickers drawn for the app, all under CC BY-SA 4.0 (see `LICENSE-ART.md`).
