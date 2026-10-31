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
early, late, correctly timed, and deliberately tipped attempts. Tipping changes the live pose and drains wine but no longer causes a separate leader-splash penalty. Focused tests also inject controlled contact poses to isolate scoring and timing boundaries; natural campaigns use only inputs. The reward test stages a nearly full hype meter, and the tutorial
test selects exercise 5, but their motion and contact run normally. Eighteen input-shortcut
scenarios cover rapid taps, holding Space, parking then tapping, timing without
moving, body control without wrist control, and holding both wrist keys together.
The VM can override a bot's inputs for these tests without changing the game file.

The current survival rule is wine-only: missed toasts deduct 20% of a full glass and break combos; there is no three-mistake life limit. Checks cover one 3% refill per successful round/group, cumulative group penalties, immediate lethal loss without refill, configurable spill speed/caps, saved parameter validation, empty-glass restart, and control tuning only inside the hidden debug panel. One-handed bot scenarios are diagnostic samples, not a required failure threshold.

The v34 checks also cover symmetric 45-degree angle stops and reversal, removing
reach/contact wrist torque, predictable body coupling, real per-cup wine ceilings
(default floor 60%), stricter perfect timing and recent stability, score-only
perfect/hype defaults, and faster repeat floor smashing. Synthetic judgment cases
isolate timing/stability boundaries; natural campaigns still use only bot inputs.

The v39 chapter checks run with `node tests/chapters.test.cjs`: four chapters and
twelve rooms, fixed-height 2/3/4-note phrases on one music clock, cumulative group penalties
and one refill per phrase with at least one hit, concealed alien targets revealed one second before zero,
and all three target heights reached with ordinary controls at 90/126/160 BPM.
They also play a complete hard campaign on both layouts to check sparse, non-repeating
chapter chatter, quiet cue sequences, visible dialogue, and once-per-run smash jokes.
Alien chatter is checked independently of the selected leader.

Run `node tests/mobile.test.cjs` for the mobile input checks: analog diagonal
strength/deadzone, independent two-pointer ownership, no held-toast repeat, all
release paths, coasting and reverse braking, control bounds, automatic landscape under portrait lock, physical touch mapping,
uninterrupted play across orientation changes, and device-specific prompts throughout
the tutorial, floor breaks, judgment feedback and navigation.
These simulate pointer events; real-device tactile comfort still needs playtesting.

Run `node tests/navigation.test.cjs` for desktop/mobile return-to-home behavior
from play, pause, tutorial, falling, standup and game over, including a fresh start.
Run `node tests/music.test.cjs` for the music clock and playback lifecycle.
`npm test` runs all focused checks; `npm run test:full` includes the full campaigns.

Run `node tests/scoring.test.cjs` for fixed opportunity accounting across all story
stages and three endless mechanics, all difficulties, and multiple seeds. Controlled
contact poses isolate the score comparison: failed first attempts, successful retries,
partial chains, duplicate judgments, floor rewards, full-story completion, restart
and shared high-score persistence. Retried slots cannot add points, combos or hype.
Legacy scores remain stored but are not compared with the new scoring formula.

The balance checks (`node tests/balance.test.cjs`) enumerate all 28 binary success
patterns for 2/3/4-note groups, actual wine accounting and conditional refills,
normalized group scores, no contact impulse, saved records and custom-run exclusion,
pause handling in every active state, long-frame recovery, difficulty-specific
chain timing, constant repeat smash charge, endless variants, and both result layouts.
The harness optionally accepts a CPU Canvas context for local pixel review; default
checks remain dependency-free and never request a GPU.
