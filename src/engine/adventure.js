// Threats, the dice-pool exchange, and Hero movement in the Adventure Phase.
import { rollDice, countHits, pick } from "./rng.js";
import { TIER_RANK, THREAT_RANK, TIER_VALUE, GRID } from "./config.js";
import {
  def, name, log, topRoom, lastBuiltSpace, minionsIn, champLevelEffects, villainPower, activeVillain,
  villainDef, overflow, hasStatus, inflictStatus, healHero, damageHero, vanquish, turnOrder, heroInLandsOf,
} from "./core.js";

const sumBonus = (effects, op, pred = () => true) =>
  effects.filter((e) => e.op === op && pred(e)).reduce((n, e) => n + (e.amount ?? 0), 0);
const buffs = (p, pred) => p.buffs.filter(pred);
const buffSum = (p, key, pred) => buffs(p, pred).reduce((n, b) => n + (b[key] ?? 0), 0);

// ---------- threats ----------
/** The threat a dungeon space presents, or null if nothing fights there. */
export function spaceThreat(state, p, i) {
  const sp = p.dungeon[i];
  const top = topRoom(sp);
  if (!top) return null;
  const room = def(state, top);
  const ch = sp.champion;
  const chDef = ch && def(state, ch.card);
  if (!room.threat && !ch) return null;
  const chEff = ch ? champLevelEffects(state, ch) : [];
  const trap = !!room.trap || ch?.card.id === "champion-goblin-trapmaster";
  let tests = room.threat?.tests ?? "might"; // a threat-less Room with a Champion tests Might (placeholder)
  if (ch?.card.id === "champion-goblin-trapmaster") tests = "cunning";
  if (ch?.card.id === "champion-necromancer") tests = "magic";
  let dice = room.threat?.dice ?? 0;
  if (chDef) dice = Math.max(dice, chDef.dice);
  let damage = room.threat?.damage ?? 1;
  const parts = [];
  const add = (dd, dm, why) => { if (dd || dm) { dice += dd; damage += dm; parts.push(why); } };

  for (const below of sp.stack.slice(0, -1)) {
    const cb = def(state, below).coveredBonus;
    add(sumBonus(cb, "addDice", (e) => e.target === "topRoom"), sumBonus(cb, "addDamage", (e) => e.target === "topRoom"), `covered ${def(state, below).name}`);
  }
  if (ch) {
    let dd = sumBonus(chEff, "addDice", (e) => e.target === "room");
    if (ch.card.id === "champion-overseer" && ch.level >= 1) dd = dd - 1 + Math.min(2, minionsIn(p, i));
    add(dd, sumBonus(chEff, "addDamage", (e) => e.target === "room"), chDef.name);
  }
  if (room.minionBonus && minionsIn(p, i) > 0) add(sumBonus(room.minionBonus, "addDice"), sumBonus(room.minionBonus, "addDamage"), "Minion");
  const vp = villainPower(state, p, (e) => e.when === "passive");
  if (ch) add(sumBonus(vp, "addDice", (e) => e.target === "champion"), 0, "Villain");
  if (lastBuiltSpace(p) === i) add(sumBonus(vp, "addDice", (e) => e.target === "lastRoom"), 0, "Villain");
  if (trap) add(0, sumBonus(vp, "addDamage", (e) => e.target === "trapRoom"), "Villain");
  add(buffSum(p, "dice", (b) => b.space === i), buffSum(p, "damage", (b) => b.space === i), "Trick");
  if (trap) add(0, buffSum(p, "damage", (b) => b.trapRooms), "Trick");
  if (state.config.warriorOverflowAffectsRooms && !trap) {
    const w = overflow(state, "Warrior");
    if (w) { damage -= w; parts.push(`−${w} Warrior overflow`); }
  }
  return {
    name: room.name + (chDef ? ` + ${chDef.name}` : ""), tests, dice, damage: Math.max(0, damage),
    rank: ch ? "Champion" : "Monster", trap, parts,
    afterWin: chEff.filter((e) => e.when === "afterWin"),
  };
}

