// Activated effects: Tricks in hand, Villain powers, Tainted Items and Champion
// abilities. Each source lists the phases it can be used in, its cost and its
// target slots; the engine validates targets against the same option lists it
// sends to the client, so there's one source of truth.
import { GRID } from "./config.js";
import {
  def, name, log, fail, squares, topRoom, heroInLandsOf, heroesInTown, villainDef, activeVillain, overflow,
  inflictStatus, damageHero, gainMinions, gainTrick, fireEvent, champLevelEffects, livePlayers, pname,
  claimObjective, stateObjectiveMet,
} from "./core.js";
import { drawCard } from "./market.js";
import { healVillain } from "./adventure.js";

// Which phase an effect can be used in, by op (Items don't print a phase yet: this is a placeholder mapping).
const OP_PHASES = {
  heroLoseHealth: ["build", "adventure"], inflictStatus: ["build"], tempt: ["lure"], addDice: ["adventure"],
  addDamage: ["adventure"], chooseDirection: ["adventure"], healVillain: ["build", "end"], gainMinion: ["build"],
  gainCoins: ["build", "end"], peekObjective: ["build", "end"], replaceObjective: ["build", "end"], raiseMonster: ["build"], gainTrick: ["end"],
};
const PHASE_WORD = { Build: "build", Lure: "lure", Adventure: "adventure", End: "end", Upkeep: "upkeep" };

function powerPhases(e) {
  const m = /^(Build|Lure|Adventure|End|Upkeep) Phase/.exec(e.text);
  if (m) return [PHASE_WORD[m[1]]];
  return OP_PHASES[e.op] ?? ["build"];
}

/** Every activated source this player has right now (regardless of phase). */
export function sources(state, p) {
  const out = [];
  for (const t of p.hand.tricks) {
    const d = def(state, t);
    out.push({ src: { kind: "trick", uid: t.uid }, name: d.name, text: d.effect.map((e) => e.text).join(" "), phases: d.phases, effects: d.effect, cardId: d.id, cost: trickCost(state, d) });
  }
  const v = villainDef(state, p);
  if (v) {
    v.power.forEach((e, i) => {
      if (!e.recharges) return;
      out.push({ src: { kind: "power", index: i }, name: `${v.name}'s power`, text: e.text, phases: powerPhases(e), effects: [e], cardId: v.id, cost: {}, used: p.powerUsed });
    });
  }
  for (const s of p.sustained) {
    const d = def(state, s.card);
    if (d.villainEffect.every((e) => e.op === "custom")) continue; // passive (Tower Shield)
    out.push({ src: { kind: "item", uid: s.card.uid }, name: `Tainted ${d.name}`, text: d.villainEffect.map((e) => e.text).join(" "), phases: OP_PHASES[d.villainEffect[0].op] ?? ["build"], effects: d.villainEffect, cardId: d.id, cost: {}, used: s.exhausted });
  }
  p.dungeon.forEach((sp, i) => {
    if (!sp.champion || !topRoom(sp)) return;
    const eff = champLevelEffects(state, sp.champion).filter((e) => e.op === "tempt");
    if (eff.length) out.push({ src: { kind: "champion", space: i }, name: `${def(state, sp.champion.card).name} (space ${i + 1})`, text: eff.map((e) => e.text).join(" "), phases: ["lure"], effects: eff, cardId: sp.champion.card.id, cost: {}, used: sp.champion.used });
  });
  return out;
}

export function trickCost(state, d) {
  const coins = (d.playCost?.coins ?? 0) + overflow(state, "Mage");
  return { coins, souls: d.playCost?.souls ?? 0 };
}

// ---------- targets ----------
const heroLabel = (state, h) => {
  const d = def(state, h);
  const where = h.loc.at === "town" ? "Town" : h.loc.at === "overworld" ? `Overworld (${h.loc.r + 1},${h.loc.c + 1})` : h.loc.at === "dungeon" ? `space ${h.loc.space + 1}` : "Villain fight";
  return `${d.name} (${d.tier} ${d.class}, ${h.health}♥, ${where})`;
};
const heroOpts = (state, list) => list.map((h) => ({ label: heroLabel(state, h), value: h.uid }));
const sqLabel = ([r, c]) => `(${r + 1},${c + 1})`;

