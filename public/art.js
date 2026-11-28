// Pixel art for the cards, drawn in code so there are no image files to manage.
// Every picture is painted once onto a small canvas and cached as a data URL;
// CSS scales it up with `image-rendering: pixelated`.
//
// - Sprites: 16x16 palette grids (one letter per pixel) plus overlays (crowns,
//   horns, wings...), outlined automatically. Each card picks a body, a
//   palette and overlays in SPEC below.
// - Scenes: 64x36 pictures for card banners (dungeon rooms, terrain, throne
//   rooms...), painted with a few primitives and a seeded random generator so
//   every card always looks the same.
//
// This is placeholder art for playtesting, like the card text.

export const ART_W = 64, ART_H = 36;
const OUTLINE = "#120a16";

// ---------- small utilities ----------
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = typeof seed === "number" ? seed : hash(seed);
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];
function rgbOf(h) { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const hexOf = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** f < 0 darkens towards black, f > 0 lightens towards white. */
function shade(h, f) { if (!h || h[0] !== "#") return h; return hexOf(rgbOf(h).map((v) => (f < 0 ? v * (1 + f) : v + (255 - v) * f))); }
function mix(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return hexOf(A.map((v, i) => v + (B[i] - v) * t)); }
const rgba = (h, a) => { const [r, g, b] = rgbOf(h); return `rgba(${r},${g},${b},${a})`; };

class Pic {
  constructor(w, h) {
    this.c = document.createElement("canvas"); this.c.width = w; this.c.height = h;
    this.x = this.c.getContext("2d"); this.x.imageSmoothingEnabled = false; this.w = w; this.h = h;
  }
  rect(x, y, w, h, c) { if (!c || w <= 0 || h <= 0) return; this.x.fillStyle = c; this.x.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  px(x, y, c) { this.rect(x, y, 1, 1, c); }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
  }
  disc(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  /** Stepped (banded) light, which reads as pixel art better than a smooth gradient. */
  glow(cx, cy, r, color, a = 0.13, ry = r) {
    this.x.globalCompositeOperation = "lighter";
    for (const k of [1, 0.68, 0.4]) this.ellipse(cx, cy, r * k, ry * k, rgba(color, a));
    this.x.globalCompositeOperation = "source-over";
  }
  shadow(cx, cy, rx, ry, a = 0.35) { this.ellipse(cx, cy, rx, ry, `rgba(0,0,0,${a})`); }
  poly(pts, c) { // filled polygon, scanline
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        const yc = y + 0.5;
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this.rect(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]), 1, c);
    }
  }
  grid(rows, pal, ox, oy, s = 1, fade = null) {
    rows.forEach((row, y) => {
      if (fade && y >= fade[0]) this.x.globalAlpha = Math.max(0.25, 1 - ((y - fade[0] + 1) / (rows.length - fade[0] + 1)) * (1 - fade[1]));
      for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c) this.rect(ox + x * s, oy + y * s, s, s, c); }
      this.x.globalAlpha = 1;
    });
  }
  img(src, x, y, s = 1) { this.x.drawImage(src.c ?? src, Math.round(x), Math.round(y), (src.w ?? src.width) * s, (src.h ?? src.height) * s); }
  /** Darken the edges in bands. */
  vignette(k = 1) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const dx = (x + 0.5 - this.w / 2) / (this.w / 2), dy = (y + 0.5 - this.h / 2) / (this.h / 2);
      const d = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.7);
      const a = d > 1.02 ? 0.5 : d > 0.9 ? 0.32 : d > 0.78 ? 0.16 : 0;
      if (a) this.px(x, y, `rgba(8,4,12,${a * k})`);
    }
  }
  url() { return this.c.toDataURL(); }
}

// ---------- sprites ----------
// One letter per pixel. Lower case is a colour, upper case its shade (filled in
// automatically when a palette doesn't give it). "." is transparent.
// s skin · e eyes · E glowing eyes · h hair/beard · a main cloth · b second
// cloth · m metal · n helm · g gold · k dark leather · w bone/white · r red/cape
// t wood · x magic glow · v wings · c hero cape
const BASES = {
  warrior: { top: 1, rows: [
    "................",
    "......nnnn...m..",
    ".....nnnnnn..m..",
    ".....NNNNNN..m..",
    ".....nssssn..m..",
    ".....nessen..m..",
    ".....nssssn..m..",
    "......SSSS..gGg.",
    ".bbbbaaaaaa..s..",
    ".bggbaAaaAaaa...",
    ".bggbaAaaAa.....",
    ".bbbbkkgkkk.....",
    "..bb.aaaaaa.....",
    ".....MM..MM.....",
    ".....MM..MM.....",
    "....kkk..kkk....",
  ] },
  mage: { top: 0, rows: [
    "......aA........",
    "......aaA....x..",
    ".....aaaA...xXx.",
    ".....aaaaA...x..",
    "...bbbbbbbbbbt..",
    ".....ssssss..t..",
    ".....sesses..t..",
    ".....hssssh..t..",
    "....aahhhhaa.t..",
    "...aaAahhAaass..",
    "...aaAaaaaAa.t..",
    "..aaaAagGaAa.t..",
    "..aaAaaaaaAaat..",
    ".aaAaaaaaaaAat..",
    ".AAAAAAAAAAAAt..",
    "...kk....kk..t..",
  ] },
  acolyte: { top: 1, rows: [
    "................",
    "......aaaa......",
    ".....aaaaaa.....",
    "....aaAAAAaa....",
    "....aAssssAa....",
    "....aAesseAa....",
    "....aAssssAa....",
    "....aaASSAaa....",
    "...aaaabbaaaa...",
    "..saaAabbAaaas..",
    "...aaAaggaAaa...",
    "...aaAabbaAaa...",
    "..aaAaabbaaAaa..",
    "..aaAaabbaaAaa..",
    "..AAAAAAAAAAAA..",
    "...kk......kk...",
  ] },
  rogue: { top: 1, rows: [
    "................",
    "......aaaa......",
    ".....aaaaaa.....",
    "....aaaaaaAa....",
    "....aAssssAa....",
    "....aAesseAa....",
    "....aAbbbbAa....",
    "....AabbbbaA....",
    "...aaaAbbAaaa...",
    "..aaAbbbbbbAaa..",
    "..sAbbbbbbbbAs..",
    ".m.kkkkgkkkkk.m.",
    "m...bbbbbbbb...m",
    "....bbb..bbb....",
    "....kkk..kkk....",
    "...kkkk..kkkk...",
  ] },
  skeletonLord: { top: 2, rows: [
    ".....g.gg.g.....",
    ".....gGggGg.....",
    ".....wwwwww.....",
    "....wwwwwwww....",
    "....wEEwwEEw....",
    "....wkkwwkkw....",
    "....wwwkkwww....",
    ".....wWwWwW.....",
    "...aaaawwaaaa...",
    "..aaAaagGaaAaa..",
    ".waaAaaaaaaAaaw.",
    "..aaAaaaaaaAaa..",
    "..aaAaaaaaaAaa..",
    ".aaaAaaaaaaAaaa.",
    ".AAAAAAAAAAAAAA.",
    "................",
  ] },
  hag: { top: 1, rows: [
    "................",
    "....aaaa........",
    "...aaaaaa.......",
    "..aaAAAAaa......",
    "..aAhsssha..tt..",
    "..aAEssEsss..t..",
    "..aAsssSsSs..t..",
    "..aahSkkSa...t..",
    ".aaahhhhaaa..t..",
    "aaAaaaaaaAaast..",
    ".aAaaaaaaaAa.t..",
    ".aAaaaaaaaAa.t..",
    "aaAaaaaaaaAaat..",
    "aAaaaaaaaaaAat..",
    "A.AAAA.AAA.AAt..",
    ".............t..",
  ] },
  fat: { top: 2, rows: [
    "................",
    "................",
    "......hhhh......",
    ".....hssssh.....",
    ".....sesses.....",
    ".....ssssss.....",
    ".....sSkkSs.....",
    "....ssSSSSss....",
    "...aaaaaaaaaa...",
    "..aaaAbbbbAaaa..",
    ".saaAbbbbbbAaas.",
    ".saAbbbbbbbbAas.",
    "..aAbbbbbbbbAa..",
    "..akkkkgkkkkka..",
    "...aaaa..aaaa...",
    "...kkkk..kkkk...",
  ] },
  sorceress: { top: 1, rows: [
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    "....hhsssshh....",
    "....hhessehh....",
    "....hhssssHh....",
    "....hhsrrshh....",
    "...hhb.ss.bhh...",
    "...hbbaaaabbh...",
    "...baaAaaAaab...",
    "..sbaAaaaaAabs..",
    ".xx.aAaaaaAa.xx.",
    "...aaAaaaaAaa...",
    "..aaAaaaaaaAaa..",
    ".aaAaaaaaaaaAaa.",
    ".AAAAAAAAAAAAAA.",
  ] },
  armored: { top: 1, rows: [
    "................",
    "......nnnn......",
    ".....nnnnnn.....",
    "....nnnnnnnn....",
    "....nNEkkENn....",
    "....nNkkkkNn....",
    "....nnNNNNnn....",
    ".....nnnnnn.....",
    ".mmmaaaaaaaammm.",
    "mmMMaAaaaaAaMMmm",
    "..sMaAaggaAaMs..",
    "...kkkkkkkkkk...",
    "...aAaaaaaaAa...",
    "....mm....mm....",
    "....mM....mM....",
    "...kkk....kkk...",
  ] },
  noble: { top: 2, rows: [
    "................",
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hesseh.....",
    ".....hssssh.....",
    ".....sSkkSs.....",
    "......SSSS......",
    "..r.aawwwwaa.r..",
    ".rraAaawwaaAarr.",
    ".rrsaAaggaAasrr.",
    ".rraaAaaaaAaarr.",
    ".rrkkkkggkkkkrr.",
    ".rr.aaa..aaa.rr.",
    ".rr.kkk..kkk.rr.",
    "..r.kkk..kkk.r..",
  ] },
  wolf: { top: 5, rows: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "...a.a..........",
    "...aaa..........",
    "..aEaaA.......aa",
    "kaaaaaAaaaaaa..a",
    ".wwaaaAaaaaaaAa.",
    "...aaAAaaaaaaAA.",
    "...AAAaaaaaaAA..",
    "...Aa.AAAAA.Aa..",
    "...a..a...a..a..",
    "...a..a...a..a..",
    "..kk.kk..kk.kk..",
  ] },
  owlbear: { top: 1, rows: [
    "................",
    "...aa......aa...",
    "...aaaaaaaaaa...",
    "..aabbbaabbbaa..",
    "..abbEbaabEbba..",
    "..abbbbggbbbba..",
    "..aabbbGGbbbaa..",
    ".aaaaaaGGaaaaaa.",
    "aaAaaaaaaaaaaAaa",
    "wa.AaaBBBBaaA.aw",
    "w..AaBBBBBBaA..w",
    "...AaBBBBBBaA...",
    "...AaaBBBBaaA...",
    "...AAaaaaaaAA...",
    "...aaa....aaa...",
    "..wwww....wwww..",
  ] },
  toad: { top: 6, rows: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "...aa......aa...",
    "..aEEa....aEEa..",
    "..aaaaaaaaaaaa..",
    ".aaaaaaaaaaaaaa.",
    ".akkkkkkkkkkkka.",
    "aaaaaaaaaaaaaaaa",
    "aAaaabbbbbbaaaAa",
    "aAaabbbbbbbbaaAa",
    ".AAabbbbbbbbaAA.",
    "AAA.AAAAAAAA.AAA",
  ] },
  troll: { top: 1, rows: [
    "................",
    "......aaaa......",
    ".....aaaaaa.....",
    ".....aEaaEa.....",
    ".....aaAAaa.....",
    ".....wkkkkw.....",
    "...aaaaaaaaaa...",
    "..aaAaaaaaaAaa..",
    ".aaAAabbbbaAAaa.",
    ".aa.AabbbbaA.aa.",
    ".aa.AkkkkkkA.aa.",
    ".aa.AbbbbbbA.aa.",
    "aaa..aa..aa..aaa",
    ".....aa..aa.....",
    ".....aa..aa.....",
    "....aaa..aaa....",
  ] },
  harpy: { top: 1, rows: [
    "................",
    "......hhhh......",
    ".....hhhhhh.....",
    ".....hesseh.....",
    ".....hssssh.....",
    "aa....ssss....aa",
    "aaaa..bbbb..aaaa",
    ".aaaaabbbbaaaaa.",
    "..AaaabbbbaaaA..",
    "...AAabbbbaAA...",
    "....A.bbbb.A....",
    "......bbbb......",
    "......aaaa......",
    "......k..k......",
    ".....kk..kk.....",
    "................",
  ] },
  skeleton: { top: 1, rows: [
    "................",
    "......wwww......",
    ".....wwwwww..m..",
    ".....wkwwkw..m..",
    ".....wkwwkw..m..",
    ".....wwWWww..m..",
    "......wWwW...m..",
    ".......ww....m..",
    "....wwwwwwwwkkk.",
    "...w.WwWWwW.ww..",
    "...w.wwwwww.....",
    "..ww..WwwW......",
    "......wWWw......",
    ".....w....w.....",
    ".....w....w.....",
    "....ww....ww....",
  ] },
  wraith: { top: 1, fade: [10, 0.25], rows: [
    "................",
    "......aaaa......",
    ".....aaaaaa.....",
    "....aakkkkaa....",
    "....akEkkEka....",
    "....akkkkkka....",
    "....aakkkkaa....",
    "...aaaakkaaaa...",
    "..aaAaaaaaaAaa..",
    ".waaAaaaaaaAaaw.",
    ".w.aAaaaaaaAa.w.",
    "...aAaaaaaaAa...",
    "...aaAaaaaAaa...",
    "....aAaaaaAa....",
    ".....a.aa.a.....",
    "......a..a......",
  ] },
  gargoyle: { top: 2, rows: [
    "................",
    "..a..........a..",
    ".aa..a....a..aa.",
    ".aaa.aaaaaa.aaa.",
    "aaaa.aEaaEa.aaaa",
    "aaAa.aaaaaa.aAaa",
    "aAAa.awkkwa.aAAa",
    "aA.aaaaaaaaaa.Aa",
    "A..aAaaaaaaAa..A",
    "...aAaaaaaaAa...",
    "..aaAAaaaaAAaa..",
    "..wa.AaaaaA.aw..",
    "...aa.aaaa.aa...",
    "..aaa......aaa..",
    ".mmmmmmmmmmmmmm.",
    ".MMMMMMMMMMMMMM.",
  ] },
  dragon: { top: 1, rows: [
    "................",
    "..a.a......b....",
    ".aaaa.....bbb...",
    "aaEaa....bbBbb..",
    "aaaaaa..bbBBbbb.",
    "wwkaaa..bBBBBbb.",
    "...aaa.bbBBBBb..",
    "....aaaaaaaaa...",
    "....aaggggaaaa..",
    "...aaaggggaaaaa.",
    "...aAaggggaAaaaa",
    "...aA.ggg.aA..aa",
    "...aA......aA..a",
    "...aA......aA...",
    "..kk......kk....",
    "................",
  ] },
  goblin: { top: 4, rows: [
    "................",
    "................",
    "................",
    "................",
    "......aaaa......",
    ".aa..aaaaaa..aa.",
    "..aaaaEaaEaaaa..",
    "....aaaAAaaa....",
    ".....awwwwa.....",
    "......aaaa......",
    "....bbbbbbbb....",
    "...abBbbbbBba...",
    "...a.bbkkbb.a...",
    ".....bb..bb.....",
    ".....aa..aa.....",
    "....kkk..kkk....",
  ] },
  imp: { top: 0, rows: [
    "..a..a..",
    "..aaaa..",
    ".aEaaEa.",
    "..awwa..",
    "b.aaaa.b",
    "bbaaaabb",
    "..a..a..",
    ".kk..kk.",
  ] },
};

