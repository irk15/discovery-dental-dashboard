import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { crownGeo, rootGeo, TEX_ENAMEL_B, TEX_ENAMEL_R, TEX_ROOT_B } from './teeth.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = rng(11);
const IS_MOBILE = matchMedia('(max-width: 820px)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = 'https://discoverydental.com/';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const OPEN_H = 8.5, CLOSE_H = 19;
const PI = Math.PI, TAU = Math.PI * 2;

/* ───────── renderer / scene ───────── */
const canvas = $('#gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { $('#nogl').hidden = false; $('#loader').classList.add('done'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .85; }
const camera = new THREE.PerspectiveCamera(26, 1, .5, 260);

/* gradient sky, repainted with the time of day */
const bgCan = document.createElement('canvas'); bgCan.width = 4; bgCan.height = 256; const bgCtx = bgCan.getContext('2d');
const bgTex = new THREE.CanvasTexture(bgCan); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
const SKY = { dayT: new THREE.Color(0x8fd6e0), dayM: new THREE.Color(0xe6f0e2), dayB: new THREE.Color(0xf7d3b3), duskT: new THREE.Color(0xf29c86), duskM: new THREE.Color(0xf8cfa8), duskB: new THREE.Color(0xfde3c4), nightT: new THREE.Color(0x070f24), nightM: new THREE.Color(0x14304a), nightB: new THREE.Color(0x27495c) };
const sT = new THREE.Color(), sM = new THREE.Color(), sB = new THREE.Color();
function paintSky(s, bell) {
  sT.copy(SKY.nightT).lerp(SKY.dayT, s).lerp(SKY.duskT, bell * .6); sM.copy(SKY.nightM).lerp(SKY.dayM, s).lerp(SKY.duskM, bell * .6); sB.copy(SKY.nightB).lerp(SKY.dayB, s).lerp(SKY.duskB, bell * .6);
  const g = bgCtx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#' + sT.getHexString()); g.addColorStop(.52, '#' + sM.getHexString()); g.addColorStop(1, '#' + sB.getHexString());
  bgCtx.fillStyle = g; bgCtx.fillRect(0, 0, 4, 256); bgTex.needsUpdate = true;
}

/* lights: warm key (soft VSM shadows), cool rim, hemisphere fill, night glow */
const hemi = new THREE.HemisphereLight(0xe6f4ff, 0xf6e9d4, 1.0); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1de, 3.2); key.position.set(-9, 17, 12); key.castShadow = true; scene.add(key, key.target);
key.shadow.mapSize.set(IS_MOBILE ? 1536 : 2048, IS_MOBILE ? 1536 : 2048); key.shadow.radius = 7; key.shadow.blurSamples = 20; key.shadow.bias = -.0006; key.shadow.normalBias = .03;
Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 4, far: 60 });
const rim = new THREE.DirectionalLight(0x9fe8ff, 1.2); rim.position.set(10, 7, -12); scene.add(rim);
const glowLight = new THREE.PointLight(0xffd9a0, 0, 26, 1.6); glowLight.position.set(0, 4, 0); scene.add(glowLight);

/* ───────── materials ───────── */
const P = { white: 0xfbfaf7, cream: 0xf7f0e4, mint: 0x7ed9c7, teal: 0x16b3a3, tealD: 0x0d7d73, coral: 0xff7a63, butter: 0xffd166, peri: 0x8b97ff, lilac: 0xc9b8ff, sky: 0x8fd3ff, ink: 0x17323a, gold: 0xf2b84b, red: 0xe5483b, pink: 0xff9fa8, wood: 0xd9a76a, cocoa: 0x6b4630 };
const W = new THREE.Color(0xffffff);
const clay = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: .55, metalness: 0, sheen: 1, sheenRoughness: .55, sheenColor: new THREE.Color(hex).lerp(W, .55), clearcoat: .22, clearcoatRoughness: .5, ...o });
const gloss = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: .14, metalness: 0, clearcoat: 1, clearcoatRoughness: .035, sheen: .3, sheenColor: W, ...o });
const glassM = (hex = 0xd6f4ff, o = {}) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: .05, transmission: 1, thickness: .8, ior: 1.38, attenuationColor: new THREE.Color(hex), attenuationDistance: 2.2, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: .02, ...o });
const goldM = () => new THREE.MeshPhysicalMaterial({ color: 0xffc247, metalness: .35, roughness: .24, clearcoat: 1, clearcoatRoughness: .05, sheen: .3, sheenColor: W });
const metalM = (hex, r = .2) => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 1, roughness: r, clearcoat: .6, clearcoatRoughness: .1 });
const glowM = (hex, k = 1) => { const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: .3 }); m.userData.k = k; glowMats.push(m); return m; };
const glowMats = [];
function add(parent, geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast && !mat.transmission; m.receiveShadow = true; parent.add(m); return m; }
const rbox = (w, h, d, r = .08, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - .001));
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function glowSprite(rgb, size, op = .9) { const t = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(.35, `rgba(${rgb},.35)`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; }
function starShape(Ro, ri, n = 4) { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + PI / 2, r = i % 2 ? ri : Ro; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; }
const bev = (d, b) => ({ depth: d, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 18 });
function star(size, mat) { const g = new THREE.ExtrudeGeometry(starShape(size, size * .3, 4), bev(size * .12, size * .08)); g.center(); const m = new THREE.Mesh(g, mat); m.castShadow = false; return m; }
function pedestal(hex, r = 1.9) { const pts = [[0, 0], [r, 0], [r + .05, .05], [r + .05, .34], [r, .4], [r - .1, .44], [0, .44]].map(p => new THREE.Vector2(p[0], p[1])); const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), clay(hex)); m.castShadow = m.receiveShadow = true; return m; }

/* ───────── stage: soft floor shadow + glowing disc ───────── */
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ color: 0x1f4150, opacity: .4 })); shadowFloor.rotation.x = -PI / 2; shadowFloor.position.y = .01; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
const discTex = canvasTex(512, 512, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.55, 'rgba(255,255,255,.55)'); g.addColorStop(.82, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const disc = new THREE.Mesh(new THREE.CircleGeometry(19, 96), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, opacity: .9, depthWrite: false, toneMapped: false })); disc.rotation.x = -PI / 2; disc.position.y = .005; disc.renderOrder = -1; scene.add(disc);
const floorRing = new THREE.Mesh(new THREE.TorusGeometry(8.6, .03, 8, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, toneMapped: false })); floorRing.rotation.x = PI / 2; floorRing.position.y = .03; scene.add(floorRing);

