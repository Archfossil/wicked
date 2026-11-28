// Browser client for The Wicked Awaken. It renders the view the server sends
// and turns clicks into actions. All rules live on the server.

const CARDS = await fetch("/cards.json").then((r) => r.json());
const SERVER_CFG = await fetch("/config.json").then((r) => r.json());
const C = (x) => (x ? CARDS[x.id ?? x] : null);
import { artFor, pairArt, spriteFor, minionSprite, wallTile } from "/art.js";
document.documentElement.style.setProperty("--wall", `url(${wallTile()})`);
const artImg = (d) => `<img class="art" src="${artFor(d)}" alt="">`;
const spr = (d, cls = "spr") => `<img class="${cls}" src="${spriteFor(d)}" alt="">`;

// ---------- connection ----------
let ws = null, lobby = null, view = null, seat = null;
const ui = { center: "lands", side: "hand", focusKey: null, tab: null, sel: null, inspect: null, modal: null, resultsDismissed: false, lastLog: 0, name: localStorage.getItem("wa-name") || "" };
const session = () => JSON.parse(sessionStorage.getItem("wa-session") || "null");

function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws.onopen = () => {
    const s = session();
    const q = new URLSearchParams(location.search);
    if (s) send({ t: "resume", code: s.code, token: s.token });
    else if (q.get("bots")) send({ t: "create", name: ui.name || "Nameless Villain", bots: Math.min(5, +q.get("bots") || 2), start: true, config: q.get("heroes") ? { heroDeckLimit: +q.get("heroes") } : {} }); // shortcut: ?bots=N[&heroes=N]
    else render();
  };
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  ws.onclose = () => { toast("Connection lost, reconnecting…", "info"); setTimeout(connect, 1500); };
}
const send = (m) => ws?.readyState === 1 && ws.send(JSON.stringify(m));
const act = (action) => send({ t: "action", action });