// Overlays: drawn on top of the body (or behind it), centred, at a row worked
// out from the body's `top` (the first row of its head).
const OVER = {
  crown: { y: (t) => t - 1, rows: ["g.gg.g", "gGggGg"] },
  horns: { y: (t) => t - 1, rows: ["w........w", "ww......ww", ".ww....ww."] },
  mitre: { y: (t) => t - 1, rows: ["..ww..", ".wwww.", ".wggw.", "wwggww"] },
  tricorn: { y: (t) => t - 1, rows: ["...kkkk...", "..kkkkkk..", "kgkkkkkkgk"] },
  jester: { y: (t) => t - 1, rows: ["g........g", "rr......bb", ".rrrrbbbb.", "..rrrbbb.."] },
  witchHat: { y: (t) => t - 1, rows: [".....kkk..", "....kkkk..", "...krrrrk.", "kkkkkkkkkk"] },
  mask: { y: (t) => t + 3, rows: ["wwww", "kwwk", "wwww", "wWWw"] },
  blankMask: { y: (t) => t + 3, rows: ["wwww", "wwww", "wwww", "wWWw"] },
  beard: { y: (t) => t + 4, rows: ["hhhhhh", ".hhhh.", "..hh.."] },
  helm: { y: (t) => t - 1, rows: [".mmmm.", "mMmmMm"] },
  hood: { y: (t) => t, rows: [".kkkk.", "kkkkkk", "kEkkEk", "kkkkkk", "kwwwwk", "kkkkkk"] },
  candles: { y: (t) => t - 2, rows: ["x.xx.x", "w.ww.w", "gGggGg"] },
  halo: { behind: true, y: (t) => t - 1, rows: ["...gggg...", ".gg....gg.", "g........g", "g........g", "g........g", ".g......g."] },
  wings: { behind: true, y: (t) => t + 1, rows: ["vv............vv", "vvv..........vvv", "vxvv........vvxv", "vvvvv......vvvvv", ".vvvv......vvvv.", "..vvv......vvv..", ".vvxv......vxvv.", ".vvvv......vvvv.", "..vv........vv.."] },
  spiderLegs: { behind: true, y: (t) => t + 6, rows: ["kk............kk", "..k..........k..", ".kk..........kk.", "k..k........k..k", "..k..........k.."] },
  flames: { behind: true, y: (t) => t - 1, rows: ["..x...xx...x..", ".xx..xXXx..xx.", ".xXx.xXXx.xXx.", "..xx..xx..xx.."] },
  cape: { behind: true, y: () => 8, rows: [".cccccccccc.", "cccccccccccc", "cccccccccccc", "cccccccccccc", "cccccccccccc", "cCcCcCcCcCcC"] },
};

const DEF_PAL = { e: "#1a1020", E: "#ff5a3a", k: "#3a2a2a", m: "#c9cfd6", n: "#9aa3ad", g: "#e6b84a", w: "#e8e2d0", r: "#b3283a", t: "#7a5230", x: "#9fe8ff", v: "#8a6fb0", s: "#f0c39a", h: "#5a3a22", a: "#6a6a6a", b: "#8a8a8a", c: "#7a2030" };
function fullPal(p = {}) {
  const pal = { ...DEF_PAL, ...p };
  for (const k of Object.keys(pal)) {
    const U = k.toUpperCase();
    if (k !== U && k !== "e" && !(U in p)) pal[U] = shade(pal[k], -0.3);
  }
  if (!("E" in p) && p.e) pal.E = p.e;
  pal["."] = null;
  return pal;
}

/** Outline every transparent pixel that touches a solid one. */
function outline(pic) {
  const { w, h } = pic, img = pic.x.getImageData(0, 0, w, h), d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 110;
  const [r, g, b] = rgbOf(OUTLINE), out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 0) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; }
  }
  pic.x.putImageData(new ImageData(out, w, h), 0, 0);
}

function drawWisp(pic, pal) {
  const x = pal.x, cx = pic.w / 2, cy = 7;
  pic.glow(cx, cy, 8, x, 0.16);
  for (let i = 0; i < 5; i++) pic.px(cx - 2 + i, cy + 4 + (i % 2) * 2, rgba(x, 0.7));
  pic.px(cx - 1, cy + 8, rgba(x, 0.5)); pic.px(cx + 2, cy + 9, rgba(x, 0.4));
  pic.disc(cx, cy, 3.2, shade(x, -0.15)); pic.disc(cx, cy, 2.2, x); pic.disc(cx - 0.5, cy - 0.5, 1.2, "#ffffff");
  pic.px(cx - 2, cy, pal.e); pic.px(cx + 1, cy, pal.e);
}

const spriteCache = new Map();
/** spec: { base, pal, over: [...] } → an 18x18 Pic (16x16 + 1px outline). */
function buildSprite(spec) {
  const key = JSON.stringify(spec);
  if (spriteCache.has(key)) return spriteCache.get(key);
  const base = BASES[spec.base];
  const size = (base?.rows[0].length ?? 16) + 2;
  const pic = new Pic(size, size);
  const pal = fullPal(spec.pal);
  if (spec.base === "wisp") drawWisp(pic, pal);
  else {
    const overs = (spec.over ?? []).map((o) => OVER[o]).filter(Boolean);
    const put = (o) => pic.grid(o.rows, pal, 1 + 8 - Math.floor(o.rows[0].length / 2), 1 + o.y(base.top));
    overs.filter((o) => o.behind).forEach(put);
    pic.grid(base.rows, pal, 1, 1, 1, base.fade);
    overs.filter((o) => !o.behind).forEach(put);
    outline(pic);
  }
  spriteCache.set(key, pic);
  return pic;
}

// ---------- which sprite each card uses ----------
const SKIN = ["#f2c9a0", "#e3ad80", "#c68a5a", "#9a6440", "#6e4428"];
const HAIR = ["#2b1d14", "#5a3a22", "#8a5a2a", "#c9a048", "#a8402a", "#d8d4c8", "#1c1c24"];
const CLASS_COLOR = { Warrior: "#b8383a", Mage: "#3a5ab8", Acolyte: "#e8e0c8", Rogue: "#3a6a4a" };

function heroSpec(d) {
  const r = rng(d.id);
  const s = pickOf(r, SKIN), h = pickOf(r, HAIR);
  const legend = d.tier === "Legendary", paragon = d.tier === "Paragon";
  const over = paragon || legend ? ["cape"] : [];
  const c = legend ? "#c9a048" : paragon ? "#6a2a7a" : undefined;
  switch (d.class) {
    case "Warrior": return { base: "warrior", over, pal: { s, h, c, a: legend ? "#d8b040" : pickOf(r, ["#b8383a", "#a83a2a", "#9a3040"]), b: pickOf(r, ["#3a5aa0", "#7a5a3a", "#5a6a7a"]), n: r() < 0.4 ? h : legend ? "#e6c860" : "#9aa3ad", m: "#dfe6ee" } };
    case "Mage": {
      const a = legend ? "#e8e0f0" : pickOf(r, ["#3a5ab8", "#2f4a9a", "#4a3ab0", "#2a6a9a"]);
      const old = r() < 0.5;
      return { base: "mage", over: legend ? [] : over, pal: { s, a, b: legend ? "#9b6cf0" : "#c9a048", h: old ? pickOf(r, ["#d8d4c8", "#bfbfbf"]) : shade(a, -0.3), x: legend ? "#d0a0ff" : "#9fe8ff", t: "#7a5230" } };
    }
    case "Acolyte": return { base: "acolyte", over: legend ? ["halo"] : over, pal: { s, a: legend ? "#fff4d8" : paragon ? "#d8d0b0" : pickOf(r, ["#e8e0c8", "#c8b890", "#8a6a4a"]), b: paragon || legend ? "#c9a048" : "#7a5a8a", g: "#f0d060" } };
    case "Rogue": return { base: "rogue", over, pal: { s, a: legend ? "#8a8a90" : pickOf(r, ["#3a6a4a", "#2a4a3a", "#4a4a5a", "#5a3a2a"]), b: pickOf(r, ["#4a3a2a", "#3a2a24", "#2a2a30"]), k: "#2a1e1a", m: "#dfe6ee" } };
  }
  return { base: "warrior", pal: { s, h } };
}