/* ───────── hero: the pearl tooth on its pedestal ───────── */
const mE = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, roughnessMap: TEX_ENAMEL_R, ior: 1.55, specularIntensity: 1, bumpMap: TEX_ENAMEL_B, bumpScale: 1.1, clearcoat: 1, clearcoatRoughness: .05, sheen: .6, sheenRoughness: .35, sheenColor: new THREE.Color(0xfff0dc), iridescence: .25, iridescenceIOR: 1.3, envMapIntensity: 1.15, emissive: 0xfff4e6, emissiveIntensity: 0 });
const mD = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .55, bumpMap: TEX_ROOT_B, bumpScale: 1.4, clearcoat: .35, clearcoatRoughness: .4, sheen: .3, sheenColor: new THREE.Color(0xf3e2b8), envMapIntensity: .9, emissive: 0xfff0d0, emissiveIntensity: 0 });
const pearl = (m, k) => { m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, ' + k + ');'); }; };
pearl(mE, '.5'); pearl(mD, '.66');
const hero = new THREE.Group(); scene.add(hero);
{
  const base = new THREE.Group(); scene.add(base);
  base.add(pedestal(P.white, 3.1));
  const step2 = pedestal(P.mint, 2.45); step2.position.y = .44; base.add(step2);
  const cap = add(base, new THREE.CylinderGeometry(1.25, 1.45, .18, 48), gloss(P.white), 0, .96, 0);
  const crown = new THREE.Mesh(crownGeo('molar', 2.3, 1.95, .96, { segs: IS_MOBILE ? 90 : 150, prof: IS_MOBILE ? 66 : 110 }), mE); crown.castShadow = true; crown.receiveShadow = true; hero.add(crown);
  for (const d of [-1, 1]) { const r = new THREE.Mesh(rootGeo(2.1, .46, d, .45, { seg: IS_MOBILE ? 44 : 70, N: IS_MOBILE ? 36 : 60 }), mD); r.position.set(d * .42, .42, 0); r.castShadow = true; hero.add(r); }
  hero.scale.setScalar(1.3); hero.position.y = 3.84;
  hero.userData.hero = true; hero.traverse(o => { o.userData.hero = true; });
}
/* scan ring (triggered by the scanner object) */
const scanRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, .04, 12, 90), new THREE.MeshBasicMaterial({ color: 0x5df2e0, transparent: true, opacity: 0, toneMapped: false })); scanRing.rotation.x = PI / 2; scene.add(scanRing);

/* ───────── the clinic clock: a 24-hour ring around the tooth ───────── */
const RR = 4.7, RY = 3.84;
const clock = new THREE.Group(); clock.position.y = RY; scene.add(clock);
const hourAng = h => (h / 24) * TAU;
const onRing = (h, r = RR, y = 0) => new THREE.Vector3(Math.sin(hourAng(h)) * r, y, -Math.cos(hourAng(h)) * r);
add(clock, new THREE.TorusGeometry(RR, .05, 16, 160), clay(P.white), 0, 0, 0, false).rotation.x = PI / 2;
for (let h = 0; h < 24; h++) { const big = h % 6 === 0, t = add(clock, rbox(big ? .1 : .06, big ? .06 : .04, big ? .55 : .3, .02, 2), clay(big ? P.ink : P.white), 0, 0, 0, false); const p = onRing(h, RR + (big ? .55 : .3)); t.position.copy(p); t.rotation.y = -hourAng(h); }
{ const pts = []; for (let i = 0; i <= 44; i++) pts.push(onRing(OPEN_H + (CLOSE_H - OPEN_H) * i / 44, RR, 0)); const open = add(clock, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, .13, 16, false), gloss(P.teal, { emissive: P.teal, emissiveIntensity: .12 }), 0, 0, 0, false); open.userData.open = true; clock.userData.openMat = open.material;
  for (const h of [OPEN_H, CLOSE_H]) add(clock, new THREE.SphereGeometry(.13, 16, 12), open.material, onRing(h).x, 0, onRing(h).z, false); }
