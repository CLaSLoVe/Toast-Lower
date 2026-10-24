Run the checks with Node.js, with no dependencies:

```sh
node tests/game.test.cjs
```

Use `--quick` to skip the 65 bot/room simulations and nine long campaigns. Use `--report /tmp/toast-report.json`
to save detailed results. `--source /path/to/game.js` can compare an older copy.

The harness runs the actual game in a Node VM and drives its event handlers. Its
DOM, Canvas 2D, audio, storage, and animation scheduling are inert JavaScript
stubs. It never opens a browser or uses a GPU. It checks finite drawing inputs
and game state, not rendered pixels or subjective visual quality.

The transition test deliberately enables the existing debug shortcut to exercise
every floor-break, fall, standup, and endless transition. The bot matrix separately
reports natural play from each room using a fixed seed; it is a regression sample,
not evidence of human completion rates. Nine campaigns compare the game's expert,
human-like, and novice control policies across three seeds. They check that learned
coordination can finish the game; they do not require every run to be perfect.

The contact tests observe actual judgments and change only inputs to distinguish
early, late, correctly timed, and deliberately tipped attempts. Tipping changes the live pose and drains wine but no longer causes a separate leader-splash penalty. No test injects a
winning cup pose. The reward test stages a nearly full hype meter, and the tutorial
test selects exercise 5, but their motion and contact run normally. Eighteen input-shortcut
scenarios cover rapid taps, holding Space, parking then tapping, timing without
moving, body control without wrist control, and holding both wrist keys together.
The VM can override a bot's inputs for these tests without changing the game file.

The current survival rule is wine-only: missed toasts deduct 20% of a full glass and break combos; there is no three-mistake life limit. Checks cover one 3% refill per completed round, one penalty per miss, immediate lethal loss without refill, configurable spill speed/caps, saved parameter validation, empty-glass restart, and control tuning only inside the hidden debug panel. One-handed bot scenarios are diagnostic samples, not a required failure threshold.

The v34 checks also cover symmetric 45-degree angle stops and reversal, removing
reach/contact wrist torque, predictable body coupling, real per-cup wine ceilings
(default floor 60%), stricter perfect timing and recent stability, score-only
perfect/hype defaults, and faster repeat floor smashing. Synthetic judgment cases
isolate timing/stability boundaries; natural campaigns still use only bot inputs.

The v39 chapter checks run with `node tests/chapters.test.cjs`: four chapters and
twelve rooms, fixed-height 2/3/4-note phrases on one music clock, per-note penalties
and once-per-phrase refill, concealed alien targets revealed two beats before zero,
and all three target heights reached with ordinary controls at 90/126/160 BPM.

Run `node tests/mobile.test.cjs` for the mobile input checks: analog diagonal
strength/deadzone, independent two-pointer ownership, no held-toast repeat, all
release paths, coasting and reverse braking, control bounds, automatic landscape under portrait lock, physical touch mapping,
and uninterrupted play across orientation changes.
These simulate pointer events; real-device tactile comfort still needs playtesting.

Run `node tests/navigation.test.cjs` for desktop/mobile return-to-home behavior
from play, pause, tutorial, falling, standup and game over, including a fresh start.
Run `node tests/music.test.cjs` for the music clock and playback lifecycle.
`npm test` runs all focused checks; `npm run test:full` includes the full campaigns.
