/// <reference lib="webworker" />
import type { SimInMsg, SimOutMsg } from "./simTypes";

let running = false;
let tick = 0;
let ticksPerSecond = 10;

let goldAccumulator = 0; // local sim state
let goldDeltaSinceLast = 0;

function stepOneTick() {
  tick += 1;

  // Placeholder sim math: gain 1 gold every 10 ticks
  goldAccumulator += 1;
  if (goldAccumulator % 10 === 0) {
    goldDeltaSinceLast += 1;
  }
}

function postSnapshot() {
  const msg: SimOutMsg = {
    type: "SNAPSHOT",
    tick,
    goldDeltaSinceLast,
  };
  goldDeltaSinceLast = 0;
  postMessage(msg);
}

let intervalId: number | null = null;
let snapshotId: number | null = null;

function startLoop() {
  if (intervalId !== null) return;

  const tickMs = Math.max(1, Math.floor(1000 / ticksPerSecond));

  intervalId = self.setInterval(() => {
    if (!running) return;
    stepOneTick();
  }, tickMs);

  // Snapshot cadence: send to UI 4 times/sec
  snapshotId = self.setInterval(() => {
    if (!running) return;
    postSnapshot();
  }, 250);
}

function stopLoop() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (snapshotId !== null) {
    clearInterval(snapshotId);
    snapshotId = null;
  }
}

self.onmessage = (e: MessageEvent<SimInMsg>) => {
  const msg = e.data;

  if (msg.type === "START") {
    running = true;
    startLoop();
  }

  if (msg.type === "STOP") {
    running = false;
    stopLoop();
  }

  if (msg.type === "SET_RATE") {
    ticksPerSecond = Math.max(1, Math.min(240, Math.floor(msg.ticksPerSecond)));
    // Restart intervals to apply new rate
    stopLoop();
    if (running) startLoop();
  }
};