[[0, '12 am'], [6, '6 am'], [12, '12 pm'], [18, '6 pm']].forEach(([h, txt]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 96, (c, w, hh) => { c.font = '600 44px Inter,Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(txt, w / 2, hh / 2); c.fillStyle = '#17323a'; c.fillText(txt, w / 2, hh / 2); }), transparent: true, depthWrite: false })); s.scale.set(1.5, .56, 1); s.position.copy(onRing(h, RR + 1.25)); s.position.y = .05; clock.add(s); clock.userData['lbl' + h] = s; });
const sun = new THREE.Group(), moon = new THREE.Group(); clock.add(sun, moon);
add(sun, new THREE.SphereGeometry(.5, 40, 28), gloss(P.butter, { emissive: 0xffc24a, emissiveIntensity: .6 }), 0, 0, 0, false); sun.add(glowSprite('255,205,90', 4.2, .9));
add(moon, new THREE.SphereGeometry(.4, 40, 28), gloss(P.peri, { emissive: 0x6c79ff, emissiveIntensity: .25 }), 0, 0, 0, false); moon.add(glowSprite('150,165,255', 3.2, .75));
for (const [x, y, z, r] of [[.14, .1, .36, .1], [-.14, -.1, .34, .07]]) add(moon, new THREE.SphereGeometry(r, 12, 10), clay(0x6f7be6), x, y, z, false);

/* ───────── OPEN / CLOSED sign ───────── */
const mkBoard = (txt, col, glowCol) => canvasTex(512, 200, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col); gr.addColorStop(1, glowCol); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, w, h * .45); g.fillStyle = '#fff'; g.font = '700 112px Fraunces,Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 6); });
const TEX_OPEN = mkBoard('Open', '#27c9b6', '#0f9c8d'), TEX_CLOSED = mkBoard('Closed', '#ff8f7a', '#e0533d');
const signMat = new THREE.MeshStandardMaterial({ map: TEX_OPEN, emissiveMap: TEX_OPEN, emissive: 0xffffff, emissiveIntensity: .12, roughness: .35 });
const sign = new THREE.Group(); sign.position.set(0, 1.0, 2.9); sign.rotation.x = -.22; sign.scale.setScalar(1.15); scene.add(sign);
add(sign, rbox(2.5, 1.0, .26, .22, 6), gloss(P.white), 0, 0, 0); { const f = add(sign, new THREE.PlaneGeometry(2.2, .72), signMat, 0, 0, .14, false); }
add(sign, new THREE.CylinderGeometry(.05, .05, .5, 10), metalM(0xb8c4cc, .25), -.7, -.7, 0); add(sign, new THREE.CylinderGeometry(.05, .05, .5, 10), metalM(0xb8c4cc, .25), .7, -.7, 0);

/* ───────── seven sculpted stations ───────── */
const stations = [];
const RS = 8.4, SC0 = .62, SC1 = 1.05;
const ringM = new THREE.MeshBasicMaterial({ color: 0xff6a55, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });

function mkBell() {
  const g = new THREE.Group();
  add(g, rbox(2.5, .24, 1.7, .12, 6), clay(P.white), 0, .12, 0);
  const prof = [[0, 0], [1.0, 0], [1.06, .07], [1.04, .24], [.96, .5], [.8, .84], [.54, 1.1], [.24, 1.23], [0, 1.25]].map(p => new THREE.Vector2(p[0], p[1]));
  add(g, new THREE.LatheGeometry(prof, 72), goldM(), 0, .24, 0);
  add(g, new THREE.CylinderGeometry(.06, .06, .22, 12), metalM(0xe7ecef, .2), 0, 1.58, 0);
  const btn = add(g, new THREE.SphereGeometry(.17, 24, 18), gloss(P.red), 0, 1.78, 0); g.userData.btn = btn;
  add(g, new THREE.SphereGeometry(.11, 20, 14), gloss(P.coral), 1.02, .3, .52); add(g, new THREE.SphereGeometry(.09, 20, 14), gloss(P.butter), 1.18, .27, .22);
  const pen = new THREE.Group(); pen.position.set(-.85, .24, .5); pen.rotation.set(0, .5, 0); add(pen, new THREE.CapsuleGeometry(.07, 1.0, 6, 14), gloss(P.teal), 0, .07, 0).rotation.z = PI / 2; add(pen, new THREE.ConeGeometry(.07, .2, 14), goldM(), .66, .07, 0).rotation.z = -PI / 2; g.add(pen);
  g.userData.ripple = []; for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.1, .035, 8, 64), ringM.clone()); r.rotation.x = PI / 2; r.position.y = 1.0; r.material.color.setHex(P.gold); g.add(r); g.userData.ripple.push(r); }
  g.userData.h = 2.3; return g;
}
function mkWand() {
  const g = new THREE.Group();
  add(g, rbox(2.3, .3, 1.7, .14, 6), clay(P.mint), 0, .15, 0);
  add(g, rbox(.7, .85, .55, .22, 6), clay(P.white), -.7, .58, -.1);
  const w = new THREE.Group(); w.position.set(-.35, 1.05, .12); w.rotation.z = -.6; g.add(w);
  add(w, new THREE.CapsuleGeometry(.23, 1.3, 10, 28), gloss(P.white), 0, .7, 0);
  add(w, new THREE.TorusGeometry(.235, .04, 12, 40), glowM(P.teal, .6), 0, .3, 0).rotation.x = PI / 2;
  add(w, new THREE.SphereGeometry(.075, 14, 10), glowM(P.teal, 1.2), 0, .9, .21, false);
  add(w, new THREE.CylinderGeometry(.12, .2, .55, 22), gloss(P.white), 0, 1.65, 0);
  add(w, rbox(.36, .95, .26, .12, 6), gloss(P.white), 0, 2.2, 0);
  add(w, new THREE.PlaneGeometry(.2, .62), glowM(P.teal, 1.3), 0, 2.28, .135, false);
  const tp = [[0, 0], [.3, .03], [.52, .2], [.68, .55], [.7, .95], [.52, 1.28], [.26, 1.42], [0, 1.4]].map(p => new THREE.Vector2(p[0], p[1]));
  const holo = new THREE.Mesh(new THREE.LatheGeometry(tp, 20), new THREE.MeshBasicMaterial({ color: 0x5df2e0, wireframe: true, transparent: true, opacity: .55, toneMapped: false })); holo.scale.setScalar(.62); holo.position.set(1.75, 3.5, .1); holo.userData.y0 = 3.5; g.add(holo); g.userData.holo = holo;
  g.userData.h = 4.0; return g;
}
function mkAligner() {
  const g = new THREE.Group(); const N = 12, A = 1.15; const arch = u => new THREE.Vector3(Math.sin(u) * 1.75, .52, -Math.cos(u) * 1.2 + .95);
  const pts = []; for (let i = 0; i <= 28; i++) pts.push(arch(-A - .12 + (2 * A + .24) * i / 28));
  const curve = new THREE.CatmullRomCurve3(pts);
  add(g, new THREE.TubeGeometry(curve, 90, .26, 20, false), clay(P.pink), 0, -.32, 0);
  for (let i = 0; i < N; i++) { const u = -A + 2 * A * i / (N - 1), c = Math.abs(u) / A, p = arch(u); const w = lerp(.46, .5, c), h = lerp(.72, .5, c), d = lerp(.34, .5, c);
    const t = add(g, rbox(w, h, d, .13, 5), gloss(P.white), p.x, p.y + .02, p.z); t.rotation.y = Math.atan2(Math.sin(u) / 1.75, -Math.cos(u) / 1.2); }
  for (let i = 0; i < N; i++) { const u = -A + 2 * A * i / (N - 1), c = Math.abs(u) / A, p = arch(u); const w = lerp(.46, .5, c) + .15, h = lerp(.72, .5, c) + .12, d = lerp(.34, .5, c) + .14;
    const sl = add(g, rbox(w, h, d, .16, 6), glassM(0xe3f6ff, { thickness: .1, attenuationDistance: 2.6, roughness: .02 }), p.x, p.y + .05, p.z); sl.rotation.y = Math.atan2(Math.sin(u) / 1.75, -Math.cos(u) / 1.2); sl.castShadow = false; }
  g.userData.sparks = [0, 1, 2].map(i => { const s = star(.3 - i * .06, gloss(i % 2 ? P.butter : P.white, { emissive: 0xffe9a8, emissiveIntensity: .35 })); s.position.set(-1.5 + i * 1.5, 1.7 + i * .35, .5 - i * .5); g.add(s); return s; });
  g.userData.h = 2.9; g.rotation.y = 0; return g;
}
function mkEmergency() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(.85, 1.15, .3, 48), clay(P.white), 0, .15, 0);
  add(g, new THREE.CylinderGeometry(.22, .3, 1.0, 24), metalM(0xcfd8de, .22), 0, .75, 0);
  const badge = new THREE.Group(); badge.position.y = 2.65; g.add(badge); g.userData.badge = badge;
  add(badge, new THREE.CylinderGeometry(1.35, 1.35, .44, 72), gloss(P.white), 0, 0, 0).rotation.x = PI / 2;
  add(badge, new THREE.TorusGeometry(1.36, .1, 20, 90), gloss(P.red), 0, 0, 0);
  const cs = new THREE.Shape(); const a = .27, L = .82; cs.moveTo(-a, L); cs.lineTo(a, L); cs.lineTo(a, a); cs.lineTo(L, a); cs.lineTo(L, -a); cs.lineTo(a, -a); cs.lineTo(a, -L); cs.lineTo(-a, -L); cs.lineTo(-a, -a); cs.lineTo(-L, -a); cs.lineTo(-L, a); cs.lineTo(-a, a); cs.closePath();
  const cg = new THREE.ExtrudeGeometry(cs, bev(.14, .1)); cg.center(); add(badge, cg, gloss(P.red, { emissive: 0xff3b2a, emissiveIntensity: .08 }), 0, 0, .3);
  const beacon = add(g, new THREE.SphereGeometry(.34, 32, 20, 0, TAU, 0, PI / 2), glassM(0xff6a55, { transmission: .35, thickness: .3, emissive: 0xff2a18, emissiveIntensity: .5 }), 0, 4.05, 0, false); g.userData.beacon = beacon;
  add(g, new THREE.CylinderGeometry(.38, .42, .14, 32), metalM(0xcfd8de, .25), 0, 4.0, 0);
  g.userData.rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 72), ringM.clone()); r.position.set(0, 2.65, -.1); g.add(r); return r; });
  g.userData.h = 4.5; return g;
}
function mkCup() {
  const g = new THREE.Group();
  const sp = [[0, 0], [1.5, 0], [1.68, .06], [1.74, .17], [1.62, .15], [1.15, .12], [0, .12]].map(p => new THREE.Vector2(p[0], p[1]));
  add(g, new THREE.LatheGeometry(sp, 80), gloss(P.white), 0, 0, 0);
  const cp = [[0, .1], [.5, .1], [.64, .15], [.9, .7], [1.0, 1.1], [.97, 1.16], [.92, 1.12], [.85, .74], [.62, .3], [0, .27]].map(p => new THREE.Vector2(p[0], p[1]));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cp, 80), gloss(P.mint)); cup.castShadow = true; cup.receiveShadow = true; cup.material.side = THREE.DoubleSide; cup.position.y = .08; g.add(cup);
  const latte = canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#d9ab78'); gr.addColorStop(1, '#a8703f'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff3df'; c.beginPath(); const cx = w / 2, cy = h / 2 + 8, s = 62; c.moveTo(cx, cy + s * .85); c.bezierCurveTo(cx - s * 1.5, cy - s * .1, cx - s * .6, cy - s * 1.1, cx, cy - s * .4); c.bezierCurveTo(cx + s * .6, cy - s * 1.1, cx + s * 1.5, cy - s * .1, cx, cy + s * .85); c.fill(); });
  const liq = add(g, new THREE.CircleGeometry(.91, 64), new THREE.MeshPhysicalMaterial({ map: latte, roughness: .25, clearcoat: 1 }), 0, 1.08, 0, false); liq.rotation.x = -PI / 2;
  const hd = add(g, new THREE.TorusGeometry(.42, .11, 18, 40, PI * 1.25), gloss(P.mint), 1.06, .7, 0); hd.rotation.z = -PI * .62;
  for (const [x, z, r] of [[-1.15, .75, .3], [-.85, 1.0, -.4]]) add(g, rbox(.34, .3, .34, .06, 3), clay(P.white), x, .27, z).rotation.y = r;
  const cookie = add(g, new THREE.CylinderGeometry(.34, .34, .1, 28), clay(P.wood), 1.15, .17, .9); cookie.rotation.z = .05; for (let i = 0; i < 5; i++) add(g, new THREE.SphereGeometry(.05, 8, 6), clay(P.cocoa), 1.15 + Math.cos(i * 1.3) * .17, .25, .9 + Math.sin(i * 1.3) * .17, false);
  g.userData.steam = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.userData.t = i / 6; g.add(m); return m; });
  g.userData.h = 2.7; return g;
}
function mkToy() {
  const g = new THREE.Group();
  const bp = [[0, 0], [1.25, 0], [1.3, .08], [1.2, .3], [.9, .48], [.3, .56], [0, .57]].map(p => new THREE.Vector2(p[0], p[1]));
  add(g, new THREE.LatheGeometry(bp, 64), clay(P.lilac), 0, 0, 0);
  add(g, new THREE.CylinderGeometry(.15, .15, 3.1, 20), clay(P.wood), 0, 1.9, 0);
  const cols = [P.coral, P.butter, P.mint, P.sky, P.peri]; g.userData.rings = [];
  cols.forEach((c, i) => { const r = 1.0 - i * .13, tube = .28 - i * .012; const t = add(g, new THREE.TorusGeometry(r, tube, 24, 56), gloss(c), 0, .72 + i * .5, 0); t.rotation.x = PI / 2; t.scale.z = 1; g.userData.rings.push(t); });
  add(g, new THREE.SphereGeometry(.3, 28, 20), gloss(P.red), 0, 3.6, 0);
  const ball = add(g, new THREE.SphereGeometry(.5, 40, 28), gloss(P.sky), 1.7, .5, .9); g.userData.ball = ball;
  const blk = add(g, rbox(.7, .7, .7, .16, 5), gloss(P.butter), -1.75, .35, .8); blk.rotation.y = .4;
  g.userData.star = star(.34, gloss(P.butter, { emissive: 0xffd166, emissiveIntensity: .3 })); g.userData.star.position.set(-1.2, 3.1, .3); g.add(g.userData.star);
  g.userData.h = 4.1; return g;
}
function mkShield() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(.9, 1.2, .3, 48), clay(P.white), 0, .15, 0);
  const s = new THREE.Shape(); s.moveTo(0, 1.55); s.bezierCurveTo(.55, 1.38, 1.0, 1.32, 1.3, 1.32); s.lineTo(1.3, .5); s.bezierCurveTo(1.3, -.45, .55, -1.0, 0, -1.4); s.bezierCurveTo(-.55, -1.0, -1.3, -.45, -1.3, .5); s.lineTo(-1.3, 1.32); s.bezierCurveTo(-1.0, 1.32, -.55, 1.38, 0, 1.55); s.closePath();
  const sg = new THREE.ExtrudeGeometry(s, bev(.3, .16)); sg.center(); const sh = add(g, sg, gloss(P.teal), 0, 2.4, 0); g.userData.shield = sh;
  const chk = new THREE.CatmullRomCurve3([new THREE.Vector3(-.58, .02, 0), new THREE.Vector3(-.16, -.4, 0), new THREE.Vector3(.62, .52, 0)], false, 'catmullrom', .2);
  add(sh, new THREE.TubeGeometry(chk, 30, .15, 16, false), gloss(P.white), 0, 0, .5, false); for (const p of [chk.getPoint(0), chk.getPoint(1)]) add(sh, new THREE.SphereGeometry(.15, 18, 14), gloss(P.white), p.x, p.y, .5, false);
  g.userData.coins = [0, 1, 2].map(i => { const c = add(g, new THREE.CylinderGeometry(.5, .5, .13, 40), goldM(), 1.95 + (i === 1 ? .08 : 0), .3 + i * .15, .55 + (i === 1 ? .05 : 0)); return c; });
  const card = new THREE.Group(); card.position.set(-2.0, 1.35, .5); card.rotation.set(-.15, .5, .25); g.add(card); g.userData.card = card;
  add(card, rbox(1.6, 1.0, .08, .08, 4), gloss(P.peri), 0, 0, 0); add(card, rbox(.3, .24, .02, .05, 2), goldM(), -.42, .15, .05, false); add(card, rbox(.9, .06, .02, .02, 2), gloss(0xdfe3ff), .1, -.22, .05, false); add(card, rbox(.5, .06, .02, .02, 2), gloss(0xdfe3ff), -.1, -.36, .05, false);
  g.userData.h = 4.2; return g;
}