export function monsterThreat(state, p, r, c) {
  const sq = p.overworld[r][c];
  const m = def(state, sq.monster);
  let { dice, damage } = m.threat;
  const parts = [];
  if (sq.terrain && def(state, sq.terrain).terrainType === m.preferredTerrain) {
    dice += sumBonus(m.preferredBonus, "addDice");
    damage += sumBonus(m.preferredBonus, "addDamage");
    parts.push("home terrain");
  }
  const vp = sumBonus(villainPower(state, p, (e) => e.when === "passive"), "addDice", (e) => e.target === "monster");
  if (vp) { dice += vp; parts.push("Villain"); }
  const bd = buffSum(p, "dice", (b) => b.allMonsters || (b.square && b.square[0] === r && b.square[1] === c));
  if (bd) { dice += bd; parts.push("Trick"); }
  const w = overflow(state, "Warrior");
  if (w) { damage -= w; parts.push(`−${w} dmg Warrior overflow`); }
  return { name: m.name, tests: m.threat.tests, dice, damage: Math.max(0, damage), rank: "Monster", parts, afterWin: [] };
}

export function villainThreat(state, p) {
  const v = villainDef(state, p);
  let { dice, damage } = v.threat;
  dice += buffSum(p, "dice", (b) => b.villain);
  damage += buffSum(p, "damage", (b) => b.villain);
  return { name: v.name, tests: v.threat.tests, dice, damage, rank: "Villain", parts: [], afterWin: [] };
}

// ---------- the exchange ----------
export function heroDice(state, h, stat) {
  const d = def(state, h);
  let n = d.stats[stat];
  if (h.carrying) {
    for (const e of def(state, h.carrying).heroEffect) if (e.op === "addDice" && e.stat === stat) n += e.amount;
  }
  if (hasStatus(h, "Cursed")) n -= 1;
  return Math.max(0, n);
}

/** One exchange. Returns { heroWins, heroHits, threatHits }. Logs the dice. */
export function exchange(state, h, threat, fight) {
  const hd = def(state, h);
  let heroRoll = rollDice(state, heroDice(state, h, threat.tests));
  const threatRoll = rollDice(state, threat.dice);
  const th = countHits(threatRoll);
  const winsAt = (hh) => hh > th || (hh === th && TIER_RANK[hd.tier] >= THREAT_RANK[threat.rank]);
  // Lucky Coin (once per fight) / Crystal Orb (in Rooms): reroll one missed die if losing.
  const reroller = h.carrying?.id === "item-lucky-coin" ? "Lucky Coin" : h.carrying?.id === "item-crystal-orb" && fight.room ? "Crystal Orb" : null;
  let rerollNote = "";
  if (reroller && !fight.rerolled && !winsAt(countHits(heroRoll))) {
    const i = heroRoll.findIndex((x) => x < 5);
    if (i >= 0) {
      fight.rerolled = true;
      const old = heroRoll[i];
      heroRoll = [...heroRoll]; heroRoll[i] = rollDice(state, 1)[0];
      rerollNote = ` (${reroller} rerolls a ${old} → ${heroRoll[i]})`;
    }
  }
  const hh = countHits(heroRoll);
  const heroWins = winsAt(hh);
  log(state, `${hd.name} [${threat.tests} ${heroRoll.length}d] vs ${threat.name} [${threat.dice}d, ${threat.damage} dmg${threat.parts.length ? `; ${threat.parts.join(", ")}` : ""}]: ${hh} hit${hh === 1 ? "" : "s"} vs ${th}${rerollNote} → ${heroWins ? "Hero wins" : "threat wins"}${hh === th ? " the tie" : ""}.`,
    { kind: "roll", heroRoll, threatRoll, heroWins });
  if (heroWins && hd.class === "Acolyte") {
    const healed = healHero(state, h, 1);
    if (healed) log(state, `${hd.name} heals 1 (Acolyte).`, { kind: "hero" });
  }
  return { heroWins, heroHits: hh, threatHits: th };
}