function onMessage(m) {
  switch (m.t) {
    case "welcome":
      seat = m.seat;
      sessionStorage.setItem("wa-session", JSON.stringify({ code: m.code, token: m.token }));
      history.replaceState(null, "", `?room=${m.code}`);
      break;
    case "resumeFailed": sessionStorage.removeItem("wa-session"); lobby = null; view = null; render(); return;
    case "kicked": sessionStorage.removeItem("wa-session"); lobby = null; view = null; toast("You were removed from the game."); render(); return;
    case "lobby": lobby = m.lobby; seat = m.seat; if (!lobby.started) view = null; break;
    case "state": {
      const prevStep = view && `${view.round}:${view.step?.type}`;
      view = m.view;
      if (prevStep !== `${view.round}:${view.step?.type}`) { ui.sel = null; }
      if (ui.tab == null) ui.tab = view.you;
      const fk = `${view.round}:${view.step?.type}:${view.acting.includes(view.you)}`;
      if (fk !== ui.focusKey) { ui.focusKey = fk; if (view.acting.includes(view.you)) autoFocus(); }
      break;
    }
    case "error": toast(m.message); ui.sel = null; break;
  }
  render();
}

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.getElementById("toasts").append(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------- text helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STAT = { might: "Might", magic: "Magic", faith: "Faith", cunning: "Cunning" };
const statTag = (s) => `<span class="stat ${s}">${STAT[s] ?? s}</span>`;
const threatHtml = (t) => (t ? `${statTag(t.tests)} ${t.dice}🎲 · ${t.damage}💥` : "");
const threatTxt = (t) => (t ? `Tests ${STAT[t.tests]}: ${t.dice} dice, ${t.damage} damage (${t.rank} rank)` : "");
const pname = (pid) => view?.players[pid]?.name ?? "?";
const phaseList = (ps) => ps.map((p) => p[0].toUpperCase() + p.slice(1)).join("/");
const costTxt = (c) => { const parts = []; if (c?.coins) parts.push(`${c.coins}¤`); if (c?.souls) parts.push(`${c.souls}👻`); return parts.join(" ") || "free"; };

function cardLines(d) {
  if (!d) return [];
  const L = [];
  switch (d.deck) {
    case "rooms":
      if (d.threat) L.push(threatTxt(d.threat) + (d.trap ? " · Trap" : ""));
      if (d.treasure) L.push(`Treasure: ${d.treasure.value} ${d.treasure.type} (${d.treasure.when === "whileOnTop" ? "while on top" : "each Upkeep"})`);
      for (const e of d.effect) L.push(e.text);
      for (const e of d.minionBonus ?? []) L.push(`With a Minion: ${e.text}`);
      for (const x of d.soulExchanges ?? []) L.push(`End Phase: trade ${x.souls} souls → ${x.gives.text}`);
      for (const e of d.coveredBonus) L.push(`When covered: ${e.text}`);
      break;
    case "champions":
      L.push(`Hire: ${d.cost} Coins · rolls ${d.dice} dice (if higher than the Room's)`);
      for (const e of d.roomBonus) L.push(e.text);
      d.levels.forEach((l, i) => L.push(`Level ${i + 1} (${l.coins} Coins): ${l.effect.map((e) => e.text).join(" ")}`));
      break;
    case "tricks":
      L.push(`${d.type} · ${phaseList(d.phases)} Phase · ${costTxt(d.playCost)}${d.recharge ? ` · recharges in ${d.recharge}` : ""}`);
      for (const e of d.effect) L.push(e.text);
      break;
    case "terrain":
      L.push(`${d.terrainType} · ${d.kind === "hazard" ? `Hazard: ${threatTxt(d.threat)}` : `Status: ${d.status} for ${d.statusRounds} rounds`}`);
      break;
    case "monsters":
      L.push(`Prefers ${d.preferredTerrain} · ${threatTxt(d.threat)}`);
      for (const e of d.preferredBonus) L.push(e.text);
      break;
    case "heroes":
      L.push(`${d.tier} ${d.class} · ${d.stats.health} Health · desire ${d.desire}`);
      L.push(`Might ${d.stats.might}, Magic ${d.stats.magic}, Faith ${d.stats.faith}, Cunning ${d.stats.cunning}`);
      break;
    case "items":
      L.push(`${d.type} Item`);
      L.push(`Hero: ${d.heroEffect.map((e) => e.text).join(" ")}`);
      L.push(`Tainted: ${d.villainEffect.map((e) => e.text).join(" ")}${d.recharges ? " (recharges)" : ""}`);
      break;
    case "treasures":
      L.push(`${d.value} ${d.type} treasure${d.type === "Gold" ? " (lures every class at 1/3)" : ""}`);
      L.push(`Needs ${d.soulThreshold} souls harvested · costs ${d.coinCost} Coins`);
      break;
    case "villains":
      L.push(`${d.health} Health · ${threatTxt(d.threat)}`);
      for (const e of d.power) L.push(`Power${e.recharges ? " (recharges)" : e.when === "passive" ? " (passive)" : ""}: ${e.text}`);
      break;
    case "objectives":
      L.push(d.text, OBJ_KIND[d.kind], `Reward: ${d.reward.map((e) => e.text).join(" ")}`);
      break;
  }
  return L;
}
const tip = (d) => (d ? esc(`${d.name ?? d.text}\n${cardLines(d).join("\n")}`) : "");

// ---------- card renderers ----------
function roomCard(inst, attrs = "", extra = "") {
  const d = C(inst);
  const lines = [];
  if (d.threat) lines.push(threatHtml(d.threat));
  if (d.treasure) lines.push(`💰 ${d.treasure.value} ${d.treasure.type}`);
  for (const e of d.effect) lines.push(esc(e.text));
  for (const e of d.minionBonus ?? []) lines.push(`<span class="sub">Minion: ${esc(e.text)}</span>`);
  for (const x of d.soulExchanges ?? []) lines.push(`<span class="sub">👻${x.souls} → ${esc(x.gives.text)}</span>`);
  lines.push(`<span class="sub">Covered: ${esc(d.coveredBonus.map((e) => e.text).join(" "))}</span>`);
  return `<div class="card room ${d.trap ? "trap" : ""}" ${attrs}><div class="hd"><span>${esc(d.name)}</span>${d.trap ? '<span class="tag">TRAP</span>' : ""}</div>${artImg(d)}<div class="bd">${lines.map((l) => `<div class="ln">${l}</div>`).join("")}${extra}</div></div>`;
}
function trickCard(inst, attrs = "", extra = "", cost = null) {
  const d = C(inst);
  return `<div class="card trick" ${attrs}><div class="hd"><span>${esc(d.name)}</span><span class="tag">${d.type}</span></div>${artImg(d)}<div class="bd"><div class="sub">${phaseList(d.phases)} · <span class="price">${costTxt(cost ?? d.playCost)}</span>${d.recharge ? ` · ⟳${d.recharge}` : ""}</div>${d.effect.map((e) => `<div class="ln">${esc(e.text)}</div>`).join("")}${extra}</div></div>`;
}
function champCard(inst, attrs = "", extra = "", level = null) {
  const d = C(inst);
  return `<div class="card champion" ${attrs}><div class="hd"><span>${esc(d.name)}</span><span class="price">${d.cost}¤</span></div>${artImg(d)}<div class="bd"><div class="ln">${d.dice}🎲 · ${esc(d.roomBonus.map((e) => e.text).join(" "))}</div>${d.levels.map((l, i) => `<div class="sub" style="${level != null && i < level ? "color:var(--gold)" : ""}">Lv${i + 1} ${l.coins}¤: ${esc(l.effect.map((e) => e.text).join(" "))}</div>`).join("")}${extra}</div></div>`;
}
function pairCard(pair, attrs = "") {
  const t = C(pair.terrain), m = C(pair.monster);
  const match = !!m && m.preferredTerrain === t.terrainType;
  const mon = m ? `<div class="mohd" title="${tip(m)}">👹 ${esc(m.name)}${match ? " ★" : ""}</div><div class="bd"><div class="ln">${threatHtml(monsterThreatOn(m, t))}</div><div class="sub">Likes ${m.preferredTerrain}${match ? ` (home: ${esc(m.preferredBonus.map((e) => e.text.replace(/ on its preferred terrain\.?$/, "")).join(", "))})` : ""}</div></div>` : '<div class="mohd dim">No Monster</div>';
  return `<div class="card pair" ${attrs}><div class="hd terrain ${t.terrainType}" title="${tip(t)}"><span>${esc(t.name)}</span><span class="tag">${t.terrainType}</span></div><img class="art" src="${pairArt(t, m)}" alt=""><div class="bd"><div class="ln">${terrainLine(t)}</div></div>${mon}</div>`;
}
const terrainLine = (t) => (t.kind === "hazard" ? `⚠ ${threatHtml(t.threat)}` : `☠ ${t.status} ${t.statusRounds}r`);
/** A Monster's printed threat, plus its home bonus when it stands on its preferred terrain (Tricks and Villain powers not included). */
function monsterThreatOn(m, t) {
  if (!t || m.preferredTerrain !== t.terrainType) return m.threat;
  const bonus = (op) => m.preferredBonus.filter((e) => e.op === op).reduce((n, e) => n + (e.amount ?? 0), 0);
  return { ...m.threat, dice: m.threat.dice + bonus("addDice"), damage: m.threat.damage + bonus("addDamage") };
}
function treasureCard(inst, attrs = "", extra = "") {
  const d = C(inst);
  return `<div class="card treasure" ${attrs}><div class="hd"><span>${esc(d.name)}</span><span class="price">${d.coinCost}¤</span></div>${artImg(d)}<div class="bd"><div class="ln">💰 ${d.value} ${d.type}</div><div class="sub">Needs ${d.soulThreshold}👻 harvested</div>${extra}</div></div>`;
}
function itemCard(inst, attrs = "", extra = "") {
  const d = C(inst);
  return `<div class="card item" ${attrs}><div class="hd"><span>${esc(d.name)}</span><span class="tag">${d.type}</span></div>${artImg(d)}<div class="bd"><div class="sub">Tainted: ${esc(d.villainEffect.map((e) => e.text).join(" "))}</div>${extra}</div></div>`;
}
function villainCard(inst, attrs = "", extra = "") {
  const d = C(inst);
  return `<div class="card villain big" ${attrs}><div class="hd"><span>${esc(d.name)}</span><span>${d.health}♥</span></div>${artImg(d)}<div class="bd"><div class="ln">${threatHtml(d.threat)}</div>${d.power.map((e) => `<div class="ln">${e.recharges ? "⟳ " : e.when === "passive" ? "◆ " : ""}${esc(e.text)}</div>`).join("")}${extra}</div></div>`;
}
const OBJ_KIND = { event: "Claimed by whoever does it first", state: "Checked each End Phase: the first villain in turn order who has it claims it" };
/** Who's close to a face-up "have it" Objective: each live villain's count against the target. */
function objProgress(c) {
  const pr = view.objectiveProgress?.[c.uid];
  if (!pr) return "";
  const min = C(c).trigger.min;
  const who = (pid) => (pid === view.you ? "You" : esc(pname(pid).replace(/^🤖 /, "").split(" ").slice(-1)[0]));
  return `<div class="oprog">${Object.entries(pr).sort((a, b) => b[1] - a[1]).map(([pid, n]) => `<span class="${n >= min ? "met" : ""}" title="${esc(pname(+pid))}: ${n} of ${min}">${who(+pid)} ${Math.min(n, min)}/${min}</span>`).join("")}</div>`;
}
function objectiveCard(c, attrs = "", extra = "") {
  const d = C(c);
  return `<div class="card objective ${d.kind}" ${attrs}><div class="hd"><span>${esc(d.name)}</span><span class="tag" title="${esc(OBJ_KIND[d.kind])}">${d.kind === "event" ? "⚡ Do it" : "⌛ Have it"}</span></div><div class="bd"><div class="ln">${esc(d.text)}</div><div class="sub rw">🎁 ${esc(d.reward.map((e) => e.text).join(" "))}</div>${objProgress(c)}${extra}</div></div>`;
}
function heroChip(h, extraCls = "") {
  const d = C(h);
  const st = h.statuses.map((s) => `${s.status[0]}${s.rounds}`).join(" ");
  const tempts = Object.entries(h.tempts ?? {}).filter(([, n]) => n > 0).map(([pid, n]) => `${esc(pname(+pid).replace(/^🤖 /, "").slice(0, 6))} ${n}/${h.lure}`).join(" ");
  const title = `${d.name}\n${cardLines(d).join("\n")}\nHealth ${h.health}${h.statuses.length ? `\nStatuses: ${h.statuses.map((s) => `${s.status} (${s.rounds})`).join(", ")}` : ""}${h.carrying ? `\nCarrying ${C(h.carrying).name}: ${C(h.carrying).heroEffect.map((e) => e.text).join(" ")}` : ""}${tempts ? `\nTempts: ${tempts}` : ""}`;
  const tierMark = d.tier === "Legendary" ? "★★" : d.tier === "Paragon" ? "★" : "";
  return `<span class="hero ${d.class} ${d.tier} ${extraCls}" data-a="hero" data-uid="${h.uid}" title="${esc(title)}\n(click for the character sheet)">${spr(d)}${tierMark}${esc(d.name)} <span class="hpt">${h.health}♥</span>${st ? ` <span class="stx">${st}</span>` : ""}${h.carrying ? " 🗡" : ""}${tempts ? ` <span class="tm">${tempts}</span>` : ""}</span>`;
}
const diceHtml = (arr, cls = "") => `<span class="dice">${arr.map((x) => `<span class="die ${cls} ${x >= 5 ? "hit" : ""}">${x}</span>`).join("")}</span>`;

// ---------- screens ----------
function render() {
  const zoomed = zoomSrc ? zoomAt : null;
  hideZoom();
  const app = document.getElementById("app");
  const keep = {};
  for (const el of app.querySelectorAll("[data-scroll]")) keep[el.dataset.scroll] = el.scrollTop;
  if (!lobby) app.innerHTML = homeScreen();
  else if (!lobby.started || !view) app.innerHTML = lobbyScreen();
  else app.innerHTML = gameScreen();
  document.getElementById("modal").innerHTML = modalHtml();
  for (const el of app.querySelectorAll("[data-scroll]")) if (keep[el.dataset.scroll] != null) el.scrollTop = keep[el.dataset.scroll];
  rezoom(zoomed);
  const log = document.querySelector(".log");
  if (log && ui.stickLog !== false) log.scrollTop = log.scrollHeight;
}

function homeScreen() {
  const code = new URLSearchParams(location.search).get("room") ?? "";
  return `<div class="home">
    <h1>The Wicked Awaken</h1>
    <div class="parade">${Object.values(CARDS).filter((c) => c.deck === "villains").slice(0, 9).map((c) => spr(c, "pspr")).join("")}</div>
    <div class="tag">Good already won. Build a dungeon, lure the heroes in, and spend their souls.</div>
    <div class="box"><h3>Your villainous name</h3><input id="nm" class="grow" style="width:100%" maxlength="24" placeholder="e.g. The Duke of Rot" value="${esc(ui.name)}"></div>
    <div class="box"><h3>Play</h3>
      <div class="row"><button class="primary" data-a="create">Create a game</button><span class="muted">then share the code with friends</span></div>
      <div class="row"><input id="code" placeholder="CODE" maxlength="4" style="width:90px;text-transform:uppercase" value="${esc(code)}"><button data-a="join">Join game</button></div>
      <div class="row"><button data-a="quick">Quick game vs bots</button><select id="nbots">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 2 ? "selected" : ""}>${n}</option>`).join("")}</select><span class="muted">bot rivals</span></div>
    </div>
    <p class="dim tiny">Prototype: every card is a placeholder. Open rules questions are options in the lobby.</p>
  </div>`;
}

function lobbyScreen() {
  const host = seat === 0;
  const cfg = lobby.config;
  const optRow = (k, label, q, input) => `<label>${label} <span class="q">${q}</span></label>${input}`;
  const bool = (k) => `<input type="checkbox" data-cfg="${k}" ${(cfg[k] ?? SERVER_CFG.defaults[k]) ? "checked" : ""} ${host ? "" : "disabled"}>`;
  const num = (k, min, max) => `<input type="number" style="width:70px" min="${min}" max="${max}" data-cfg="${k}" value="${cfg[k] ?? SERVER_CFG.defaults[k] ?? ""}" ${host ? "" : "disabled"}>`;
  return `<div class="home" style="max-width:640px">
    <h1 style="font-size:32px">The Wicked Awaken</h1>
    <div class="box"><div class="row"><h3 class="grow">Game code</h3><span class="code">${esc(lobby.code)}</span></div>
      <div class="row muted tiny">Friends open this page and join with the code, or use <a style="color:var(--soul)" href="?room=${esc(lobby.code)}">this link</a>.</div></div>
    <div class="box"><h3>Villains (${lobby.seats.length}/6)</h3>
      <ul class="seats">${lobby.seats.map((s) => `<li><span class="dot ${s.connected ? "on" : ""}"></span><span class="grow">${esc(s.name)}${s.seat === seat ? " <span class='muted'>(you)</span>" : ""}${s.host ? " 👑" : ""}</span>${host && s.seat !== 0 ? `<button class="small" data-a="removeSeat" data-seat="${s.seat}">Remove</button>` : ""}</li>`).join("")}</ul>
      ${host ? `<div class="row"><button data-a="addBot" ${lobby.seats.length >= 6 ? "disabled" : ""}>+ Add bot</button><span class="grow"></span><button class="primary" data-a="start">Start the game</button></div>` : `<div class="muted">Waiting for the host to start…</div>`}
    </div>
    <div class="box"><h3>Options</h3>
      <div class="opts">
        ${optRow("heroDeckLimit", "Hero deck size (blank = all 24)", "testing aid: shorter games", num("heroDeckLimit", 2, 24))}
      </div>
      <details><summary>Open rules questions (playtest the alternatives)</summary><div class="opts" style="margin-top:8px">
        ${optRow("blindDrawInTown", "Blind Room draws allowed in the Town Phase", "Q-22", bool("blindDrawInTown"))}
        ${optRow("shiftTerrainMarket", "Terrain market drops its oldest card each round", "Q-21", bool("shiftTerrainMarket"))}
        ${optRow("shiftChampionMarket", "Champion market drops its oldest card each round", "Q-25", bool("shiftChampionMarket"))}
        ${optRow("shiftTreasureMarket", "Treasure market drops its oldest card each round", "Q-34b", bool("shiftTreasureMarket"))}
        ${optRow("treasureBuysPerEnd", "Treasures you can buy per End Phase", "Q-34b", num("treasureBuysPerEnd", 0, 5))}
        ${optRow("coveredSoulExchanges", "Covered Rooms' soul exchanges still work", "Q-35a", bool("coveredSoulExchanges"))}
        ${optRow("soulExchangeUsesPerEnd", "Uses of each soul exchange per End Phase", "Q-35a", num("soulExchangeUsesPerEnd", 1, 5))}
        ${optRow("warriorOverflowAffectsRooms", "Warrior overflow also weakens creature Rooms", "Q-59b", bool("warriorOverflowAffectsRooms"))}
        ${optRow("slowedAffectsOverworld", "Slowed also slows Overworld movement", "Q-87b", bool("slowedAffectsOverworld"))}
        ${optRow("rewardSoulsHarvested", "Souls from Objective rewards count as harvested", "Q-78", bool("rewardSoulsHarvested"))}
        ${optRow("championOnEmptiedSpace", "Champion whose space is emptied", "Q-49c", `<select data-cfg="championOnEmptiedSpace" ${host ? "" : "disabled"}>${["stays", "discard"].map((v) => `<option ${(cfg.championOnEmptiedSpace ?? SERVER_CFG.defaults.championOnEmptiedSpace) === v ? "selected" : ""}>${v}</option>`).join("")}</select>`)}
      </div></details>
    </div>
    <button class="ghost" data-a="leave">Leave</button>
  </div>`;
}

// ---------- game screen ----------
const me = () => view.players[view.you];
const acting = () => view.acting.includes(view.you);
const stepType = () => view.step?.type;

function gameScreen() {
  const phases = ["upkeep", "town", "build", "lure", "adventure", "end"];
  const markets = ui.center === "markets";
  return `<div id="game">
    <header class="topbar"><h1>The Wicked Awaken</h1><span class="muted">Round ${view.round || "—"}</span>
      <div class="phases">${view.phase === "setup" ? '<span class="on">Setup</span>' : phases.map((p) => `<span class="${view.phase === p ? "on" : ""}">${p[0].toUpperCase() + p.slice(1)}</span>`).join("")}</div>
      <div class="counts"><span title="Heroes left in the Hero deck">🦸 ${view.counts.heroDeck} to come</span><span title="Heroes killed">💀 ${view.counts.fallen} fallen</span><span>🏰 ${esc(lobby.code)}</span><button class="small" data-a="rules">Rules</button></div>
    </header>
    ${promptBar()}
    <div class="main">
      <aside class="left">
        <div class="townbox" data-scroll="town">${townPanel()}</div>
        <div class="logbox"><h3 class="lh">📜 Chronicle</h3><div class="log" data-scroll="log" onscroll="window.__logScroll(this)">${logHtml()}</div></div>
      </aside>
      <section class="center">${tabsHtml()}<div class="viewbody" data-scroll="${markets ? "markets" : "lands-" + ui.tab}">${markets ? marketsPanel() : landsHtml(view.players[ui.tab ?? view.you])}</div></section>
      <aside class="right">${sidePanel()}</aside>
    </div>
  </div>`;
}
/** When it becomes your turn, show the screen and panel that turn is about. */
function autoFocus() {
  const t = stepType(), p = me(), allow = view.me.allow ?? {};
  if (["roomDraft", "town"].includes(t)) ui.center = "markets";
  else if (["build", "buildTricks", "lure", "adventure"].includes(t)) { ui.center = "lands"; ui.tab = view.you; }
  else if (t === "end") ui.center = allow.treasureBuys > 0 && view.markets.treasure.some((c) => p.coins >= C(c).coinCost && p.soulsTotal >= C(c).soulThreshold) ? "markets" : "lands";
  if (["roomDraft", "build", "buildTricks"].includes(t)) ui.side = "hand";
  if (t === "end" && view.me.hand.rooms.length + view.me.hand.tricks.length > 7) ui.side = "hand";
  if (t === "lure" && view.me.townMinions) ui.side = "you";
  ui.inspect = null;
}
window.__logScroll = (el) => { ui.stickLog = el.scrollTop + el.clientHeight >= el.scrollHeight - 8; };

const STEP_TEXT = {
  draftVillain: () => `<b>Villain draft</b>: pick ${view.step.pick} of 3. Your pack passes left.`,
  chooseVillain: () => (view.step.reason === "setup" ? "<b>Choose your starting Villain</b> in secret. The other two wait face-down." : "<b>Your Villain fell!</b> Choose who takes over the dungeon."),
  startingTricks: () => "<b>Starting Tricks</b>: draw 2, keep 1, three times.",
  roomDraft: () => "<b>Opening Room draft</b>: take a Room from the Dungeon Market, or draw one blind.",
  town: () => "<b>Town Phase</b>: make ONE pick: take a Room, hire a Champion, or raise a Terrain + Monster pair (click a pair, then a wasteland square).",
  build: () => {
    const a = view.me.allow;
    return `<b>Build Phase</b> (in secret): ${a.placements ? "place <b>1 Room or 1 Champion</b> (select it, then click a space)" : "placement used"}. Extras: pay Champions, ${a.championMoves ? "move a Champion, " : ""}${a.monsterMoves ? "move a Monster, " : ""}order Minions, use powers.`;
  },
  buildTricks: () => `<b>Build Tricks</b>: play Build-phase Tricks, one player at a time.${view.me.allow.placements ? " You have an extra Room placement." : ""}${view.me.allow.monsterMoves ? " You have an extra Monster move." : ""}`,
  lure: () => `<b>Lure Phase</b>: ${view.me.townMinions ? "aim your Town Minions (right panel), " : ""}play Lure Tricks, then Heroes check every dungeon's treasure.`,
  adventure: () => "<b>Adventure Phase</b>: play Adventure Tricks now. Then every Hero moves and fights.",
  end: () => `<b>End Phase</b>: buy a Treasure (click it), trade souls at your Rooms, play End Tricks, discard down to 7. Then "Have it" Objectives are checked.`,
};