const SPEC = {
  // monsters
  "monster-dire-wolf": { base: "wolf", pal: { a: "#6a6470", w: "#e8e2d0", E: "#ffd040", k: "#1a1418" } },
  "monster-dryad": { base: "sorceress", pal: { h: "#4f9a4a", s: "#b8d090", e: "#2a3a10", a: "#6a4a2a", b: "#3f7a3a", r: "#7a4a2a", x: "#c8ff80" } },
  "monster-owlbear": { base: "owlbear", pal: { a: "#7a5a3a", b: "#d0b890", g: "#e0a030", E: "#ffcc33", w: "#efe8d8" } },
  "monster-bog-hag": { base: "hag", pal: { a: "#3a4a2a", s: "#8aa070", h: "#c8c8b8", E: "#d0ff60", t: "#4a3a2a", k: "#1a1010" } },
  "monster-giant-toad": { base: "toad", pal: { a: "#5a7a2a", b: "#d0c878", E: "#ffcc00", k: "#2a1a10" } },
  "monster-will-o-wisp": { base: "wisp", pal: { x: "#a8ffe8", e: "#1a4a40" } },
  "monster-stone-troll": { base: "troll", pal: { a: "#7a7a84", b: "#5a4a3a", E: "#ff8040", w: "#e8e2d0", k: "#2a2018" } },
  "monster-harpy": { base: "harpy", pal: { h: "#5a3a5a", s: "#d8b090", a: "#6a5a7a", b: "#9a7a8a", k: "#e6b84a" } },
  "monster-frost-giant": { base: "troll", over: ["beard"], pal: { a: "#8ab0d0", b: "#4a5a7a", E: "#d0f0ff", w: "#ffffff", h: "#f0f8ff", k: "#2a3a5a" } },
  "monster-skeleton": { base: "skeleton", pal: { w: "#e8e2d0", W: "#a8a290", k: "#1a1018", m: "#9aa3ad" } },
  "monster-wraith": { base: "wraith", pal: { a: "#5a6a8a", k: "#0a0a14", E: "#8fe8ff", w: "#c8d0e0" } },
  "monster-gargoyle": { base: "gargoyle", pal: { a: "#6a6a78", m: "#5a5048", E: "#ff4060", w: "#e8e2d0" } },
  "monster-goblin-raiders": { base: "goblin", pal: { a: "#5a8a30", b: "#4a3a5a", E: "#ff4030", w: "#efe8d8" } },
  "monster-antlered-hunter": { base: "rogue", over: ["horns"], pal: { a: "#3a4a2a", b: "#5a3a1a", s: "#c8a070", k: "#1a1410", m: "#c8b890", e: "#d0ff60" } },
  "monster-thorn-troll": { base: "troll", pal: { a: "#4a6a2a", b: "#3a2a1a", E: "#ff5050", w: "#c84a4a", k: "#1a2410" } },
  "monster-lizardfolk-ambusher": { base: "goblin", pal: { a: "#3a7a6a", b: "#5a4a2a", E: "#ffe040", w: "#d8e8c0", k: "#102a24" } },
  "monster-drowned-dead": { base: "skeleton", pal: { w: "#a8c0a8", W: "#6a8a70", k: "#0a1a14", m: "#3a6a5a" } },
  "monster-marsh-hydra": { base: "dragon", pal: { a: "#3a6a3a", b: "#7aa050", g: "#b8c870", E: "#ffe040", w: "#e8f0d0", k: "#102010" } },
  "monster-kobold-miners": { base: "imp", pal: { a: "#8a5a3a", b: "#5a3a2a", E: "#ffd040", w: "#efe8d8", g: "#e6b84a", k: "#2a1a10" } },
  "monster-storm-wyvern": { base: "dragon", pal: { a: "#3a4a7a", b: "#7a9ad0", g: "#d0e0ff", E: "#a0f0ff", w: "#ffffff", k: "#101830" } },
  "monster-ice-wraith": { base: "wraith", pal: { a: "#8ab0d0", k: "#0a1424", E: "#e0ffff", w: "#f0f8ff" } },
  "monster-ghoul": { base: "goblin", pal: { a: "#8a9a8a", b: "#3a3030", E: "#ff3040", w: "#e8e2d0", k: "#1a1a1a" } },
  "monster-animated-armour": { base: "armored", pal: { n: "#6a6a78", m: "#8a8a98", a: "#3a3448", E: "#80c0ff", g: "#5a5a6a", k: "#1a1820", s: "#101018" } },
  "monster-wild-boar": { base: "wolf", pal: { a: "#6a4a2a", w: "#e8e2d0", E: "#ff4030", k: "#2a1a10" } },
  "monster-bog-serpent": { base: "dragon", pal: { a: "#2a4a3a", b: "#5a7a4a", g: "#8aa060", E: "#ffe040", w: "#d8e8c0", k: "#0a1a10" } },
  "monster-rock-golem": { base: "troll", pal: { a: "#7a7468", b: "#5a5448", E: "#80e0ff", w: "#c8c0b0", k: "#2a2620" } },
  "monster-banshee": { base: "wraith", pal: { a: "#c8d0e0", k: "#2a3040", E: "#ff8090", w: "#ffffff" } },
  "monster-cult-fanatic": { base: "acolyte", over: ["hood"], pal: { a: "#5a1a2a", b: "#2a1018", g: "#c84a4a", s: "#d8b098", e: "#ff4040", k: "#1a0a10" } },
  // champions
  "champion-orc-captain": { base: "troll", over: ["helm"], pal: { a: "#5a8a3a", b: "#5a3a2a", E: "#ff3020", k: "#2a1a10", m: "#9aa3ad" } },
  "champion-goblin-trapmaster": { base: "goblin", pal: { a: "#7aa040", b: "#6a4a2a", E: "#ffd040", w: "#efe8d8" } },
  "champion-dark-knight": { base: "armored", over: ["horns"], pal: { n: "#3a3a48", m: "#4a4a5a", a: "#2a2030", E: "#ff3050", g: "#8a2a3a", k: "#1a1418", w: "#8a8a98" } },
  "champion-cultist-leader": { base: "acolyte", over: ["mask"], pal: { a: "#7a1a2a", b: "#1a1018", g: "#e6b84a", w: "#d8d0c0", k: "#2a0a10" } },
  "champion-overseer": { base: "fat", over: ["hood"], pal: { s: "#c89070", a: "#4a3a2a", b: "#7a5a3a", k: "#2a1a14", E: "#ffcc40", w: "#e8e2d0" } },
  "champion-vampire-count": { base: "noble", pal: { s: "#e8e0e8", h: "#1a1420", a: "#2a1a2a", r: "#9a1a2a", w: "#f0f0f0", e: "#ff2a2a", k: "#140c14" } },
  "champion-necromancer": { base: "acolyte", pal: { a: "#1e2a1e", b: "#5a8a4a", s: "#b8c0b0", e: "#80ff60", g: "#80ff60" } },
  "champion-young-dragon": { base: "dragon", pal: { a: "#b83a2a", b: "#e07a3a", g: "#e8c060", E: "#ffe060", w: "#ffffff", k: "#3a1a14" } },
  // villains
  "villain-the-bone-duke": { base: "skeletonLord", pal: { a: "#4a2a6a", g: "#e6b84a", E: "#ff4a6a" } },
  "villain-mother-rot": { base: "hag", pal: { a: "#4a5a2a", s: "#9aaa70", h: "#6a7a4a", E: "#e0ff40", t: "#3a2a1a" } },
  "villain-the-gilded-tyrant": { base: "fat", over: ["crown"], pal: { s: "#e8b890", h: "#c9a048", a: "#c9a048", b: "#7a1a2a", k: "#5a3a10", g: "#fff0a0" } },
  "villain-hex-queen-morwen": { base: "sorceress", over: ["crown"], pal: { h: "#1a1020", s: "#e0c8d8", a: "#5a2a7a", b: "#1a1020", r: "#8a1a4a", x: "#d070ff", g: "#c0c0d0" } },
  "villain-grumbold-the-glutton": { base: "fat", pal: { s: "#b8906a", h: "#4a3020", a: "#6a4a2a", b: "#c8b8a0", k: "#3a2010" } },
  "villain-the-whispering-mask": { base: "acolyte", over: ["mask"], pal: { a: "#2a2a3a", b: "#6a6a8a", g: "#9a9ab0", w: "#f0ece0", k: "#0a0a10" } },
  "villain-ashen-warlord": { base: "armored", over: ["horns"], pal: { n: "#6a6464", m: "#8a8480", a: "#3a3030", E: "#ff7a2a", g: "#c86a2a", w: "#d8d0c0" } },
  "villain-the-hollow-king": { base: "skeletonLord", pal: { a: "#1a2030", g: "#9aa3ad", E: "#6ad0ff", w: "#d8d8e0" } },
  "villain-silk-mistress-vey": { base: "sorceress", over: ["spiderLegs"], pal: { h: "#e8e8f0", s: "#d8c8d0", a: "#3a3040", b: "#e8e8f0", r: "#5a1a3a", x: "#e8e8f0", k: "#1a1018" } },
  "villain-pyre-prophet": { base: "acolyte", over: ["flames"], pal: { a: "#c85a1a", b: "#3a1a10", s: "#e0a070", g: "#ffe080", x: "#ff9a30" } },
  "villain-the-drowned-captain": { base: "noble", over: ["tricorn"], pal: { s: "#8ab8a8", h: "#2a3a3a", a: "#2a3a6a", r: "#1a4a4a", w: "#c8d8d0", g: "#c9a048", k: "#1a2020" } },
  "villain-countess-nocturne": { base: "sorceress", over: ["crown"], pal: { h: "#1a1018", s: "#f0e8f0", a: "#1a1018", b: "#8a1a2a", r: "#c0203a", x: "#ff4060", g: "#c0c0d0" } },
  "villain-the-carrion-bishop": { base: "acolyte", over: ["mitre"], pal: { a: "#5a1a1a", b: "#e6b84a", s: "#c8b8a8", e: "#ffcc40", w: "#e8e0d0" } },
  "villain-lady-gallowmere": { base: "sorceress", pal: { h: "#8a8a8a", s: "#d8d0d0", a: "#3a3a40", b: "#6a5a4a", r: "#5a2a2a", x: "#c8c0a0" } },
  "villain-the-iron-abbot": { base: "armored", over: ["mitre"], pal: { n: "#7a7a80", m: "#9aa0a8", a: "#5a4a3a", E: "#ffcc40", g: "#c9a048", w: "#d8d0c0" } },
  "villain-old-man-marrow": { base: "skeletonLord", pal: { a: "#5a4a3a", g: "#5a4a3a", G: "#3a2a1a", E: "#c8ff80" } },
  "villain-the-smiling-jailer": { base: "fat", over: ["hood"], pal: { s: "#d8a080", a: "#3a3030", b: "#6a5a4a", k: "#1a1414", E: "#ffe060", w: "#ffffff" } },
  "villain-queen-of-moths": { base: "sorceress", over: ["wings", "crown"], pal: { h: "#c8b8a0", s: "#e8e0d0", a: "#8a7a6a", b: "#c8b8a0", v: "#b8a888", x: "#ffe8a0", g: "#e8d8a0" } },
  "villain-brother-blight": { base: "acolyte", pal: { a: "#4a5a2a", b: "#8a9a3a", s: "#a8b080", e: "#d0ff40", g: "#c8d040" } },
  "villain-the-tallow-king": { base: "fat", over: ["candles"], pal: { s: "#f0e0c0", h: "#e8d8b0", a: "#d8c8a0", b: "#8a6a3a", x: "#ffb040", w: "#fff4d0", k: "#5a4020" } },
  "villain-widow-thresh": { base: "hag", pal: { a: "#1a1418", s: "#c8b8b0", h: "#e0e0e0", E: "#ff3a5a", t: "#2a1a14" } },
  "villain-the-pale-cartographer": { base: "noble", pal: { s: "#e8e8f0", h: "#c8c8d8", a: "#3a4a6a", r: "#6a7a9a", w: "#f0f0f0", g: "#c9a048" } },
  "villain-gorlax-the-unwashed": { base: "troll", pal: { a: "#7a6a3a", b: "#4a3a2a", E: "#ffcc40", w: "#e8e2d0", k: "#2a2010" } },
  "villain-the-velvet-usurer": { base: "fat", over: ["crown"], pal: { s: "#e0b090", h: "#2a1a20", a: "#5a1a5a", b: "#c9a048", k: "#2a1020", g: "#e6b84a" } },
  "villain-saint-nobody": { base: "acolyte", over: ["halo", "blankMask"], pal: { a: "#d8d8d0", b: "#9a9a90", g: "#f0e8c0", w: "#ffffff", W: "#c8c8c0" } },
  "villain-the-clockwork-margrave": { base: "armored", pal: { n: "#b87a3a", m: "#d8a050", a: "#6a4a2a", E: "#6affd0", g: "#6affd0", k: "#3a2a1a" } },
  "villain-mistress-ninefingers": { base: "rogue", pal: { a: "#6a1a2a", b: "#2a1a1a", s: "#e0b8a0", k: "#1a1010", m: "#e8e8f0" } },
  "villain-the-ember-witch": { base: "sorceress", over: ["witchHat"], pal: { h: "#c84a1a", s: "#f0c8a0", a: "#3a1a1a", b: "#c84a1a", r: "#ff8a2a", x: "#ffa040", k: "#1a1010" } },
  "villain-baron-wormwood": { base: "noble", pal: { s: "#c8c0a0", h: "#3a4a2a", a: "#3a5a2a", r: "#5a6a2a", w: "#d8d0b0", g: "#c9a048" } },
  "villain-the-last-jester": { base: "acolyte", over: ["jester", "mask"], pal: { a: "#6a2a6a", b: "#2a6a6a", r: "#b8283a", w: "#f0ece0", g: "#e6b84a", k: "#1a1018" } },
};

function specFor(d) {
  if (SPEC[d.id]) return SPEC[d.id];
  const r = rng(d.id);
  switch (d.deck) {
    case "heroes": return heroSpec(d);
    case "monsters": return { base: pickOf(r, ["wolf", "troll", "skeleton", "gargoyle", "toad"]), pal: { a: pickOf(r, ["#6a6a78", "#5a7a3a", "#7a5a3a"]) } };
    case "champions": return { base: pickOf(r, ["armored", "troll", "goblin"]), pal: { a: pickOf(r, ["#5a3a2a", "#3a3a48"]) } };
    case "villains": return { base: pickOf(r, ["sorceress", "fat", "noble", "skeletonLord", "acolyte"]), over: r() < 0.4 ? ["crown"] : [], pal: { a: pickOf(r, ["#5a2a7a", "#7a1a2a", "#2a3a5a"]), h: pickOf(r, HAIR) } };
  }
  return null;
}

// ---------- scenes ----------
function bricks(p, r, x0, y0, w, h, base, mortar, bw = 8, bh = 4) {
  p.rect(x0, y0, w, h, mortar);
  for (let y = y0, row = 0; y < y0 + h; y += bh, row++) {
    for (let x = x0 - (row % 2 ? bw / 2 : 0); x < x0 + w; x += bw) {
      const v = (r() - 0.5) * 0.22, c = shade(base, v);
      const xa = Math.max(x0, x + 1), xb = Math.min(x0 + w, x + bw);
      p.rect(xa, y + 1, xb - xa, Math.min(bh - 1, y0 + h - y - 1), c);
      p.rect(xa, y + 1, xb - xa, 1, shade(c, 0.12));
      if (r() < 0.12) p.px(xa + Math.floor(r() * (xb - xa)), y + 2, shade(c, -0.25));
    }
  }
}
function flagstones(p, r, y0, base, line) {
  p.rect(0, y0, ART_W, ART_H - y0, base);
  const bands = [[y0, 3, 7], [y0 + 3, 4, 9], [y0 + 7, 5, 11], [y0 + 12, 6, 14]];
  bands.forEach(([y, h, tw], i) => {
    if (y >= ART_H) return;
    p.rect(0, y, ART_W, 1, line);
    for (let x = -((i * 5) % tw); x < ART_W; x += tw) {
      p.rect(x, y, 1, h, line);
      const v = (r() - 0.5) * 0.16;
      p.rect(x + 1, y + 1, tw - 1, Math.min(h - 1, ART_H - y - 1), shade(base, v));
    }
  });
  p.rect(0, y0, ART_W, 1, "rgba(0,0,0,0.45)");
  p.rect(0, y0 + 1, ART_W, 1, "rgba(0,0,0,0.2)");
}
function torch(p, x, y, flame = "#ffb040") {
  p.glow(x, y - 1, 13, flame, 0.1);
  p.rect(x - 1, y + 1, 3, 1, "#4a3a30"); p.rect(x, y + 2, 1, 3, "#3a2a22");
  p.rect(x - 1, y - 1, 3, 2, flame); p.px(x, y - 2, flame); p.px(x, y - 3, shade(flame, 0.5)); p.px(x, y - 1, "#fff6c0");
}
function dungeon(p, r, { wall = "#4a4152", mortar = "#211a26", floor = "#3a3140", line = "#211a26", torches = true, flame } = {}) {
  bricks(p, r, 0, 0, ART_W, 22, wall, mortar);
  p.rect(0, 0, ART_W, 2, "rgba(0,0,0,0.35)");
  flagstones(p, r, 22, floor, line);
  if (torches) { torch(p, 6, 9, flame); torch(p, ART_W - 7, 9, flame); }
}
function coinPile(p, r, cx, by, w, h) {
  p.poly([[cx - w / 2, by], [cx - w / 4, by - h * 0.7], [cx, by - h], [cx + w / 4, by - h * 0.75], [cx + w / 2, by]], "#9a6a14");
  for (let i = 0; i < w * h * 0.35; i++) {
    const t = r(), y = by - 1 - Math.floor(t * h * 0.95), half = (w / 2) * (1 - t) ** 0.8;
    const x = cx + (r() * 2 - 1) * half;
    p.rect(x - 1, y, 3, 1, r() < 0.5 ? "#e6b84a" : "#d09a2a"); p.px(x, y - 1, "#ffe48a");
  }
  for (let i = 0; i < 3; i++) p.px(cx + (r() * 2 - 1) * w * 0.3, by - r() * h * 0.8, "#ffffff");
}
function gem(p, cx, cy, s, color) {
  for (let dy = -s; dy <= s; dy++) {
    const hw = s - Math.abs(dy);
    for (let dx = -hw; dx <= hw; dx++) p.px(cx + dx, cy + dy, dx + dy < 0 ? shade(color, 0.3) : dx + dy > 0 ? shade(color, -0.35) : color);
  }
  p.px(cx - Math.floor(s / 2), cy - Math.floor(s / 2), "#ffffff");
}
function candle(p, x, y, h = 4) { p.rect(x, y, 1, h, "#efe4c8"); p.px(x, y - 1, "#ffb040"); p.px(x, y - 2, "#fff0a0"); p.glow(x, y - 1, 4, "#ffb040", 0.12); }
function skull(p, x, y, c = "#e8e2d0") { p.rect(x, y, 4, 3, c); p.rect(x + 1, y + 3, 2, 1, c); p.px(x + 1, y + 1, "#1a1018"); p.px(x + 2, y + 1, "#1a1018"); }
function bone(p, x, y, c = "#e8e2d0") { p.rect(x + 1, y, 4, 1, c); p.px(x, y - 1, c); p.px(x, y + 1, c); p.px(x + 5, y - 1, c); p.px(x + 5, y + 1, c); }
function barrel(p, x, y, h = 9) { p.rect(x, y, 7, h, "#6a4424"); p.rect(x + 1, y, 1, h, "#8a5a30"); p.rect(x, y + 1, 7, 1, "#3a3036"); p.rect(x, y + h - 2, 7, 1, "#3a3036"); p.rect(x + 5, y, 1, h, "#4a2c18"); }

