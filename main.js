import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = rng(21);
const IS_MOBILE = matchMedia('(max-width: 820px)').matches;
const BASE = 'https://discoverydental.com/';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const OPEN_H = 8.5, CLOSE_H = 19;

/* ───────── renderer / scene ───────── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -80, 160);
const world = new THREE.Group(); scene.add(world);

const hemi = new THREE.HemisphereLight(0xcfe7ff, 0xf1ead9, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3df, 3.0); sun.castShadow = true; scene.add(sun, sun.target);
sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; sun.shadow.radius = 4;
const moon = new THREE.DirectionalLight(0x8fb4ff, 0); moon.position.set(10, 16, -8); scene.add(moon);

/* ───────── helpers ───────── */
const matCache = new Map();
function M(hex, o = {}) {
  const k = hex + '|' + JSON.stringify(o); if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: .82, metalness: 0, ...o }); matCache.set(k, m); return m;
}
function box(parent, w, h, d, mat, x, y, z, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function slab(w, d, x, z, h, hex) { return box(world, w, h, d, M(hex), x, h / 2, z, false); }
function cyl(parent, rt, rb, h, seg, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

/* ───────── palette ───────── */
const C = { teal: 0x16b3a3, tealD: 0x0d7d73, white: 0xfbfbf9, cream: 0xf6f4ef, grass: 0xbfe3ae, grass2: 0xa9d996, pave: 0xdfe3e8, asph: 0xaab3c0, roof: 0x5e6d7a, glass: 0xa7d8ee, coral: 0xef6a54, gold: 0xf2b84b, blue: 0x3b5bdb, red: 0xe5483b, wood: 0xc99a62, trunk: 0x9c6b3f };
const glassMats = [], glowMats = [], lampBulbs = [];
const glassMat = () => { const m = new THREE.MeshStandardMaterial({ color: C.glass, roughness: .15, metalness: .1, emissive: 0xffd48a, emissiveIntensity: 0 }); glassMats.push(m); return m; };

/* ───────── island ───────── */
const island = new THREE.Group(); world.add(island);
box(island, 17, .6, 17, M(C.cream), 0, -.3, 0, false);
{
  const g = new THREE.CylinderGeometry(12.02, 4, 4.2, 4, 1); g.rotateY(Math.PI / 4);
  const m = new THREE.Mesh(g, M(0xb9c6cb)); m.position.y = -2.7; m.castShadow = false; island.add(m);
  const g2 = new THREE.CylinderGeometry(5.66, 1.4, 2.2, 4, 1); g2.rotateY(Math.PI / 4);
  const m2 = new THREE.Mesh(g2, M(C.teal)); m2.position.y = -5.9; island.add(m2);
}
slab(16.4, 16.4, 0, 0, .1, C.grass);
slab(7.6, 5.2, -1.7, -.35 + .0, .1, C.grass);      // base under paving (keeps seams clean)
slab(5.8, 2.1, -1.5, -.15, .14, C.pave);            // plaza in front of clinic
slab(.9, 4.2, -1.5, 2.1, .14, C.pave);              // path to road
slab(5.4, 3.0, -5.0, 2.2, .14, 0xcfd5de);           // parking lot
slab(17, 1, 0, 4.1, .12, C.pave);                   // sidewalk
slab(17, 2.9, 0, 5.85, .12, C.asph);                // road
slab(3.0, 3.0, 4.0, 1.7, .14, 0xf4dcd7);            // emergency bay
slab(2.6, 5.2, 6.6, -2.4, .1, C.grass2);            // right lawn
slab(3.2, 6.4, -6.5, -2.6, .1, C.grass2);           // kids lawn
for (let i = -8; i <= 8; i += 1.6) box(world, .8, .02, .12, M(0xf5f7fa), i, .13, 5.85, false);
for (let i = 0; i < 6; i++) box(world, .08, .02, 2.2, M(0xf8f8f8), -7.2 + i * 1.05, .15, 2.2, false);
const SLOTS = [-6.5, -5.45, -4.4, -3.35];

/* ───────── clinic building ───────── */
const clinic = new THREE.Group(); world.add(clinic);
const BX = -1.5, BZ = -3.3, BW = 7, BD = 4, BH = 3.5, FZ = BZ + BD / 2; // front face z = -1.3
box(clinic, BW, BH, BD, M(C.white), BX, BH / 2, BZ);
box(clinic, BW + .3, .22, BD + .3, M(C.roof), BX, BH + .11, BZ);               // roof slab
box(clinic, BW + .02, .3, BD + .02, M(C.teal), BX, 3.0, BZ, false);               // teal band
box(clinic, 2.4, .09, 1.2, M(C.tealD), BX, 1.9, FZ + .6);                         // awning
box(clinic, .1, 1.9, .1, M(C.white), BX - 1.1, .95, FZ + 1.1); box(clinic, .1, 1.9, .1, M(C.white), BX + 1.1, .95, FZ + 1.1);
function windowAt(x, y, w, h) { box(clinic, w + .16, h + .16, .06, M(C.white), x, y, FZ + .0); box(clinic, w, h, .06, glassMat(), x, y, FZ + .04, false); box(clinic, .05, h, .07, M(C.white), x, y, FZ + .07, false); }
[-4.2, -3.0, .2, 1.2].forEach(x => windowAt(x, 1.05, .9, 1.25));
[-4.3, 1.1].forEach(x => windowAt(x, 2.45, .95, .8));
box(clinic, 1.05, 1.75, .07, glassMat(), BX, .88, FZ + .04, false); box(clinic, .06, 1.75, .08, M(C.white), BX, .88, FZ + .06, false);
// rooftop gear
box(clinic, 1.2, .5, .9, M(0xe3e8ec), BX + 2.3, BH + .47, BZ + .6); cyl(clinic, .25, .25, .12, 12, M(0x8896a3), BX + 2.3, BH + .78, BZ + .6);
for (let i = 0; i < 4; i++) { const p = box(clinic, .8, .06, 1.1, M(0x2c3e8f, { metalness: .3, roughness: .35 }), BX - 2.9 + i * .9, BH + .32, BZ - 1.1); p.rotation.x = -.3; }
// sign
const signTex = canvasTex(1024, 200, (g, w, h) => {
  g.fillStyle = '#0d7d73'; g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
  g.fillStyle = '#fff'; g.font = '700 84px Georgia,serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('Discovery', 190, 78); g.fillStyle = '#9ff5ea'; g.font = 'italic 700 84px Georgia,serif'; g.fillText('Dental', 640, 78);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '500 28px Arial,sans-serif'; g.fillText('AJAX · FAMILY & EMERGENCY CARE', 192, 152);
  g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineJoin = 'round'; g.beginPath(); g.moveTo(100, 40); g.bezierCurveTo(70, 40, 62, 55, 52, 55); g.bezierCurveTo(30, 55, 22, 85, 34, 110); g.bezierCurveTo(46, 138, 46, 170, 62, 170); g.bezierCurveTo(78, 170, 78, 130, 100, 130); g.bezierCurveTo(122, 130, 122, 170, 138, 170); g.bezierCurveTo(154, 170, 154, 138, 166, 110); g.bezierCurveTo(178, 85, 170, 55, 148, 55); g.bezierCurveTo(138, 55, 130, 40, 100, 40); g.stroke();
});
const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: .6 });
const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.0, .78), signMat); sign.position.set(BX, 2.5, FZ + .04); clinic.add(sign);
// open/closed board
const mkBoard = (txt, col) => canvasTex(256, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 62px Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); });
const TEX_OPEN = mkBoard('OPEN', '#16b3a3'), TEX_CLOSED = mkBoard('CLOSED', '#e5483b');
const boardMat = new THREE.MeshStandardMaterial({ map: TEX_OPEN, roughness: .6 });
const board = new THREE.Mesh(new THREE.PlaneGeometry(.5, .25), boardMat); board.position.set(BX + .85, 1.25, FZ + .06); clinic.add(board);

