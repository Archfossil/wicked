import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, mustAct, RuleError } from "../src/engine/game.js";
import { viewFor } from "../src/engine/view.js";
import { botAction } from "../src/engine/bot.js";
import { makeMarket, refill, take, shiftOldest } from "../src/engine/market.js";
import { exchange, spaceThreat } from "../src/engine/adventure.js";
import { treasureBreakdown, fireEvent, def } from "../src/engine/core.js";
import { playOut } from "../tools/simulate.mjs";

const seats = (n) => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, isBot: true }));

/** Let bots play until the game reaches a step of the given type. */
function playUntil(state, type) {
  for (let i = 0; i < 5000 && state.step?.type !== type; i++) {
    const pid = mustAct(state)[0];
    try { applyAction(state, pid, botAction(state, pid)); }
    catch (e) { if (!(e instanceof RuleError)) throw e; applyAction(state, pid, { type: state.step.type === "town" ? "pass" : "done" }); }
  }
  assert.equal(state.step.type, type);
}

test("market: taking shifts left and refills on the right; a new round drops the oldest", () => {
  const state = { rng: 1 };
  const m = makeMarket("dungeon", 3, ["E", "D", "C", "B", "A"]);
  refill(state, m);
  assert.deepEqual(m.slots, ["A", "B", "C"]);
  assert.equal(take(state, m, 1), "B");
  assert.deepEqual(m.slots, ["A", "C", "D"]);
  shiftOldest(state, m);
  assert.deepEqual(m.slots, ["C", "D", "E"]);
  assert.deepEqual(m.discard, ["A"]);
});

test("setup: villain draft gives 3 villains, 5 opening Rooms, 3 Tricks, 1 Hero per player", () => {
  const s = createGame(seats(3), { seed: 42 });
  playUntil(s, "town");
  for (const p of s.players) {
    assert.equal(p.villains.length, 3);
    assert.equal(p.hand.tricks.length, 3);
    assert.ok(p.hand.rooms.length >= 5);
    assert.equal(p.objectives.filter((o) => o.revealed).length, 1);
    assert.equal(p.coins, 4); // 3 to start + 1 in Upkeep
  }
  assert.equal(s.heroes.length, 4); // 3 at setup + 1 in round 1's Town Phase
});

test("combat: Common Heroes win ties against Monsters but lose them against Champions", () => {
  const s = createGame(seats(2), { seed: 3 });
  const hero = { uid: "h", id: "hero-bram-the-squire", health: 4, statuses: [], carrying: null, trip: {} };
  s.heroes.push(hero);
  const threat = (rank) => ({ name: "T", tests: "magic", dice: 0, damage: 1, rank, parts: [], afterWin: [] });
  // Bram has magic 1; with 0 threat dice, a 0-hit roll is a tie
  for (let seed = 0; seed < 50; seed++) {
    s.rng = seed;
    const m = exchange(s, hero, threat("Monster"), {});
    s.rng = seed;
    const c = exchange(s, hero, threat("Champion"), {});
    if (m.heroHits === 0) { assert.equal(m.heroWins, true); assert.equal(c.heroWins, false); }
  }
});

test("dungeon: covered Rooms add their bonus to the top Room, and a Champion raises the rank", () => {
  const s = createGame(seats(2), { seed: 5 });
  const p = s.players[0];
  p.dungeon[0].stack = [{ uid: "a", id: "room-guard-post" }, { uid: "b", id: "room-pit-trap" }];
  let t = spaceThreat(s, p, 0);
  assert.equal(t.dice, 3 + 1); // pit trap 3 + guard post covered bonus
  assert.equal(t.rank, "Monster");
  assert.equal(t.tests, "cunning");
  p.dungeon[0].champion = { card: { uid: "c", id: "champion-young-dragon" }, level: 0 };
  t = spaceThreat(s, p, 0);
  assert.equal(t.rank, "Champion");
  assert.equal(t.dice, 5 + 1); // the dragon's 5 dice replace the room's 3
  assert.equal(t.damage, 1 + 1);
});

test("treasure: own-class treasure counts in full, Gold at a third", () => {
  const s = createGame(seats(2), { seed: 9 });
  const p = s.players[0];
  p.treasury = [{ uid: "1", id: "treasure-mage-prize" }, { uid: "2", id: "treasure-gold-pile" }, { uid: "3", id: "treasure-warrior-trinket" }];
  p.dungeon[2].stack = [{ uid: "v", id: "room-vault" }];
  assert.deepEqual(treasureBreakdown(s, p, "Mage"), { classT: 2, gold: 6, total: 4 });
  assert.equal(treasureBreakdown(s, p, "Rogue").total, 2);
});

test("objectives: an event scores against other players' lists, never your own", () => {
  const s = createGame(seats(3), { seed: 11 });
  const card = { uid: "o", id: "objective-a-villain-kills-a-legendary-hero" };
  s.players[0].objectives[0] = { card, revealed: false, learnedBy: [], scoredBy: null };
  s.players[1].objectives[0] = { card: { ...card, uid: "o2" }, revealed: false, learnedBy: [], scoredBy: null };
  fireEvent(s, 0, { op: "heroKilled", tier: "Legendary", class: "Mage", where: "dungeon", by: "land", carrying: false });
  assert.equal(s.players[0].objectives[0].scoredBy, null);
  assert.equal(s.players[1].objectives[0].scoredBy, 0);
  assert.equal(s.players[1].objectives[0].revealed, true);
});

test("hidden information: other hands, reserve Villains and hidden objectives stay secret", () => {
  const s = createGame(seats(3), { seed: 13 });
  playUntil(s, "town");
  const v = viewFor(s, 0);
  const other = v.players[1];
  assert.equal(typeof other.hand.rooms, "number");
  assert.equal(other.villains.filter((x) => x.card).length, 1); // only the active one is face-up
  assert.equal(other.objectives.filter((o) => o.card).length, other.objectives.filter((o) => o.revealed).length);
  assert.ok(!JSON.stringify(v).includes("heroDeck\":["));
  assert.equal(v.players[0].villains.filter((x) => x.card).length, 3);
});

test("build phase: other players see your lands as they were until the reveal", () => {
  const s = createGame(seats(2), { seed: 17 });
  playUntil(s, "build");
  const p = s.players[0];
  const room = p.hand.rooms[0];
  applyAction(s, 0, { type: "placeRoom", uid: room.uid, space: 0 });
  assert.equal(viewFor(s, 1).players[0].dungeon[0].stack.length, 0);
  assert.equal(viewFor(s, 0).players[0].dungeon[0].stack.length, 1);
  assert.throws(() => applyAction(s, 0, { type: "placeRoom", uid: p.hand.rooms[0].uid, space: 1 }), RuleError);
});

test("full games finish for every player count", () => {
  for (let n = 1; n <= 6; n++) {
    const s = createGame(seats(n), { seed: 1000 + n, config: { heroDeckLimit: 10 } });
    playOut(s);
    assert.equal(s.phase, "gameOver");
    assert.ok(s.result);
  }
});

test("seeded games replay identically", () => {
  const a = createGame(seats(3), { seed: 99 }); playOut(a);
  const b = createGame(seats(3), { seed: 99 }); playOut(b);
  assert.deepEqual(a.result, b.result);
  assert.equal(a.log.length, b.log.length);
  assert.equal(def(a, a.players[0].villains[0].card).name, def(b, b.players[0].villains[0].card).name);
});