function promptBar() {
  if (view.phase === "gameOver") return `<div class="prompt"><span class="msg"><b>The game is over.</b></span><button data-a="results">Show results</button>${seat === 0 ? '<button class="primary" data-a="rematch">New game, same table</button>' : ""}</div>`;
  const t = stepType();
  if (!acting()) {
    const who = view.acting.map(pname).map(esc).join(", ");
    return `<div class="prompt waiting"><span class="msg">${STEP_TEXT[t]?.().replace(/<b>(.*?)<\/b>.*/, "<b>$1</b>") ?? ""} · Waiting for ${who || "…"}</span></div>`;
  }
  const btns = [];
  if (t === "roomDraft") btns.push('<button data-a="blind">Draw blind</button>');
  if (t === "town") { if (view.config.blindDrawInTown) btns.push('<button data-a="townBlind">Draw blind</button>'); btns.push('<button data-a="pass">Pass</button>'); }
  if (["build", "buildTricks", "lure", "adventure", "end"].includes(t)) btns.push(`<button class="primary" data-a="done">${t === "build" ? "Done building" : t === "adventure" ? "Done: let the Heroes move" : "Done"}</button>`);
  if (ui.sel) btns.unshift(`<span class="tag" style="background:var(--gold);color:#000">${esc(selText())}</span><button class="small" data-a="cancelSel">Cancel</button>`);
  const uses = view.me.usable.map((u, i) => `<button class="small" data-a="use" data-i="${i}" ${u.affordable && u.targetable ? "" : "disabled"} title="${esc(`${u.text}${!u.affordable ? "\n(can't afford)" : ""}${!u.targetable ? "\n(no valid target)" : ""}`)}">✦ ${esc(u.name)} <span class="price">${costTxt(u.cost)}</span></button>`).join("");
  const exch = t === "end" ? soulExchangeButtons() : "";
  return `<div class="prompt"><span class="msg">${STEP_TEXT[t]?.() ?? ""}</span><div class="uses">${uses}${exch}</div><span class="grow"></span>${btns.join(" ")}</div>`;
}
function selText() {
  const s = ui.sel;
  if (!s) return "";
  if (s.kind === "handRoom") return `Place ${C(s).name}: click a dungeon space`;
  if (s.kind === "reserveChamp") return `Place ${C(s).name}: click a space with a Room`;
  if (s.kind === "spaceChamp") return `Move the Champion: click a space without one`;
  if (s.kind === "monster") return `Move the Monster: click a Terrain square`;
  if (s.kind === "terrain") return `Raise the pair: click a wasteland square`;
  return "";
}
function soulExchangeButtons() {
  const p = me();
  const out = [];
  p.dungeon.forEach((sp, i) => {
    const rooms = view.config.coveredSoulExchanges ? sp.stack : sp.stack.slice(-1);
    for (const r of rooms) (C(r).soulExchanges ?? []).forEach((x, k) => {
      const used = (view.me.exchangesUsed[`${r.uid}:${k}`] ?? 0) >= view.config.soulExchangeUsesPerEnd;
      out.push(`<button class="small" data-a="exchange" data-space="${i}" data-room="${r.uid}" data-k="${k}" ${p.souls >= x.souls && !used ? "" : "disabled"} title="${esc(x.gives.text)}">👻${x.souls} ${esc(C(r).name)}: ${esc(x.gives.text)}</button>`);
    });
  });
  return out.join("");
}

