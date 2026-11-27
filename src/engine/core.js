// Shared helpers for the rules engine: card lookup, logging, players, heroes,
// treasure, objectives, deaths and vanquishes.
import { loadSet } from "./data.js";
import { pick, randInt } from "./rng.js";
import {
  CLASSES, CLASS_STAT, GRID, LURE, MAX_MINIONS, MAX_SUSTAINED, TIER_VALUE, TOWN_CAPACITY_DEFAULT,
} from "./config.js";

export const cards = (state) => loadSet(state.config.set).cards;
export const region = (state) => loadSet(state.config.set).region;
export const def = (state, inst) => (inst ? cards(state)[inst.id] : null);
export const name = (state, inst) => def(state, inst)?.name ?? "?";

export function log(state, text, extra = {}) {
  state.log.push({ n: state.logSeq++, round: state.round, phase: state.phase, text, ...extra });
  if (state.log.length > 1500) state.log.splice(0, state.log.length - 1500);
}

export class RuleError extends Error {}
export const fail = (msg) => { throw new RuleError(msg); };

// ---------- players ----------
export const livePlayers = (state) => state.players.filter((p) => !p.eliminated);
export function turnOrder(state) {
  const n = state.players.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = state.players[(state.firstPlayer + i) % n];
    if (!p.eliminated) out.push(p.id);
  }
  return out;
}
export const pname = (state, pid) => state.players[pid]?.name ?? `P${pid + 1}`;
export function activeVillain(state, p) {
  if (p.activeVillain == null) return null;
  return p.villains[p.activeVillain];
}
export const villainDef = (state, p) => def(state, activeVillain(state, p)?.card);
export function villainPower(state, p, pred) {
  const v = villainDef(state, p);
  return v ? v.power.filter(pred) : [];
}
export const hasVillain = (state, p, id) => villainDef(state, p)?.id === id;

// ---------- dungeon helpers ----------
export const topRoom = (space) => (space.stack.length ? space.stack[space.stack.length - 1] : null);
export function lastBuiltSpace(p) {
  for (let i = p.dungeon.length - 1; i >= 0; i--) if (p.dungeon[i].stack.length) return i;
  return -1;
}
export const minionsIn = (p, space) => p.minions.filter((m) => m === space).length;
export const minionsInTown = (p) => p.minions.filter((m) => m === "town").length;
export function gainMinions(state, p, n, why = "") {
  const can = Math.min(n, MAX_MINIONS - p.minions.length);
  for (let i = 0; i < can; i++) p.minions.push("home");
  if (can > 0) log(state, `${p.name} gains ${can} Minion${can > 1 ? "s" : ""}${why ? ` (${why})` : ""}.`, { pid: p.id });
}
export function squares() {
  const out = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) out.push([r, c]);
  return out;
}
export const champLevelEffects = (state, ch) => {
  const d = def(state, ch.card);
  return [...d.roomBonus, ...d.levels.slice(0, ch.level).flatMap((l) => l.effect)];
};

// ---------- town ----------
export const heroesInTown = (state) => state.heroes.filter((h) => h.loc.at === "town");
export function overflow(state, cls) {
  const cap = region(state).town?.capacity ?? TOWN_CAPACITY_DEFAULT;
  const n = heroesInTown(state).filter((h) => def(state, h).class === cls).length;
  return Math.max(0, n - cap);
}
export const heroInLandsOf = (h, pid) => h.loc.at !== "town" && h.loc.owner === pid;

export function maxHealth(state, h) {
  const d = def(state, h);
  return d.stats.health + (d.class === "Warrior" ? 1 : 0);
}
export function freshTrip(state, h) {
  const d = def(state, h);
  const item = h.carrying?.id;
  return {
    statusIgnores: (d.class === "Mage" ? 1 : 0) + (item === "item-spellbook-of-wards" ? 1 : 0),
    trapSkips: (d.class === "Rogue" ? 1 : 0) + (item === "item-lockpicks" ? 1 : 0),
    lingered: false, path: [], moved: false, justLured: false, forcedDir: null,
  };
}
export function returnToTown(state, h) {
  h.loc = { at: "town" };
  h.health = maxHealth(state, h);
  h.statuses = [];
  h.tempts = {};
  h.trip = freshTrip(state, h);
}

