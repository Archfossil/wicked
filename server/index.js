// HTTP + WebSocket server. Serves the browser client from public/, hosts game
// rooms (join by code), runs the rules engine authoritatively, and sends each
// player only their own view. Bots fill empty seats.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";
import { loadSet } from "../src/engine/data.js";
import { createGame, applyAction, mustAct, RuleError } from "../src/engine/game.js";
import { viewFor } from "../src/engine/view.js";
import { botAction } from "../src/engine/bot.js";
import { DEFAULT_CONFIG } from "../src/engine/config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(root, "public");
const PORT = Number(process.env.PORT) || 3000;
const BOT_DELAY = Number(process.env.BOT_DELAY ?? 180);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

// Only these options can be changed from the lobby.
const CONFIG_KEYS = ["heroDeckLimit", "blindDrawInTown", "shiftTerrainMarket", "shiftChampionMarket", "shiftTreasureMarket", "treasureBuysPerEnd",
  "coveredSoulExchanges", "soulExchangeUsesPerEnd", "championOnEmptiedSpace", "warriorOverflowAffectsRooms", "slowedAffectsOverworld", "rewardSoulsHarvested"];

const cardsJson = JSON.stringify(loadSet("core").cards);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/healthz") { res.writeHead(200, { "content-type": "text/plain" }); res.end("ok"); return; }
  if (url.pathname === "/cards.json") { res.writeHead(200, { "content-type": MIME[".json"], "cache-control": "no-cache" }); res.end(cardsJson); return; }
  if (url.pathname === "/config.json") { res.writeHead(200, { "content-type": MIME[".json"] }); res.end(JSON.stringify({ defaults: DEFAULT_CONFIG, keys: CONFIG_KEYS })); return; }
  const rel = normalize(decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)).replace(/^([/\\])+/, "");
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found");
  }
});

// ---------- rooms ----------
const rooms = new Map();
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => "BCDFGHJKLMNPQRSTVWXZ"[Math.floor(Math.random() * 20)]).join(""); } while (rooms.has(c)); return c; };
const token = () => randomBytes(12).toString("hex");