function tabsHtml() {
  const t = stepType(), my = acting();
  const shop = my && (["roomDraft", "town"].includes(t) || (t === "end" && view.me.allow?.treasureBuys > 0));
  return `<div class="tabs">${view.players.map((p) => {
    const v = p.villains.find((x) => x.active);
    const vd = v?.card && C(v.card);
    const hp = vd ? `${vd.health - v.damage}/${vd.health}♥` : "";
    const alive = p.villains.filter((x) => !x.vanquished).length;
    return `<div class="tab ${ui.center !== "markets" && ui.tab === p.id ? "sel" : ""} ${p.acting ? "acting" : ""} ${p.eliminated ? "out" : ""}" data-a="tab" data-pid="${p.id}">
      <div class="nm">${vd ? spr(vd) : ""}${view.firstPlayer === p.id ? "👑" : ""}${esc(p.name)}${p.id === view.you ? ' <span class="muted">(you)</span>' : ""}</div>
      <div class="st"><span>¤${p.coins}</span><span title="Objectives claimed">🎯${p.claimed.length}</span><span>👻${p.soulsTotal}</span><span title="Villains left">☠${alive}/3</span>${hp ? `<span>${hp}</span>` : ""}</div></div>`;
  }).join("")}<div class="tab mk ${ui.center === "markets" ? "sel" : ""}" data-a="markets"><div class="nm">🛒 Markets${shop ? '<span class="badge">!</span>' : ""}</div><div class="st"><span>Rooms · Terrain</span><span>Champions · Treasure</span></div></div></div>`;
}

function landsHtml(p) {
  const mine = p.id === view.you;
  const t = stepType();
  const myTurn = acting() && mine;
  const heroesHere = (pred) => view.heroes.filter((h) => h.loc.at !== "town" && h.loc.owner === p.id && pred(h.loc));
  const sel = ui.sel;
  const board = overworldBoard(p, myTurn);
  // dungeon
  const building = myTurn && ["build", "buildTricks"].includes(t);
  const spaces = p.dungeon.map((sp, i) => {
    const top = sp.stack.at(-1);
    const hs = heroesHere((l) => l.at === "dungeon" && l.space === i);
    let cls = top ? "" : "empty", attrs = `data-a="space" data-pid="${p.id}" data-i="${i}"`;
    if (mine && building && (sel?.kind === "handRoom" || (sel?.kind === "reserveChamp" && top) || (sel?.kind === "spaceChamp" && !sp.champion && sel.i !== i))) cls += " target";
    if (mine && sel?.kind === "spaceChamp" && sel.i === i) cls += " selected";
    if (ui.inspect?.pid === p.id && ui.inspect.i === i) cls += " selected";
    const mins = p.minions.filter((m) => m === i).length;
    const below = sp.stack.slice(0, -1).map((r) => C(r).name).reverse();
    const ch = sp.champion;
    return `<div class="space ${cls} clickable" ${attrs}>
      <div class="idx"><span>Space ${i + 1}</span>${sp.stack.length > 1 ? `<span class="stackh" title="Underneath: ${esc(below.join(", "))}">▲${sp.stack.length}</span>` : ""}</div>
      ${top ? roomCard(top, 'style="width:100%"') : '<div class="emptytxt">empty<br>(takes a round to cross)</div>'}
      ${ch ? `<div class="champ" title="${tip(C(ch.card))}" ${mine && building && view.me.allow.championMoves ? `data-a="champ" data-i="${i}"` : ""}>${spr(C(ch.card))} ${esc(C(ch.card).name)} <b>Lv${ch.level}</b> ${C(ch.card).dice}🎲</div>` : ""}
      ${mins ? `<div class="minions" title="Minions here">${`<img class="spr imp" src="${minionSprite()}" alt="">`.repeat(mins)}</div>` : ""}
      <div class="inlands">${hs.map((h) => heroChip(h)).join("")}</div></div>`;
  }).join("");
  // villain lair
  const v = p.villains.find((x) => x.active) ?? null;
  const vd = v?.card && C(v.card);
  const fighters = heroesHere((l) => l.at === "fight");
  const lair = `<div class="lair">${vd ? `${artImg(vd)}<div class="vn" title="${tip(vd)}">${esc(vd.name)}</div><div class="hp"><i style="width:${Math.max(0, 100 * (vd.health - v.damage) / vd.health)}%"></i></div><div class="tiny">${vd.health - v.damage}/${vd.health} Health · ${threatHtml(vd.threat)}</div>${vd.power.map((e) => `<div class="tiny muted">${e.recharges ? (mine && p.powerUsed ? "⟳ (used) " : "⟳ ") : "◆ "}${esc(e.text)}</div>`).join("")}` : `<div class="vn">${p.eliminated ? "Eliminated" : "No Villain yet"}</div>`}
    <div class="inlands">${fighters.map((h) => heroChip(h)).join("")}</div>
    <div class="reserve">${p.villains.filter((x) => !x.active).map((x) => x.vanquished ? `<div>✝ ${x.card ? esc(C(x.card).name) : "?"} (vanquished)</div>` : `<div>${x.card ? `Reserve: ${esc(C(x.card).name)}` : "Reserve: face-down"}</div>`).join("")}</div></div>`;

  const insp = ui.inspect?.pid === p.id ? inspectorHtml(p, ui.inspect.i) : "";
  const treasureTotals = Object.entries(p.treasureByClass).map(([c, n]) => `${c[0]}${n}`).join(" · ");
  return `<div class="lands">
      <div class="owwrap"><div class="owhead"><h3>${p.id === view.you ? "Your" : esc(p.name) + "'s"} Overworld ${p.hiddenBuild ? '<span class="dim tiny">(building in secret…)</span>' : ""}</h3><span class="dim tiny">Heroes enter at the top-left and step right or down at random, one square a round</span></div>${board}</div>
      <div class="belowlands">
      ${overworldReport(p)}
      <div class="section treasury"><h3>Treasury <span class="dim" title="Treasure each class counts (own class + Gold/3)">lure: ${treasureTotals}</span></h3><div class="cards">${p.treasury.map((x) => (C(x).deck === "items" ? itemCard(x) : treasureCard(x))).join("") || '<span class="dim">empty: no Hero will be tempted</span>'}${p.treasureTokens.map((t) => `<span class="tag">${t.value} ${t.type}</span>`).join("")}</div></div>
      </div>
    </div>
    <div style="margin-top:6px"><h3 class="lh">Dungeon <span class="dim tiny">Heroes leave the Overworld at (4,4), go through spaces 1 → 5, then face the Villain</span></h3><div class="dungeon">${spaces}${lair}</div>${insp}</div>
    <div class="belowdungeon">
      <div class="section"><h3>Champions waiting <span class="dim">hired, not yet placed</span></h3><div class="cards">${p.championReserve.map((c) => champCard(c, mine && building && view.me.allow.placements ? `data-a="reserveChamp" data-uid="${c.uid}"` : "")).join("") || '<span class="dim">none</span>'}</div></div>
      <div class="section"><h3>Tainted Items <span class="dim">sustained (max 2)</span></h3><div class="cards">${p.sustained.map((s) => itemCard(s.card, "", s.exhausted ? '<div class="sub">⟳ exhausted</div>' : "")).join("") || '<span class="dim">none</span>'}</div></div>
      <div class="section"><h3>Minions <span class="dim">${p.minions.length}/5</span></h3><div class="tiny muted">${p.minions.length ? `Home ${p.minions.filter((m) => m === "home").length} · Town ${p.minions.filter((m) => m === "town").length} · Rooms ${p.minions.filter((m) => typeof m === "number").length}` : "none"}</div></div>
    </div>`;
}

const TERRAIN_TYPES = ["Forest", "Swamp", "Mountain", "Ruins"];
const heroesIn = (p, pred) => view.heroes.filter((h) => h.loc.at !== "town" && h.loc.owner === p.id && pred(h.loc));

/** The 4x4 Overworld as a 7x7 grid: squares on even rows/columns, flow arrows in the gutters between them. */
function overworldBoard(p, myTurn) {
  const mine = p.id === view.you, sel = ui.sel, t = stepType();
  const walkers = heroesIn(p, (l) => l.at === "overworld");
  const heroAt = (r, c) => walkers.some((h) => h.loc.r === r && h.loc.c === c);
  const canMoveMon = myTurn && view.me.allow.monsterMoves > 0 && ["build", "buildTricks"].includes(t);
  const out = [];
  for (let R = 0; R < 7; R++) for (let K = 0; K < 7; K++) {
    const r = R >> 1, c = K >> 1;
    if (R % 2 && K % 2) { out.push("<i></i>"); continue; }
    if (K % 2) { out.push(`<div class="flow right ${heroAt(r, c) ? "hot" : ""}">›</div>`); continue; }
    if (R % 2) { out.push(`<div class="flow down ${heroAt(r, c) ? "hot" : ""}">›</div>`); continue; }
    const sq = p.overworld[r][c];
    const td = C(sq.terrain), md = C(sq.monster);
    let cls = td ? `land ${td.terrainType}` : "waste", attrs = "";
    if (myTurn && sel?.kind === "terrain" && !td) { cls += " target"; attrs = `data-a="cell" data-r="${r}" data-c="${c}"`; }
    if (myTurn && sel?.kind === "monster" && td && !(sel.r === r && sel.c === c)) { cls += " target"; attrs = `data-a="cell" data-r="${r}" data-c="${c}"`; }
    if (mine && sel?.kind === "monster" && sel.r === r && sel.c === c) cls += " selected";
    if (md && td && md.preferredTerrain === td.terrainType) cls += " athome";
    if (td && !attrs) { cls += " inspectable"; attrs = `data-a="square" data-pid="${p.id}" data-r="${r}" data-c="${c}"`; }
    const hs = heroesIn(p, (l) => l.at === "overworld" && l.r === r && l.c === c);
    const corner = r === 0 && c === 0 ? '<span class="gate in">Entry</span>' : r === 3 && c === 3 ? '<span class="gate out">Exit</span>' : "";
    const mt = md && monsterThreatOn(md, td);
    out.push(`<div class="cell ${cls}" ${attrs} ${td ? `data-zoom style="--art:url(${artFor(td)})"` : ""}>
      <div class="ctop">${corner}<span class="tn">${td ? esc(td.name) : sel?.kind === "terrain" && myTurn ? "+ raise a pair here" : "wasteland"}</span><span class="xy">${r + 1},${c + 1}</span></div>
      ${md ? `<img class="mspr" src="${spriteFor(md)}" alt="">` : ""}
      <div class="cheroes">${hs.map((h) => heroChip(h)).join("")}</div>
      ${td ? `<div class="cbot"><div class="tk">${terrainLine(td)}</div>${md ? `<div class="mo ${canMoveMon ? "monster-pick" : ""}" ${canMoveMon ? `data-a="monster" data-r="${r}" data-c="${c}" title="Click to move this Monster"` : ""}>👹 ${threatHtml(mt)}${mt !== md.threat ? ' <b class="star" title="On its preferred terrain">★</b>' : ""} <span class="mn">${esc(md.name)}</span></div>` : ""}</div>` : ""}
      ${td ? `<template class="zoomsrc">${pairCard({ terrain: sq.terrain, monster: sq.monster })}</template>` : ""}
    </div>`);
  }
  const exitHot = heroAt(3, 3);
  return `<div class="owboard">${out.join("")}</div><div class="owexit ${exitHot ? "hot" : ""}">Exit (4,4) → <b>Dungeon</b> ↓</div>`;
}