/* ───────── content (kept from the original dashboard) ───────── */
const ZONES = [
  { id: 'reception', name: 'Reception', kicker: 'Meet the doctor', title: 'Welcome — you’re among friends', text: 'Dr. Mitchel Shields and the Discovery Dental team provide compassionate dentistry to patients across the Durham region.', list: ['Attentive & calming staff', 'Gentle techniques for even the most anxious patients', 'Solutions, not judgement'], link: ['about-us/', 'Meet the team ↗'], col: P.coral, css: '#ff7a63', build: mkBell, ped: P.coral },
  { id: 'tech', name: 'iTero & x-rays', kicker: 'Today’s technology', title: 'Precise, digital, comfortable', text: 'Modern tools give a clear picture of your smile and keep every visit efficient.', list: ['iTero digital scanner', 'Digital x-rays', 'Invisalign® planning', 'Conscious sedation'], link: ['services/', 'See all services ↗'], col: P.teal, css: '#16b3a3', build: mkWand, ped: P.teal },
  { id: 'smile', name: 'Smile studio', kicker: 'Cosmetic & restorative', title: 'Make people say “wow”', text: 'From a brighter shade to a fully rebuilt smile — the transformations start here.', list: ['Invisalign® clear aligners', 'Porcelain veneers & whitening', 'Dental implants, crowns & bridges', 'Smile makeovers'], link: ['veneers/', 'Explore veneers ↗'], col: P.peri, css: '#7a86f0', build: mkAligner, ped: P.peri },
  { id: 'emergency', name: 'Emergency bay', kicker: 'Same-day relief', title: 'Toothaches don’t wait', text: 'We keep time open daily for urgent cases and aim to ease your pain fast.', list: ['Severe toothaches', 'Broken or chipped teeth', 'Lost fillings or crowns', 'Knocked-out teeth, swelling or abscesses'], link: ['emergency-dentistry-ajax/', 'Emergency dentist ↗'], col: P.red, css: '#e5483b', build: mkEmergency, ped: P.pink },
  { id: 'cafe', name: 'Tea & coffee bar', kicker: 'Warm & welcoming', title: 'More like visiting friends', text: 'Small-town ambience with big-city amenities — settle in with a hot drink in a relaxed waiting area.', list: ['Tea & coffee bar', 'Relaxed waiting area', 'Calm, attentive team'], link: ['new-patients/', 'New patient? Start here ↗'], col: P.wood, css: '#e29a4e', build: mkCup, ped: P.butter },
  { id: 'kids', name: 'Kids’ corner', kicker: 'Family dentistry', title: 'Smiles for every age', text: 'Children should see a dentist twice a year. After-school appointments are available Monday to Thursday.', list: ['Preventive care & dental sealants', 'Fillings and routine cleanings', 'Hygienists who teach simple home care'], link: ['family-dentistry/', 'Family dentistry ↗'], col: P.butter, css: '#f0b52a', build: mkToy, ped: P.sky },
  { id: 'pay', name: 'Plans & payments', kicker: 'Easy on your budget', title: 'Coverage that makes sense', text: 'Most insurance plans are accepted and the team handles your claims for you.', list: ['We submit claims on your behalf', 'Monthly financing for up to five years', '10% seniors discount for patients over 65'], link: ['contact/', 'Ask about coverage ↗'], col: P.sky, css: '#4f8de6', build: mkShield, ped: P.mint }
];
const CHIPS = [['Invisalign®', 'smile'], ['Veneers', 'smile'], ['Whitening', 'smile'], ['Implants', 'smile'], ['Crowns & bridges', 'smile'], ['Emergency', 'emergency'], ['Family dentistry', 'kids'], ['Fillings & sealants', 'kids'], ['Digital x-rays', 'tech'], ['Sedation', 'tech'], ['Insurance', 'pay']];
ZONES.forEach((z, i) => {
  const a = i / ZONES.length * TAU + .65; const root = new THREE.Group(); root.position.set(Math.sin(a) * RS, 0, Math.cos(a) * RS); root.rotation.y = a; root.scale.setScalar(SC0); scene.add(root);
  root.add(pedestal(z.ped, 2.0)); const obj = z.build(); obj.position.y = .44; root.add(obj);
  const halo = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.4, 80), new THREE.MeshBasicMaterial({ color: z.col, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); halo.rotation.x = -PI / 2; halo.position.y = .05; root.add(halo);
  root.traverse(o => { o.userData.zone = z.id; });
  stations.push({ z, i, a, root, obj, halo, sel: 0, boost: 0, base: obj.position.y, h: obj.userData.h || 3, pos: root.position, k: SC0 });
});
const stById = id => stations.find(s => s.z.id === id);