/** Resolve a non-Villain threat. Returns true if the Hero died. */
function encounter(state, p, h, threat, ctx) {
  const fight = { rerolled: false, room: ctx.where === "dungeon" };
  const res = exchange(state, h, threat, fight);
  if (res.heroWins) return false;
  const died = damageHero(state, h, threat.damage, { ...ctx, killer: p.id, by: "land", shield: { used: false } });
  if (died) {
    if (ctx.space != null && p.dungeon[ctx.space].champion?.card.id === "champion-vampire-count") {
      healVillain(state, p, 1, "Vampire Count");
    }
    return true;
  }
  log(state, `${name(state, h)} takes ${threat.damage} damage (${h.health} Health left).`, { kind: "hit" });
  for (const e of threat.afterWin) if (e.op === "inflictStatus") inflictStatus(state, h, e.status, e.rounds, threat.name);
  return false;
}

export function healVillain(state, p, n, why) {
  const v = activeVillain(state, p);
  if (!v || v.damage <= 0) return;
  const healed = Math.min(n, v.damage);
  v.damage -= healed;
  log(state, `${name(state, v.card)} heals ${healed} (${why}).`, { pid: p.id });
}

// ---------- squares and spaces ----------
function resolveSquare(state, p, h, r, c) {
  const sq = p.overworld[r][c];
  if (!sq.terrain && !sq.monster) return false;
  if (sq.terrain) {
    const t = def(state, sq.terrain);
    if (t.kind === "hazard") {
      const threat = { name: t.name, ...t.threat, parts: [], afterWin: [] };
      if (encounter(state, p, h, threat, { where: "overworld" })) return true;
    } else inflictStatus(state, h, t.status, t.statusRounds, t.name);
  }
  if (sq.monster) return encounter(state, p, h, monsterThreat(state, p, r, c), { where: "overworld" });
  return false;
}

function resolveSpace(state, p, h, i) {
  const sp = p.dungeon[i];
  const top = topRoom(sp);
  if (!top) { log(state, `${name(state, h)} crosses empty space ${i + 1} of ${p.name}'s dungeon.`, { kind: "move" }); return false; }
  const room = def(state, top);
  log(state, `${name(state, h)} enters ${room.name} (space ${i + 1}) in ${p.name}'s dungeon.`, { kind: "move" });
  for (const e of room.effect) if (e.when === "onEnter" && e.op === "inflictStatus") inflictStatus(state, h, e.status, e.rounds, room.name);
  const threat = spaceThreat(state, p, i);
  if (!threat) return false;
  if (threat.trap && h.trip.trapSkips > 0) {
    h.trip.trapSkips--;
    log(state, `${name(state, h)} slips past the trap.`, { kind: "hero" });
    return false;
  }
  return encounter(state, p, h, threat, { where: "dungeon", space: i });
}

function villainExchange(state, p, h) {
  const v = activeVillain(state, p);
  const threat = villainThreat(state, p);
  const res = exchange(state, h, threat, { rerolled: false });
  const hd = def(state, h);
  if (res.heroWins) {
    let dmg = TIER_VALUE[hd.tier] + Math.max(0, res.heroHits - res.threatHits);
    if (p.sustained.some((s) => s.card.id === "item-tower-shield")) dmg = Math.max(0, dmg - 1);
    v.damage += dmg;
    const vd = def(state, v.card);
    log(state, `${hd.name} wounds ${vd.name} for ${dmg} (${Math.max(0, vd.health - v.damage)} Health left).`, { kind: "hit" });
    if (v.damage >= vd.health) vanquish(state, p, h);
  } else {
    const died = damageHero(state, h, threat.damage, { killer: p.id, where: "villainFight", by: "land", shield: h.trip.fightShield ??= { used: false } });
    if (!died) log(state, `${hd.name} takes ${threat.damage} damage (${h.health} Health left).`, { kind: "hit" });
  }
}