const ROOMS = {
  "room-bone-pit": (p, r) => { dungeon(p, r); p.ellipse(32, 29, 18, 5, "#120a10"); for (let i = 0; i < 9; i++) bone(p, 18 + Math.floor(r() * 26), 26 + Math.floor(r() * 5)); skull(p, 30, 25); },
  "room-crypt": (p, r) => { dungeon(p, r, { wall: "#3a3a44" }); p.rect(20, 18, 24, 10, "#6a6474"); p.rect(20, 18, 24, 2, "#8a8494"); p.rect(30, 12, 4, 6, "#8a8494"); p.rect(28, 14, 8, 2, "#8a8494"); candle(p, 16, 22); candle(p, 47, 22); p.glow(32, 22, 16, "#a080ff", 0.08); },
  "room-kennels": (p, r) => { dungeon(p, r); for (const x of [8, 26, 44]) { p.rect(x, 14, 14, 14, "#1a1218"); for (let k = 0; k < 14; k += 3) p.rect(x + k, 14, 1, 14, "#8a8f99"); p.px(x + 5, 22, "#ffd040"); p.px(x + 8, 22, "#ffd040"); } },
  "room-hall-of-banners": (p, r) => { dungeon(p, r); for (const x of [10, 24, 38, 52]) { p.rect(x, 3, 1, 18, "#7a5230"); p.rect(x + 1, 4, 7, 10, "#8a1a2a"); p.rect(x + 1, 14, 3, 2, "#8a1a2a"); p.rect(x + 5, 14, 3, 2, "#8a1a2a"); } coinPile(p, r, 32, 34, 14, 4); gem(p, 32, 27, 2, "#d9434f"); },
  "room-star-chamber": (p, r) => { p.rect(0, 0, ART_W, ART_H, "#0e0c20"); for (let i = 0; i < 30; i++) p.px(Math.floor(r() * ART_W), Math.floor(r() * 26), pickOf(r, ["#ffffff", "#a0c0ff", "#ffe0a0"])); p.ellipse(32, 30, 22, 4, "#2a2440"); coinPile(p, r, 32, 34, 14, 4); gem(p, 32, 27, 2, "#4b7def"); p.glow(32, 14, 14, "#6c95f0", 0.1); },
  "room-saints-tomb": (p, r) => { dungeon(p, r, { wall: "#4a4448" }); p.rect(22, 16, 20, 12, "#a8a090"); p.rect(22, 16, 20, 2, "#c8c0b0"); p.rect(31, 6, 2, 9, "#e6b84a"); p.rect(28, 8, 8, 2, "#e6b84a"); coinPile(p, r, 32, 34, 12, 4); gem(p, 32, 27, 2, "#f0d860"); p.glow(32, 12, 12, "#ffe0a0", 0.12); },
  "room-thieves-cache": (p, r) => { dungeon(p, r, { torches: false }); barrel(p, 10, 20); barrel(p, 46, 20); p.rect(24, 22, 16, 10, "#5a3a20"); p.rect(24, 22, 16, 2, "#7a5230"); p.rect(31, 25, 2, 3, "#e6b84a"); coinPile(p, r, 32, 22, 10, 3); gem(p, 32, 18, 2, "#3ab37d"); },
  "room-poison-dart-hall": (p, r) => { dungeon(p, r); for (let y = 8; y < 24; y += 5) { p.rect(2, y, 3, 2, "#2a2026"); p.rect(59, y + 2, 3, 2, "#2a2026"); p.line(8, y + 1, 18, y + 1, "#9aff60"); } p.glow(20, 16, 8, "#9aff60", 0.08); },
  "room-collapsing-ceiling": (p, r) => { dungeon(p, r); for (let i = 0; i < 8; i++) { const x = 10 + Math.floor(r() * 44), y = 2 + Math.floor(r() * 18); p.rect(x, y, 4, 3, "#6a6070"); p.px(x, y, "#8a8090"); } for (let i = 0; i < 6; i++) p.line(20 + i * 5, 0, 18 + i * 5, 6, "#1a1018"); },
  "room-swinging-blades": (p, r) => { dungeon(p, r); for (const x of [16, 32, 48]) { p.line(x, 0, x + 6, 16, "#8a8f99"); p.poly([[x + 2, 16], [x + 12, 14], [x + 8, 20]], "#dfe6ee"); } },
  "room-slime-pit": (p, r) => { dungeon(p, r); p.ellipse(32, 30, 20, 5, "#3a8a2a"); p.ellipse(32, 29, 14, 3, "#6aca4a"); for (let i = 0; i < 5; i++) p.disc(18 + i * 7, 28 + (i % 2), 1.4, "#a0ff80"); p.glow(32, 28, 16, "#80ff60", 0.08); },
  "room-necropolis": (p, r) => { dungeon(p, r, { wall: "#2e2a36", flame: "#80ff80" }); for (const x of [8, 22, 36, 50]) { p.rect(x, 18, 8, 10, "#5a5468"); p.rect(x + 2, 22, 4, 6, "#0a080e"); skull(p, x + 2, 14); } p.glow(32, 20, 22, "#80ff80", 0.06); },
  "room-arena": (p, r) => { dungeon(p, r); p.ellipse(32, 28, 26, 6, "#6a5a3a"); p.ellipse(32, 28, 22, 4, "#8a7a4a"); for (const x of [20, 44]) { p.line(x, 26, x + 4, 18, "#9aa3ad"); } skull(p, 30, 26); },
  "room-sacrificial-chamber": (p, r) => { dungeon(p, r, { wall: "#3e2a32" }); p.rect(20, 20, 24, 8, "#5a4a4a"); p.rect(20, 20, 24, 2, "#a0182a"); candle(p, 18, 18); candle(p, 45, 18); p.glow(32, 22, 14, "#ff2030", 0.1); },
  "room-counting-room": (p, r) => { dungeon(p, r); p.rect(14, 20, 36, 3, "#5a3a20"); p.rect(16, 23, 2, 9, "#4a2c18"); p.rect(46, 23, 2, 9, "#4a2c18"); coinPile(p, r, 26, 20, 8, 3); coinPile(p, r, 40, 20, 6, 2); candle(p, 33, 15); },
  "room-hatchery": (p, r) => { dungeon(p, r); for (let i = 0; i < 7; i++) { const x = 12 + i * 6, y = 27 + (i % 2) * 2; p.ellipse(x, y, 3, 4, "#c8c0a0"); p.px(x - 1, y - 2, "#e8e2d0"); } p.glow(32, 26, 18, "#ffd060", 0.06); },
  "room-warded-door": (p, r) => { dungeon(p, r); p.rect(22, 6, 20, 26, "#4a2c18"); p.rect(22, 6, 20, 2, "#6a4424"); for (let a = 0; a < 6.28; a += 0.8) p.px(32 + Math.cos(a) * 6, 18 + Math.sin(a) * 6, "#a0c0ff"); p.glow(32, 18, 10, "#80a0ff", 0.14); },
  "room-illusion-hall": (p, r) => { dungeon(p, r, { wall: "#3a2a4a" }); for (let i = 0; i < 5; i++) p.rect(8 + i * 11, 6, 8, 20, rgba("#c080ff", 0.12 + i * 0.03)); p.glow(32, 16, 20, "#c080ff", 0.08); },
  "room-dragons-lair": (p, r) => { dungeon(p, r, { wall: "#3a2a24", flame: "#ff6020" }); coinPile(p, r, 32, 35, 40, 10); skull(p, 14, 28); bone(p, 46, 30); p.glow(32, 24, 22, "#ff8030", 0.1); },
  "room-bat-roost": (p, r) => { dungeon(p, r, { torches: false }); for (let i = 0; i < 9; i++) { const x = 8 + Math.floor(r() * 48), y = 3 + Math.floor(r() * 10); p.px(x, y, "#1a1018"); p.line(x - 2, y - 1, x, y, "#1a1018"); p.line(x, y, x + 2, y - 1, "#1a1018"); p.px(x, y + 1, "#ff4040"); } },
  "room-guard-post": (p, r) => {
    dungeon(p, r);
    p.rect(26, 2, 12, 1, "#7a5230");
    p.rect(27, 3, 10, 12, "#8a1a2a"); p.rect(27, 3, 1, 12, "#6a1020"); p.rect(36, 3, 1, 12, "#6a1020");
    p.px(31, 14, null); p.rect(27, 15, 4, 1, "#8a1a2a"); p.rect(33, 15, 4, 1, "#8a1a2a");
    skull(p, 30, 6, "#e6b84a");
    for (const x of [11, 14, 17]) { p.rect(x, 4, 1, 16, "#7a5230"); p.px(x, 3, "#dfe6ee"); p.px(x, 2, "#dfe6ee"); }
    p.rect(9, 13, 11, 1, "#5a3a20");
    p.ellipse(50, 10, 4, 4, "#9aa3ad"); p.ellipse(50, 10, 3, 3, "#3a5aa0"); p.px(50, 10, "#e6b84a");
    p.glow(32, 25, 10, "#ff9a30", 0.12);
    p.rect(28, 27, 9, 2, "#3a3036"); p.rect(29, 29, 1, 4, "#2a2026"); p.rect(35, 29, 1, 4, "#2a2026");
    p.rect(29, 25, 7, 2, "#ff8a2a"); p.rect(30, 24, 2, 1, "#ffd060"); p.rect(33, 23, 1, 2, "#ffd060");
  },
  "room-pit-trap": (p, r) => {
    dungeon(p, r);
    p.ellipse(32, 29, 17, 6, "#5a5060"); p.ellipse(32, 29, 15, 5, "#0a060c");
    for (let x = 20; x <= 44; x += 3) { const h = 2 + Math.floor(r() * 2); p.rect(x, 32 - h, 1, h, "#8a8f99"); p.px(x, 31 - h, "#dfe6ee"); }
    skull(p, 46, 26); bone(p, 12, 31);
    p.line(18, 24, 22, 26, "#2a2230"); p.line(41, 25, 45, 23, "#2a2230");
  },
  "room-spike-corridor": (p, r) => {
    dungeon(p, r, { wall: "#45404e" });
    p.rect(20, 6, 3, 6, "rgba(140,20,30,0.55)"); p.px(21, 12, "rgba(140,20,30,0.55)");
    [[24, 2, 1], [28, 3, 1], [33, 4, 2]].forEach(([y, h, w], i) => {
      for (let x = 2 + i * 2; x < ART_W - 2; x += 4 + i) {
        p.rect(x, y - h, w, h, "#8a8f99"); p.rect(x, y - h, 1, h, "#c9cfd6");
        p.px(x, y - h - 1, r() < 0.3 ? "#c2344a" : "#dfe6ee");
      }
    });
  },
  "room-goblin-den": (p, r) => {
    dungeon(p, r, { wall: "#4a4438", floor: "#3a3428", torches: false });
    p.glow(32, 26, 22, "#ff8a30", 0.11);
    p.rect(3, 28, 14, 4, "#a8883a"); p.rect(4, 27, 12, 1, "#c8a848");
    p.line(27, 31, 37, 28, "#5a3a20"); p.line(27, 28, 37, 31, "#6a4424");
    p.rect(29, 25, 7, 4, "#ff7a1a"); p.rect(30, 23, 5, 2, "#ffb030"); p.rect(31, 21, 2, 2, "#ffe070"); p.px(33, 20, "#ffe070");
    bone(p, 12, 33); skull(p, 50, 30); bone(p, 42, 34);
    p.img(buildSprite(SPEC["champion-goblin-trapmaster"]), 42, 16);
    p.img(buildSprite({ base: "goblin", pal: { a: "#8ab048", b: "#5a3a2a", E: "#ffd040" } }), 6, 15);
  },
  "room-barracks": (p, r) => {
    dungeon(p, r, { torches: false });
    torch(p, 32, 8);
    for (const x0 of [3, 43]) {
      p.rect(x0, 6, 1, 26, "#6a4424"); p.rect(x0 + 17, 6, 1, 26, "#6a4424");
      for (const y of [12, 24]) { p.rect(x0 + 1, y, 16, 2, "#c8c0b0"); p.rect(x0 + 6, y - 1, 11, 2, "#8a2a2a"); p.rect(x0 + 1, y + 2, 16, 1, "#4a2c18"); p.rect(x0 + 2, y - 1, 3, 1, "#e8e2d8"); }
    }
    p.rect(27, 27, 10, 6, "#6a4424"); p.rect(27, 27, 10, 1, "#8a5a30"); p.rect(27, 29, 10, 1, "#3a3036"); p.px(32, 30, "#e6b84a");
  },
  "room-vault": (p, r) => {
    dungeon(p, r, { wall: "#4a4650", flame: "#ffd060" });
    p.disc(32, 10, 9, "#6a6e78"); p.disc(32, 10, 7, "#8a8f99"); p.disc(32, 10, 2, "#4a4e58");
    for (let a = 0; a < 6; a++) p.line(32, 10, 32 + Math.cos(a) * 6, 10 + Math.sin(a) * 6, "#5a5e68");
    p.glow(32, 28, 18, "#ffd060", 0.12);
    coinPile(p, r, 14, 34, 18, 7); coinPile(p, r, 50, 34, 16, 6);
    p.rect(25, 24, 14, 9, "#6a4424"); p.rect(25, 24, 14, 1, "#e6b84a"); p.rect(25, 28, 14, 1, "#e6b84a"); p.rect(31, 27, 2, 3, "#e6b84a");
    p.rect(25, 20, 14, 4, "#5a3a1c"); p.rect(26, 22, 12, 2, "#ffd060");
  },
  "room-trophy-hall": (p, r) => {
    dungeon(p, r, { wall: "#4e3e3a" });
    for (const x of [12, 44]) { p.rect(x, 5, 8, 7, "#6a4424"); p.rect(x + 2, 7, 4, 4, "#8a8a90"); p.px(x + 1, 6, "#e8e2d0"); p.px(x + 6, 6, "#e8e2d0"); p.px(x + 3, 9, "#ff4040"); p.px(x + 4, 9, "#ff4040"); }
    p.line(26, 3, 38, 15, "#c9cfd6"); p.line(38, 3, 26, 15, "#c9cfd6");
    p.ellipse(32, 9, 4, 5, "#8a1a2a"); p.ellipse(32, 9, 2, 3, "#e6b84a");
    p.poly([[26, 22], [38, 22], [42, 36], [22, 36]], "#7a1a2a"); p.rect(31, 22, 2, 14, "#9a2a3a");
    p.rect(28, 26, 8, 8, "#6a6470"); p.rect(28, 26, 8, 1, "#8a8490");
    p.rect(29, 22, 6, 4, "#9aa3ad"); p.rect(29, 24, 6, 1, "#4a4e58"); p.px(32, 21, "#c2344a");
  },
  "room-arcane-library": (p, r) => {
    dungeon(p, r, { torches: false });
    const cols = ["#7a2a2a", "#2a4a7a", "#3a6a3a", "#6a4a2a", "#5a2a6a", "#8a7a3a"];
    for (const y of [2, 8, 14]) {
      p.rect(0, y + 5, ART_W, 1, "#5a3a20");
      for (let x = 1; x < ART_W - 1; x += 2) { if (r() < 0.12) continue; const h = 3 + Math.floor(r() * 3); p.rect(x, y + 5 - h, 2, h, pickOf(r, cols)); p.px(x, y + 5 - h, "rgba(255,255,255,0.2)"); }
    }
    p.ellipse(32, 31, 16, 4, "#3a1a4a");
    p.rect(30, 24, 4, 8, "#5a3a20"); p.rect(26, 22, 12, 2, "#6a4424"); p.rect(27, 20, 5, 2, "#efe4c8"); p.rect(32, 20, 5, 2, "#e0d4b8");
    p.glow(32, 16, 9, "#b080ff", 0.13);
    for (let i = 0; i < 6; i++) p.px(26 + Math.floor(r() * 12), 12 + Math.floor(r() * 8), "#e0c8ff");
  },
  "room-reliquary": (p, r) => {
    dungeon(p, r, { wall: "#4a4a5a", flame: "#ffe080" });
    p.glow(32, 13, 16, "#ffe080", 0.12);
    for (let i = -3; i <= 3; i++) p.line(32, 13, 32 + i * 5, 0, "rgba(255,230,140,0.12)");
    p.rect(22, 21, 20, 10, "#6a6a78"); p.rect(22, 21, 20, 1, "#8a8a98"); p.rect(24, 22, 16, 3, "#e8e0c8"); p.rect(24, 24, 16, 1, "#c9a048");
    p.rect(28, 13, 8, 8, "#c9a048"); p.rect(28, 13, 8, 1, "#ffe080"); p.rect(31, 10, 2, 4, "#ffe080"); p.rect(30, 11, 4, 1, "#ffe080");
    gem(p, 32, 17, 1, "#c2344a");
    candle(p, 19, 16, 6); candle(p, 45, 16, 6);
  },
  "room-gambling-den": (p, r) => {
    dungeon(p, r, { wall: "#4a3a3a", floor: "#3a2a24", torches: false });
    p.rect(31, 0, 1, 4, "#3a3036"); p.rect(29, 4, 5, 4, "#e6a040"); p.glow(31, 6, 20, "#ffb050", 0.11);
    p.rect(12, 22, 40, 8, "#5a3a20"); p.rect(14, 22, 36, 6, "#2a6a3a"); p.rect(14, 22, 36, 1, "#3a8a4a");
    p.rect(16, 30, 2, 5, "#4a2c18"); p.rect(46, 30, 2, 5, "#4a2c18");
    [[18, 24], [21, 23], [24, 25]].forEach(([x, y]) => { p.rect(x, y, 3, 2, "#efe8e0"); p.px(x + 1, y, "#c2344a"); });
    p.rect(30, 24, 2, 2, "#ffffff"); p.px(30, 24, "#1a1018"); p.rect(34, 23, 2, 2, "#ffffff"); p.px(35, 24, "#1a1018");
    coinPile(p, r, 43, 27, 7, 3);
  },
  "room-haunted-chapel": (p, r) => {
    dungeon(p, r, { wall: "#3e4458", floor: "#2e3242", flame: "#80c0ff" });
    p.poly([[24, 19], [24, 7], [27, 3], [32, 1], [37, 3], [40, 7], [40, 19]], "#20242e");
    const panes = ["#3a5ab8", "#8a2a4a", "#6a3a9a", "#2a8a8a"];
    for (let y = 4; y < 19; y += 3) for (let x = 25; x < 40; x += 3) if (y > 5 || (x > 27 && x < 37)) p.rect(x, y, 2, 2, pickOf(r, panes));
    p.glow(32, 14, 18, "#8090ff", 0.08, 14);
    for (const y of [26, 31]) { p.rect(4, y, 22, 2, "#5a3a20"); p.rect(38, y, 22, 2, "#5a3a20"); p.rect(4, y - 3, 1, 5, "#4a2c18"); p.rect(59, y - 3, 1, 5, "#4a2c18"); }
    p.x.globalAlpha = 0.75; p.img(buildSprite(SPEC["monster-wraith"]), 40, 6); p.x.globalAlpha = 1;
  },
  "room-flooded-cellar": (p, r) => {
    dungeon(p, r, { wall: "#3e4a4a", floor: "#2a3434" });
    p.rect(0, 18, ART_W, 1, "#2a5a5a");
    p.rect(0, 22, ART_W, 14, "#1e3a40");
    for (let y = 23; y < ART_H; y += 2) for (let x = (y * 3) % 7; x < ART_W; x += 7 + (y % 3)) p.rect(x, y, 3, 1, "#3a6a70");
    barrel(p, 8, 20, 7); barrel(p, 46, 22, 6);
    p.rect(8, 27, 7, 1, "#5a9a9a"); p.rect(46, 28, 7, 1, "#5a9a9a");
    for (const x of [20, 37]) { p.px(x, 2, "#6aa0a0"); p.px(x, 5, "#6aa0a0"); }
  },
  "room-torture-chamber": (p, r) => {
    dungeon(p, r, { wall: "#4a3a40", flame: "#ff6040" });
    for (const x of [12, 18]) { for (let y = 0; y < 14; y += 2) { p.px(x, y, "#6a6e78"); p.px(x, y + 1, "#3a3e48"); } p.rect(x - 1, 14, 3, 2, "#8a8f99"); }
    p.rect(44, 6, 12, 26, "#5a5e68"); p.rect(45, 7, 10, 24, "#6a6e78"); p.rect(47, 10, 6, 6, "#8a8f99"); p.px(48, 12, "#1a1018"); p.px(51, 12, "#1a1018"); p.rect(49, 14, 2, 1, "#1a1018");
    p.rect(18, 26, 22, 4, "#6a4424"); p.rect(18, 26, 22, 1, "#8a5a30"); p.rect(19, 30, 2, 4, "#4a2c18"); p.rect(37, 30, 2, 4, "#4a2c18");
    p.disc(17, 27, 4, "#4a2c18"); p.disc(17, 27, 2, "#6a4424"); p.rect(24, 25, 1, 1, "#8a1a2a"); p.rect(30, 27, 3, 1, "rgba(140,20,30,0.7)");
  },
  "room-shrine-of-bargains": (p, r) => {
    dungeon(p, r, { wall: "#3e3a4e", flame: "#c080ff" });
    p.glow(32, 12, 18, "#9b6cf0", 0.1);
    p.rect(25, 4, 14, 16, "#6a6478"); p.rect(26, 5, 12, 14, "#7a7488");
    p.line(25, 4, 22, 0, "#6a6478"); p.line(38, 4, 41, 0, "#6a6478");
    p.rect(28, 9, 2, 2, "#e6b84a"); p.rect(34, 9, 2, 2, "#e6b84a"); p.rect(29, 15, 6, 1, "#3a3448");
    p.rect(24, 20, 16, 4, "#5a5468");
    p.ellipse(32, 28, 6, 2, "#8a6a2a"); coinPile(p, r, 32, 28, 8, 3);
    candle(p, 20, 24, 5); candle(p, 44, 24, 5);
    for (let i = 0; i < 5; i++) p.px(28 + Math.floor(r() * 8), 1 + Math.floor(r() * 3), "rgba(200,160,255,0.6)");
  },
  "room-blood-altar": (p, r) => {
    dungeon(p, r, { wall: "#4a2e34", floor: "#3a2428", flame: "#ff4040" });
    p.glow(32, 12, 22, "#ff2030", 0.09);
    const pts = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; pts.push([32 + Math.cos(a) * 8, 11 + Math.sin(a) * 8]); }
    for (let i = 0; i < 5; i++) p.line(pts[i][0], pts[i][1], pts[(i + 1) % 5][0], pts[(i + 1) % 5][1], "#c2344a");
    for (let a = 0; a < 6.3; a += 0.15) p.px(32 + Math.cos(a) * 9, 11 + Math.sin(a) * 9, "#8a1a2a");
    p.ellipse(32, 31, 14, 3, "#6a0a14"); p.ellipse(30, 31, 6, 1, "#a0182a");
    p.rect(22, 21, 20, 8, "#5a5058"); p.rect(22, 21, 20, 1, "#7a7078"); p.rect(26, 21, 2, 4, "#a0182a"); p.rect(35, 21, 1, 6, "#a0182a");
    candle(p, 20, 18, 4); candle(p, 44, 18, 4);
  },
  "room-war-forge": (p, r) => {
    dungeon(p, r, { torches: false });
    bricks(p, r, 2, 4, 20, 26, "#6a3a2a", "#2a1410", 4, 3);
    p.rect(6, 14, 12, 10, "#2a0a08"); p.rect(7, 18, 10, 6, "#ff6a1a"); p.rect(8, 20, 8, 3, "#ffd040"); p.glow(12, 20, 16, "#ff7a2a", 0.13);
    p.rect(30, 26, 14, 3, "#3a3e48"); p.rect(28, 25, 18, 2, "#4a4e58"); p.rect(33, 29, 8, 4, "#2a2e38"); p.rect(31, 33, 12, 2, "#3a3e48");
    p.line(40, 24, 46, 18, "#7a5230"); p.rect(45, 16, 4, 3, "#6a6e78");
    for (let i = 0; i < 8; i++) p.px(32 + Math.floor(r() * 12), 16 + Math.floor(r() * 8), pickOf(r, ["#ffd040", "#ff8a2a"]));
    for (const x of [52, 56, 60]) { p.rect(x, 6, 1, 15, "#7a5230"); p.rect(x - 1, 4, 3, 3, "#c9cfd6"); }
  },
  "room-spawning-pit": (p, r) => {
    dungeon(p, r, { wall: "#3a4438", floor: "#2e3428", flame: "#a0ff60" });
    p.glow(32, 29, 20, "#80ff40", 0.1, 8);
    p.ellipse(32, 29, 16, 5, "#2a4a14"); p.ellipse(32, 29, 14, 4, "#5aa02a");
    for (let i = 0; i < 7; i++) p.disc(22 + Math.floor(r() * 20), 28 + Math.floor(r() * 3), 1, "#a0e060");
    [[12, 30], [50, 30], [16, 33], [46, 34], [54, 26]].forEach(([x, y]) => { p.ellipse(x, y, 2.5, 3, "#d0d8a0"); p.px(x, y, "#5a6a2a"); p.px(x - 1, y - 2, "#ffffff"); });
    for (const x of [14, 40, 52]) { p.rect(x, 0, 1, 3 + Math.floor(r() * 5), "#6ab030"); }
  },
  "room-mirror-maze": (p, r) => {
    dungeon(p, r, { wall: "#44405a", floor: "#2a2838", torches: false });
    for (let y = 22; y < ART_H; y += 2) for (let x = (y / 2) % 2 ? 0 : 2; x < ART_W; x += 4) p.rect(x, y, 2, 2, "#3a3850");
    for (const [x, w] of [[5, 12], [26, 12], [47, 12]]) {
      p.rect(x - 1, 2, w + 2, 26, "#c9cfd6"); p.rect(x, 3, w, 24, "#7a90b8"); p.rect(x, 3, w, 8, "#9ab0d8");
      p.line(x + 2, 25, x + w - 2, 5, "#c8d8f0"); p.line(x + 4, 25, x + w - 1, 9, "#b0c4e8");
      p.px(x + w / 2 - 1, 14, "#ff4060"); p.px(x + w / 2 + 1, 14, "#ff4060");
    }
    p.glow(32, 14, 26, "#a0b0ff", 0.06);
  },
  "room-ogres-larder": (p, r) => {
    dungeon(p, r, { wall: "#4a3e34", floor: "#3a3026" });
    p.rect(10, 2, 44, 1, "#5a3a20");
    for (const x of [16, 26, 38, 48]) { p.rect(x, 3, 1, 3, "#8a8f99"); p.ellipse(x, 10, 3, 4.5, "#a83a3a"); p.ellipse(x - 1, 9, 1.5, 2.5, "#d86a6a"); p.rect(x, 14, 1, 3, "#e8e2d0"); }
    p.glow(32, 30, 14, "#80c040", 0.1);
    p.ellipse(32, 29, 9, 5, "#2a2a30"); p.rect(23, 25, 19, 2, "#3a3a44"); p.ellipse(32, 25, 8, 1.5, "#6a9a3a");
    p.px(29, 24, "#a0d060"); p.px(34, 23, "#a0d060");
    p.rect(26, 33, 12, 2, "#ff7a2a");
    bone(p, 6, 31); bone(p, 50, 33); skull(p, 54, 28);
  },
  "room-lichs-study": (p, r) => {
    dungeon(p, r, { wall: "#3a3e4a", flame: "#80ffc0" });
    for (const y of [4, 11]) { p.rect(2, y + 5, 14, 1, "#5a3a20"); for (let x = 3; x < 15; x += 2) p.rect(x, y + 1 + Math.floor(r() * 2), 2, 4, pickOf(r, ["#4a2a5a", "#2a4a3a", "#5a2a2a"])); }
    for (const x of [49, 54, 59]) { p.rect(x, 8, 3, 4, "rgba(120,220,160,0.6)"); p.rect(x, 7, 3, 1, "#8a8f99"); }
    p.rect(46, 12, 17, 1, "#5a3a20");
    p.rect(16, 23, 32, 3, "#5a3a20"); p.rect(16, 23, 32, 1, "#7a5230"); p.rect(18, 26, 2, 8, "#3a2010"); p.rect(44, 26, 2, 8, "#3a2010");
    skull(p, 20, 19); candle(p, 26, 19, 4); p.rect(30, 21, 8, 2, "#efe4c8"); p.rect(34, 21, 1, 2, "#b0a488");
    p.glow(42, 19, 8, "#60ffa0", 0.14); p.disc(42, 20, 2.5, "#80ffc0"); p.px(41, 19, "#ffffff");
  },
};

