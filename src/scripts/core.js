const state = {
  step: 1,
  mode: null,      // 'A' | 'B' | 'C'
  volume: 0,
  zones: [],
  zoneIdSeq: 1,
  fans: [],
  fanIdSeq: 1,
  result: null      // {initial, sustained, requiredQ, notes...}
};
const APP_VERSION = 'v0.6';
function appVersionText(value){ return String(value ?? '').replace(/v0\.5/g, APP_VERSION); }