/** The column beside the board: how built-up the Overworld is, and who is on the road. */
function overworldReport(p) {
  const sqs = p.overworld.flat();
  const lands = sqs.filter((s) => s.terrain).map((s) => ({ t: C(s.terrain), m: C(s.monster) }));
  const mons = lands.filter((x) => x.m);
  const home = mons.filter((x) => x.m.preferredTerrain === x.t.terrainType).length;
  const segs = sqs.map((s) => `<i class="${s.terrain ? C(s.terrain).terrainType : ""}"></i>`).join("");
  const types = TERRAIN_TYPES.map((ty) => {
    const n = lands.filter((x) => x.t.terrainType === ty).length;
    const likes = mons.filter((x) => x.m.preferredTerrain === ty).length;
    return `<div class="tyrow ${n || likes ? "" : "none"}"><span class="sw ${ty}"></span><span class="grow">${ty}</span><span title="Terrain squares">${n} sq</span><span class="dim" title="Monsters that prefer this terrain">${likes} 👹</span></div>`;
  }).join("");
  const road = heroesIn(p, () => true).map((h) => {
    const l = h.loc;
    const where = l.at === "overworld" ? `at ${l.r + 1},${l.c + 1} · ${7 - l.r - l.c} move${7 - l.r - l.c === 1 ? "" : "s"} to the dungeon` : l.at === "dungeon" ? `in dungeon space ${l.space + 1}` : "fighting the Villain";
    return `<div class="roadrow">${heroChip(h)}<span class="dim tiny">${where}</span></div>`;
  }).join("");
  return `<div class="section owreport"><h3>Overworld <span class="dim">${lands.length}/16 Terrain</span></h3>
      <div class="fill">${segs}</div>
      <div class="tystats">${types}</div>
      <div class="tiny muted">${lands.filter((x) => x.t.kind === "hazard").length} Hazards · ${lands.filter((x) => x.t.kind === "status").length} Statuses · ${mons.length} Monsters, <span title="On their preferred terrain">${home} at home ★</span></div></div>
    <div class="section"><h3>On the road <span class="dim">Heroes lured here</span></h3><div class="road">${road || '<span class="dim">No Heroes in these lands.</span>'}</div></div>`;
}

function inspectorHtml(p, i) {
  const sp = p.dungeon[i];
  const mine = p.id === view.you;
  const t = stepType();
  const lines = [];
  lines.push(`<div class="row"><h3 class="grow">Space ${i + 1}</h3><button class="small ghost" data-a="closeInspect">✕</button></div>`);
  if (!sp.stack.length) lines.push('<div class="dim">Empty. A Hero takes one round to cross it.</div>');
  lines.push(`<div class="cards">${[...sp.stack].reverse().map((r, k) => roomCard(r, "", k === 0 ? '<div class="tag">TOP</div>' : '<div class="sub">covered</div>')).join("")}${sp.champion ? champCard(sp.champion.card, "", `<div class="tag">Level ${sp.champion.level}</div>`, sp.champion.level) : ""}</div>`);
  if (mine && acting() && t === "build") {
    const btns = [];
    const ch = sp.champion;
    const lvl = ch && C(ch.card).levels[ch.level];
    if (lvl) btns.push(`<button class="small" data-a="advance" data-i="${i}" ${me().coins >= lvl.coins ? "" : "disabled"}>Pay ${esc(C(ch.card).name)} ${lvl.coins}¤ → Lv${ch.level + 1}</button>`);
    if (sp.stack.length) btns.push(`<button class="small" data-a="destroy" data-i="${i}">Destroy top Room</button>`);
    lines.push(`<div class="row" style="margin-top:6px">${btns.join("")}</div>`);
  }
  return `<div class="inspector">${lines.join("")}</div>`;
}

function townPanel() {
  const town = view.heroes.filter((h) => h.loc.at === "town");
  const classes = ["Warrior", "Mage", "Acolyte", "Rogue"];
  const OV = { Warrior: "Monsters −1 dmg", Mage: "Tricks +1¤", Acolyte: "Heroes heal 1", Rogue: "Loot −1¤" };
  return `<div class="section"><h3>🏘 Town <span class="dim">${town.length} Heroes · buildings hold 2</span></h3><div class="town">${classes.map((c) => {
    const hs = town.filter((h) => C(h).class === c);
    const ov = view.overflow[c];
    return `<div class="bldg ${c}"><h4><span>${c}s</span>${ov ? `<span class="ov" title="Each overflowing ${c}: ${OV[c]}">+${ov}: ${OV[c]}</span>` : ""}</h4><div class="heroes">${hs.map((h, i) => heroChip(h, i >= 2 ? "overflow" : "")).join("")}</div></div>`;
  }).join("")}</div>
  ${view.townShop.length ? `<div class="tiny muted" style="margin-top:4px">Town Shop: ${view.townShop.map((i) => `<span title="${tip(C(i))}">${esc(C(i).name)}</span>`).join(", ")}</div>` : ""}</div>`;
}

function marketsPanel() {
  const t = stepType();
  const my = acting();
  const coins = me().coins;
  const roomsClick = my && (t === "roomDraft" || t === "town");
  const room = view.markets.dungeon.map((c, i) => roomCard(c, roomsClick ? `data-a="mkRoom" data-i="${i}"` : "")).join("");
  const terr = view.markets.terrain.map((pr, i) => pairCard(pr, my && t === "town" ? `data-a="mkTerrain" data-i="${i}" data-state="${ui.sel?.kind === "terrain" && ui.sel.i === i ? "selected" : ""}"` : "")).join("");
  const champ = view.markets.champion.map((c, i) => { const ok = my && t === "town" && coins >= C(c).cost; return champCard(c, ok ? `data-a="mkChamp" data-i="${i}"` : (my && t === "town" ? 'data-state="disabled"' : "")); }).join("");
  const treas = view.markets.treasure.map((c, i) => {
    const d = C(c);
    const ok = my && t === "end" && coins >= d.coinCost && me().soulsTotal >= d.soulThreshold && view.me.allow.treasureBuys > 0;
    return treasureCard(c, ok ? `data-a="mkTreasure" data-i="${i}"` : (my && t === "end" ? 'data-state="disabled"' : ""));
  }).join("");
  const hot = my ? ({ roomDraft: ["dungeon"], town: ["dungeon", "terrain", "champion"], end: ["treasure"] }[t] ?? []) : [];
  const secs = [
    ["dungeon", `Dungeon Market <span class="dim">oldest left · ${view.counts.dungeonDeck} in deck${t === "town" ? " · click one to take it" : ""}</span>`, room],
    ["terrain", `Terrain Market <span class="dim">Terrain + Monster pairs${my && t === "town" ? " · click one, then a wasteland square" : ""}</span>`, terr],
    ["champion", `Champion Market <span class="dim">hire with Coins${my && t === "town" ? ` · you have ${coins}¤` : ""}</span>`, champ],
    ["treasure", `Treasure Market <span class="dim">bought in the End Phase · needs Coins and souls harvested</span>`, treas],
    ["objective", `Objective Market <span class="dim">claim the most to win · ${view.counts.objectiveDeck} in deck</span>`, view.markets.objective.map((c) => objectiveCard(c)).join("")],
  ].sort((a, b) => hot.includes(b[0]) - hot.includes(a[0]));
  return `<div class="markets">${secs.map(([k, h, body]) => `<div class="section ${hot.includes(k) ? "hot" : ""}"><h3>${h}</h3><div class="cards">${body || '<span class="dim">empty</span>'}</div></div>`).join("")}</div>`;
}

