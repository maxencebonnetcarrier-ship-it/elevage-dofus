/* Tests du moteur : node test-engine.js (code de sortie 0 = tout vert). */
'use strict';
const assert = require('assert');
const E = require('./engine.js');
const DEF = require('./defaults.js');
let n = 0, fails = 0;
function t(name, fn) { n++; try { fn(); console.log('OK  ' + name); } catch (e) { fails++; console.log('KO  ' + name + ' — ' + e.message); } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} obtenu ${a}, attendu ${b} ± ${tol}`);
// tests de calcul : réglages de référence (barres en Extraits à 80 000, sérénité 6 000 à corriger) ; les défauts se testent à part (DEF)
const S = Object.assign({}, JSON.parse(JSON.stringify(DEF)), { refillH: 24 / DEF.connexions, xpFam: 'Extrait', fertFam: 'Extrait', seren: 6000, serenTime: false });
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
  // ratés et clones : si tous les ratés naissent de la couleur d'un parent (r = 1), chaque stérile se clone utilement → 1 neuf par réussite
  near(E.freshFor(1, p, 500, Object.assign({}, S, { reuse: true, clone: true }), 1), 1, 1e-6);
  // r = 0 : les ratés stériles clonés n'ont plus la recette (clone sans parents) ; recalcul indépendant de la réserve tour par tour
  let n = 1, c = 1, Y = 0; for (let t = 0; t < 500; t++) { Y += p / 2 * n; const nx = n * ((1 - p) + c) / 2; c = c / ((1 - p) + c); n = nx; }
  near(E.freshFor(1, p, 500, Object.assign({}, S, { reuse: true, clone: true }), 0), 1 / Y, 1e-6);
  assert.ok(1 / Y > 1.4 && 1 / Y < 1.6, 1 / Y);
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
  const s = Object.assign({}, S, { ddBrise: { L: 200, coef: 90, mountLevel: false, jetMax: false, itemLevel: 60, curve100: 0.75, fusion: true } });
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
t('brisage DD, modèle jeu (50 %, niveau de la monture, bonus max) : Prune niveau 200 → 3,01 Rune Po et 120,5 Rune Vi, comptées en runes simples', () => {
  const s = Object.assign({}, S, { runePrices: Object.assign({}, S.runePrices, { 'Rune Po': null }) });
  const r = E.brisageDD('Prune', 200, s);
  const po = r.lines.find(l => l.stat === 'Portée'), vi = r.lines.find(l => l.stat === 'Vitalité');
  near(po.weight, (3 * 2 * 51 * 200 / 200 + 1) * 0.5, 1e-9); near(po.runes[0].n, 153.5 / 51, 1e-9);
  near(vi.weight, (3 * 400 * 0.2 * 200 / 200 + 1) * 0.5, 1e-9);
  assert.deepStrictEqual(vi.runes.map(x => [x.rune, +x.n.toFixed(2)]), [['Rune Vi', 120.5]]);
  assert.strictEqual(vi.fuse, null);   // runes simples seulement : pas de fusion
  near(r.kamas, 120.5 * 95 * (1 - S.tax), 1e-6);
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
  assert.deepStrictEqual(pick('Force'), ['Rune Fo', 100]);   // Rune Fo, Cha et Age simples : 100 kamas (prix de l'utilisateur, 19/11)
  assert.deepStrictEqual(pick('Chance'), ['Rune Cha', 100]);
  assert.deepStrictEqual(pick('Agilité'), ['Rune Age', 100]);
  assert.deepStrictEqual(E.bestPerSimple(st['Force'], Object.assign({}, P, { 'Rune Fo': null })).rune, 'Rune Pa Fo');   // vide : la Pa sert
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
t('Optimakinas : craft = somme des ingrédients aux prix moyens HDV de la vidéo (19/11) ; coût = ton prix, sinon le craft pour toutes les générations', () => {
  // recalcul à la main : Pépite 518, Sueur 1 773, Pic doré 1 559, Pic 645, Queue sauvage 649, Queue de Glourséleste 35 535
  const base = 10 * 518;
  near(E.optiCraft(2, S), 338 + base + 1773 + 1559, 1e-9);                                   // 8 850
  near(E.optiCraft(3, S), 690 + base + 1773 + 1559 + 649, 1e-9);                             // 9 851
  near(E.optiCraft(4, S), 393 + base + 1773 + 1559 + 645 + 649, 1e-9);                       // 10 199
  near(E.optiCraft(5, S), 792 + base + 1773 + 2 * 1559 + 645 + 649, 1e-9);                   // 12 157
  near(E.optiCraft(6, S), 9561 + base + 1773 + 2 * 1559 + 645 + 2 * 649, 1e-9);              // 21 575
  near(E.optiCraft(7, S), 2000 + base + 1773 + 2 * 1559 + 2 * 645 + 2 * 649, 1e-9);          // 14 659
  near(E.optiCraft(8, S), 2779 + base + 1773 + 3 * 1559 + 2 * 645 + 2 * 649, 1e-9);          // 16 997
  near(E.optiCraft(9, S), 40606 + base + 2 * 1773 + 3 * 1559 + 2 * 645 + 3 * 649, 1e-9);     // 57 246
  near(E.optiCraft(10, S), base + 3 * 1773 + 3 * 1559 + 3 * 645 + 3 * 649 + 35535, 1e-9);    // 54 593
  // plus de prix HDV : le craft partout, même si un ancien prix HDV traîne dans les réglages
  assert.strictEqual(S.optiHdv, undefined);
  for (let g = 2; g <= 10; g++) near(E.optiCost(g, S), E.optiCraft(g, S), 1e-9, 'gén. ' + g);
  near(E.optiCost(2, Object.assign({}, S, { optiHdv: { 2: 8155 } })), 8850, 1e-9);
  near(E.optiCost(10, Object.assign({}, S, { optiBuy: { 10: 90000 } })), 90000, 1e-12);   // un prix saisi l'emporte
  const s = Object.assign({}, S, { ingPrices: Object.assign({}, S.ingPrices, { 'Pistil du Tynril': 12000 }), queuePrice: 1000 });
  near(E.optiCraft(8, s), 12000 + base + 1773 + 3 * 1559 + 2 * 645 + 2 * 1000, 1e-9);
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
t('barre remplie au clic : un remplissage égal au plafond du tier donne le même résultat que le tier', () => {
  for (const [fam, F] of [['Extrait', 80000], ['Philtre', 140000], ['Potion', 180000]]) {
    assert.ok(Math.abs(E.xpPerHour(fam, 12) - E.xpPerHour('Extrait', 12, F)) < 1e-9, fam);
    const a = E.fertHours({ fertFam: fam, refillH: 4 }), b = E.fertHours({ fertFam: 'Extrait', fertFill: F, refillH: 4 });
    assert.ok(Math.abs(a - b) < 1e-9, fam + ' ' + a + ' ' + b);
  }
});
t('barre remplie au clic : plus haut = plus d’XP, trop basse = plusieurs connexions pour la fécondité', () => {
  assert.ok(E.xpPerHour('Extrait', 12, 120000) > E.xpPerHour('Extrait', 12, 80000));
  assert.strictEqual(E.tierOf(E.fillOf('Extrait', 120000)), 1);   // 120 000 points = T2
  // 10 000 points ne suffisent pas pour 20 000 : 2 connexions de 4 h par phase, 2 phases → 16 h
  assert.strictEqual(E.fertHours({ fertFam: 'Extrait', fertFill: 10000, refillH: 4 }), 16);
});
t('plan : chaque étape a son calendrier (début après ses parents, fin avant la cible)', () => {
  const pl = E.optimize('Prune et Rousse', S, 'jours', { allowOpti: false }).plan, top = pl.nodes.find(x => x.name === 'Prune et Rousse');
  for (const x of pl.nodes) { assert.ok(x.startH >= 0 && x.doneH > x.startH, x.name); assert.ok(x.doneH <= top.doneH + 1e-9, x.name); }
  assert.ok(Math.abs(top.doneH - pl.critH) < 1e-9);
});
t('porteurs : les ratés d’Ébène et d’Indigo remplacent des Dorée et Rousse / Amande et Rousse en gén. 5 ; moins de captures, pas plus long', () => {
  const pol = E.uniformPolicy('Prune et Rousse', 60, false, 3);
  const a = E.plan('Prune et Rousse', pol, Object.assign({}, S, { porteurs: true })), b = E.plan('Prune et Rousse', pol, Object.assign({}, S, { porteurs: false }));
  const orch = a.nodes.find(x => x.name === 'Orchidée'), pour = a.nodes.find(x => x.name === 'Pourpre');
  assert.ok(orch.porteurs.some(q => q.color === 'Dorée et Rousse' && q.from === 'Ébène'), JSON.stringify(orch.porteurs));
  assert.ok(pour.porteurs.some(q => q.color === 'Amande et Rousse' && q.from === 'Indigo'));
  assert.ok(a.carried > 5 && a.capTot < b.capTot - 10 && a.days <= b.days + 1e-9, [a.carried, a.capTot, b.capTot, a.days, b.days].join(' '));
  // un porteur n'arrive qu'à la fin de l'étape qui l'a donné : l'Orchidée ne démarre pas avant la fin des Ébène
  assert.ok(orch.startH >= a.nodes.find(x => x.name === 'Ébène').doneH - 1e-9);
});
t('porteurs : jamais là où la cible se partage avec une autre couleur (ratés d’Ébène × Indigo pour Ébène et Orchidée : 24 % au lieu de 48 %)', () => {
  const pc = E.carrierP('Ébène', 'Indigo', 60, false, 'Ébène', 'Ébène et Orchidée', 60, false, S), pt = E.recovery('Ébène', 'Orchidée', 60, 60, false, S).p;
  near(pc, 0.24, 0.005); near(pt, 0.48, 1e-9);
  const a = E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 60, false, 3), Object.assign({}, S, { porteurs: true }));
  assert.strictEqual(a.nodes.find(x => x.name === 'Ébène et Orchidée').porteurs.length, 0);
});
t('nombre visé : 100 Prune et Rousse demandent bien plus de captures et de jours qu’une seule', () => {
  const pol = E.uniformPolicy('Prune et Rousse', 60, false, 3);
  const one = E.plan('Prune et Rousse', pol, S), many = E.plan('Prune et Rousse', pol, Object.assign({}, S, { topNeed: 100 }));
  near(many.nodes.find(x => x.name === 'Prune et Rousse').need, 100, 1e-9);
  assert.ok(many.capTot > 30 * one.capTot && many.days > 10 * one.days);
});
t('rentabilité par tier : chaque ligne a son propre tier, même si la barre a été remplie au clic', () => {
  const s = Object.assign({}, S, { xpFill: 120000, fertFill: 120000 });
  const P = E.profitability('Prune et Rousse', s, 'jours'), d = {};
  P.rows.filter(r => !r.missing && r.fertFam === 'Extrait').forEach(r => { d[r.xpFam] = r.days; });
  assert.ok(d['Extrait'] > d['Philtre'], JSON.stringify(d));
});
t('multiplier une gén. 10 : avec une Rousse capturée, même chance que gén. 10 × gén. 10 ; un raté recommence à la même chance', () => {
  const X = 'Prune et Rousse', pc = E.partnerFor(X, 60, false, S);
  assert.strictEqual(pc.c, 'Rousse'); near(pc.p, E.pTarget(60, 60, false, S), 1e-9);
  const ch = E.chainP(X, 'Rousse', 60, false, S); near(ch.pRe, ch.p, 0.005);
  // une capture Amande partagerait la cible avec Amande et Prune : refusée
  assert.ok(!E.partnerFor('Prune et Émeraude', 60, false, S) || E.partnerFor('Prune et Émeraude', 60, false, S).p >= 0.95 * E.pTarget(60, 60, false, S));
});
t('multiplier : gén. 10 × gén. 10 ne grandit jamais (2 au départ → jamais 10) ; × capture atteint 50, plus vite avec plus de places', () => {
  const X = 'Prune et Rousse';
  const self = E.multiply(X, S, { method: 'self', L: 167, opti: true, N: [10], start: 2 });
  assert.strictEqual(self.reach[10], null); assert.ok(self.maxReach < 4.01);
  const a = E.multiply(X, Object.assign({}, S, { enclos: 2 }), { L: 40, N: [50] }), b = E.multiply(X, Object.assign({}, S, { enclos: 4 }), { L: 40, N: [50] });
  assert.ok(a.reach[50] && b.reach[50] && b.reach[50].days < a.reach[50].days && b.perDay > a.perDay);
  near(a.perDay, Math.floor(20 / 2) * 24 / a.T * a.pEff, 1e-9);
});
t('clonage (constaté en jeu) : deux stériles de la même couleur → cette couleur, sans parents ; un clone de ratés ne garde pas la recette', () => {
  const s = Object.assign({}, S, { reuse: true, clone: true }), p = 0.48;
  // plus les ratés naissent de la couleur d'un parent, plus les clones servent : moins de parents neufs
  const f0 = E.freshFor(1, p, 5, s, 0), f5 = E.freshFor(1, p, 5, s, 0.5), f1 = E.freshFor(1, p, 5, s, 1);
  assert.ok(f0 > f5 && f5 > f1, [f0, f5, f1].join(' '));
  // 2 tours : pas encore de clone de ratés, la part ne joue pas
  near(E.freshFor(1, p, 2, s, 0), E.freshFor(1, p, 2, s, 1), 1e-12);
  // sans clonage, la part ne joue jamais
  near(E.freshFor(1, p, 6, Object.assign({}, s, { clone: false }), 0), E.freshFor(1, p, 6, Object.assign({}, s, { clone: false }), 1), 1e-12);
  // le plan utilise la part réelle des ratés de la couleur d'un parent (dofuselevage) pour chaque étape
  const ns = E.recovery('Amande et Dorée', 'Dorée et Rousse', 60, 60, false, S);
  assert.ok(ns.rA + ns.rB > 0 && ns.rA + ns.rB < 1, ns.rA + ns.rB);
});
// clone de deux stériles de couleurs différentes : l'une ou l'autre, 50 % chacune (confirmé par l'utilisateur, 19/11/2026)
function cloneExpect(colors, useful) {   // clones utiles attendus, moyenne sur TOUS les appariements possibles des stériles
  let tot = 0, cnt = 0;
  (function go(rest, acc) {
    if (!rest.length) { tot += acc; cnt++; return; }
    const a = rest[0];
    for (let i = 1; i < rest.length; i++) {
      const b = rest[i], ua = useful.includes(a), ub = useful.includes(b);
      const v = a === b ? (ua ? 1 : 0) : (ua ? 0.5 : 0) + (ub ? 0.5 : 0);
      go(rest.slice(1, i).concat(rest.slice(i + 1)), acc + v);
    }
  })(colors, 0);
  return tot / cnt;
}
t('clone de deux couleurs différentes (50 %) : chaque stérile A ou B rend ½ clone utile, quel que soit l’appariement (le moteur compte c / 2)', () => {
  const U = ['A', 'B'];
  near(cloneExpect(['A', 'A', 'B', 'C', 'C', 'D'], U), 3 / 2, 1e-12);
  near(cloneExpect(['A', 'C', 'D', 'E'], U), 1 / 2, 1e-12);
  near(cloneExpect(['A', 'B', 'B', 'B', 'C', 'C', 'D', 'E'], U), 4 / 2, 1e-12);
  near(cloneExpect(['C', 'C', 'D', 'D'], U), 0, 1e-12);
  // le moteur : une réserve toute A ou B (c = 1), aucune réussite, ratés non recroisés → 1 stérile rend ½ clone au tour suivant
  near(E.poolSeries(0, { reuse: false, clone: true }, 0, 2).left, 1 / 4, 1e-12);
  // une réserve à moitié A ou B : c / 2 par stérile ; recroisés (1 − p) + clones (c) par paire
  const p = 0.5, r = 0.4, n1 = (1 - p + 1) / 2, c1 = ((1 - p) * r + 1) / (1 - p + 1), n2 = n1 * ((1 - p) + c1) / 2;
  near(E.poolSeries(p, { reuse: true, clone: true }, r, 2).left, n2, 1e-12);
});
t('chance confirmée en jeu : Prune et Rousse × Rousse, parents niveau 40 → 42 %', () => {
  const st = E.chainP('Prune et Rousse', 'Rousse', 40, false, S);
  near(st.p, 0.42, 0.005);
  assert.strictEqual(E.partnerFor('Prune et Rousse', 40, false, S).c, 'Rousse');
});
t('réglages par défaut : éleveur 200, 6 enclos (tous débloqués), barres à 200 000 (Élixirs), sérénité 2 500', () => {
  assert.strictEqual(DEF.version, 10); assert.strictEqual(DEF.eleveur, 200); assert.strictEqual(DEF.enclos, 6);
  assert.strictEqual(E.placesOf(S), 60);
  assert.strictEqual(DEF.barMax, 200000); assert.strictEqual(DEF.xpFam, 'Élixir'); assert.strictEqual(DEF.fertFam, 'Élixir'); assert.strictEqual(DEF.seren, 2500);
  assert.strictEqual(E.fillOf(DEF.xpFam, null), 200000);
  // les Élixirs de Maturité et d'Expérience existent : une case à 0 (fabriqué), pas « recette inexistante »
  assert.strictEqual(DEF.fuel['Maturité'][3], 0); assert.strictEqual(DEF.fuel['Expérience'][3], 0);
  const D = Object.assign({}, JSON.parse(JSON.stringify(DEF)), { refillH: 12 });
  assert.ok(E.levelCost(1, 100, D) === 0 && E.fertCost(D) === 0, 'carburants fabriqués : 0 kama, aucun prix manquant');
});
t('barres à 200 000 : l’XP monte plus vite qu’à 180 000 et 80 000 ; même stratégie → plan plus court', () => {
  const at = F => Object.assign({}, S, { xpFam: E.FAMILIES[E.tierOf(F)], fertFam: E.FAMILIES[E.tierOf(F)], xpFill: F, fertFill: F, enclos: 6, fuel: JSON.parse(JSON.stringify(DEF.fuel)) });
  const x80 = E.xpPerHour('Extrait', 12, 80000), x180 = E.xpPerHour('Potion', 12, 180000), x200 = E.xpPerHour('Élixir', 12, 200000);
  near(x80 * 12, 43200, 1e-6);                                   // 60 points par minute pendant 12 h
  // depuis 200 000 en 12 h : 20 000 à 240 / min, 40 000 à 180 / min, puis 120 / min le reste du temps
  near(x200 * 12, 20000 + 40000 + 120 * (720 - 20000 / 240 - 40000 / 180), 1e-6);
  assert.ok(x200 > x180 && x180 > x80, [x80, x180, x200]);
  const pol = E.uniformPolicy('Prune et Rousse', 100, false, 2);
  const d80 = E.plan('Prune et Rousse', pol, at(80000)).days, d200 = E.plan('Prune et Rousse', pol, at(200000)).days;
  assert.ok(d200 < d80, [d80, d200]);
  assert.strictEqual(E.plan('Prune et Rousse', pol, at(200000)).missing.length, 0);
});
t('sérénité : 2 500 → 0 à chaque fournée, × 2 plus vite que les autres jauges, pendant ta connexion (sinon une connexion de plus)', () => {
  const D = Object.assign({}, JSON.parse(JSON.stringify(DEF)), { refillH: 12 });
  assert.strictEqual(DEF.seren, 2500); assert.strictEqual(DEF.serenSpeed, 2); assert.strictEqual(DEF.serenOnline, true);
  near(E.serenHours(D), 2500 / 240 / 2 / 60, 1e-9);                                              // barre à 200 000 : 40 points / 10 s, × 2
  near(E.serenHours(Object.assign({}, D, { fertFam: 'Extrait', fertFill: null })), 2500 / 60 / 2 / 60, 1e-9);   // barre à 80 000 : 10 / 10 s
  near(E.serenHours(Object.assign({}, D, { serenOnline: false })), 12, 1e-9);                     // pas en ligne : la fournée attend 12 h
  near(E.serenHours(Object.assign({}, D, { seren: 0 })), 0, 1e-12);
  const z = E.serenHours(D), off = Object.assign({}, D, { serenTime: false });
  near(E.prepHours(1, 1, D) - E.prepHours(1, 1, off), z, 1e-9);                                  // s'ajoute à la préparation
  assert.ok(E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 60, false, 2), Object.assign({}, D, { serenOnline: false, enclos: 6 })).days >
            E.plan('Prune et Rousse', E.uniformPolicy('Prune et Rousse', 60, false, 2), Object.assign({}, D, { enclos: 6 })).days);
});
t('semaine par semaine : gén. 2 en boucle contre gén. 10 puis gén. 10 × capture (avec / sans clones)', () => {
  const D = Object.assign({}, JSON.parse(JSON.stringify(DEF)), { refillH: 12, topNeed: 1 });
  const w = E.weekly('Prune et Rousse', D, {});
  assert.deepStrictEqual(w.weeks, [1, 2, 3, 4, 6, 8, 12, 16]);
  assert.strictEqual(E.TREE[w.A.target].gen, 2);
  near(w.rows[1].A - w.rows[0].A, 7 * w.A.rate, 1e-3);                                            // la gén. 2 rapporte autant chaque semaine
  near(w.A.rate, w.A.perDayN * w.A.perUnit, 1e-3);
  near(w.valueX, 10 * DEF.neurone * (1 - DEF.tax), 1e-9);
  const d0 = w.D / 2; near(w.cumB(d0), w.cumB(w.D - 1e-9) * d0 / (w.D - 1e-9), 1);                 // pendant le plan : étalé
  // cloner coûte deux gén. 10 stériles (qu'on aurait extraites) : un creux juste après, puis bien plus à la fin
  const last = w.rows[w.rows.length - 1]; assert.ok(last.B > 2 * last.C, [last.B, last.C]);
  assert.ok(w.rows.every(r => r.week * 7 < w.crossClones || r.B > r.C), 'devant la gén. 2, cloner rapporte plus que ne pas cloner');
  assert.ok(w.crossClones !== null && w.crossClones > w.D, w.crossClones);                         // la gén. 10 passe devant, après le plan
  assert.ok(w.crossNoClones === null || w.crossNoClones > w.crossClones, w.crossNoClones);
  const d = w.crossClones; assert.ok(w.cumB(d) > w.cumA(d) && w.cumB(d - 0.5) <= w.cumA(d - 0.5));
});
t('Makina de la génération du bébé (constaté en jeu : une gén. 3 se fait avec une Makina 3, pas une 4)', () => {
  const pol = E.uniformPolicy('Prune et Rousse', 40, true, 1), pl = E.plan('Prune et Rousse', pol, S);
  const gens = [...new Set(pl.nodes.map(n => n.gen))].sort((a, b) => a - b);
  assert.deepStrictEqual(Object.keys(pl.optiCount).map(Number).sort((a, b) => a - b), gens);
  pl.nodes.forEach(n => near(n.optiK, n.att * E.optiCost(n.gen, S), 1e-6, n.name));
});

console.log(`\n${n - fails}/${n} tests verts`);
process.exit(fails ? 1 : 0);
