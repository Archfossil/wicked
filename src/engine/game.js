// The game flow: setup, the six phases of a round, and every player action.
// The engine is a state machine. `state.step` says who must act; players send
// actions with applyAction(); automatic phases run in advance().
import { loadSet, buildDeck } from "./data.js";
import { shuffle, randInt, rollDice, countHits } from "./rng.js";
import { makeMarket, refill, take, shiftOldest, drawCard } from "./market.js";
import {
  CLASSES, DEFAULT_CONFIG, DUNGEON_SPACES, GRID, HAND_LIMIT, LURE, MAX_SUSTAINED, STARTING_COINS,
} from "./config.js";
import {
  def, name, log, fail, RuleError, livePlayers, turnOrder, activeVillain, villainPower, topRoom, heroArrives,
  heroesInTown, treasureBreakdown, overflow, gainMinions, gainTrick, fireEvent, checkStateObjectives, damageHero,
  healHero, hasStatus, freshTrip, champLevelEffects, pname, heroInLandsOf,
} from "./core.js";
import { activate, destroyTop } from "./effects.js";
import { resolveAdventure, healVillain } from "./adventure.js";

export { RuleError };

// ---------- creation ----------
function newPlayer(id, seat) {
  return {
    id, name: seat.name || `Villain ${id + 1}`, isBot: !!seat.isBot,
    villains: [], activeVillain: null, draftPack: [],
    hand: { rooms: [], tricks: [] }, exhausted: [], pendingTricks: [], startingTricksLeft: 0,
    dungeon: Array.from({ length: DUNGEON_SPACES }, () => ({ stack: [], champion: null })),
    championReserve: [], minions: [], minionTargets: [],
    overworld: Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => ({ terrain: null, monster: null }))),
    coins: STARTING_COINS, treasury: [], treasureTokens: [], sustained: [], souls: 0, soulsTotal: 0,
    claimed: [], eliminated: false, powerUsed: false, needsVillainChoice: false,
    allow: { placements: 0, monsterMoves: 0, championMoves: 0, treasureBuys: 0 },
    exchangesUsed: {}, buffs: [], buildNotes: [],
    round_: freshRound(),
  };
}
const freshRound = () => ({ lootTiers: [], kills: 0, harvested: false, dungeonKill: false, tricks: 0 });

