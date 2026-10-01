# Club themes

Each club has a folder here with `theme.json` and `logo.png`. The server loads them at startup; bump `version` in `theme.json` whenever you change one. Check them with `cd Dokubolaget && bun run admin themes check`. The design is in `docs/superpowers/specs/2026-10-01-pub-themes-design.md`.

Facts come from a web pass on 2026-10-01, using the clubs' own sites (sources below). Anything marked *uncertain* should be confirmed with the club. Owner contact for collaborations: e@dokubolaget.se.

| id | Club | Section, campus | Pub | Colours found | Overall |
|---|---|---|---|---|---|
| club-tmeit | TMEIT (TraditionsMEsterIT) | IT-sektionen, Kista | Fridays at Kistan 2.0 (owner confirmed Friday) | site bg `#443355` plum, Poppins; section laser violet ≈ `#cc99ff` (theme: laser violet pirates) | laser violet (section) |
| club-qmisk | QMISK (Qlubbmästeriet IT-sektionen Kista) | IT-sektionen, Kista | Thursdays from 17:00 at Kistan 2.0 | `#C91A25`, darker `#B31220` | ockraröd (ochre red) |
| club-dkm | DKM (Datas Klubbmästeri) | Datasektionen, Valhallavägen | Wednesdays 17:17 at META | official: cerise `#EE2A7B` / `#E83D84` / `#EC5F99`, `#212121`, yellow `#FCDA04`, `#F7F7F7`, Lato | cerise |
| club-mkm | MKM (Medias Klubbmästeri) | Medieteknik, Valhallavägen | Thursdays at META | site: yellow `#EEC912` on `#121212`; section colours RGB | B-frack, no overall (*uncertain*) |
| club-pr | ProgramRådet (PR) | Elektro + Medicinsk teknik, Valhallavägen | Thursdays at TOLVAN (an older source says Wednesdays) | none published, so **ask the club for a brand kit** | white (Elektro) |
| club-fisq | FISQ (Flemingsbergs Ingenjörssektions Qlubbmästeri) | IsF, Flemingsberg | Fridays 17:17 at Rudan | *uncertain*, so **ask the club** | rödockra (*uncertain*) |

## Concepts

Each concept lists its look, decoration, fonts, vibration pattern, a copy idea and a dossier note.

### TMEIT: "The Liquor Sea" (Spritsjön)
- **Look:** an old sea chart, "a map of the liquor sea" (the owner's direction): parchment, sepia ink and laser violet as the chart's ink colour. No neon. TMEIT's parrot-on-a-bottle logo sits in the header.
- **Decoration:** `seachart`: rhumb lines from a compass rose, hatched islands named after drinks (Vinön, Kap Punsch, Glöggholmen), a dotted course to an X, a sea serpent.
- **Fonts:** the `chart` set (IM Fell English SC titles, EB Garamond text).
- **Vibration:** `bass` (cannon).
- **Copy:** "Land ho!", "X marks the spot!"; the info sheet is the captain's log.

### QMISK: "Boomis"
- **Look:** QMISK red on near-black, with a lit dance floor. Boomis, their giant speaker on wheels, appears in the celebration.
- **Decoration:** `dancefloor`.
- **Fonts:** a heavy geometric display face.
- **Vibration:** `bass`. Board finished is the "drop".
- **Copy:** Q-spellings everywhere: "Qorrekt!", "Qlose!", "Qlart!". The mascot "Assar" is the logo (*uncertain* what it depicts, so ask).

### DKM: "META 17:17"
- **Look:** the official cerise and yellow on `#212121`. META has an arcade machine and a pinball machine.
- **Decoration:** `arcade`, with a pixel border and a 17:17 clock.
- **Fonts:** Lato for body text, with a pixel display font.
- **Vibration:** `arcade`.
- **Copy:** "INSERT COIN" on the empty board and "HIGH SCORE" when it's finished. The Δ shield is the logo.

### MKM: "ON AIR"
- **Look:** yellow on black, with an RGB test card.
- **Decoration:** `colorbars`.
- **Fonts:** a condensed broadcast face.
- **Vibration:** `neon`.
- **Copy:** "Tagning ett" (take one) and "Sänds live" (live broadcast). The board's correct marks use RGB channel splits.

### PR: "TOLVAN"
- **Look:** a clean white overall look: white and graphite with copper traces. **The colours are provisional** until PR sends brand material.
- **Decoration:** `circuit`.
- **Vibration:** `neon` or `classic`.
- **Copy:** circuit-themed: "Kortslutning!" (short circuit!) for a miss, "Full spänning" (full voltage) for a finished board.

### FISQ: "Rudan"
- **Look:** rödockra and a warm brick colour, like a cellar pub. **The colours are provisional** until FISQ confirms.
- **Decoration:** `cellar`.
- **Vibration:** `toast`.
- **Copy:** Friday 17:17 references.

## Logos

PNG or WebP only, at most 1024 px and 300 KB (SVG is refused). The owner has the clubs' permission to use their logos. Each `logo.png` was made from the club's own published file, without redrawing:

| Club | Source | Notes |
|---|---|---|
| TMEIT | https://tmeit.se/assets/LogoTMEIT_monochrome-pYIiCl9i.svg | The official logo is white only; recoloured to near-black (`#1a1a1a`) so it shows on the white badge. |
| QMISK | https://qmisk.com/static/images/logo.png | "Assar". |
| DKM | https://dsekt-assets.s3.amazonaws.com/website/namnder/dkm.svg | "DKM logo (black)" from Datasektionen's file storage. |
| MKM | https://storage.googleapis.com/medieteknik-static/committees/mkm.svg | Has its own white background. |
| PR | https://elektrosektionen.se/wp-content/uploads/2021/11/PR-bat-snurr-hemsidan.gif | First frame of the spinning bat. No vector or still version exists, so edges are rough; ask PR for a better file. |
| FISQ | https://www.isflemingsberg.se/assets/fisq-Ciyj4_te.webp | The round badge from the /fisq page. |

When a club sends a better file, replace `logo.png`, update `logo.width`/`logo.height` in `theme.json` and bump `version`.

## Provisional colours

PR (graphite and copper) and FISQ (rödockra and brick) have no published palette. Their colours are guesses until the clubs confirm them. The other four use colours from their own sites (DKM's from Datasektionen's official graphic profile).

## Sources

- https://kth.it/chapter
- https://kth.it/committees/tmeit
- https://kth.it/committees/qmisk
- https://tmeit.se
- https://qmisk.com
- https://qmisk.com/ovve
- https://qmisk.com/boomis
- https://datasektionen.se/sektionen/grafisk-profil
- https://datasektionen.se/namnder/eventorganet/dkm
- https://www.medieteknik.com/en/chapter/committees/Medias%20Klubbm%C3%A4steri
- https://elektrosektionen.se/verksamhet/pr/
- https://isflemingsberg.se/fisq
- https://www.studentlivstockholm.se/kongligelektro