/* sparkles & pearls around the hero */
const sparks = Array.from({ length: IS_MOBILE ? 10 : 18 }, (_, i) => { const s = star(.16 + R() * .16, gloss(i % 3 ? P.white : P.butter, { emissive: 0xfff1c9, emissiveIntensity: .5 })); s.userData = { r: 6 + R() * 6, a: R() * TAU, y: 1.5 + R() * 6, sp: (.05 + R() * .08) * (R() > .5 ? 1 : -1), ph: R() * 6 }; scene.add(s); return s; });
const confetti = []; const cGeo = new THREE.IcosahedronGeometry(.07, 0); const cMats = [P.teal, P.gold, P.coral, P.peri, P.white].map(h => gloss(h));
function burst(p, n = 26) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(cGeo, cMats[i % cMats.length]); m.position.copy(p); scene.add(m); confetti.push({ m, v: new THREE.Vector3((Math.random() - .5) * 5, 3 + Math.random() * 4, (Math.random() - .5) * 5), life: 1.3 + Math.random() * .7 }); } }
let actx = null; function ping(i = 0) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const f = 523.25 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14][i % 7] / 12), t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.04, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .9); o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + 1); } catch (e) { /* no audio */ } }

/* ───────── camera & views ───────── */
const goal = { tx: 0, ty: 2.4, tz: 0, d: 40, az: .5, el: .4 }, cam = { ...goal, d: 62, az: -.4, el: .3 };
function ovDist() { const colW = innerWidth <= 820 ? 0 : Math.min(272, innerWidth * .21) + Math.max(14, innerWidth * .026) + 22; const freeW = innerWidth - 2 * colW, stageW = 2 * (RS + 1.7), asp = innerWidth / innerHeight, tn = Math.tan(camera.fov * PI / 360); const dW = stageW * (innerWidth / freeW) / (2 * tn * asp), dH = 15.5 / (2 * tn) * 1.12; return Math.max(dW, dH); }
const OV = () => ({ tx: 0, ty: 2.6, tz: 0, d: ovDist(), az: .5, el: IS_MOBILE ? .5 : .46 });
function viewTo(v) { Object.assign(goal, v); }
function viewOverview() { viewTo(OV()); }
function viewClock() { viewTo({ tx: 0, ty: 3.6, tz: 1.2, d: IS_MOBILE ? 33 : 23, az: .12, el: .5 }); }
function viewStation(s) { viewTo({ tx: s.pos.x, ty: s.h * SC1 * .42, tz: s.pos.z, d: IS_MOBILE ? 21 : 12.5, az: s.a + .5, el: .42 }); }
const VIEW_MAP = { overview: () => { selectZone(null); viewOverview(); }, clock: () => { selectZone(null); viewClock(); }, smile: () => selectZone('smile', true), emergency: () => selectZone('emergency', true), cafe: () => selectZone('cafe', true), kids: () => selectZone('kids', true) };
let activeView = 'overview';
function setViewBtn(name) { activeView = name; $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.view === name)); }
$$('#views button').forEach(b => b.addEventListener('click', () => { setViewBtn(b.dataset.view); VIEW_MAP[b.dataset.view](); }));

