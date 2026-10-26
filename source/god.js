/* God mode for thedrytextco.in: the ink never dries.
   One fountain pen performs every red mark, the visitor gets blue, the type stays type.
   Canvas 2D, SVG and CSS only. One rAF loop that sleeps whenever nothing is wet or moving. */
(() => {
'use strict';
const D = document, R = D.documentElement, W = window;
const { min, max, sqrt, sin, cos, hypot, PI, abs, floor, ceil, round, exp, pow, atan2, random, LN2 } = Math;

// ---------- 0. constants and copy ----------
const INK = {
  r: { wet: '#C2121B', dry: '#D2232A', rim: '#9F141B', gloss: 'rgba(255,255,255,.62)', sheen: 'rgba(255,255,255,.18)' },
  b: { wet: '#2346B8', dry: '#2F5BD3', rim: '#1F3C93', gloss: 'rgba(255,255,255,.6)', sheen: 'rgba(255,255,255,.18)' }
};
// the six services, each with its own ink and a few words on what it is: [gloss, wash, ink]
const GLOSS = {
  content: ['the words on it', '#F6C6C9', '#B5121A'], marketing: ['getting it seen', '#FBE7A1', '#8A6206'],
  advertising: ['paying to be seen', '#F7D0CF', '#AE3537'], branding: ['what it sounds like', '#EBC6CB', '#7E1820'],
  websites: ['the thing it sits on', '#F8DBB0', '#97500A'], strategy: ['what to say first', '#D4DEF6', '#2346B8']
};
const COPY = {
  on: 'God mode on. Nothing here has dried since 11:48 pm.',
  onReduce: "God mode on. Everything's written and already dry. Your settings asked for stillness.",
  off: 'Dried. The stains stay on the page you left.',
  hero: 'same edit. by hand this time.',
  turn: "your turn. the pencil's yours.",
  nibHint: "The pencil's yours. Draw on any blank paper; the eraser is in the corner.",
  nibHintTouch: "The pencil's yours. Tap it in the corner to draw, and again to scroll.",
  full: 'This page is full. Leave some paper for the next reader.'
};
const CAPS = { strokes: 140, pts: 1200, wet: 12 };

// ---------- 1. utilities ----------
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const mj = t => t * t * t * (10 - 15 * t + 6 * t * t);
const eoc = t => 1 - (1 - t) * (1 - t) * (1 - t);
const eio = t => (1 - cos(PI * t)) / 2;
const eic = t => t * t * t;
const eob = t => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mk(tag, cls, text) { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function frag(markup) { const t = D.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstElementChild; }
const $ = (s, r) => (r || D).querySelector(s), $$ = (s, r) => Array.from((r || D).querySelectorAll(s));
const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const MC = mk('canvas').getContext('2d');
function fontOf(cs) { return cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
function metrics(cs) {
  MC.font = fontOf(cs);
  const fs = parseFloat(cs.fontSize), m = MC.measureText('x');
  const A = m.fontBoundingBoxAscent || fs * .8, De = m.fontBoundingBoxDescent || fs * .25;
  return { fs, A, De, xh: m.actualBoundingBoxAscent || fs * .5, font: MC.font };
}

// ---------- 2. state, tracking, the one loop ----------
let on = false, gen = 0, S = null, O = null, errors = 0, restores = 0, rafs = 0;
const CANCEL = { cancel: 1 };
const TIERS = [{ k: 1.5, gloss: 2, grain: .2, verts: 5000 }, { k: 1.25, gloss: 1, grain: .14, verts: 3500 }, { k: 1, gloss: 0, grain: 0, verts: 2500 }];
const TIER0 = ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? 1 : 0;
let tier = TIER0;
const K = () => min(W.devicePixelRatio || 1, TIERS[tier].k);

function listen(t, ty, fn, o) { const s = S; t.addEventListener(ty, fn, o); s.offs.push(() => t.removeEventListener(ty, fn, o)); }
function later(ms, fn) { const s = S; const id = setTimeout(() => { s.timers.delete(id); if (s === S) safe(fn); }, ms); s.timers.add(id); return id; }
function anim(el, kf, o) { const s = S; const a = el.animate(kf, o); s.anims.add(a); a.finished.then(() => s.anims.delete(a), () => s.anims.delete(a)); if (L.hidden) a.pause(); return a; }
function keep(n) { S.nodes.push(n); return n; }
function safe(fn) { try { return fn(); } catch (e) { errors++; } }

const L = { id: 0, last: 0, fns: new Set(), hidden: D.visibilityState === 'hidden', frames: 0, dts: [] };
function wake() { if (!L.id && !L.hidden && L.fns.size) { rafs++; L.id = requestAnimationFrame(tick); } }
function every(fn) { L.fns.add(fn); wake(); return fn; }
function tick(ts) {
  L.id = 0;
  const dt = L.last ? min(50, ts - L.last) : 16.7;
  L.last = ts; L.frames++;
  if (L.dts.push(dt) > 60) L.dts.shift();
  if (S) { urgency(dt); quality(); }
  for (const f of Array.from(L.fns)) { let alive = false; try { alive = f(dt); } catch (e) { if (e !== CANCEL) errors++; } if (!alive) L.fns.delete(f); }
  if (P.dirty) drawPen();
  if (WL.dirty) drawWell();
  if (L.fns.size && !L.hidden) { rafs++; L.id = requestAnimationFrame(tick); } else L.last = 0;
}
function p95() { const d = L.dts.slice().sort((a, b) => a - b); return d.length ? d[floor(.95 * (d.length - 1))] : 0; }
let qCount = 0;
function quality() {
  if (++qCount < 60) return;
  qCount = 0;
  const p = p95();
  if (p > 20 && tier < 2) tier++;
}
// tween: one job on the loop; respects urgency; rejects with CANCEL when God mode moves on
function tween(ms, f, fixed) {
  const g = gen, job = S && S.cur;
  return new Promise((res, rej) => {
    let t = 0;
    every(dt => {
      if (g !== gen) { rej(CANCEL); return false; }
      t += dt * (fixed || !S ? 1 : S.m);
      // scroll away from a job mid act and every tween left in it lands on its final frame
      const u = ms <= 0 || (job && job.abort) ? 1 : min(1, t / ms);
      f(u, dt);
      if (u >= 1) { res(); return false; }
      return true;
    });
  });
}
const hold = ms => tween(ms, () => {});
function urgency(dt) {
  const s = S;
  if (performance.now() - s.vt > 120) s.vs *= pow(.85, dt / 16.7);
  const u = clamp((abs(s.vs) - 300) / 1500, 0, 1), q = s.jobs.filter(j => j.state === 'wait').length;
  s.m = min(3, (1 + 1.8 * u) * (1 + .5 * max(0, q - 1))) * (s.rush ? 4 : 1);
}

// ---------- 3. paper grain ----------
let GRAIN = null;
function grain() {
  if (GRAIN) return GRAIN;
  const c = mk('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), id = g.createImageData(256, 256);
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const vn = (x, y, s) => { const w = 256 / s, xi = floor(x / s), yi = floor(y / s), fx = x / s - xi, fy = y / s - yi; const a = hash(xi % w, yi % w), b = hash((xi + 1) % w, yi % w), c2 = hash(xi % w, (yi + 1) % w), d = hash((xi + 1) % w, (yi + 1) % w); const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v; };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const n = .55 * vn(x, y, 16) + .3 * vn(x, y, 4) + .15 * vn(x, y, 1), i = (y * 256 + x) * 4;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = round(255 * clamp((n - .45) * 2.2, 0, 1));
  }
  g.putImageData(id, 0, 0);
  return (GRAIN = c);
}
function grainFill(ctx, k, x, y, w, h, alpha) {
  if (!alpha) return;
  const pat = ctx.createPattern(grain(), 'repeat');
  try { pat.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0])); } catch (e) {}
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = alpha; ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); ctx.restore();
}

