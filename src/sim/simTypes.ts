export type SimStartMsg = {
  type: "START";
  now: number;
  // seed/config could go here
};

export type SimStopMsg = { type: "STOP" };

export type SimSetRateMsg = {
  type: "SET_RATE";
  ticksPerSecond: number;
};

export type SimInMsg = SimStartMsg | SimStopMsg | SimSetRateMsg;

export type SimSnapshotMsg = {
  type: "SNAPSHOT";
  tick: number;
  goldDeltaSinceLast: number;
};

export type SimOutMsg = SimSnapshotMsg;
