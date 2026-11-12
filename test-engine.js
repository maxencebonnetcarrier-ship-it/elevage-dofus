/* Tests du moteur : node test-engine.js (code de sortie 0 = tout vert). */
'use strict';
const assert = require('assert');
const E = require('./engine.js');
const DEF = require('./defaults.js');
let n = 0, fails = 0;
function t(name, fn) { n++; try { fn(); console.log('OK  ' + name); } catch (e) { fails++; console.log('KO  ' + name + ' — ' + e.message); } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} obtenu ${a}, attendu ${b} ± ${tol}`);
const S = Object.assign({}, JSON.parse(JSON.stringify(DEF)), { refillH: 24 / DEF.connexions });

t('table d’XP : niveaux 100, 167, 200', () => { assert.strictEqual(E.XP[1], 0); assert.strictEqual(E.XP[2], 19); assert.strictEqual(E.XP[100], 172668); assert.strictEqual(E.XP[167], 570057); assert.strictEqual(E.XP[200], 867582); });
t('arbre : 66 dragodindes, gén. 7 et 9 conformes', () => {
  assert.strictEqual(E.NAMES.length, 66);
  assert.deepStrictEqual(E.TREE['Ivoire'].p, ['Orchidée et Pourpre', 'Indigo et Pourpre']);
  assert.deepStrictEqual(E.TREE['Turquoise'].p, ['Orchidée et Pourpre', 'Ébène et Orchidée']);
  assert.deepStrictEqual(E.TREE['Émeraude'].p, ['Ivoire et Turquoise', 'Ivoire et Pourpre']);
  assert.deepStrictEqual(E.TREE['Prune'].p, ['Ivoire et Turquoise', 'Turquoise et Orchidée']);
  for (const m of E.NAMES) { const x = E.TREE[m]; if (x.p.length) assert.strictEqual(Math.max(E.TREE[x.p[0]].gen, E.TREE[x.p[1]].gen), x.gen - 1, m); }
});
t('chance cible : 30 % + 0,15 % × niveaux (+ Optimakina)', () => {
  near(E.pTarget(1, 1, false, S), 0.303, 1e-9); near(E.pTarget(200, 200, false, S), 0.90, 1e-9);
  near(E.pTarget(167, 167, true, S), 1, 1e-9); near(E.pTarget(166, 166, true, S), 0.998, 1e-9);
});
t('dofuselevage : Amande × Rousse niv. 1 → 34,85 / 34,85 / 30,30 %', () => {
  const o = E.outcomes('Amande', 'Rousse', 1, 1, false, { optiBonus: 10 });
  const p = Object.fromEntries(o.items.map(i => [i.name, i.p]));
  near(p['Amande'], 0.3485, 1e-4); near(p['Rousse'], 0.3485, 1e-4); near(p['Amande et Rousse'], 0.303, 1e-9);
});
t('dofuspourlesnoobs : Pourpre niv. 200 × Émeraude niv. 1 + Optimakina → 80,15 %, Pourpre plus probable qu’Émeraude', () => {
  const o = E.outcomes('Pourpre', 'Émeraude', 200, 1, true, { optiBonus: 20 });
  near(o.pTarget, 0.8015, 1e-9); assert.deepStrictEqual(o.targets, ['Émeraude et Pourpre']);
  const p = Object.fromEntries(o.items.map(i => [i.name, i.p]));
  assert.ok(p['Pourpre'] > p['Émeraude']); near(o.items.reduce((s, i) => s + i.p, 0), 1, 1e-9);
});
t('récupération Ivoire (Orchidée et Pourpre × Indigo et Pourpre) ≈ 26,8 % chacun', () => {
  const r = E.recovery('Orchidée et Pourpre', 'Indigo et Pourpre', 1, 1, false, S); near(r.rA, 0.2678, 0.002); near(r.rB, 0.2678, 0.002);
});
t('jauges 3.7 : vidage par paliers', () => {
  near(E.drain(80000, 60), 3600, 1e-6); near(E.drain(200000, 20000 / 240), 20000, 1e-6);
  near(E.drain(200000, 1e9), 200000, 1e-6);
  near(E.xpPerHour('Extrait', 12), 3600, 1e-6);
  near(E.xpPerHour('Élixir', 12), (60000 + (720 - 20000 / 240 - 40000 / 180) * 120) / 12, 1e-6);
  near(E.xpPerHour('Extrait', 24), 80000 / 24, 1e-6);   // une seule connexion : la jauge se vide avant
});
t('coût d’une recharge Élixir : chaque tranche avec la famille la moins chère', () => {
  const row = [10, 100, 50, 1000];   // Potion moins chère que Philtre
  const d = E.drain(200000, 720), lo = 200000 - d;
  const exp = ((140000 - lo) * 50 + 40000 * 50 + 20000 * 1000) / d;
  near(E.refillCostPer1000('Élixir', 12, row), exp, 1e-6);
  assert.strictEqual(E.refillCostPer1000('Élixir', 12, [10, 100, 50, null]), null);
});
t('fécondité : 24 h avec 2 connexions, ~146 kamas par monture aux Extraits', () => {
  near(E.fertHours(S), 24, 1e-9); near(E.fertCost(S), 146.0, 0.2);
  near(E.levelHours(1, 200, S), 867582 / 3600, 1e-6); near(E.levelCost(1, 200, S), 867582 / 1000 * 12.5 / 10, 1e-6);
});
// comptage indépendant des montures de base (récurrence directe sur l'arbre)
function inst(m, mult, acc) { if (E.TREE[m].gen === 1) { acc[m] = (acc[m] || 0) + mult; return acc; } E.TREE[m].p.forEach(p => inst(p, mult, acc)); return acc; }
t('plan à 100 % sans clonage = nombre d’instances de l’arbre', () => {
  const s = Object.assign({}, S, { optiBonus: 100, clone: false, recup: false });
  const pl = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 1, true), s);
  const acc = inst('Prune et Rousse', 1, {});
  for (const g of E.GEN1) near(pl.captures[g] || 0, acc[g] || 0, 1e-9, g);
  near(pl.need['Turquoise'], 2, 1e-9); near(pl.need['Orchidée et Pourpre'], 3, 1e-9);
});
t('plan à 100 % avec clonage : (U − 1) / 2 clones par génération, recalcul indépendant', () => {
  const s = Object.assign({}, S, { optiBonus: 100, clone: true, recup: false });
  const pl = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 1, true), s);
  // recalcul indépendant : génération par génération, de 10 à 1
  const need = { 'Prune et Rousse': 1 }, uses = {};
  for (let g = 10; g >= 1; g--) {
    const names = E.NAMES.filter(m => E.TREE[m].gen === g);
    const U = names.reduce((x, m) => x + (uses[m] || 0), 0), cr = U > 1 ? (U - 1) / (2 * U) : 0;
    for (const m of names) { if (m !== 'Prune et Rousse') need[m] = (uses[m] || 0) * (1 - cr); if (g > 1 && need[m] > 0) for (const p of E.TREE[m].p) uses[p] = (uses[p] || 0) + need[m]; }
  }
  for (const m of ['Prune', 'Rousse', 'Turquoise', 'Orchidée et Pourpre', 'Amande', 'Dorée', 'Ébène']) near(pl.need[m], need[m] || 0, 1e-9, m);
  near(pl.need['Prune'], 1, 1e-9);   // une seule Prune utilisée : pas de clone possible
});
t('dernier croisement : un raté gén. 9 × Rousse rend une gén. 9 bien moins souvent que Prune × Émeraude', () => {
  const a = E.finalCross('Prune et Rousse', 1, false, S), b = E.finalCross('Prune et Émeraude', 1, false, S);
  near(a.back9, 0.1305, 0.001); near(b.back9, 0.5745, 0.001);   // recalcul à la main : 19,1/146,4 et 72,3/125,8 assert.strictEqual(a.genetons, 502); assert.strictEqual(b.genetons, 1000);
});
t('optimiseur : au moins aussi rapide que les stratégies uniformes', () => {
  const s = Object.assign({}, S, { glourPrice: 20000 });
  const best = E.optimize('Prune et Rousse', s, 'jours').plan;
  for (const [L, o] of [[1, false], [1, true], [100, false], [100, true], [167, true], [200, false], [200, true]]) {
    const u = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', L, o), s);
    assert.ok(best.days <= u.days + 1e-9, `niv. ${L} opti ${o} : ${u.days} < ${best.days}`);
  }
});
t('optimiseur kamas : au moins aussi économe que les stratégies uniformes', () => {
  const s = Object.assign({}, S, { glourPrice: 20000 });
  const best = E.optimize('Prune et Rousse', s, 'kamas').plan;
  for (const L of E.LEVELS) for (const o of [false, true]) { const u = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', L, o), s); assert.ok(best.kamas <= u.kamas + 1e-6, 'niv. ' + L + ' ' + o); }
});
t('analyse de niveau : lignes complètes, optimum trouvé', () => {
  const s = Object.assign({}, S, { glourPrice: 20000 });
  const pl = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 100, true), s);
  const la = E.levelAnalysis('Prune et Rousse', s, E.unitCosts(pl, s));
  assert.strictEqual(la.rows.length, E.LEVELS.length * 2);
  assert.ok(la.bestKamas[1].L >= 1 && la.bestHours[0].L >= 1);
  la.rows.forEach(r => { assert.ok(isFinite(r.kamas) && isFinite(r.placeH), 'L' + r.L); });
});
t('brisage (vidéo) : 0,82 rune Ga PM au niveau 100, 0,018 au niveau 1', () => {
  const b = Object.assign({}, DEF.brisage);
  near(E.brisage(100, b).runes, 0.82, 1e-9); near(E.brisage(1, b).runes, 0.0181, 1e-6);
});
t('brisage DD : bonus selon le niveau (75 % au niveau 100)', () => {
  const b = DEF.ddBrise;
  near(E.statAtLevel(400, 100, b), 300, 1e-9); near(E.statAtLevel(400, 200, b), 400, 1e-9); near(E.statAtLevel(400, 150, b), 350, 1e-9); near(E.statAtLevel(400, 1, b), 3, 1e-9);
});
t('brisage DD : Prune niveau 200 → 1,64 Rune Po et 6 Ra Vi + 1 Pa Vi + 2,7 Vi (recalcul à la main)', () => {
  const r = E.brisageDD('Prune', 200, S);
  const po = r.lines.find(l => l.stat === 'Portée'), vi = r.lines.find(l => l.stat === 'Vitalité');
  near(po.weight, (3 * 2 * 51 * 60 / 200 + 1) * 0.9, 1e-9); near(po.runes[0].n, po.weight / 51, 1e-9);
  near(vi.weight, (3 * 400 * 0.2 * 60 / 200 + 1) * 0.9, 1e-9);
  assert.deepStrictEqual(vi.runes.map(x => [x.rune, +x.n.toFixed(2)]), [['Rune Ra Vi', 6], ['Rune Pa Vi', 1], ['Rune Vi', 2.7]]);
  near(r.kamas, (6 * 1317 + 442 + 2.7 * 135) * 0.97, 1e-6);
  near(r.extract, 9 * 23000 * 0.97, 1e-6);
  assert.strictEqual(r.missing, true); assert.strictEqual(r.breakEven.rune, 'Rune Po');
  near(r.breakEven.price, (r.extract + r.xp - r.kamas) / (po.baseCount * 0.97), 1e-6);
});
t('brisage DD : les 66 couleurs ont des bonus, gén. 1 sans neurone', () => {
  for (const X of E.NAMES) { assert.ok(Object.keys(E.BR.dd[X]).length >= 2, X); }
  const r = E.brisageDD('Rousse', 100, S); assert.strictEqual(r.extract, 0); assert.ok(r.gain > 0);
});
console.log(`\n${n - fails}/${n} tests verts`);
process.exit(fails ? 1 : 0);