// ---------- 4. ink: paths, outlines, wet and dry ----------
function resample(P, step) {
  const out = [P[0].slice()]; let acc = 0;
  for (let i = 1; i < P.length; i++) {
    let x0 = P[i - 1][0], y0 = P[i - 1][1]; const x1 = P[i][0], y1 = P[i][1];
    let d = hypot(x1 - x0, y1 - y0);
    while (acc + d >= step && d > 0) { const u = (step - acc) / d; x0 += (x1 - x0) * u; y0 += (y1 - y0) * u; out.push([x0, y0]); d = hypot(x1 - x0, y1 - y0); acc = 0; }
    acc += d;
  }
  const e = P[P.length - 1]; if (hypot(e[0] - out[out.length - 1][0], e[1] - out[out.length - 1][1]) > .2) out.push(e.slice());
  return out;
}
function cubic(p0, p1, p2, p3, n) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return o; }
// pen dynamics: speed from curvature (two thirds power law), pressure from speed and direction, width from pressure
function dynamics(P, o) {
  const S2 = []; let t = 0;
  const Kv = o.vref * pow(o.kref + o.k0, 1 / 3);
  for (let i = 0; i < P.length; i++) {
    const a = P[max(0, i - 1)], b = P[i], c = P[min(P.length - 1, i + 1)];
    const abx = b[0] - a[0], aby = b[1] - a[1], bcx = c[0] - b[0], bcy = c[1] - b[1];
    const lab = hypot(abx, aby) || 1, lbc = hypot(bcx, bcy) || 1, ac = hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const kap = 2 * abs(abx * bcy - aby * bcx) / (lab * lbc * ac);
    const v = clamp(Kv * pow(kap + o.k0, -1 / 3), o.vmin, o.vmax);
    const tx = (bcx || abx) / (lbc || lab), ty = (bcy || aby) / (lbc || lab);
    const down = max(0, tx * .45 + ty * .89), vn = (v - o.vmin) / ((o.vmax - o.vmin) || 1);
    let p = .30 + .45 * pow(down, 1.5) + .35 * (1 - vn);
    const u = i / max(1, P.length - 1);
    if (o.prof) p *= o.prof(u);
    p = clamp(p, .05, 1);
    if (i) t += hypot(abx, aby) / v * 1000;
    S2.push({ x: b[0], y: b[1], w: o.wmin + (o.wmax - o.wmin) * pow(p, 1.3), p, t, z: o.zf ? o.zf(u) : 0 });
  }
  return S2;
}
function outline(ctx, S2, n, grow, dx, dy, ws) {
  dx = dx || 0; dy = dy || 0; ws = ws || 1;
  if (n < 1) return;
  const hw = i => max(.05, S2[i].w * ws / 2 + grow);
  if (n === 1) { const p = S2[0]; ctx.moveTo(p.x + dx + hw(0), p.y + dy); ctx.arc(p.x + dx, p.y + dy, hw(0), 0, 6.2832); return; }
  const Lx = new Float32Array(n), Ly = new Float32Array(n), Rx = new Float32Array(n), Ry = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = S2[max(0, i - 1)], b = S2[min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const m = hypot(tx, ty) || 1; tx /= m; ty /= m;
    const h = hw(i), x = S2[i].x + dx, y = S2[i].y + dy;
    Lx[i] = x - ty * h; Ly[i] = y + tx * h; Rx[i] = x + ty * h; Ry[i] = y - tx * h;
  }
  ctx.moveTo(Lx[0], Ly[0]);
  for (let i = 1; i < n; i++) ctx.lineTo(Lx[i], Ly[i]);
  const e = S2[n - 1], ex = e.x + dx, ey = e.y + dy;
  ctx.arc(ex, ey, hw(n - 1), atan2(Ly[n - 1] - ey, Lx[n - 1] - ex), atan2(Ry[n - 1] - ey, Rx[n - 1] - ex), false);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rx[i], Ry[i]);
  const s = S2[0], sx = s.x + dx, sy = s.y + dy;
  ctx.arc(sx, sy, hw(0), atan2(Ry[0] - sy, Rx[0] - sx), atan2(Ly[0] - sy, Lx[0] - sx), false);
  ctx.closePath();
}
function blotPath(ctx, b, r, sc) {
  ctx.moveTo(b.x + r * sc, b.y);
  for (let a = 0; a <= 64; a++) {
    const th = a / 64 * 6.2832, rr = r * sc * (1 + .12 * sin(5 * th + b.f1) + .07 * sin(11 * th) + .05 * sin(17 * th + b.f2));
    ctx.lineTo(b.x + rr * cos(th), b.y + rr * sin(th));
  }
  ctx.closePath();
}
function satPaths(ctx, b, r) {
  for (const s of b.sats) { const d = r * s[1]; ctx.moveTo(b.x + d * cos(s[0]) + s[2] * min(1, r / b.R), b.y + d * sin(s[0])); ctx.arc(b.x + d * cos(s[0]), b.y + d * sin(s[0]), s[2] * min(1, r / b.R), 0, 6.2832); }
}
// the wet look: saturated body, a little spread, a gloss streak toward the lamp (top left)
function drawWet(ctx, rec, n, extra) {
  const ink = INK[rec.ink], gl = TIERS[tier].gloss;
  ctx.save(); ctx.fillStyle = ink.wet;
  if (rec.kind === 'blot') {
    ctx.beginPath(); blotPath(ctx, rec, rec.r, 1); satPaths(ctx, rec, rec.r); ctx.fill();
    if (gl) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = ink.gloss; ctx.beginPath(); ctx.ellipse(rec.x - .35 * rec.r, rec.y - .38 * rec.r, .34 * rec.r, .2 * rec.r, -.6, 0, 6.2832); ctx.fill(); }
    ctx.restore(); return;
  }
  const S2 = rec.S; n = min(n == null ? S2.length : n, S2.length);
  ctx.beginPath(); outline(ctx, S2, n, .35);
  const pools = extra || rec.pools;
  if (pools) for (const b of pools) { ctx.moveTo(b[0] + b[2] + .35, b[1]); ctx.arc(b[0], b[1], b[2] + .35, 0, 6.2832); }
  ctx.fill();
  if (gl && n > 1) {
    ctx.globalCompositeOperation = 'source-atop';
    if (gl > 1) { ctx.fillStyle = ink.sheen; ctx.beginPath(); outline(ctx, S2, n, 0, 0, 0, .84); ctx.fill(); }
    ctx.fillStyle = ink.gloss; ctx.beginPath();
    const G = S2.slice(0, n).map(p => ({ x: p.x - .26 * p.w, y: p.y - .3 * p.w, w: .3 * p.w }));
    outline(ctx, G, n, 0); ctx.fill();
    if (pools) for (const b of pools) { ctx.beginPath(); ctx.ellipse(b[0] - .35 * b[2], b[1] - .35 * b[2], .34 * b[2], .2 * b[2], -.6, 0, 6.2832); ctx.fill(); }
  }
  ctx.restore();
}
function recBox(rec, pad) {
  if (rec.bb && !pad) return rec.bb;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y, r) => { if (x - r < x0) x0 = x - r; if (y - r < y0) y0 = y - r; if (x + r > x1) x1 = x + r; if (y + r > y1) y1 = y + r; };
  if (rec.kind === 'blot') add(rec.x, rec.y, rec.R * 2.3 + 3);
  else if (rec.kind === 'fn') { const b = rec.box; add(b.x + rec.ox, b.y + rec.oy, 0); add(b.x + b.w + rec.ox, b.y + b.h + rec.oy, 0); }
  else { for (const p of rec.S) add(p.x, p.y, p.w / 2 + 1); if (rec.pools) for (const b of rec.pools) add(b[0], b[1], b[2] + 1); }
  const p = pad || 2, bb = { x: floor(x0 - p), y: floor(y0 - p), w: ceil(x1 - x0 + 2 * p), h: ceil(y1 - y0 + 2 * p) };
  if (!pad) rec.bb = bb;
  return bb;
}
// the dry look: tide line rim, matte body, granulation, multiplied onto the host's canvas
function drawDry(ctx, k, rec) {
  const bb = recBox(rec, 4), sc = mk('canvas');
  sc.width = max(1, ceil(bb.w * k)); sc.height = max(1, ceil(bb.h * k));
  const s = sc.getContext('2d'); s.setTransform(k, 0, 0, k, -bb.x * k, -bb.y * k);
  if (rec.kind === 'fn') { s.translate(rec.ox, rec.oy); rec.dry(s); s.setTransform(k, 0, 0, k, -bb.x * k, -bb.y * k); }
  else {
    const ink = INK[rec.ink];
    if (rec.kind === 'blot') {
      s.fillStyle = ink.rim; s.beginPath(); blotPath(s, rec, rec.R, 1); satPaths(s, rec, rec.R); s.fill();
      s.fillStyle = ink.dry; s.beginPath(); blotPath(s, rec, rec.R, .86); s.fill();
    } else {
      s.fillStyle = ink.rim; s.beginPath(); outline(s, rec.S, rec.S.length, .25); s.fill();
      const inner = rec.S.map(p => ({ x: p.x, y: p.y, w: max(.1, p.w - 2 * clamp(.12 * p.w, .35, .9)) }));
      s.fillStyle = ink.dry; s.beginPath(); outline(s, inner, inner.length, .25); s.fill();
      if (rec.pools) for (const b of rec.pools) {
        s.fillStyle = ink.rim; s.beginPath(); s.arc(b[0], b[1], b[2] + .25, 0, 6.2832); s.fill();
        s.fillStyle = ink.dry; s.beginPath(); s.arc(b[0], b[1], max(.3, b[2] - max(.5, .18 * b[2])), 0, 6.2832); s.fill();
      }
    }
    grainFill(s, k, bb.x, bb.y, bb.w, bb.h, TIERS[tier].grain || .1);
  }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .94; ctx.drawImage(sc, bb.x, bb.y, sc.width / k, sc.height / k); ctx.restore();
}
function dryMs(rec) {
  if (rec.kind === 'blot') return 9000;
  let w = 0; for (const p of rec.S) w += p.w; w /= rec.S.length || 1;
  return clamp(5000 + 4000 * (w - 1.2) / 4.2, 5000, 9000);
}

