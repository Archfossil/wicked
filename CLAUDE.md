# CLAUDE.md

*The Wicked Awaken* is a competitive deckbuilder about villains building dungeons to kill heroes. It is still in the design stage.

- The game design is in `docs/design/`. Read `00-overview.md` first.
- Each rule there is tagged **Rule** (decided), **Idea** (wanted, details not settled) or **Open** (undecided, linked to `Q-xx` in `docs/design/open-questions.md`).
- When coding, don't quietly settle an Open question. Ask, or keep the behaviour configurable and say so. When the user answers one, update both `open-questions.md` and the doc it came from.
- `docs/design/11-data-model.md` is the draft for the game's types. Keep it in step with the code once code exists.
- Card data is JSON in `data/<set>/` (see `data/README.md`). After changing it, run `node tools/validate-data.mjs` and `node tools/placeholder-checklist.mjs`. `docs/placeholders.md` is generated, so never edit it by hand.