/** The right panel's Objectives tab: what's up for grabs, and who has claimed what. */
function objectivesPanel() {
  const board = view.players.filter((q) => !q.eliminated).sort((a, b) => b.claimed.length - a.claimed.length || b.soulsTotal - a.soulsTotal || b.coins - a.coins);
  const rows = board.map((q) => `<div class="claimrow ${q.id === view.you ? "you" : ""}"><div class="row"><b class="grow">${esc(q.name)}${q.id === view.you ? ' <span class="dim">(you)</span>' : ""}</b><span class="cnt">🎯 ${q.claimed.length}</span><span class="dim tiny" title="Tie-breaks: souls harvested, then Coins">👻${q.soulsTotal} ¤${q.coins}</span></div>${q.claimed.length ? `<div class="tiny muted">${q.claimed.map((c) => `<span title="${esc(C(c).text)}">${esc(C(c).name)}</span>`).join(" · ")}</div>` : ""}</div>`).join("");
  return `<div class="section"><h3>Up for grabs <span class="dim">${view.counts.objectiveDeck} more in the deck</span></h3><div class="objs">${view.markets.objective.map((c) => objectiveCard(c, 'style="width:100%"')).join("") || '<span class="dim">none left</span>'}</div></div>
    <div class="section"><h3>Claimed <span class="dim">ties: souls, then Coins</span></h3>${rows}</div>`;
}
function sidePanel() {
  const p = me();
  const t = stepType();
  const my = acting();
  const v = p.villains.find((x) => x.active);
  const building = my && ["build", "buildTricks"].includes(t) && view.me.allow.placements > 0;
  const handN = view.me.hand.rooms.length + view.me.hand.tricks.length;
  const over = my && t === "end" && handN > 7;
  const rooms = view.me.hand.rooms.map((r) => roomCard(r, building ? `data-a="handRoom" data-uid="${r.uid}" data-state="${ui.sel?.uid === r.uid ? "selected" : ""}"` : "", over ? `<button class="small" data-a="discard" data-kind="room" data-uid="${r.uid}">Discard</button>` : "")).join("");
  const tricks = view.me.tricks.map((tr) => trickCard(tr, "", over ? `<button class="small" data-a="discard" data-kind="trick" data-uid="${tr.uid}">Discard</button>` : "", tr.cost)).join("");
  const ex = p.exhausted.map((x) => trickCard(x.card, 'data-state="disabled"', `<div class="sub">⟳ back in ${x.refreshIn} Upkeep${x.refreshIn > 1 ? "s" : ""}</div>`)).join("");
  const imp = `<img class="spr imp" src="${minionSprite()}" alt="">`;
  const minionOrders = my && t === "build" && p.minions.length ? `<div class="mlist">${p.minions.map((m, i) => `<div class="row">${imp}<span class="tiny">Minion ${i + 1}</span><select class="small" data-c="minionOrder" data-i="${i}">${["home", "town", 0, 1, 2, 3, 4].map((o) => `<option value="${o}" ${m === o ? "selected" : ""}>${o === "home" ? "Stay home" : o === "town" ? "Go to Town (+1 tempt)" : `Space ${o + 1}${C(p.dungeon[o].stack.at(-1))?.minionBonus ? " ★" : ""}`}</option>`).join("")}</select></div>`).join("")}</div>` : "";
  const town = view.heroes.filter((h) => h.loc.at === "town");
  const minionTargets = my && t === "lure" && view.me.townMinions ? `<div class="mlist">${Array.from({ length: view.me.townMinions }, (_, k) => `<div class="row">${imp}<span class="tiny">Town Minion ${k + 1} tempts</span><select class="small" data-c="minionTarget" data-k="${k}"><option value="">(auto)</option>${town.map((h) => `<option value="${h.uid}" ${view.me.minionTargets[k] === h.uid ? "selected" : ""}>${esc(C(h).name)}</option>`).join("")}</select></div>`).join("")}</div>` : "";
  const storedItems = p.treasury.filter((x) => C(x).deck === "items");
  const sustain = my && ["build", "end"].includes(t) && storedItems.length ? `<div class="mlist">${storedItems.map((it) => `<div class="row"><span class="tiny">${esc(C(it).name)}</span>${p.sustained.length < 2 ? `<button class="small" data-a="sustain" data-uid="${it.uid}">Sustain</button>` : p.sustained.map((s) => `<button class="small" data-a="sustain" data-uid="${it.uid}" data-replace="${s.card.uid}">Swap for ${esc(C(s.card).name)}</button>`).join("")}</div>`).join("")}</div>` : "";
  const todo = !!(minionOrders || minionTargets || sustain);
  const reserve = p.villains.filter((x) => !x.active).map((x) => `<div class="row tiny">${x.card ? spr(C(x.card)) : "?"}${x.vanquished ? `✝ ${x.card ? esc(C(x.card).name) : "?"} (vanquished)` : `Reserve: ${x.card ? esc(C(x.card).name) : "face-down"}`}</div>`).join("");
  const side = ui.side ?? "hand";
  const tabs = [
    ["you", `${v ? spr(C(v.card)) : "☠ "}Villain${todo ? '<span class="badge">!</span>' : ""}`],
    ["hand", `Hand <span class="${handN > 7 ? "over" : "dim"}">${handN}/7</span>${over || (building && side !== "hand") ? '<span class="badge">!</span>' : ""}`],
    ["goals", `Objectives <span class="dim">🎯${p.claimed.length}</span>`],
  ];
  let body;
  if (side === "you") body = `${v ? villainCard(v.card, 'style="width:100%"', `<div class="hp"><i style="width:${100 * (C(v.card).health - v.damage) / C(v.card).health}%"></i></div><div class="sub">${C(v.card).health - v.damage}/${C(v.card).health} Health${p.powerUsed ? " · power used" : ""}</div>`) : ""}
    ${minionOrders ? `<div class="section"><h3>Minion orders</h3>${minionOrders}</div>` : ""}
    ${minionTargets ? `<div class="section"><h3>Town Minions</h3>${minionTargets}</div>` : ""}
    ${sustain ? `<div class="section"><h3>Stored Tainted Items</h3>${sustain}</div>` : ""}
    <div class="section"><h3>Your other Villains</h3>${reserve || '<span class="dim">none</span>'}</div>`;
  else if (side === "goals") body = objectivesPanel();
  else body = `<div class="handcards"><div class="cards">${rooms || '<span class="dim">no Rooms</span>'}</div><h3 class="lh" style="margin-top:8px">Tricks</h3><div class="cards">${tricks}${ex || ""}${tricks || ex ? "" : '<span class="dim">no Tricks</span>'}</div></div>`;
  return `<div class="res"><div class="c"><b>${p.coins}</b>Coins</div><div class="s"><b>${p.souls}</b>Souls <span class="dim tiny">(${p.soulsTotal})</span></div><div class="m"><b>${p.minions.length}</b>Minions</div></div>
    <nav class="subtabs">${tabs.map(([k, label]) => `<button class="${side === k ? "on" : ""}" data-a="side" data-k="${k}">${label}</button>`).join("")}</nav>
    <div class="sidebody" data-scroll="side-${side}">${body}</div>`;
}

function logHtml() {
  return view.log.map((e) => {
    let txt = esc(e.text);
    if (e.kind === "roll" && e.heroRoll) txt = txt.replace(/: (\d+ hits?) vs (\d+)/, `: ${diceHtml(e.heroRoll)} $1 vs ${diceHtml(e.threatRoll, "t")} $2`);
    return `<div class="${e.kind ?? ""}">${txt}</div>`;
  }).join("");
}

// ---------- modals ----------
function modalHtml() {
  if (ui.modal?.kind === "rules") return rulesModal();
  if (!view || !lobby?.started) return "";
  const t = stepType();
  if (view.phase === "gameOver" && !ui.resultsDismissed) return resultsModal();
  if (view.me.pendingTricks) return `<div class="dialog"><h2>Choose a Trick</h2><div class="lead">Keep one; the other is discarded.</div><div class="cards">${view.me.pendingTricks.map((c, i) => trickCard(c, `data-a="chooseTrick" data-i="${i}"`)).join("")}</div></div>`;
  if (acting() && t === "draftVillain") return `<div class="dialog"><h2>Villain draft: pick ${view.step.pick} of 3</h2><div class="lead">Villains are your lives. Keep one; the rest pass to the next player.${me().villains.length ? ` You have: ${me().villains.map((v) => esc(C(v.card).name)).join(", ")}.` : ""}</div><div class="cards">${view.me.draftPack.map((c) => villainCard(c, `data-a="draftVillain" data-uid="${c.uid}"`)).join("")}</div></div>`;
  if (acting() && t === "chooseVillain") return `<div class="dialog"><h2>${view.step.reason === "setup" ? "Who rules your dungeon first?" : "Your Villain has fallen"}</h2><div class="lead">${view.step.reason === "setup" ? "Chosen in secret; revealed when everyone has chosen." : "Choose who takes over. Everything else carries over."}</div><div class="cards">${me().villains.filter((v) => !v.vanquished).map((v) => villainCard(v.card, `data-a="chooseVillain" data-uid="${v.card.uid}"`, v.damage ? `<div class="sub">${v.damage} damage</div>` : "")).join("")}</div></div>`;
  if (ui.modal?.kind === "hero") return heroSheet(ui.modal.uid);
  if (ui.modal?.kind === "square") return squareSheet(ui.modal);
  if (ui.modal?.kind === "picker") {
    const m = ui.modal;
    return `<div class="dialog"><h2>${esc(m.title)}</h2><div class="lead">${esc(m.lead ?? "")}</div><div class="picklist">${m.options.map((o, i) => `<button data-a="pick" data-i="${i}">${esc(o.label)}</button>`).join("") || '<span class="dim">No valid choices.</span>'}</div><div class="row" style="margin-top:10px"><button class="ghost" data-a="closeModal">Cancel</button></div></div>`;
  }
  return "";
}

// ---------- character sheets ----------
const STATUS_TEXT = {
  Cursed: () => "−1 die on every roll.",
  Slowed: () => `Spends 2 rounds in each dungeon Room and empty space${view.config.slowedAffectsOverworld ? ", and on each Overworld square" : ""}.`,
  Bleeding: () => "Loses 1 Health in each End Phase.",
};
const CLASS_INFO = {
  Warrior: { stat: "might", passive: () => "+1 Health (already counted in max Health)." },
  Mage: { stat: "magic", passive: (h) => `Ignores the first status inflicted each trip out of Town. ${h.statusIgnores ? `<b>${h.statusIgnores} left</b> this trip.` : "Used up this trip."}` },
  Acolyte: { stat: "faith", passive: () => "Heals 1 after each exchange they win (up to max Health)." },
  Rogue: { stat: "cunning", passive: (h) => `Skips the first trap Room each trip. ${h.trapSkips ? `<b>${h.trapSkips} left</b> this trip.` : "Used up this trip."}` },
};
const STAT_ORDER = ["might", "magic", "faith", "cunning"];

function heroWhere(h) {
  const l = h.loc, own = l.owner === view.you ? "your" : `${esc(pname(l.owner))}'s`;
  if (l.at === "town") return "In Town, waiting to be lured";
  if (l.at === "overworld") return `In ${own} Overworld at ${l.r + 1},${l.c + 1}: ${7 - l.r - l.c} move${7 - l.r - l.c === 1 ? "" : "s"} to the dungeon`;
  if (l.at === "dungeon") return `In ${own} dungeon, space ${l.space + 1}`;
  return `Fighting ${own} Villain`;
}