// ---------- 5. hosts: canvases that live inside the page and scroll with it ----------
function canvasAt(parent, cls, x, y, w, h, kk) {
  w = max(1, ceil(w)); h = max(1, ceil(h));
  let k = kk || K();
  while ((w * k > 4096 || h * k > 4096 || w * h * k * k > 4194304) && k > .5) k *= .85;
  const c = mk('canvas', cls); c.width = ceil(w * k); c.height = ceil(h * k);
  c.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
  c.setAttribute('aria-hidden', 'true'); c.dataset.g = 'ink';
  const ctx = c.getContext('2d'); ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
  parent.append(c); keep(c);
  return { c, ctx, k, x, y, w, h };
}
class Host {
  constructor(el, perRec) {
    this.el = el; this.recs = []; this.ly = [null, null]; this.perRec = !!perRec; this.cvs = [];
    el.classList.add('g-host');
    if (getComputedStyle(el).position === 'static') el.classList.add('g-host-rel');
    this.w = el.clientWidth; this.h = el.clientHeight;
    S.hosts.add(this); if (S.ro) S.ro.observe(el);
  }
  org() { const r = this.el.getBoundingClientRect(); return { x: r.left + this.el.clientLeft, y: r.top + this.el.clientTop }; }
  rel(e) { const o = this.org(), r = e.getBoundingClientRect(); return { x: r.left - o.x, y: r.top - o.y, w: r.width, h: r.height }; }
  clampBox(bb, o) {   // never let a canvas poke out sideways past the page
    o = o || this.org();
    const x0 = max(bb.x, -o.x), x1 = min(bb.x + bb.w, R.clientWidth - o.x);
    return { x: floor(x0), y: floor(bb.y), w: max(1, ceil(x1 - x0)), h: ceil(bb.h) };
  }
  layer(over) {
    let l = this.ly[over ? 1 : 0];
    if (!l) {
      const m = 40, b = this.clampBox({ x: -m, y: -m, w: this.el.clientWidth + 2 * m, h: this.el.clientHeight + 2 * m });
      l = this.ly[over ? 1 : 0] = canvasAt(this.el, 'g-cv' + (over ? ' g-over' : ''), b.x, b.y, b.w, b.h);
    }
    return l;
  }
  bake(rec) {
    if (this.recs.indexOf(rec) < 0) this.recs.push(rec);
    if (this.perRec) {
      const bb = this.clampBox(recBox(rec, 6)), l = canvasAt(this.el, 'g-cv', bb.x, bb.y, bb.w, bb.h);
      rec.cv = l.c; drawDry(l.ctx, l.k, rec); return;
    }
    const l = this.layer(rec.over); drawDry(l.ctx, l.k, rec);
  }
  wet(rec) {   // a canvas for the wet phase of one mark
    if (O.reduce || S.leaving) return null;
    const bb = this.clampBox(recBox(rec, 8));
    const l = canvasAt(this.el, 'g-wc' + (rec.over ? ' g-over' : ''), bb.x, bb.y, bb.w, bb.h);
    S.wets.add(l.c);
    if (S.wets.size > CAPS.wet) { const old = S.wets.values().next().value; dryNow(old, 200); }
    return l;
  }
  reraster() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const rec of this.recs) remap(rec, this);
    this.ly.forEach(l => l && l.c.remove()); this.ly = [null, null];
    for (const rec of this.recs) { if (rec.cv) rec.cv.remove(); this.bake(rec); }
  }
}
function getHost(el, perRec) { for (const h of S.hosts) if (h.el === el) return h; return new Host(el, perRec); }
function remap(rec, host) {
  const a = rec.anchor; if (!a || !a.el.isConnected) return;
  const nb = host.rel(a.el), ob = a.b;
  const sx = a.t ? 1 : nb.w / (ob.w || 1), sy = a.t ? 1 : nb.h / (ob.h || 1);
  const mx = x => nb.x + (x - ob.x) * sx, my = y => nb.y + (y - ob.y) * sy;
  if (rec.S) rec.S.forEach(p => { p.x = mx(p.x); p.y = my(p.y); });
  if (rec.pools) rec.pools.forEach(b => { b[0] = mx(b[0]); b[1] = my(b[1]); });
  if (rec.kind === 'blot') { rec.x = mx(rec.x); rec.y = my(rec.y); }
  if (rec.kind === 'fn') { rec.ox += nb.x - ob.x; rec.oy += nb.y - ob.y; }
  a.b = nb; rec.bb = null;
}
function dryOff(c, ms) {
  const a = anim(c, [{ opacity: 1 }, { opacity: .92, offset: .45 }, { opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
  c._a = a;
  a.finished.then(() => { c.remove(); if (S) S.wets.delete(c); }, () => {});
}
function dryNow(c, ms, delay) {
  if (!c) return;
  if (c._a) c._a.cancel();
  const a = anim(c, [{ opacity: getComputedStyle(c).opacity }, { opacity: 0 }], { duration: ms, delay: delay || 0, fill: 'forwards' });
  c._a = a; a.finished.then(() => { c.remove(); if (S) S.wets.delete(c); }, () => {});
}
// a pen authored mark on a host: the wet canvas follows the nib, the dry bake happens at the end
function live(host, rec) {
  const wl = host.wet(rec);
  let pools = rec.pools;
  return {
    draw(n, poolR) {
      if (!wl) return;
      const bb = recBox(rec);
      wl.ctx.clearRect(wl.x, wl.y, wl.w, wl.h);
      if (poolR != null && rec.pools) pools = rec.pools.map((b, i) => i ? b : [b[0], b[1], poolR]);
      else pools = rec.pools;
      drawWet(wl.ctx, rec, n, pools);
      return bb;
    },
    done() { host.bake(rec); if (wl) { wl.ctx.clearRect(wl.x, wl.y, wl.w, wl.h); drawWet(wl.ctx, rec); dryOff(wl.c, dryMs(rec)); } }
  };
}

// ---------- 6. the pen actor (the only fixed layer) ----------
const STEEL = '<stop offset="0" stop-color="#F4F2EC"/><stop offset=".45" stop-color="#C9C7C0"/><stop offset="1" stop-color="#8E8C86"/>';
const REDG = '<stop offset="0" stop-color="#9E1A20"/><stop offset=".2" stop-color="#E8574F"/><stop offset=".36" stop-color="#D2232A"/><stop offset=".82" stop-color="#B51C23"/><stop offset="1" stop-color="#7E141A"/>';
const BLKG = '<stop offset="0" stop-color="#3A3A40"/><stop offset=".3" stop-color="#16161A"/><stop offset="1" stop-color="#0B0B0D"/>';
function grads(p) {
  const lg = (id, y, stops) => '<linearGradient id="' + p + id + '" x1="0" y1="-' + y + '" x2="0" y2="' + y + '" gradientUnits="userSpaceOnUse">' + stops + '</linearGradient>';
  return '<defs>' + lg('S', 7, STEEL) + lg('R', 9, REDG) + lg('B', 8, BLKG) + lg('C', 10, REDG) + '</defs>';
}
function penParts(p, full) {
  return '<path class="gp-tine" d="M0 0L21-2.4C26-4 30.5-5.4 34-6V0Z" fill="url(#' + p + 'S)"/>' +
    '<path class="gp-tine" d="M0 0L21 2.4C26 4 30.5 5.4 34 6V0Z" fill="url(#' + p + 'S)"/>' +
    (full ? '<path d="M1.2 0H17" stroke="#5E5C57" stroke-width=".6"/><circle cx="18.6" cy="0" r="1.5" fill="#5E5C57"/><path d="M7-1.1L20-2.3" stroke="#fff" stroke-opacity=".75" stroke-width=".7" stroke-linecap="round"/><path d="M24 3.4C27 4.4 30 5.2 33 5.6" stroke="#6E6C66" stroke-opacity=".5" stroke-width=".5" fill="none"/>' : '') +
    '<path d="M32-6.6L61-7.8Q63.5-7.8 63.5-6V6Q63.5 7.8 61 7.8L32 6.6Z" fill="url(#' + p + 'B)"/>' +
    (full ? '<path d="M35-4.8L60-5.6" stroke="#fff" stroke-opacity=".18" stroke-width="1.1" stroke-linecap="round"/>' : '') +
    '<rect x="63.5" y="-8.4" width="3.5" height="16.8" rx="1" fill="#BDBBB4"/>' +
    '<rect x="67" y="-8.8" width="104" height="17.6" rx="3.4" fill="url(#' + p + 'R)"/>' +
    (full ? '<rect x="77" y="-2.3" width="12" height="4.6" rx="1.3" fill="rgba(255,255,255,.3)" stroke="#7E141A" stroke-width=".5"/><rect class="gp-ink" x="77.4" y="-1.9" width="11.2" height="3.8" rx="1" fill="#6E0F14"/>' : '') +
    '<path d="M71-5.6H167" stroke="#fff" stroke-opacity=".38" stroke-width="1.4" stroke-linecap="round"/>' +
    (full ? '<path d="M71 6.2H167" stroke="#000" stroke-opacity=".12" stroke-width="1.2" stroke-linecap="round"/><rect x="128" y="-8.8" width="2.2" height="17.6" fill="#BDBBB4" opacity=".9"/>' : '') +
    '<path d="M171-8.8H177Q183.5-8.8 184.5-3V3Q183.5 8.8 177 8.8H171Z" fill="url(#' + p + 'B)"/>';
}
function capParts(p) {
  return '<path d="M-4-9.7H72Q76-9.7 76-6V6Q76 9.7 72 9.7H-4Q-8 9.7-8 6V-6Q-8-9.7-4-9.7Z" fill="url(#' + p + 'C)"/>' +
    '<rect x="64" y="-9.7" width="6" height="19.4" fill="url(#' + p + 'S)"/>' +
    '<path d="M8-10.6H54Q57-10.6 57-12.4V-13.4H6V-12.4Q6-10.6 8-10.6Z" fill="url(#' + p + 'S)"/>' +
    '<path d="M-2-6.4H70" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/>';
}
const SHQ = 1.5, SHX = 24, SHY = 30;
function shadowSprite() {
  const c = mk('canvas', 'g-shadow'), w = 190 + 2 * SHX, h = 2 * SHY;
  c.width = ceil(w * SHQ); c.height = ceil(h * SHQ);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  try {
    g.setTransform(SHQ, 0, 0, SHQ, SHX * SHQ, SHY * SHQ);
    g.shadowColor = 'rgb(40,32,26)'; g.shadowBlur = 7 * SHQ; g.shadowOffsetX = 4000 * SHQ;
    g.translate(-4000, 0); g.fillStyle = '#000';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(34, -6); g.lineTo(184, -8.8); g.lineTo(184, 8.8); g.lineTo(34, 6); g.closePath(); g.fill();
  } catch (e) {}
  return c;
}
const P = { x: 0, y: 0, a: -50, s: .14, z: 0, p: 0, out: false, dirty: false, el: null, sh: null, inkEl: null, Rv: 1, state: 'well' };
const f2 = v => v.toFixed(2);
const sw = () => clamp(innerWidth / 1440, .6, 1);
function drawPen() {
  P.dirty = false;
  if (!P.el) return;
  const sc = P.s * (1 + .04 * P.z / 30) * (1 - .015 * P.p);
  const tr = 'rotate(' + f2(P.a) + 'deg) scale(' + sc.toFixed(4) + ')';
  P.el.style.transform = 'translate3d(' + f2(P.x) + 'px,' + f2(P.y) + 'px,0) ' + tr + ' translate(-6px,-20px)';
  if (P.sh) {
    const show = P.out && tier < 2 && P.s > .3 && P.y > S.barB + 16;
    const op = show ? (.34 - .16 * clamp(P.z / 24, 0, 1)) * clamp((P.s - .3) / .2, 0, 1) : 0;
    P.sh.style.opacity = op.toFixed(3);
    if (op) P.sh.style.transform = 'translate3d(' + f2(P.x + (2 + 1.1 * P.z) * P.s) + 'px,' + f2(P.y + (5 + 1.6 * P.z) * P.s) + 'px,0) ' + tr + ' translate(' + (-SHX) + 'px,' + (-SHY) + 'px)';
  }
}
function penInk(Rv) { P.Rv = Rv; if (P.inkEl) P.inkEl.setAttribute('transform', 'translate(77.4 0) scale(' + clamp(Rv, .02, 1).toFixed(3) + ' 1) translate(-77.4 0)'); }
function penShow(v) { P.out = v; if (P.el) P.el.toggleAttribute('hidden', !v); if (P.sh) P.sh.hidden = !v; P.dirty = true; }
// minimum jerk travel toward a target that may move (it is re-read every frame, which absorbs scrolling)
function fly(target, o) {
  o = o || {};
  const x0 = P.x, y0 = P.y, a0 = P.a, s0 = P.s, z0 = P.z;
  const t0 = target(), Dd = hypot(t0.x - x0, t0.y - y0);
  const T = o.ms || clamp(260 + 9 * sqrt(Dd), 300, 900);
  const zl = o.lift != null ? o.lift : min(26, 6 + .05 * Dd);
  const a1 = o.a != null ? o.a : -40, s1 = o.s != null ? o.s : sw(), z1 = o.z || 0;
  let nx = -(t0.y - y0), ny = t0.x - x0; const nl = hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const mx = (x0 + t0.x) / 2, my = (y0 + t0.y) / 2;
  const sgn = ((innerWidth / 2 - mx) * nx + (innerHeight / 2 - my) * ny) < 0 ? -1 : 1;
  const bulge = (o.bulge != null ? o.bulge : .12) * Dd * sgn;
  P.state = 'fly';
  return tween(T, u => {
    const e = mj(u), t = target(), b = bulge * 4 * u * (1 - u);
    P.x = x0 + (t.x - x0) * e + nx * b; P.y = y0 + (t.y - y0) * e + ny * b;
    P.a = a0 + (a1 - a0) * e; P.s = s0 + (s1 - s0) * e;
    P.z = z0 + (z1 - z0) * e + zl * sin(PI * u); P.p = 0; P.dirty = true;
    if (o.each) o.each(u, e);
  });
}
// the nib follows a synthesised path; toC maps path coordinates to the client each frame
function follow(sm, toC, each, aBase) {
  const n = sm.length; if (n < 2) return Promise.resolve();
  const Tt = sm[n - 1].t || 1; let i = 0, vx = 0, lx = null, aa = P.a;
  const base = aBase != null ? aBase : -40;
  P.state = 'write';
  return tween(Tt, u => {
    const t = u * Tt;
    while (i < n - 2 && sm[i + 1].t <= t) i++;
    const A0 = sm[i], A1 = sm[i + 1], f = A1.t > A0.t ? clamp((t - A0.t) / (A1.t - A0.t), 0, 1) : 1;
    const x = lerp(A0.x, A1.x, f), y = lerp(A0.y, A1.y, f), z = lerp(A0.z || 0, A1.z || 0, f);
    const c = toC(x, y);
    if (lx != null) vx = lerp(vx, (c.x - lx) * 60, .15);
    lx = c.x;
    aa = lerp(aa, base + clamp(-.012 * vx, -6, 6), .25);
    P.x = c.x; P.y = c.y; P.z = z; P.a = aa; P.p = A0.p != null ? A0.p : .5; P.dirty = true;
    if (each) each(u >= 1 ? n - 1 : i, f, x, y);
  });
}

// ---------- 7. the inkwell, inside the switch ----------
const WL = { svg: null, pen: null, cap: null, clip: null, inkg: null, rip: null, drop: null, seg: 42, L: .78, phi: 0, dirty: false,
  pose: { x: 0, y: 31, a: -62 }, penVis: true, capMode: 'post', capPose: { x: 0, y: 0, a: 0 }, ripU: -1, ripX: 0, dropY: null };
function wellPose(name) {
  const s = WL.seg;
  if (name === 'hidden') return { x: .66 * s, y: 31, a: -62 };
  if (name === 'rest') return { x: .66 * s, y: 21, a: -62 };
  return { x: .66 * s + 8.7, y: 26 * (1 - WL.L) - 2.5, a: -50 };
}
const dockPose = () => ({ x: .40 * WL.seg, y: 5, a: -6 }); // resting on the rim, inside the switch
function postedCap(p) { const r = p.a * PI / 180, d = 150 * .14; return { x: p.x + d * cos(r), y: p.y + d * sin(r), a: p.a }; }
function mountWell(L0, docked) {
  const sw0 = $('#modeSwitch'); if (!sw0) return;
  const god = $('[data-mode="god"]', sw0);
  const seg = WL.seg = round(god ? god.offsetWidth : 42) || 42;
  const svg1 = frag('<svg class="g-well" data-g="well" viewBox="0 0 ' + seg + ' 26" aria-hidden="true" focusable="false">' +
    '<defs><clipPath id="gwClip"><rect width="' + seg + '" height="26" rx="13"/></clipPath></defs>' +
    '<rect class="g-glass" x=".5" y=".5" width="' + (seg - 1) + '" height="25" rx="12.5"/>' +
    '<g clip-path="url(#gwClip)"><g class="g-inkg"><path class="g-ink" d="M-6 0Q' + (seg / 4) + '-1.4 ' + (seg / 2) + ' 0T' + (seg + 6) + ' 0V40H-6Z"/>' +
    '<path class="g-men" d="M1 .2Q' + (seg / 2) + '-2.2 ' + (seg - 1) + ' .2"/><path class="g-shine" d="M6 3.2Q' + (seg / 2) + ' 2 ' + (seg - 7) + ' 3.2"/></g></g>' +
    '<rect class="g-rim" x="1.5" y="1.5" width="' + (seg - 3) + '" height="23" rx="11.5"/></svg>');
  const svg2 = frag('<svg class="g-wellpen" data-g="wellpen" viewBox="0 0 ' + seg + ' 26" overflow="visible" aria-hidden="true" focusable="false">' +
    grads('gw') + '<defs><clipPath id="gwpClip"><rect class="gwp-clip" x="-80" y="-90" width="240" height="96"/></clipPath></defs>' +
    '<g clip-path="url(#gwpClip)"><g class="gwp-pen">' + penParts('gw', false) + '</g></g>' +
    '<g class="gwp-cap">' + capParts('gw') + '</g>' +
    '<ellipse class="g-rip" cx="0" cy="0" rx="1" ry=".4"/><circle class="g-drop" r="1.2"/></svg>');
  sw0.append(svg1, svg2); keep(svg1); keep(svg2);
  Object.assign(WL, { svg: svg1, wp: svg2, pen: $('.gwp-pen', svg2), cap: $('.gwp-cap', svg2), clip: $('.gwp-clip', svg2), inkg: $('.g-inkg', svg1), rip: $('.g-rip', svg2), drop: $('.g-drop', svg2), L: L0, phi: 0, penVis: true, capMode: docked ? 'dock' : 'post', ripU: -1, dropY: null });
  WL.pose = wellPose(docked ? 'rest' : 'hidden');
  if (docked) WL.capPose = dockPose();
  drawWell();
}
function drawWell() {
  WL.dirty = false;
  if (!WL.svg) return;
  const top = 26 * (1 - WL.L);
  WL.inkg.setAttribute('transform', 'translate(0 ' + f2(top) + ') skewX(' + f2(WL.phi) + ')');
  WL.clip.setAttribute('height', f2(90 + top));
  const p = WL.pose;
  WL.pen.setAttribute('transform', 'translate(' + f2(p.x) + ' ' + f2(p.y) + ') rotate(' + f2(p.a) + ') scale(.14)');
  WL.pen.style.display = WL.penVis ? '' : 'none';
  const c = WL.capMode === 'post' ? postedCap(p) : WL.capPose;
  WL.cap.setAttribute('transform', 'translate(' + f2(c.x) + ' ' + f2(c.y) + ') rotate(' + f2(c.a) + ') scale(.14)');
  WL.cap.style.display = WL.capMode === 'post' && !WL.penVis ? 'none' : '';
  if (WL.ripU >= 0 && WL.ripU < 1) {
    const u = WL.ripU;
    WL.rip.setAttribute('cx', f2(WL.ripX)); WL.rip.setAttribute('cy', f2(top));
    WL.rip.setAttribute('rx', f2(1 + 8 * u)); WL.rip.setAttribute('ry', f2(.4 + 1.2 * u));
    WL.rip.style.opacity = (.75 * (1 - u)).toFixed(3);
  } else WL.rip.style.opacity = 0;
  if (WL.dropY != null) { WL.drop.setAttribute('cx', f2(p.x - .6)); WL.drop.setAttribute('cy', f2(WL.dropY)); WL.drop.style.opacity = 1; }
  else WL.drop.style.opacity = 0;
}
function setPose(p) { WL.pose = p; WL.dirty = true; }
function lerpPose(a, b, e) { return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), a: lerp(a.a, b.a, e) }; }
function wellBox() { return WL.wp ? WL.wp.getBoundingClientRect() : { left: innerWidth - 56, top: 20 }; }
function wellClient(p) { const b = wellBox(); return { x: b.left + p.x, y: b.top + p.y }; }
function ripple() { WL.ripX = WL.pose.x; return tween(320, u => { WL.ripU = u >= 1 ? -1 : u; WL.dirty = true; }, true).catch(() => {}); }
function slosh(amp) { const w = 2 * PI * 4; return tween(900, u => { const t = u * .9; WL.phi = amp * exp(-.3 * w * t / 2.2) * sin(w * t); if (u >= 1) WL.phi = 0; WL.dirty = true; }, true).catch(() => {}); }
// the well pen becomes the free pen at the very same pose, in the same frame
function handOut() {
  const c = wellClient(WL.pose);
  P.x = c.x; P.y = c.y; P.a = WL.pose.a; P.s = .14; P.z = 0; P.p = 0;
  WL.penVis = false; WL.dirty = true; penShow(true);
}
function handIn() {
  const b = wellBox();
  WL.pose = { x: P.x - b.left, y: P.y - b.top, a: P.a };
  WL.penVis = true; WL.dirty = true; penShow(false); P.state = 'well';
}
const mouthTarget = () => wellClient(wellPose('mouth'));
async function rise() {
  if (!WL.svg) { P.x = innerWidth - 40; P.y = 30; P.a = -50; P.s = .14; penShow(true); return; }
  const a = WL.pose, b = wellPose('mouth');
  P.state = 'rise';
  await tween(300, u => setPose(lerpPose(a, b, eoc(u))));
  handOut();
}
async function goHome() {
  if (!P.out) return;
  if (!WL.svg) { await fly(() => ({ x: innerWidth - 40, y: 30 }), { a: -50, s: .14, lift: 4 }); penShow(false); return; }
  await fly(mouthTarget, { a: -50, s: .14, lift: 10, ms: min(600, 300 + 9 * sqrt(hypot(P.x - mouthTarget().x, P.y - mouthTarget().y))) });
  handIn(); penInk(1);
  const a = WL.pose, b = wellPose('rest');
  P.state = 'sink';
  await tween(200, u => setPose(lerpPose(a, b, eio(u))));
  ripple();
  P.state = 'well';
}
async function uncap() {
  P.state = 'rise';
  anim(WL.svg, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: 'backwards' });
  slosh(7);
  await tween(420, u => { WL.L = lerp(.30, .78, eob(u)); WL.dirty = true; }, true);
  const a = wellPose('hidden'), b = wellPose('mouth');
  await tween(420, u => setPose(lerpPose(a, b, eoc(u))), true);
  // a drop hangs from the nib and falls back in
  const ny = WL.pose.y;
  await tween(110, u => { WL.dropY = ny + 1.6 + (u < .4 ? 0 : (u - .4) / .6 * 4); if (u >= 1) WL.dropY = null; WL.dirty = true; }, true);
  ripple();
  // the cap slides off the back end, turns, and flies to its dock on the switch's top edge
  const p0 = postedCap(WL.pose), r = WL.pose.a * PI / 180;
  const p1 = { x: p0.x + 4 * cos(r), y: p0.y + 4 * sin(r), a: p0.a + 18 };
  WL.capMode = 'fly';
  await tween(180, u => { WL.capPose = lerpPose(p0, p1, eob(u)); WL.dirty = true; }, true);
  const dk = dockPose();
  O.toast(COPY.on);
  await tween(300, u => { const e = mj(u); WL.capPose = { x: lerp(p1.x, dk.x, e), y: lerp(p1.y, dk.y, e) - 6 * sin(PI * u), a: lerp(p1.a, dk.a, e) }; WL.dirty = true; }, true);
  WL.capMode = 'dock';
  handOut();
}
async function recap(fast) {
  if (!WL.svg) { penShow(false); return; }
  if (P.out) {
    await fly(mouthTarget, { a: -50, s: .14, lift: 10, ms: fast ? 260 : min(500, 260 + 8 * sqrt(hypot(P.x - mouthTarget().x, P.y - mouthTarget().y))) });
    handIn();
  }
  const a = WL.pose, m = wellPose('mouth');
  if (hypot(a.x - m.x, a.y - m.y) > .5) await tween(180, u => setPose(lerpPose(a, m, eio(u))), true);
  if (WL.capMode !== 'post') {
    const c0 = WL.capMode === 'dock' ? dockPose() : WL.capPose, c1 = postedCap(WL.pose);
    WL.capMode = 'fly';
    await tween(220, u => { const e = mj(u); WL.capPose = { x: lerp(c0.x, c1.x, e), y: lerp(c0.y, c1.y, e) - 5 * sin(PI * u), a: lerp(c0.a, c1.a, e) }; WL.dirty = true; }, true);
    WL.capMode = 'post';
  }
  const b = WL.pose, h = wellPose('hidden');
  await tween(260, u => setPose(lerpPose(b, h, eic(u))), true);
  ripple();
}
async function dip() {
  await fly(mouthTarget, { a: -50, s: .14, lift: 14 });
  handIn();
  P.state = 'dip';
  const m = WL.pose, r = m.a * PI / 180, dx = -8 * cos(r), dy = -8 * sin(r);
  const deep = { x: m.x + dx, y: m.y + dy, a: m.a };
  await tween(220, u => setPose(lerpPose(m, deep, eic(u))), true);
  ripple(); slosh(3);
  const r0 = P.Rv;
  await tween(300, u => penInk(lerp(r0, 1, eio(u))), true);
  await tween(180, u => setPose(lerpPose(deep, m, eoc(u))), true);
  for (const s of [3, -3]) await tween(60, u => setPose({ x: m.x + s * sin(PI * u), y: m.y, a: m.a }), true);
  handOut();
}

