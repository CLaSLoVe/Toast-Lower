'use strict';
// Round-local music synchronization. A broken/stalled source must never hold
// the countdown while physics continues, or rewind a phrase after recovery.
window.ToastClock = {
  sample(round, raw, dt = 0) {
    if (round.musicDetached) return null;
    if (!Number.isFinite(raw)) {
      if (round.musicAnchor != null) round.musicDetached = true;
      return null;
    }
    const previous = round.musicSample;
    if (previous != null && raw < previous - 1e-6) { round.musicDetached = true; return null; }
    if (previous != null && Math.abs(raw - previous) < 1e-6) {
      round.musicStall = (round.musicStall || 0) + dt;
      if (round.musicStall > 0.25) round.musicDetached = true;
      return null; // r.t already advances on the simulation clock.
    }
    round.musicSample = raw; round.musicStall = 0;
    return raw;
  },
  reset(round) {
    round.musicAnchor = null; round.musicSample = null; round.musicStall = 0;
    round.musicDetached = false; round.cue = null; round.clockWaiting = false;
  }
};