function roomScene(d) {
  const p = new Pic(ART_W, ART_H), r = rng(d.id);
  (ROOMS[d.id] ?? ((p, r) => { dungeon(p, r); if (d.trap) for (let x = 6; x < 60; x += 5) { p.rect(x, 30, 1, 3, "#8a8f99"); p.px(x, 29, "#dfe6ee"); } }))(p, r);
  p.vignette();
  return p;
}

// ----- terrain -----
const SKY = {
  Forest: ["#101c2a", "#1c3240", "#2e4a4e", "#4a6a5a"],
  Swamp: ["#141c18", "#22302a", "#344436", "#4a5a40"],
  Mountain: ["#18203a", "#2a3a58", "#4a5a78", "#7a8aa0"],
  Ruins: ["#160e22", "#2a1a3a", "#4a2a52", "#6a3a5a"],
};
function sky(p, type, r, h = 18) {
  const s = SKY[type] ?? SKY.Forest;
  s.forEach((c, i) => p.rect(0, Math.floor((i * h) / s.length), ART_W, Math.ceil(h / s.length) + 1, c));
  for (let i = 0; i < 10; i++) p.px(Math.floor(r() * ART_W), Math.floor(r() * h * 0.5), "rgba(255,255,240,0.7)");
}
function pine(p, x, by, h, c) {
  p.rect(x, by - 2, 1, 2, shade(c, -0.3));
  for (let y = 0; y < h; y++) { const hw = Math.floor(((y % 4) + y / 2.5) / 1.6); p.rect(x - hw, by - h - 2 + y, hw * 2 + 1, 1, y % 4 === 0 ? shade(c, 0.12) : c); }
}
function deadTree(p, x, by, h, c) {
  p.rect(x, by - h, 1, h, c); p.line(x, by - h + 3, x - 3, by - h, c); p.line(x, by - h + 5, x + 3, by - h + 1, c); p.px(x - 3, by - h - 1, c);
}
function column(p, x, by, h, w = 4, c = "#7a7088", broken = true) {
  p.rect(x, by - h, w, h, c); p.rect(x, by - h, 1, h, shade(c, 0.15)); p.rect(x + w - 1, by - h, 1, h, shade(c, -0.25));
  p.rect(x - 1, by - 2, w + 2, 2, shade(c, -0.1));
  if (broken) { p.px(x + w - 1, by - h, null); p.rect(x + w - 2, by - h, 2, 1, SKY.Ruins[2]); } else p.rect(x - 1, by - h, w + 2, 1, shade(c, 0.1));
}
function landscape(p, r, type) {
  const gy = 19;
  sky(p, type, r, gy);
  if (type === "Forest") {
    for (let x = -2; x < ART_W + 2; x += 3 + Math.floor(r() * 3)) pine(p, x, gy + 1, 5 + Math.floor(r() * 5), "#1c3a30");
    p.rect(0, gy, ART_W, ART_H - gy, "#2a4a2a");
    for (let y = gy + 4; y < ART_H; y += 4) p.rect(0, y, ART_W, 2, "#264426");
    for (let i = 0; i < 30; i++) p.px(Math.floor(r() * ART_W), gy + 1 + Math.floor(r() * 16), pickOf(r, ["#3a6a32", "#4a7a3a"]));
    pine(p, 4, ART_H, 26, "#173024"); pine(p, ART_W - 5, ART_H, 24, "#173024");
  } else if (type === "Swamp") {
    for (let x = 2; x < ART_W; x += 9 + Math.floor(r() * 6)) deadTree(p, x, gy + 1, 6 + Math.floor(r() * 5), "#1a241c");
    p.rect(0, gy - 2, ART_W, 3, "rgba(160,190,150,0.15)");
    p.rect(0, gy, ART_W, ART_H - gy, "#3a3a26");
    p.poly([[0, 24], [20, 22], [44, 23], [64, 22], [64, 33], [40, 34], [12, 33], [0, 32]], "#1e3a34");
    for (let i = 0; i < 12; i++) p.rect(4 + Math.floor(r() * 56), 24 + Math.floor(r() * 9), 3 + Math.floor(r() * 3), 1, "#3a6a5a");
    for (let i = 0; i < 14; i++) { const x = Math.floor(r() * ART_W), h = 3 + Math.floor(r() * 5); p.rect(x, ART_H - h, 1, h, "#5a6a2a"); p.px(x, ART_H - h - 1, "#6a4a2a"); }
  } else if (type === "Mountain") {
    p.poly([[-4, gy], [12, 4], [24, gy], [34, 6], [50, gy], [58, 3], [70, gy]], "#4a5068");
    for (const [px, py] of [[12, 4], [34, 6], [58, 3]]) p.poly([[px - 4, py + 4], [px, py], [px + 4, py + 4], [px + 2, py + 5], [px, py + 4], [px - 2, py + 5]], "#e8eef8");
    p.poly([[-2, gy + 2], [18, 10], [36, gy + 2]], "#3a3e50"); p.poly([[30, gy + 2], [48, 11], [66, gy + 2]], "#363a4a");
    p.rect(0, gy + 1, ART_W, ART_H - gy, "#4a4a50");
    for (let i = 0; i < 8; i++) { const x = Math.floor(r() * ART_W), y = 24 + Math.floor(r() * 10); p.ellipse(x, y, 3, 2, "#5e5e66"); p.rect(x - 2, y - 1, 3, 1, "#7a7a84"); }
  } else {
    p.disc(50, 6, 4, "#e8d8f0"); p.disc(52, 5, 4, SKY.Ruins[0]);
    p.rect(0, gy, ART_W, ART_H - gy, "#3a3040");
    for (let y = gy + 3; y < ART_H; y += 4) for (let x = (y % 8); x < ART_W; x += 8) p.rect(x, y, 6, 1, "#44384c");
    column(p, 6, gy + 4, 18); column(p, 54, gy + 5, 12);
    for (let i = 0; i < 6; i++) p.rect(Math.floor(r() * ART_W), 28 + Math.floor(r() * 6), 3, 2, "#6a6078");
  }
}
const TERRAIN_FEATURE = {
  "terrain-thornwood": (p, r) => { for (let i = 0; i < 4; i++) { let x = 6 + i * 15, y = ART_H - 1; for (let k = 0; k < 9; k++) { const nx = x + (r() < 0.5 ? -2 : 2), ny = y - 1 - Math.floor(r() * 2); p.line(x, y, nx, ny, "#4a2a1a"); if (k % 2) p.px(nx + 1, ny, "#c84a4a"); x = nx; y = ny; } } },
  "terrain-wolf-run": (p, r) => { p.disc(50, 6, 4, "#f0f0d8"); p.glow(50, 6, 8, "#f0f0d8", 0.08); for (const [x, y] of [[14, 22], [30, 20], [44, 23]]) { p.px(x, y, "#ffd040"); p.px(x + 2, y, "#ffd040"); } },
  "terrain-witchlight-glade": (p, r) => { for (let i = 0; i < 6; i++) { const x = 10 + Math.floor(r() * 44), y = 8 + Math.floor(r() * 16); p.glow(x, y, 4, "#80ffd0", 0.16); p.px(x, y, "#e0fff4"); } for (let a = 0; a < 6.28; a += 0.7) { const x = 32 + Math.cos(a) * 12, y = 29 + Math.sin(a) * 3; p.rect(x - 1, y - 1, 3, 1, "#c84a4a"); p.px(x, y, "#efe4c8"); } },
  "terrain-sucking-mire": (p, r) => { p.ellipse(32, 28, 16, 4, "#4a3a20"); for (let i = 0; i < 5; i++) { const x = 20 + Math.floor(r() * 24), y = 27 + Math.floor(r() * 3); p.disc(x, y, 1.2, "#6a5a3a"); p.px(x, y - 1, "#8a7a5a"); } },
  "terrain-leech-pools": (p, r) => { for (const [x, y] of [[18, 27], [42, 29]]) { p.ellipse(x, y, 9, 3, "#3a1a1a"); for (let k = 0; k < 3; k++) { const lx = x - 5 + k * 4; p.rect(lx, y + (k % 2) - 1, 3, 1, "#0e0a0a"); } } },
  "terrain-hexfen": (p, r) => { p.glow(32, 28, 12, "#c060ff", 0.12, 4); const pts = []; for (let i = 0; i < 6; i++) pts.push([32 + Math.cos(i * 1.047) * 10, 28 + Math.sin(i * 1.047) * 3]); for (let i = 0; i < 6; i++) p.line(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], "#d890ff"); p.line(pts[0][0], pts[0][1], pts[3][0], pts[3][1], "#a060d0"); },
  "terrain-rockslide-pass": (p, r) => { for (const [x, y, s] of [[20, 8, 3], [34, 4, 2], [44, 12, 4]]) { p.disc(x, y, s, "#6a6a70"); p.px(x - 1, y - 1, "#8a8a94"); p.line(x + s, y - s, x + s + 3, y - s - 4, "rgba(255,255,255,0.3)"); } for (let i = 0; i < 10; i++) p.rect(10 + Math.floor(r() * 44), 30 + Math.floor(r() * 5), 2, 2, "#5a5a62"); },
  "terrain-frozen-ledge": (p, r) => { p.rect(0, 20, ART_W, 6, "#a8c8e0"); p.rect(0, 20, ART_W, 1, "#e8f4ff"); for (let x = 2; x < ART_W; x += 3) { const h = 1 + Math.floor(r() * 4); p.rect(x, 26, 1, h, "#d0e8f8"); } for (let i = 0; i < 14; i++) p.px(Math.floor(r() * ART_W), Math.floor(r() * 18), "#ffffff"); },
  "terrain-eagle-cliffs": (p, r) => { p.poly([[40, 36], [44, 14], [52, 10], [64, 9], [64, 36]], "#3a3a44"); p.rect(44, 13, 20, 1, "#5a5a66"); const ex = 22, ey = 7; p.line(ex - 6, ey - 2, ex, ey + 1, "#1a1418"); p.line(ex, ey + 1, ex + 6, ey - 2, "#1a1418"); p.line(ex - 5, ey - 3, ex - 1, ey, "#2a2228"); p.line(ex + 1, ey, ex + 5, ey - 3, "#2a2228"); p.px(ex, ey + 2, "#e8e2d0"); },
  "terrain-cursed-barrow": (p, r) => { p.ellipse(32, 28, 18, 9, "#3a4a36"); p.rect(14, 28, 36, 8, "#3a4a36"); p.rect(28, 22, 8, 8, "#6a6078"); p.rect(29, 23, 6, 7, "#0a080e"); p.glow(32, 28, 16, "#80ff80", 0.07, 5); skull(p, 45, 31); },
  "terrain-collapsed-keep": (p, r) => { p.rect(22, 4, 16, 28, "#5a5268"); p.rect(22, 4, 2, 28, "#6a6278"); p.poly([[22, 4], [26, 1], [29, 5], [33, 0], [38, 3], [38, 6], [22, 6]], SKY.Ruins[1]); p.rect(26, 10, 2, 4, "#120a16"); p.rect(32, 16, 2, 4, "#120a16"); p.rect(28, 25, 4, 7, "#120a16"); for (let i = 0; i < 6; i++) p.rect(16 + Math.floor(r() * 30), 31 + Math.floor(r() * 3), 3, 2, "#6a6078"); },
  "terrain-strangling-vines": (p, r) => { for (let i = 0; i < 5; i++) { let x = 8 + i * 12, y = 0; for (let k = 0; k < 14; k++) { const nx = x + (k % 2 ? 1 : -1), ny = y + 2; p.line(x, y, nx, ny, "#2a5a2a"); if (k % 3 === 0) p.px(nx + 1, ny, "#4a8a3a"); x = nx; y = ny; } } },
  "terrain-snare-thicket": (p, r) => { for (const [x, y] of [[18, 30], [44, 32]]) { p.ellipse(x, y, 5, 1.5, "#8a6a3a"); p.ellipse(x, y, 3, 0.8, "#2a4a2a"); p.line(x, y - 1, x, y - 10, "#6a4a2a"); } p.line(18, 20, 44, 22, "#c8b890"); },
  "terrain-bramble-maze": (p, r) => { for (let i = 0; i < 7; i++) { const x = 4 + i * 9, h = 6 + Math.floor(r() * 6); p.rect(x, 34 - h, 7, h, "#1e3a1e"); for (let k = 0; k < 4; k++) p.px(x + Math.floor(r() * 7), 34 - Math.floor(r() * h), "#c84a4a"); } },
  "terrain-hanging-oak": (p, r) => { p.rect(28, 10, 4, 24, "#3a2a1a"); p.poly([[14, 12], [30, 2], [48, 10], [40, 14], [20, 15]], "#1e3a24"); p.line(42, 12, 42, 22, "#c8b890"); p.rect(41, 22, 3, 5, "#4a3a3a"); p.px(42, 21, "#e8e2d0"); },
  "terrain-fey-ring": (p, r) => { for (let a = 0; a < 6.28; a += 0.55) { const x = 32 + Math.cos(a) * 14, y = 29 + Math.sin(a) * 4; p.rect(x - 1, y - 2, 3, 2, "#e0d0ff"); p.px(x, y, "#efe4c8"); } p.glow(32, 26, 14, "#d0a0ff", 0.14, 6); for (let i = 0; i < 8; i++) p.px(20 + Math.floor(r() * 24), 14 + Math.floor(r() * 10), "#fff0ff"); },
  "terrain-drowning-pool": (p, r) => { p.ellipse(32, 29, 18, 5, "#0e2a2a"); p.ellipse(32, 29, 12, 3, "#0a1e20"); for (const x of [26, 32, 38]) p.line(x, 29, x + 1, 25, "#a8c0a8"); p.px(32, 24, "#e8e2d0"); },
  "terrain-bloodfly-swarm": (p, r) => { p.glow(32, 18, 16, "#ff4040", 0.06); for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = r() * 14; p.px(32 + Math.cos(a) * d * 1.4, 18 + Math.sin(a) * d * 0.6, pickOf(r, ["#c02030", "#1a0a0a", "#ff6060"])); } },
  "terrain-lantern-bog": (p, r) => { for (const [x, y] of [[14, 18], [30, 14], [48, 20]]) { p.glow(x, y, 6, "#ffe080", 0.18); p.disc(x, y, 1.2, "#fff4c0"); p.px(x, y + 2, "#ffe080"); } },
  "terrain-rotting-causeway": (p, r) => { for (let x = 0; x < ART_W; x += 5) { const y = 26 + Math.round(Math.sin(x / 9) * 2); p.rect(x, y, 4, 2, x % 15 === 0 ? "#3a2a1a" : "#6a4a2a"); p.rect(x + 1, y + 2, 1, 3, "#3a2a1a"); } },
  "terrain-witchs-stilt-hut": (p, r) => { for (const x of [24, 30, 36]) p.rect(x, 22, 1, 12, "#3a2a1a"); p.rect(22, 12, 17, 10, "#4a3a2a"); p.poly([[20, 12], [30, 3], [41, 12]], "#3a3a26"); p.rect(28, 15, 3, 4, "#d0ff60"); p.glow(29, 17, 6, "#d0ff60", 0.12); },
  "terrain-avalanche-slope": (p, r) => { p.poly([[0, 20], [64, 4], [64, 30], [0, 34]], "#d8e4f0"); for (let i = 0; i < 9; i++) p.disc(10 + Math.floor(r() * 44), 14 + Math.floor(r() * 14), 1.5 + r() * 2, "#f4f8ff"); },
  "terrain-dizzying-heights": (p, r) => { p.rect(0, 24, 22, 12, "#3a3e50"); p.rect(42, 22, 22, 14, "#3a3e50"); p.rect(22, 30, 20, 6, "#0a0c18"); p.line(22, 24, 42, 22, "#8a6a3a"); p.line(22, 25, 42, 23, "#6a4a2a"); for (let x = 24; x < 42; x += 3) p.px(x, 26 - Math.floor((x - 22) / 10), "#c8b890"); },
  "terrain-knife-edge-ridge": (p, r) => { p.poly([[0, 34], [32, 12], [64, 34]], "#3a3e50"); p.line(0, 34, 32, 12, "#e8eef8"); p.line(32, 12, 64, 34, "#8a90a8"); },
  "terrain-storm-peak": (p, r) => { p.poly([[18, 34], [34, 8], [52, 34]], "#3a3e50"); p.rect(0, 0, ART_W, 6, "#20263a"); let x = 40, y = 2; for (let k = 0; k < 6; k++) { const nx = x + (k % 2 ? 3 : -2), ny = y + 2; p.line(x, y, nx, ny, "#e0f0ff"); x = nx; y = ny; } p.glow(40, 8, 8, "#a0d0ff", 0.18); },
  "terrain-silent-monastery": (p, r) => { p.rect(22, 12, 20, 14, "#6a6070"); p.poly([[20, 12], [32, 4], [44, 12]], "#5a3a3a"); p.rect(30, 18, 4, 8, "#120a16"); p.rect(31, 6, 2, 5, "#e8d8a0"); p.rect(29, 7, 6, 1, "#e8d8a0"); p.glow(32, 8, 6, "#ffe0a0", 0.12); },
  "terrain-haunted-ossuary": (p, r) => { p.rect(14, 14, 36, 20, "#2a2230"); for (let y = 16; y < 32; y += 4) for (let x = 16; x < 48; x += 6) skull(p, x, y, "#c8c0b0"); p.glow(32, 22, 16, "#a0ffe0", 0.07); },
  "terrain-crumbling-stair": (p, r) => { for (let i = 0; i < 6; i++) p.rect(10 + i * 7, 32 - i * 4, 10, 4, i === 3 ? SKY.Ruins[1] : "#6a6078"); for (let i = 0; i < 5; i++) p.rect(30 + Math.floor(r() * 14), 30 + Math.floor(r() * 4), 2, 2, "#5a5068"); },
  "terrain-warded-gate": (p, r) => { column(p, 18, 34, 22, 5, "#7a7088", false); column(p, 41, 34, 22, 5, "#7a7088", false); p.rect(17, 10, 30, 3, "#6a6078"); p.rect(23, 14, 18, 20, "rgba(120,160,255,0.25)"); for (let y = 16; y < 34; y += 5) p.line(25, y, 39, y + 2, "#a0c0ff"); p.glow(32, 24, 12, "#80a0ff", 0.12); },
  "terrain-plague-pit": (p, r) => { p.ellipse(32, 30, 16, 4, "#1a120a"); for (let i = 0; i < 4; i++) bone(p, 20 + i * 6, 29 + (i % 2)); p.glow(32, 26, 14, "#a0c040", 0.1, 5); for (let i = 0; i < 6; i++) p.px(20 + Math.floor(r() * 24), 18 + Math.floor(r() * 8), "#c0e060"); },
  "terrain-shifting-halls": (p, r) => { for (let i = 0; i < 4; i++) { const x = 6 + i * 15, y = 12 + (i % 2) * 3; p.rect(x, y, 10, 22 - (i % 2) * 3, "#5a5268"); p.rect(x + 3, y + 8, 4, 22 - (i % 2) * 3 - 8, "#120a16"); } p.glow(32, 22, 20, "#c080ff", 0.06); },
  "terrain-whispering-pines": (p, r) => { for (let i = 0; i < 5; i++) { const x = 8 + i * 12; p.glow(x, 14, 5, "#a0c0ff", 0.12); p.px(x, 14, "#e0f0ff"); } },
  "terrain-gator-shallows": (p, r) => { for (const [x, y] of [[20, 28], [42, 30]]) { p.rect(x, y, 10, 2, "#3a5a2a"); p.px(x + 2, y - 1, "#ffe040"); p.px(x + 4, y - 1, "#ffe040"); for (let k = 0; k < 10; k += 2) p.px(x + k, y, "#2a4a1a"); } },
  "terrain-wyrms-gorge": (p, r) => { p.poly([[24, 36], [30, 18], [34, 18], [40, 36]], "#0a080e"); for (let y = 20; y < 36; y += 4) p.px(32 + (y % 8 ? 1 : -1), y, "#ff4030"); p.glow(32, 30, 10, "#ff4030", 0.08); },
  "terrain-toppled-idol": (p, r) => { p.poly([[18, 32], [44, 26], [46, 30], [20, 36]], "#7a7088"); skull(p, 42, 24, "#a098b0"); p.glow(40, 26, 10, "#c080ff", 0.1); },
  "terrain-bleeding-stones": (p, r) => { p.glow(32, 22, 18, "#ff2030", 0.08); for (const [x, h] of [[18, 14], [29, 18], [41, 13]]) { p.rect(x, 32 - h, 5, h, "#6a6474"); p.rect(x, 32 - h, 1, h, "#8a8494"); p.rect(x + 2, 32 - h + 2, 1, h - 4, "#a0182a"); p.px(x + 2, 33, "#a0182a"); } },
};
function terrainScene(d, withFeature = true) {
  const type = d.terrainType ?? d.preferredTerrain ?? "Forest";
  const p = new Pic(ART_W, ART_H), r = rng(d.id ?? type);
  landscape(p, r, type);
  if (withFeature) TERRAIN_FEATURE[d.id]?.(p, r);
  p.vignette(0.8);
  return p;
}