function heroSheet(uid) {
  const h = view.heroes.find((x) => x.uid === uid);
  if (!h) return `<div class="dialog sheet"><h2>This Hero has fallen</h2><div class="row" style="margin-top:10px"><button data-a="closeModal">Close</button></div></div>`;
  const d = C(h), ci = CLASS_INFO[d.class];
  const pct = Math.max(0, 100 * h.health / h.maxHealth);
  const stats = STAT_ORDER.map((st) => {
    const base = d.stats[st], now = h.dice[st];
    const diff = now - base;
    return `<tr class="${st === ci.stat ? "mainstat" : ""}"><td>${statTag(st)}${st === ci.stat ? ' <span class="dim tiny">main</span>' : ""}</td><td class="num">${base}</td><td class="num ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${now}🎲${diff ? ` <span class="tiny">(${diff > 0 ? "+" : ""}${diff})</span>` : ""}</td></tr>`;
  }).join("");
  const statuses = h.statuses.length
    ? h.statuses.map((s) => `<div class="stline"><b>${s.status}</b> <span class="tag">${s.rounds} round${s.rounds > 1 ? "s" : ""} left</span><div class="tiny muted">${STATUS_TEXT[s.status]?.() ?? ""}</div></div>`).join("")
    : '<span class="dim">None.</span>';
  const item = h.carrying ? (() => { const it = C(h.carrying); return `<div class="stline"><b>${esc(it.name)}</b> <span class="tag">${it.type}</span><div class="tiny">${esc(it.heroEffect.map((e) => e.text).join(" "))}</div><div class="tiny dim">If this Hero dies, the killer gains it Tainted: ${esc(it.villainEffect.map((e) => e.text).join(" "))}</div></div>`; })() : '<span class="dim">Nothing.</span>';
  const tempts = Object.entries(h.tempts ?? {}).filter(([, n]) => n > 0);
  const live = view.players.filter((q) => !q.eliminated);
  const lure = h.loc.at === "town" ? `<table class="sheettab"><tr><th>Dungeon</th><th>${d.class} treasure</th><th>Tempts</th></tr>${live.map((q) => {
    const t = q.treasureByClass[d.class] ?? 0;
    return `<tr><td>${q.id === view.you ? "You" : esc(q.name)}</td><td class="num ${t >= d.desire ? "up" : ""}">${t} ${t >= d.desire ? "✓ auto-tempt" : `(roll ${t} di${t === 1 ? "e" : "ce"})`}</td><td class="num">${h.tempts?.[q.id] ?? 0}/${h.lure}</td></tr>`;
  }).join("")}</table>` : `<div class="tiny muted">${tempts.length ? `Was tempted by ${tempts.map(([pid, n]) => `${esc(pname(+pid))} (${n})`).join(", ")}.` : ""} Lured Heroes return to Town only if they beat a Villain.</div>`;
  return `<div class="dialog sheet hero-sheet ${d.class}">
    <div class="sheethead">${artImg(d)}<div class="grow"><h2>${spr(d)} ${esc(d.name)}</h2><div class="muted">${d.tier} ${d.class} · worth ${d.souls} soul${d.souls > 1 ? "s" : ""}</div>
      <div class="hp big"><i style="width:${pct}%"></i></div><div><b>${h.health}</b>/${h.maxHealth} Health</div>
      <div class="tiny muted" style="margin-top:4px">${heroWhere(h)}</div></div></div>
    <div class="sheetgrid">
      <div><h3>Stats</h3><table class="sheettab"><tr><th></th><th>Printed</th><th>Rolls now</th></tr>${stats}</table>
        <div class="tiny dim">A threat tests one stat: the Hero rolls that many dice, each 5–6 is a hit.</div></div>
      <div><h3>Status effects</h3>${statuses}
        <h3>Class passive</h3><div class="tiny">${ci.passive(h)}</div>
        <h3>Carrying</h3>${item}</div>
    </div>
    <h3>Lure</h3><div class="tiny muted">Desire ${d.desire}: wants ${d.class} treasure (Gold counts 1/3). Needs ${h.lure} tempt${h.lure > 1 ? "s" : ""} from one dungeon to be lured.</div>${lure}
    <div class="row" style="margin-top:12px"><span class="grow"></span><button data-a="closeModal">Close</button></div></div>`;
}

function squareSheet({ pid, r, c }) {
  const p = view.players[pid];
  const sq = p?.overworld[r]?.[c];
  const td = C(sq?.terrain), md = C(sq?.monster);
  if (!td) return `<div class="dialog sheet"><h2>Wasteland</h2><div class="lead">Nothing here yet.</div><div class="row"><button data-a="closeModal">Close</button></div></div>`;
  const owner = pid === view.you ? "Your" : `${esc(p.name)}'s`;
  const terr = td.kind === "hazard"
    ? `<div><b>Hazard</b> at ${td.threat.rank} rank: tests ${statTag(td.threat.tests)} with <b>${td.threat.dice}</b> dice and deals <b>${td.threat.damage}</b> damage if it wins.</div>`
    : `<div><b>Status</b>: inflicts <b>${td.status}</b> for <b>${td.statusRounds}</b> round${td.statusRounds > 1 ? "s" : ""} (adds to the timer if they already have it).</div><div class="tiny muted">${td.status}: ${STATUS_TEXT[td.status]?.() ?? ""}</div>`;
  let mon = '<div class="dim">No Monster guards this square.</div>';
  if (md) {
    const here = monsterThreatOn(md, td), home = here !== md.threat;
    const warrior = view.overflow?.Warrior ?? 0;
    const dmg = Math.max(0, here.damage - warrior);
    mon = `<div class="monrow"><img class="bigspr" src="${spriteFor(md)}" alt=""><div class="grow">
      <div><b>${esc(md.name)}</b>${home ? ' <span class="tag star">★ on home terrain</span>' : ""}</div>
      <div class="tiny muted">Prefers ${md.preferredTerrain}. Printed: ${threatHtml(md.threat)}. Home bonus: ${esc(md.preferredBonus.map((e) => e.text).join(" "))}</div>
      <div style="margin-top:4px">Fights here: tests ${statTag(here.tests)} with <b>${here.dice}</b> dice, <b>${dmg}</b> damage${warrior ? ` <span class="tiny dim">(−${warrior} from Warrior overflow in Town)</span>` : ""}, ${here.rank} rank.</div>
      <div class="tiny dim">Villain powers and Tricks can add to this in the Adventure Phase.</div></div></div>`;
  }
  const hs = view.heroes.filter((h) => h.loc.at === "overworld" && h.loc.owner === pid && h.loc.r === r && h.loc.c === c);
  return `<div class="dialog sheet square-sheet">
    <div class="sheethead"><img class="art" src="${pairArt(td, md)}" alt=""><div class="grow"><h2>${esc(td.name)}</h2><div class="muted">${td.terrainType} · ${owner} Overworld, square ${r + 1},${c + 1}${r === 0 && c === 0 ? " (entry)" : r === 3 && c === 3 ? " (exit to the dungeon)" : ""}</div></div></div>
    <h3>Terrain</h3>${terr}
    <h3>Monster</h3>${mon}
    <div class="tiny dim" style="margin-top:6px">A Hero entering this square faces the Terrain first, then the Monster.</div>
    <h3>Heroes here</h3><div class="heroes">${hs.map((h) => heroChip(h)).join("") || '<span class="dim">None.</span>'}</div>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button data-a="closeModal">Close</button></div></div>`;
}

function resultsModal() {
  const r = view.result;
  const order = (p) => { const i = r.standings.findIndex((s) => s.pid === p.id); return i < 0 ? 99 : i; };
  const rows = [...view.players].sort((a, b) => order(a) - order(b)).map((p) => `<tr><td>${r.winners.includes(p.id) ? "👑 " : ""}${esc(p.name)}</td><td>${p.eliminated ? "eliminated" : `🎯 ${p.claimed.length}`}</td><td>${p.soulsTotal}</td><td>${p.coins}</td><td class="tiny">${p.claimed.map((c) => `${esc(C(c).name)} <span class="dim">(${esc(C(c).text)})</span>`).join("<br>") || '<span class="dim">none</span>'}</td></tr>`).join("");
  const head = r.heroesWin ? "The Heroes win. Every villain has been eliminated." : r.solo ? "Solo sandbox complete (solo scoring is still an open design question, Q-01a)." : `${r.winners.map(pname).map(esc).join(" and ")} ${r.winners.length > 1 ? "share the title of" : "becomes the"} Overlord!`;
  return `<div class="dialog"><h2>${head}</h2><div class="lead">Most Objectives claimed wins. Ties go to the most souls harvested, then the most Coins; if still tied, the win is shared.</div><table class="standings"><tr><th>Villain</th><th>Objectives</th><th>Souls harvested</th><th>Coins</th><th>Claimed</th></tr>${rows}</table><div class="row" style="margin-top:12px"><button data-a="dismissResults">Look at the board</button>${seat === 0 ? '<button class="primary" data-a="rematch">New game, same table</button>' : ""}</div></div>`;
}

function rulesModal() {
  return `<div class="dialog rules"><h2>How to play (quick reference)</h2>
  <p>You are a Villain. Lure Heroes with treasure, kill them in your Overworld and dungeon, and harvest their souls. Everyone sees the same <b>Objective Market</b>. Be first to complete one and you claim it, with its reward: "Do it" Objectives the moment you do them, "Have it" Objectives in the End Phase if you have them then (turn order breaks ties). Race your rivals for the ones they're chasing. When the last Hero falls, the surviving villain with the most Objectives becomes Overlord (ties: souls harvested, then Coins).</p>
  <h3>Each round</h3><ol>
    <li><b>Upkeep</b>: +1 Coin. Spells, powers and Items recharge. Barracks make Minions. Markets drop their oldest card.</li>
    <li><b>Town</b>: a Hero arrives. In turn order, each villain makes ONE pick: a Room, a Champion (pay its price), or a Terrain + Monster pair (placed at once on a wasteland square).</li>
    <li><b>Build</b> (simultaneous, secret): place 1 Room (on an empty space or on top of a stack) or 1 Champion. Extras: pay Champions to level up, move one Champion, move or swap one Monster, order Minions. Then Tricks one at a time in turn order.</li>
    <li><b>Lure</b>: every Hero in Town checks every dungeon. Own-class treasure + Gold/3 ≥ desire tempts automatically, otherwise roll that many dice (any 5–6 tempts). Town Minions add +1 tempt each. Lured after 1/2/3 tempts (Common/Paragon/Legendary).</li>
    <li><b>Adventure</b>: Heroes move closest to the Villain first: 1 random step right/down in the 4×4 Overworld, then 1 dungeon space a round, then the Villain fight (to the death, one exchange a round).</li>
    <li><b>End</b>: loot Coins for dead Heroes, buy a Treasure (needs total souls harvested ≥ its threshold), trade souls at Rooms that allow it, discard to 7. Status timers tick.</li></ol>
  <h3>Combat</h3><ul><li>Roll d6 equal to the tested stat; each 5 or 6 is a hit. Most hits wins.</li>
    <li>Ties: Common Heroes win only vs Monsters, Paragons also vs Champions, Legendaries always. A Room with a Champion fights at Champion rank.</li>
    <li>Threat wins: the Hero takes its damage. Hero beats a Villain: Villain takes 1/2/3 by tier + 1 per extra hit.</li>
    <li>Statuses: Cursed −1 die · Slowed 2 rounds per Room · Bleeding −1 Health a round.</li></ul>
  <h3>Stacking</h3><p>The top Room of a stack works in full; every covered Room underneath adds its small "covered" bonus.</p>
  <div class="row"><button data-a="closeModal">Close</button></div></div>`;
}