export function itemEligible(state, h, item) {
  const d = def(state, h);
  return d.tier !== "Common" && !h.carrying && def(state, item).type === d.class;
}

export function heroArrives(state) {
  const inst = state.heroDeck.pop();
  if (!inst) return null;
  const h = { uid: inst.uid, id: inst.id, carrying: null, statuses: [], tempts: {}, loc: { at: "town" } };
  h.health = maxHealth(state, h);
  const d = def(state, h);
  let note = "";
  if (d.tier !== "Common") {
    const i = state.townShop.findIndex((it) => itemEligible(state, h, it)); // oldest first (Q-36d)
    if (i >= 0) { h.carrying = state.townShop.splice(i, 1)[0]; note = ` and takes ${name(state, h.carrying)} from the Shop`; }
    else {
      const it = state.itemDeck.pop();
      if (it && itemEligible(state, h, it)) { h.carrying = it; note = ` carrying ${name(state, it)}`; }
      else if (it) { state.townShop.push(it); note = `; ${name(state, it)} goes to the Town Shop`; }
    }
  }
  h.trip = freshTrip(state, h);
  state.heroes.push(h);
  log(state, `${d.tier} ${d.class} ${d.name} arrives in Town${note}.`, { kind: "hero" });
  return h;
}

// ---------- statuses ----------
export const hasStatus = (h, s) => h.statuses.some((x) => x.status === s && x.rounds > 0);
export function inflictStatus(state, h, status, rounds, source) {
  if (h.trip.statusIgnores > 0) {
    h.trip.statusIgnores--;
    log(state, `${name(state, h)} shrugs off ${status} (${source}).`, { kind: "hero" });
    return;
  }
  const cur = h.statuses.find((x) => x.status === status);
  if (cur) cur.rounds += rounds; else h.statuses.push({ status, rounds });
  log(state, `${name(state, h)} is ${status} for ${rounds} round${rounds > 1 ? "s" : ""} (${source}).`, { kind: "status" });
}
export function healHero(state, h, n) {
  const cap = state.config.acolyteHealCapped ? maxHealth(state, h) : Infinity;
  const before = h.health;
  h.health = Math.min(cap, h.health + n);
  return h.health - before;
}

// ---------- treasure ----------
/** Treasure a dungeon has for one Hero: own-class treasure + floor(gold / 3). */
export function treasureBreakdown(state, p, cls, heroUid = null) {
  let classT = 0, gold = 0;
  for (const t of p.treasury) {
    const d = def(state, t);
    if (d.deck === "items") { if (d.type === cls) classT += 1; continue; }
    if (d.type === "Gold") gold += d.value; else if (d.type === cls) classT += d.value;
  }
  for (const tok of p.treasureTokens) { if (tok.type === "Gold") gold += tok.value; else if (tok.type === cls) classT += tok.value; }
  p.dungeon.forEach((sp, i) => {
    const top = topRoom(sp);
    const td = top && def(state, top).treasure;
    if (td && td.when === "whileOnTop") { if (td.type === "Gold") gold += td.value; else if (td.type === cls) classT += td.value; }
    if (sp.champion?.card.id === "champion-overseer" && top) {
      const m = minionsIn(p, i);
      if (sp.champion.level >= 2) classT += m; else gold += m;
    }
  });
  if (heroUid && state.lureGold[p.id]?.[heroUid]) gold += state.lureGold[p.id][heroUid];
  return { classT, gold, total: classT + Math.floor(gold / 3) };
}
export function treasureClasses(state, p) {
  return CLASSES.filter((c) => {
    if (p.treasury.some((t) => { const d = def(state, t); return d.type === c; })) return true;
    if (p.treasureTokens.some((t) => t.type === c)) return true;
    return p.dungeon.some((sp) => { const top = topRoom(sp); return top && def(state, top).treasure?.type === c; });
  }).length;
}