// ----- characters on a backdrop -----
function throneRoom(p, r, color) {
  bricks(p, r, 0, 0, ART_W, 24, "#3e2a32", "#1a0e14");
  for (const x of [3, 53]) { p.rect(x, 0, 8, 16, color); p.rect(x, 0, 1, 16, shade(color, -0.3)); p.rect(x + 7, 0, 1, 16, shade(color, -0.3)); p.rect(x + 3, 16, 2, 1, color); p.rect(x + 2, 4, 4, 4, shade(color, 0.35)); }
  p.rect(0, 24, ART_W, 12, "#2a1a20");
  p.poly([[24, 24], [40, 24], [48, 36], [16, 36]], "#6a1424"); p.rect(31, 24, 2, 12, "#8a1e30");
  p.rect(18, 2, 28, 26, "#2a1a14"); p.rect(19, 3, 26, 24, "#4a2c1c");
  for (const x of [18, 31, 44]) { p.rect(x, 0, 2, 3, "#c9a048"); p.px(x, 0, "#ffe080"); }
  p.rect(18, 2, 28, 1, "#c9a048");
  p.glow(32, 14, 22, color, 0.08);
}
function lairScene(p, r) { dungeon(p, r, { wall: "#3e3646" }); }
function townScene(p, r) {
  sky(p, "Mountain", r, 20);
  for (let x = 0; x < ART_W; x += 10) { const h = 6 + Math.floor(r() * 5); p.rect(x, 20 - h, 9, h + 2, "#5a4a44"); p.poly([[x - 1, 20 - h], [x + 4.5, 15 - h], [x + 10, 20 - h]], "#7a3a2a"); p.rect(x + 3, 22 - h, 2, 2, "#ffd060"); }
  p.rect(0, 22, ART_W, 14, "#5a5a4a");
  for (let y = 24; y < ART_H; y += 3) for (let x = (y % 6); x < ART_W; x += 6) p.rect(x, y, 4, 2, "#6a6a5a");
}
function figureScene(d, backdrop) {
  const p = new Pic(ART_W, ART_H), r = rng(d.id);
  const spec = specFor(d);
  backdrop(p, r, spec);
  const spr = buildSprite(spec);
  if (d.tier === "Legendary") p.glow(32, 18, 18, "#ffe080", 0.14);
  p.shadow(32, 34, 11, 2);
  p.img(spr, 32 - spr.w, ART_H - spr.h * 2, 2);
  p.vignette(0.8);
  return p;
}

