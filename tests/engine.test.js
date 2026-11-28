import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, mustAct, RuleError, rankPlayers } from "../src/engine/game.js";
import { viewFor } from "../src/engine/view.js";
import { botAction } from "../src/engine/bot.js";
import { makeMarket, refill, take, shiftOldest } from "../src/engine/market.js";
import { exchange, spaceThreat } from "../src/engine/adventure.js";
import { treasureBreakdown, fireEvent, checkStateObjectives, def } from "../src/engine/core.js";
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
    assert.equal(p.claimed.length, 0);
    assert.equal(p.coins, 4); // 3 to start + 1 in Upkeep
  }
  assert.equal(s.heroes.length, 4); // 3 at setup + 1 in round 1's Town Phase
  assert.equal(s.markets.objective.slots.length, 5); // players + 2 face-up Objectives
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

/** Put specific Objectives face-up in the market (replacing what's there). */
function setObjectives(s, ...ids) {
  const m = s.markets.objective;
  m.deck = m.deck.filter((c) => !ids.includes(c.id)); // the deck's own copies would refill the market
  m.slots = ids.map((id, i) => ({ uid: `obj${i}`, id }));
  return m.slots;
}

test("objectives: the villain who does it claims a face-up event Objective and its reward", () => {
  const s = createGame(seats(3), { seed: 11 });
  const [legend] = setObjectives(s, "objective-slay-a-legend", "objective-catcher-of-thieves");
  const p = s.players[1], deckBefore = s.markets.objective.deck.length;
  const { coins, souls, soulsTotal } = p;
  fireEvent(s, 1, { op: "heroKilled", tier: "Legendary", class: "Mage", where: "dungeon", by: "land", carrying: false });
  assert.deepEqual(p.claimed.map((c) => c.uid), [legend.uid]);
  assert.equal(p.coins, coins + 2);
  assert.equal(p.souls, souls + 2);
  assert.equal(p.soulsTotal, soulsTotal); // reward souls are spendable, not harvested (Q-78)
  assert.equal(s.markets.objective.slots.length, s.markets.objective.size); // refilled from the deck
  assert.equal(s.markets.objective.deck.length, deckBefore - (s.markets.objective.size - 1));
  assert.ok(!s.markets.objective.slots.some((c) => c.uid === legend.uid));
  assert.equal(s.players[0].claimed.length + s.players[2].claimed.length, 0);
});

test("objectives: one event claims every matching face-up Objective, but not ones it refills", () => {
  const s = createGame(seats(2), { seed: 12 });
  setObjectives(s, "objective-breaker-of-shields", "objective-dungeon-master");
  s.markets.objective.deck.push({ uid: "next", id: "objective-spoils-of-war" }); // would also match, but wasn't face-up
  fireEvent(s, 0, { op: "heroKilled", tier: "Common", class: "Warrior", where: "dungeon", by: "land", carrying: true });
  assert.equal(s.players[0].claimed.length, 2);
  assert.ok(s.markets.objective.slots.some((c) => c.uid === "next"));
});

test("objectives: 'have X' Objectives are claimed in the End Phase check, ties going to turn order", () => {
  const s = createGame(seats(3), { seed: 14 });
  const [coins] = setObjectives(s, "objective-counting-house", "objective-the-horde");
  s.firstPlayer = 1;
  for (const p of s.players) p.coins = 12; // all three qualify
  checkStateObjectives(s);
  assert.deepEqual(s.players[1].claimed.map((c) => c.uid), [coins.uid]); // first player wins the tie
  assert.equal(s.players[0].claimed.length + s.players[2].claimed.length, 0);
  assert.ok(s.markets.objective.slots.some((c) => c.id === "objective-the-horde")); // nobody has 5 Minions
});

