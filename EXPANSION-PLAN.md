# Age of Abundance v5.0 — expansion plan

Target: a first playthrough that lasts **3–5 hours**, with real replay through both brothers, the three backgrounds, and branching consequences. The game stays offline, mobile-first, and light on new assets. Work happens on the `expansion` branch, one commit per stage.

## Hard rule: playable cast is locked

**Do not change Uygar, Berkay or Pukie.** Their names, looks, art, bios, personalities, roles, and `DOG_RULES` stay exactly as they are. Existing core dialogue that is about them or spoken in their established voice stays canon. New lines for them are allowed only when they are consistent with that voice (Uygar measured and unwilling to call a person collateral; Berkay practical and protective; Pukie acts on her own, never as a weapon or selectable unit).

Walk-cycle and portrait cleanup for the three of them may only remove artifacts (alignment, compression, jitter). It must not change their design, wardrobe, faces, or silhouettes.

**Named NPCs may be changed, deepened, or diversified:** Mara Voss, Director Halden, Sera Quill, Doctor Rusk, Director Venn, the father, and the existing workers. New and more varied minor NPCs and factions are welcome, provided they do not rewrite the locked trio.

## Current baseline (v4.0)

A clean main-path playthrough ends around **turn 21**, Act I can already be saved by turn 9, and the Act I receivership deadline is a flat 30. That is too short for a €4.99 premium (or a paid unlock after a free Act I).

Already in the engine, and to be deepened rather than replaced:

- Bid/ask quotes (`quote()`), a single 80-crown loan with a margin call, and one ration forward
- Three weapons and two outfits; Berkay’s pack is smaller than Uygar’s
- Main plot in three acts, five chosen endings plus death and receivership
- Three optional arcs: Family Guarantee, Small Mercies, Common Carrier
- Weather, party-wait, and localStorage saves (`tlc-campaign-v1`)

Systems are thin. Most locations have one or two story beats. Trading is three commodities with a fixed four-crown spread. Combat has no real progression after the Bid & Ask carbine/shotgun. There is no difficulty setting and no random event layer.

## Design principles

- New text must feel hand-written and match `content.js`: dry, specific, financially literate, morally sharp, short paragraphs, no lore-dump fluff.
- Reuse the existing plates (town, garden, river, core, interior, vault, core-duel, and the location stills). New images only if a plate is truly missing or a current one is unusably blurry, always in the same isometric style, and **never depicting Uygar, Berkay or Pukie**.
- Saves remain loadable: `upgradeSave` migrates v4 (`version: 1`) campaigns into v5, filling new fields with safe defaults. No silent deaths of old flags.
- Mobile-first: new panels must work in the existing portrait shell (including 360-wide Android and 390-wide iPhone).
- A free Act I demo plus unlock is a store option, not a second binary in this phase. The campaign is still one offline game; the listing will mention a possible Act I demo later. This build ships the full v5 campaign.

## Playtime budget

A first playthrough that does the main plot plus most side work should land at **roughly 55–80 settlements** and **3–5 hours**, assuming players read, walk the isometric maps, trade, and take optional fights.

| Layer | v4 typical | v5 target (standard, first run) |
|---|---|---|
| Act I deadline | 30 | Story 52 / Standard 44 / Hard 36 |
| Act I main beats | ~9–11 | ~18–22 (new required leads before a town save) |
| Full main path | ~21 turns | ~45–55 turns |
| Side quests | 3 arcs, ~15 flags | 3 old arcs + a 2–4 step side at every location |
| Estimated first run | well under 1 hour | 3–5 hours |

Replay comes from lead (Uygar vs Berkay), background skills, difficulty, faction resolutions, and which sides and market positions you took — not from grinding.

## Stage 1 — systems

**Difficulty** (`story` / `standard` / `hard`), chosen on the new-campaign screen, stored on the save.

- Starting cash, combat accuracy, shop prices, margin-call severity, and the Act I deadline all scale.
- Story is more forgiving (so the writing can be enjoyed). Hard tightens spreads, fights, and the collectors’ clock.
- `upgradeSave` assigns `standard` to old campaigns.

**Trading and debt**

- Extend the book: keep rations, medicine and parts; add a few Basin goods (stamp ink, pump fuel, grain scrip, salt). Each has a regional bid/ask that moves with the settlement clock, weather, and flags (for example a repaired pump still eases food prices).
- Spreads widen in thin markets and on Hard. The Bid & Ask and Free Float remain the two deep books; other places may post a single local bid.
- Loans: keep the existing product, add a smaller short note and a larger collateralised loan (margin call still seizes cash, then health). Difficulty changes size, term and penalty.
- Forwards: keep the ration forward; add a parts forward and an optional grain-scrip future that can expire in or out of the money.
- Existing `borrow` / `repay` / `forward` IDs stay valid.

**Combat and equipment**

- Keep the settlement pistol, survey carbine and breaching shotgun.
- Add two or three tone-fitting weapons that are **stat-only** (no new walk-cycle art): e.g. a receiver’s baton, a bonded sidearm, a clearing long-gun. Sold at the Bid & Ask or Free Float. Pack rules still apply (Berkay 4, Uygar 8).
- Do not add outfits that would require new Uygar/Berkay/Pukie sprites.
- Enemies stay few and authored (repossession officer, toll enforcer, clearing sentinel, plus one or two new authored encounters). No trash grinding.