// rooftop tooth statue
const statue = new THREE.Group(); clinic.add(statue); statue.position.set(BX, BH + .22, BZ);
cyl(statue, 1.15, 1.3, .3, 24, M(C.tealD), 0, .15, 0);
const toothGroup = new THREE.Group(); statue.add(toothGroup); toothGroup.position.y = .3;
{
  const pts = new THREE.SplineCurve([[.5, 0], [.68, .09], [.88, .27], [1.02, .5], [1.03, .68], [.93, .85], [.76, .95], [.5, .995], [0, 1.01]].map(p => new THREE.Vector2(p[0], p[1]))).getPoints(32).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, 32); const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), w = Math.min(1, Math.max(0, (y - .55) / .45)); pos.setY(i, y + w * .2 * Math.pow(Math.abs(Math.sin(2.7 * x) * Math.sin(2.7 * z)), .6)); }
  g.scale(1.25, 1.35, 1.2); g.translate(0, 1.0, 0); g.computeVertexNormals();
  const crown = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .2, metalness: 0, emissive: 0xffffff, emissiveIntensity: .05 })); crown.castShadow = true; toothGroup.add(crown); statue.userData.crown = crown;
  [-.45, .45].forEach(sx => { const r = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.25, 10), M(0xf0e7cf)); r.rotation.set(Math.PI, 0, sx * -.18); r.position.set(sx, .55, 0); r.castShadow = true; toothGroup.add(r); });
}

/* ───────── coffee annex ───────── */
const cafe = new THREE.Group(); world.add(cafe);
box(cafe, 2.6, 1.9, 3.0, M(0xfff1de), 4.0, .95, -3.0); box(cafe, 2.8, .15, 3.2, M(C.coral), 4.0, 1.97, -3.0);
box(cafe, 1.5, .9, .06, glassMat(), 4.0, 1.0, -1.47, false); box(cafe, 1.66, 1.06, .05, M(C.white), 4.0, 1.0, -1.49, false);
for (let i = 0; i < 6; i++) { const a = box(cafe, .43, .06, 1.0, M(i % 2 ? C.white : C.teal), 2.95 + i * .42, 1.55, -1.1); a.rotation.x = .35; }
cyl(cafe, .22, .22, .5, 10, M(0x8896a3), 4.8, 2.35, -3.8);
const cups = [];
for (const [tx, tz] of [[3.3, -.45], [4.7, -.45]]) {
  cyl(cafe, .38, .38, .06, 14, M(C.white), tx, .72, tz); cyl(cafe, .05, .05, .6, 6, M(0x8896a3), tx, .4, tz); cyl(cafe, .2, .2, .06, 8, M(0x8896a3), tx, .06, tz);
  cyl(cafe, .09, .07, .14, 10, M(C.coral), tx - .1, .82, tz); cyl(cafe, .09, .07, .14, 10, M(C.gold), tx + .12, .82, tz + .05);
  cups.push([tx - .1, .95, tz], [tx + .12, .95, tz + .05]);
  const u = new THREE.Mesh(new THREE.ConeGeometry(.75, .28, 8), M(tx > 4 ? C.teal : C.coral)); u.position.set(tx, 1.75, tz); u.castShadow = true; cafe.add(u); cyl(cafe, .025, .025, 1.1, 6, M(0xeeeeee), tx, 1.2, tz);
}
const puffs = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.09, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); scene.add(m); puffs.push({ m, c: cups[i % cups.length], t: R() * 3 }); }