function slotsFor(state, p, eff, cardId) {
  const inLands = state.heroes.filter((h) => heroInLandsOf(h, p.id));
  const overworldHeroes = inLands.filter((h) => h.loc.at === "overworld");
  const ownSpaces = p.dungeon.map((sp, i) => ({ sp, i })).filter(({ sp }) => topRoom(sp));
  const others = livePlayers(state).filter((q) => q.id !== p.id);
  switch (cardId) {
    case "trick-landscaping":
      return [
        squares().filter(([r, c]) => p.overworld[r][c].terrain).map((s) => ({ label: `from ${sqLabel(s)} ${name(state, p.overworld[s[0]][s[1]].terrain)}`, value: s })),
        squares().filter(([r, c]) => !p.overworld[r][c].terrain).map((s) => ({ label: `to wasteland ${sqLabel(s)}`, value: s })),
      ];
    case "trick-poach": {
      const opts = [];
      for (const h of heroesInTown(state)) for (const q of others) if ((h.tempts[q.id] ?? 0) > 0) opts.push({ label: `${name(state, h)}: remove ${q.name}'s tempts (${h.tempts[q.id]})`, value: [h.uid, q.id] });
      return [opts];
    }
    case "trick-lure-of-gold": return [heroOpts(state, heroesInTown(state))];
    case "trick-stampede": return [];
    case "item-warhorn": return [heroOpts(state, heroesInTown(state).filter((h) => def(state, h).class === "Warrior"))];
    default: break;
  }
  switch (eff.op) {
    case "heroLoseHealth":
      return [heroOpts(state, /dungeon/.test(eff.text) ? inLands.filter((h) => h.loc.at !== "overworld") : inLands)];
    case "inflictStatus": return [heroOpts(state, inLands)];
    case "tempt": return [heroOpts(state, heroesInTown(state))];
    case "addDice":
    case "addDamage":
      if (eff.target === "any") return [[
        ...ownSpaces.map(({ i }) => ({ label: `Room in space ${i + 1}`, value: ["space", i] })),
        ...squares().filter(([r, c]) => p.overworld[r][c].monster).map((s) => ({ label: `${name(state, p.overworld[s[0]][s[1]].monster)} at ${sqLabel(s)}`, value: ["square", ...s] })),
      ]];
      if (eff.target === "topRoom" || eff.target === "room") return [ownSpaces.map(({ i, sp }) => ({ label: `${name(state, topRoom(sp))} (space ${i + 1})`, value: i }))];
      return [];
    case "moveHero": return [heroOpts(state, overworldHeroes.filter((h) => h.trip.path.length))];
    case "chooseDirection": {
      const opts = [];
      for (const h of overworldHeroes) {
        const { r, c } = h.loc;
        if (c < GRID - 1) opts.push({ label: `${name(state, h)} → right`, value: [h.uid, "right"] });
        if (r < GRID - 1) opts.push({ label: `${name(state, h)} → down`, value: [h.uid, "down"] });
      }
      return [opts];
    }
    case "destroyRoom": {
      const opts = [];
      for (const q of others) q.dungeon.forEach((sp, i) => { if (topRoom(sp)) opts.push({ label: `${q.name}: ${name(state, topRoom(sp))} (space ${i + 1})`, value: [q.id, i] }); });
      return [opts];
    }
    case "peekObjective": return [];
    case "replaceObjective":
      return [state.markets.objective.slots.map((c) => ({ label: `"${def(state, c).name}": ${def(state, c).text}`, value: c.uid }))];
    case "claimObjective":
      return [state.markets.objective.slots.filter((c) => def(state, c).kind === "state" && stateObjectiveMet(state, p, def(state, c).trigger))
        .map((c) => ({ label: `"${def(state, c).name}": ${def(state, c).text}`, value: c.uid }))];
    default: return [];
  }
}

export function sourceSlots(state, p, s) {
  const eff = s.effects[0];
  return slotsFor(state, p, eff, s.cardId);
}