const pinsEl = $('#pins'), pinEls = ZONES.map((z, i) => { const b = document.createElement('button'); b.className = 'pin'; b.style.setProperty('--pc', z.css); b.setAttribute('aria-label', z.name); b.innerHTML = '<span class="dot">' + (i + 1) + '</span><span class="lbl">' + z.name + '</span>'; b.addEventListener('click', e => { e.stopPropagation(); selectZone(z.id, true); }); pinsEl.appendChild(b); return b; });
const chipsEl = $('#chips'); CHIPS.forEach(([n, id]) => { const b = document.createElement('button'); b.textContent = n; b.dataset.z = id; b.addEventListener('click', () => selectZone(id, true)); chipsEl.appendChild(b); });
let selected = null;
function selectZone(id, fly) {
  selected = id; const z = ZONES.find(x => x.id === id); pinEls.forEach((p, i) => p.classList.toggle('on', ZONES[i].id === id));  const card = $('#zoneCard'); card.style.setProperty('--acc', z ? z.css : '#16b3a3');
  if (!z) { $('#zoneKicker').textContent = 'Tap an object'; $('#zoneTitle').textContent = 'Explore the studio'; $('#zoneText').textContent = 'Seven corners of Discovery Dental, each sculpted as its own little object around a pearl tooth. Drag to rotate, scroll to zoom, then tap one to step inside.'; $('#zoneList').innerHTML = ''; const l = $('#zoneLink'); l.textContent = 'See all services ↗'; l.href = BASE + 'services/'; return; }
  $('#zoneKicker').textContent = z.kicker; $('#zoneTitle').textContent = z.title; $('#zoneText').textContent = z.text; $('#zoneList').innerHTML = z.list.map(x => '<li>' + x + '</li>').join(''); const l = $('#zoneLink'); l.textContent = z.link[1]; l.href = BASE + z.link[0];
  const st = stById(id); if (fly) { viewStation(st); const vb = ['smile', 'emergency', 'cafe', 'kids'].includes(id) ? id : null; activeView = vb || 'x'; $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.view === vb)); }
  st.boost = 2.2; burst(new THREE.Vector3(st.pos.x, st.h * .8 + .6, st.pos.z), 14); ping(ZONES.indexOf(z));
  if (id === 'tech') { scanRing.userData.t = 0; } if (id === 'reception') { st.obj.userData.ripple.forEach((r, k) => { r.userData.t = -k * .3; }); }
}

