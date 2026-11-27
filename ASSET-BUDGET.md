# Asset budget — Age of Abundance v4.0

Baseline is the untouched v3.4 tree at `/workspace/game` (same bytes as the v4 git baseline commit).

## Tree size (source + assets, excluding `.git`)

| Tree | Bytes | MiB | Files |
|---|---:|---:|---:|
| v3.4 `/workspace/game` | 14,780,161 | 14.10 | 54 |
| v4.0 `/workspace/game-v4` | 9,586,657 | 9.14 | 53 |
| Change | -5,193,504 | -4.95 | -1 |

## `assets/` folder

| | Bytes | MiB | Files |
|---|---:|---:|---:|
| Before | 14,509,689 | 13.84 | 39 |
| After | 9,307,419 | 8.88 | 37 |
| Change | -5,202,270 | -4.96 | -2 |

## What changed

1. **Removed unused atlases** `hero-walk.webp` and `hero-walk-rig.webp` (794,840 bytes). The player always uses the lead brother's outfit atlas; `hero-walk` was only a leftover preload/fallback.
2. **Lazy-load maps and outfits.** The current district map, the visible brothers' current outfits and rigs, Pukie (if on screen), `npc-walk`, and `npc-workers` (only when that scene has workers) are requested. Other maps and unworn rain/trail variants stay on disk until needed and are cached after first use. The unused `party-camp.webp` landing preload remains, because the title screen needs it immediately.
3. **Recompress where quality held.** RGB plates (maps, location stills) were tried at WebP quality 90, method 6; RGBA sprites at quality 95. A file was replaced only if the new encode was at least 8% smaller and premultiplied PSNR stayed at or above 37.5 dB (maps) or 40 dB (sprites). Visual checks of the town map (cobbles, bank shadows, awnings) and Uygar's walk frame confirmed quality 90/95 holds; quality 85 softened grout and grass and was rejected. Location stills, portraits, and style thumbnails already compressed well and were kept.

## Recompress log

| File | Action | Before | After | q | PSNR |
|---|---|---:|---:|---:|---:|
| garden-map.webp | replaced | 840,288 | 701,262 | 90 | 38.84 |
| town-map.webp | replaced | 836,788 | 698,646 | 90 | 38.9 |
| river-map.webp | replaced | 803,422 | 663,482 | 90 | 38.87 |
| core-map.webp | replaced | 575,082 | 479,794 | 90 | 41.11 |
| reserve.webp | kept | 567,462 | 567,462 | 90 | 42.45 |
| berkay-rain-hood-walk.webp | replaced | 565,472 | 249,490 | 95 | 44.68 |
| npc-workers.webp | replaced | 554,930 | 240,982 | 95 | 45.58 |
| uygar-rain-walk.webp | replaced | 551,874 | 240,752 | 95 | 43.09 |
| berkay-rain-walk.webp | replaced | 550,162 | 239,944 | 95 | 44.96 |
| uygar-walk.webp | replaced | 540,454 | 243,628 | 95 | 42.44 |
| berkay-walk.webp | replaced | 535,554 | 244,612 | 95 | 43.12 |
| exchange.webp | kept | 510,118 | 510,118 | 90 | 41.46 |
| npc-walk.webp | replaced | 494,664 | 220,612 | 95 | 46.6 |
| clearing.webp | kept | 452,820 | 452,820 | 90 | 43.96 |
| uygar-rain-walk-rig.webp | replaced | 449,374 | 211,050 | 95 | 46.69 |
| npc-workers-rig.webp | replaced | 448,262 | 199,618 | 95 | 48.98 |
| par-value.webp | kept | 447,118 | 447,118 | 90 | 43.15 |
| uygar-walk-rig.webp | replaced | 444,596 | 216,714 | 95 | 45.9 |
| berkay-walk-rig.webp | replaced | 441,128 | 220,764 | 95 | 46.68 |
| berkay-rain-hood-walk-rig.webp | replaced | 441,078 | 212,246 | 95 | 48.57 |
| berkay-rain-walk-rig.webp | replaced | 436,530 | 205,552 | 95 | 48.71 |
| npc-walk-rig.webp | replaced | 427,040 | 194,412 | 95 | 49.75 |
| party-camp.webp | kept | 414,614 | 414,614 | 90 | 40.95 |
| portraits.webp | kept | 342,138 | 342,138 | 90 | 45.58 |
| pukie-walk.webp | replaced | 237,038 | 126,754 | 95 | 44.4 |
| berkay-cover.webp | replaced | 158,054 | 114,046 | 90 | 41.62 |
| pukie-portrait.webp | kept | 96,182 | 96,182 | 90 | 43.41 |
| uygar-portrait.webp | kept | 92,916 | 92,916 | 90 | 42.09 |
| berkay-portrait.webp | kept | 84,264 | 84,264 | 90 | 43.55 |
| berkay-style-1.webp | kept | 56,348 | 56,348 | 90 | 43.15 |
| berkay-style-0.webp | kept | 56,116 | 56,116 | 90 | 43.0 |
| berkay-style-3.webp | kept | 54,764 | 54,764 | 90 | 43.27 |
| berkay-style-2.webp | kept | 53,838 | 53,838 | 90 | 42.97 |
| berkay-style-4.webp | kept | 47,440 | 47,440 | 90 | 45.03 |
| berkay-style-5.webp | kept | 45,684 | 45,684 | 90 | 45.66 |
| hero-walk.webp | removed | 436,192 | 0 |  |  |
| hero-walk-rig.webp | removed | 358,648 | 0 |  |  |