// ---------- input ----------
function openPicker(title, options, onPick, lead = "") { ui.modal = { kind: "picker", title, options, onPick, lead }; render(); }

function useSource(i) {
  const u = view.me.usable[i];
  const targets = [];
  const next = (k) => {
    if (k >= u.slots.length) { ui.modal = null; act({ type: "activate", src: u.src, targets }); return; }
    openPicker(u.name, u.slots[k], (v) => { targets[k] = v; next(k + 1); }, `${u.text}${u.slots.length > 1 ? ` (choice ${k + 1} of ${u.slots.length})` : ""}`);
  };
  next(0);
}

const handlers = {
  create: () => { saveName(); send({ t: "create", name: ui.name }); },
  quick: () => { saveName(); send({ t: "create", name: ui.name, bots: +document.getElementById("nbots").value, start: true }); },
  join: () => { saveName(); send({ t: "join", code: document.getElementById("code").value.trim().toUpperCase(), name: ui.name }); },
  leave: () => { sessionStorage.removeItem("wa-session"); location.href = "/"; },
  addBot: () => send({ t: "addBot" }),
  removeSeat: (d) => send({ t: "removeSeat", seat: +d.seat }),
  start: () => send({ t: "start" }),
  rematch: () => { ui.resultsDismissed = false; send({ t: "rematch" }); },
  results: () => { ui.resultsDismissed = false; render(); },
  dismissResults: () => { ui.resultsDismissed = true; render(); },
  rules: () => { ui.modal = { kind: "rules" }; render(); },
  closeModal: () => { ui.modal = null; render(); },
  hero: (d) => { ui.modal = { kind: "hero", uid: d.uid }; render(); },
  square: (d) => { ui.modal = { kind: "square", pid: +d.pid, r: +d.r, c: +d.c }; render(); },
  pick: (d) => { const m = ui.modal; ui.modal = null; m.onPick(m.options[+d.i].value); render(); },
  tab: (d) => { ui.tab = +d.pid; ui.center = "lands"; ui.inspect = null; render(); },
  markets: () => { ui.center = "markets"; ui.inspect = null; render(); },
  side: (d) => { ui.side = d.k; render(); },
  draftVillain: (d) => act({ type: "draftVillain", uid: d.uid }),
  chooseVillain: (d) => act({ type: "chooseVillain", uid: d.uid }),
  chooseTrick: (d) => act({ type: "chooseTrick", index: +d.i }),
  blind: () => act({ type: "draftRoom", blind: true }),
  townBlind: () => act({ type: "townPick", choice: "blind" }),
  pass: () => act({ type: "pass" }),
  done: () => { ui.sel = null; act({ type: "done" }); },
  cancelSel: () => { ui.sel = null; render(); },
  mkRoom: (d) => act(stepType() === "roomDraft" ? { type: "draftRoom", slot: +d.i } : { type: "townPick", choice: "room", slot: +d.i }),
  mkChamp: (d) => act({ type: "townPick", choice: "champion", slot: +d.i }),
  mkTerrain: (d) => { ui.sel = { kind: "terrain", i: +d.i }; ui.tab = view.you; ui.center = "lands"; render(); },
  mkTreasure: (d) => act({ type: "buyTreasure", slot: +d.i }),
  handRoom: (d) => { ui.sel = ui.sel?.uid === d.uid ? null : { kind: "handRoom", uid: d.uid, id: view.me.hand.rooms.find((r) => r.uid === d.uid).id }; ui.tab = view.you; ui.center = "lands"; render(); },
  reserveChamp: (d) => { ui.sel = { kind: "reserveChamp", uid: d.uid, id: me().championReserve.find((c) => c.uid === d.uid).id }; render(); },
  champ: (d) => { ui.sel = { kind: "spaceChamp", i: +d.i }; render(); },
  monster: (d) => { ui.sel = { kind: "monster", r: +d.r, c: +d.c }; render(); },
  cell: (d) => {
    const s = ui.sel; ui.sel = null;
    if (s?.kind === "terrain") act({ type: "townPick", choice: "terrain", slot: s.i, square: [+d.r, +d.c] });
    else if (s?.kind === "monster") act({ type: "moveMonster", from: [s.r, s.c], to: [+d.r, +d.c] });
    render();
  },
  space: (d, ev) => {
    if (ev.target.closest("[data-a='champ']")) return;
    const pid = +d.pid, i = +d.i, s = ui.sel;
    if (pid === view.you && s) {
      ui.sel = null;
      if (s.kind === "handRoom") return act({ type: "placeRoom", uid: s.uid, space: i });
      if (s.kind === "reserveChamp") return act({ type: "placeChampion", uid: s.uid, space: i });
      if (s.kind === "spaceChamp") return act({ type: "moveChampion", from: s.i, to: i });
    }
    ui.inspect = ui.inspect?.pid === pid && ui.inspect.i === i ? null : { pid, i };
    render();
  },
  closeInspect: () => { ui.inspect = null; render(); },
  advance: (d) => act({ type: "advanceChampion", space: +d.i }),
  destroy: (d) => { if (confirm("Destroy the top Room in this space? It's discarded with no refund.")) act({ type: "destroyOwnRoom", space: +d.i }); },
  discard: (d) => act({ type: "discard", kind: d.kind, uid: d.uid }),
  sustain: (d) => act({ type: "swapItem", uid: d.uid, replace: d.replace }),
  use: (d) => useSource(+d.i),
  exchange: (d) => {
    const room = C(me().dungeon[+d.space].stack.find((r) => r.uid === d.room));
    const x = room.soulExchanges[+d.k];
    const base = { type: "soulExchange", space: +d.space, room: d.room, index: +d.k };
    if (x.gives.op === "advanceChampion") {
      const opts = me().dungeon.map((sp, i) => ({ sp, i })).filter(({ sp }) => sp.champion && sp.champion.level < C(sp.champion.card).levels.length).map(({ sp, i }) => ({ label: `${C(sp.champion.card).name} (space ${i + 1}, Lv${sp.champion.level})`, value: i }));
      return openPicker("Advance which Champion?", opts, (v) => act({ ...base, target: v }));
    }
    act(base);
  },
};
function saveName() { ui.name = document.getElementById("nm")?.value.trim() || ui.name || "Nameless Villain"; localStorage.setItem("wa-name", ui.name); }

document.addEventListener("click", (ev) => {
  if (ev.target.id === "modal" && ["rules", "hero", "square"].includes(ui.modal?.kind)) { ui.modal = null; render(); return; }
  const el = ev.target.closest("[data-a]");
  if (!el) return;
  const h = handlers[el.dataset.a];
  if (h) { ev.preventDefault(); h(el.dataset, ev); }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.cfg) {
    const k = el.dataset.cfg;
    let v = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? null : +el.value) : el.value;
    send({ t: "setConfig", config: { [k]: v } });
  }
  if (el.dataset.c === "minionOrder") act({ type: "orderMinion", index: +el.dataset.i, to: /^\d$/.test(el.value) ? +el.value : el.value });
  if (el.dataset.c === "minionTarget" && el.value) act({ type: "minionTarget", slot: +el.dataset.k, hero: el.value });
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") { ui.sel = null; ui.modal = ["rules", "picker", "hero", "square"].includes(ui.modal?.kind) ? null : ui.modal; render(); }
  if (ev.key === "Enter" && !lobby && document.activeElement?.id === "code") handlers.join();
});

// ---------- card zoom ----------
const zoom = document.getElementById("zoom");
let zoomSrc = null, zoomTimer = null, zoomAt = 0, mouse = null;
function hideZoom() { clearTimeout(zoomTimer); zoomSrc = null; zoom.hidden = true; }
function showZoom(card, delay) {
  zoomSrc = card; zoomAt = performance.now() + delay;
  zoomTimer = setTimeout(() => {
    if (!card.isConnected) return;
    zoom.innerHTML = (card.querySelector(":scope > .zoomsrc")?.innerHTML ?? card.outerHTML).replace(/ data-a="[^"]*"/g, "");
    zoom.hidden = false;
    const r = card.getBoundingClientRect(), w = zoom.offsetWidth, h = zoom.offsetHeight;
    const x = r.right + 10 + w < innerWidth ? r.right + 10 : Math.max(6, r.left - w - 10);
    zoom.style.left = x + "px";
    zoom.style.top = Math.max(6, Math.min(r.top - 20, innerHeight - h - 6)) + "px";
  }, delay);
}
document.addEventListener("mousemove", (ev) => { mouse = { x: ev.clientX, y: ev.clientY, held: ev.buttons }; });
document.addEventListener("mouseover", (ev) => {
  const card = ev.target.closest?.("#app .card, #app [data-zoom]");
  if (card === zoomSrc) return;
  hideZoom();
  if (card && !ev.buttons) showZoom(card, 220);
});
document.addEventListener("mousedown", hideZoom);
/** A re-render replaces every card, so re-attach the zoom to whatever is under the mouse. */
function rezoom(pendingUntil) {
  if (!mouse || mouse.held) return;
  const card = document.elementFromPoint(mouse.x, mouse.y)?.closest("#app .card, #app [data-zoom]");
  if (card) showZoom(card, pendingUntil == null ? 220 : Math.max(0, pendingUntil - performance.now()));
}

connect();
