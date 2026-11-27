// Seeded RNG (mulberry32). The state is a plain number kept in the game state,
// so a game can be saved, replayed and tested.

export function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randInt = (state, n) => Math.floor(nextRandom(state) * n);
export const d6 = (state) => 1 + randInt(state, 6);
export const rollDice = (state, n) => Array.from({ length: Math.max(0, n) }, () => d6(state));
export const countHits = (dice) => dice.filter((d) => d >= 5).length;
export const pick = (state, arr) => arr[randInt(state, arr.length)];

export function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