// ---------- movement ----------
function distance(h) {
  if (h.loc.at === "fight") return 100;
  if (h.loc.at === "dungeon") return 50 + h.loc.space;
  return h.loc.r + h.loc.c;
}

function enterDungeon(state, p, h) {
  h.loc = { at: "dungeon", owner: p.id, space: 0 };
  if (h.carrying?.id === "item-censer-of-light" && h.statuses.length) {
    const s = h.statuses.shift();
    log(state, `${name(state, h)}'s Censer of Light removes ${s.status}.`, { kind: "hero" });
  }
  return resolveSpace(state, p, h, 0);
}

function stepOverworld(state, p, h) {
  const { r, c } = h.loc;
  if (r === GRID - 1 && c === GRID - 1) return enterDungeon(state, p, h);
  const opts = [];
  if (c < GRID - 1) opts.push("right");
  if (r < GRID - 1) opts.push("down"); // edges force the move (Q-80)
  let dir = h.trip.forcedDir && opts.includes(h.trip.forcedDir) ? h.trip.forcedDir : pick(state, opts);
  h.trip.forcedDir = null;
  h.trip.path.push([r, c]);
  h.loc = { ...h.loc, r: dir === "down" ? r + 1 : r, c: dir === "right" ? c + 1 : c };
  log(state, `${name(state, h)} moves ${dir} to (${h.loc.r + 1},${h.loc.c + 1}) in ${p.name}'s Overworld.`, { kind: "move" });
  return resolveSquare(state, p, h, h.loc.r, h.loc.c);
}

function moveHero(state, p, h) {
  const slowed = hasStatus(h, "Slowed");
  if (h.loc.at === "fight") {
    if (!activeVillain(state, p)) return;
    villainExchange(state, p, h);
    return;
  }
  if (h.loc.at === "dungeon") {
    if (slowed && !h.trip.lingered) { h.trip.lingered = true; log(state, `${name(state, h)} is Slowed and lingers in space ${h.loc.space + 1}.`, { kind: "move" }); return; }
    if (h.loc.space === p.dungeon.length - 1) {
      if (!activeVillain(state, p)) { log(state, `${name(state, h)} waits: ${p.name} has no Villain in place yet.`, { kind: "move" }); return; }
      h.trip.lingered = false;
      h.loc = { at: "fight", owner: p.id };
      log(state, `${name(state, h)} confronts ${name(state, activeVillain(state, p).card)}!`, { kind: "move" });
      villainExchange(state, p, h);
      return;
    }
    h.trip.lingered = false;
    h.loc = { ...h.loc, space: h.loc.space + 1 };
    resolveSpace(state, p, h, h.loc.space);
    return;
  }
  // Overworld
  if (h.trip.justLured) { h.trip.justLured = false; resolveSquare(state, p, h, 0, 0); return; }
  if (slowed && state.config.slowedAffectsOverworld && !h.trip.lingered) { h.trip.lingered = true; log(state, `${name(state, h)} is Slowed and stays put.`, { kind: "move" }); return; }
  h.trip.lingered = false;
  const steps = h.carrying?.id === "item-warhorn" && !h.trip.moved ? 2 : 1;
  h.trip.moved = true;
  for (let s = 0; s < steps; s++) {
    if (h.loc.at !== "overworld") break;
    if (stepOverworld(state, p, h) || !state.heroes.includes(h)) return;
  }
}

export function resolveAdventure(state) {
  for (const h of state.heroes) {
    if (h.loc.at !== "town" && h.carrying?.id === "item-prayer-beads" && healHero(state, h, 1)) log(state, `${name(state, h)} heals 1 (Prayer Beads).`, { kind: "hero" });
  }
  for (const pid of turnOrder(state)) {
    const p = state.players[pid];
    const mine = state.heroes.filter((h) => heroInLandsOf(h, pid)).sort((a, b) => distance(b) - distance(a));
    for (const h of mine) {
      if (p.eliminated) break;
      if (!state.heroes.includes(h) || !heroInLandsOf(h, pid)) continue;
      moveHero(state, p, h);
    }
  }
}
