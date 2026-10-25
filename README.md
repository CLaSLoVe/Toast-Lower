# Toast Lower

English | [简体中文](README.zh-CN.md)

**[Play now!](https://claslove.github.io/Toast-Lower/)**

## Hard-mode walkthrough

https://github.com/user-attachments/assets/f2ff0433-9575-4edf-9ddb-2efe6dd09d32

Automated playthrough.

## How to play

| Action | Desktop | Mobile (landscape) |
| --- | --- | --- |
| Steady the glass | Q / W or ← / → | Move the left stick sideways |
| Adjust height | O / P or ↓ / ↑ | Move the left stick up or down |
| Toast | Space | Tap the right-hand toast button |
| Smash through the floor | Hold O / ↓ during the floor-break phase | Hold the stick down |
| Pause | Esc / pause button | Top-right pause button |
| Return home | Top-right home button | Top-right home button |

On desktop, R restarts and M mutes. Choose a difficulty or open the tutorial from the home screen. On mobile, diagonal stick input controls both axes; releasing it preserves momentum. The game always uses landscape: with portrait rotation lock enabled, the display and touch controls rotate automatically inside the page.

The red **0s** marks the ideal toast timing. Run out of wine and the game ends. Missed toasts cost wine; completed rounds restore a little. Perfect toasts require both precise timing and a steady glass. Later glasses are smaller and hold less wine.

## Four chapters, twelve stages

| Chapter | Challenge |
| --- | --- |
| Workplace | Adjust your height and learn single toasts |
| Underground transit | Keep the glass steady while everything sways |
| Ancient tomb | Hold a fixed height and hit 2, 3, then 4 consecutive beats |
| Aliens | Three glasses count down together; identify and reach the real target in the final two beats |

Endless mode follows the twelve stages, and the same score keeps accumulating.

Each stage has a fixed set of scoring opportunities. Each beat scores only on its first attempt; retries can advance the stage but award no points or hype. Perfect toasts, combos and completed stages earn bonuses, with an extra bonus for clearing all twelve stages from the beginning. One high score is shared across difficulties and records the difficulty used. The new scoring rules use a separate record; legacy records remain in local storage.

## Ranks

Your final score determines your title. Scores below are entry thresholds; the first title is exclusive to zero points. Titles match the Chinese names in the game, with captions translated here.

| Score | Title | Caption |
| --- | --- | --- |
| 0 | 成年香蕉 | You grew hands. Almost. |
| 1 | 卧龙凤雏 | Two legendary strategists. One on each wrist. |
| 4,500 | 小孩那桌 | Back to the kids' table. |
| 12,000 | 夹菜我转桌 | Table manners were never the plan. |
| 30,000 | 乌鸦哥 | Can't toast the table? Flip it. |
| 65,000 | 端水大师 | Keep the glass level and everyone happy. |
| 130,000 | 懂事长 | Toasted your way into management. |
| 230,000 | 敬酒悍匪 | Taking the offensive. |
| 360,000 | 国家一级陪酒员 | Practically licensed for this. |
| 550,000 | 先天敬酒圣体 | Born for this banquet. |
| 850,000 | 铁血山东 👍 | Social etiquette: maxed out. |
| 1,200,000 | DeepDrink | A large toasting model. |

## Run locally

From the project directory:

```sh
python3 -m http.server 8783 --bind 127.0.0.1
```

Open <http://127.0.0.1:8783/> in your browser.

## Editing and checks

- `game.js`: rendering, physics, stages and controls.
- `config.js`: parameter defaults, ranges and units, with Chinese descriptions.
- `settings.js` / `settings.css`: hidden debug settings. Click “···” on the home or pause screen, or press Shift+D.
- `music.js` / `assets/audio/`: music playback and beat clock; `tools/make_music.py` contains the music synthesis source.
- `assets/home/`: current home background, logo and favicon.
- `tests/`: logic tests that run without a browser or GPU. See the [test notes](tests/README.md).

In-game settings are saved only in the current browser. Edit `config.js` to change the published defaults. No npm dependencies are required; use Node.js 22 or later:

```sh
npm test
npm run build
```

## Development

Developed with assistance from Codex and Grok.