/* ───────── trees, lamps, benches, playground ───────── */
const trees = [];
function tree(x, z, s = 1, kind = 0) {
  const g = new THREE.Group(); g.position.set(x, .1, z); g.scale.setScalar(s);
  cyl(g, .1, .14, .6, 6, M(C.trunk), 0, .3, 0);
  if (kind === 0) { for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.62 - i * .14, .7, 7), M(i % 2 ? 0x4aa66a : 0x3d9a5f)); c.position.y = .85 + i * .45; c.castShadow = true; g.add(c); } }
  else { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.62, 0), M(kind === 1 ? 0x64b96a : 0x86cc6f)); f.position.y = 1.15; f.castShadow = true; g.add(f); const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 0), M(0x56ab5e)); f2.position.set(.35, .85, .1); f2.castShadow = true; g.add(f2); }
  g.userData.ph = R() * 6; world.add(g); trees.push(g); return g;
}
[[-7.4, -6.6, 1.2, 0], [-5.4, -6.9, 1, 1], [-2.6, -7.0, 1.1, 0], [.4, -7.1, 1, 2], [3.2, -6.7, 1.2, 0], [6.2, -6.8, 1.1, 1], [7.0, -4.2, 1, 2], [6.8, -1.2, 1.1, 0], [6.4, 1.6, .9, 1], [-7.4, -.3, 1, 0], [-7.6, 3.1, .9, 2], [7.2, 3.2, .8, 1]].forEach(a => tree(...a));
const lampGlows = [];
function lamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, .1, z); cyl(g, .05, .07, 1.7, 6, M(0x56636f), 0, .85, 0); box(g, .5, .05, .05, M(0x56636f), .2, 1.7, 0);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 0 })); b.position.set(.42, 1.64, 0); g.add(b); lampBulbs.push(b);
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (c, w, h2) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,130,.9)'); gr.addColorStop(1, 'rgba(255,214,130,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }), transparent: true, opacity: 0, depthWrite: false })); h.scale.setScalar(2.2); h.position.set(.42, 1.64, 0); g.add(h); lampGlows.push(h); world.add(g);
}
[[.7, .1], [-3.6, .1], [-1.5, 3.9], [5.9, 3.9], [-7.4, 3.9]].forEach(a => lamp(...a));
// bench
{ const g = new THREE.Group(); g.position.set(6.6, .1, .6); g.rotation.y = -Math.PI / 2; box(g, 1.1, .08, .35, M(C.wood), 0, .45, 0); box(g, 1.1, .35, .06, M(C.wood), 0, .7, -.16); box(g, .08, .45, .3, M(0x56636f), -.45, .22, 0); box(g, .08, .45, .3, M(0x56636f), .45, .22, 0); world.add(g); }
// playground
const seesaw = new THREE.Group(); seesaw.position.set(-6.9, .55, -.8); world.add(seesaw);
box(seesaw, 1.9, .08, .3, M(C.coral), 0, 0, 0); box(seesaw, .12, .12, .4, M(C.gold), .8, .1, 0); box(seesaw, .12, .12, .4, M(C.gold), -.8, .1, 0);
{ const t = new THREE.Mesh(new THREE.ConeGeometry(.3, .55, 4), M(0x56636f)); t.position.set(-6.9, .37, -.8); t.rotation.y = Math.PI / 4; t.castShadow = true; world.add(t); }
{ const g = new THREE.Group(); g.position.set(-6.7, .1, -3.6); box(g, 1.1, .1, 1.1, M(C.blue), 0, 1.0, 0); [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].forEach(([x, z]) => box(g, .09, 1.0, .09, M(C.wood), x, .5, z)); const ramp = box(g, .8, .08, 1.9, M(C.coral), 0, .5, 1.45); ramp.rotation.x = -.55; box(g, .06, .35, 1.0, M(C.gold), -.45, 1.35, 0); box(g, .06, .35, 1.0, M(C.gold), .45, 1.35, 0); world.add(g); }
for (const [x, z, c] of [[-5.9, -3.9, C.coral], [-7.7, -4.9, C.gold]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 8), M(c)); b.position.set(x, .28, z); b.castShadow = true; world.add(b); }
// payments board
{ const g = new THREE.Group(); g.position.set(.9, .14, -.2); cyl(g, .04, .04, .9, 6, M(0x56636f), -.3, .45, 0); cyl(g, .04, .04, .9, 6, M(0x56636f), .3, .45, 0); box(g, .85, .5, .05, M(C.teal), 0, .95, 0); box(g, .7, .1, .06, M(C.white), 0, 1.05, .01); box(g, .5, .06, .06, M(C.gold), 0, .86, .01); world.add(g); }
// bay marking
{
  const t = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4dcd7'; g.fillRect(0, 0, w, h); g.fillStyle = '#e5483b'; g.fillRect(96, 40, 64, 120); g.fillRect(64, 72, 128, 56); g.fillStyle = '#b8332a'; g.font = '800 30px Arial,sans-serif'; g.textAlign = 'center'; g.fillText('SAME-DAY CARE', 128, 220); g.strokeStyle = '#f2b84b'; g.lineWidth = 8; g.setLineDash([22, 14]); g.strokeRect(8, 8, 240, 240); });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); p.rotation.x = -Math.PI / 2; p.position.set(4.0, .16, 1.7); p.receiveShadow = true; world.add(p);
}

