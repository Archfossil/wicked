// What one player is allowed to see. Hidden: decks, other hands, reserve
// Villains (face-down), unrevealed objectives (unless learned), pending Trick
// choices, and other players' builds until the Build Phase reveal.
import { CLASSES, LURE } from "./config.js";
import { def, heroesInTown, overflow, treasureBreakdown, minionsInTown, livePlayers } from "./core.js";
import { mustAct } from "./game.js";
import { usableSources, trickCost } from "./effects.js";

const STEP_PHASE = { build: "build", buildTricks: "build", lure: "lure", adventure: "adventure", end: "end" };

export function viewFor(state, viewer) {
  const acting = mustAct(state);
  const s = state.step;
  const me = state.players[viewer];
  const over = state.phase === "gameOver";

  const players = state.players.map((p) => {
    const own = p.id === viewer;
    const snap = !own && state.buildSnapshot?.[p.id];
    const lands = snap || p;
    return {
      id: p.id, name: p.name, isBot: p.isBot, eliminated: p.eliminated,
      coins: snap ? snap.coins : p.coins, souls: p.souls, soulsTotal: p.soulsTotal,
      hand: { rooms: p.hand.rooms.length, tricks: p.hand.tricks.length },
      exhausted: p.exhausted.map((x) => ({ card: x.card, refreshIn: x.refreshIn })),
      villains: p.villains.map((v, i) => ({
        card: own || v.revealed || over ? v.card : null, damage: v.damage, vanquished: v.vanquished,
        active: i === p.activeVillain && (v.revealed || own),
      })),
      powerUsed: p.powerUsed,
      dungeon: lands.dungeon, overworld: lands.overworld, minions: lands.minions,
      championReserve: lands.championReserve, sustained: lands.sustained, treasury: lands.treasury,
      treasureTokens: p.treasureTokens,
      treasureByClass: Object.fromEntries(CLASSES.map((c) => [c, treasureBreakdown(state, p, c).total])),
      objectives: p.objectives.map((o) => ({
        card: own || o.revealed || o.learnedBy.includes(viewer) || over ? o.card : null,
        revealed: o.revealed, scoredBy: o.scoredBy, learned: o.learnedBy.includes(viewer), learnedByOthers: own ? o.learnedBy.filter((x) => x !== p.id) : undefined,
      })),
      needsVillainChoice: p.needsVillainChoice,
      acting: acting.includes(p.id),
      hiddenBuild: !!snap,
    };
  });

  const view = {
    you: viewer, round: state.round, phase: state.phase, firstPlayer: state.firstPlayer, config: state.config,
    step: s && { type: s.type, mode: s.mode, pick: s.pick, reason: s.reason, current: s.mode === "seq" ? s.order[s.idx] : null, order: s.order?.slice(s.idx, s.idx + 12) },
    acting,
    counts: {
      heroDeck: state.heroDeck.length, itemDeck: state.itemDeck.length, trickDeck: state.trickDeck.length,
      dungeonDeck: state.markets.dungeon.deck.length, terrainDeck: state.markets.terrain.deck.length,
      championDeck: state.markets.champion.deck.length, treasureDeck: state.markets.treasure.deck.length, fallen: state.fallen.length,
    },
    markets: Object.fromEntries(Object.entries(state.markets).map(([k, m]) => [k, m.slots])),
    heroes: state.heroes.map((h) => ({ uid: h.uid, id: h.id, health: h.health, loc: h.loc, statuses: h.statuses, carrying: h.carrying, tempts: h.tempts, lure: LURE[def(state, h).tier] })),
    townShop: state.townShop,
    overflow: Object.fromEntries(CLASSES.map((c) => [c, overflow(state, c)])),
    fallen: state.fallen,
    players,
    log: state.log.filter((e) => e.only == null || e.only === viewer).slice(-400),
    result: state.result,
  };

  if (me) {
    const phase = s && STEP_PHASE[s.type];
    const canAct = acting.includes(viewer);
    view.me = {
      hand: me.hand,
      tricks: me.hand.tricks.map((t) => ({ uid: t.uid, id: t.id, cost: trickCost(state, def(state, t)) })),
      pendingTricks: me.pendingTricks[0] ?? null,
      draftPack: me.draftPack,
      allow: me.allow,
      minionTargets: me.minionTargets,
      townMinions: minionsInTown(me),
      exchangesUsed: me.exchangesUsed,
      usable: canAct && phase ? usableSources(state, me, phase)
        .filter((u) => !(s.type === "build" && u.src.kind === "trick"))
        .map(({ src, name, text, cost, slots, affordable, targetable }) => ({ src, name, text, cost, slots, affordable, targetable })) : [],
      // what every playable Trick could do in its phase, for card tooltips
      livePlayers: livePlayers(state).map((p) => p.id),
    };
  }
  return view;
}
