// A simple heuristic bot, for filling seats and for simulation tests.
// It plays legal-looking moves; the engine validates everything, so a bad
// guess is just rejected and the bot moves on.
import { DUNGEON_SPACES, GRID, HAND_LIMIT } from "./config.js";
import { def, topRoom, heroesInTown, activeVillain, squares } from "./core.js";
import { usableSources } from "./effects.js";

function rand(p) {
  let t = (p.botRng = ((p.botRng ?? p.id * 7919 + 17) + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const best = (arr, score) => arr.reduce((b, x) => (b == null || score(x) > score(b) ? x : b), null);

export function roomScore(state, room) {
  const d = def(state, room);
  let s = d.threat ? d.threat.dice + d.threat.damage * 1.5 : 0;
  if (d.treasure) s += 2.5;
  if (d.soulExchanges) s += 1;
  if (d.effect.some((e) => e.op === "gainMinion")) s += 1.5;
  if (d.effect.some((e) => e.op === "inflictStatus")) s += 1;
  return s;
}
const sqWeight = ([r, c]) => 1 / [1, 2, 3, 4, 3, 2, 1][r + c] + (r === c ? 0.05 : 0);

function memo(state, p) {
  const key = `${state.round}:${state.step.type}`;
  if (p.botMemo?.key !== key) p.botMemo = { key, tried: [], n: 0 };
  p.botMemo.n++;
  return p.botMemo;
}

function tryUse(state, p, phase, filter = () => true) {
  const m = memo(state, p);
  const usable = usableSources(state, p, phase).filter((u) => u.affordable && u.targetable && !m.tried.includes(JSON.stringify(u.src)) && filter(u));
  for (const u of usable) {
    m.tried.push(JSON.stringify(u.src));
    if (u.src.kind === "trick" && (u.cost.coins ?? 0) > Math.max(0, p.coins - 2)) continue;
    if (u.src.kind === "trick" && rand(p) < 0.35) continue;
    const targets = u.slots.map((opts) => opts[Math.floor(rand(p) * opts.length)].value);
    return { type: "activate", src: u.src, targets };
  }
  return null;
}

export function botAction(state, pid) {
  const p = state.players[pid];
  const s = state.step;
  if (p.pendingTricks.length) {
    const opts = p.pendingTricks[0];
    const i = opts.findIndex((c) => def(state, c).type === "Spell");
    return { type: "chooseTrick", index: Math.max(0, i) };
  }
  switch (s.type) {
    case "draftVillain": {
      const v = best(p.draftPack, (c) => def(state, c).health + def(state, c).threat.dice * 1.5 + rand(p));
      return { type: "draftVillain", uid: v.uid };
    }
    case "chooseVillain": {
      const v = best(p.villains.filter((x) => !x.vanquished), (x) => def(state, x.card).health - x.damage);
      return { type: "chooseVillain", uid: v.card.uid };
    }
    case "revealObjective": return { type: "revealObjective", index: 0 };
    case "roomDraft": {
      const slots = state.markets.dungeon.slots;
      if (!slots.length) return { type: "draftRoom", blind: true };
      const r = best(slots.map((c, i) => ({ c, i })), (x) => roomScore(state, x.c) + rand(p));
      return { type: "draftRoom", slot: r.i };
    }
    case "town": return townPick(state, p);
    case "build": return buildStep(state, p);
    case "buildTricks": {
      if (p.allow.placements > 0 && p.hand.rooms.length) return placeRoom(state, p);
      return tryUse(state, p, "build") ?? { type: "done" };
    }
    case "lure":
      return tryUse(state, p, "lure") ?? { type: "done" };
    case "adventure":
      return tryUse(state, p, "adventure") ?? { type: "done" };
    case "end": return endStep(state, p);
    default: return { type: "done" };
  }
}

function townPick(state, p) {
  const mk = state.markets;
  const wastes = squares().filter(([r, c]) => !p.overworld[r][c].terrain);
  const hasRoomSpace = p.dungeon.some((sp) => topRoom(sp) && !sp.champion);
  const champs = mk.champion.slots.map((c, i) => ({ c, i })).filter((x) => def(state, x.c).cost <= p.coins);
  const roll = rand(p);
  if (p.hand.rooms.length < 2 && mk.dungeon.slots.length) {
    const r = best(mk.dungeon.slots.map((c, i) => ({ c, i })), (x) => roomScore(state, x.c));
    return { type: "townPick", choice: "room", slot: r.i };
  }
  if (champs.length && hasRoomSpace && !p.championReserve.length && roll < 0.5) {
    const c = best(champs, (x) => def(state, x.c).dice);
    return { type: "townPick", choice: "champion", slot: c.i };
  }
  if (wastes.length && mk.terrain.slots.length && roll < 0.8) {
    const sq = best(wastes, sqWeight);
    const slot = Math.floor(rand(p) * mk.terrain.slots.length);
    return { type: "townPick", choice: "terrain", slot, square: sq };
  }
  if (mk.dungeon.slots.length) {
    const r = best(mk.dungeon.slots.map((c, i) => ({ c, i })), (x) => roomScore(state, x.c));
    return { type: "townPick", choice: "room", slot: r.i };
  }
  return { type: "pass" };
}

function placeRoom(state, p) {
  const room = best(p.hand.rooms, (c) => roomScore(state, c));
  const empty = p.dungeon.findIndex((sp) => !sp.stack.length);
  const space = empty >= 0 ? empty : best([...Array(DUNGEON_SPACES).keys()], (i) => -roomScore(state, topRoom(p.dungeon[i])));
  return { type: "placeRoom", uid: room.uid, space };
}

function buildStep(state, p) {
  const m = memo(state, p);
  if (m.n > 40) return { type: "done" };
  if (p.allow.placements > 0) {
    const free = p.dungeon.map((sp, i) => ({ sp, i })).filter(({ sp }) => topRoom(sp) && !sp.champion);
    if (p.championReserve.length && free.length) {
      const t = best(free, ({ sp }) => roomScore(state, topRoom(sp)));
      return { type: "placeChampion", uid: p.championReserve[0].uid, space: t.i };
    }
    if (p.hand.rooms.length) return placeRoom(state, p);
  }
  for (let i = 0; i < DUNGEON_SPACES; i++) {
    const ch = p.dungeon[i].champion;
    const lvl = ch && def(state, ch.card).levels[ch.level];
    if (lvl && p.coins >= lvl.coins + 4 && !m.tried.includes(`adv${i}`)) { m.tried.push(`adv${i}`); return { type: "advanceChampion", space: i }; }
  }
  const idle = p.minions.findIndex((x) => x === "home");
  if (idle >= 0) {
    const want = p.dungeon.findIndex((sp, i) => { const t = topRoom(sp); return t && def(state, t).minionBonus && !p.minions.includes(i); });
    return { type: "orderMinion", index: idle, to: want >= 0 && rand(p) < 0.5 ? want : "town" };
  }
  const item = p.treasury.find((t) => def(state, t).deck === "items");
  if (item && p.sustained.length < 2) return { type: "swapItem", uid: item.uid };
  const sq = squares();
  const misplaced = sq.find(([r, c]) => { const x = p.overworld[r][c]; return x.monster && def(state, x.monster).preferredTerrain !== def(state, x.terrain).terrainType; });
  if (misplaced && p.allow.monsterMoves > 0 && !m.tried.includes("mon")) {
    m.tried.push("mon");
    const mon = def(state, p.overworld[misplaced[0]][misplaced[1]].monster);
    const home = sq.find(([r, c]) => { const x = p.overworld[r][c]; return x.terrain && def(state, x.terrain).terrainType === mon.preferredTerrain && !(x.monster && def(state, x.monster).preferredTerrain === def(state, x.terrain).terrainType); });
    if (home) return { type: "moveMonster", from: misplaced, to: home };
  }
  return tryUse(state, p, "build", (u) => u.src.kind !== "trick") ?? { type: "done" };
}

function endStep(state, p) {
  const m = memo(state, p);
  const v = activeVillain(state, p);
  if (m.n < 30) {
    for (let i = 0; i < DUNGEON_SPACES; i++) {
      const top = topRoom(p.dungeon[i]);
      const x = top && def(state, top).soulExchanges?.[0];
      if (!x || p.souls < x.souls || m.tried.includes(`x${i}`)) continue;
      m.tried.push(`x${i}`);
      const g = x.gives.op;
      if (g === "healVillain" && !(v?.damage > 0)) continue;
      if (g === "gainMinion" && p.minions.length >= 5) continue;
      let target;
      if (g === "advanceChampion") {
        target = p.dungeon.findIndex((sp) => sp.champion && sp.champion.level < def(state, sp.champion.card).levels.length);
        if (target < 0) continue;
      }
      return { type: "soulExchange", space: i, index: 0, target };
    }
    if (p.allow.treasureBuys > 0 && !m.tried.includes("buy")) {
      m.tried.push("buy");
      const town = heroesInTown(state).map((h) => def(state, h).class);
      const opts = state.markets.treasure.slots.map((c, i) => ({ c, i, d: def(state, c) })).filter((x) => x.d.coinCost <= p.coins && x.d.soulThreshold <= p.soulsTotal);
      const pickT = best(opts, (x) => (x.d.type === "Gold" ? x.d.value / 3 * Math.max(1, town.length) : x.d.value * (1 + town.filter((c) => c === x.d.type).length)) + rand(p) * 0.5);
      if (pickT) return { type: "buyTreasure", slot: pickT.i };
    }
    const use = tryUse(state, p, "end", (u) => !(u.effects[0].op === "healVillain" && !(v?.damage > 0)) && !["replaceObjective", "swapObjective"].includes(u.effects[0].op));
    if (use) return use;
  }
  if (p.hand.rooms.length + p.hand.tricks.length > HAND_LIMIT) {
    if (p.hand.rooms.length >= p.hand.tricks.length) return { type: "discard", kind: "room", uid: best(p.hand.rooms, (c) => -roomScore(state, c)).uid };
    return { type: "discard", kind: "trick", uid: p.hand.tricks[0].uid };
  }
  return { type: "done" };
}

export { GRID };