/* ───────── vehicles & people ───────── */
function car(color, { van = false } = {}) {
  const g = new THREE.Group(); const L = van ? 2.4 : 1.9, H = van ? .75 : .42;
  box(g, 1.0, H, L, M(color), 0, .22 + H / 2, 0); if (!van) box(g, .88, .34, 1.0, M(0xe8f1f6, { roughness: .2 }), 0, .22 + H + .17, -.1);
  else { box(g, 1.02, .5, .9, M(0xe8f1f6, { roughness: .2 }), 0, .22 + H + .0, .75); box(g, 1.04, .12, 1.0, M(C.red), 0, .22 + H * .5, -.25); }
  [[-.5, .62], [.5, .62], [-.5, -.62], [.5, -.62]].forEach(([x, z]) => { const w = cyl(g, .22, .22, .16, 10, M(0x2b3138), x, .22, z * (L / 1.9)); w.rotation.z = Math.PI / 2; });
  box(g, .22, .1, .04, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), -.3, .42, L / 2, false); box(g, .22, .1, .04, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), .3, .42, L / 2, false);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); world.add(g); return g;
}
const PAL = [0x3b5bdb, 0xef6a54, 0xf2b84b, 0x2fb7a8, 0xf5f5f2, 0x7a5cd6, 0x2d3b4a];
const parked = [0, 1, 3].map((s, i) => { const c = car(PAL[(i * 2 + 1) % PAL.length]); c.position.set(SLOTS[s] + 0, .14, 2.2); c.rotation.y = Math.PI; return c; });
const traffic = [[-6, 5.1, -1, 2.0, 0], [3, 5.1, -1, 2.6, 1], [-2, 6.45, 1, 2.3, 2], [7, 6.45, 1, 1.9, 3], [-8, 6.45, 1, 2.8, 4]].map(([x, z, dir, sp, ci]) => { const c = car(PAL[ci]); c.position.set(x, .12, z); c.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; c.userData = { dir, sp, z }; return c; });
const amb = car(0xffffff, { van: true }); amb.visible = false;
const beaconR = new THREE.MeshBasicMaterial({ color: 0xff3b2a }), beaconB = new THREE.MeshBasicMaterial({ color: 0x3b7bff });
box(amb, .3, .12, .22, beaconR, -.25, 1.1, .5, false); box(amb, .3, .12, .22, beaconB, .25, 1.1, .5, false);
const bayRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 48), new THREE.MeshBasicMaterial({ color: 0xff5a46, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); bayRing.rotation.x = -Math.PI / 2; bayRing.position.set(4.0, .19, 1.7); world.add(bayRing);
const ambState = { phase: 'idle', t: 8, i: 0, wp: [], wait: 0 };
const AMB_PATH = [[9.5, 5.1], [4.0, 5.1], [4.0, 2.2]]; const AMB_OUT = [[4.0, 5.1], [-9.5, 5.1]];
function dispatchAmb() { if (ambState.phase !== 'idle') return; ambState.phase = 'in'; ambState.wp = AMB_PATH.map(p => new THREE.Vector3(p[0], .12, p[1])); ambState.i = 1; amb.position.copy(ambState.wp[0]); amb.visible = true; amb.rotation.y = -Math.PI / 2; }

const SKIN = [0xf1c9a5, 0xd9a47a, 0x9a6a47, 0xf6d7bd], SHIRT = [0x3b5bdb, 0xef6a54, 0xf2b84b, 0x2fb7a8, 0x7a5cd6, 0xf5f5f2];
function person(kid = false) {
  const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .3, 2, 6), M(SHIRT[Math.floor(R() * SHIRT.length)])); body.position.y = .34; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.115, 1), M(SKIN[Math.floor(R() * SKIN.length)])); head.position.y = .72; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6, 0, 6.28, 0, 1.2), M([0x2d2a26, 0x7a4a24, 0xd8b45a, 0x1b1b1b][Math.floor(R() * 4)])); hair.position.y = .75; g.add(hair);
  if (kid) g.scale.setScalar(.72); g.visible = false; world.add(g); return g;
}
const DOOR = new THREE.Vector3(BX, .14, -1.1);
const walkers = Array.from({ length: IS_MOBILE ? 6 : 9 }, (_, i) => ({ g: person(i % 4 === 3), state: 'wait', t: 1 + i * 1.7, path: [], pi: 0, spd: .8 + R() * .35, ph: R() * 6, vis: 0 }));
function planWalker(w, inbound) {
  const s = [0, 1, 3][Math.floor(R() * 3)], sx = SLOTS[s] + .75; const car_ = new THREE.Vector3(sx, .14, 2.1), a = new THREE.Vector3(sx, .14, .35), b = new THREE.Vector3(BX + (R() - .5) * .6, .14, .35);
  w.path = inbound ? [car_, a, b, DOOR.clone()] : [DOOR.clone(), b, a, car_]; w.pi = 1; w.g.position.copy(w.path[0]); w.state = inbound ? 'in' : 'out'; w.g.visible = true;
}