/** seats: [{ name, isBot }] */
export function createGame(seats, { seed = Date.now(), config = {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { cards, region } = loadSet(cfg.set);
  const n = seats.length;
  if (n < 1 || n > 6) fail("The game seats 1 to 6 players.");
  const state = {
    config: cfg, seed, rng: seed >>> 0, round: 0, phase: "setup", step: null,
    players: seats.map((s, i) => newPlayer(i, s)),
    heroes: [], fallen: [], townShop: [], log: [], logSeq: 0, lureBonus: {}, lureGold: {},
    buildSnapshot: null, result: null, firstPlayer: 0,
  };
  const deck = (k) => shuffle(state, buildDeck(cards, region.decks[k]));
  state.heroDeck = dealHeroDeck(state, cards, region);
  if (cfg.heroDeckLimit) state.heroDeck = state.heroDeck.slice(-Math.max(n + 1, cfg.heroDeckLimit));
  state.itemDeck = deck("items");
  state.trickDeck = deck("tricks");
  state.trickDiscard = [];
  state.villainDeck = deck("villains");
  state.markets = {
    dungeon: makeMarket("dungeon", n + 2, deck("rooms")),
    terrain: makeMarket("terrain", n + 2, deck("terrain"), deck("monsters")),
    champion: makeMarket("champion", 3, deck("champions")),
    treasure: makeMarket("treasure", n + 2, deck("treasures")),
    objective: makeMarket("objective", n + 2, deck("objectives")), // never drops its oldest: an Objective stays until claimed
  };
  for (const m of Object.values(state.markets)) refill(state, m);
  state.firstPlayer = randInt(state, n);
  for (const p of state.players) {
    p.draftPack = state.villainDeck.splice(-5);
  }
  log(state, `A new age of villainy begins. ${n} villain${n > 1 ? "s" : ""} gather. ${state.players[state.firstPlayer].name} goes first.`, { kind: "phase" });
  beginSim(state, "draftVillain", { pick: 1 });
  return state;
}

/**
 * Each game deals its own Hero deck from the Region's Hero pool, in the shape the
 * Region sets (region.heroDeck.perClass, e.g. 3 Common, 2 Paragon, 1 Legendary per
 * class). The pool gives variety; the deck's size still ends the game.
 */
function dealHeroDeck(state, cards, region) {
  const pool = shuffle(state, buildDeck(cards, region.decks.heroes));
  const shape = region.heroDeck?.perClass;
  if (!shape) return pool;
  const out = [];
  for (const cls of CLASSES) for (const [tier, n] of Object.entries(shape)) {
    out.push(...pool.filter((h) => cards[h.id].class === cls && cards[h.id].tier === tier).slice(0, n));
  }
  return shuffle(state, out);
}

// ---------- steps ----------
function beginSim(state, type, extra = {}, pids = livePlayers(state).map((p) => p.id)) {
  state.step = { type, mode: "sim", waiting: [...pids], ...extra };
}
function beginSeq(state, type, order = turnOrder(state), extra = {}) {
  state.step = { type, mode: "seq", order, idx: 0, ...extra };
  skipEliminated(state);
}
function skipEliminated(state) {
  const s = state.step;
  while (s.idx < s.order.length && state.players[s.order[s.idx]].eliminated) s.idx++;
}

export function mustAct(state) {
  const s = state.step;
  if (!s || state.phase === "gameOver") return [];
  if (s.mode === "sim") return [...s.waiting];
  return s.idx < s.order.length ? [s.order[s.idx]] : [];
}

function stepDone(state) {
  const s = state.step;
  return s.mode === "sim" ? s.waiting.length === 0 : s.idx >= s.order.length;
}
function finishTurn(state, pid) {
  const s = state.step;
  if (s.mode === "sim") s.waiting = s.waiting.filter((x) => x !== pid);
  else { s.idx++; skipEliminated(state); }
}

function advance(state) {
  let guard = 0;
  while (state.phase !== "gameOver" && state.step && stepDone(state)) {
    if (++guard > 50) throw new Error("advance loop");
    onStepComplete(state);
  }
}

function onStepComplete(state) {
  const s = state.step;
  switch (s.type) {
    case "draftVillain": {
      const n = state.players.length;
      const packs = state.players.map((p) => p.draftPack);
      state.players.forEach((p, i) => { p.draftPack = packs[(i - 1 + n) % n]; }); // pass left
      if (s.pick < 3) { beginSim(state, "draftVillain", { pick: s.pick + 1 }); return; }
      for (const p of state.players) p.draftPack = [];
      log(state, "Each villain secretly chooses who rules their dungeon first.", { kind: "phase" });
      beginSim(state, "chooseVillain", { reason: "setup" });
      return;
    }
    case "chooseVillain": {
      for (const p of state.players) {
        if (p.activeVillain == null) continue;
        const v = p.villains[p.activeVillain];
        if (!v.revealed) { v.revealed = true; log(state, `${p.name}'s Villain is ${name(state, v.card)}.`, { kind: "villain", pid: p.id }); }
        p.needsVillainChoice = false;
      }
      if (s.reason === "setup") {
        for (const p of state.players) {
          p.startingTricksLeft = 2;
          gainTrick(state, p, "starting Trick 1 of 3");
        }
        beginSim(state, "startingTricks");
        return;
      }
      endPhaseA(state);
      return;
    }
    case "startingTricks": {
      const order = turnOrder(state);
      const snake = [];
      for (let r = 0; r < 5; r++) snake.push(...(r % 2 ? [...order].reverse() : order));
      log(state, "Opening Room draft (snake order).", { kind: "phase" });
      beginSeq(state, "roomDraft", snake);
      return;
    }
    case "roomDraft":
      for (let i = 0; i < state.players.length; i++) heroArrives(state);
      startRound(state);
      return;
    case "town": beginBuild(state); return;
    case "build": revealBuild(state); return;
    case "buildTricks":
      state.phase = "lure";
      log(state, "— Lure Phase —", { kind: "phase" });
      for (const p of state.players) p.minionTargets = [];
      beginSeq(state, "lure");
      return;
    case "lure":
      resolveLure(state);
      state.phase = "adventure";
      log(state, "— Adventure Phase —", { kind: "phase" });
      beginSeq(state, "adventure");
      return;
    case "adventure":
      resolveAdventure(state);
      if (state.phase === "gameOver") return;
      if (livePlayers(state).some((p) => p.needsVillainChoice)) {
        beginSim(state, "chooseVillain", { reason: "vanquish" }, livePlayers(state).filter((p) => p.needsVillainChoice).map((p) => p.id));
        return;
      }
      endPhaseA(state);
      return;
    case "end": endPhaseB(state); return;
    default: throw new Error(`unknown step ${s.type}`);
  }
}

// ---------- round ----------
function startRound(state) {
  state.round++;
  state.phase = "upkeep";
  if (state.round > 1) {
    const n = state.players.length;
    let f = state.firstPlayer;
    do { f = (f + 1) % n; } while (state.players[f].eliminated);
    state.firstPlayer = f;
  }
  log(state, `══ Round ${state.round} ══ First player: ${state.players[state.firstPlayer].name}`, { kind: "round" });
  for (const p of livePlayers(state)) upkeep(state, p);
  const cfg = state.config;
  shiftOldest(state, state.markets.dungeon);
  if (cfg.shiftTerrainMarket) shiftOldest(state, state.markets.terrain);
  if (cfg.shiftChampionMarket) shiftOldest(state, state.markets.champion);
  if (cfg.shiftTreasureMarket) shiftOldest(state, state.markets.treasure);

  state.phase = "town";
  log(state, "— Town Phase —", { kind: "phase" });
  if (!heroArrives(state)) log(state, "The Hero deck is empty: no more Heroes will come.", { kind: "hero" });
  beginSeq(state, "town");
}

function upkeep(state, p) {
  p.coins += 1;
  p.buffs = []; p.round_ = freshRound(); p.exchangesUsed = {};
  p.allow = { placements: 0, monsterMoves: 0, championMoves: 0, treasureBuys: 0 };
  for (const e of villainPower(state, p, (e) => e.when === "upkeep")) {
    if (e.op === "gainCoins") { p.coins += e.amount; log(state, `${p.name} gains ${e.amount} extra Coin (Villain).`, { pid: p.id }); }
    if (e.op === "gainMinion") gainMinions(state, p, e.amount, "Villain");
  }
  for (const x of p.exhausted) x.refreshIn--;
  const ready = p.exhausted.filter((x) => x.refreshIn <= 0);
  p.exhausted = p.exhausted.filter((x) => x.refreshIn > 0);
  for (const x of ready) p.hand.tricks.push(x.card);
  p.powerUsed = false;
  for (const s of p.sustained) s.exhausted = false;
  p.dungeon.forEach((sp, i) => {
    const top = topRoom(sp);
    if (!top) return;
    if (sp.champion) sp.champion.used = false;
    for (const e of def(state, top).effect) if (e.when === "upkeep" && e.op === "gainMinion") gainMinions(state, p, e.amount, name(state, top));
    for (const below of sp.stack.slice(0, -1)) {
      for (const e of def(state, below).coveredBonus) if (e.when === "upkeep" && e.op === "gainCoins") { p.coins += e.amount; log(state, `${p.name} gains ${e.amount} Coin (covered ${name(state, below)}).`, { pid: p.id }); }
    }
    const tr = def(state, top).treasure;
    if (tr?.when === "upkeep") p.treasureTokens.push({ type: tr.type, value: tr.value });
    if (sp.champion) for (const e of champLevelEffects(state, sp.champion)) if (e.when === "upkeep" && e.op === "gainMinion") gainMinions(state, p, e.amount, name(state, sp.champion.card));
  });
}

function beginBuild(state) {
  state.phase = "build";
  log(state, "— Build Phase — (everyone builds in secret, then reveals)", { kind: "phase" });
  state.buildSnapshot = {};
  for (const p of livePlayers(state)) {
    p.allow.placements = 1; p.allow.monsterMoves = 1; p.allow.championMoves = 1;
    p.buildNotes = [];
    state.buildSnapshot[p.id] = structuredClone({ dungeon: p.dungeon, overworld: p.overworld, minions: p.minions, championReserve: p.championReserve, sustained: p.sustained, treasury: p.treasury, coins: p.coins });
  }
  beginSim(state, "build");
}

function revealBuild(state) {
  state.buildSnapshot = null;
  for (const p of livePlayers(state)) {
    log(state, p.buildNotes.length ? `${p.name} reveals: ${p.buildNotes.join("; ")}.` : `${p.name} builds nothing.`, { pid: p.id, kind: "build" });
    p.buildNotes = [];
    p.allow.placements = 0; p.allow.monsterMoves = 0;
  }
  log(state, "Tricks are played one at a time in turn order.", { kind: "phase" });
  beginSeq(state, "buildTricks");
}

function resolveLure(state) {
  // Town Minion targets: anything unset or stale goes to the Hero this dungeon has tempted most.
  const town = heroesInTown(state);
  for (const p of livePlayers(state)) {
    const n = p.minions.filter((m) => m === "town").length;
    for (let k = 0; k < n; k++) {
      if (!town.some((h) => h.uid === p.minionTargets[k]) && town.length) {
        const best = [...town].sort((a, b) => (b.tempts[p.id] ?? 0) - (a.tempts[p.id] ?? 0))[0];
        p.minionTargets[k] = best.uid;
      }
    }
    p.minionTargets.length = n;
  }
  for (const h of town) {
    const d = def(state, h);
    for (const pid of turnOrder(state)) {
      const p = state.players[pid];
      if (!activeVillain(state, p)) continue;
      const { total } = treasureBreakdown(state, p, d.class, h.uid);
      let tempted = false, how = "";
      if (total >= d.desire) { tempted = true; how = `treasure ${total} ≥ desire ${d.desire}`; }
      else if (total > 0) {
        const roll = rollDice(state, total);
        tempted = countHits(roll) > 0;
        how = `treasure ${total} < ${d.desire}, rolled ${roll.join(" ")}`;
      }
      const minions = p.minionTargets.filter((u) => u === h.uid).length;
      const bonus = (state.lureBonus[pid]?.[h.uid] ?? 0) + minions;
      const add = (tempted ? 1 : 0) + bonus;
      if (!add) continue;
      h.tempts[pid] = (h.tempts[pid] ?? 0) + add;
      const why = [tempted && how, minions && `${minions} Minion${minions > 1 ? "s" : ""}`, bonus - minions > 0 && "Tricks"].filter(Boolean).join(", ");
      log(state, `${d.name} is tempted by ${p.name} (+${add}: ${why}) → ${h.tempts[pid]}/${LURE[d.tier]}.`, { kind: "lure", pid });
      if (h.tempts[pid] >= LURE[d.tier]) {
        const rivals = Object.entries(h.tempts).some(([q, t]) => Number(q) !== pid && t > 0);
        if (rivals) fireEvent(state, pid, { op: "luredAway" });
        h.tempts = {};
        h.loc = { at: "overworld", owner: pid, r: 0, c: 0 };
        h.trip = freshTrip(state, h);
        h.trip.justLured = true;
        log(state, `${d.name} is LURED to ${p.name}'s lands!`, { kind: "lured", pid });
        break;
      }
    }
  }
  state.lureBonus = {}; state.lureGold = {};
}

function endPhaseA(state) {
  state.phase = "end";
  log(state, "— End Phase —", { kind: "phase" });
  for (const h of [...state.heroes]) {
    if (h.loc.at === "town" || !hasStatus(h, "Bleeding")) continue;
    const where = h.loc.at === "overworld" ? "overworld" : h.loc.at === "fight" ? "villainFight" : "dungeon";
    log(state, `${name(state, h)} bleeds (−1 Health).`, { kind: "status" });
    damageHero(state, h, 1, { killer: h.loc.owner, where, by: "land", space: h.loc.space ?? null });
  }
  const aco = overflow(state, "Acolyte");
  if (aco) for (const h of state.heroes) if (h.loc.at !== "town" && healHero(state, h, aco)) log(state, `${name(state, h)} heals (Acolyte overflow).`, { kind: "hero" });
  const rogue = overflow(state, "Rogue");
  for (const p of livePlayers(state)) {
    const loot = p.round_.lootTiers.reduce((n, t) => n + Math.max(0, t - rogue), 0);
    if (p.round_.lootTiers.length) { p.coins += loot; log(state, `${p.name} loots ${loot} Coin${loot === 1 ? "" : "s"}${rogue ? ` (−${rogue} each: Rogue overflow)` : ""}.`, { pid: p.id }); }
    for (const e of villainPower(state, p, (e) => e.when === "end")) {
      if (e.op === "healVillain" && p.round_.dungeonKill) healVillain(state, p, e.amount, "Villain power");
      if (e.op === "gainTrick" && p.round_.harvested) gainTrick(state, p, "Villain power");
    }
    p.allow.treasureBuys = state.config.treasureBuysPerEnd;
  }
  beginSeq(state, "end");
}

function endPhaseB(state) {
  checkStateObjectives(state);
  for (const h of state.heroes) {
    for (const s of h.statuses) s.rounds--;
    h.statuses = h.statuses.filter((s) => s.rounds > 0);
  }
  if (!state.heroDeck.length && !state.heroes.length) { finish(state); return; }
  startRound(state);
}

function finish(state) {
  state.phase = "gameOver";
  state.step = null;
  for (const p of state.players) for (const v of p.villains) v.revealed = true;
  const standings = rankPlayers(state);
  const top = standings[0];
  const same = (a, b) => a.objectives === b.objectives && a.souls === b.souls && a.coins === b.coins;
  const winners = top ? standings.filter((s) => same(s, top)).map((s) => s.pid) : [];
  state.result = { heroesWin: false, winners, standings, solo: state.players.length === 1 };
  log(state, `The last Hero has fallen. ${winners.map((w) => pname(state, w)).join(" and ")} ${winners.length > 1 ? "share" : "becomes"} the Overlord!`, { kind: "gameover" });
}

/** Most Objectives claimed, then most souls harvested in total, then most Coins. Eliminated players can't win. */
export function rankPlayers(state) {
  return livePlayers(state)
    .map((p) => ({ pid: p.id, objectives: p.claimed.length, souls: p.soulsTotal, coins: p.coins }))
    .sort((a, b) => b.objectives - a.objectives || b.souls - a.souls || b.coins - a.coins);
}

// ---------- actions ----------
const needPhase = (state, ...types) => { if (!types.includes(state.step.type)) fail("You can't do that now."); };
const findIdx = (arr, uid, what) => { const i = arr.findIndex((c) => c.uid === uid); if (i < 0) fail(`You don't have that ${what}.`); return i; };
const checkSpace = (i) => { if (!(Number.isInteger(i) && i >= 0 && i < DUNGEON_SPACES)) fail("Pick a dungeon space."); };
const checkSquare = (sq) => { if (!Array.isArray(sq) || !sq.every((x) => Number.isInteger(x) && x >= 0 && x < GRID)) fail("Pick an Overworld square."); };

export function applyAction(state, pid, action) {
  if (state.phase === "gameOver") fail("The game is over.");
  const p = state.players[pid];
  if (!p) fail("No such player.");
  if (!action || typeof action.type !== "string") fail("Bad action.");

  if (action.type === "chooseTrick") {
    const opts = p.pendingTricks[0];
    if (!opts) fail("Nothing to choose.");
    const k = action.index;
    if (!(k >= 0 && k < opts.length)) fail("Pick one of the Tricks.");
    p.pendingTricks.shift();
    p.hand.tricks.push(opts[k]);
    opts.forEach((c, i) => { if (i !== k) state.trickDiscard.push(c); });
    log(state, `${p.name} keeps a Trick.`, { pid });
    if (state.step.type === "startingTricks") {
      if (p.startingTricksLeft > 0) { p.startingTricksLeft--; gainTrick(state, p, `starting Trick ${3 - p.startingTricksLeft} of 3`); }
      else finishTurn(state, pid);
    }
    advance(state);
    return state;
  }

  if (!mustAct(state).includes(pid)) fail("It's not your turn.");
  const t = state.step.type;
  const handlers = STEP_ACTIONS[t];
  const h = handlers?.[action.type];
  if (!h) fail(`"${action.type}" isn't allowed during ${t}.`);
  h(state, p, action);
  advance(state);
  return state;
}

function done(state, p) {
  if (p.pendingTricks.length) fail("Choose your Trick first.");
  finishTurn(state, p.id);
}

const note = (state, p, text) => {
  if (state.step.type === "build") { p.buildNotes.push(text); log(state, `(you) ${text}`, { only: p.id, pid: p.id }); }
  else log(state, `${p.name}: ${text}.`, { pid: p.id, kind: "build" });
};

const build = {
  placeRoom(state, p, a) {
    checkSpace(a.space);
    if (p.allow.placements <= 0) fail("You've used your placement this Build Phase.");
    const i = findIdx(p.hand.rooms, a.uid, "Room");
    const [room] = p.hand.rooms.splice(i, 1);
    const sp = p.dungeon[a.space];
    const covering = topRoom(sp);
    sp.stack.push(room);
    p.allow.placements--;
    note(state, p, `builds ${name(state, room)} in space ${a.space + 1}${covering ? ` on top of ${name(state, covering)}` : ""}`);
  },
  placeChampion(state, p, a) {
    checkSpace(a.space);
    if (p.allow.placements <= 0) fail("You've used your placement this Build Phase.");
    const i = findIdx(p.championReserve, a.uid, "Champion");
    const sp = p.dungeon[a.space];
    if (!topRoom(sp)) fail("A Champion must be placed in a Room.");
    const [ch] = p.championReserve.splice(i, 1);
    if (sp.champion) { state.markets.champion.discard.push(sp.champion.card); note(state, p, `dismisses ${name(state, sp.champion.card)}`); }
    sp.champion = { card: ch, level: 0, used: false };
    p.allow.placements--;
    note(state, p, `places ${name(state, ch)} in space ${a.space + 1}`);
  },
  moveChampion(state, p, a) {
    checkSpace(a.from); checkSpace(a.to);
    if (p.allow.championMoves <= 0) fail("You can move only one Champion per Build Phase.");
    const from = p.dungeon[a.from], to = p.dungeon[a.to];
    if (!from.champion) fail("No Champion there.");
    if (to.champion) fail("That space already has a Champion.");
    to.champion = from.champion; from.champion = null;
    p.allow.championMoves--;
    note(state, p, `moves ${name(state, to.champion.card)} to space ${a.to + 1}`);
  },
  advanceChampion(state, p, a) {
    checkSpace(a.space);
    const ch = p.dungeon[a.space].champion;
    if (!ch) fail("No Champion there.");
    const d = def(state, ch.card);
    const lvl = d.levels[ch.level];
    if (!lvl) fail(`${d.name} is at their top level.`);
    if (p.coins < lvl.coins) fail(`Advancing costs ${lvl.coins} Coins.`);
    p.coins -= lvl.coins; ch.level++;
    note(state, p, `pays ${d.name} ${lvl.coins} Coins: level ${ch.level} (${lvl.effect.map((e) => e.text).join(" ")})`);
    if (ch.level === d.levels.length) fireEvent(state, p.id, { op: "championMaxLevel" });
  },
  destroyOwnRoom(state, p, a) {
    checkSpace(a.space);
    if (!topRoom(p.dungeon[a.space])) fail("That space is empty.");
    note(state, p, `destroys their own ${name(state, topRoom(p.dungeon[a.space]))} in space ${a.space + 1}`);
    destroyTop(state, p, a.space);
  },
  moveMonster(state, p, a) {
    checkSquare(a.from); checkSquare(a.to);
    if (p.allow.monsterMoves <= 0) fail("No Monster moves left this Build Phase.");
    const from = p.overworld[a.from[0]][a.from[1]], to = p.overworld[a.to[0]][a.to[1]];
    if (from === to) fail("Pick a different square.");
    if (!from.monster) fail("No Monster there.");
    if (!to.terrain) fail("Monsters can only stand on Terrain.");
    const m = from.monster;
    [from.monster, to.monster] = [to.monster, from.monster];
    p.allow.monsterMoves--;
    note(state, p, `${from.monster ? "swaps" : "moves"} ${name(state, m)} to (${a.to[0] + 1},${a.to[1] + 1})`);
  },
  orderMinion(state, p, a) {
    if (!(a.index >= 0 && a.index < p.minions.length)) fail("No such Minion.");
    if (!(a.to === "home" || a.to === "town")) checkSpace(a.to);
    p.minions[a.index] = a.to;
  },
  swapItem(state, p, a) {
    const i = findIdx(p.treasury, a.uid, "stored Item");
    if (def(state, p.treasury[i]).deck !== "items") fail("That's not an Item.");
    const [item] = p.treasury.splice(i, 1);
    if (p.sustained.length >= MAX_SUSTAINED) {
      const j = p.sustained.findIndex((s) => s.card.uid === a.replace);
      if (j < 0) { p.treasury.splice(i, 0, item); fail("Choose which sustained Item to put away."); }
      p.treasury.push(p.sustained.splice(j, 1)[0].card);
    }
    p.sustained.push({ card: item, exhausted: true });
    log(state, `${p.name} now sustains ${name(state, item)}.`, { pid: p.id, only: state.step.type === "build" ? p.id : undefined });
    if (p.sustained.length >= 2) fireEvent(state, p.id, { op: "sustainedItems", count: p.sustained.length });
  },
  activate(state, p, a) {
    if (a.src?.kind === "trick") fail("Tricks are played after the reveal, one at a time in turn order.");
    activate(state, p, "build", a.src, a.targets);
  },
  done,
};

const STEP_ACTIONS = {
  draftVillain: {
    draftVillain(state, p, a) {
      const i = findIdx(p.draftPack, a.uid, "Villain");
      const [v] = p.draftPack.splice(i, 1);
      p.villains.push({ card: v, damage: 0, vanquished: false, revealed: false });
      finishTurn(state, p.id);
    },
  },
  chooseVillain: {
    chooseVillain(state, p, a) {
      const i = p.villains.findIndex((v) => v.card.uid === a.uid && !v.vanquished);
      if (i < 0) fail("Choose one of your remaining Villains.");
      p.activeVillain = i;
      finishTurn(state, p.id);
    },
  },
  startingTricks: {},
  roomDraft: {
    draftRoom(state, p, a) {
      const m = state.markets.dungeon;
      let room;
      if (a.blind) { room = drawCard(state, m); if (!room) fail("The Dungeon deck is empty."); log(state, `${p.name} draws a Room blind.`, { pid: p.id }); }
      else { room = take(state, m, a.slot); if (!room) fail("Pick a Room from the market."); log(state, `${p.name} drafts ${name(state, room)}.`, { pid: p.id }); }
      p.hand.rooms.push(room);
      finishTurn(state, p.id);
    },
  },
  town: {
    townPick(state, p, a) {
      const mk = state.markets;
      if (a.choice === "room") {
        const room = take(state, mk.dungeon, a.slot);
        if (!room) fail("Pick a Room from the market.");
        p.hand.rooms.push(room);
        log(state, `${p.name} takes ${name(state, room)}.`, { pid: p.id });
      } else if (a.choice === "blind") {
        if (!state.config.blindDrawInTown) fail("Blind draws are only for the opening draft (Q-22).");
        const room = drawCard(state, mk.dungeon);
        if (!room) fail("The Dungeon deck is empty.");
        p.hand.rooms.push(room);
        log(state, `${p.name} draws a Room blind.`, { pid: p.id });
      } else if (a.choice === "champion") {
        const ch = mk.champion.slots[a.slot];
        if (!ch) fail("Pick a Champion from the market.");
        const cost = def(state, ch).cost;
        if (p.coins < cost) fail(`${def(state, ch).name} costs ${cost} Coins.`);
        p.coins -= cost;
        take(state, mk.champion, a.slot);
        p.championReserve.push(ch);
        log(state, `${p.name} hires ${def(state, ch).name} for ${cost} Coins.`, { pid: p.id });
        fireEvent(state, p.id, { op: "championHired", cost });
      } else if (a.choice === "terrain") {
        checkSquare(a.square);
        if (!mk.terrain.slots[a.slot]) fail("Pick a Terrain pair from the market.");
        const sq = p.overworld[a.square[0]][a.square[1]];
        if (sq.terrain) fail("Terrain goes on a wasteland square.");
        const pair = take(state, mk.terrain, a.slot);
        sq.terrain = pair.terrain; sq.monster = pair.monster;
        log(state, `${p.name} raises ${name(state, pair.terrain)} with a ${name(state, pair.monster)} at (${a.square[0] + 1},${a.square[1] + 1}).`, { pid: p.id });
      } else fail("Choose a Room, a Champion or a Terrain pair.");
      finishTurn(state, p.id);
    },
    pass(state, p) { log(state, `${p.name} passes.`, { pid: p.id }); finishTurn(state, p.id); },
  },
  build,
  buildTricks: {
    activate(state, p, a) { activate(state, p, "build", a.src, a.targets); },
    placeRoom: build.placeRoom,
    moveMonster: build.moveMonster,
    done,
  },
  lure: {
    minionTarget(state, p, a) {
      const n = p.minions.filter((m) => m === "town").length;
      if (!(a.slot >= 0 && a.slot < n)) fail("No such Minion in Town.");
      if (!heroesInTown(state).some((h) => h.uid === a.hero)) fail("Pick a Hero in Town.");
      p.minionTargets[a.slot] = a.hero;
    },
    activate(state, p, a) { activate(state, p, "lure", a.src, a.targets); },
    done,
  },
  adventure: {
    activate(state, p, a) { activate(state, p, "adventure", a.src, a.targets); },
    done,
  },
  end: {
    buyTreasure(state, p, a) {
      const m = state.markets.treasure;
      const t = m.slots[a.slot];
      if (!t) fail("Pick a Treasure from the market.");
      const d = def(state, t);
      if (p.allow.treasureBuys <= 0) fail("You've bought your Treasure this End Phase (Q-34b).");
      if (p.soulsTotal < d.soulThreshold) fail(`${d.name} needs ${d.soulThreshold} souls harvested in total.`);
      if (p.coins < d.coinCost) fail(`${d.name} costs ${d.coinCost} Coins.`);
      p.coins -= d.coinCost; p.allow.treasureBuys--;
      take(state, m, a.slot);
      p.treasury.push(t);
      log(state, `${p.name} buys ${d.name} (${d.value} ${d.type}) for ${d.coinCost} Coins.`, { pid: p.id });
      fireEvent(state, p.id, { op: "treasureBought", value: d.value });
    },
    soulExchange(state, p, a) {
      checkSpace(a.space);
      const sp = p.dungeon[a.space];
      const rooms = state.config.coveredSoulExchanges ? sp.stack : sp.stack.slice(-1);
      const room = rooms.find((r) => r.uid === a.room) ?? (a.room == null ? rooms[rooms.length - 1] : null);
      const x = room && def(state, room).soulExchanges?.[a.index ?? 0];
      if (!x) fail("That Room has no soul exchange you can use.");
      const key = `${room.uid}:${a.index ?? 0}`;
      if ((p.exchangesUsed[key] ?? 0) >= state.config.soulExchangeUsesPerEnd) fail("You've used that exchange this End Phase (Q-35a).");
      if (p.souls < x.souls) fail(`Needs ${x.souls} souls.`);
      const g = x.gives;
      if (g.op === "advanceChampion") {
        checkSpace(a.target);
        const ch = p.dungeon[a.target].champion;
        if (!ch || ch.level >= def(state, ch.card).levels.length) fail("Pick a Champion who can advance.");
        ch.level++;
        if (ch.level === def(state, ch.card).levels.length) fireEvent(state, p.id, { op: "championMaxLevel" });
      } else if (g.op === "healVillain") healVillain(state, p, g.amount, name(state, room));
      else if (g.op === "gainTrick") gainTrick(state, p, name(state, room));
      else if (g.op === "gainMinion") gainMinions(state, p, g.amount, name(state, room));
      else if (g.op === "gainCoins") p.coins += g.amount;
      p.souls -= x.souls;
      p.exchangesUsed[key] = (p.exchangesUsed[key] ?? 0) + 1;
      log(state, `${p.name} trades ${x.souls} souls at the ${name(state, room)}: ${g.text}`, { pid: p.id });
      fireEvent(state, p.id, { op: "soulExchangeUsed" });
    },
    activate(state, p, a) { activate(state, p, "end", a.src, a.targets); },
    swapItem: build.swapItem,
    discard(state, p, a) {
      const list = a.kind === "trick" ? p.hand.tricks : p.hand.rooms;
      const i = findIdx(list, a.uid, "card");
      const [c] = list.splice(i, 1);
      if (a.kind === "trick") state.trickDiscard.push(c); else state.markets.dungeon.discard.push(c);
      log(state, `${p.name} discards a card.`, { pid: p.id });
    },
    done(state, p) {
      const n = p.hand.rooms.length + p.hand.tricks.length;
      if (n > HAND_LIMIT) fail(`Discard down to ${HAND_LIMIT} cards first (you have ${n}).`);
      done(state, p);
    },
  },
};

/** Testing aid: everything a step accepts. */
export const stepActionTypes = (type) => Object.keys(STEP_ACTIONS[type] ?? {});
export { heroInLandsOf };