test("objectives: the Overlord has the most Objectives, then souls harvested, then Coins; then a shared win", () => {
  const s = createGame(seats(3), { seed: 15 });
  const give = (p, n) => { p.claimed = Array.from({ length: n }, (_, i) => ({ uid: `c${p.id}${i}`, id: "objective-sabotage" })); };
  const [a, b, c] = s.players;
  give(a, 3); give(b, 3); give(c, 2);
  a.soulsTotal = 5; b.soulsTotal = 5; c.soulsTotal = 9;
  a.coins = 2; b.coins = 4;
  assert.deepEqual(rankPlayers(s).map((x) => x.pid), [1, 0, 2]);
  b.coins = 2;
  const [x, y] = rankPlayers(s);
  assert.deepEqual([x.objectives, x.souls, x.coins], [y.objectives, y.souls, y.coins]); // fully tied: they share it
});

test("hidden information: other hands, reserve Villains and the Objective deck stay secret", () => {
  const s = createGame(seats(3), { seed: 13 });
  playUntil(s, "town");
  const v = viewFor(s, 0);
  const other = v.players[1];
  assert.equal(typeof other.hand.rooms, "number");
  assert.equal(other.villains.filter((x) => x.card).length, 1); // only the active one is face-up
  assert.equal(v.markets.objective.length, 5); // every face-up Objective is public
  assert.ok(!JSON.stringify(v).includes("objectiveDeck\":["));
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

test("overworld: a Monster's home-terrain bonus can add dice or damage", async () => {
  const { monsterThreat } = await import("../src/engine/adventure.js");
  const s = createGame(seats(2), { seed: 5 });
  const p = s.players[0];
  const put = (r, c, terrain, monster) => { p.overworld[r][c] = { terrain: { uid: `t${r}${c}`, id: terrain }, monster: { uid: `m${r}${c}`, id: monster } }; };
  put(0, 0, "terrain-thornwood", "monster-dire-wolf"); // Forest, +1 die at home
  put(0, 1, "terrain-thornwood", "monster-antlered-hunter"); // Forest, +1 damage at home
  put(0, 2, "terrain-hexfen", "monster-antlered-hunter"); // away from home
  const wolf = monsterThreat(s, p, 0, 0), home = monsterThreat(s, p, 0, 1), away = monsterThreat(s, p, 0, 2);
  assert.deepEqual([wolf.dice, wolf.damage], [3, 1]);
  assert.deepEqual([home.dice, home.damage], [3, 2]);
  assert.deepEqual([away.dice, away.damage], [3, 1]);
});

test("objectives: Forged Orders claims a 'have X' Objective early; Rewrite the Prophecy throws one out", async () => {
  const { activate } = await import("../src/engine/effects.js");
  const s = createGame(seats(2), { seed: 16 });
  const [coins, horde] = setObjectives(s, "objective-counting-house", "objective-the-horde");
  const p = s.players[0];
  p.coins = 10; p.souls = 5;
  p.hand.tricks = [{ uid: "fo", id: "trick-forged-orders" }, { uid: "rp", id: "trick-rewrite-the-prophecy" }];
  activate(s, p, "build", { kind: "trick", uid: "fo" }, [coins.uid]);
  assert.deepEqual(p.claimed.map((c) => c.uid), [coins.uid]);
  assert.throws(() => activate(s, p, "build", { kind: "trick", uid: "rp" }, ["nope"]), RuleError);
  activate(s, p, "build", { kind: "trick", uid: "rp" }, [horde.uid]);
  assert.ok(!s.markets.objective.slots.some((c) => c.uid === horde.uid));
  assert.equal(s.markets.objective.slots.length, s.markets.objective.size);
  assert.ok(s.markets.objective.discard.some((c) => c.uid === horde.uid));
});

test("heroes: each game deals a 24-card Hero deck from the larger pool, 3 Common / 2 Paragon / 1 Legendary per class", () => {
  const seen = new Set();
  for (const seed of [1, 2, 3]) {
    const s = createGame(seats(2), { seed });
    const all = [...s.heroDeck, ...s.heroes];
    assert.equal(all.length, 24);
    for (const cls of ["Warrior", "Mage", "Acolyte", "Rogue"]) {
      const mine = all.map((h) => def(s, h)).filter((d) => d.class === cls);
      assert.deepEqual(["Common", "Paragon", "Legendary"].map((t) => mine.filter((d) => d.tier === t).length), [3, 2, 1]);
    }
    for (const h of all) seen.add(h.id);
  }
  assert.ok(seen.size > 24); // different games draw different Heroes
});