// ---------- tricks ----------
/** Gaining a Trick = draw 2, keep 1 (the choice is made with a chooseTrick action). */
export function gainTrick(state, p, why = "") {
  const a = drawTrick(state), b = drawTrick(state);
  const options = [a, b].filter(Boolean);
  if (!options.length) return;
  p.pendingTricks.push(options);
  log(state, `${p.name} gains a Trick${why ? ` (${why})` : ""}: choosing 1 of ${options.length}.`, { pid: p.id });
}
export function drawTrick(state) {
  if (!state.trickDeck.length && state.trickDiscard.length) {
    state.trickDeck = state.trickDiscard.splice(0);
    shuffleInPlace(state, state.trickDeck);
  }
  return state.trickDeck.pop() ?? null;
}
function shuffleInPlace(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = randInt(state, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
}

// ---------- tainted items ----------
export function gainTaintedItem(state, p, item) {
  if (p.sustained.length < MAX_SUSTAINED) {
    p.sustained.push({ card: item, exhausted: false });
    log(state, `${p.name} sustains the Tainted ${name(state, item)}.`, { pid: p.id });
  } else {
    p.treasury.push(item);
    log(state, `${p.name} stores the Tainted ${name(state, item)} in their treasury (swap it in during a Build Phase).`, { pid: p.id });
  }
  if (p.sustained.length >= 2) fireEvent(state, p.id, { op: "sustainedItems", count: p.sustained.length });
}

// ---------- objectives ----------
function eventMatches(trigger, ev, ownerPid, actorPid) {
  if (trigger.op !== ev.op) return false;
  switch (ev.op) {
    case "heroKilled":
      for (const k of ["tier", "class", "where", "by"]) if (trigger[k] !== undefined && trigger[k] !== ev[k]) return false;
      if (trigger.carrying !== undefined && trigger.carrying !== ev.carrying) return false;
      return true;
    case "heroesKilledInRound": case "tricksPlayedInRound": case "sustainedItems": return ev.count >= trigger.count;
    case "roomDestroyed": return trigger.owner !== "other" || ev.owner !== actorPid;
    case "treasureBought": return ev.value >= (trigger.minValue ?? 0);
    case "championHired": return ev.cost >= (trigger.minCost ?? 0);
    case "objectiveLearned": return trigger.target !== "owner" || ev.from === ownerPid;
    default: return true; // championMaxLevel, soulExchangeUsed, villainVanquished, luredAway
  }
}
/** An event done by `actorPid` scores every matching objective on every OTHER player's list. */
export function fireEvent(state, actorPid, ev) {
  for (const q of state.players) {
    if (q.id === actorPid) continue;
    for (const o of q.objectives) {
      if (o.scoredBy != null) continue;
      const d = def(state, o.card);
      if (d.kind !== "event" || !eventMatches(d.trigger, ev, q.id, actorPid)) continue;
      o.scoredBy = actorPid; o.revealed = true;
      log(state, `🎯 ${pname(state, actorPid)} scores "${d.text}" against ${q.name}.`, { kind: "objective" });
    }
  }
}
export function stateObjectiveMet(state, p, trigger) {
  const min = trigger.min ?? 0;
  switch (trigger.op) {
    case "championCount": return p.dungeon.filter((s) => s.champion).length >= min;
    case "stackHeight": return Math.max(0, ...p.dungeon.map((s) => s.stack.length)) >= min;
    case "minionCount": return p.minions.length >= min;
    case "terrainCount": return p.overworld.flat().filter((s) => s.terrain).length >= min;
    case "soulsHarvestedTotal": return p.soulsTotal >= min;
    case "coins": return p.coins >= min;
    case "treasureClasses": return treasureClasses(state, p) >= min;
    case "villainsRemaining": return p.villains.filter((v) => !v.vanquished).length >= min;
    case "taintedItemCount": return p.sustained.length + p.treasury.filter((t) => def(state, t).deck === "items").length >= min;
    case "trapRoomsOnTop": return p.dungeon.filter((s) => { const t = topRoom(s); return t && def(state, t).trap; }).length >= min;
    default: return false;
  }
}
export function revealRandomObjective(state, p) {
  const hidden = p.objectives.filter((o) => !o.revealed);
  if (!hidden.length) return;
  const o = pick(state, hidden);
  o.revealed = true;
  log(state, `${p.name} must reveal an objective: "${def(state, o.card).text}".`, { kind: "objective" });
}

// ---------- deaths ----------
/**
 * A Hero dies. `killer` harvests the soul, gets the Tainted Item and the loot.
 * where: "overworld" | "dungeon" | "villainFight"; by: "land" | "trick" | "power".
 */
export function killHero(state, h, killerPid, where, by, space = null) {
  const idx = state.heroes.indexOf(h);
  if (idx < 0) return;
  state.heroes.splice(idx, 1);
  const d = def(state, h);
  const p = state.players[killerPid];
  state.fallen.push({ uid: h.uid, id: h.id, killer: killerPid, round: state.round });
  let souls = TIER_VALUE[d.tier];
  if (d.tier !== "Common" && hasVillain(state, p, "villain-countess-nocturne")) souls += 1;
  if (space != null) {
    const ch = p.dungeon[space]?.champion;
    if (ch?.card.id === "champion-vampire-count" && ch.level >= 2) souls += 1;
  }
  p.souls += souls; p.soulsTotal += souls;
  p.round_.lootTiers.push(TIER_VALUE[d.tier]);
  p.round_.kills++; p.round_.harvested = true;
  if (where === "dungeon" || where === "villainFight") p.round_.dungeonKill = true;
  log(state, `💀 ${d.name} dies (${where}${by !== "land" ? `, by ${by}` : ""}). ${p.name} harvests ${souls} soul${souls > 1 ? "s" : ""}.`, { kind: "death", pid: p.id });
  const carrying = !!h.carrying;
  if (h.carrying) gainTaintedItem(state, p, h.carrying);
  fireEvent(state, killerPid, { op: "heroKilled", tier: d.tier, class: d.class, where, by, carrying });
  if (p.round_.kills >= 2) fireEvent(state, killerPid, { op: "heroesKilledInRound", count: p.round_.kills });
}

/** Damage a Hero; returns true if it died. ctx = { killer, where, by, space, shield } */
export function damageHero(state, h, amount, ctx) {
  if (amount <= 0) return false;
  if (h.carrying?.id === "item-tower-shield" && ctx.shield && !ctx.shield.used) {
    ctx.shield.used = true; amount -= 1;
    log(state, `${name(state, h)}'s Tower Shield absorbs 1 damage.`, { kind: "hero" });
    if (amount <= 0) return false;
  }
  h.health -= amount;
  if (h.health <= 0) { killHero(state, h, ctx.killer, ctx.where, ctx.by, ctx.space); return true; }
  return false;
}

// ---------- vanquish and elimination ----------
export function vanquish(state, p, h) {
  const v = activeVillain(state, p);
  v.vanquished = true; v.revealed = true;
  log(state, `⚔️ ${name(state, h)} vanquishes ${name(state, v.card)}, ${p.name}'s Villain!`, { kind: "vanquish", pid: p.id });
  fireEvent(state, p.id, { op: "villainVanquished" });
  // steal a sustained Item: own class first, else random (Q-54b)
  if (p.sustained.length) {
    const cls = def(state, h).class;
    const own = p.sustained.filter((s) => def(state, s.card).type === cls);
    const stolen = own.length ? own[0] : pick(state, p.sustained);
    p.sustained.splice(p.sustained.indexOf(stolen), 1);
    if (itemEligible(state, h, stolen.card)) { h.carrying = stolen.card; log(state, `${name(state, h)} takes back ${name(state, stolen.card)}.`); }
    else { state.townShop.push(stolen.card); log(state, `${name(state, stolen.card)} is taken to the Town Shop.`); }
  }
  returnToTown(state, h);
  log(state, `${name(state, h)} returns to Town, healed.`, { kind: "hero" });
  p.activeVillain = null;
  if (p.villains.some((x) => !x.vanquished)) {
    revealRandomObjective(state, p);
    p.needsVillainChoice = true;
  } else eliminate(state, p);
}

export function eliminate(state, p) {
  p.eliminated = true; p.needsVillainChoice = false;
  log(state, `☠️ ${p.name} has lost their last Villain and is eliminated.`, { kind: "vanquish", pid: p.id });
  for (const h of state.heroes) if (heroInLandsOf(h, p.id)) returnToTown(state, h);
  for (const h of state.heroes) delete h.tempts[p.id];
  if (livePlayers(state).length === 0) {
    state.phase = "gameOver";
    state.result = { heroesWin: true, winners: [], standings: [] };
    log(state, "The Heroes have triumphed: every villain is eliminated.", { kind: "gameover" });
  }
}

export { CLASS_STAT, LURE, TIER_VALUE, GRID };