/* ───────── hotspots & content ───────── */
const ZONES = [
  { id: 'reception', pos: [BX, 2.1, -1.0], name: 'Reception', kicker: 'Meet the doctor', title: 'Welcome — you’re among friends', text: 'Dr. Mitchel Shields and the Discovery Dental team provide compassionate dentistry to patients across the Durham region.', list: ['Attentive & calming staff', 'Gentle techniques for even the most anxious patients', 'Solutions, not judgement'], link: ['about-us/', 'Meet the team ↗'], view: 'clinic' },
  { id: 'tech', pos: [1.2, 3.0, -1.1], name: 'iTero & x-rays', kicker: 'Today’s technology', title: 'Precise, digital, comfortable', text: 'Modern tools give a clear picture of your smile and keep every visit efficient.', list: ['iTero digital scanner', 'Digital x-rays', 'Invisalign® planning', 'Conscious sedation'], link: ['services/', 'See all services ↗'], view: 'clinic' },
  { id: 'smile', pos: [BX, 6.4, BZ], name: 'Smile studio', kicker: 'Cosmetic & restorative', title: 'Make people say “wow”', text: 'From a brighter shade to a fully rebuilt smile — the transformations start here.', list: ['Invisalign® clear aligners', 'Porcelain veneers & whitening', 'Dental implants, crowns & bridges', 'Smile makeovers'], link: ['veneers/', 'Explore veneers ↗'], view: 'clinic' },
  { id: 'emergency', pos: [4.0, 1.5, 1.7], name: 'Emergency bay', kicker: 'Same-day relief', title: 'Toothaches don’t wait', text: 'We keep time open daily for urgent cases and aim to ease your pain fast.', list: ['Severe toothaches', 'Broken or chipped teeth', 'Lost fillings or crowns', 'Knocked-out teeth, swelling or abscesses'], link: ['emergency-dentistry-ajax/', 'Emergency dentist ↗'], view: 'bay', act: dispatchAmb },
  { id: 'cafe', pos: [4.0, 2.5, -1.5], name: 'Tea & coffee bar', kicker: 'Warm & welcoming', title: 'More like visiting friends', text: 'Small-town ambience with big-city amenities — settle in with a hot drink in a relaxed waiting area.', list: ['Tea & coffee bar', 'Relaxed waiting area', 'Calm, attentive team'], link: ['new-patients/', 'New patient? Start here ↗'], view: 'cafe' },
  { id: 'kids', pos: [-6.7, 2.0, -2.8], name: 'Kids’ corner', kicker: 'Family dentistry', title: 'Smiles for every age', text: 'Children should see a dentist twice a year. After-school appointments are available Monday to Thursday.', list: ['Preventive care & dental sealants', 'Fillings and routine cleanings', 'Hygienists who teach simple home care'], link: ['family-dentistry/', 'Family dentistry ↗'], view: 'play' },
  { id: 'pay', pos: [.9, 1.45, -.2], name: 'Plans & payments', kicker: 'Easy on your budget', title: 'Coverage that makes sense', text: 'Most insurance plans are accepted and the team handles your claims for you.', list: ['We submit claims on your behalf', 'Monthly financing for up to five years', '10% seniors discount for patients over 65'], link: ['contact/', 'Ask about coverage ↗'], view: 'clinic' }
];
const CHIPS = [['Invisalign®', 'smile'], ['Veneers', 'smile'], ['Whitening', 'smile'], ['Implants', 'smile'], ['Crowns & bridges', 'smile'], ['Emergency', 'emergency'], ['Family dentistry', 'kids'], ['Fillings & sealants', 'kids'], ['Digital x-rays', 'tech'], ['Sedation', 'tech'], ['Insurance', 'pay']];
const VIEWS = {
  overview: { t: [0, 0, 0], z: IS_MOBILE ? 27 : 21, az: Math.PI / 4 }, clinic: { t: [-1.2, 1.4, -1.6], z: IS_MOBILE ? 16 : 12.5, az: Math.PI / 4 - .12 },
  bay: { t: [3.6, .6, 1.6], z: IS_MOBILE ? 12 : 10.5, az: Math.PI / 4 + .65 }, cafe: { t: [3.8, 1, -2.4], z: IS_MOBILE ? 12 : 10.5, az: Math.PI / 4 + .5 }, play: { t: [-6.2, .6, -2.4], z: IS_MOBILE ? 12 : 10.5, az: Math.PI / 4 - .6 }
};
const goal = { tx: 0, ty: 0, tz: 0, z: VIEWS.overview.z, az: VIEWS.overview.az, el: .62 }, cam = { ...goal, z: VIEWS.overview.z * 1.35, az: VIEWS.overview.az - .6 };
function setView(name) { const v = VIEWS[name]; goal.tx = v.t[0]; goal.ty = v.t[1]; goal.tz = v.t[2]; goal.z = v.z; goal.az = v.az; $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.view === name)); }
$$('#views button').forEach(b => b.addEventListener('click', () => { setView(b.dataset.view); selectZone(null); }));

