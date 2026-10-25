import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = rng(21), RC = rng(77);
const IS_MOBILE = matchMedia('(max-width: 820px)').matches;
const BASE = 'https://discoverydental.com/';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const OPEN_H = 8.5, CLOSE_H = 19;

/* ───────── renderer / scene ───────── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55; }
const BG_DAY = new THREE.Color(0xe7efee), BG_NIGHT = new THREE.Color(0x0a1b26), BG_DUSK = new THREE.Color(0xf2b48c), bg = new THREE.Color(BG_DAY);
scene.background = bg; scene.fog = new THREE.Fog(bg, 58, 150);
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -80, 220);
const world = new THREE.Group(); scene.add(world);
const hemi = new THREE.HemisphereLight(0xcfe7ff, 0xf1ead9, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3df, 3.0); sun.castShadow = true; scene.add(sun, sun.target);
sun.shadow.mapSize.set(IS_MOBILE ? 2048 : 4096, IS_MOBILE ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .05;
const moon = new THREE.DirectionalLight(0x8fb4ff, 0); moon.position.set(10, 16, -8); scene.add(moon);

/* ───────── helpers ───────── */
const matCache = new Map();
function M(hex, o = {}) { const k = hex + '|' + JSON.stringify(o); if (matCache.has(k)) return matCache.get(k); const m = new THREE.MeshStandardMaterial({ color: hex, roughness: .82, metalness: 0, ...o }); matCache.set(k, m); return m; }
const rbCache = new Map();
function rbGeo(w, h, d) { const k = w.toFixed(3) + '|' + h.toFixed(3) + '|' + d.toFixed(3); let g = rbCache.get(k); if (!g) { const r = Math.min(.06, Math.min(w, h, d) * .3); g = (r < .004) ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r); rbCache.set(k, g); } return g; }
function box(parent, w, h, d, mat, x, y, z, cast = true) { const m = new THREE.Mesh(rbGeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; }
function cyl(parent, rt, rb, h, seg, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function canvasTex(w, h, draw, repeat = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function glowTex(rgb) { return canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${rgb},.9)`); gr.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }); }
const C = { teal: 0x16b3a3, tealD: 0x0d7d73, white: 0xfbfbf9, cream: 0xf6f4ef, grass: 0xb9deaa, grass2: 0xa5d592, pave: 0xe2e5e9, asph: 0x9ea8b6, roof: 0x9aa8b4, glass: 0x9fd3ea, coral: 0xef6a54, gold: 0xf2b84b, blue: 0x3b5bdb, red: 0xe5483b, wood: 0xc99a62, trunk: 0x9c6b3f, stone: 0xd9d4c8 };
const glassMats = [], interiorMats = [], lampBulbs = [];

/* ───────── merged static geometry (city) ───────── */
class Merge {
  constructor(uv = false) { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; this.uv = uv; }
  quad(a, b, c, d, n, col, uvs) { const o = this.p.length / 3; [a, b, c, d].forEach(v => { this.p.push(...v); this.n.push(...n); this.c.push(col.r, col.g, col.b); }); if (this.uv) this.u.push(...(uvs || [0, 0, 1, 0, 1, 1, 0, 1])); this.i.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  box(x, y0, z, w, h, d, color, faces = 'all') {
    const col = new THREE.Color(color), x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y0 + h;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col); this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col); this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col);
    if (faces === 'all' || faces === 'top') this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col);
  }
  wall(x, z, w, d, y0, h, color, fh = .62, ww = .62) {
    const col = new THREE.Color(color); const faces = [[0, 0, 1, x - w / 2, z + d / 2, 1, 0, w], [0, 0, -1, x + w / 2, z - d / 2, -1, 0, w], [1, 0, 0, x + w / 2, z + d / 2, 0, -1, d], [-1, 0, 0, x - w / 2, z - d / 2, 0, 1, d]];
    for (const [nx, ny, nz, ax, az, dx, dz, len] of faces) { const u1 = len / (ww * 4), v0 = y0 / (fh * 4), v1 = (y0 + h) / (fh * 4); this.quad([ax, y0, az], [ax + dx * len, y0, az + dz * len], [ax + dx * len, y0 + h, az + dz * len], [ax, y0 + h, az], [nx, ny, nz], col, [0, v0, u1, v0, u1, v1, 0, v1]); }
    this.quad([x - w / 2, y0 + h, z + d / 2], [x + w / 2, y0 + h, z + d / 2], [x + w / 2, y0 + h, z - d / 2], [x - w / 2, y0 + h, z - d / 2], [0, 1, 0], col, [0, 0, 0, 0, 0, 0, 0, 0]);
  }
  mesh(mat, cast = true, recv = true) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setIndex(this.i); const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
}
const GROUND = new Merge(), WALLS = new Merge(true), ROOFS = new Merge();

/* window textures */
const winTile = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const r = rng(5); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 64 + 14, y = j * 64 + 12; g.fillStyle = r() > .86 ? '#e9f3f8' : '#7fa4bb'; g.fillRect(x, y, 36, 40); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, 36, 9); g.fillStyle = '#d4dde3'; g.fillRect(x - 3, y + 40, 42, 4); } }, true);
const winEmis = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rng(9); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (r() > .55) { g.fillStyle = r() > .5 ? '#ffd9a0' : '#fff0c8'; g.fillRect(i * 64 + 14, j * 64 + 12, 36, 40); } }, true);
const wallMat = new THREE.MeshStandardMaterial({ map: winTile, vertexColors: true, roughness: .75, emissive: 0xffffff, emissiveMap: winEmis, emissiveIntensity: 0 });
const cityMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
cityMat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position,1.0)).xyz;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nfloat h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}').replace('#include <color_fragment>', '#include <color_fragment>\n{ float n = vn(vWp.xz*3.1)*.5 + vn(vWp.xz*11.)*.3 + vn(vWp.xz*37.)*.2; diffuseColor.rgb *= .9 + .2*n; vec2 g = abs(fract(vWp.xz*.5)-.5); float seam = smoothstep(.485,.5,max(g.x,g.y)); diffuseColor.rgb *= 1. - .07*seam*step(vWp.y,.2); }'); };


/* ───────── city layout ───────── */
const RX = [-53, -39, -25, -11, 11, 25, 39, 53], RZ = [-52.5, -38.5, -24.5, -10.5, 5.85, 19.85, 33.85], RW = 3;
const PALW = [0xf3efe6, 0xe6eef2, 0xf6e7dc, 0xdfe9e4, 0xe9e4f1, 0xf1f1f3, 0xf8ecd6, 0xd8e6ef];
GROUND.box(0, -.6, 0, 260, .6, 260, C.cream); GROUND.box(0, 0, 0, 260, .05, 260, 0xe9efe9, 'top');
const blocks = [];
for (let xi = 0; xi < RX.length - 1; xi++) for (let zi = 0; zi < RZ.length - 1; zi++) { const x0 = RX[xi] + RW / 2, x1 = RX[xi + 1] - RW / 2, z0 = RZ[zi] + RW / 2, z1 = RZ[zi + 1] - RW / 2; blocks.push({ x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }); }
RX.forEach(x => GROUND.box(x, .0, 0, RW, .06, 260, C.asph)); RZ.forEach(z => GROUND.box(0, .0, z, 260, .06, RW, C.asph));
for (const x of RX) for (const z of RZ) GROUND.box(x, .06, z, RW, .005, RW, 0xa6afbc, 'top');
const dashY = .07;
for (const z of RZ) for (let x = -76; x < 76; x += 2.2) { if (RX.some(rx => Math.abs(x - rx) < 2.2)) continue; GROUND.box(x, dashY, z, 1.0, .01, .1, 0xf5f7fa); }
for (const x of RX) for (let z = -76; z < 76; z += 2.2) { if (RZ.some(rz => Math.abs(z - rz) < 2.2)) continue; GROUND.box(x, dashY, z, .1, .01, 1.0, 0xf5f7fa); }
for (const x of RX) for (const z of RZ) { for (let k = -1; k <= 1; k += .5) { GROUND.box(x + k * .9, dashY, z - 2.3, .35, .01, 1.0, 0xffffff); GROUND.box(x + k * .9, dashY, z + 2.3, .35, .01, 1.0, 0xffffff); } }
const lamps = [], rooftops = [], parkBlocks = [], tlights = [];
const T_PINE = [], T_ROUND = [];
function placeTree(x, z, s = 1) { (RC() > .5 ? T_PINE : T_ROUND).push([x, z, s * (.8 + RC() * .5)]); }

function addDetails(x, z, w, d, h, col, tall) {
  const c = new THREE.Color(col).multiplyScalar(.92).getHex(), trim = 0xdfe5ea;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ROOFS.box(x + sx * (w / 2 - .05), .12, z + sz * (d / 2 - .05), .14, h, .14, c, 'all');
  for (let y = 2.4; y < h - .5; y += 2.4) { ROOFS.box(x, .12 + y, z, w + .1, .06, d + .1, trim); }
  ROOFS.box(x, .12 + h + .22, z + d / 2 - .04, w + .1, .26, .08, trim); ROOFS.box(x, .12 + h + .22, z - d / 2 + .04, w + .1, .26, .08, trim); ROOFS.box(x + w / 2 - .04, .12 + h + .22, z, .08, .26, d + .1, trim); ROOFS.box(x - w / 2 + .04, .12 + h + .22, z, .08, .26, d + .1, trim);
  ROOFS.box(x - w * .22, .12 + h + .22, z + d * .15, w * .22, .5, d * .22, 0xc7d0d8); ROOFS.box(x - w * .22, .12 + h + .72, z + d * .15, w * .12, .1, d * .12, 0x8896a3);
  if (tall) { ROOFS.box(x, .12 + h + .22, z, .05, 2.4, .05, 0xd9dfe4); ROOFS.box(x, .12 + h + 2.5, z, .12, .12, .12, 0xff4a3a); }
  ROOFS.box(x, .12, z + d / 2 + .12, w * .86, .5, .24, 0x2b3a46); ROOFS.box(x, .12 + .5, z + d / 2 + .12, w * .86, .1, .3, 0xe9eef2);
}
const FILLER = ['park', 'tower', 'low', 'tower', 'low', 'tower', 'park', 'low'];
blocks.forEach((b) => {
  const campus = b.cx === 0 && Math.abs(b.cz - (-2.325)) < 1.5; const plaza = Math.abs(b.cx) < 1 && b.cz > 7 && b.cz < 19;
  b.campus = campus; b.plaza = plaza; if (campus) return;
  const dist = Math.hypot(b.cx, b.cz);
  const kind = plaza ? 'plaza' : (b.cx > 30 && b.cx < 34 && b.cz > 9 && b.cz < 16 ? 'ferris' : FILLER[Math.floor(RC() * FILLER.length)]);
  GROUND.box(b.cx, 0, b.cz, b.w, .12, b.d, C.pave); b.kind = kind;
  if (kind === 'park' || kind === 'ferris') GROUND.box(b.cx, .0, b.cz, b.w - 1.4, .15, b.d - 1.4, C.grass);
  if (kind === 'plaza') { GROUND.box(b.cx, 0, b.cz, b.w - 1.0, .14, b.d - 1.0, 0xede7da); for (let i = -4; i <= 4; i++) GROUND.box(b.cx + i * 2.2, .14, b.cz, .06, .004, b.d - 1.0, 0xd8d0be, 'top'); for (let j = -2; j <= 2; j++) GROUND.box(b.cx, .14, b.cz + j * 2.2, b.w - 1.0, .004, .06, 0xd8d0be, 'top'); }
  const nearCap = clamp((dist - 16) / 70, 0, 1), hMax = lerp(4.5, 34, nearCap * nearCap + nearCap * .25);
  if (kind === 'tower') {
    const n = dist > 40 ? 1 + Math.floor(RC() * 2) : 1 + Math.floor(RC() * 3); const cells = []; const gx = n > 1 ? 2 : 1, gz = n > 2 ? 2 : 1;
    for (let a = 0; a < gx; a++) for (let c = 0; c < gz; c++) cells.push([a, c, gx, gz]);
    cells.slice(0, Math.max(1, n)).forEach(([a, c, gx_, gz_]) => {
      const cw = (b.w - 1.8) / gx_, cd = (b.d - 1.8) / gz_, w = cw * (.7 + RC() * .25), d = cd * (.7 + RC() * .25), x = b.x0 + .9 + cw * (a + .5), z = b.z0 + .9 + cd * (c + .5);
      const h = hMax * (.45 + RC() * .55) + 1.5, col = PALW[Math.floor(RC() * PALW.length)];
      WALLS.wall(x, z, w, d, .12, h, col, .6, .6); ROOFS.box(x, .12 + h, z, w + .16, .22, d + .16, C.roof); addDetails(x, z, w, d, h, col, h > 12);
      if (h > 14) { WALLS.wall(x, z, w * .6, d * .6, .12 + h + .22, h * .22, col, .6, .6); ROOFS.box(x, .12 + h * 1.22 + .22, z, w * .6 + .12, .18, d * .6 + .12, C.roof); }
      ROOFS.box(x + w * .2, .12 + h + .22, z - d * .15, w * .25, .35, d * .25, 0xe3e8ec); if (h > 10) ROOFS.box(x - w * .25, .12 + h + .82, z + d * .1, .06, 1.2, .06, 0xd9dfe4);
      if (h > 9 && RC() > .6) rooftops.push({ x, z: z + d / 2 + .02, y: h + .12 - .6, w });
    });
  } else if (kind === 'low') {
    for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) { const cw = (b.w - 1.6) / 2, cd = (b.d - 1.6) / 2, w = cw * .86, d = cd * .86, x = b.x0 + .8 + cw * (a + .5), z = b.z0 + .8 + cd * (c + .5), h = 1.8 + RC() * 3.4, col = PALW[Math.floor(RC() * PALW.length)]; WALLS.wall(x, z, w, d, .12, h, col, .6, .55); ROOFS.box(x, .12 + h, z, w + .12, .18, d + .12, RC() > .5 ? C.coral : C.roof); if (RC() > .5) ROOFS.box(x, .12 + h + .18, z, .5, .3, .5, 0xe3e8ec); if (RC() > .45) ROOFS.box(x, .12 + h * .45, z + d / 2 + .15, w * .8, .08, .3, [C.teal, C.coral, C.gold, C.blue][Math.floor(RC() * 4)]); }
  } else if (kind === 'park' || kind === 'ferris') {
    parkBlocks.push(b); for (let i = 0; i < 12; i++) placeTree(b.x0 + 1.2 + RC() * (b.w - 2.4), b.z0 + 1.2 + RC() * (b.d - 2.4), 1);
  }
  for (let t = b.x0 + 1; t < b.x1; t += 4.4) { placeTree(t, b.z0 + .45, .8); placeTree(t, b.z1 - .45, .8); }
});
for (const z of RZ) for (let x = -72; x < 72; x += 9) lamps.push([x + (z * 3 % 4), z + 1.9]);
for (const x of RX) for (let z = -72; z < 72; z += 9) lamps.push([x + 1.9, z + (x * 2 % 4)]);

/* ───────── campus (clinic landmark) ───────── */
const campus = new THREE.Group(); world.add(campus);
const slab = (w, d, x, z, h, hex, y0 = 0) => box(campus, w, h, d, M(hex), x, y0 + h / 2, z, false);
GROUND.box(0, 0, -2.325, 19, .12, 13.35, C.pave);
slab(18.2, 12.6, 0, -2.4, .1, C.grass, .1); slab(5.8, 2.1, -1.5, -.15, .06, C.stone, .2); slab(.9, 4.2, -1.5, 2.1, .04, C.stone, .2);
slab(5.4, 3.0, -5.2, 2.0, .06, 0xcfd5de, .2); slab(3.0, 3.0, 4.0, 1.7, .06, 0xf4dcd7, .2); slab(2.6, 5.2, 6.6, -2.4, .02, C.grass2, .2); slab(3.2, 6.4, -6.5, -2.6, .02, C.grass2, .2);
slab(18.6, .9, 0, 3.9, .1, C.pave, .2);
for (let i = 0; i < 6; i++) box(campus, .08, .02, 2.2, M(0xf8f8f8), -7.4 + i * 1.05, .28, 2.0, false);
const SLOTS = [-6.6, -5.55, -4.5, -3.45];
const clinic = new THREE.Group(); campus.add(clinic);
const BX = -1.5, FZ = -1.3, CORE_Z1 = -3.2;
const glassTint = (op = .3) => { const m = new THREE.MeshPhysicalMaterial({ color: C.glass, roughness: .04, metalness: .15, transparent: true, opacity: op, depthWrite: false, emissive: 0xffd89a, emissiveIntensity: 0, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 2.4, iridescence: .35, iridescenceIOR: 1.3, specularIntensity: 1 }); glassMats.push(m); return m; };
const glassFront = glassTint(.26), glassSide = glassTint(.26), glassUp = glassTint(.3);
const mullion = M(0xf2f5f7), fin = M(C.white), teal = M(C.teal), steel = M(0x8896a3);
box(clinic, 7.8, .22, 4.6, M(C.stone), BX, .21, -3.35);
box(clinic, 7.0, .08, 1.95, M(0xe9dcc4), BX, .3, -2.25, false);
box(clinic, 7.0, .14, 1.95, M(C.white), BX, 1.76, -2.25);
box(clinic, 7.0, .14, 2.1, M(C.white), BX, 3.36, -2.3);
box(clinic, 7.0, 4.6, 2.1, M(C.white), BX, 2.5, -4.25);
box(clinic, 7.5, .22, 3.7, M(C.white), BX, 4.82, -3.55);
box(clinic, 7.5, .06, .06, new THREE.MeshBasicMaterial({ color: C.teal }), BX, 4.74, -1.72, false);
box(clinic, 7.0, .06, .06, new THREE.MeshBasicMaterial({ color: C.teal }), BX, 1.84, FZ + .02, false);
const gw = (w, h, d, x, y, z, m) => { const g = box(clinic, w, h, d, m, x, y, z, false); g.renderOrder = 2; return g; };
gw(7.0, 1.46, .04, BX, 1.03, FZ, glassFront); gw(7.0, 1.52, .04, BX, 2.6, FZ, glassUp);
gw(.04, 1.46, 1.95, BX + 3.5, 1.03, -2.25, glassSide); gw(.04, 1.52, 1.95, BX + 3.5, 2.6, -2.25, glassUp);
for (let i = -3; i <= 3; i++) box(clinic, .05, 3.2, .08, mullion, BX + i * 1.0, 1.9, FZ + .02, false);
box(clinic, 7.1, .06, .1, mullion, BX, 1.02, FZ + .02, false); box(clinic, 7.1, .06, .1, mullion, BX, 2.6, FZ + .02, false);
for (let i = 0; i <= 3; i++) box(clinic, .08, 3.0, .05, mullion, BX + 3.5, 1.9, -3.2 + i * .64, false);
box(clinic, 2.8, .1, 1.7, M(C.white), BX, 1.55, FZ + .85);
[-1.3, 1.3].forEach(dx => cyl(clinic, .05, .05, 1.3, 10, steel, BX + dx, .85, FZ + 1.6));
box(clinic, 1.05, 1.3, .03, M(0x2a3a44, { transparent: true, opacity: .25, depthWrite: false }), BX, .95, FZ + .03, false); box(clinic, .04, 1.3, .06, M(0x8896a3), BX, .95, FZ + .05, false);
for (const dx of [-1.44, 1.44]) { box(clinic, .55, .4, .55, M(C.stone), BX + dx * 1.2, .45, FZ + 1.1, true); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.34, 0), M(0x4aa66a)); b.position.set(BX + dx * 1.2, .85, FZ + 1.1); b.castShadow = true; clinic.add(b); }
box(clinic, 2.6, .08, .5, M(C.stone), BX, .26, FZ + .98, false); box(clinic, 2.6, .08, .3, M(C.stone), BX, .22, FZ + 1.3, false);
for (let x = BX - 3.3; x <= BX + 3.3; x += .55) box(clinic, .05, 1.5, .22, fin, x, 2.55, FZ + .1, true);
const rail = glassTint(.25); gw(7.0, .62, .03, BX, 3.7, FZ + .02, rail); gw(.03, .62, 2.0, BX + 3.5, 3.7, -2.3, rail);
for (let i = 0; i < 4; i++) { box(clinic, .9, .32, .38, M(C.stone), BX - 2.8 + i * 1.7, 3.6, FZ - .22); const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 0), M(i % 2 ? 0x56ab5e : 0x64b96a)); bush.position.set(BX - 2.8 + i * 1.7, 3.95, FZ - .22); bush.castShadow = true; clinic.add(bush); }
for (let i = 0; i < 3; i++) { box(clinic, .45, .12, .95, M(0xf3ece0), BX + 1.2 + i * .7, 3.58, -2.5); box(clinic, .45, .35, .1, M(0xf3ece0), BX + 1.2 + i * .7, 3.76, -2.95).rotation.x = -.5; }
{ const u = new THREE.Mesh(new THREE.ConeGeometry(.9, .3, 8), M(C.coral)); u.position.set(BX - .9, 4.5, -2.4); u.castShadow = true; clinic.add(u); cyl(clinic, .03, .03, 1.2, 6, M(0xeeeeee), BX - .9, 3.95, -2.4); cyl(clinic, .4, .4, .05, 12, M(C.white), BX - .9, 3.75, -2.4); }
{ const wm = new THREE.MeshStandardMaterial({ color: 0xbfe3f0, roughness: .1, emissive: 0xffd9a0, emissiveIntensity: 0 }); interiorMats.push(wm); box(clinic, 6.4, .8, .04, wm, BX, 4.05, CORE_Z1 + .02, false); }
const signTex = canvasTex(1024, 200, (g, w, h) => {
  g.fillStyle = '#0d7d73'; g.beginPath(); g.roundRect(0, 0, w, h, 26); g.fill();
  g.fillStyle = '#fff'; g.font = '700 84px Georgia,serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('Discovery', 190, 78); g.fillStyle = '#9ff5ea'; g.font = 'italic 700 84px Georgia,serif'; g.fillText('Dental', 640, 78);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '500 28px Arial,sans-serif'; g.fillText('AJAX · FAMILY & EMERGENCY CARE', 192, 152);
  g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineJoin = 'round'; g.beginPath(); g.moveTo(100, 40); g.bezierCurveTo(70, 40, 62, 55, 52, 55); g.bezierCurveTo(30, 55, 22, 85, 34, 110); g.bezierCurveTo(46, 138, 46, 170, 62, 170); g.bezierCurveTo(78, 170, 78, 130, 100, 130); g.bezierCurveTo(122, 130, 122, 170, 138, 170); g.bezierCurveTo(154, 170, 154, 138, 166, 110); g.bezierCurveTo(178, 85, 170, 55, 148, 55); g.bezierCurveTo(138, 55, 130, 40, 100, 40); g.stroke();
});
const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: .6 });
const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .7), signMat); sign.position.set(BX - 1.2, 4.15, CORE_Z1 + .26); sign.castShadow = true; clinic.add(sign); box(clinic, 3.7, .8, .06, M(C.tealD), BX - 1.2, 4.15, CORE_Z1 + .22);
const mkBoard = (txt, col) => canvasTex(256, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 62px Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); });
const TEX_OPEN = mkBoard('OPEN', '#16b3a3'), TEX_CLOSED = mkBoard('CLOSED', '#e5483b');
const boardMat = new THREE.MeshStandardMaterial({ map: TEX_OPEN, roughness: .6 });
const board = new THREE.Mesh(new THREE.PlaneGeometry(.5, .25), boardMat); board.position.set(BX + 1.0, 1.15, FZ + .08); clinic.add(board);
// interior
const warm = new THREE.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffd48a, emissiveIntensity: 0 }); interiorMats.push(warm);
box(clinic, 1.9, .55, .55, M(C.white), BX - 1.9, .6, -2.5); box(clinic, 1.9, .06, .62, M(C.teal), BX - 1.9, .9, -2.5); box(clinic, 1.7, .5, .08, M(C.teal), BX - 1.9, .62, -2.2);
[-2.5, -1.9].forEach(x => { cyl(clinic, .14, .14, .06, 10, M(C.coral), BX + x + .9, .62, -2.0); cyl(clinic, .03, .03, .3, 6, steel, BX + x + .9, .45, -2.0); });
box(clinic, 1.5, .28, .6, M(0xf0e3cf), BX + 1.6, .52, -2.0); box(clinic, 1.5, .4, .14, M(0xf0e3cf), BX + 1.6, .72, -2.28); box(clinic, .7, .1, .4, M(C.wood), BX + 1.6, .46, -1.5);
box(clinic, .55, .28, .6, M(C.coral), BX + .4, .5, -2.9); box(clinic, 1.1, .5, .3, new THREE.MeshStandardMaterial({ color: 0x86e0ee, transparent: true, opacity: .6, emissive: 0x4fd0e8, emissiveIntensity: .35 }), BX + 2.8, .62, -2.85);
for (const x of [BX - 3.2, BX + 3.1]) { cyl(clinic, .17, .13, .3, 8, M(C.stone), x, .45, -1.7); const p = new THREE.Mesh(new THREE.ConeGeometry(.28, .9, 7), M(0x4aa66a)); p.position.set(x, 1.0, -1.7); clinic.add(p); }
for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), warm); p.position.set(BX - 2.6 + i * 1.7, 1.45, -2.0); clinic.add(p); cyl(clinic, .008, .008, .25, 4, steel, BX - 2.6 + i * 1.7, 1.6, -2.0); }
function opChair(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 1.85, z); g.rotation.y = ry; cyl(g, .14, .2, .08, 10, steel, 0, .04, 0); cyl(g, .05, .05, .3, 8, steel, 0, .22, 0); box(g, .46, .1, .62, M(C.teal), 0, .4, .02); const back = box(g, .46, .08, .56, M(C.teal), 0, .55, -.52); back.rotation.x = .45;
  box(g, .1, .55, .08, steel, .38, .55, .5); box(g, .5, .05, .05, steel, .38, .85, .5); box(g, .22, .06, .22, warm, .2, .82, .5);
  box(g, .4, .28, .05, M(0x1c2a33), -.5, .6, -.2).rotation.y = .5; clinic.add(g); }
opChair(BX - 3.0, -2.5, .3); opChair(BX - .9, -2.5, 0); opChair(BX + 1.2, -2.5, -.3); opChair(BX + 2.8, -2.3, -.5);
box(clinic, .6, .5, .5, M(0xf0f3f5), BX + 3.2, 2.1, -3.0); for (let i = 0; i < 3; i++) box(clinic, 1.1, .08, .3, M(C.stone), BX - 2.2 + i * 1.3, 2.4, -3.05);
box(clinic, 1.3, .5, .9, M(0xe3e8ec), BX + 2.5, 5.2, -4.8); cyl(clinic, .25, .25, .12, 12, steel, BX + 2.5, 5.52, -4.8);
for (let i = 0; i < 5; i++) { const p = box(clinic, .8, .05, 1.0, M(0x2c3e8f, { metalness: .3, roughness: .35 }), BX - 3.0 + i * .9, 5.1, -4.3); p.rotation.x = -.3; }
const statue = new THREE.Group(); clinic.add(statue); statue.position.set(BX - .4, 4.93, -4.15);
cyl(statue, 1.05, 1.2, .28, 28, M(C.tealD), 0, .14, 0); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .03, 8, 48), new THREE.MeshBasicMaterial({ color: 0x9ff5ea })); ring.rotation.x = Math.PI / 2; ring.position.y = .3; statue.add(ring);
const toothGroup = new THREE.Group(); statue.add(toothGroup); toothGroup.position.y = .28;
{ const pts = new THREE.SplineCurve([[.5, 0], [.68, .09], [.88, .27], [1.02, .5], [1.03, .68], [.93, .85], [.76, .95], [.5, .995], [0, 1.01]].map(p => new THREE.Vector2(p[0], p[1]))).getPoints(36).map(p => new THREE.Vector2(Math.max(0, p.x), p.y)); const g = new THREE.LatheGeometry(pts, 40); const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), w = Math.min(1, Math.max(0, (y - .55) / .45)); pos.setY(i, y + w * .2 * Math.pow(Math.abs(Math.sin(2.7 * x) * Math.sin(2.7 * z)), .6)); }
  g.scale(1.2, 1.3, 1.15); g.translate(0, 1.0, 0); g.computeVertexNormals();
  const crown = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .18, emissive: 0xffffff, emissiveIntensity: .05 })); crown.castShadow = true; toothGroup.add(crown);
  [-.42, .42].forEach(sx => { const r = new THREE.Mesh(new THREE.ConeGeometry(.4, 1.2, 10), M(0xf0e7cf)); r.rotation.set(Math.PI, 0, sx * -.18); r.position.set(sx, .55, 0); r.castShadow = true; toothGroup.add(r); }); }
cyl(clinic, .025, .025, 1.6, 6, steel, BX - 3.2, 5.7, -5.0); box(clinic, .7, .35, .02, teal, BX - 2.85, 6.25, -5.0, false);

/* landscaping, cafe annex, bay, kids, lamps */
const cafe = new THREE.Group(); campus.add(cafe);
box(cafe, 2.6, 2.0, 3.0, M(0xfff1de), 4.0, 1.2, -3.0); box(cafe, 2.8, .15, 3.2, M(C.coral), 4.0, 2.28, -3.0); box(cafe, 1.2, .5, 1.0, M(0xe3e8ec), 4.4, 2.6, -3.4);
{ const cg = box(cafe, 1.7, .95, .04, glassTint(.35), 4.0, 1.1, -1.48, false); cg.renderOrder = 2; box(cafe, 1.8, 1.05, .05, M(C.white), 4.0, 1.1, -1.5, false); }
for (let i = 0; i < 6; i++) { const a = box(cafe, .43, .06, 1.0, M(i % 2 ? C.white : C.teal), 2.95 + i * .42, 1.7, -1.1); a.rotation.x = .35; }
const cups = [];
for (const [tx, tz] of [[3.3, -.45], [4.7, -.45]]) { cyl(cafe, .38, .38, .06, 14, M(C.white), tx, .72, tz); cyl(cafe, .05, .05, .6, 6, steel, tx, .4, tz); cyl(cafe, .2, .2, .06, 8, steel, tx, .26, tz); cyl(cafe, .09, .07, .14, 10, M(C.coral), tx - .1, .82, tz); cyl(cafe, .09, .07, .14, 10, M(C.gold), tx + .12, .82, tz + .05); cups.push([tx - .1, .95, tz], [tx + .12, .95, tz + .05]); const u = new THREE.Mesh(new THREE.ConeGeometry(.75, .28, 8), M(tx > 4 ? C.teal : C.coral)); u.position.set(tx, 1.85, tz); u.castShadow = true; cafe.add(u); cyl(cafe, .025, .025, 1.2, 6, M(0xeeeeee), tx, 1.3, tz); }
const puffs = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.09, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); scene.add(m); puffs.push({ m, c: cups[i % cups.length], t: R() * 3 }); }
for (let i = 0; i < 6; i++) box(campus, .8, .4, .35, M(0x5aa863), -4.4 + i * .85, .42, -.55, true);
for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 0), M([C.coral, C.gold, 0xffffff, 0xd6a9ff][i % 4])); f.position.set(.8 + (i % 7) * .22, .5, -.6 + Math.floor(i / 7) * .25); campus.add(f); }
const swayTrees = [];
function ctree(x, z, s = 1, kind = 0) { const g = new THREE.Group(); g.position.set(x, .12, z); g.scale.setScalar(s); cyl(g, .1, .14, .6, 6, M(C.trunk), 0, .3, 0); if (kind === 0) { for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.62 - i * .14, .7, 7), M(i % 2 ? 0x4aa66a : 0x3d9a5f)); c.position.y = .85 + i * .45; c.castShadow = true; g.add(c); } } else { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.62, 0), M(kind === 1 ? 0x64b96a : 0x86cc6f)); f.position.y = 1.15; f.castShadow = true; g.add(f); const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(.42, 0), M(0x56ab5e)); f2.position.set(.35, .85, .1); f2.castShadow = true; g.add(f2); } g.userData.ph = R() * 6; campus.add(g); swayTrees.push(g); }
[[-8.4, -7.2, 1.2, 0], [-6.4, -7.5, 1, 1], [-2.6, -7.8, 1.1, 0], [.4, -7.8, 1, 2], [3.2, -7.5, 1.2, 0], [6.2, -7.5, 1.1, 1], [7.4, -4.2, 1, 2], [7.2, -1.2, 1.1, 0], [6.8, 1.6, .9, 1], [-8.2, -.3, 1, 0], [8.2, 3.0, .8, 1], [-8.4, 3.0, .9, 2]].forEach(a => ctree(...a));
const lampGlows = []; const glowT = glowTex('255,214,130');
function clampLamp(x, z) { const g = new THREE.Group(); g.position.set(x, .2, z); cyl(g, .05, .07, 1.7, 6, M(0x56636f), 0, .85, 0); box(g, .5, .05, .05, M(0x56636f), .2, 1.7, 0); const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 0 })); b.position.set(.42, 1.64, 0); g.add(b); lampBulbs.push(b); const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, opacity: 0, depthWrite: false })); h.scale.setScalar(2.2); h.position.set(.42, 1.64, 0); g.add(h); lampGlows.push(h); campus.add(g); }
[[.7, .1], [-3.8, .1], [-1.5, 3.6], [5.9, 3.6], [-8.2, 3.6], [8.2, -6.2]].forEach(a => clampLamp(...a));
for (const x of [-6.0, -4.0]) { box(campus, .18, .9, .16, M(C.white), x + .55, .65, 3.1); box(campus, .1, .1, .02, new THREE.MeshBasicMaterial({ color: 0x5df2e0 }), x + .55, .95, 3.01, false); }
{ const g = new THREE.Group(); g.position.set(6.6, .2, .6); g.rotation.y = -Math.PI / 2; box(g, 1.1, .08, .35, M(C.wood), 0, .45, 0); box(g, 1.1, .35, .06, M(C.wood), 0, .7, -.16); box(g, .08, .45, .3, steel, -.45, .22, 0); box(g, .08, .45, .3, steel, .45, .22, 0); campus.add(g); }
const seesaw = new THREE.Group(); seesaw.position.set(-6.9, .75, -.8); campus.add(seesaw); box(seesaw, 1.9, .08, .3, M(C.coral), 0, 0, 0); box(seesaw, .12, .12, .4, M(C.gold), .8, .1, 0); box(seesaw, .12, .12, .4, M(C.gold), -.8, .1, 0);
{ const t = new THREE.Mesh(new THREE.ConeGeometry(.3, .55, 4), steel); t.position.set(-6.9, .57, -.8); t.rotation.y = Math.PI / 4; t.castShadow = true; campus.add(t); }
{ const g = new THREE.Group(); g.position.set(-6.7, .2, -3.6); box(g, 1.1, .1, 1.1, M(C.blue), 0, 1.0, 0); [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].forEach(([x, z]) => box(g, .09, 1.0, .09, M(C.wood), x, .5, z)); const ramp = box(g, .8, .08, 1.9, M(C.coral), 0, .5, 1.45); ramp.rotation.x = -.55; box(g, .06, .35, 1.0, M(C.gold), -.45, 1.35, 0); box(g, .06, .35, 1.0, M(C.gold), .45, 1.35, 0); campus.add(g); }
for (const [x, z, c] of [[-5.9, -3.9, C.coral], [-7.7, -4.9, C.gold]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 8), M(c)); b.position.set(x, .38, z); b.castShadow = true; campus.add(b); }
{ const g = new THREE.Group(); g.position.set(.9, .2, -.2); cyl(g, .04, .04, .9, 6, steel, -.3, .45, 0); cyl(g, .04, .04, .9, 6, steel, .3, .45, 0); box(g, .85, .5, .05, teal, 0, .95, 0); box(g, .7, .1, .06, M(C.white), 0, 1.05, .01); box(g, .5, .06, .06, M(C.gold), 0, .86, .01); campus.add(g); }
{ const t = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f4dcd7'; g.fillRect(0, 0, w, h); g.fillStyle = '#e5483b'; g.fillRect(96, 40, 64, 120); g.fillRect(64, 72, 128, 56); g.fillStyle = '#b8332a'; g.font = '800 30px Arial,sans-serif'; g.textAlign = 'center'; g.fillText('SAME-DAY CARE', 128, 220); g.strokeStyle = '#f2b84b'; g.lineWidth = 8; g.setLineDash([22, 14]); g.strokeRect(8, 8, 240, 240); });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); p.rotation.x = -Math.PI / 2; p.position.set(4.0, .275, 1.7); p.receiveShadow = true; campus.add(p); }

/* plaza fountain */
const fountain = new THREE.Group(); fountain.position.set(0, .14, 13.1); world.add(fountain);
cyl(fountain, 2.3, 2.5, .35, 40, M(C.stone), 0, .17, 0); cyl(fountain, 2.05, 2.05, .1, 40, new THREE.MeshStandardMaterial({ color: 0x7fd8ea, roughness: .05, metalness: .3, emissive: 0x2ab8d0, emissiveIntensity: .15 }), 0, .33, 0); cyl(fountain, .25, .35, .9, 12, M(C.stone), 0, .6, 0); cyl(fountain, 1.0, .7, .2, 24, M(C.stone), 0, 1.1, 0);
const jets = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: .8 })); fountain.add(m); jets.push({ m, a: i / 40 * Math.PI * 2, t: R() }); }
for (const a of [0, 1.57, 3.14, 4.71]) { const g = new THREE.Group(); g.position.set(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6); g.rotation.y = -a + Math.PI / 2; box(g, 1.1, .08, .35, M(C.wood), 0, .45, 0); box(g, 1.1, .35, .06, M(C.wood), 0, .7, -.16); fountain.add(g); }
[[-3.5, 8.4], [3.5, 8.4], [-3.5, 17.4], [3.5, 17.4], [-6.5, 13], [6.5, 13]].forEach(([x, z]) => placeTree(x, z, 1.1));

/* ───────── instanced city: trees, lamps, cars, people ───────── */
let T = 0; const dummy = new THREE.Object3D();
function instanced(geo, mat, n, cast = true) { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; world.add(m); return m; }
{
  const trunk = instanced(new THREE.CylinderGeometry(.08, .12, .6, 5), M(C.trunk), T_PINE.length + T_ROUND.length);
  const pine = instanced(new THREE.ConeGeometry(.6, 1.7, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, flatShading: true }), T_PINE.length);
  const round = instanced(new THREE.IcosahedronGeometry(.62, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, flatShading: true }), T_ROUND.length);
  const gp = [0x3d9a5f, 0x4aa66a, 0x2f8f58], gr = [0x64b96a, 0x86cc6f, 0x56ab5e]; const col = new THREE.Color(); let k = 0;
  T_PINE.forEach(([x, z, s], i) => { dummy.position.set(x, .12 + .3 * s, z); dummy.scale.setScalar(s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunk.setMatrixAt(k++, dummy.matrix); dummy.position.set(x, .12 + (.6 + .85) * s, z); dummy.updateMatrix(); pine.setMatrixAt(i, dummy.matrix); pine.setColorAt(i, col.setHex(gp[i % 3])); });
  T_ROUND.forEach(([x, z, s], i) => { dummy.position.set(x, .12 + .3 * s, z); dummy.scale.setScalar(s); dummy.updateMatrix(); trunk.setMatrixAt(k++, dummy.matrix); dummy.position.set(x, .12 + 1.1 * s, z); dummy.updateMatrix(); round.setMatrixAt(i, dummy.matrix); round.setColorAt(i, col.setHex(gr[i % 3])); });
  const lp = instanced(new THREE.CylinderGeometry(.04, .06, 1.6, 5), M(0x56636f), lamps.length); const lb = instanced(new THREE.SphereGeometry(.1, 6, 5), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd27a, emissiveIntensity: 0 }), lamps.length, false); lampBulbs.push(lb);
  lamps.forEach(([x, z], i) => { dummy.scale.setScalar(1); dummy.position.set(x, .8, z); dummy.updateMatrix(); lp.setMatrixAt(i, dummy.matrix); dummy.position.set(x, 1.62, z); dummy.updateMatrix(); lb.setMatrixAt(i, dummy.matrix); });
}

/* street furniture: bins, hydrants, bus shelters, traffic lights */
for (let i = 0; i < lamps.length; i += 3) { const [lx, lz] = lamps[i]; if (Math.abs(lx) > 70 || Math.abs(lz) > 70) continue; ROOFS.box(lx + .5, .12, lz + .1, .26, .5, .26, 0x3d5a52); ROOFS.box(lx + .5, .62, lz + .1, .3, .06, .3, 0x2b3a36); if (i % 2) { ROOFS.box(lx - .5, .12, lz - .2, .16, .38, .16, 0xd23b2e); ROOFS.box(lx - .5, .5, lz - .2, .22, .07, .22, 0xd23b2e); } }
for (const bx of [-30, 30, -16, 16]) { const sz = RZ[4] - 1.9; ROOFS.box(bx, .12, sz, 2.6, .08, .9, 0xcfd6dc); ROOFS.box(bx, 1.6, sz, 2.6, .1, 1.0, 0x16b3a3); ROOFS.box(bx, .2, sz - .42, 2.4, 1.4, .06, 0xbfe3f0); for (const dx of [-1.2, 1.2]) ROOFS.box(bx + dx, .2, sz + .3, .06, 1.4, .06, 0x56636f); ROOFS.box(bx, .5, sz, 1.6, .08, .4, 0xc99a62); }
for (const x of RX) for (const z of RZ) { if (Math.abs(x) > 60 || Math.abs(z) > 60) continue; for (const [sx, sz] of [[1, 1], [-1, -1]]) { const px = x + sx * 1.9, pz = z + sz * 1.9; ROOFS.box(px, .12, pz, .09, 2.1, .09, 0x2b3138); ROOFS.box(px - sx * .22, 2.05, pz, .5, .09, .09, 0x2b3138); ROOFS.box(px - sx * .45, 1.78, pz, .22, .5, .22, 0x1f252b); tlights.push([px - sx * .45, 1.9, pz, x, z]); } }
const groundMesh = GROUND.mesh(cityMat, false, true); world.add(groundMesh); world.add(WALLS.mesh(wallMat, true, true)); world.add(ROOFS.mesh(cityMat, true, true));
rooftops.slice(0, 5).forEach((r, i) => { const t = canvasTex(512, 160, (g, w, h) => { g.fillStyle = ['#16b3a3', '#ef6a54', '#3b5bdb'][i % 3]; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '700 54px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['Smile, Ajax.', 'Same-day care', 'Invisalign®'][i % 3], w / 2, h / 2); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .75), new THREE.MeshStandardMaterial({ map: t })); m.position.set(r.x, r.y + 1.5, r.z + .1); m.castShadow = true; world.add(m); });


const tlMesh = instanced(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), tlights.length * 3, false); tlMesh.castShadow = false;
const TLC = [new THREE.Color(0x2bff6a), new THREE.Color(0xffc23a), new THREE.Color(0xff3b2a)];
let tlClock = 0; function updateTL(dt) { tlClock -= dt; if (tlClock > 0) return; tlClock = .4; const ph = Math.floor(T / 7) % 2; tlights.forEach(([x, y, z, gx, gz], i) => { const par = (Math.round(gx) + Math.round(gz)) & 1; const g = (ph ^ par) === 0; [2, 1, 0].forEach((lens, k) => { dummy.position.set(x, y + (k - 1) * .16, z + 0); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); tlMesh.setMatrixAt(i * 3 + k, dummy.matrix); tlMesh.setColorAt(i * 3 + k, (g ? (k === 2) : (k === 0)) ? (g ? TLC[0] : TLC[2]) : new THREE.Color(0x1a1f24)); }); }); tlMesh.instanceMatrix.needsUpdate = true; tlMesh.instanceColor.needsUpdate = true; }
const ponds = []; parkBlocks.forEach(b => { if (b.cx > 30 && b.cz > 9 && b.cz < 16) return; const r = Math.min(b.w, b.d) * .17; const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + .22, r + .25, .22, 36), M(C.stone)); ring.position.set(b.cx, .2, b.cz); ring.castShadow = ring.receiveShadow = true; world.add(ring); const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .05, 36), new THREE.MeshPhysicalMaterial({ color: 0x4fb8d4, roughness: .02, metalness: .2, clearcoat: 1, envMapIntensity: 2.5, transparent: true, opacity: .92 })); w.position.set(b.cx, .3, b.cz); w.receiveShadow = true; world.add(w); ponds.push(w); for (let k = 0; k < 4; k++) { const lily = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .02, 10), M(0x4aa66a)); lily.position.set(b.cx + (k - 1.5) * r * .35, .335, b.cz + Math.sin(k * 2) * r * .4); world.add(lily); } });
/* traffic (instanced, detailed: sculpted body, glass, rimmed wheels, lights) */
const PAL = [0x3b5bdb, 0xef6a54, 0xf2b84b, 0x2fb7a8, 0xf5f5f2, 0x7a5cd6, 0x2d3b4a, 0xe8dcc4];
const NCARS = IS_MOBILE ? 36 : 70;
function carParts() {
  const paint = [], glass = [], wheels = [], lights = [], tail = [];
  const add = (arr, g, x = 0, y = 0, z = 0) => { g.translate(x, y, z); arr.push(g); };
  const body = new RoundedBoxGeometry(1.0, .36, 1.95, 3, .12); add(paint, body, 0, .34, 0);
  const hood = new RoundedBoxGeometry(.96, .12, .62, 3, .05); add(paint, hood, 0, .5, .66);
  const trunk = new RoundedBoxGeometry(.96, .12, .5, 3, .05); add(paint, trunk, 0, .5, -.7);
  const cab = new RoundedBoxGeometry(.86, .34, .98, 3, .13); add(glass, cab, 0, .68, -.05);
  const roof = new RoundedBoxGeometry(.8, .06, .74, 3, .03); add(paint, roof, 0, .86, -.05);
  [[-.5, .62], [.5, .62], [-.5, -.62], [.5, -.62]].forEach(([x, z]) => { const t = new THREE.CylinderGeometry(.21, .21, .17, 14); t.rotateZ(Math.PI / 2); add(wheels, t, x, .22, z); });
  [-.3, .3].forEach(x => { add(lights, new RoundedBoxGeometry(.2, .08, .05, 2, .02), x, .42, .99); add(tail, new RoundedBoxGeometry(.2, .07, .05, 2, .02), x, .42, -.99); });
  const m = (a) => mergeGeometries(a.map(g => g.index ? g.toNonIndexed() : g));
  return { paint: m(paint), glass: m(glass), wheels: m(wheels), lights: m(lights), tail: m(tail) };
}
const CP = carParts();
const carPaint = instanced(CP.paint, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .32, metalness: .35, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.4 }), NCARS);
const carGlass = instanced(CP.glass, new THREE.MeshPhysicalMaterial({ color: 0x1d2a35, roughness: .05, metalness: .6, envMapIntensity: 2.2, clearcoat: 1 }), NCARS, false);
const carWh = instanced(CP.wheels, M(0x23282e, { roughness: .9 }), NCARS, false);
const carRim = instanced(CP.lights, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c4, emissiveIntensity: 0, metalness: .9, roughness: .25 }), NCARS, false);
const carTail = instanced(CP.tail, new THREE.MeshStandardMaterial({ color: 0xaa1b14, emissive: 0xff2a18, emissiveIntensity: 0 }), NCARS, false);
const carSets = [carPaint, carGlass, carWh, carRim, carTail];
const cars = []; { const col = new THREE.Color(); for (let i = 0; i < NCARS; i++) { const alongX = i % 2 === 0; const roads = alongX ? RZ : RX; const rd = roads[Math.floor(R() * roads.length)]; const lane = R() > .5 ? 1 : -1; cars.push({ alongX, rd, lane, t: -80 + R() * 160, sp: 2.2 + R() * 2.2 }); carPaint.setColorAt(i, col.setHex(PAL[Math.floor(R() * PAL.length)])); } }
function updateCars(dt, f) {
  cars.forEach((c, i) => { c.t += c.lane * c.sp * dt * f; if (c.t > 78) c.t = -78; if (c.t < -78) c.t = 78; const off = c.lane * (c.alongX ? 1 : -1) * -.72; const x = c.alongX ? c.t : c.rd + off, z = c.alongX ? c.rd + off : c.t; const yaw = c.alongX ? (c.lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.lane > 0 ? 0 : Math.PI);
    dummy.scale.setScalar(1); dummy.rotation.set(0, yaw, 0); dummy.position.set(x, .06, z); dummy.updateMatrix(); carSets.forEach(s => s.setMatrixAt(i, dummy.matrix)); });
  carSets.forEach(s => s.instanceMatrix.needsUpdate = true); if (carPaint.instanceColor) carPaint.instanceColor.needsUpdate = true;
}
/* pedestrians (instanced, torso + head + swinging legs + arms) */
const NP = IS_MOBILE ? 40 : 90;
const pTorso = instanced(new RoundedBoxGeometry(.26, .34, .17, 2, .06), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7 }), NP), pHead = instanced(new THREE.SphereGeometry(.085, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }), NP, false);
const pLegs = instanced(new RoundedBoxGeometry(.1, .3, .1, 2, .03).translate(0, -.15, 0), M(0x2d3b4a), NP * 2, false), pArms = instanced(new RoundedBoxGeometry(.07, .28, .07, 2, .025).translate(0, -.13, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7 }), NP * 2, false);
const peds = []; { const col = new THREE.Color(), SK = [0xf1c9a5, 0xd9a47a, 0x9a6a47, 0xf6d7bd], SH = [0x3b5bdb, 0xef6a54, 0xf2b84b, 0x2fb7a8, 0x7a5cd6, 0xf5f5f2]; for (let i = 0; i < NP; i++) { const alongX = R() > .5; const roads = alongX ? RZ : RX; peds.push({ alongX, rd: roads[Math.floor(R() * roads.length)], side: R() > .5 ? 1 : -1, t: -70 + R() * 140, sp: (.5 + R() * .5) * (R() > .5 ? 1 : -1), ph: R() * 6 }); pTorso.setColorAt(i, col.setHex(SH[i % SH.length])); pHead.setColorAt(i, col.setHex(SK[i % SK.length])); pArms.setColorAt(i * 2, col.setHex(SH[i % SH.length])); pArms.setColorAt(i * 2 + 1, col.setHex(SH[i % SH.length])); } }
function updatePeds(dt, f) {
  peds.forEach((p, i) => { p.t += p.sp * dt * f; if (p.t > 72) p.t = -72; if (p.t < -72) p.t = 72; p.ph += dt * 8; const o = p.side * 2.05; const x = p.alongX ? p.t : p.rd + o, z = p.alongX ? p.rd + o : p.t; const yaw = p.alongX ? (p.sp > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.sp > 0 ? 0 : Math.PI); const bob = Math.abs(Math.sin(p.ph)) * .03, sw = Math.sin(p.ph) * .6;
    const put = (mesh, idx, px, py, pz, rx = 0) => { dummy.rotation.set(rx, yaw, 0); dummy.position.set(x + Math.cos(yaw) * px + Math.sin(yaw) * pz, py, z - Math.sin(yaw) * px + Math.cos(yaw) * pz); dummy.updateMatrix(); mesh.setMatrixAt(idx, dummy.matrix); };
    dummy.scale.setScalar(1); put(pTorso, i, 0, .56 + bob, 0); put(pHead, i, 0, .86 + bob, 0); put(pLegs, i * 2, -.06, .4 + bob, 0, sw); put(pLegs, i * 2 + 1, .06, .4 + bob, 0, -sw); put(pArms, i * 2, -.17, .72 + bob, 0, -sw); put(pArms, i * 2 + 1, .17, .72 + bob, 0, sw); });
  [pTorso, pHead, pLegs, pArms].forEach(m => m.instanceMatrix.needsUpdate = true); [pTorso, pHead, pArms].forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
}

/* landmarks & sky life */
const ferris = new THREE.Group(); { const fb = blocks.find(b => b.kind === 'ferris'); ferris.position.set(fb ? fb.cx : 32, .12, fb ? fb.cz : 13); world.add(ferris);
  const wheel = new THREE.Group(); wheel.position.y = 5.4; ferris.add(wheel); ferris.userData.wheel = wheel; wheel.userData.g = []; const rm = M(0xf5f7fa), rm2 = M(C.teal);
  for (const z of [-.5, .5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(4.2, .09, 8, 60), rm); r.position.z = z; r.castShadow = true; wheel.add(r); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const sp = box(wheel, .05, 4.2, .05, rm2, Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0); sp.rotation.z = a - Math.PI / 2; const gnd = new THREE.Group(); gnd.position.set(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0); box(gnd, .6, .5, .8, M([C.coral, C.gold, C.blue, C.teal][i % 4]), 0, -.4, 0); wheel.add(gnd); wheel.userData.g.push(gnd); }
  box(wheel, .5, .5, 1.4, rm2, 0, 0, 0);
  for (const s of [-1, 1]) for (const zz of [-.9, .9]) { const leg = box(ferris, .14, 6.2, .14, rm, s * 1.7, 2.7, zz); leg.rotation.z = -s * .32; } }
const heli = new THREE.Group(); { box(heli, .5, .45, 1.3, M(C.coral), 0, 0, 0); box(heli, .12, .12, 1.0, M(C.coral), 0, .05, -1.0); const rot = new THREE.Group(); rot.position.y = .32; heli.add(rot); box(rot, 3.0, .03, .12, M(0x2b3138), 0, 0, 0); box(rot, .12, .03, 3.0, M(0x2b3138), 0, 0, 0); heli.userData.rot = rot; const beacon = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3b2a })); beacon.position.set(0, .26, -.2); heli.add(beacon); heli.userData.b = beacon; world.add(heli); }
const balloon = new THREE.Group(); { const e = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), M(C.coral)); e.scale.y = 1.15; e.position.y = 3.2; e.castShadow = true; balloon.add(e); for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.52, 14, 10, i * Math.PI / 2, Math.PI / 4), M(i % 2 ? C.white : C.gold)); s.scale.y = 1.15; s.position.y = 3.2; balloon.add(s); } box(balloon, .45, .35, .45, M(C.wood), 0, .6, 0); balloon.position.set(-30, 14, -22); world.add(balloon); }
const clouds = []; for (let i = 0; i < 7; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + R() * 1.2, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .75, flatShading: true, depthWrite: false })); s.position.set(k * 1.7 - 2.5, R() * .5, R() * 1.2); s.scale.y = .6; g.add(s); } g.position.set(-70 + i * 22, 24 + R() * 6, -34 - R() * 16); world.add(g); clouds.push(g); }
const turbines = []; for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.position.set(-62 + i * 14, 0, -66 - (i % 2) * 6); cyl(g, .1, .2, 9, 8, M(0xf2f4f6), 0, 4.5, 0); const hub = new THREE.Group(); hub.position.set(0, 9, .3); g.add(hub); for (let b = 0; b < 3; b++) { const p = new THREE.Group(); p.rotation.z = b * 2.094; box(p, .1, 3.2, .04, M(0xf8f9fb), 0, 1.6, 0); hub.add(p); } g.userData.hub = hub; g.userData.sp = .8 + R() * .6; world.add(g); turbines.push(g); }
const buses = [0, 1].map(i => { const g = new THREE.Group(); box(g, 1.1, .85, 3.4, M(C.teal), 0, .7, 0); box(g, 1.12, .3, 3.0, M(0xdff3f7, { roughness: .1 }), 0, .85, 0); box(g, 1.12, .12, 3.4, M(C.white), 0, 1.15, 0); [[-.5, 1.1], [.5, 1.1], [-.5, -1.1], [.5, -1.1]].forEach(([x, z]) => { const w = cyl(g, .25, .25, .18, 10, M(0x2b3138), x, .25, z); w.rotation.z = Math.PI / 2; }); world.add(g); g.userData = { t: -60 + i * 70 }; return g; });

/* vehicles & people at the clinic */
function car(color, { van = false } = {}) {
  const g = new THREE.Group(); const L = van ? 2.4 : 1.9, H = van ? .75 : .42;
  box(g, 1.0, H, L, M(color), 0, .22 + H / 2, 0); if (!van) box(g, .88, .34, 1.0, M(0xe8f1f6, { roughness: .2 }), 0, .22 + H + .17, -.1); else { box(g, 1.02, .5, .9, M(0xe8f1f6, { roughness: .2 }), 0, .22 + H, .75); box(g, 1.04, .12, 1.0, M(C.red), 0, .22 + H * .5, -.25); }
  [[-.5, .62], [.5, .62], [-.5, -.62], [.5, -.62]].forEach(([x, z]) => { const w = cyl(g, .22, .22, .16, 10, M(0x2b3138), x, .22, z * (L / 1.9)); w.rotation.z = Math.PI / 2; });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); world.add(g); return g;
}
[0, 1, 3].forEach((s, i) => { const c = car(PAL[(i * 2 + 1) % PAL.length]); c.position.set(SLOTS[s], .26, 2.0); c.rotation.y = Math.PI; });
const amb = car(0xffffff, { van: true }); amb.visible = false;
const beaconR = new THREE.MeshBasicMaterial({ color: 0xff3b2a }), beaconB = new THREE.MeshBasicMaterial({ color: 0x3b7bff });
box(amb, .3, .12, .22, beaconR, -.25, 1.1, .5, false); box(amb, .3, .12, .22, beaconB, .25, 1.1, .5, false);
const bayRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 48), new THREE.MeshBasicMaterial({ color: 0xff5a46, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); bayRing.rotation.x = -Math.PI / 2; bayRing.position.set(4.0, .3, 1.7); world.add(bayRing);
const ambState = { phase: 'idle', t: 8, i: 0, wp: [], wait: 0 };
const AMB_PATH = [[11.5, 5.0], [4.0, 5.0], [4.0, 2.2]];
function dispatchAmb() { if (ambState.phase !== 'idle') return; ambState.phase = 'in'; ambState.wp = AMB_PATH.map(p => new THREE.Vector3(p[0], .26, p[1])); ambState.i = 1; amb.position.copy(ambState.wp[0]); amb.visible = true; amb.rotation.y = -Math.PI / 2; }
const SKIN = [0xf1c9a5, 0xd9a47a, 0x9a6a47, 0xf6d7bd], SHIRT = [0x3b5bdb, 0xef6a54, 0xf2b84b, 0x2fb7a8, 0x7a5cd6, 0xf5f5f2];
function person(kid = false) { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .3, 2, 6), M(SHIRT[Math.floor(R() * SHIRT.length)])); body.position.y = .34; body.castShadow = true; g.add(body); const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.115, 1), M(SKIN[Math.floor(R() * SKIN.length)])); head.position.y = .72; head.castShadow = true; g.add(head); const hair = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6, 0, 6.28, 0, 1.2), M([0x2d2a26, 0x7a4a24, 0xd8b45a, 0x1b1b1b][Math.floor(R() * 4)])); hair.position.y = .75; g.add(hair); if (kid) g.scale.setScalar(.72); g.visible = false; world.add(g); return g; }
const DOOR = new THREE.Vector3(BX, .3, -1.0);
const walkers = Array.from({ length: IS_MOBILE ? 6 : 10 }, (_, i) => ({ g: person(i % 4 === 3), state: 'wait', t: 1 + i * 1.5, path: [], pi: 0, spd: .8 + R() * .35, ph: R() * 6, vis: 0 }));
function planWalker(w, inbound) { const s = [0, 1, 3][Math.floor(R() * 3)], sx = SLOTS[s] + .75; const car_ = new THREE.Vector3(sx, .26, 1.9), a = new THREE.Vector3(sx, .26, .5), b = new THREE.Vector3(BX + (R() - .5) * .6, .26, .5); w.path = inbound ? [car_, a, b, DOOR.clone()] : [DOOR.clone(), b, a, car_]; w.pi = 1; w.g.position.copy(w.path[0]); w.state = inbound ? 'in' : 'out'; w.g.visible = true; }

/* ───────── hotspots & content ───────── */
const ZONES = [
  { id: 'reception', pos: [BX, 1.9, -1.0], name: 'Reception', kicker: 'Meet the doctor', title: 'Welcome — you’re among friends', text: 'Dr. Mitchel Shields and the Discovery Dental team provide compassionate dentistry to patients across the Durham region.', list: ['Attentive & calming staff', 'Gentle techniques for even the most anxious patients', 'Solutions, not judgement'], link: ['about-us/', 'Meet the team ↗'], view: 'clinic' },
  { id: 'tech', pos: [BX + 1.2, 3.3, FZ], name: 'iTero & x-rays', kicker: 'Today’s technology', title: 'Precise, digital, comfortable', text: 'Modern tools give a clear picture of your smile and keep every visit efficient.', list: ['iTero digital scanner', 'Digital x-rays', 'Invisalign® planning', 'Conscious sedation'], link: ['services/', 'See all services ↗'], view: 'clinic' },
  { id: 'smile', pos: [BX - .4, 7.2, -4.15], name: 'Smile studio', kicker: 'Cosmetic & restorative', title: 'Make people say “wow”', text: 'From a brighter shade to a fully rebuilt smile — the transformations start here.', list: ['Invisalign® clear aligners', 'Porcelain veneers & whitening', 'Dental implants, crowns & bridges', 'Smile makeovers'], link: ['veneers/', 'Explore veneers ↗'], view: 'clinic' },
  { id: 'emergency', pos: [4.0, 1.6, 1.7], name: 'Emergency bay', kicker: 'Same-day relief', title: 'Toothaches don’t wait', text: 'We keep time open daily for urgent cases and aim to ease your pain fast.', list: ['Severe toothaches', 'Broken or chipped teeth', 'Lost fillings or crowns', 'Knocked-out teeth, swelling or abscesses'], link: ['emergency-dentistry-ajax/', 'Emergency dentist ↗'], view: 'bay', act: dispatchAmb },
  { id: 'cafe', pos: [4.0, 2.8, -1.5], name: 'Tea & coffee bar', kicker: 'Warm & welcoming', title: 'More like visiting friends', text: 'Small-town ambience with big-city amenities — settle in with a hot drink in a relaxed waiting area.', list: ['Tea & coffee bar', 'Relaxed waiting area', 'Calm, attentive team'], link: ['new-patients/', 'New patient? Start here ↗'], view: 'cafe' },
  { id: 'kids', pos: [-6.7, 2.2, -2.8], name: 'Kids’ corner', kicker: 'Family dentistry', title: 'Smiles for every age', text: 'Children should see a dentist twice a year. After-school appointments are available Monday to Thursday.', list: ['Preventive care & dental sealants', 'Fillings and routine cleanings', 'Hygienists who teach simple home care'], link: ['family-dentistry/', 'Family dentistry ↗'], view: 'play' },
  { id: 'pay', pos: [.9, 1.5, -.2], name: 'Plans & payments', kicker: 'Easy on your budget', title: 'Coverage that makes sense', text: 'Most insurance plans are accepted and the team handles your claims for you.', list: ['We submit claims on your behalf', 'Monthly financing for up to five years', '10% seniors discount for patients over 65'], link: ['contact/', 'Ask about coverage ↗'], view: 'clinic' }
];
const CHIPS = [['Invisalign®', 'smile'], ['Veneers', 'smile'], ['Whitening', 'smile'], ['Implants', 'smile'], ['Crowns & bridges', 'smile'], ['Emergency', 'emergency'], ['Family dentistry', 'kids'], ['Fillings & sealants', 'kids'], ['Digital x-rays', 'tech'], ['Sedation', 'tech'], ['Insurance', 'pay']];
const VIEWS = {
  overview: { t: [0, 1, 2], z: IS_MOBILE ? 32 : 26, az: Math.PI / 4 }, city: { t: [0, 1, 0], z: IS_MOBILE ? 62 : 58, az: Math.PI / 4 + .25 }, clinic: { t: [-1.2, 2.2, -2.2], z: IS_MOBILE ? 17 : 13.5, az: Math.PI / 4 - .12 },
  bay: { t: [3.6, .8, 1.6], z: IS_MOBILE ? 13 : 11, az: Math.PI / 4 + .65 }, cafe: { t: [3.8, 1.2, -2.4], z: IS_MOBILE ? 13 : 11, az: Math.PI / 4 + .5 }, play: { t: [-6.2, .8, -2.4], z: IS_MOBILE ? 13 : 11, az: Math.PI / 4 - .6 }
};
const goal = { tx: 0, ty: 0, tz: 0, z: VIEWS.overview.z, az: VIEWS.overview.az, el: .62 }, cam = { ...goal, z: VIEWS.overview.z * 1.5, az: VIEWS.overview.az - .7 };
function setView(name) { const v = VIEWS[name]; goal.tx = v.t[0]; goal.ty = v.t[1]; goal.tz = v.t[2]; goal.z = v.z; goal.az = v.az; $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.view === name)); }
$$('#views button').forEach(b => b.addEventListener('click', () => { setView(b.dataset.view); selectZone(null); }));
const pinsEl = $('#pins'), pinEls = ZONES.map((z, i) => { const b = document.createElement('button'); b.className = 'pin'; b.setAttribute('aria-label', z.name); b.innerHTML = '<span class="dot">' + (i + 1) + '</span><span class="lbl">' + z.name + '</span>'; b.addEventListener('click', e => { e.stopPropagation(); selectZone(z.id, true); }); pinsEl.appendChild(b); return b; });
const chipsEl = $('#chips'); CHIPS.forEach(([n, id]) => { const b = document.createElement('button'); b.textContent = n; b.dataset.z = id; b.addEventListener('click', () => selectZone(id, true)); chipsEl.appendChild(b); });
const hilite = new THREE.Mesh(new THREE.TorusGeometry(1, .05, 8, 48), new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0 })); hilite.rotation.x = Math.PI / 2; world.add(hilite);
let selected = null;
function selectZone(id, fly) {
  selected = id; const z = ZONES.find(x => x.id === id); pinEls.forEach((p, i) => p.classList.toggle('on', ZONES[i].id === id));
  if (!z) { $('#zoneKicker').textContent = 'Tap a glowing pin'; $('#zoneTitle').textContent = 'Explore the clinic'; $('#zoneText').textContent = 'Seven zones of Discovery Dental are hiding in this living 3D city. Drag to rotate, scroll to zoom, then tap a pin to dive in.'; $('#zoneList').innerHTML = ''; const l = $('#zoneLink'); l.textContent = 'See all services ↗'; l.href = BASE + 'services/'; return; }
  $('#zoneKicker').textContent = z.kicker; $('#zoneTitle').textContent = z.title; $('#zoneText').textContent = z.text; $('#zoneList').innerHTML = z.list.map(x => '<li>' + x + '</li>').join(''); const l = $('#zoneLink'); l.textContent = z.link[1]; l.href = BASE + z.link[0];
  if (fly && z.view) setView(z.view); if (z.act) z.act(); burst(new THREE.Vector3(z.pos[0], .8, z.pos[2]), 24, C.teal); ping(ZONES.indexOf(z)); hilite.position.set(z.pos[0], .35, z.pos[2]); hilite.userData.s = 0;
}
const confetti = []; const confGeo = new THREE.IcosahedronGeometry(.07, 0);
function burst(p, n = 30, col = C.teal) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(confGeo, M([col, C.gold, C.coral, 0xffffff][i % 4])); m.position.copy(p); world.add(m); confetti.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3, 2.5 + Math.random() * 3, (Math.random() - .5) * 3), life: 1.4 + Math.random() * .6 }); } }
let actx = null; function ping(i = 0) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const f = 523.25 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14][i % 7] / 12), t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.04, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .9); o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 1); } catch (e) { /* no audio */ } }

/* ───────── time, status ───────── */
const sim = { day: 1, hour: 11, live: false };
const week = $('#week'); DAYS.forEach(d => { const e = document.createElement('div'); e.innerHTML = '<i></i><span>' + d[0] + '</span>'; e.title = d; week.appendChild(e); });
const dayBox = $('#days'); DAYS.forEach((d, i) => { const b = document.createElement('button'); b.textContent = d[0]; b.title = d; b.addEventListener('click', () => { sim.day = i; sim.live = false; refreshUI(); }); dayBox.appendChild(b); });
const fmt = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const h12 = ((hh + 11) % 12) + 1; return h12 + ':' + String(mm).padStart(2, '0') + ' ' + (hh >= 12 && hh < 24 ? 'pm' : 'am'); };
const isOpen = () => sim.day <= 3 && sim.hour >= OPEN_H && sim.hour < CLOSE_H;
const slider = $('#time'); slider.addEventListener('input', () => { sim.hour = +slider.value; sim.live = false; refreshUI(); });
function torontoNow() { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()); const g = t => p.find(x => x.type === t).value; return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday')), hour: (+g('hour') % 24) + (+g('minute')) / 60 }; }
$('#liveBtn').addEventListener('click', () => { sim.live = true; const n = torontoNow(); sim.day = n.day; sim.hour = n.hour; refreshUI(); });
setInterval(() => { if (sim.live) { const n = torontoNow(); sim.day = n.day; sim.hour = n.hour; refreshUI(); } }, 30000);
function nextOpen() { for (let k = 0; k < 7; k++) { const d = (sim.day + k) % 7; if (d <= 3 && (k > 0 || sim.hour < OPEN_H)) return { d, k }; } return { d: 0, k: 1 }; }
function refreshUI() {
  const open = isOpen(); const badge = $('#badge'); badge.classList.toggle('closed', !open); $('#badgeTxt').textContent = open ? 'Open' : 'Closed'; $('#statusTitle').textContent = open ? 'Open now' : 'Closed right now';
  if (open) { const left = CLOSE_H - sim.hour; $('#statusSub').textContent = left < 1 ? 'Closing soon — last appointments wrapping up' : 'Welcoming patients until 7:00 pm'; } else { const n = nextOpen(); $('#statusSub').textContent = n.k === 0 ? 'Opens today at 8:30 am' : n.k === 1 ? 'Opens tomorrow (' + DAYS_FULL[n.d] + ') at 8:30 am' : 'Opens ' + DAYS_FULL[n.d] + ' at 8:30 am'; }
  const f = clamp((sim.hour - OPEN_H) / (CLOSE_H - OPEN_H), 0, 1); $('#clockFill').style.width = (sim.day <= 3 ? f * 100 : 0) + '%'; const mk = $('#clockNow'); mk.style.left = (f * 100) + '%'; mk.style.opacity = open ? 1 : .35;
  $('#timeOut').textContent = fmt(sim.hour); slider.value = clamp(sim.hour, +slider.min, +slider.max);
  $$('#days button').forEach((b, i) => b.classList.toggle('on', i === sim.day)); $$('#week div').forEach((e, i) => { e.className = (i <= 3 ? 'o ' : '') + (i === sim.day ? 'sel' : ''); });
  $('#liveBtn').textContent = sim.live ? 'Live · Toronto time ✓' : 'Use live Toronto time'; boardMat.map = open ? TEX_OPEN : TEX_CLOSED; boardMat.needsUpdate = true;
}
refreshUI();
const env = { s: 1 }; const cSky = new THREE.Color(), cG = new THREE.Color(), cSunA = new THREE.Color(0xffa766), cSunB = new THREE.Color(0xfff6e6);
function applyEnv(dt) {
  const h = sim.hour, tgt = clamp(Math.sin(Math.PI * (h - 5.8) / 15.2) * 1.5, 0, 1); env.s = damp(env.s, tgt, 5, dt); const s = env.s;
  const th = Math.PI * clamp((h - 6) / 14.5, 0, 1); sun.position.set(cam.tx - Math.cos(th) * 22, 9 + Math.sin(th) * 24, cam.tz + 14); sun.target.position.set(cam.tx, 0, cam.tz);
  sun.intensity = 2.5 * s; scene.environmentIntensity = .07 + .3 * s; sun.color.copy(cSunA).lerp(cSunB, clamp(s * 1.5 - .2, 0, 1)); moon.intensity = .9 * (1 - s);
  hemi.intensity = .22 + .5 * s; hemi.color.setHex(0x1b2c55).lerp(cSky.setHex(0xd8ecff), s); hemi.groundColor.setHex(0x0d1f2a).lerp(cG.setHex(0xf1ead9), s);
  const bell = Math.max(0, 1 - Math.abs(s - .3) * 5); bg.copy(BG_NIGHT).lerp(BG_DAY, s).lerp(BG_DUSK, bell * .4); scene.fog.color.copy(bg);
  const dark = s < .35; if (document.body.classList.contains('night') !== dark) document.body.classList.toggle('night', dark); $('#timeIco').textContent = s > .6 ? '☀' : s > .25 ? '🌇' : '🌙';
  const open = isOpen(), ng = 1 - s; glassMats.forEach(m => { m.emissiveIntensity = (open ? .5 : .05) * (.15 + ng * 1.3); }); interiorMats.forEach(m => { m.emissiveIntensity = (open ? 1 : .15) * (.2 + ng * 1.4); });
  signMat.emissiveIntensity = ng * .9 + .08; carRim.material.emissiveIntensity = ng * 3; carTail.material.emissiveIntensity = .15 + ng * 2.5; lampBulbs.forEach(b => b.material.emissiveIntensity = ng * 2.2); lampGlows.forEach(g => g.material.opacity = ng * .9); wallMat.emissiveIntensity = clamp(ng * 1.25 - .1, 0, 1.1);
}
/* ───────── interaction ───────── */
const ptrs = new Map(); let dragMoved = 0, pinchD = 0, auto = false;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); } });
canvas.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 1) { goal.az -= dx * .0065; goal.el = clamp(goal.el + dy * .003, .38, 1.0); } else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); goal.z = clamp(goal.z * (pinchD / d), 5.5, 70); pinchD = d; } });
const up = e => { const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if (was && dragMoved < 6 && e.type === 'pointerup') clickScene(e); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); goal.z = clamp(goal.z * Math.exp(e.deltaY * .001), 5.5, 70); }, { passive: false });
addEventListener('keydown', e => { if (e.key === 'ArrowLeft') goal.az -= .15; if (e.key === 'ArrowRight') goal.az += .15; });
$('#autoBtn').addEventListener('click', e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let toothSpin = 0, honk = 0, heliBoost = 0;
function clickScene(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (ray.intersectObject(statue, true).length) { toothSpin = Math.PI * 4; const p = new THREE.Vector3(); statue.getWorldPosition(p); p.y += 2; burst(p, 50, C.teal); ping(5); return; }
  if (amb.visible && ray.intersectObject(amb, true).length) { honk = 1.2; ping(6); return; }
  if (ray.intersectObject(heli, true).length) { heliBoost = 3; ping(4); return; }
  if (ray.intersectObject(ferris, true).length) { ferris.userData.boost = 3; ping(3); return; }
  const hit = ray.intersectObject(groundMesh, false)[0]; if (hit) burst(hit.point.clone().setY(hit.point.y + .3), 10, C.gold);
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: IS_MOBILE ? 2 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .25, .6, .92); composer.addPass(bloom); composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); camera.userData.aspect = w / h; } addEventListener('resize', resize); resize();

/* ───────── loop ───────── */
const tmp = new THREE.Vector3(); let last = performance.now(), first = false, shadowSize = 26;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  if (auto) goal.az += dt * .12;
  const k = 4.2; cam.tx = damp(cam.tx, goal.tx, k, dt); cam.ty = damp(cam.ty, goal.ty, k, dt); cam.tz = damp(cam.tz, goal.tz, k, dt); cam.z = damp(cam.z, goal.z, k, dt); cam.az = damp(cam.az, goal.az, 6, dt); cam.el = damp(cam.el, goal.el, 6, dt);
  const a = camera.userData.aspect, hh = cam.z / 2, hw = hh * a; camera.left = -hw; camera.right = hw; const shiftY = innerWidth <= 820 ? -hh * .2 : 0; camera.top = hh + shiftY; camera.bottom = -hh + shiftY; camera.updateProjectionMatrix();
  camera.position.set(cam.tx + Math.sin(cam.az) * Math.cos(cam.el) * 60, cam.ty + Math.sin(cam.el) * 60, cam.tz + Math.cos(cam.az) * Math.cos(cam.el) * 60); camera.lookAt(cam.tx, cam.ty, cam.tz); camera.updateMatrixWorld();
  const open = isOpen(); applyEnv(dt);
  const ss = clamp(cam.z * .85, 14, 42); if (Math.abs(ss - shadowSize) > .6) { shadowSize = ss; const sc = sun.shadow.camera; sc.left = -ss; sc.right = ss; sc.top = ss; sc.bottom = -ss; sc.updateProjectionMatrix(); }
  if (toothSpin > 0) { const d = Math.min(toothSpin, dt * 9); toothGroup.rotation.y += d; toothSpin -= d; } else toothGroup.rotation.y += dt * .35; toothGroup.position.y = .28 + Math.sin(T * 1.5) * .05;
  swayTrees.forEach(t => { t.rotation.z = Math.sin(T * 1.1 + t.userData.ph) * .025; }); seesaw.rotation.z = Math.sin(T * 1.6) * .22;
  puffs.forEach(p => { p.t += dt * .5; const u = p.t % 1; p.m.position.set(p.c[0] + Math.sin(u * 6 + p.t) * .05, p.c[1] + u * .9, p.c[2]); p.m.material.opacity = (1 - u) * .5 * (open ? 1 : .2); p.m.scale.setScalar(.6 + u * 1.6); });
  updateTL(dt); updateCars(dt, env.s > .2 ? 1 : .6); updatePeds(dt, env.s > .15 ? 1 : .5);
  buses.forEach((b, i) => { const u = b.userData; u.t += dt * 3.2; if (u.t > 74) u.t = -74; if (i) { b.position.set(-u.t, .12, RZ[4] - .72); b.rotation.y = -Math.PI / 2; } else { b.position.set(u.t, .12, RZ[4] + .72); b.rotation.y = Math.PI / 2; } });
  jets.forEach(j => { j.t = (j.t + dt * .7) % 1; const r = .3 + j.t * 1.7, y = 1.2 + Math.sin(j.t * Math.PI) * 1.2 - j.t * .5; j.m.position.set(Math.cos(j.a) * r, y, Math.sin(j.a) * r); j.m.material.opacity = .85 - j.t * .5; });
  const w = ferris.userData.wheel; ferris.userData.boost = Math.max(0, (ferris.userData.boost || 0) - dt); w.rotation.z -= dt * (.12 + ferris.userData.boost * .6); w.userData.g.forEach(g => { g.rotation.z = -w.rotation.z; });
  heliBoost = Math.max(0, heliBoost - dt); const ha = T * (.12 + heliBoost * .3); heli.position.set(Math.cos(ha) * 30, 15 + Math.sin(T * .5) * .6, Math.sin(ha) * 30 - 6); heli.rotation.y = -ha + Math.PI / 2; heli.userData.rot.rotation.y += dt * 30; heli.userData.b.visible = Math.sin(T * 6) > 0;
  balloon.position.x += dt * .35; balloon.position.y = 14 + Math.sin(T * .4) * .8; if (balloon.position.x > 70) balloon.position.x = -70;
  clouds.forEach((c, i) => { c.position.x += dt * (.6 + i * .05); if (c.position.x > 90) c.position.x = -90; c.children.forEach(s => { s.material.opacity = .3 + .45 * env.s; }); });
  turbines.forEach(t => { t.userData.hub.rotation.z += dt * t.userData.sp; });
  walkers.forEach((wk, i) => { const g = wk.g, sc = i % 4 === 3 ? .72 : 1;
    if (!open) { wk.vis = damp(wk.vis, 0, 6, dt); g.scale.setScalar(Math.max(.001, wk.vis * sc)); if (wk.vis < .02) { g.visible = false; wk.state = 'wait'; wk.t = 1 + R() * 3; } return; }
    if (wk.state === 'wait') { wk.t -= dt; if (wk.t <= 0) planWalker(wk, !(i % 2) || R() > .5); wk.vis = 1; return; }
    wk.vis = damp(wk.vis, 1, 6, dt); const tgt = wk.path[wk.pi]; const d = tmp.copy(tgt).sub(g.position); const dist = d.length();
    if (dist < .08) { wk.pi++; if (wk.pi >= wk.path.length) { g.visible = false; wk.state = 'wait'; wk.t = 3 + R() * 7; return; } } else { d.normalize(); g.position.addScaledVector(d, wk.spd * dt); g.rotation.y = Math.atan2(d.x, d.z); }
    wk.ph += dt * 9; g.position.y = .26 + Math.abs(Math.sin(wk.ph)) * .045; g.scale.setScalar(sc * wk.vis); });
  const as = ambState; if (!open && as.phase === 'idle') amb.visible = false; if (open && as.phase === 'idle') { as.t -= dt; if (as.t <= 0) dispatchAmb(); }
  if (as.phase === 'in' || as.phase === 'out') { const tgt = as.wp[as.i]; const d = tmp.copy(tgt).sub(amb.position); const dist = d.length();
    if (dist < .12) { as.i++; if (as.i >= as.wp.length) { if (as.phase === 'in') { as.phase = 'wait'; as.wait = 5; amb.rotation.y = Math.PI; } else { as.phase = 'idle'; amb.visible = false; as.t = 14 + R() * 10; } } }
    else { d.normalize(); amb.position.addScaledVector(d, 3.4 * dt); const ang = Math.atan2(d.x, d.z); let da = ang - amb.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); amb.rotation.y += da * Math.min(1, dt * 7); }
  } else if (as.phase === 'wait') { as.wait -= dt; if (as.wait <= 0) { as.phase = 'out'; as.wp = [new THREE.Vector3(4.0, .26, 5.0), new THREE.Vector3(-14, .26, 5.0)]; as.i = 0; } }
  const flash = amb.visible && as.phase !== 'idle'; beaconR.color.setHex(flash && Math.sin(T * 16) > 0 ? 0xff3b2a : 0x66241f); beaconB.color.setHex(flash && Math.sin(T * 16) <= 0 ? 0x3b7bff : 0x22305a);
  bayRing.material.opacity = as.phase === 'wait' ? (.4 + .4 * Math.sin(T * 8)) : damp(bayRing.material.opacity, 0, 6, dt); bayRing.scale.setScalar(1 + (as.phase === 'wait' ? Math.sin(T * 4) * .06 : 0));
  if (honk > 0) { honk -= dt; amb.position.y = .26 + Math.abs(Math.sin(honk * 14)) * .08; }
  if (selected) { hilite.userData.s = Math.min(1, (hilite.userData.s || 0) + dt * 3); hilite.scale.setScalar(.6 + hilite.userData.s * .5 + Math.sin(T * 4) * .06); hilite.material.opacity = hilite.userData.s * .85; } else hilite.material.opacity = damp(hilite.material.opacity, 0, 8, dt);
  for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.life -= dt; c.v.y -= 9 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 8; c.m.scale.setScalar(Math.max(.01, c.life)); if (c.life <= 0 || c.m.position.y < -.5) { world.remove(c.m); confetti.splice(i, 1); } }
  ZONES.forEach((z, i) => { tmp.set(z.pos[0], z.pos[1] + Math.sin(T * 2 + i) * .06, z.pos[2]).project(camera); const x = (tmp.x * .5 + .5) * innerWidth, y = (-tmp.y * .5 + .5) * innerHeight; pinEls[i].style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; });
  bloom.strength = .12 + (1 - env.s) * .7; bloom.threshold = lerp(.85, 2.4, env.s); renderer.toneMappingExposure = lerp(1.1, .92, env.s);
  composer.render();
  if (!first) { first = true; requestAnimationFrame(() => $('#loader').classList.add('done')); }
}
setView('overview'); selectZone(null); requestAnimationFrame(frame);
window.__dash = { snap() { Object.assign(cam, goal); env.s = clamp(Math.sin(Math.PI * (sim.hour - 5.8) / 15.2) * 1.5, 0, 1); }, sim, goal, selectZone, dispatchAmb, refreshUI, get env() { return env.s; } };
