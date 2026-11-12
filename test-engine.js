/* Tests du moteur : node test-engine.js (code de sortie 0 = tout vert). */
'use strict';
const assert = require('assert');
const E = require('./engine.js');
const DEF = require('./defaults.js');
let n = 0, fails = 0;
function t(name, fn) { n++; try { fn(); console.log('OK  ' + name); } catch (e) { fails++; console.log('KO  ' + name + ' — ' + e.message); } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} obtenu ${a}, attendu ${b} ± ${tol}`);
const S = Object.assign({}, JSON.parse(JSON.stringify(DEF)), { refillH: 24 / DEF.connexions });
// mêmes réglages, carburants au prix HDV de référence (les défauts sont à 0 : l'utilisateur fabrique ses carburants)
const SR = Object.assign({}, S, { fuel: JSON.parse(JSON.stringify(DEF.fuelRef)) });

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
t('fécondité : 24 h avec 2 connexions, ~146 kamas par monture aux Extraits (prix HDV de référence)', () => {
  near(E.fertHours(SR), 24, 1e-9); near(E.fertCost(SR), 146.0, 0.2);
  near(E.levelHours(1, 200, SR), 867582 / 3600, 1e-6); near(E.levelCost(1, 200, SR), 867582 / 1000 * 12.5 / 10, 1e-6);
});
t('carburants à 0 par défaut : aucun coût de carburant, mais le même plan au prix HDV en a un', () => {
  near(E.fertCost(S), 0, 1e-12); near(E.levelCost(1, 200, S), 0, 1e-12); near(E.depositTotal(Object.assign({}, S, { fertFam: 'Potion', xpFam: 'Potion' })), 0, 1e-12);
  const o = E.optimize('Prune et Rousse', S, 'jours'), pl = o.plan, pr = E.plan('Prune et Rousse', o.policy, SR);
  assert.strictEqual(pl.fuelK + pl.levK, 0); assert.strictEqual(pl.missing.length, 0);
  assert.ok(pr.fuelK + pr.levK > 0, 'au prix HDV : ' + (pr.fuelK + pr.levK));
  near(pr.optiK, pl.optiK, 1e-6); near(pr.filetK, pl.filetK, 1e-6);   // seul le carburant change
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
t('réserve par tours : 1 tour = 2/p parents neufs par réussite, quels que soient les réglages ; limites en recroisant jusqu’au bout', () => {
  for (const [reuse, clone] of [[true, true], [true, false], [false, true], [false, false]]) {
    const s = Object.assign({}, S, { reuse, clone });
    for (const p of [0.3, 0.62, 1]) near(E.freshFor(1, p, 1, s), 2 / p, 1e-9, `${reuse}/${clone}/${p}`);
  }
  const p = 0.5;
  near(E.freshFor(1, p, 500, Object.assign({}, S, { reuse: true, clone: true })), 1, 1e-6);           // une réussite sort de la réserve : 1 neuf par réussite
  near(E.freshFor(1, p, 500, Object.assign({}, S, { reuse: false, clone: true })), 1 / p, 1e-6);      // clones seuls (muldo-calculator : ×2 tentatives)
  near(E.freshFor(1, p, 500, Object.assign({}, S, { reuse: true, clone: false })), (1 + p) / p, 1e-6); // ratés seuls
  near(E.freshFor(1, p, 2, Object.assign({}, S, { reuse: true, clone: true })), 1 / (1 - 0.75 * 0.75), 1e-9);
});
t('plan à 100 % avec ratés et clones : réserve commune si parents de même génération, chaînes sinon, au moins 1 par côté (recalcul indépendant)', () => {
  const s = Object.assign({}, S, { optiBonus: 100, clone: true, reuse: true });
  for (const k of [1, 2, 3]) {
    const pl = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 1, true, k), s);
    const need = { 'Prune et Rousse': 1 }, uses = {}, d = 0.5;   // p = 1 : la réserve perd la moitié à chaque tour
    for (let g = 10; g >= 2; g--) for (const m of E.NAMES.filter(x => E.TREE[x].gen === g)) {
      if (m !== 'Prune et Rousse') need[m] = uses[m] || 0;
      if (!need[m]) continue;
      const [A, B] = E.TREE[m].p, gA = E.TREE[A].gen, gB = E.TREE[B].gen;
      if (gA === gB) { const side = Math.max(1, need[m] / (1 - Math.pow(d, k)) / 2); uses[A] = (uses[A] || 0) + side; uses[B] = (uses[B] || 0) + side; }
      else {   // p = 1 : la chaîne réussit au 1er tour ; côté le moins avancé : 1 par tentative moins les clones revenus
        const hi = Math.max(1, need[m]), lo = Math.max(1, need[m] * (1 - 0.5 * (k - 1) / k));
        uses[gA > gB ? A : B] = (uses[gA > gB ? A : B] || 0) + hi; uses[gA > gB ? B : A] = (uses[gA > gB ? B : A] || 0) + lo;
      }
    }
    for (const m of ['Prune', 'Turquoise', 'Orchidée et Pourpre', 'Ébène', 'Rousse', 'Amande', 'Dorée']) near(pl.need[m], uses[m] || 0, 1e-9, 'k' + k + ' ' + m);
    if (k === 1) { const acc = inst('Prune et Rousse', 1, {}); for (const g of E.GEN1) near(pl.captures[g] || 0, acc[g] || 0, 1e-9, g); }
  }
  // chaque tour en plus allonge le chemin d'une préparation par génération
  const a = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 40, true, 1), s), b = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 40, true, 2), s);
  near(b.critH - a.critH, 9 * E.prepHours(1, 40, s), 1e-6);
  assert.ok(b.capTot < a.capTot, 'moins de captures en recroisant');
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
    const tm = p => p.days + p.capTot * 5 / 1440;   // objectif temps : jours + ton temps de capture (5 min)
    assert.ok(tm(best) <= tm(u) + 1e-9, `niv. ${L} opti ${o} : ${tm(u)} < ${tm(best)}`);
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
t('brisage (formule de la vidéo) : 0,82 rune Ga PM au niveau 100, 0,018 au niveau 1', () => {
  const b = Object.assign({}, DEF.brisage, { model: 'video' });
  near(E.brisage(100, b).runes, 0.82, 1e-9); near(E.brisage(1, b).runes, 0.0181, 1e-6);
});
t('brisage (jeu, taux 50 %) : retrouve les mesures de la vidéo (≈ 0,80 au niv. 100, 76/50 = 1,52 au niv. 200)', () => {
  const b = Object.assign({}, DEF.brisage);
  assert.strictEqual(b.model, 'jeu'); assert.strictEqual(b.coef, 50);
  near(E.brisage(100, b).runes, (3 * 90 * 100 / 200 + 1) * 0.5 / 90, 1e-12); near(E.brisage(100, b).runes, 0.80, 0.05);
  near(E.brisage(200, b).runes, 76 / 50, 0.02);
  const pa = Object.assign({}, b, { weight: 100 }); near(E.brisage(100, pa).runes, (3 * 100 * 100 / 200 + 1) * 0.5 / 100, 1e-12);
});
t('brisage DD : bonus selon le niveau (75 % au niveau 100)', () => {
  const b = DEF.ddBrise;
  near(E.statAtLevel(400, 100, b), 300, 1e-9); near(E.statAtLevel(400, 200, b), 400, 1e-9); near(E.statAtLevel(400, 150, b), 350, 1e-9); near(E.statAtLevel(400, 1, b), 3, 1e-9);
});
t('brisage DD, ancien modèle (90 %, objet niveau 60, bonus selon le niveau) : Prune niveau 200 → 1,64 Rune Po et 65,7 Rune Vi (→ 7,3 Ra Vi par fusion)', () => {
  const s = Object.assign({}, S, { ddBrise: { L: 200, coef: 90, mountLevel: false, jetMax: false, itemLevel: 60, curve100: 0.75 } });
  const r = E.brisageDD('Prune', 200, s);
  const po = r.lines.find(l => l.stat === 'Portée'), vi = r.lines.find(l => l.stat === 'Vitalité');
  near(po.weight, (3 * 2 * 51 * 60 / 200 + 1) * 0.9, 1e-9); near(po.runes[0].n, po.weight / 51, 1e-9);
  near(vi.weight, (3 * 400 * 0.2 * 60 / 200 + 1) * 0.9, 1e-9);
  // le brisage ne donne que des runes simples
  assert.deepStrictEqual(vi.runes.map(x => [x.rune, +x.n.toFixed(2)]), [['Rune Vi', 65.7]]);
  assert.strictEqual(vi.fuse.rune, 'Rune Ra Vi'); near(vi.fuse.n, 65.7 / 9, 1e-9);
  near(r.kamas, (65.7 * 1044 / 9 + po.runes[0].n * 3501) * (1 - S.tax), 1e-6);
  assert.strictEqual(r.missing, false);
});
t('brisage DD, modèle jeu (50 %, niveau de la monture, bonus max) : Prune niveau 200 → 3,01 Rune Po et 120,5 Rune Vi', () => {
  const s = Object.assign({}, S, { runePrices: Object.assign({}, S.runePrices, { 'Rune Po': null }) });
  const r = E.brisageDD('Prune', 200, s);
  const po = r.lines.find(l => l.stat === 'Portée'), vi = r.lines.find(l => l.stat === 'Vitalité');
  near(po.weight, (3 * 2 * 51 * 200 / 200 + 1) * 0.5, 1e-9); near(po.runes[0].n, 153.5 / 51, 1e-9);
  near(vi.weight, (3 * 400 * 0.2 * 200 / 200 + 1) * 0.5, 1e-9);
  assert.deepStrictEqual(vi.runes.map(x => [x.rune, +x.n.toFixed(2)]), [['Rune Vi', 120.5]]);
  near(vi.fuse.n, 120.5 / 9, 1e-9);
  near(r.kamas, 120.5 * 1044 / 9 * (1 - S.tax), 1e-6);
  near(r.extract, 9 * S.neurone * (1 - S.tax), 1e-6); assert.strictEqual(S.neurone, 35000);
  assert.strictEqual(r.missing, true); assert.strictEqual(r.breakEven.rune, 'Rune Po');
  near(r.breakEven.price, (r.extract + r.xp - r.kamas) / (po.baseCount * (1 - S.tax)), 1e-6);
});
t('fusion : chaque rune simple vaut le meilleur de son prix, Pa ÷ 3 et Ra ÷ 9 (prix Ombre du 12/11)', () => {
  const P = S.runePrices, st = E.BR.stats;
  const pick = k => { const x = E.bestPerSimple(st[k], P); return [x.rune, +x.per.toFixed(1)]; };
  assert.deepStrictEqual(pick('Vitalité'), ['Rune Ra Vi', 116]);
  assert.deepStrictEqual(pick('Initiative'), ['Rune Pa Ini', 44.3]);
  assert.deepStrictEqual(pick('Intelligence'), ['Rune Ine', 51]);
  assert.deepStrictEqual(pick('Force'), ['Rune Pa Fo', 42.3]);   // Rune Fo simple sans prix : la Pa sert
  assert.deepStrictEqual(pick('Chance'), ['Rune Ra Cha', 58.6]);
  assert.deepStrictEqual(pick('Soins'), ['Rune Pa So', 248.7]);
  assert.strictEqual(E.bestPerSimple({ runes: [['X', 1]] }, {}), null);
});
t('parchemins : un généton vaut le parchemin le plus rentable (prix × (1 − taxe) ÷ coût), un chiffre saisi l’emporte', () => {
  const v = E.scrollValues(S);
  assert.strictEqual(v.length, 24);
  assert.deepStrictEqual(E.SCROLLS.map(x => [x[1], x[2], x[3]]), [[10, 25, 1], [30, 50, 1], [70, 75, 1], [170, 100, 2]]);   // capture d'Eugène Éton + règle des plafonds
  assert.strictEqual(v[0].name, "Petit Parchemin d'Intelligence"); near(v[0].perGeneton, 10009 * (1 - S.tax) / 10, 1e-9);
  assert.strictEqual(v[1].name, 'Grand Parchemin de Vitalité'); near(v[1].perGeneton, 69985 * (1 - S.tax) / 70, 1e-9);
  near(E.genetonValue(S), 10009 * 0.99 / 10, 1e-9);
  near(E.genetonValue(Object.assign({}, S, { genetonValue: 150 })), 150, 1e-12);
  assert.strictEqual(E.genetonValue(Object.assign({}, S, { scrollPrices: {} })), 0);
  const pl = { target: 'Prune et Rousse', genetons: 1000 };
  near(E.resultValue(pl, S).genetons, 1000 * 10009 * 0.99 / 10, 1e-6);
});
t('Optimakinas : craft à tes prix (10 Pépites à 5 000, drops à 0, Queue de Glourséleste 30 000 pour la gén. 10)', () => {
  for (let g = 2; g <= 9; g++) near(E.optiCraft(g, S), 10 * 5000 + E.OPTI[g].queues * S.queuePrice, 1e-9);
  near(E.optiCraft(10, S), 10 * 5000 + 30000, 1e-9);
  near(E.optiCost(10, Object.assign({}, S, { optiBuy: { 10: 90000 } })), 90000, 1e-12);   // un prix d'achat saisi l'emporte
  const s = Object.assign({}, S, { ingPrices: Object.assign({}, S.ingPrices, { 'Pistil du Tynril': 12000 }), queuePrice: 1000 });
  near(E.optiCraft(8, s), 10 * 5000 + 12000 + 2 * 1000, 1e-9);
  assert.strictEqual(E.optiCraft(9, Object.assign({}, S, { ingPrices: Object.assign({}, S.ingPrices, { 'Pépite': null }) })), null);
});
t('seuils : la fécondité prend le carburant le moins cher capable d’atteindre la tranche', () => {
  const fuel = JSON.parse(JSON.stringify(SR.fuel)); fuel['Endurance'] = [10, 300, 200, 400];   // Potion moins chère que Philtre
  const s = Object.assign({}, SR, { fuel, fertFam: 'Philtre' });
  const exp = (20000 * 200 + 20000 * Math.min(50.9, 247.3) + 20000 * 134.3 + 3000 * 263.5 + 3000 * 153.7) / 1000 / 10;
  near(E.fertCost(s), exp, 1e-6);
  near(E.fertCost(Object.assign({}, SR, { fertFam: 'Extrait' })), 146.0, 0.2);
});
t('mise de départ : socle sous le seuil, au moins cher par tranche', () => {
  near(E.baseDeposit('Extrait', SR.fuel['Amour']), 0, 1e-12);
  near(E.baseDeposit('Philtre', SR.fuel['Amour']), 80 * 3.4, 1e-9);
  near(E.baseDeposit('Potion', SR.fuel['Endurance']), 80 * 18.7 + 60 * 180.8, 1e-9);
  const s = Object.assign({}, SR, { fertFam: 'Philtre', xpFam: 'Potion', enclos: 2 });   // chaque enclos a sa mise de départ
  near(E.depositTotal(s), 2 * (80 * 18.7 + 80 * 46.5 + 80 * 3.4 + (80 * 12.5 + 60 * 347)), 1e-6);
});
t('étape déséquilibrée (Prune × Rousse) : en recroisant les ratés, peu de Prunes neuves, une Rousse par tentative', () => {
  const s = Object.assign({}, S, { reuse: true, clone: true }), p = 0.62;
  const one = E.freshSplit(1, p, 1, 'Prune', 'Rousse', s); near(one.A, 1 / p, 1e-9); near(one.B, 1 / p, 1e-9);   // 1 tour : comme sans recroiser
  const three = E.freshSplit(1, p, 3, 'Prune', 'Rousse', s); near(three.A, 1 / (1 - Math.pow(1 - p, 3)), 1e-9); near(three.B, (1 / p) * (1 - 0.5 * 2 / 3), 1e-9);
  assert.ok(three.A < 1.06, 'une seule Prune suffit presque toujours en 3 tours : ' + three.A);
  const sym = E.freshSplit(1, p, 3, 'Ivoire', 'Turquoise', s); near(sym.A, E.freshFor(1, p, 3, s) / 2, 1e-12);
});
t('génétique réelle : un raté garde ses parents (exemple de l’utilisateur : gén. 1 dont un parent est gén. 4)', () => {
  // Amande ratée née de Ébène et Indigo (gén. 4) × Amande et Rousse : avec une Ébène et Indigo, la recette du Pourpre (gén. 5) est dans l'arbre
  const rate = E.outcomesInd({ c: 'Amande', p: ['Ébène et Indigo', 'Amande et Rousse'] }, E.canon('Ébène et Indigo'), 100, 100, false, S);
  assert.strictEqual(rate.targetGen, 5); assert.deepStrictEqual(rate.targets, ['Pourpre']); near(rate.pTarget, 0.6, 1e-9);
  const capt = E.outcomes('Amande', 'Ébène et Indigo', 100, 100, false, S);
  assert.strictEqual(capt.targetGen, 4);
  // sur tout l'arbre : un raté recroisé avec un parent neuf redonne la génération visée presque aussi souvent
  for (const X of E.NAMES.filter(n => E.TREE[n].gen > 1)) {
    const [A, B] = E.TREE[X].p, fs = E.failStats(A, B, 100, true, S), p = E.recovery(A, B, 100, 100, true, S).p;
    assert.ok(fs.pRe >= 0.98 * p, X + ' ' + fs.pRe + ' / ' + p);
  }
});
t('calculateur par dragodinde (comme muldo-calculator) : proportionnel aux lots ; à 100 % sans clone ni raté, 1 lot = 1 bébé', () => {
  const s = Object.assign({}, S, { optiBonus: 100, clone: false, reuse: false });
  const c1 = E.cascade('Prune et Rousse', s, { mult: 1, def: { L: 1, opti: true, k: 1 } });
  near(c1.babies, 1, 1e-9);
  const acc = inst('Prune et Rousse', 1, {}); near(c1.capTot, Object.values(acc).reduce((a, b) => a + b, 0), 1e-9);
  const c3 = E.cascade('Prune et Rousse', s, { mult: 3, def: { L: 1, opti: true, k: 1 } }); near(c3.babies, 3, 1e-9);
  // clones seuls, beaucoup de tours : ×2 tentatives par paire, comme le multiplicateur 2 − 1/(paires + 1) de muldo-calculator
  const sc = Object.assign({}, S, { clone: true, reuse: false });
  const one = E.cascade('Amande et Rousse', sc, { mult: 10, def: { L: 1, opti: false, k: 40 } });
  near(one.babies, 2 * 10 * E.pTarget(1, 1, false, sc), 1e-6);
  near(one.multFor1 * one.babies / one.mult, 1, 1e-9);
});
t('brisage en temps et vente au niveau 200 : rien sans prix, sinon kamas en plus par jour de place', () => {
  const s0 = Object.assign({}, S, { sell200: {} });
  assert.strictEqual(E.saleDD('Prune', s0), null);
  const s1 = Object.assign({}, S, { sell200: { 'Prune': 1000000 } }), v = E.saleDD('Prune', s1);
  const extract = 9 * S.neurone * (1 - S.tax), base = E.instantBest('Prune', s1);
  near(v.gain, 1000000 * (1 - S.tax) - extract, 1e-6);
  near(v.perPlaceDay, (v.gain - base) * 24 / Math.max(E.levelHours(1, 200, s1), s1.refillH), 1e-6);
  const r2 = E.bestBrisageTime('Rousse', S); assert.ok(r2.best.hours >= 0 && r2.best.perPlaceDay < 1e5, 'pas de division par presque zéro : ' + r2.best.L + ' ' + r2.best.perPlaceDay);
  const bt = E.bestBrisageTime('Rousse', S); assert.ok(bt && bt.best && bt.best.L >= 2);
});
t('brisage DD : les 66 couleurs ont des bonus, gén. 1 sans neurone', () => {
  for (const X of E.NAMES) { assert.ok(Object.keys(E.BR.dd[X]).length >= 2, X); }
  const r = E.brisageDD('Rousse', 100, S); assert.strictEqual(r.extract, 0); assert.ok(r.gain > 0);
});
console.log(`\n${n - fails}/${n} tests verts`);
process.exit(fails ? 1 : 0);