/* ───────── time, status ───────── */
const sim = { day: 1, hour: 11, live: false };
const week = $('#week'); DAYS.forEach(d => { const e = document.createElement('div'); e.innerHTML = '<i></i><span>' + d[0] + '</span>'; e.title = d; week.appendChild(e); });
const dayBox = $('#days'); DAYS.forEach((d, i) => { const b = document.createElement('button'); b.textContent = d[0]; b.title = d; b.addEventListener('click', () => { sim.day = i; sim.live = false; refreshUI(); }); dayBox.appendChild(b); });
const fmt = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const H = mm === 60 ? hh + 1 : hh, M = mm === 60 ? 0 : mm; const h12 = ((H + 11) % 12) + 1; return h12 + ':' + String(M).padStart(2, '0') + ' ' + (H % 24 >= 12 ? 'pm' : 'am'); };
const isOpen = () => sim.day <= 3 && sim.hour >= OPEN_H && sim.hour < CLOSE_H;
const slider = $('#time'); slider.addEventListener('input', () => { sim.hour = +slider.value; sim.live = false; refreshUI(); });
function torontoNow() { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()); const g = t => p.find(x => x.type === t).value; return { day: DAYS.indexOf(g('weekday')), hour: (+g('hour') % 24) + (+g('minute')) / 60 }; }
$('#liveBtn').addEventListener('click', () => { sim.live = true; const n = torontoNow(); sim.day = n.day; sim.hour = n.hour; refreshUI(); });
setInterval(() => { if (sim.live) { const n = torontoNow(); sim.day = n.day; sim.hour = n.hour; refreshUI(); } }, 30000);
function nextOpen() { for (let k = 0; k < 7; k++) { const d = (sim.day + k) % 7; if (d <= 3 && (k > 0 || sim.hour < OPEN_H)) return { d, k }; } return { d: 0, k: 1 }; }
function refreshUI() {
  const open = isOpen(); const badge = $('#badge'); badge.classList.toggle('closed', !open); $('#badgeTxt').textContent = open ? 'Open' : 'Closed'; $('#statusTitle').textContent = open ? 'Open now' : 'Closed right now';
  if (open) { const left = CLOSE_H - sim.hour; $('#statusSub').textContent = left < 1 ? 'Closing soon — last appointments wrapping up' : 'Welcoming patients until 7:00 pm'; } else { const n = nextOpen(); $('#statusSub').textContent = n.k === 0 ? 'Opens today at 8:30 am' : n.k === 1 ? 'Opens tomorrow (' + DAYS_FULL[n.d] + ') at 8:30 am' : 'Opens ' + DAYS_FULL[n.d] + ' at 8:30 am'; }
  const f = clamp((sim.hour - OPEN_H) / (CLOSE_H - OPEN_H), 0, 1); $('#clockFill').style.width = (sim.day <= 3 ? f * 100 : 0) + '%'; const mk = $('#clockNow'); mk.style.left = (f * 100) + '%'; mk.style.opacity = open ? 1 : .35;
  $('#timeOut').textContent = fmt(sim.hour); slider.value = clamp(sim.hour, +slider.min, +slider.max);
  $$('#days button').forEach((b, i) => b.classList.toggle('on', i === sim.day)); $$('#week div').forEach((e, i) => { e.className = (i <= 3 ? 'o ' : '') + (i === sim.day ? 'sel' : ''); });
  $('#liveBtn').textContent = sim.live ? 'Live · Toronto time ✓' : 'Use live Toronto time'; signMat.map = signMat.emissiveMap = open ? TEX_OPEN : TEX_CLOSED; signMat.needsUpdate = true;
}
refreshUI();
const env = { s: 1, bell: 0 }; let lastPaint = -1; const cKeyA = new THREE.Color(0xffa766), cKeyB = new THREE.Color(0xfff2e0), cMoon = new THREE.Color(0x9ab8ff), cTmp = new THREE.Color(), cTmp2 = new THREE.Color();
function applyEnv(dt, snap) {
  const h = sim.hour, tgt = clamp(Math.sin(PI * (h - 5.8) / 15.2) * 1.5, 0, 1); env.s = snap ? tgt : damp(env.s, tgt, 5, dt); const s = env.s, ng = 1 - s;
  env.bell = Math.max(0, 1 - Math.abs(s - .3) * 5);
  if (Math.abs(s - lastPaint) > .003 || lastPaint < 0) { lastPaint = s; paintSky(s, env.bell); }
  const th = PI * clamp((h - 6) / 14, 0, 1); key.position.set(-Math.cos(th) * 13 - 3, 7 + Math.sin(th) * 12, 11); key.color.copy(cKeyA).lerp(cKeyB, clamp(s * 1.6 - .25, 0, 1)); key.color.lerp(cMoon, ng * .9);
  key.intensity = 2.5 * s + .55 * ng; rim.intensity = .5 + .9 * s + ng * 1.1; rim.color.setHex(0x9fe8ff).lerp(cTmp.setHex(0x7d92ff), ng);
  hemi.intensity = .22 + .5 * s; hemi.color.setHex(0x2a3d78).lerp(cTmp.setHex(0xe6f4ff), s); hemi.groundColor.setHex(0x0d1f2a).lerp(cTmp2.setHex(0xf6e9d4), s);
  scene.environmentIntensity = .14 + .52 * s; glowLight.intensity = ng * 26;
  disc.material.color.setHex(0x4f7d92).lerp(cTmp.setHex(0xd2efe7), s * .85 + .15 * env.bell); floorRing.material.opacity = .2 + .4 * s; shadowFloor.material.opacity = .14 + .3 * s;
  const open = isOpen(); const dark = s < .35; if (document.body.classList.contains('night') !== dark) document.body.classList.toggle('night', dark); $('#timeIco').textContent = s > .6 ? '☀' : s > .25 ? '🌇' : '🌙';
  signMat.emissiveIntensity = .12 + ng * .9; clock.userData.openMat.emissiveIntensity = .12 + ng * .9 + (open ? .15 : 0);
  glowMats.forEach(m => { m.emissiveIntensity = m.userData.k * (.35 + ng * 1.7); });
  bloom.strength = .06 + ng * .3; bloom.threshold = lerp(.78, 1.0, s); renderer.toneMappingExposure = lerp(1.02, .9, s);
  mE.emissiveIntensity = ng * .22; mD.emissiveIntensity = ng * .14;
}

/* ───────── interaction ───────── */
const ptrs = new Map(); let dragMoved = 0, pinchD = 0, auto = false, hover = null;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); } });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) { pick(e, true); return; } const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
  if (ptrs.size === 1) { goal.az -= dx * .0062; goal.el = clamp(goal.el + dy * .0035, .08, 1.1); } else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); goal.d = clamp(goal.d * (pinchD / d), 8, 70); pinchD = d; }
});
const up = e => { const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if (was && dragMoved < 6 && e.type === 'pointerup') pick(e, false); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); goal.d = clamp(goal.d * Math.exp(e.deltaY * .001), 8, 70); }, { passive: false });
addEventListener('keydown', e => { if (e.key === 'ArrowLeft') goal.az -= .15; if (e.key === 'ArrowRight') goal.az += .15; if (e.key === 'Escape') { selectZone(null); viewOverview(); setViewBtn('overview'); } });
$('#autoBtn').addEventListener('click', e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); });
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let heroSpin = 0;
const pickables = [hero, ...stations.map(s => s.root)];
function pick(e, onlyHover) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true).find(h => h.object.visible && h.object.userData && (h.object.userData.zone || h.object.userData.hero)); const id = hit ? (hit.object.userData.zone || 'hero') : null;
  if (onlyHover) { hover = id; canvas.classList.toggle('hov', !!id); return; }
  if (id === 'hero') { heroSpin = PI * 4; burst(new THREE.Vector3(0, 5.5, 0), 40); ping(5); return; } if (id) selectZone(id, true);
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: IS_MOBILE ? 2 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .15, .7, .9); composer.addPass(bloom); composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < .9 ? 38 : 26; camera.updateProjectionMatrix(); if (typeof activeView !== 'undefined' && activeView === 'overview') viewOverview(); } addEventListener('resize', resize); resize();