**Random events**

- A hand-written table, region- and flag-aware, rolled in `advance()` on a sparse cadence (about every 5–7 settlements, never during combat or endings).
- Each event is a short scene with one or two choices, written in the same voice. No generic “you find a chest” filler.
- Events are seeded; the same campaign does not repeat the same card until the table has turned over.

**Save schema**

- Bump `VERSION` to 2. `upgradeSave` copies v1 fields, sets `difficulty:'standard'`, zero-fills new inventory keys, and adds `contracts:[]` / `eventsSeen:[]` as needed.
- `validateSave` allow-lists the new flags, items, and difficulty. Old legal states must still pass after upgrade.

## Stage 2 — Act I content

The collectors still come. The way you stop them gets longer and more local.

Required new leads (on top of Venn, the ledger, and a town save):

- A neighbour on Par Value square who can actually tell the two amounts apart
- The posted town paper at the Bid & Ask (what the market already thinks Par Value is worth)
- The municipal pump’s shareholder plate
- A witness at a new Fringe dock location, **The Outstanding Wharf**, staged on the existing town plate

`injunction`, `waterbond` and `extension` remain the three town saves, but they unlock only after those leads (and the existing ledger / covenant / cash conditions). Venn’s briefing is extended, not replaced. Deadline text must follow the chosen difficulty, not a hard-coded “thirtieth settlement.”

Side work at every Fringe location: a widow’s junior claim in the vault, a dockers’ wage sheet, a clinic supply run, a notices-board debt that can be bought out or refused. Deepen Venn, Rusk and Mara with new consistent scenes; do not flatten them into quest-givers.

## Stage 3 — Act II content

Each faction chain gains a middle beat and a second room, still resolving into the same three keys and the same named outcomes (`expose` / `prosecute` / `cover`, and their Float and Reserve counterparts) so existing ending logic and `cooperative()` keep working.

New rooms, all on existing maps:

- **The Paper Annex** (Interior plate) — the invented citizens of the grain audit acquire names and files
- **The Night Quay** (river plate) — a competing book that Quill has not fully priced
- **The Allotment Orchard** (garden plate) — a reserve that still feeds people when the pension ledger does not

Deepen Halden, Quill and Rusk. Add named clerks, pump workers, and a patient whose life was bought with someone else’s retirement. Keep Common Carrier and Small Mercies; give them an extra optional beat if it stays in character.

## Stage 4 — Act III content

Before the father scene, the Clearing is a place you investigate, not a corridor.

- **The Claims Antechamber** (core or vault plate): a required review of the six senior claims
- Optional machine-floor beat (core-duel plate): what the Counterparty actually optimises
- The father confrontation stays canon in its facts (he is alive, he forged the signatures, the duplicate claims now back the currency). New lines may deepen him; they may not contradict that scene
- The five chosen endings plus death and receivership remain. Epilogues should mention new institutions and people you actually helped or harmed

## Stage 5 — balance, regression, GFX QA

- Re-tune cash, combat, food, and deadlines so Standard is tense but fair, Story is readable, Hard is tight without softlocks
- A logic sim must reach every ending on at least one legal path
- Playwright regression: desktop, 390×844, 360×740, no console errors, no softlocks
- Measure turns, quest counts, and a conservative playtime estimate (story actions × a reading-and-walking allowance, plus travel and market time)

### Graphics and animation QA

Nothing should look soft, blurry, mushy, placeholder-ish, or buggy.

- Walk cycles and sprite sheets, frame by frame: alignment, jitter, foot sliding, wrong facing, scale mismatches, mixed styles, rig glitches, timing. Evidence in `/workspace/game-audit/gfx/` (frame strips, zoomed crops, GIF or video)
- Maps and plates: blur or upscaling, compression, seams, inconsistent light or style
- UI: sharp text and icons at 1× / 2× / 3× DPR; toasts, transitions, weather, combat and walk animations checked for flicker, layout shift, z-order errors, stutter
- Mid-range mobile CPU profile: Playwright CPU throttling
- Fixes in place where possible. Regenerated art must match the existing style. **No redesign of Uygar, Berkay or Pukie** — only artifact cleanup in their existing frames
- The final report includes a GFX section with issues found and fixed, and before/after evidence paths

## Asset policy

Reuse `town-map`, `garden-map`, `river-map`, `core-map`, `interior-map`, `vault-map`, `core-duel-map`, and the existing location stills. New NPC walkers, if needed, should come from `npc-walk` / `npc-workers` or a careful recolour, not a new hero sheet. Keep the debug APK under 24 MB.

## Store and ship

When the branch is done: merge to `master`, bump the visible version to **5.0**, rebuild `/workspace/game-v4-app/dist/AgeOfAbundance-v4.0-debug.apk` (name may become v5.0) under 24 MB, `targetSdk` 36, and update `/workspace/store/listing.md` (and the short description if needed) so the page describes the longer campaign, systems, and replay. Privacy / Data safety answers stay “no data collected.”
