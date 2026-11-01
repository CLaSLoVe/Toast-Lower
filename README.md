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

On desktop, R restarts and M mutes. Open Settings from the home screen or during play to adjust audio; closing it resumes an active game. Choose a difficulty or open the tutorial from the home screen. On mobile, diagonal stick input controls both axes; releasing it preserves momentum. The game always uses landscape: with portrait rotation lock enabled, the display and touch controls rotate automatically inside the page.

The red **0s** marks the ideal toast timing. Run out of wine and the game ends. Missed toasts cost wine; successful rounds restore a little. Perfect toasts require both precise timing and a steady glass. Later glasses are smaller and hold less wine.

Easy keeps forgiving timing. Normal and Hard tighten timing, increase cup drift in the tomb and alien chapters, and spread alien cups farther apart. The height window is 100% / 85% / 65%; Hard starts with a smaller glass holding 80% of the standard full glass, reaching the same 60% minimum later. Stage refills are 10% / 7% / 4%; successful-round refills and grouped penalties stay the same.

## Four chapters, twelve stages

| Chapter | Challenge |
| --- | --- |
| Workplace | Adjust your height and learn single toasts |
| Underground transit | Keep the glass steady while everything sways |
| Ancient tomb | Hold a fixed height and hit 2, 3, then 4 consecutive beats |
| Aliens | Three cups count down from 2 seconds. Only the target’s circle and height guide remain in the final second; the leader steps forward at 0s. The same leader can be picked again |

After stage twelve, the results screen shows your rank, score, difficulty, perfects, misses and wine totals. Choose Continue Endless to keep playing with the same score and resources, or return home. Music continues through the results screen into endless mode.

Each stage has a fixed set of scoring opportunities. Each beat scores only on its first attempt, with a chain sharing one group’s score budget; retries can advance the stage but award no points or hype. Combos and hype settle once per group. Performance drives the score: a perfect toast adds 1,000 points before stage/group scaling, compared with up to 200 height-quality points for an ordinary hit. Stage base rewards are 500 × stage number, and the twelve-stage clear bonus is 5,000. High ranks require accurate play, not just reaching the end. One high score is shared across difficulties and records the difficulty used. It saves on clearing stages and returning home. Custom rules, practice controls, stage skips and automated runs do not replace standard records. This performance-focused scoring version uses a separate record; earlier records remain in local storage.

Successful contact itself consumes no wine. For 2/3/4-note chains, cumulative penalties are 12%/20%, 12%/16%/20%, and 12%/16%/18%/20%. A group with at least one successful note gets one refill (3% by default); an all-miss group gets none. Only a completely successful phrase advances. A partial phrase repeats at the same height, without awarding points for already attempted notes. Percentages use the standard full-glass capacity, including when Hard starts with a smaller glass. Results show actual spills, penalties and refills.

## Ranks

Your final score determines your title. Scores below are entry thresholds; the first title is exclusive to zero points. Titles match the Chinese names in the game, with captions translated here.

| Score | Title | Caption |
| --- | --- | --- |
| 0 | 成年香蕉 | You grew hands. Almost. |
| 1 | 卧龙凤雏 | Two legendary strategists. One on each wrist. |
| 2,500 | 小孩那桌 | Back to the kids' table. |
| 6,500 | 夹菜我转桌 | Table manners were never the plan. |
| 14,000 | 乌鸦哥 | Can't toast the table? Flip it. |
| 30,000 | 端水大师 | Keep the glass level and everyone happy. |
| 70,000 | 懂事长 | Toasted your way into management. |
| 140,000 | 敬酒悍匪 | Taking the offensive. |
| 230,000 | 国家一级陪酒员 | Practically licensed for this. |
| 290,000 | 先天敬酒圣体 | Born for this banquet. |
| 340,000 | 铁血山东 👍 | Social etiquette: maxed out. |
| 380,000 | DeepDrink | A large toasting model. |

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