const pinsEl = $('#pins'), pinEls = ZONES.map((z, i) => { const b = document.createElement('button'); b.className = 'pin'; b.setAttribute('aria-label', z.name); b.innerHTML = '<span class="dot">' + (i + 1) + '</span><span class="lbl">' + z.name + '</span>'; b.addEventListener('click', e => { e.stopPropagation(); selectZone(z.id, true); }); pinsEl.appendChild(b); return b; });
const chipsEl = $('#chips'); CHIPS.forEach(([n, id]) => { const b = document.createElement('button'); b.textContent = n; b.dataset.z = id; b.addEventListener('click', () => selectZone(id, true)); chipsEl.appendChild(b); });
const hilite = new THREE.Mesh(new THREE.TorusGeometry(1, .05, 8, 48), new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0 })); hilite.rotation.x = Math.PI / 2; world.add(hilite);
let selected = null;
function selectZone(id, fly) {
  selected = id; const z = ZONES.find(x => x.id === id);
  pinEls.forEach((p, i) => p.classList.toggle('on', ZONES[i].id === id)); $$('#chips button').forEach(b => b.classList.toggle('on', b.dataset.z === id && false));
  if (!z) { $('#zoneKicker').textContent = 'Tap a glowing pin'; $('#zoneTitle').textContent = 'Explore the clinic'; $('#zoneText').textContent = 'Seven zones of Discovery Dental are hiding in this little 3D world. Drag to rotate, scroll to zoom, then tap a pin to dive in.'; $('#zoneList').innerHTML = ''; const l = $('#zoneLink'); l.textContent = 'See all services ↗'; l.href = BASE + 'services/'; return; }
  $('#zoneKicker').textContent = z.kicker; $('#zoneTitle').textContent = z.title; $('#zoneText').textContent = z.text; $('#zoneList').innerHTML = z.list.map(x => '<li>' + x + '</li>').join(''); const l = $('#zoneLink'); l.textContent = z.link[1]; l.href = BASE + z.link[0];
  if (fly && z.view) setView(z.view); if (z.act) z.act(); burst(new THREE.Vector3(...z.pos).setY(.6), 24, C.teal); ping(ZONES.indexOf(z));
  hilite.position.set(z.pos[0], .2, z.pos[2]); hilite.userData.s = 0;
}

/* ───────── confetti & audio ───────── */
const confetti = []; const confGeo = new THREE.IcosahedronGeometry(.07, 0);
function burst(p, n = 30, col = C.teal) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(confGeo, M([col, C.gold, C.coral, 0xffffff][i % 4])); m.position.copy(p); world.add(m); confetti.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3, 2.5 + Math.random() * 3, (Math.random() - .5) * 3), life: 1.4 + Math.random() * .6 }); } }
let actx = null; function ping(i = 0) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const f = 523.25 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14][i % 7] / 12), t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.04, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .9); o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 1); } catch (e) { /* no audio */ } }

/* ───────── time, status, dashboard ───────── */
const sim = { day: 1, hour: 11, live: false };
const week = $('#week'); DAYS.forEach((d, i) => { const e = document.createElement('div'); e.innerHTML = '<i></i><span>' + d[0] + '</span>'; e.title = d; week.appendChild(e); });
const dayBox = $('#days'); DAYS.forEach((d, i) => { const b = document.createElement('button'); b.textContent = d[0]; b.title = d; b.addEventListener('click', () => { sim.day = i; sim.live = false; refreshUI(); }); dayBox.appendChild(b); });
const fmt = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const h12 = ((hh + 11) % 12) + 1; return h12 + ':' + String(mm).padStart(2, '0') + ' ' + (hh >= 12 && hh < 24 ? 'pm' : 'am'); };
const isOpen = () => sim.day <= 3 && sim.hour >= OPEN_H && sim.hour < CLOSE_H;
const slider = $('#time');
slider.addEventListener('input', () => { sim.hour = +slider.value; sim.live = false; refreshUI(); });
function torontoNow() { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()); const g = t => p.find(x => x.type === t).value; return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday')), hour: (+g('hour') % 24) + (+g('minute')) / 60 }; }
$('#liveBtn').addEventListener('click', () => { sim.live = true; const n = torontoNow(); sim.day = n.day; sim.hour = n.hour; refreshUI(); });
setInterval(() => { if (sim.live) { const n = torontoNow(); sim.day = n.day; sim.hour = n.hour; refreshUI(); } }, 30000);
function nextOpen() { for (let k = 0; k < 7; k++) { const d = (sim.day + k) % 7; if (d <= 3 && (k > 0 || sim.hour < OPEN_H)) return { d, k }; } return { d: 0, k: 1 }; }
function refreshUI() {
  const open = isOpen(); const badge = $('#badge'); badge.classList.toggle('closed', !open); $('#badgeTxt').textContent = open ? 'Open' : 'Closed';
  $('#statusTitle').textContent = open ? 'Open now' : 'Closed right now';
  if (open) { const left = CLOSE_H - sim.hour; $('#statusSub').textContent = left < 1 ? 'Closing soon — last appointments wrapping up' : 'Welcoming patients until 7:00 pm'; }
  else { const n = nextOpen(); $('#statusSub').textContent = n.k === 0 ? 'Opens today at 8:30 am' : n.k === 1 ? 'Opens tomorrow (' + DAYS_FULL[n.d] + ') at 8:30 am' : 'Opens ' + DAYS_FULL[n.d] + ' at 8:30 am'; }
  const f = clamp((sim.hour - OPEN_H) / (CLOSE_H - OPEN_H), 0, 1); $('#clockFill').style.width = (sim.day <= 3 ? f * 100 : 0) + '%'; const mk = $('#clockNow'); mk.style.left = (f * 100) + '%'; mk.style.opacity = open ? 1 : .35;
  $('#timeOut').textContent = fmt(sim.hour); slider.value = clamp(sim.hour, +slider.min, +slider.max);
  $$('#days button').forEach((b, i) => b.classList.toggle('on', i === sim.day)); $$('#week div').forEach((e, i) => { e.className = (i <= 3 ? 'o ' : '') + (i === sim.day ? 'sel' : ''); });
  $('#liveBtn').textContent = sim.live ? 'Live · Toronto time ✓' : 'Use live Toronto time';
  boardMat.map = open ? TEX_OPEN : TEX_CLOSED; boardMat.needsUpdate = true;
}
refreshUI();