export function findSource(state, p, src) {
  return sources(state, p).find((s) => JSON.stringify(s.src) === JSON.stringify(src));
}

/** Sources usable now, with their target options (for the view and the bot). */
export function usableSources(state, p, phase) {
  return sources(state, p).filter((s) => s.phases.includes(phase) && !s.used).map((s) => {
    const slots = sourceSlots(state, p, s);
    const affordable = p.coins >= (s.cost.coins ?? 0) && p.souls >= (s.cost.souls ?? 0);
    const targetable = slots.every((o) => o.length > 0);
    return { ...s, slots, affordable, targetable };
  });
}

// ---------- activation ----------
export function activate(state, p, phase, src, targets = []) {
  const s = findSource(state, p, src);
  if (!s) fail("You don't have that.");
  if (!s.phases.includes(phase)) fail(`${s.name} can't be used in this phase.`);
  if (s.used) fail(`${s.name} is exhausted until next Upkeep.`);
  const slots = sourceSlots(state, p, s);
  if (slots.some((o) => o.length === 0)) fail("There's no valid target.");
  slots.forEach((opts, k) => {
    const want = JSON.stringify(targets[k]);
    if (!opts.some((o) => JSON.stringify(o.value) === want)) fail("Pick a valid target.");
  });
  const { coins = 0, souls = 0 } = s.cost;
  if (p.coins < coins) fail(`Needs ${coins} Coin${coins > 1 ? "s" : ""}.`);
  if (p.souls < souls) fail(`Needs ${souls} soul${souls > 1 ? "s" : ""}.`);
  p.coins -= coins; p.souls -= souls;

  // pay / exhaust
  if (src.kind === "trick") {
    const i = p.hand.tricks.findIndex((t) => t.uid === src.uid);
    const card = p.hand.tricks.splice(i, 1)[0];
    const d = def(state, card);
    if (d.type === "Spell") p.exhausted.push({ card, refreshIn: d.recharge });
    else state.trickDiscard.push(card);
    p.round_.tricks++;
    fireEvent(state, p.id, { op: "tricksPlayedInRound", count: p.round_.tricks });
  } else if (src.kind === "power") p.powerUsed = true;
  else if (src.kind === "item") { const it = p.sustained.find((x) => x.card.uid === src.uid); if (def(state, it.card).recharges) it.exhausted = true; }
  else if (src.kind === "champion") p.dungeon[src.space].champion.used = true;

  const cost = [coins && `${coins}¤`, souls && `${souls} soul${souls > 1 ? "s" : ""}`].filter(Boolean).join(", ");
  log(state, `${p.name} uses ${s.name}${cost ? ` (${cost})` : ""}: ${s.text}`, { pid: p.id, kind: "trick" });
  const by = src.kind === "trick" ? "trick" : "power";
  for (const e of s.effects) apply(state, p, e, s.cardId, targets, by);
}

const heroByUid = (state, uid) => state.heroes.find((h) => h.uid === uid);

