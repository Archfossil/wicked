// Plays complete bot-only games to smoke-test the rules engine and get rough
// balance numbers. Usage: node tools/simulate.mjs [games=20] [players=4] [seed=1]
import { createGame, applyAction, mustAct, RuleError } from "../src/engine/game.js";
import { botAction } from "../src/engine/bot.js";
import { viewFor } from "../src/engine/view.js";

const [games = 20, players = 4, seed0 = 1] = process.argv.slice(2).map(Number);

export function playOut(state, { maxActions = 20000, onReject } = {}) {
  let actions = 0, rejects = 0;
  while (state.phase !== "gameOver") {
    const who = mustAct(state);
    if (!who.length) throw new Error(`stuck: nobody to act in ${state.step?.type}`);
    for (const pid of who) {
      if (state.phase === "gameOver") break;
      if (!mustAct(state).includes(pid)) continue;
      const a = botAction(state, pid);
      try { applyAction(state, pid, a); }
      catch (e) {
        if (!(e instanceof RuleError)) throw e;
        rejects++; onReject?.(pid, a, e);
        const fallback = state.step.type === "town" ? { type: "pass" } : { type: "done" };
        try { applyAction(state, pid, fallback); } catch (e2) { if (!(e2 instanceof RuleError)) throw e2; }
      }
      if (++actions > maxActions) throw new Error(`no end after ${maxActions} actions (round ${state.round})`);
    }
  }
  return { actions, rejects };
}

if (process.argv[1]?.endsWith("simulate.mjs")) {
  const stats = { rounds: [], heroesWin: 0, rejects: 0, vanquished: 0, eliminated: 0, souls: [] };
  const rejectReasons = new Map();
  for (let g = 0; g < games; g++) {
    const seats = Array.from({ length: players }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true }));
    const state = createGame(seats, { seed: seed0 + g });
    const r = playOut(state, { onReject: (pid, a, e) => rejectReasons.set(`${a.type}: ${e.message}`, (rejectReasons.get(`${a.type}: ${e.message}`) ?? 0) + 1) });
    for (let pid = 0; pid < players; pid++) JSON.stringify(viewFor(state, pid)); // the view must serialise
    stats.rounds.push(state.round);
    stats.rejects += r.rejects;
    if (state.result.heroesWin) stats.heroesWin++;
    stats.vanquished += state.players.reduce((n, p) => n + p.villains.filter((v) => v.vanquished).length, 0);
    stats.eliminated += state.players.filter((p) => p.eliminated).length;
    stats.souls.push(...state.players.map((p) => p.soulsTotal));
  }
  const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(`${games} games, ${players} players`);
  console.log(`  rounds: avg ${avg(stats.rounds)}, min ${Math.min(...stats.rounds)}, max ${Math.max(...stats.rounds)}`);
  console.log(`  heroes won: ${stats.heroesWin}; villains vanquished per game: ${(stats.vanquished / games).toFixed(1)}; players eliminated per game: ${(stats.eliminated / games).toFixed(1)}`);
  console.log(`  souls harvested per player: avg ${avg(stats.souls)}`);
  console.log(`  rejected bot actions: ${stats.rejects}`);
  for (const [k, v] of [...rejectReasons].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${v}× ${k}`);
}