/* day / night */
const env = { s: 1 }; const cSky = new THREE.Color(), cG = new THREE.Color(), cSunA = new THREE.Color(0xffa766), cSunB = new THREE.Color(0xfff6e6);
function applyEnv(dt) {
  const h = sim.hour, tgt = clamp(Math.sin(Math.PI * (h - 5.8) / 15.2) * 1.5, 0, 1); env.s = damp(env.s, tgt, 5, dt); const s = env.s;
  const th = Math.PI * clamp((h - 6) / 14.5, 0, 1); sun.position.set(-Math.cos(th) * 16, 6 + Math.sin(th) * 15, 9); sun.target.position.set(0, 0, 0);
  sun.intensity = 3.1 * s; sun.color.copy(cSunA).lerp(cSunB, clamp(s * 1.5 - .2, 0, 1)); moon.intensity = .9 * (1 - s);
  hemi.intensity = .35 + .8 * s; hemi.color.setHex(0x1b2c55).lerp(cSky.setHex(0xd8ecff), s); hemi.groundColor.setHex(0x0d1f2a).lerp(cG.setHex(0xf1ead9), s);
  const dark = s < .35; if (document.body.classList.contains('night') !== dark) document.body.classList.toggle('night', dark);
  $('#timeIco').textContent = s > .6 ? '☀' : s > .25 ? '🌇' : '🌙';
  const open = isOpen(), nightGlow = 1 - s; glassMats.forEach(m => { m.emissiveIntensity = (open ? .55 : .06) * (.25 + nightGlow * 1.2) * (open ? 1 : .4); });
  signMat.emissiveIntensity = nightGlow * .9 + .08; lampBulbs.forEach(b => b.material.emissiveIntensity = nightGlow * 2); lampGlows.forEach(g => g.material.opacity = nightGlow * .9);
}

