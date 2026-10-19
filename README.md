# Couple Bingo 💗

A little bingo card made of the small moments we love. Tap a square every time
it happens to you two, and shout *bingo* when five line up — across, down, or
corner to corner.

Made for **Mena**, from **Ammar**. Live at
**https://menaammarpro.github.io/love-bingo/**

## What it does

- **5 × 5 card** with a free centre square (that one is us).
- **Tap to tick** a square; the card remembers everything.
- **Bingo detection** across all 12 lines — 5 rows, 5 columns and both
  diagonals — with the finished squares glowing and a little burst of hearts.
- **Edit squares**: swap the card for text boxes and write your own moments.
  Changes save as you type.
- **New card** shuffles your squares into new places; **Starter card** brings
  back the moments we shipped with.
- **Clear marks** wipes the ticks but keeps the squares.
- **Save as picture** draws a 1080 × 1080 share card on a canvas and downloads
  it as a PNG.
- **Fresh start each day** — an optional switch that clears the ticks when a
  new day begins.

## Files

```
index.html               the page
css/app.css              page styles (on top of the shared love theme)
css/theme.css            shared love theme  (copy of _love-theme/theme.css)
js/app.js                all logic + rendering, publishes window.MenaBingo
js/theme-main.js         shared header/theme/nav behaviour (_love-theme/main.js)
js/effects.js            heart bursts + toasts, service-worker registration
manifest.webmanifest     PWA metadata
sw.js                    offline cache (mena-bingo-v1)
test/harness.js          dependency-free test harness (node test/harness.js)
assets/favicon.svg       the little heart icon
```

## Data

Everything lives in this browser only, under the `localStorage` key
`mena-bingo`:

```json
{ "squares": ["…25 strings…"], "marked": ["…25 booleans…"],
  "lastReset": "YYYY-MM-DD", "autoReset": false }
```

No accounts, no tracking, no network requests.

## Tests

```sh
node --check js/app.js
node test/harness.js
```

`test/harness.js` loads `js/app.js` in a fake-DOM sandbox and checks the pure
logic on `window.MenaBingo` — the 12 lines, bingo detection (including the free
centre), toggling, deterministic shuffling, date stamping, state repair, and the
optional daily reset across a saved day boundary.

## Running locally

It is a plain static site — open `index.html`, or serve the folder:

```sh
python -m http.server
```

## License

CC BY-NC-ND 4.0 — see [LICENSE](LICENSE). Made with care ♥ for Mena.