/* ───────── animation ───────── */
const tmp = new THREE.Vector3(); let T = 0, last = performance.now(), first = false; viewOverview(); Object.assign(cam, { ...goal, d: goal.d * 1.4, az: goal.az - .6 });
const motion = REDUCED ? .25 : 1;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt * motion;
  if (auto) goal.az += dt * .12;
  const k = 3.6; for (const key_ of ['tx', 'ty', 'tz', 'd']) cam[key_] = damp(cam[key_], goal[key_], k, dt); cam.az = damp(cam.az, goal.az, 5, dt); cam.el = damp(cam.el, goal.el, 5, dt);
  camera.position.set(cam.tx + Math.sin(cam.az) * Math.cos(cam.el) * cam.d, cam.ty + Math.sin(cam.el) * cam.d, cam.tz + Math.cos(cam.az) * Math.cos(cam.el) * cam.d);
  const shift = innerWidth <= 820 ? -cam.d * .035 : 0; camera.lookAt(cam.tx, cam.ty + shift, cam.tz); camera.updateMatrixWorld();
  applyEnv(dt, false); const open = isOpen(), ng = 1 - env.s;
  /* hero */
  heroSpin = Math.max(0, heroSpin - dt * 9); hero.rotation.y += dt * (.28 + (heroSpin > 0 ? 9 : 0)); hero.position.y = 3.84 + Math.sin(T * 1.2) * .1;
  scanRing.userData.t = (scanRing.userData.t ?? 9) + dt; { const u = scanRing.userData.t / 1.8; scanRing.visible = u < 1; if (u < 1) { scanRing.position.set(0, 1.3 + u * 5.2, 0); scanRing.scale.setScalar(1 + Math.sin(u * PI) * .25); scanRing.material.opacity = Math.sin(u * PI) * .95; } }
  /* clock: sun & moon travel the ring with the time slider */
  sun.position.copy(onRing(sim.hour)); moon.position.copy(onRing(sim.hour + 12)); sun.visible = true; moon.visible = true; const sunUp = env.s; sun.scale.setScalar(.55 + .45 * sunUp); moon.scale.setScalar(.55 + .45 * ng); sun.children[1].material.opacity = .15 + .8 * sunUp; moon.children[1].material.opacity = .1 + .8 * ng;
  clock.rotation.y = Math.sin(T * .25) * .03;
  /* sparkles */
  sparks.forEach(s => { const u = s.userData; u.a += dt * u.sp; s.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(T * 1.1 + u.ph) * .3, Math.sin(u.a) * u.r); s.rotation.y = T * .8 + u.ph; s.rotation.z = Math.sin(T + u.ph) * .3; s.scale.setScalar(.65 + .45 * (.5 + .5 * Math.sin(T * 2.2 + u.ph))); });
  /* stations */
  stations.forEach((st, i) => {
    const sel = selected === st.z.id, hv = hover === st.z.id; st.sel = damp(st.sel, sel ? 1 : 0, 6, dt); st.boost = Math.max(0, st.boost - dt);
    { const want = Math.atan2(camera.position.x - st.pos.x, camera.position.z - st.pos.z); st.yaw = st.yaw ?? st.a; st.yaw += Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw)) * Math.min(1, dt * 3); st.root.rotation.y = st.yaw; }
    st.k = damp(st.k, lerp(SC0, SC1, st.sel) * (1 + (hv ? .06 : 0)), 5, dt); st.root.scale.setScalar(st.k);
    st.obj.position.y = st.base + .1 + Math.sin(T * 1.25 + i * 1.3) * .09; st.obj.rotation.y = Math.sin(T * .5 + i) * .1 + st.boost * Math.sin(st.boost * 12) * .08;
    st.halo.material.opacity = st.sel * .85; st.halo.scale.setScalar(1 + Math.sin(T * 3) * .02 * st.sel);
    const u = st.obj.userData;
    if (u.ripple) { u.ripple.forEach(r => { r.userData.t = (r.userData.t ?? 9) + dt; const q = r.userData.t / 1.1; r.visible = q > 0 && q < 1; if (r.visible) { r.scale.setScalar(.6 + q * 1.8); r.material.opacity = (1 - q) * .8; } }); if (u.btn) u.btn.position.y = 1.78 - Math.max(0, Math.sin(Math.min(1, st.boost) * PI)) * .08; }
    if (u.holo) { u.holo.rotation.y += dt * .9; u.holo.rotation.x += dt * .4; u.holo.position.y = u.holo.userData.y0 + Math.sin(T * 1.6) * .1; u.holo.material.opacity = .45 + st.boost * .2; }
    if (u.sparks) u.sparks.forEach((s, k) => { s.rotation.y = T * .9 + k; s.position.y = 1.7 + k * .35 + Math.sin(T * 1.6 + k) * .12; s.scale.setScalar(.8 + .3 * Math.sin(T * 2 + k * 2)); });
    if (u.beacon) { const on = Math.sin(T * (open ? 5 : 3)) > 0 ? 1 : .15; u.beacon.material.emissiveIntensity = (.3 + on * (1.2 + ng)); u.badge.rotation.y = Math.sin(T * .8) * .12; u.rings.forEach((r, k) => { const q = ((T * .45 + k * .5) % 1); r.scale.setScalar(.8 + q * 1.3); r.material.opacity = (1 - q) * (st.boost > 0 ? .85 : .38); }); }
    if (u.steam) u.steam.forEach(m => { m.userData.t = (m.userData.t + dt * (.22 + st.boost * .12)) % 1; const q = m.userData.t; m.position.set(Math.sin(q * 7 + m.id) * .16, 1.3 + q * 1.5, Math.cos(q * 5 + m.id) * .1); m.scale.setScalar(.5 + q * 1.4); m.material.opacity = Math.sin(q * PI) * .22; });
    if (u.rings) u.rings.forEach((r, k) => { r.position.y = .72 + k * .5 + Math.max(0, Math.sin(st.boost * 6 - k * .8)) * .08 * Math.min(1, st.boost); }); if (u.ball) { u.ball.position.y = .5 + Math.abs(Math.sin(T * 2.2)) * (.12 + st.boost * .5); } if (u.star) { u.star.rotation.y = T * 1.2; u.star.scale.setScalar(.85 + .2 * Math.sin(T * 2)); }
    if (u.shield) { u.shield.rotation.y = Math.sin(T * .9) * .22 + st.boost * Math.sin(st.boost * 10) * .3; u.coins.forEach((c, k) => { c.rotation.y = T * (.6 + k * .2) + st.boost * 6; }); u.card.rotation.z = .25 + Math.sin(T * 1.1) * .06; u.card.position.y = 1.35 + Math.sin(T * 1.4) * .08; }
  });
  for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.life -= dt; c.v.y -= 11 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 8; c.m.scale.setScalar(Math.max(.01, c.life)); if (c.life <= 0 || c.m.position.y < 0) { scene.remove(c.m); confetti.splice(i, 1); } }
  /* HTML pins follow the objects */
  stations.forEach((st, i) => { tmp.set(st.pos.x, (st.h + .7) * st.k + Math.sin(T * 2 + i) * .06, st.pos.z).project(camera); const behind = tmp.z > 1; const x = (tmp.x * .5 + .5) * innerWidth, y = (-tmp.y * .5 + .5) * innerHeight; pinEls[i].style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; pinEls[i].classList.toggle('dim', behind); });
  composer.render();
  if (!first) { first = true; requestAnimationFrame(() => $('#loader').classList.add('done')); }
}
selectZone(null); applyEnv(0, true); requestAnimationFrame(frame);
window.__dash = { snap() { Object.assign(cam, goal); applyEnv(0, true); camera.position.set(cam.tx + Math.sin(cam.az) * Math.cos(cam.el) * cam.d, cam.ty + Math.sin(cam.el) * cam.d, cam.tz + Math.cos(cam.az) * Math.cos(cam.el) * cam.d); stations.forEach(st => { st.yaw = Math.atan2(camera.position.x - st.pos.x, camera.position.z - st.pos.z); st.k = lerp(SC0, SC1, st.sel); }); }, sim, goal, cam, selectZone, refreshUI, setHour(h) { sim.hour = h; sim.live = false; refreshUI(); applyEnv(0, true); }, setDay(d) { sim.day = d; refreshUI(); }, viewClock, viewOverview, get env() { return env.s; }, stations, scene, camera };
