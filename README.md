# Toast Lower

English | [简体中文](README.zh-CN.md)

**[Play now!](https://claslove.github.io/Toast-Lower/)**

## Hard-mode walkthrough

https://github.com/user-attachments/assets/06131c59-655d-4b55-bbc4-941e1dd72dca

Automated playthrough.

## How to play

| Action | Desktop | Mobile (landscape) |
| --- | --- | --- |
| Steady the glass | Q / W or ← / → | Move the left stick sideways |
| Adjust height | O / P or ↓ / ↑ | Move the left stick up or down |
| Toast | Space | Tap the right-hand toast button |
| Smash through the floor | Hold O / ↓ during the floor-break phase | Hold the stick down |
| Pause | Esc / pause button | Top-right pause button |
| Return home | Top-right house icon | Top-right house icon |

On desktop, R restarts and M mutes. Choose a difficulty or replay the tutorial from the home screen. Settings are available both at home and during play to adjust audio.

Everyone lands on the home screen. For new players, Start opens Mom’s lesson before the game; after completing or skipping it, Start goes straight into the game. The “引导” (Tutorial) setting controls future starts and remembers your choice. The home-screen “妈妈教你酒桌规矩” button always replays the lesson. On mobile, learn left-hand movement and right-hand toasting, then balancing, timing, a two-toast phrase and floor smashing. The cup wobbles and spills, but Mom replenishes the juice. The countdown starts once the height is aligned; both toasts must land to finish the phrase.

On mobile, diagonal stick input controls both axes; releasing it preserves momentum. Even with portrait rotation lock enabled, the display and touch controls rotate automatically inside the page.

The red **0s** marks the ideal toast timing. Run out of wine and the game ends. Missed toasts cost wine; successful rounds restore a little. Perfect toasts require both precise timing and a steady glass. Later glasses are smaller and hold less wine.

Easy keeps its existing feel. Normal inherits the previous Hard preset. The new Hard tightens height and timing further and requires stronger cup control. Height windows are 100% / 65% / 45%; opening capacities are 100% / 80% / 70%, all reaching the same 60% minimum. Stage refills are 10% / 4% / 4%; round refills and grouped penalties are unchanged. Hard's single-toast timing window narrows from ±0.15s to ±0.12s, with a 0.20-beat chain window. Aliens still count down for two seconds and reveal the target in the final second.

## Four chapters, twelve stages

| Chapter | Challenge |
| --- | --- |
| Workplace | Adjust your height and learn single toasts |
| Underground transit | Keep the glass steady while everything sways |
| Ancient tomb | Hold a fixed height and hit 2, 3, then 4 consecutive beats |
| Aliens | Three cups count down from 2 seconds. Only the target’s circle and height guide remain in the final second; the leader steps forward at 0s. The same leader can be picked again |

After stage twelve, a comic-style results card shows your rank, score, difficulty, perfects, misses, best combo and three score categories. Expand the details for the wine ledger. Choose Continue Endless or Return Home; music continues through the transition.

The twelve-stage maximum is 100,000 points, with the same scoring rules across difficulties:

| Category | Maximum | Rule |
| --- | ---: | --- |
| Toast performance | 40,000 | 10,000 per chapter, divided across stages, groups and notes; a first-attempt ordinary hit earns 50%, a perfect earns 100%, and a miss earns 0 |
| Stages and completion | 50,000 | 3,000 per stage, plus 14,000 for clearing all twelve |
| Wine preservation | 10,000 | Up to 5,000 for remaining wine and 5,000 from full-glass conversion |

Each note scores only on its first attempt. Retries advance the stage but cannot reclaim missed points, build extra hype or farm conversion points. Combo and hype feedback remain, without separate score bonuses. A clear guarantees at least 50,000 points; all ordinary first-attempt hits yield 70,000–80,000, and all perfects yield 90,000–100,000. Titles depend only on score.

Remaining wine scores once, based on how full the current glass is; continuing into endless does not award it again. Refills from first-attempt scoring rounds and first stage transitions convert the part that cannot fit into 50 points per 1% of a standard glass, capped at 5,000 points per run. Wine actually added counts only as refill. The ledger reconciles: opening wine + actual refills − spills − penalties − capacity reductions = remaining wine. A failed run also shows what depleted the last wine.

One high score is shared across difficulties and records the difficulty used. Custom rules, practice controls, stage skips and automated runs do not replace standard records. Endless continues adding performance and stage points beyond the twelve-stage 100,000 maximum, without repeating the clear or remaining-wine awards; conversion retains its original cap. This scoring version uses a new record; earlier records remain in local storage.

Successful contact itself consumes no wine. For 2/3/4-note chains, cumulative penalties are 12%/20%, 12%/16%/20%, and 12%/16%/18%/20%. A group with at least one successful note gets one refill (3% by default); an all-miss group gets none. Only a completely successful phrase advances. A partial phrase repeats at the same height, without awarding points for already attempted notes. Percentages use the standard full-glass capacity, including when Hard starts with a smaller glass. Results show actual spills, penalties and refills.

## Ranks

Your final score determines your title. Scores below are entry thresholds; the first title is exclusive to zero points. Titles match the Chinese names in the game, with captions translated here.

| Score | Title | Caption |
| --- | --- | --- |
| 0 | 成年香蕉 | You grew hands. Almost. |
| 1 | 卧龙凤雏 | Two legendary strategists. One on each wrist. |
| 1,000 | 小孩那桌 | Back to the kids' table. |
| 3,000 | 夹菜我转桌 | Table manners were never the plan. |
| 6,000 | 乌鸦哥 | Can't toast the table? Flip it. |
| 12,000 | 端水大师 | Keep the glass level and everyone happy. |
| 18,000 | 懂事长 | Toasted your way into management. |
| 45,000 | 敬酒悍匪 | Taking the offensive. |
| 65,000 | 国家一级陪酒员 | Practically licensed for this. |
| 85,000 | 先天敬酒圣体 | Born for this banquet. |
| 92,000 | 铁血山东 👍 | Social etiquette: maxed out. |
| 98,000 | DeepDrink | A large toasting model. |

## Run locally

From the project directory:

```sh
python3 -m http.server 8783 --bind 127.0.0.1
```

Open <http://127.0.0.1:8783/> in your browser.

## Editing and checks

- `game.js`: physics, rendering and game flow.
- `rules.js`: wine accounting, fixed scoring opportunities, toast points and rank thresholds.
- `chapters.js`: chapter definitions, characters and dialogue.
- `input-ui.js`: keyboard/touch mapping and device-specific prompts.
- `config.js`: parameter defaults, ranges and units, with Chinese descriptions.
- `settings.js` / `settings.css`: player settings and a separate test panel. “Settings” changes music, effects, spill sounds, mute and first-use hints immediately, without restarting. “···” on the home/pause screen or Shift+D opens test parameters; rule changes restart the run.
- `music.js` / `audio-clock.js` / `assets/audio/`: audio mixing and a round clock that falls back safely if playback stalls; `tools/make_music.py` contains the music synthesis source.
- `assets/home/`: current home background, logo and favicon.
- `tests/`: logic tests that run without a browser or GPU. See the [test notes](tests/README.md).

In-game settings are saved only in the current browser. Player volume preferences survive updates to rule defaults. A brief hint appears the first time each chapter mechanic is encountered; it can be disabled in Settings. Edit `config.js` to change the published defaults. No npm dependencies are required; use Node.js 22 or later:

```sh
npm test
npm run build
```

## Notice

Minors must not drink alcohol. Do not imitate the game’s drinking behavior. The cellar label uses a fictional wine name.

## Development

Developed with assistance from Codex and Grok.