// ----- items, treasures, tricks -----
function tableBackdrop(p, r, cloth = "#2a1a3a") {
  for (let x = 0; x < ART_W; x += 4) { p.rect(x, 0, 4, 26, shade(cloth, (x / 4) % 2 ? -0.15 : 0.05)); p.rect(x + 1, 0, 1, 26, shade(cloth, 0.12)); }
  p.rect(0, 26, ART_W, 10, "#4a3020");
  for (let y = 27; y < ART_H; y += 3) p.rect(0, y, ART_W, 1, "#3e2818");
  p.rect(0, 26, ART_W, 1, "#6a4a30");
  p.glow(32, 20, 22, "#ffe8c0", 0.07, 16);
}
const ITEMS = {
  "item-battleaxe": (p) => { p.line(26, 32, 38, 6, "#7a5230"); p.line(27, 32, 39, 6, "#5a3a20"); p.poly([[36, 4], [46, 8], [44, 16], [38, 12]], "#c9cfd6"); p.poly([[36, 4], [30, 6], [32, 13], [38, 12]], "#9aa3ad"); },
  "item-blessed-mail": (p) => { p.rect(22, 6, 20, 24, "#9aa3ad"); for (let y = 7; y < 30; y += 2) for (let x = 23 + (y % 4 ? 1 : 0); x < 42; x += 2) p.px(x, y, "#c9cfd6"); p.rect(31, 10, 2, 12, "#e6b84a"); p.rect(28, 13, 8, 2, "#e6b84a"); p.glow(32, 16, 12, "#ffe890", 0.1); },
  "item-war-banner": (p) => { p.rect(22, 3, 2, 30, "#7a5230"); p.rect(24, 4, 18, 14, "#8a1a2a"); p.poly([[24, 18], [33, 18], [24, 24]], "#8a1a2a"); p.poly([[33, 18], [42, 18], [42, 24]], "#8a1a2a"); skull(p, 31, 8, "#e6b84a"); },
  "item-scouts-map": (p) => { p.rect(18, 8, 28, 20, "#d8c8a0"); p.rect(18, 8, 28, 1, "#a89070"); p.line(22, 24, 30, 14, "#8a1a2a"); p.line(30, 14, 40, 20, "#8a1a2a"); p.px(40, 20, "#2a1a10"); p.px(41, 19, "#2a1a10"); p.px(39, 21, "#2a1a10"); },
  "item-wand-of-sparks": (p, r) => { p.line(22, 30, 40, 10, "#5a3a20"); p.glow(41, 9, 8, "#ffe060", 0.2); for (let i = 0; i < 8; i++) p.px(36 + Math.floor(r() * 12), 4 + Math.floor(r() * 10), "#fff4a0"); },
  "item-runed-circlet": (p) => { p.ellipse(32, 18, 12, 6, "#c9a048"); p.ellipse(32, 18, 10, 4, "#1a1020"); for (const x of [22, 27, 32, 37, 42]) p.px(x, 13 + Math.abs(x - 32) / 4, "#9fe8ff"); gem(p, 32, 12, 2, "#9b6cf0"); },
  "item-tome-of-secrets": (p) => { p.rect(21, 8, 22, 20, "#efe4c8"); p.rect(20, 7, 22, 20, "#4a1a3a"); p.rect(20, 7, 3, 20, "#2a0a1a"); p.rect(28, 13, 8, 8, "#1a0a10"); p.px(30, 16, "#ff4060"); p.px(33, 16, "#ff4060"); p.glow(32, 17, 9, "#ff4060", 0.08); },
  "item-mirror-amulet": (p) => { p.line(26, 4, 32, 12, "#c9a048"); p.line(38, 4, 32, 12, "#c9a048"); p.disc(32, 19, 7, "#c9a048"); p.disc(32, 19, 5, "#a8c8e0"); p.disc(30, 17, 1.5, "#ffffff"); },
  "item-holy-water": (p) => { p.rect(28, 6, 8, 4, "#a89070"); p.rect(26, 10, 12, 18, "#a8d0e0"); p.rect(27, 14, 10, 13, "#5a9ad0"); p.rect(31, 16, 2, 8, "#ffffff"); p.rect(29, 19, 6, 2, "#ffffff"); p.glow(32, 18, 10, "#a0d8ff", 0.12); },
  "item-pilgrims-staff": (p) => { p.rect(31, 4, 2, 28, "#7a5230"); p.ellipse(32, 6, 4, 3, "#7a5230"); p.ellipse(32, 6, 2, 1, "#1a1020"); p.rect(28, 14, 8, 3, "#8a6a4a"); },
  "item-sacred-text": (p) => { p.rect(20, 10, 24, 16, "#efe4c8"); p.rect(31, 10, 2, 16, "#a89070"); for (let y = 13; y < 24; y += 3) { p.rect(22, y, 8, 1, "#5a4a3a"); p.rect(34, y, 8, 1, "#5a4a3a"); } p.glow(32, 16, 12, "#ffe890", 0.1); },
  "item-sunstone": (p) => { p.glow(32, 16, 14, "#ffc040", 0.2); gem(p, 32, 16, 7, "#ffb030"); p.disc(30, 14, 1.5, "#fff4c0"); },
  "item-throwing-knives": (p) => { for (const dx of [-8, 0, 8]) { p.line(32 + dx, 28, 32 + dx + 4, 8, "#c9cfd6"); p.rect(31 + dx, 27, 3, 5, "#3a2a1a"); } },
  "item-smoke-bombs": (p) => { for (const [x, y] of [[24, 24], [36, 26]]) { p.disc(x, y, 5, "#2a2a30"); p.px(x - 2, y - 2, "#5a5a68"); p.rect(x, y - 7, 1, 3, "#a89070"); } for (let i = 0; i < 4; i++) p.disc(28 + i * 4, 10 - i, 3, "rgba(200,200,210,0.25)"); },
  "item-poisoned-dagger": (p) => { p.poly([[31, 4], [34, 4], [33, 22], [32, 22]], "#c9cfd6"); p.rect(27, 22, 11, 2, "#5a3a20"); p.rect(31, 24, 3, 7, "#3a2a1a"); p.px(32, 8, "#80ff60"); p.px(33, 12, "#80ff60"); p.glow(32, 12, 8, "#80ff60", 0.12); },
  "item-forged-papers": (p) => { p.rect(20, 8, 20, 22, "#e8dcc0"); p.rect(24, 6, 20, 22, "#efe4c8"); for (let y = 10; y < 22; y += 3) p.rect(26, y, 14, 1, "#5a4a3a"); p.disc(38, 24, 3, "#a0182a"); },
  "item-sword-of-dawn": (p) => { p.glow(32, 14, 12, "#ffd890", 0.15); p.rect(31, 2, 3, 22, "#c9cfd6"); p.rect(32, 2, 1, 22, "#ffffff"); p.px(32, 1, "#ffffff"); p.rect(25, 24, 15, 2, "#e6b84a"); p.rect(31, 26, 3, 5, "#6a4424"); p.disc(32.5, 32, 2, "#e6b84a"); },
  "item-tower-shield": (p) => { p.rect(22, 4, 21, 26, "#8a8f99"); p.rect(24, 6, 17, 22, "#2f4a8a"); p.rect(31, 6, 3, 22, "#e6b84a"); p.rect(24, 13, 17, 3, "#e6b84a"); p.rect(22, 30, 21, 1, "#5a5e68"); p.rect(23, 4, 1, 26, "#c9cfd6"); },
  "item-warhorn": (p) => { for (let t = 0; t <= 1; t += 0.03) { const x = 16 + t * 30, y = 26 - Math.sin(t * Math.PI) * 10 - t * 6, s = 1 + t * 3.5; p.disc(x, y, s, t > 0.92 ? "#c9a048" : mix("#e8dcc0", "#a89070", t)); } p.rect(26, 17, 1, 6, "#c9a048"); p.rect(37, 12, 1, 8, "#c9a048"); p.disc(46, 14, 2.5, "#2a1e14"); },
  "item-staff-of-embers": (p, r) => { p.line(20, 33, 42, 8, "#7a5230"); p.line(21, 33, 43, 8, "#5a3a20"); p.glow(43, 7, 9, "#ff8a2a", 0.18); p.disc(43, 7, 3, "#ff7a1a"); p.disc(43, 6, 1.5, "#ffe070"); for (let i = 0; i < 6; i++) p.px(38 + Math.floor(r() * 12), Math.floor(r() * 6), "#ffb040"); },
  "item-spellbook-of-wards": (p) => { p.rect(21, 7, 23, 22, "#efe4c8"); p.rect(20, 6, 22, 22, "#2a4a8a"); p.rect(20, 6, 3, 22, "#1a2e5a"); for (const [x, y] of [[23, 6], [39, 6], [23, 25], [39, 25]]) p.rect(x, y, 3, 3, "#e6b84a"); for (let a = 0; a < 6.3; a += 0.3) p.px(32 + Math.cos(a) * 6, 17 + Math.sin(a) * 6, "#9fe8ff"); p.disc(32, 17, 2, "#9fe8ff"); p.glow(32, 17, 9, "#9fe8ff", 0.1); },
  "item-crystal-orb": (p) => { p.glow(32, 16, 13, "#b090ff", 0.14); p.disc(32, 16, 9, "#6a5ab8"); p.disc(31, 15, 7, "#9080e0"); p.disc(29, 12, 2, "#e8e0ff"); p.rect(26, 25, 12, 3, "#c9a048"); p.rect(24, 28, 16, 3, "#a07a2a"); },
  "item-holy-relic": (p) => { p.glow(32, 16, 14, "#ffe890", 0.16); p.rect(24, 14, 16, 14, "#c9a048"); p.rect(24, 14, 16, 2, "#ffe080"); p.rect(31, 5, 2, 10, "#ffe080"); p.rect(28, 8, 8, 2, "#ffe080"); gem(p, 32, 21, 2, "#c2344a"); p.rect(23, 28, 18, 2, "#8a6a1a"); },
  "item-prayer-beads": (p) => { for (let a = 0; a < 6.28; a += 0.42) p.disc(32 + Math.cos(a) * 9, 13 + Math.sin(a) * 7, 1.4, a % 0.84 < 0.42 ? "#8a5a30" : "#a87040"); p.line(32, 20, 32, 27, "#8a5a30"); p.rect(30, 27, 5, 1, "#e6b84a"); p.rect(32, 25, 1, 6, "#e6b84a"); },
  "item-censer-of-light": (p, r) => { p.line(32, 0, 32, 9, "#a08a5a"); p.disc(32, 16, 6, "#c9a048"); p.rect(26, 15, 13, 1, "#8a6a1a"); for (const x of [29, 32, 35]) p.px(x, 18, "#fff0a0"); p.glow(32, 16, 12, "#fff0a0", 0.12); for (let i = 0; i < 5; i++) p.disc(36 + i * 2, 10 - i * 2, 1.5, "rgba(220,220,230,0.35)"); },
  "item-shadow-cloak": (p, r) => { p.poly([[32, 3], [40, 8], [46, 32], [18, 32], [24, 8]], "#2a1e3a"); p.poly([[32, 3], [37, 7], [32, 12], [27, 7]], "#1a1226"); for (const x of [26, 32, 38]) p.line(x, 12, x + (x - 32) / 3, 31, "#3e2e54"); for (let i = 0; i < 6; i++) p.px(20 + Math.floor(r() * 24), 10 + Math.floor(r() * 20), "#8a6fd0"); },
  "item-lockpicks": (p) => { [[22, 8], [26, 4], [30, 9], [34, 5], [38, 7]].forEach(([x, y], i) => { p.rect(x, y, 1, 18 - y + 4, "#c9cfd6"); p.px(x + (i % 2 ? 1 : -1), y, "#c9cfd6"); }); p.rect(18, 22, 26, 8, "#6a4424"); p.rect(18, 22, 26, 1, "#8a5a30"); p.rect(18, 25, 26, 1, "#4a2c18"); p.disc(46, 26, 3, "#9aa3ad"); p.disc(46, 26, 1.8, "#4a3020"); },
  "item-lucky-coin": (p) => { p.glow(32, 16, 13, "#ffe080", 0.12); p.disc(32, 16, 10, "#a07a1a"); p.disc(32, 16, 9, "#e6b84a"); p.disc(32, 16, 7, "#d09a2a"); for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) p.disc(32 + dx, 16 + dy, 1.6, "#3a8a4a"); p.rect(32, 18, 1, 4, "#2a6a3a"); p.px(27, 10, "#ffffff"); },
};
function itemScene(d) {
  const p = new Pic(ART_W, ART_H), r = rng(d.id);
  tableBackdrop(p, r);
  p.shadow(32, 32, 14, 2);
  (ITEMS[d.id] ?? ((p) => gem(p, 32, 18, 6, "#9b6cf0")))(p, r);
  p.vignette(0.8);
  return p;
}
const CLASS_GEM = { Warrior: "#d9434f", Mage: "#4b7def", Acolyte: "#f0d860", Rogue: "#3ab37d", Gold: "#e6b84a" };
function treasureScene(d) {
  const p = new Pic(ART_W, ART_H), r = rng(d.id);
  dungeon(p, r, { wall: "#3e3a44", torches: false, floor: "#2e2a34" });
  p.glow(32, 26, 24, "#ffd060", 0.1, 14);
  const big = /legend|hoard|relic|ransom/.test(d.id), mid = /prize|pile/.test(d.id);
  const w = big ? 46 : mid ? 32 : 20, h = big ? 15 : mid ? 10 : 6;
  coinPile(p, r, 32, 35, w, h);
  const gc = CLASS_GEM[d.type] ?? "#e6b84a";
  if (d.type !== "Gold") {
    if (big) { p.rect(25, 13, 14, 5, "#e6b84a"); for (const x of [25, 31, 37]) p.rect(x, 10, 2, 3, "#e6b84a"); gem(p, 32, 15, 2, gc); gem(p, 26, 22, 2, gc); gem(p, 39, 24, 2, gc); }
    else if (mid) { p.rect(29, 17, 7, 2, "#c9a048"); p.rect(31, 19, 3, 4, "#c9a048"); p.rect(28, 13, 9, 4, "#e6b84a"); gem(p, 32, 15, 1, gc); gem(p, 40, 28, 2, gc); }
    else gem(p, 32, 26, 3, gc);
  } else if (big) { skull(p, 30, 15, "#d8d0b8"); p.line(29, 15, 25, 11, "#d8d0b8"); p.line(34, 15, 38, 11, "#d8d0b8"); }
  p.vignette(0.9);
  return p;
}
const TRICK_COLOR = { Spell: "#9b6cf0", Construction: "#d08a40", Deceit: "#4ab08a", Empower: "#e0404a", Command: "#e6b84a" };
const TRICK_ICON = {
  Spell: (p, c, r) => { for (let a = 0; a < 6.3; a += 0.12) { p.px(32 + Math.cos(a) * 11, 18 + Math.sin(a) * 11, c); if (a % 0.48 < 0.12) p.px(32 + Math.cos(a) * 9, 18 + Math.sin(a) * 9, shade(c, 0.4)); } const s = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; s.push([32 + Math.cos(a) * 8, 18 + Math.sin(a) * 8]); } for (let i = 0; i < 5; i++) p.line(s[i][0], s[i][1], s[(i + 1) % 5][0], s[(i + 1) % 5][1], shade(c, 0.5)); },
  Construction: (p, c) => { for (let y = 24; y < 33; y += 3) for (let x = 18 + ((y / 3) % 2) * 3; x < 46; x += 6) p.rect(x, y, 5, 2, "#8a4a2a"); p.line(22, 22, 38, 6, "#7a5230"); p.line(23, 22, 39, 6, "#5a3a20"); p.rect(35, 3, 9, 5, "#8a8f99"); p.rect(35, 3, 9, 1, "#c9cfd6"); },
  Deceit: (p, c) => { p.ellipse(32, 17, 10, 12, "#efe8e0"); p.ellipse(36, 17, 6, 12, "#c8c0b8"); p.ellipse(28, 14, 2.5, 1.5, "#120a16"); p.ellipse(36, 14, 2.5, 1.5, "#120a16"); p.line(26, 22, 32, 25, "#120a16"); p.line(32, 25, 38, 22, "#120a16"); p.rect(20, 12, 4, 1, c); p.rect(40, 12, 4, 1, c); },
  Empower: (p, c, r) => { for (let i = 0; i < 9; i++) { const x = 24 + i * 2, h = 6 + Math.floor(r() * 8); p.rect(x, 14 - h, 2, h, i % 2 ? "#ff8a2a" : "#ffd040"); } p.disc(32, 17, 7, "#e8e2d0"); p.rect(28, 22, 9, 5, "#e8e2d0"); p.rect(28, 15, 3, 3, "#1a1018"); p.rect(34, 15, 3, 3, "#1a1018"); p.px(32, 19, "#1a1018"); for (const x of [29, 31, 33, 35]) p.px(x, 25, "#1a1018"); },
  Command: (p, c) => { p.rect(22, 4, 1, 30, "#7a5230"); p.px(22, 3, "#e6b84a"); p.rect(23, 5, 18, 14, "#8a1a2a"); p.poly([[41, 5], [46, 12], [41, 19]], "#8a1a2a"); p.rect(23, 5, 18, 1, "#e6b84a"); skull(p, 30, 9, "#e6b84a"); },
};
function trickScene(d) {
  const p = new Pic(ART_W, ART_H), r = rng(d.id);
  const c = TRICK_COLOR[d.type] ?? "#9b6cf0";
  p.rect(0, 0, ART_W, ART_H, "#140c1c");
  for (let k = 5; k >= 1; k--) p.ellipse(32, 18, 7 * k, 5 * k, mix("#140c1c", c, (6 - k) * 0.06));
  for (let i = 0; i < 18; i++) p.px(Math.floor(r() * ART_W), Math.floor(r() * ART_H), rgba(shade(c, 0.5), 0.7));
  for (let a = r() * 6; a < 40; a += 0.25) { const rad = 4 + a * 0.6; p.px(32 + Math.cos(a) * rad, 18 + Math.sin(a) * rad * 0.7, rgba(c, 0.35)); }
  p.glow(32, 18, 14, c, 0.12);
  TRICK_ICON[d.type]?.(p, c, r);
  p.vignette();
  return p;
}