// ---------- 8. geometry and the Writer ----------
function frameOf(el) {
  const cs = getComputedStyle(el), w = el.offsetWidth, h = el.offsetHeight;
  let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
  if (cs.transform && cs.transform !== 'none') { const m = new DOMMatrix(cs.transform); a = m.a; b = m.b; c = m.c; d = m.d; e = m.e; f = m.f; }
  const to = cs.transformOrigin.split(' ').map(parseFloat), ox = to[0] || 0, oy = to[1] || 0;
  const T = (x, y) => [ox + a * (x - ox) + c * (y - oy) + e, oy + b * (x - ox) + d * (y - oy) + f];
  const cr = [T(0, 0), T(w, 0), T(0, h), T(w, h)];
  const minx = min(cr[0][0], cr[1][0], cr[2][0], cr[3][0]), miny = min(cr[0][1], cr[1][1], cr[2][1], cr[3][1]);
  const r0 = el.getBoundingClientRect(), Ox = r0.left - minx, Oy = r0.top - miny, det = a * d - b * c || 1;
  const F = {
    w, h, rot: atan2(b, a), dx: 0, dy: 0, a, b, c, d,
    toClient(x, y) { const p = T(x, y); return { x: Ox + p[0] + F.dx, y: Oy + p[1] + F.dy }; },
    toLocal(X, Y) { const px = X - Ox - e - ox, py = Y - Oy - f - oy; return [ox + (d * px - c * py) / det, oy + (-b * px + a * py) / det]; },
    drift() { const q = el.getBoundingClientRect(); F.dx = q.left - r0.left; F.dy = q.top - r0.top; }
  };
  return F;
}
const ASC = /[bdfhklt0-9A-Z'"!?←↳]/, DSC = /[gjpqy]/;
function geom(el, pseudo) {
  const cs = getComputedStyle(el), m = metrics(cs), f = frameOf(el), chars = [];
  if (pseudo) {
    const txt = (getComputedStyle(el, '::after').content || '').replace(/^["']|["']$/g, '');
    MC.font = m.font;
    const lh = parseFloat(cs.lineHeight) || m.fs, base = parseFloat(cs.paddingTop) + (lh - (m.A + m.De)) / 2 + m.A;
    let x0 = parseFloat(cs.paddingLeft) || 0;
    for (let i = 0; i < txt.length; i++) {
      const x = x0 + MC.measureText(txt.slice(0, i)).width, w = MC.measureText(txt[i]).width;
      chars.push(txt[i] === ' ' ? { sp: 1 } : { ch: txt[i], x, w, base, line: 0 });
    }
  } else {
    const tw = D.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = D.createRange(), sinT = abs(sin(f.rot)), cosT = cos(f.rot) || 1, hh = m.A + m.De;
    let n;
    while ((n = tw.nextNode())) {
      const s = n.textContent;
      for (let i = 0; i < s.length; i++) {
        if (/\s/.test(s[i])) { chars.push({ sp: 1 }); continue; }
        rg.setStart(n, i); rg.setEnd(n, i + 1);
        const r = rg.getClientRects()[0];
        if (!r || !r.width) continue;
        const cl = f.toLocal(r.left + r.width / 2, r.top + r.height / 2), w = max(2, (r.width - hh * sinT) / cosT);
        chars.push({ ch: s[i], x: cl[0] - w / 2, w, base: cl[1] + (m.A - m.De) / 2, line: 0 });
      }
    }
  }
  // lines by baseline
  const lines = [];
  for (const c of chars) {
    if (c.sp) continue;
    let k = lines.findIndex(l => abs(l.base - c.base) < .5 * m.fs);
    if (k < 0) { lines.push({ base: c.base }); k = lines.length - 1; }
    c.line = k;
  }
  const order = lines.map((l, i) => i).sort((p, q) => lines[p].base - lines[q].base), remapL = [];
  order.forEach((o, i) => { remapL[o] = i; });
  chars.forEach(c => { if (!c.sp) c.line = remapL[c.line]; });
  const LS = order.map(o => lines[o]);
  LS.forEach((l, i) => {
    l.y0 = i ? (LS[i - 1].base + m.De + l.base - m.A) / 2 : -60;
    l.y1 = i < LS.length - 1 ? (l.base + m.De + LS[i + 1].base - m.A) / 2 : f.h + 60;
  });
  return { el, f, m, fs: m.fs, xh: m.xh, chars, lines: LS, W: f.w, H: f.h, rv: { line: 0, X: -60, gap: null } };
}
function motif(c, xh, r) {
  const ch = c.ch;
  let pts;
  if (ch === '.') pts = [[.35, -.1], [.5, -.02]];
  else if (ch === ',' || ch === ';') pts = [[.4, -.08], [.3, .35]];
  else if (ch === ':') pts = [[.5, -.66], [.5, -.58], [.5, -.12], [.5, -.04]];
  else if (DSC.test(ch)) pts = [[.12, -.6], [.52, -1], [.42, .48], [.26, .2], [.88, -.3]];
  else if (ASC.test(ch)) pts = [[.12, -.45], [.4, -1.55], [.3, -.02], [.68, -.65], [.92, -.18]];
  else pts = [[.1, -.55], [.45, -1], [.25, -.05], [.62, -.7], [.9, -.2]];
  return pts.map(p => [c.x + (p[0] + (r() - .5) * .08) * c.w, c.base + (p[1] + (r() - .5) * .12) * xh]);
}
function catmull(P2, sub) {
  if (P2.length < 3) return P2.slice();
  const o = [P2[0]];
  for (let i = 0; i < P2.length - 1; i++) {
    const p0 = P2[max(0, i - 1)], p1 = P2[i], p2 = P2[i + 1], p3 = P2[min(P2.length - 1, i + 2)];
    for (let j = 1; j <= sub; j++) {
      const t = j / sub, t2 = t * t, t3 = t2 * t;
      o.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  return o;
}
// the nib path for a run of characters: one spline per word, lifts between words, human pace
function nibPath(g, from, to, seed) {
  const r = rng(seed), fs = g.fs, out = [];
  const vref = 420 * fs / 21, opt = { vref, kref: 2 / fs, k0: 1 / (20 * fs), vmin: 70 * fs / 21, vmax: 1100 * fs / 21, wmin: 1, wmax: 1 };
  let word = [], t = 0;
  const flush = () => {
    if (!word.length) return;
    const pts = [];
    for (const i of word) motif(g.chars[i], g.xh, r).forEach(p => pts.push([p[0], p[1], i]));
    const sm = resample(catmull(pts.map(p => [p[0], p[1]]), 6), 1.5);
    const dyn = dynamics(sm, opt);
    // char index per sample by nearest x progress
    let ci = 0;
    const startT = t;
    if (out.length) {   // a lift from the last word
      const a = out[out.length - 1], b = dyn[0], dd = hypot(b.x - a.x, b.y - a.y), T = (90 + 2.2 * sqrt(dd)) * .8, steps = max(2, round(T / 16));
      for (let s = 1; s < steps; s++) { const u = s / steps, e = mj(u); out.push({ x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: 4 * sin(PI * u), t: a.t + T * u, c: a.c, p: 0 }); }
      t = a.t + T;
    }
    for (const p of dyn) {
      while (ci < word.length - 1 && p.x > g.chars[word[ci]].x + g.chars[word[ci]].w * .92) ci++;
      out.push({ x: p.x, y: p.y, z: 0, t: t + p.t, c: word[ci], p: p.p });
    }
    t = out[out.length - 1].t;
    if (g.chars[word[word.length - 1]].ch === '.') { const e = out[out.length - 1]; out.push({ x: e.x, y: e.y, z: 0, t: t + 40, c: e.c, p: .8 }); t += 40; }
    word = [];
    return startT;
  };
  for (let i = from; i < to; i++) { const c = g.chars[i]; if (!c) break; if (c.sp) flush(); else word.push(i); }
  flush();
  return out;
}
function clipOf(g) {
  const rv = g.rv, LS = g.lines, Wd = g.W + 60, k = rv.line, rects = [];
  if (!LS.length) return 'none';
  const y0 = LS[k].y0, y1 = LS[k].y1;
  if (k > 0) rects.push([-60, -60, Wd, y0]);
  const X = rv.X;
  if (rv.gap && rv.gap.line === k) { rects.push([-60, y0, min(X, rv.gap.a), y1]); if (X > rv.gap.b) rects.push([rv.gap.b, y0, X, y1]); }
  else rects.push([-60, y0, X, y1]);
  if (rv.gap && rv.gap.line < k) { /* the gap line is above: keep it open except the gap */
    rects.length = 0;
    const gl = LS[rv.gap.line];
    if (rv.gap.line > 0) rects.push([-60, -60, Wd, gl.y0]);
    rects.push([-60, gl.y0, rv.gap.a, gl.y1], [rv.gap.b, gl.y0, Wd, gl.y1]);
    if (k > rv.gap.line + 1) rects.push([-60, gl.y1, Wd, y0]);
    rects.push([-60, y0, X, y1]);
  }
  let s = '';
  for (const q of rects) {
    if (q[2] <= q[0] || q[3] <= q[1]) continue;
    s += (s ? ',' : '') + '-70px ' + q[1].toFixed(1) + 'px,' + q[0].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px,' + q[2].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px,' + q[2].toFixed(1) + 'px ' + q[3].toFixed(1) + 'px,' + q[0].toFixed(1) + 'px ' + q[3].toFixed(1) + 'px,' + q[0].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px,-70px ' + q[1].toFixed(1) + 'px';
  }
  return s ? 'polygon(' + s + ')' : 'polygon(0 0,0 0,0 0)';
}
function setClip(g) { g.el.style.clipPath = clipOf(g); }
function startWrite(el) {
  el.classList.remove('g-pend', 'g-quick', 'g-wet', 'g-dry');
  el.classList.add('inked', 'g-writing');
}
// write a run of a DOM element's own text with the pen; the reveal follows the nib
async function write(g, o) {
  o = o || {};
  const from = o.from || 0, to = o.to != null ? o.to : g.chars.length;
  const sm = nibPath(g, from, to, S.seed + (o.seed || 0) + from * 7);
  if (!sm.length) return;
  const toC = (x, y) => g.f.toClient(x, y);
  if (!o.noFly) { g.f.drift(); const s0 = sm[0]; await fly(() => { g.f.drift(); return toC(s0.x, s0.y); }, { a: -40, s: sw(), lift: o.lift }); }
  if (!g.el.classList.contains('g-writing')) { startWrite(g.el); setClip(g); }
  const fs = g.fs;
  let lastC = -1;
  await follow(sm, (x, y) => { g.f.drift(); return toC(x, y); }, (i, f2, x) => {
    const c = g.chars[sm[i].c];
    if (!c) return;
    if (c.line > g.rv.line) { g.rv.line = c.line; g.rv.X = -60; }
    if (c.line === g.rv.line) g.rv.X = max(g.rv.X, x + .15 * fs);
    if (o.onChar && sm[i].c !== lastC) { lastC = sm[i].c; o.onChar(lastC); }
    setClip(g);
  });
  if (o.keep) return;
  finishWrite(g);
}
function finishWrite(g) {
  const el = g.el;
  if (g.rv.gap) { g.rv.line = g.lines.length - 1; g.rv.X = g.W + 60; setClip(g); }
  else el.style.clipPath = '';
  el.classList.remove('g-writing', 'g-pend'); el.classList.add('inked', 'g-wet');
  if (O.reduce) { el.classList.remove('g-wet'); el.classList.add('g-dry'); return; }
  later(5000, () => { el.classList.remove('g-wet'); el.classList.add('g-dry'); });
}
// margin notes write themselves: the reveal runs along the nib's path with no pen on screen
async function inkWrite(g) {
  const sm = nibPath(g, 0, g.chars.length, S.seed), n = sm.length;
  if (n < 2) { quick(g.el); return; }
  startWrite(g.el); setClip(g);
  const fs = g.fs, Tt = sm[n - 1].t || 1;
  let i = 0;
  await tween(Tt, u => {
    const t = u * Tt;
    while (i < n - 2 && sm[i + 1].t <= t) i++;
    const A0 = sm[i], A1 = sm[i + 1], f = A1.t > A0.t ? clamp((t - A0.t) / (A1.t - A0.t), 0, 1) : 1;
    const c = g.chars[sm[u >= 1 ? n - 1 : i].c];
    if (!c) return;
    const x = lerp(A0.x, A1.x, f);
    if (c.line > g.rv.line) { g.rv.line = c.line; g.rv.X = -60; }
    if (c.line === g.rv.line) g.rv.X = max(g.rv.X, x + .15 * fs);
    setClip(g);
  });
  finishWrite(g);
}
function quick(el, delay) {
  if (!el || el.classList.contains('g-dry') || el.classList.contains('g-wet') || el.classList.contains('g-writing')) return;
  el.classList.remove('g-pend'); el.style.clipPath = '';
  el.classList.add('inked');
  if (O.reduce) { el.classList.add('g-dry'); return; }
  el.style.animationDelay = (delay || 0) + 'ms';
  el.classList.add('g-quick');
  later(420 + (delay || 0), () => { el.classList.remove('g-quick'); el.style.animationDelay = ''; el.classList.add('g-wet'); later(5000, () => { el.classList.remove('g-wet'); el.classList.add('g-dry'); }); });
}

// ---------- 9. God only DOM ----------
function godNote(text, key) { const p = mk('p', 'note g-note g-pend', text); p.dataset.g = key; return keep(p); }
function intoStack(stack, node) {
  if (!stack) return null;
  const slot = $(':scope > .slot', stack);
  if (slot) slot.before(node); else stack.append(node);
  return node;
}
function madeStack(row) { const s = mk('div', 'note-stack g-made'); s.dataset.g = 'stack'; row.append(s); keep(s); return s; }
function pageNoteText() {
  const pg = $('.page'), name = (pg && pg.dataset.page) || '', path = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  if (name === 'work' || /^\/work\//.test(path)) return 'every one of these went out wet.';
  if (name === 'services' || /^\/services\//.test(path)) return 'prices in pencil. the rest in ink.';
  if (name === 'about') return 'six people. one pen. this one.';
  if (name === 'contact') return 'sign here. in ink.';
  if (name === 'missing') return 'this page dried up.';
  if (/self-published/.test(path) || /self-published/.test(name)) return 'nobody briefed us. we inked it anyway.';
  if (/^\/brand/.test(path)) return 'the red is ours. the blue is yours. the black is type.';
  if (path === '/longhand') { const n = $$('.nt-list > li').length; return n ? n + ' mornings. none of them dry.' : null; }
  if (/^\/longhand\//.test(path) || /^longhand-/.test(name)) {
    const sp = $('.nt-meta span:nth-child(2)'), t = sp ? sp.textContent.trim() : '';
    const today = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const m = /^(\d{1,2}) (\w{3})/.exec(t);
    if (!t || t === today || !m) return 'written this morning. still wet.';
    return 'written ' + m[1] + ' ' + m[2].toLowerCase() + '. still wet.';
  }
  return null;
}

// ---------- 10. the services, glossed ----------
// one at a time, each service takes its own ink and the line underneath says what it is
function makeGloss(does) {
  const words = $$('.w', does).map(w => {
    const gl = GLOSS[w.textContent.trim().toLowerCase()];
    if (!gl) return null;
    w.style.setProperty('--g-wash', gl[1]); w.style.setProperty('--g-gink', gl[2]);
    const sp = keep(mk('span', 'g-gloss', gl[0])); sp.setAttribute('aria-hidden', 'true'); sp.dataset.g = 'gloss';
    w.append(sp);
    return w;
  }).filter(Boolean);
  does.classList.add('g-glossed');
  return { does, words };
}
async function actGloss(G) {
  for (const w of G.words) { w.classList.add('g-lit'); await hold(260); }
  await hold(320);
}
function glossFinal(G) { G.words.forEach(w => w.classList.add('g-lit')); }

// ---------- 11. acts ----------
function jobPush(job) {
  if (S.jobs.indexOf(job) >= 0 || job.state === 'done' || job.state === 'final') return;
  job.state = 'wait'; job.at = performance.now(); S.jobs.push(job);
  if (job.deadline) job.tid = later(job.deadline, () => { if (job.state === 'wait') jobFinal(job); });
  if (job.ready) later(1300, kick);
  kick();
}
function jobFinal(job) {
  if (job.state === 'done' || job.state === 'final') return;
  job.state = 'final'; const i = S.jobs.indexOf(job); if (i >= 0) S.jobs.splice(i, 1);
  safe(() => job.final && job.final());
}
function kick() { const k = S.kickRes; S.kickRes = null; if (k) k(); }
const nextKick = () => new Promise(res => { S.kickRes = res; });
function pick() {
  const w = S.jobs.filter(j => j.state === 'wait' && (!j.ready || j.ready()));
  if (!w.length) return null;
  w.sort((a, b) => (b.prio - a.prio) || (a.order - b.order));
  const j = w[0];
  if (j.note) { let d = 0; w.forEach(o => { if (o !== j && o.note) { o.stagger = d; d += 120; jobFinal(o); } }); }
  S.jobs.splice(S.jobs.indexOf(j), 1);
  return j;
}
function noteJob(el, order) {
  return { prio: 50, order, note: true, el, deadline: 1600, stagger: 0,
    run: async () => { await inkWrite(geom(el)); },
    final: function () { quick(el, this.stagger || 0); } };
}
// the IntersectionObserver that triggers acts as the reader arrives
function watch(el, ratio, job) {
  if (!el) return;
  S.watch.set(el, { ratio, job, seen: false });
  S.io.observe(el);
}
function onIO(es) {
  for (const en of es) {
    const w = S.watch.get(en.target); if (!w) continue;
    const j = w.job;
    if (en.isIntersecting && en.intersectionRatio >= w.ratio - .02) {
      if (j.state == null) jobPush(j);
    } else if (!en.isIntersecting && j.state === 'run') j.abort = true;   // left mid act: it lands on its last frame
    else if (!en.isIntersecting && j.state === 'wait') jobFinal(j);       // left before its turn: it appears finished
    else if (en.isIntersecting && j.state == null && j.note && !w.t) {
      w.t = later(2200, () => { if (j.state == null) jobFinal(j); });
    }
    if (j.state === 'done' || j.state === 'final' || j.abort) { S.io.unobserve(en.target); S.watch.delete(en.target); }
  }
}

// Act 2. Same edit, by hand
function heroRecs(H, host) {
  const { strike, co, name } = H, fsN = parseFloat(getComputedStyle(name).fontSize), out = {};
  if (strike) {   // the site's own strike geometry, by hand: a slight bow, a heavy start, a flick off the end
    const sb = host.rel(strike), t = max(3, .06 * fsN);
    const P0 = [sb.x - .05 * sb.w, sb.y + .55 * sb.h + t / 2], ang = -4 * PI / 180, len = 1.10 * sb.w * 1.06, line = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60, bow = sin(PI * u) * .015 * len; line.push([P0[0] + cos(ang) * len * u - sin(ang) * bow, P0[1] + sin(ang) * len * u + cos(ang) * bow]); }
    const st = dynamics(resample(line, 1.2), { vref: 900, kref: 1 / 40, k0: 1 / 400, vmin: 400, vmax: 1600, wmin: 1.6, wmax: 1.2 * t,
      prof: u => u < .85 ? 1.9 - .5 * u : max(.15, 1.45 - (u - .85) / .15 * 1.3), zf: u => u > .92 ? (u - .92) / .08 * 6 : 0 });
    const sc = 180 / (st[st.length - 1].t || 1); st.forEach(q => { q.t *= sc; });
    out.strike = { kind: 'line', ink: 'r', over: true, S: st, pools: [[st[0].x, st[0].y, .5 * st[0].w * (1 + .9 * sqrt(70 / 120))]], anchor: { el: strike, b: sb } };
  }
  if (co) {   // the site's own ring around "Co.", mapped like its svg
    const cb = host.rel(co), Wc = cb.w, Hc = cb.h, X = x => cb.x - .14 * Wc + x * 1.28 * Wc / 120, Y = y => cb.y - .10 * Hc + y * 1.22 * Hc / 70, k = fsN / 96.8;
    let pts = [];
    [[[64, 5], [100, 3], [117, 20], [115, 38]], [[115, 38], [113, 58], [86, 67], [57, 65]], [[57, 65], [25, 63], [5, 51], [6, 34]], [[6, 34], [7, 16], [31, 5], [60, 6]]]
      .forEach(q => { pts = pts.concat(cubic.apply(null, q.map(v => [X(v[0]), Y(v[1])]).concat([40])).slice(pts.length ? 1 : 0)); });
    const ring = dynamics(resample(pts, 1.2), { vref: 520, kref: 1 / 40, k0: 1 / 400, vmin: 120, vmax: 1100, wmin: max(1.2, 1.6 * k), wmax: 4.4 * k,
      prof: u => u > .88 ? max(.1, 1 - (u - .88) / .12) : 1, zf: u => u > .9 ? (u - .9) / .1 * 5 : 0 });
    out.ring = { kind: 'line', ink: 'r', S: ring, pools: [[ring[0].x, ring[0].y, max(1.4, 2.4 * k)]], anchor: { el: co, b: cb } };
  }
  return out;
}
async function actHero(H) {
  const { hero, txt, strike, ins } = H, host = getHost(txt);
  if (!R.classList.contains('hero-wait') && !hero.classList.contains('g-taken')) {   // the CSS edits are handed back to the pen
    if (strike) strike.classList.add('g-unstruck');
    const a = ins && anim(ins, [{ clipPath: 'inset(-40% 0 -40% 0)' }, { clipPath: 'inset(-40% 0 -40% 100%)' }], { duration: 200, delay: 60, fill: 'forwards', easing: 'ease-in' });
    hero.classList.add('g-giving');
    await hold(380);
    if (ins) ins.classList.add('g-pend');
    if (a) a.cancel();
  }
  hero.classList.add('g-taken');
  const recs = heroRecs(H, host), toH = (x, y) => { const o = host.org(); return { x: o.x + x, y: o.y + y }; };
  const unstrike = () => { if (strike) strike.classList.remove('g-unstruck'); R.classList.remove('hero-wait'); };
  if (recs.strike) {   // the strike, on the over canvas: bad copy takes ink
    const st = recs.strike.S, pool0 = recs.strike.pools[0][2];
    await fly(() => toH(st[0].x, st[0].y), { a: -40, s: sw() });
    const lv = live(host, recs.strike);
    await tween(70, u => { lv.draw(1, pool0 * (.55 + .45 * sqrt(u))); P.p = .9; P.dirty = true; });
    let greyed = false;
    await follow(st, toH, i => { lv.draw(i + 1); if (!greyed && i > st.length / 2) { greyed = true; unstrike(); } });
    lv.done();
  }
  unstrike();
  if (ins) await write(geom(ins, true), { lift: 9 });   // "Cheesy", written into the real element
  if (recs.ring) {
    const ring = recs.ring.S;
    await fly(() => toH(ring[0].x, ring[0].y), { a: -40, s: sw(), lift: 10 });
    const lr = live(host, recs.ring);
    await follow(ring, toH, i => lr.draw(i + 1));
    lr.done();
  }
  // the hero's other notes ink in, one by one; the pencil note is graphite and never pen written
  $$('.hero .note.hn').forEach((n, i) => { if (!n.classList.contains('inked')) later(i * 140, () => n.classList.add('inked')); });
  if (H.note) await write(geom(H.note));
}
function heroFinal(H) {   // the finished state, at once
  const { hero, txt, ins } = H, host = getHost(txt), recs = heroRecs(H, host);
  hero.classList.add('g-taken'); if (H.strike) H.strike.classList.remove('g-unstruck'); R.classList.remove('hero-wait');
  if (recs.strike) host.bake(recs.strike);
  if (recs.ring) host.bake(recs.ring);
  if (ins) { ins.classList.remove('g-pend'); ins.classList.add('inked', 'g-dry'); }
  $$('.hero .note.hn').forEach(n => n.classList.add('inked'));
  if (H.note) { H.note.classList.remove('g-pend'); H.note.classList.add('inked', 'g-dry'); }
}

// Act 4. The pen runs dry, writing "pick one. or all six."
function glyphRec(g, host, c, mode, Rv, seed) {
  // draws a degraded glyph exactly where the hidden DOM glyph sits, in the note's own rotated frame
  const o = host.org(), p0 = g.f.toClient(0, 0), px = g.f.toClient(1, 0), py = g.f.toClient(0, 1);
  const M = [px.x - p0.x, px.y - p0.y, py.x - p0.x, py.y - p0.y, p0.x - o.x, p0.y - o.y];
  const font = g.m.font, fs = g.fs, r = rng(seed);
  const box = { x: M[4] + c.x - 4, y: M[5] + c.base - fs * 1.1, w: c.w + 10, h: fs * 1.6 };
  return { kind: 'fn', ox: 0, oy: 0, box, anchor: { el: g.el, b: host.rel(g.el), t: true }, dry(s) {
    s.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    s.font = font; s.lineJoin = 'round';
    if (mode === 'blind') {
      s.fillStyle = 'rgba(70,58,46,.16)'; s.fillText(c.ch, c.x + .5, c.base + .6);
      s.fillStyle = 'rgba(255,255,255,.95)'; s.fillText(c.ch, c.x - .4, c.base - .5);
      return;
    }
    if (mode === 'scratch') {
      for (const off of [0, 3.2]) {
        const zz = [];
        for (let i = 0; i <= 6; i++) zz.push([c.x + i / 6 * 8 + off * .3, c.base - .5 * g.xh + (i % 2 ? -1.5 : 1.5) + off]);
        for (const [col, dx, dy] of [['rgba(70,58,46,.32)', .5, .6], ['rgba(255,255,255,.95)', -.4, -.5]]) { s.strokeStyle = col; s.lineWidth = 1; s.beginPath(); zz.forEach((q, i) => i ? s.lineTo(q[0] + dx, q[1] + dy) : s.moveTo(q[0] + dx, q[1] + dy)); s.stroke(); }
      }
      return;
    }
    // railroad: the two rails of every stroke of the letter; skip: rails that break on the paper's tooth
    s.strokeStyle = INK.r.dry; s.lineWidth = .8; s.strokeText(c.ch, c.x, c.base);
    s.globalAlpha = .22; s.fillStyle = INK.r.dry; s.fillText(c.ch, c.x, c.base); s.globalAlpha = 1;
    if (mode === 'skip') {
      s.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 26; i++) { s.beginPath(); s.arc(c.x + r() * c.w, c.base - r() * fs * .8, .8 + r() * 1.6 * (1 - Rv / .15), 0, 6.2832); s.fill(); }
      s.globalCompositeOperation = 'source-over';
      if (c.ch === 'i') { // the dot goes blind
        s.fillStyle = '#FBFBF9'; s.beginPath(); s.arc(c.x + c.w * .55, c.base - g.xh * 1.45, fs * .09, 0, 6.2832); s.fill();
        s.fillStyle = 'rgba(70,58,46,.18)'; s.beginPath(); s.arc(c.x + c.w * .55 + .5, c.base - g.xh * 1.45 + .6, fs * .06, 0, 6.2832); s.fill();
      }
    }
  } };
}
// Act 7. The arrival on every other page: a wavy underline under the heading, then the page note
function lineRects(el) {
  const rg = D.createRange(); rg.selectNodeContents(el);
  const rows = [];
  Array.from(rg.getClientRects()).forEach(r => {
    if (r.width < 6 || r.height < 6) return;
    const row = rows.find(o => abs(o.top - r.top) < r.height * .6);
    if (row) { row.left = min(row.left, r.left); row.right = max(row.right, r.right); }
    else rows.push({ top: r.top, left: r.left, right: r.right, height: r.height });
  });
  return rows.sort((a, b) => a.top - b.top);
}
function underlines(h1) {
  const host = getHost(h1), o = host.org(), m = metrics(getComputedStyle(h1)), fs = m.fs;
  const A = max(1.4, .032 * fs), lam = max(14, .36 * fs);
  const hb = host.rel(h1);
  return lineRects(h1).map((ln, li) => {
    const b = ln.top - o.y + m.A, x0 = ln.left - o.x - .02 * fs, x1 = ln.right - o.x + .04 * fs, pts = [];
    for (let x = x0; x <= x1; x += 1.2) pts.push([x, b + .14 * fs + A * sin(2 * PI * (x - x0) / lam)]);
    const Tl = clamp((x1 - x0) / 700, .35, .9) * 1000, n = pts.length;
    const S2 = pts.map((q, i) => {
      const u = i / (n - 1), p = clamp(.55 + .25 * sin(2 * PI * (q[0] - x0) / lam + PI / 2), .1, 1) * (u > .9 ? 1 - (u - .9) / .1 * .7 : 1);
      return { x: q[0], y: q[1], w: max(1, .012 * fs) + (max(2.4, .045 * fs) - max(1, .012 * fs)) * pow(p, 1.3), p, t: eio(u) * Tl, z: u > .94 ? (u - .94) / .06 * 4 : 0 };
    });
    return { kind: 'line', ink: 'r', S: S2, pools: [[S2[0].x, S2[0].y, S2[0].w * .7]], anchor: { el: h1, b: hb }, li };
  });
}
async function actArrive(A) {
  if (A.h1) {
    const host = getHost(A.h1), toH = (x, y) => { const o = host.org(); return { x: o.x + x, y: o.y + y }; };
    for (const rec of underlines(A.h1)) {
      await fly(() => toH(rec.S[0].x, rec.S[0].y), { a: -40, s: sw(), lift: rec.li ? 8 : undefined });
      const lv = live(host, rec);
      await tween(60, u => lv.draw(1, rec.pools[0][2] * (.5 + .5 * u)));
      await follow(rec.S, toH, i => lv.draw(i + 1));
      lv.done();
    }
  }
  if (A.note) await write(geom(A.note));
}
function arriveFinal(A) {
  if (A.h1) { const host = getHost(A.h1); underlines(A.h1).forEach(r => host.bake(r)); }
  if (A.note) { A.note.classList.remove('g-pend'); A.note.classList.add('inked', 'g-dry'); }
}

// ---------- 12. the visitor's pencil, and an eraser ----------
const PAPER = 'body,main,.page,.book,.sec,.row,.hero,.hero-txt,.page-head,.note-stack,.does-foot,.foot,.foot-in,.sec-head,.wide';
function isPaper(t) {
  if (!t || t.nodeType !== 1 || t.closest('.top,.dock,#intro,.toast,a,button,input,textarea,select,label,.slot,.machine,.rw-before,canvas')) return false;
  if (t.matches(PAPER)) return true;
  return t.tagName === 'DIV' && !t.className && !!t.parentElement && t.parentElement.classList.contains('row');
}
const CONTROLS = '.top,.dock,.g-tray,#intro,.toast,a,button,input,textarea,select,label,.slot,.machine,.rw-before';
// once a finger has picked a tool up it may draw over links and words too; only real controls stay out of reach
const TOUCH_CONTROLS = '.top,.dock,.g-tray,#intro,.toast,button,input,textarea,select,label,.slot,.machine,.rw-before';
const SVGNS = 'http://www.w3.org/2000/svg';
// the tray's pencil is the site's own pencil, the same drawing as the cursor
const PENCIL = '<polygon points="5,-2 10,-4.5 10,4.5 5,2" fill="#EACDA3"/><polygon points="0,0 5,-2 5,2" fill="#2B2B2B"/><rect x="10" y="-4.5" width="20" height="9" fill="#F2C230"/><rect x="30" y="-4.5" width="3" height="9" fill="#BDBBB4"/><rect x="33" y="-4.5" width="5" height="9" rx="1.5" fill="#F0A3A3"/>';
const PENCIL_ART = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g transform="translate(4 28) rotate(-45)" stroke="#16161A" stroke-width="1" stroke-linejoin="round">' + PENCIL + '</g></svg>';
// a block eraser, rubber end down, so the two buttons can't be mistaken for each other
const ERASER_ART = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g transform="rotate(-38 16 16)" stroke="#16161A" stroke-width="1" stroke-linejoin="round"><rect x="4.5" y="11" width="23" height="10" rx="2.2" fill="#F0A3A3"/><path d="M14 11h11.3a2.2 2.2 0 0 1 2.2 2.2v5.6a2.2 2.2 0 0 1-2.2 2.2H14z" fill="#E9E6DF"/></g><path d="M5.5 27.5h12" stroke="#16161A" stroke-width="1.2" stroke-linecap="round" opacity=".55"/></svg>';
function pathOf(pts) {
  const q = n => round(n * 10) / 10;
  if (pts.length === 1) return 'M' + q(pts[0].x) + ' ' + q(pts[0].y) + 'l.01 0';
  let d = 'M' + q(pts[0].x) + ' ' + q(pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) d += 'Q' + q(pts[i].x) + ' ' + q(pts[i].y) + ' ' + q((pts[i].x + pts[i + 1].x) / 2) + ' ' + q((pts[i].y + pts[i + 1].y) / 2);
  const z = pts[pts.length - 1];
  return d + 'L' + q(z.x) + ' ' + q(z.y);
}
function boxOf(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = min(x0, p.x); y0 = min(y0, p.y); x1 = max(x1, p.x); y1 = max(y1, p.y); }
  return { x0, y0, x1, y1 };
}
function nibOn(hint) {
  if (S.nib || !S.main) return;
  const coarse = matchMedia('(pointer:coarse)').matches;
  // the marks live in one drawing laid over the page: they scroll with it, stay sharp at any zoom,
  // and stay put when God mode is switched off, so coming back gives you the eraser for them again
  let svg = D.getElementById('g-doodles');
  if (!svg) {
    svg = D.createElementNS(SVGNS, 'svg'); svg.id = 'g-doodles'; svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:35');
    svg._strokes = []; D.body.append(svg);
  }
  // with a mouse the pencil is always in hand; on a phone the page scrolls until you pick a tool up
  const N = S.nib = { tool: coarse ? null : 'pencil', coarse, svg, strokes: svg._strokes, cur: null, full: false };
  R.classList.add('g-nib');
  const tray = keep(frag('<div class="g-tray" role="toolbar" aria-label="Pencil and eraser">'
    + '<button type="button" class="g-tool" data-tool="pencil" aria-pressed="false" aria-label="Pencil" title="Pencil">' + PENCIL_ART + '</button>'
    + '<button type="button" class="g-tool" data-tool="eraser" aria-pressed="false" aria-label="Eraser" title="Eraser">' + ERASER_ART + '</button></div>'));
  tray.dataset.g = 'tray';
  D.body.append(tray);
  const rest = coarse ? null : 'pencil';
  const set = tool => {
    N.tool = tool;
    tray.querySelectorAll('.g-tool').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    R.classList.toggle('g-erase', tool === 'eraser');
    R.classList.toggle('g-armed', coarse && !!tool);
  };
  set(N.tool);
  listen(tray, 'click', e => { const b = e.target.closest('.g-tool'); if (b) set(N.tool === b.dataset.tool ? rest : b.dataset.tool); });
  listen(D, 'keydown', e => { if (e.key === 'Escape' && N.tool !== rest) set(rest); });
  const full = () => { if (!N.full) { N.full = true; O.toast(COPY.full); } };
  const at = e => { const b = svg.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const mkPath = pts => {
    const el = D.createElementNS(SVGNS, 'path');
    el.setAttribute('d', pathOf(pts));
    el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#47464C'); el.setAttribute('stroke-width', '1.7');
    el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('opacity', '.9');
    svg.append(el); return el;
  };
  // the eraser takes out every point within reach, and splits a line where it passes through
  const REACH = 13;
  const rub = (x, y) => {
    for (let k = N.strokes.length - 1; k >= 0; k--) {
      const st = N.strokes[k], b = st.box;
      if (x < b.x0 - REACH || x > b.x1 + REACH || y < b.y0 - REACH || y > b.y1 + REACH) continue;
      const runs = []; let run = [], hit = false;
      for (const q of st.pts) {
        if (hypot(q.x - x, q.y - y) <= REACH) { hit = true; if (run.length) { runs.push(run); run = []; } }
        else run.push(q);
      }
      if (!hit) continue;
      if (run.length) runs.push(run);
      st.el.remove(); N.strokes.splice(k, 1);
      for (const r of runs) if (r.length > 1) N.strokes.push({ pts: r, box: boxOf(r), el: mkPath(r) });
    }
    if (N.full && N.strokes.length < CAPS.strokes) N.full = false;
  };
  let last = null;   // so a fast swipe still rubs out everything between two events
  const rubTo = q => {
    if (last) { const k = ceil(hypot(q.x - last.x, q.y - last.y) / (REACH * .5)); for (let i = 1; i <= k; i++) rub(lerp(last.x, q.x, i / k), lerp(last.y, q.y, i / k)); }
    else rub(q.x, q.y);
    last = q;
  };
  const draw = () => {
    const st = N.cur; if (!st || st.erase) return false;
    if (st.dirty) { st.dirty = false; st.el.setAttribute('d', pathOf(st.pts)); }
    return true;
  };
  const add = (st, e) => {
    const q = at(e), z = st.pts[st.pts.length - 1];
    if (z && hypot(q.x - z.x, q.y - z.y) < .75) return;
    st.pts.push(q); st.dirty = true;
  };
  let swallow = 0;   // on a phone, a line drawn across a link must not open it when the finger lifts
  const end = e => {
    const st = N.cur; if (!st || e.pointerId !== st.id) return;
    N.cur = null; last = null;
    if (coarse && (st.erase || st.pts.length > 2)) swallow = performance.now();
    if (st.erase) return;
    st.el.setAttribute('d', pathOf(st.pts));
    N.strokes.push({ pts: st.pts, box: boxOf(st.pts), el: st.el });
  };
  listen(D, 'pointerdown', e => {
    if (!S || S.leaving || !N.tool || N.cur || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = e.target;
    if (!t.closest || t.closest(coarse ? TOUCH_CONTROLS : CONTROLS) || $('.top.open')) return;
    // with a mouse the pencil writes on blank paper and selects words, so the yellow highlight still works
    if (N.tool === 'pencil' && !coarse && !isPaper(t)) return;
    e.preventDefault();
    if (N.tool === 'eraser') { last = null; N.cur = { erase: true, id: e.pointerId }; rubTo(at(e)); return; }
    if (N.strokes.length >= CAPS.strokes) { full(); return; }
    const st = { id: e.pointerId, pts: [], dirty: true };
    add(st, e); st.el = mkPath(st.pts);
    N.cur = st; every(draw);
  }, { passive: false });
  listen(D, 'pointermove', e => {
    const st = N.cur; if (!st || e.pointerId !== st.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null, list = evs && evs.length ? evs : [e];
    if (st.erase) { list.forEach(ev => rubTo(at(ev))); return; }
    list.forEach(ev => add(st, ev));
    if (st.pts.length >= CAPS.pts) end(e);
    wake();
  }, { passive: true });
  listen(D, 'pointerup', end, { passive: true });
  listen(D, 'pointercancel', end, { passive: true });
  // only the one click the stroke itself makes, and never one aimed at the bar, the tray or the comments
  listen(D, 'click', e => {
    if (!swallow || performance.now() - swallow > 400) return;
    swallow = 0;
    if (e.target.closest && e.target.closest('.top,.g-tray,.dock')) return;
    e.preventDefault(); e.stopPropagation();
  }, { capture: true });
  if (hint) O.toast(coarse ? COPY.nibHintTouch : COPY.nibHint);
}

// ---------- 13. mount, director, exit ----------
function detect() {
  const pg = $('.page'), name = pg ? pg.dataset.page : '';
  return { home: name === 'home' || !!$('.hero .name'), name };
}
function pendNotes() {
  const skip = '.pencil,.hn,.g-note,.clients .note,.slot';
  const list = [];
  $$('.page .note').forEach(n => {
    if (n.matches(skip) || n.closest('[hidden]') || n.closest('.clients')) return;
    if (!R.classList.contains('ink') || n.classList.contains('inked')) return;
    list.push(n);
  });
  return list;
}
function mount() {
  const s = S, reduce = O.reduce;
  R.classList.add('g-on'); if (reduce) R.classList.add('g-reduce');
  s.page = detect();
  const top = $('.top'); s.barB = top ? top.getBoundingClientRect().bottom : 0;
  // the pen layer
  const layer = mk('div'); layer.id = 'g-pen-layer'; layer.dataset.g = 'pen'; layer.setAttribute('aria-hidden', 'true');
  const sh = shadowSprite(); sh.hidden = true;
  const pen = frag('<svg id="g-pen" width="196" height="40" viewBox="-6 -20 196 40" overflow="visible" focusable="false" hidden>' + grads('gp') + penParts('gp', true) + '</svg>');
  layer.append(sh, pen); D.body.append(layer); keep(layer);
  Object.assign(P, { el: pen, sh, inkEl: $('.gp-ink', pen), out: false, state: 'well', x: 0, y: 0, z: 0, p: 0 });
  penInk(1);
  // the inkwell: arriving or still, the cap is already docked
  const arrived = !O.animate;
  mountWell(arrived ? .78 : .30, arrived);
  // observers and listeners
  s.io = new IntersectionObserver(onIO, { threshold: [0, .25, .3, .5, .6, .75, .98, 1], rootMargin: '0px 0px -12% 0px' });
  s.obs.push(s.io);
  if ('ResizeObserver' in W) {
    let first = true;
    s.ro = new ResizeObserver(() => { if (first) { first = false; return; } every(() => { if (S === s) for (const h of s.hosts) safe(() => h.reraster()); return false; }); });
    s.obs.push(s.ro);
  }
  listen(W, 'scroll', () => {
    const now = performance.now(), y = scrollY, dt = max(8, now - s.vt);
    s.vs = lerp(s.vs, (y - s.vy) / dt * 1000, .35); s.vy = y; s.vt = now;
  }, { passive: true });
  listen(W, 'resize', () => { s.barB = top ? top.getBoundingClientRect().bottom : 0; P.dirty = true; wake(); }, { passive: true });
  listen(D, 'visibilitychange', () => setHidden(D.visibilityState === 'hidden'));
  listen(W, 'pagehide', () => setHidden(true));
  listen(W, 'pageshow', e => { setHidden(D.visibilityState === 'hidden'); if (e.persisted) { restores++; if (s.leaving) resume(); } });
  s.main = getHost($('#main') || D.body, true);
  // God only notes and the page as the pen will perform it
  if (s.page.home) {
    const hero = $('.hero'), name = $('.hero .name');
    if (hero && name) {
      const H = s.hero = { hero, name, txt: $('.hero-txt', hero) || name.parentElement, strike: $('.strike', hero), ins: $('.ins', hero), co: $('.co', hero) };
      const stack = $('.row > .note-stack', hero);
      if (stack) H.note = stack.appendChild(godNote(COPY.hero, 'hero'));
      if (R.classList.contains('hero-wait')) { hero.classList.add('g-taken'); if (H.strike) H.strike.classList.add('g-unstruck'); if (H.ins) H.ins.classList.add('g-pend'); }
    }
    const does = $('#does');
    if (does && $$('.w', does).length > 1) s.gloss = makeGloss(does);
    const cst = $('#contents .sec-head .note-stack') || $('#contents .note-stack');
    if (cst) s.turn = intoStack(cst, godNote(COPY.turn, 'turn'));
  } else {
    const h1 = $('.page-head h1[data-reveal]') || $('.page-head .h1') || $('main h1');
    let stack = $('.page-head > .note-stack');
    if (!stack) {
      const ph = $('.page-head') || (h1 && h1.closest('.row'));
      const lone = ph ? $(':scope > .note', ph) || $('.row > .note') : $('.row > .note');
      if (lone) { stack = mk('div', 'note-stack g-made'); stack.dataset.g = 'stack'; lone.before(stack); stack.append(lone); s.unwrap = { stack, lone }; }
      else if (ph) stack = madeStack(ph);
    }
    const text = pageNoteText();
    s.arrive = { h1, note: text && stack ? intoStack(stack, godNote(text, 'page')) : null };
  }
  s.pending = pendNotes();
  s.pending.forEach(n => n.classList.add('g-pend'));
}
function setHidden(h) {
  L.hidden = h;
  if (!S) return;
  if (h) { if (L.id) cancelAnimationFrame(L.id); L.id = 0; L.last = 0; S.anims.forEach(a => { try { a.pause(); } catch (e) {} }); }
  else { S.anims.forEach(a => { try { if (a.playState === 'paused') a.play(); } catch (e) {} }); wake(); }
}
function resume() {   // back from the bfcache after a navigation: the pen is home, the page as left
  const s = S; s.leaving = false;
  if (P.el) { P.el.getAnimations().forEach(a => a.cancel()); P.el.classList.remove('g-out'); }
  penShow(false); WL.penVis = true; setPose(wellPose('rest')); WL.dirty = true; wake();
  gen++; startDirector();
}
function registerJobs() {
  const s = S, reduce = O.reduce;
  let order = 0;
  if (s.page.home) {
    if (s.hero) {
      const H = s.hero;
      if (reduce) heroFinal(H);
      else { const j = { prio: 100, order: order++, pen: true, run: () => actHero(H), final: () => heroFinal(H) }; s.heroJob = j; watch(H.hero, .3, j); }
    }
    if (s.gloss) {
      const G = s.gloss;
      if (reduce) glossFinal(G);
      else watch(G.does, .5, s.glossJob = { prio: 80, order: order++, run: () => actGloss(G), final: () => glossFinal(G) });
    }
    if (s.turn) {
      const tn = s.turn, sess = ss.get('god:v1:session') || {};
      if (reduce) { tn.classList.remove('g-pend'); tn.classList.add('inked', 'g-dry'); nibOn(false); }
      else {
        const grant = () => { ss.set('god:v1:session', Object.assign(ss.get('god:v1:session') || {}, { nib: 1 })); nibOn(!sess.nib); };
        const gj = s.glossJob;
        watch(tn.closest('.note-stack') || tn, .6, { prio: 70, order: order++, ready: () => !gj || gj.state == null || gj.state === 'done' || gj.state === 'final',
          run: async () => { await inkWrite(geom(tn)); grant(); }, final: () => { quick(tn); grant(); } });
        if (sess.nib) nibOn(false);
      }
    } else nibOn(false);
  } else {
    if (reduce) arriveFinal(s.arrive);
    else {
      const j = { prio: 100, order: order++, pen: true, run: () => actArrive(s.arrive), final: () => arriveFinal(s.arrive) };
      jobPush(j);
      if (s.arrive.h1) watch(s.arrive.h1, 0, j);   // watched only so that scrolling away from it finishes it
    }
    nibOn(false);
  }
  s.pending.forEach(n => {
    if (reduce) { n.classList.remove('g-pend'); n.classList.add('inked'); return; }
    const tall = n.getBoundingClientRect().height > .4 * innerHeight;
    watch(n, tall ? .6 : 1, noteJob(n, order++));
  });
}
async function director() {
  const g = gen;
  try {
    while (g === gen) {
      const job = pick();
      if (job) {
        job.state = 'run'; if (job.tid) { clearTimeout(job.tid); S.timers.delete(job.tid); }
        S.cur = job;
        try {
          if (job.pen && !P.out) await rise();   // only the opening act is performed with the pen
          await job.run();
          if (job.pen) await goHome();            // then it goes back in the well, and stays there
          job.state = 'done';
        }
        catch (e) { if (e === CANCEL) throw e; errors++; job.state = 'done'; safe(() => job.final && job.final()); }
        finally { if (S) S.cur = null; }
        continue;
      }
      if (P.out) { await goHome(); continue; }
      P.state = 'well';
      await nextKick();
    }
  } catch (e) { if (e !== CANCEL) errors++; }
}
function startDirector() {
  const g = gen;
  (async () => {
    try {
      await (D.fonts && D.fonts.ready ? Promise.race([D.fonts.ready, new Promise(r => later(1500, r))]) : null);
      if (g !== gen) return;
      registerJobs();
      director();
    } catch (e) { if (e !== CANCEL) errors++; }
  })();
}
function teardown() {
  const s = S; if (!s) return;
  if (L.id) cancelAnimationFrame(L.id); L.id = 0; L.last = 0; L.fns.clear();
  s.anims.forEach(a => { try { a.cancel(); } catch (e) {} }); s.anims.clear();
  s.timers.forEach(id => clearTimeout(id)); s.timers.clear();
  s.obs.forEach(o => { try { o.disconnect(); } catch (e) {} });
  s.offs.forEach(f => f()); s.offs.length = 0;
  if (s.unwrap && s.unwrap.stack.isConnected) { s.unwrap.stack.before(s.unwrap.lone); }
  s.nodes.forEach(n => n.remove()); s.nodes.length = 0;
  const cls = ['g-host', 'g-host-rel', 'g-pend', 'g-writing', 'g-wet', 'g-dry', 'g-quick', 'g-done', 'g-taken', 'g-unstruck', 'g-giving', 'g-glossed', 'g-lit'];
  $$('.' + cls.join(',.')).forEach(e => e.classList.remove.apply(e.classList, cls));
  $$('.note, .ins').forEach(e => { e.style.clipPath = ''; e.style.animationDelay = ''; });
  $$('#does .w').forEach(w => { w.style.removeProperty('--g-wash'); w.style.removeProperty('--g-gink'); });
  R.classList.remove('g-on', 'g-nib', 'g-reduce', 'g-exit', 'g-erase', 'g-armed');
  Object.assign(P, { el: null, sh: null, inkEl: null, out: false, dirty: false, state: 'well' });
  Object.assign(WL, { svg: null, wp: null, pen: null, cap: null, clip: null, inkg: null, rip: null, drop: null, dirty: false });
  S = null;
}

// ---------- 14. API ----------
async function enter(opts) {
  if (on) return;
  try {
    on = true; gen++; O = opts || {}; O.toast = O.toast || (() => {});
    if (O.reduce == null) O.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    tier = TIER0;
    const seed0 = ss.get('god:seed');
    S = { nodes: [], offs: [], obs: [], anims: new Set(), timers: new Set(), hosts: new Set(), wets: new Set(), jobs: [], watch: new Map(),
      m: 1, vs: 0, vy: scrollY, vt: 0, kickRes: null, cur: null, seed: seed0 != null ? seed0 : (random() * 1e9) | 0, leaving: false };
    mount();
    const g = gen;
    if (O.reduce) { O.toast(COPY.onReduce); startDirector(); return; }
    if (O.animate && WL.svg) {
      (async () => { try { await uncap(); if (g === gen) startDirector(); } catch (e) { if (e !== CANCEL) { errors++; if (g === gen) { handOut(); startDirector(); } } } })();
    } else { if (O.animate) O.toast(COPY.on); startDirector(); }
  } catch (e) { errors++; }
}
async function exit(opts) {
  if (!on || !S) { on = false; return; }
  on = false;
  const s = S, o = opts || {}, g = ++gen;
  try {
    R.classList.add('g-exit');
    s.leaving = true;
    s.jobs.length = 0; kick();
    if (s.io) s.io.disconnect();
    // the drying sweep, top first
    s.wets.forEach(c => { const r = c.getBoundingClientRect(); dryNow(c, 120, 280 * clamp(r.top / innerHeight, 0, 1)); });
    $$('.g-writing').forEach(el => { el.style.clipPath = ''; el.classList.remove('g-writing'); el.classList.add('inked'); });
    if (o.animate && !O.reduce && WL.svg) {
      s.m = 1;
      await recap(false);
      if (g !== gen) return;
      anim(WL.svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      anim(WL.wp, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      $$('.g-taken').forEach(e => e.classList.remove('g-taken'));
      await hold(300);
    }
  } catch (e) { if (e !== CANCEL) errors++; }
  if (S !== s) return;
  const heroWait = R.classList.contains('hero-wait');
  teardown();
  if (!heroWait) $$('.hn').forEach(n => n.classList.add('inked'));
  const sw0 = $('#modeSwitch');
  if (!(sw0 && sw0.dataset.mode === 'dry') && O && O.toast) O.toast(COPY.off);
}
function beforeLeave() {
  if (!on || !S) return;
  const s = S;
  try {
    s.leaving = true; gen++;
    s.jobs.forEach(j => { if (j.state === 'wait') jobFinal(j); });
    $$('.g-writing').forEach(el => { el.style.clipPath = ''; el.classList.remove('g-writing'); el.classList.add('inked'); });
    s.wets.forEach(c => dryNow(c, 200));
    if (P.out && P.el) { P.el.classList.add('g-out'); anim(P.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }); if (P.sh) P.sh.style.opacity = 0; }
  } catch (e) { errors++; }
}
function stats() {
  const s = S;
  return { version: '1', on, reduce: !!(O && O.reduce), tier, raf: !!L.id, rafs, loopFns: L.fns.size, frames: L.frames, p95: +f2(p95()), pen: P.state, out: P.out,
    queue: s ? s.jobs.filter(j => j.state === 'wait').length : 0, wet: s ? s.wets.size : 0, canvases: $$('canvas[data-g]').length,
    nodes: $$('[data-g]').length + $$('.g-cv,.g-wc,#g-pen-layer').length, timers: s ? s.timers.size : 0, anims: s ? s.anims.size : 0, listeners: s ? s.offs.length : 0,
    gloss: s && s.gloss ? s.gloss.words.filter(w => w.classList.contains('g-lit')).length : null, current: s && s.cur ? (s.cur.pen ? 'pen act' : s.cur.note ? 'note' : 'act') : null,
    visitor: s && s.nib ? { tool: s.nib.tool, strokes: s.nib.strokes.length } : null, restores, errors };
}
W.TDTC_GOD = { version: '1', enter, exit, beforeLeave, stats };
})();