function apply(state, p, e, cardId, t, by) {
  switch (cardId) {
    case "trick-landscaping": {
      const [[fr, fc], [tr, tc]] = t;
      p.overworld[tr][tc] = p.overworld[fr][fc];
      p.overworld[fr][fc] = { terrain: null, monster: null };
      return;
    }
    case "trick-poach": {
      const h = heroByUid(state, t[0][0]);
      h.tempts[t[0][1]] = Math.max(0, (h.tempts[t[0][1]] ?? 0) - (e.amount ?? 2));
      log(state, `${name(state, h)} forgets ${pname(state, t[0][1])}'s promises.`);
      return;
    }
    case "trick-lure-of-gold": {
      (state.lureGold[p.id] ??= {})[t[0]] = (state.lureGold[p.id][t[0]] ?? 0) + (e.amount ?? 2);
      return;
    }
    case "trick-stampede": p.allow.monsterMoves += 1; return;
    default: break;
  }
  switch (e.op) {
    case "heroLoseHealth": {
      const h = heroByUid(state, t[0]);
      const where = h.loc.at === "overworld" ? "overworld" : h.loc.at === "fight" ? "villainFight" : "dungeon";
      if (!damageHero(state, h, e.amount, { killer: p.id, where, by, space: h.loc.space ?? null })) log(state, `${name(state, h)} loses ${e.amount} Health (${h.health} left).`, { kind: "hit" });
      return;
    }
    case "inflictStatus": inflictStatus(state, heroByUid(state, t[0]), e.status, e.rounds, "villainy"); return;
    case "tempt": {
      const h = heroByUid(state, t[0]);
      (state.lureBonus[p.id] ??= {})[h.uid] = (state.lureBonus[p.id][h.uid] ?? 0) + (e.amount ?? 1);
      return;
    }
    case "addDice":
    case "addDamage": {
      const key = e.op === "addDice" ? "dice" : "damage";
      const b = { [key]: e.amount };
      if (e.target === "any") { if (t[0][0] === "space") b.space = t[0][1]; else b.square = [t[0][1], t[0][2]]; }
      else if (e.target === "topRoom" || e.target === "room") b.space = t[0];
      else if (e.target === "monster") b.allMonsters = true;
      else if (e.target === "villain") b.villain = true;
      else if (e.target === "trapRoom") b.trapRooms = true;
      p.buffs.push(b);
      return;
    }
    case "moveHero": {
      const h = heroByUid(state, t[0]);
      const [r, c] = h.trip.path.pop();
      h.loc = { ...h.loc, r, c };
      log(state, `${name(state, h)} is pushed back to (${r + 1},${c + 1}).`, { kind: "move" });
      return;
    }
    case "chooseDirection": heroByUid(state, t[0][0]).trip.forcedDir = t[0][1]; return;
    case "extraPlacement": p.allow.placements += e.amount ?? 1; return;
    case "raiseMonster": p.allow.monsterMoves += 1; return;
    case "destroyRoom": {
      const [qid, i] = t[0];
      const q = state.players[qid];
      destroyTop(state, q, i);
      fireEvent(state, p.id, { op: "roomDestroyed", owner: qid });
      return;
    }
    case "peekObjective": {
      const deck = state.markets.objective.deck;
      const top = deck.slice(-(e.amount ?? 2)).reverse();
      log(state, `${p.name} peeks at the Objective deck.`, { kind: "objective" });
      log(state, `(private) Next Objectives: ${top.map((c) => `"${def(state, c).name}" (${def(state, c).text})`).join(", ") || "none, the deck is empty"}.`, { kind: "private", only: p.id });
      return;
    }
    case "replaceObjective": {
      const m = state.markets.objective;
      const i = m.slots.findIndex((c) => c.uid === t[0]);
      const old = m.slots[i];
      const fresh = drawCard(state, m);
      m.discard.push(old);
      if (fresh) m.slots[i] = fresh; else m.slots.splice(i, 1);
      log(state, `${p.name} throws out the Objective "${def(state, old).name}"${fresh ? ` for "${def(state, fresh).name}"` : ""}.`, { kind: "objective" });
      return;
    }
    case "claimObjective": claimObjective(state, p, state.markets.objective.slots.find((c) => c.uid === t[0]), "early"); return;
    case "healVillain": healVillain(state, p, e.amount, cardId); return;
    case "gainCoins": p.coins += e.amount; log(state, `${p.name} gains ${e.amount} Coin.`, { pid: p.id }); return;
    case "gainMinion": gainMinions(state, p, e.amount ?? 1); return;
    case "gainTrick": gainTrick(state, p); return;
    default: log(state, `(not automated yet: "${e.text}")`); return;
  }
}

export function destroyTop(state, q, i) {
  const sp = q.dungeon[i];
  const room = sp.stack.pop();
  if (!room) fail("That space is empty.");
  state.markets.dungeon.discard.push(room);
  log(state, `${name(state, room)} in ${q.name}'s space ${i + 1} is destroyed.`, { pid: q.id });
  if (!sp.stack.length && sp.champion && state.config.championOnEmptiedSpace === "discard") {
    state.markets.champion.discard.push(sp.champion.card);
    log(state, `${name(state, sp.champion.card)} leaves with nothing left to guard.`);
    sp.champion = null;
  }
}

export { activeVillain };