// ---------- public API ----------
const urls = new Map();
const memo = (key, make) => { if (!urls.has(key)) { let u = ""; try { u = make()?.url() ?? ""; } catch (e) { console.warn("art failed for", key, e); } urls.set(key, u); } return urls.get(key); };

/** The 64x36 banner picture for a card definition. */
export function artFor(d) {
  if (!d) return "";
  return memo("art:" + d.id, () => {
    switch (d.deck) {
      case "rooms": return roomScene(d);
      case "terrain": return terrainScene(d);
      case "monsters": return figureScene(d, (p, r) => landscape(p, r, d.preferredTerrain));
      case "villains": return figureScene(d, (p, r, spec) => throneRoom(p, r, shade(fullPal(spec.pal).a, 0.05)));
      case "champions": return figureScene(d, lairScene);
      case "heroes": return figureScene(d, townScene);
      case "items": return itemScene(d);
      case "treasures": return treasureScene(d);
      case "tricks": return trickScene(d);
    }
    return null;
  });
}
/** A Terrain card with the Monster that came with it standing on it. */
export function pairArt(t, m) {
  if (!t || !m) return artFor(t ?? m);
  return memo(`pair:${t.id}|${m.id}`, () => {
    const p = terrainScene(t);
    const spr = buildSprite(specFor(m));
    p.shadow(44, 34, 10, 2);
    p.img(spr, 44 - spr.w, ART_H - spr.h * 2, 2);
    return p;
  });
}
/** The bare 18x18 sprite (heroes, monsters, champions, villains). */
export function spriteFor(d) {
  if (!d) return "";
  return memo("spr:" + d.id, () => { const s = specFor(d); return s && buildSprite(s); });
}
/** A Minion: a little imp. */
export function minionSprite() { return memo("spr:minion", () => buildSprite({ base: "imp", pal: { a: "#9e7bd8", b: "#6a4aa8", E: "#ffe060", w: "#ffffff", k: "#3a2a5a" } })); }
/** A tileable dungeon-wall background for the page. */
export function wallTile() {
  return memo("tile:wall", () => { const p = new Pic(32, 32), r = rng("wall"); bricks(p, r, 0, 0, 32, 32, "#1f1726", "#130d18"); return p; });
}