function makeRoom() {
  const room = { code: newCode(), seats: [], state: null, config: { heroDeckLimit: null }, botTimer: null, touched: Date.now() };
  rooms.set(room.code, room);
  return room;
}
function lobbyInfo(room) {
  return {
    code: room.code, started: !!room.state, config: room.config,
    seats: room.seats.map((s, i) => ({ seat: i, name: s.name, isBot: s.isBot, connected: s.isBot || s.sockets.size > 0, host: i === 0 })),
  };
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function broadcast(room) {
  room.touched = Date.now();
  const lobby = lobbyInfo(room);
  room.seats.forEach((s, i) => {
    for (const ws of s.sockets) {
      send(ws, { t: "lobby", lobby, seat: i });
      if (room.state) send(ws, { t: "state", view: viewFor(room.state, i) });
    }
  });
}

function runBots(room) {
  if (room.botTimer || !room.state) return;
  const tick = () => {
    room.botTimer = null;
    const st = room.state;
    if (!st || st.phase === "gameOver") return;
    const pid = mustAct(st).find((i) => room.seats[i]?.isBot);
    const botPending = room.seats.findIndex((s, i) => s.isBot && st.players[i].pendingTricks.length);
    const who = botPending >= 0 ? botPending : pid;
    if (who == null) return;
    const a = botAction(st, who);
    try { applyAction(st, who, a); }
    catch (e) {
      if (!(e instanceof RuleError)) { console.error("bot crashed the engine", e); return; }
      try { applyAction(st, who, { type: st.step.type === "town" ? "pass" : "done" }); }
      catch (e2) { if (!(e2 instanceof RuleError)) { console.error(e2); return; } console.warn(`bot ${who} stuck: ${e2.message}`); return; }
    }
    broadcast(room);
    room.botTimer = setTimeout(tick, BOT_DELAY);
  };
  room.botTimer = setTimeout(tick, BOT_DELAY);
}

function startGame(room) {
  const seats = room.seats.map((s) => ({ name: s.name, isBot: s.isBot }));
  const config = {};
  for (const k of CONFIG_KEYS) if (room.config[k] !== undefined && room.config[k] !== "") config[k] = room.config[k];
  room.state = createGame(seats, { seed: Math.floor(Math.random() * 2 ** 31), config });
  broadcast(room);
  runBots(room);
}

const BOT_NAMES = ["Lord Vexmoor", "The Grim Widow", "Baron Sludge", "Mistress Hollowbone", "The Ash Tyrant", "Count Gloam", "Old Tallowfang", "Lady Rue"];
function addBot(room) {
  const used = new Set(room.seats.map((s) => s.name));
  const nm = BOT_NAMES.find((n) => !used.has(`🤖 ${n}`)) ?? `Bot ${room.seats.length + 1}`;
  room.seats.push({ name: `🤖 ${nm}`, isBot: true, token: null, sockets: new Set() });
}

// ---------- sockets ----------
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  let room = null, seat = -1;
  const attach = (r, i) => {
    if (room && seat >= 0) room.seats[seat]?.sockets.delete(ws);
    room = r; seat = i;
    r.seats[i].sockets.add(ws);
    send(ws, { t: "welcome", code: r.code, token: r.seats[i].token, seat: i });
    broadcast(r);
  };
  const err = (message) => send(ws, { t: "error", message });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const nm = String(msg.name ?? "").trim().slice(0, 24) || "Nameless Villain";
    try {
      switch (msg.t) {
        case "create": {
          const r = makeRoom();
          r.seats.push({ name: nm, isBot: false, token: token(), sockets: new Set() });
          for (let i = 0; i < Math.min(5, Number(msg.bots) || 0); i++) addBot(r);
          for (const k of CONFIG_KEYS) if (k in (msg.config ?? {})) r.config[k] = msg.config[k];
          attach(r, 0);
          if (msg.start) startGame(r);
          return;
        }
        case "join": {
          const r = rooms.get(String(msg.code ?? "").toUpperCase());
          if (!r) return err("No game with that code.");
          if (r.state) return err("That game has already started.");
          if (r.seats.length >= 6) return err("That game is full (6 villains).");
          r.seats.push({ name: nm, isBot: false, token: token(), sockets: new Set() });
          attach(r, r.seats.length - 1);
          return;
        }
        case "resume": {
          const r = rooms.get(String(msg.code ?? "").toUpperCase());
          const i = r ? r.seats.findIndex((s) => s.token && s.token === msg.token) : -1;
          if (i < 0) return send(ws, { t: "resumeFailed" });
          attach(r, i);
          return;
        }
      }
      if (!room) return err("Join a game first.");
      const host = seat === 0;
      switch (msg.t) {
        case "addBot":
          if (!host || room.state) return;
          if (room.seats.length >= 6) return err("Six villains is the most the game seats.");
          addBot(room); broadcast(room); return;
        case "removeSeat": {
          if (!host || room.state || msg.seat === 0) return;
          const s = room.seats[msg.seat];
          if (!s) return;
          for (const w of s.sockets) send(w, { t: "kicked" });
          room.seats.splice(msg.seat, 1);
          room.seats.forEach((x, i) => { for (const w of x.sockets) send(w, { t: "welcome", code: room.code, token: x.token, seat: i }); });
          broadcast(room); return;
        }
        case "setConfig":
          if (!host || room.state) return;
          for (const k of CONFIG_KEYS) if (k in (msg.config ?? {})) room.config[k] = msg.config[k];
          broadcast(room); return;
        case "start":
          if (!host || room.state) return;
          startGame(room); return;
        case "rematch":
          if (!host || !room.state || room.state.phase !== "gameOver") return;
          room.state = null; broadcast(room); return;
        case "action":
          if (!room.state) return err("The game hasn't started.");
          try { applyAction(room.state, seat, msg.action); }
          catch (e) { if (e instanceof RuleError) return err(e.message); throw e; }
          broadcast(room); runBots(room); return;
      }
    } catch (e) {
      console.error(e);
      err("Something went wrong on the server.");
    }
  });
  ws.on("close", () => { if (room && seat >= 0) { room.seats[seat]?.sockets.delete(ws); broadcast(room); } });
});

// Forget rooms nobody has touched for 12 hours.
setInterval(() => { const cut = Date.now() - 12 * 3600e3; for (const [c, r] of rooms) if (r.touched < cut) rooms.delete(c); }, 3600e3).unref();
// Keep sockets alive behind proxies (Render closes idle connections).
setInterval(() => { for (const ws of wss.clients) if (ws.readyState === 1) ws.ping(); }, 30e3).unref();

server.listen(PORT, () => console.log(`The Wicked Awaken is listening on http://localhost:${PORT}`));