/* ───────── interaction ───────── */
const ptrs = new Map(); let dragMoved = 0, pinchD = 0, auto = false;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); } });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 1) { goal.az -= dx * .0065; goal.el = clamp(goal.el + dy * .003, .38, 1.0); }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); goal.z = clamp(goal.z * (pinchD / d), 5.5, 30); pinchD = d; }
});
const up = e => { const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if (was && dragMoved < 6 && e.type === 'pointerup') clickScene(e); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); goal.z = clamp(goal.z * Math.exp(e.deltaY * .001), 5.5, 30); }, { passive: false });
addEventListener('keydown', e => { if (e.key === 'ArrowLeft') goal.az -= .15; if (e.key === 'ArrowRight') goal.az += .15; });
$('#autoBtn').addEventListener('click', e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let toothSpin = 0, honk = 0;
function clickScene(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (ray.intersectObject(statue, true).length) { toothSpin = Math.PI * 4; const p = new THREE.Vector3(); statue.getWorldPosition(p); p.y += 2; burst(p, 50, C.teal); ping(5); return; }
  if (amb.visible && ray.intersectObject(amb, true).length) { honk = 1.2; ping(6); return; }
  for (const c of traffic) if (ray.intersectObject(c, true).length) { c.userData.jump = 1; ping(2); return; }
  const hit = ray.intersectObject(island, true)[0]; if (hit) burst(hit.point.clone().setY(.3), 10, C.gold);
}

/* ───────── resize / loop ───────── */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.userData.aspect = w / h; }
addEventListener('resize', resize); resize();
const tmp = new THREE.Vector3(), clockT0 = performance.now(); let last = performance.now(), T = 0, first = false;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  // camera
  if (auto) goal.az += dt * .12;
  const k = 4.2; cam.tx = damp(cam.tx, goal.tx, k, dt); cam.ty = damp(cam.ty, goal.ty, k, dt); cam.tz = damp(cam.tz, goal.tz, k, dt); cam.z = damp(cam.z, goal.z, k, dt); cam.az = damp(cam.az, goal.az, 6, dt); cam.el = damp(cam.el, goal.el, 6, dt);
  const a = camera.userData.aspect, hh = cam.z / 2, hw = hh * a; camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
  const mobile = innerWidth <= 820; const shiftY = mobile ? -hh * .22 : 0; camera.top += shiftY; camera.bottom += shiftY; camera.updateProjectionMatrix();
  camera.position.set(cam.tx + Math.sin(cam.az) * Math.cos(cam.el) * 50, cam.ty + Math.sin(cam.el) * 50, cam.tz + Math.cos(cam.az) * Math.cos(cam.el) * 50); camera.lookAt(cam.tx, cam.ty, cam.tz); camera.updateMatrixWorld();
  const open = isOpen(); applyEnv(dt);
  island.position.y = Math.sin(T * .8) * .05;
  // statue
  if (toothSpin > 0) { const d = Math.min(toothSpin, dt * 9); toothGroup.rotation.y += d; toothSpin -= d; } else toothGroup.rotation.y += dt * .35; toothGroup.position.y = .3 + Math.sin(T * 1.5) * .05;
  // trees sway
  trees.forEach(t => { t.rotation.z = Math.sin(T * 1.1 + t.userData.ph) * .025; });
  seesaw.rotation.z = Math.sin(T * 1.6) * .22;
  // steam
  puffs.forEach(p => { p.t += dt * .5; const u = p.t % 1; p.m.position.set(p.c[0] + Math.sin(u * 6 + p.t) * .05, p.c[1] + u * .9, p.c[2]); p.m.material.opacity = (1 - u) * .5 * (open ? 1 : .2); p.m.scale.setScalar(.6 + u * 1.6); });
  // traffic
  traffic.forEach(c => { const u = c.userData; c.position.x += u.dir * u.sp * dt * (env.s > .2 ? 1 : .6); if (c.position.x > 10) c.position.x = -10; if (c.position.x < -10) c.position.x = 10; if (u.jump) { u.jump = Math.max(0, u.jump - dt * 3); c.position.y = .12 + Math.sin(u.jump * Math.PI) * .5; } });
  // walkers
  walkers.forEach((w, i) => {
    const g = w.g;
    if (!open) { w.vis = damp(w.vis, 0, 6, dt); g.scale.setScalar(Math.max(.001, w.vis * (i % 4 === 3 ? .72 : 1))); if (w.vis < .02) { g.visible = false; w.state = 'wait'; w.t = 1 + R() * 3; } return; }
    if (w.state === 'wait') { w.t -= dt; if (w.t <= 0) planWalker(w, !(i % 2) || R() > .5); w.vis = 1; return; }
    w.vis = damp(w.vis, 1, 6, dt); const tgt = w.path[w.pi]; const d = tmp.copy(tgt).sub(g.position); const dist = d.length();
    if (dist < .08) { w.pi++; if (w.pi >= w.path.length) { g.visible = false; w.state = 'wait'; w.t = 3 + R() * 7; return; } }
    else { d.normalize(); g.position.addScaledVector(d, w.spd * dt); g.rotation.y = Math.atan2(d.x, d.z); }
    w.ph += dt * 9; g.position.y = .14 + Math.abs(Math.sin(w.ph)) * .045; g.scale.setScalar((i % 4 === 3 ? .72 : 1) * w.vis);
  });
  // emergency van
  const as = ambState; if (!open && as.phase === 'idle') amb.visible = false;
  if (open && as.phase === 'idle') { as.t -= dt; if (as.t <= 0) { dispatchAmb(); } }
  if (as.phase === 'in' || as.phase === 'out') {
    const tgt = as.wp[as.i]; const d = tmp.copy(tgt).sub(amb.position); const dist = d.length();
    if (dist < .12) { as.i++; if (as.i >= as.wp.length) { if (as.phase === 'in') { as.phase = 'wait'; as.wait = 5; amb.rotation.y = Math.PI; } else { as.phase = 'idle'; amb.visible = false; as.t = 14 + R() * 10; } } }
    else { d.normalize(); amb.position.addScaledVector(d, 3.4 * dt); const ang = Math.atan2(d.x, d.z); let da = ang - amb.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); amb.rotation.y += da * Math.min(1, dt * 7); }
  } else if (as.phase === 'wait') { as.wait -= dt; if (as.wait <= 0) { as.phase = 'out'; as.wp = [new THREE.Vector3(4.0, .12, 5.1), new THREE.Vector3(-9.5, .12, 5.1)]; as.i = 0; } }
  const flash = amb.visible && as.phase !== 'idle'; beaconR.color.setHex(flash && Math.sin(T * 16) > 0 ? 0xff3b2a : 0x66241f); beaconB.color.setHex(flash && Math.sin(T * 16) <= 0 ? 0x3b7bff : 0x22305a);
  bayRing.material.opacity = as.phase === 'wait' ? (.4 + .4 * Math.sin(T * 8)) : damp(bayRing.material.opacity, 0, 6, dt); bayRing.scale.setScalar(1 + (as.phase === 'wait' ? Math.sin(T * 4) * .06 : 0));
  if (honk > 0) { honk -= dt; amb.position.y = .12 + Math.abs(Math.sin(honk * 14)) * .08; }
  // highlight ring
  if (selected) { hilite.userData.s = Math.min(1, (hilite.userData.s || 0) + dt * 3); hilite.scale.setScalar(.6 + hilite.userData.s * .5 + Math.sin(T * 4) * .06); hilite.material.opacity = hilite.userData.s * .85; } else hilite.material.opacity = damp(hilite.material.opacity, 0, 8, dt);
  // confetti
  for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.life -= dt; c.v.y -= 9 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 8; c.m.scale.setScalar(Math.max(.01, c.life)); if (c.life <= 0 || c.m.position.y < -.5) { world.remove(c.m); confetti.splice(i, 1); } }
  // pins
  ZONES.forEach((z, i) => { tmp.set(z.pos[0], z.pos[1] + Math.sin(T * 2 + i) * .06, z.pos[2]).project(camera); const x = (tmp.x * .5 + .5) * innerWidth, y = (-tmp.y * .5 + .5) * innerHeight; pinEls[i].style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; });
  renderer.render(scene, camera);
  if (!first) { first = true; requestAnimationFrame(() => $('#loader').classList.add('done')); }
}
setView('overview'); selectZone(null);
// gentle intro: camera swings in
requestAnimationFrame(frame);
window.__dash = { sim, goal, selectZone, dispatchAmb, refreshUI, get env() { return env.s; } };
