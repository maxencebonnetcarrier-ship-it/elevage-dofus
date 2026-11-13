/* Moteur de calcul — élevage de dragodindes (Dofus 3.7, serveur Ombre).
   Fonctions pures, sans accès à la page : testées sous Node (test-engine.js) et utilisées par app.js.
   Sources des règles : voir l'onglet « Règles et sources » de la page. */
(function (root) {
  'use strict';
  var D = (typeof DD_DATA !== 'undefined') ? DD_DATA : require('./data.js');
  var TREE = D.tree, XP = D.xp;
  var BR = (typeof DD_BRISE !== 'undefined') ? DD_BRISE : (typeof require !== 'undefined' ? require('./brisage-data.js') : null);
  var NAMES = Object.keys(TREE);
  var GEN1 = NAMES.filter(function (n) { return TREE[n].gen === 1; });
  // génétons gagnés par parent selon SA génération (3.7, doublés) — dofuspourlesnoobs
  var GENETONS = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 30, 6: 60, 7: 120, 8: 240, 9: 500, 10: 500 };
  var FAMILIES = ['Extrait', 'Philtre', 'Potion', 'Élixir'];
  // 3.7 : jauge max 200 000 ; chaque famille remplit jusqu'à son plafond ; le débit dépend du palier où se trouve la jauge
  var CAPS = [80000, 140000, 180000, 200000];
  var RATE = [60, 120, 180, 240];            // points (= XP) par minute : 10 / 20 / 30 / 40 toutes les 10 s
  var JAUGES = ['Endurance', 'Maturité', 'Amour', 'Gain de sérénité', 'Perte de sérénité', 'Expérience'];
  /* Optimakina de Dragodinde : recette (classeur, feuille « Makinas ») = 1 ressource de boss, 10 Pépites, Sueur, Pics, Queues de dragodinde sauvage ;
     la gén. 10 prend une Queue de Glourséleste à la place de la ressource de boss. Le coût vient de tes prix d'ingrédients (s.ingPrices),
     des Queues (s.queuePrice) et de la Queue de Glourséleste (s.glourPrice). base = ancien coût hors Queues au prix HDV (repère). */
  var OPTI = {
    2: { lvl: 29, base: 8400, queues: 0, ing: { 'Fémur du Chafer Rōnin': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 1 } },
    3: { lvl: 49, base: 9630, queues: 1, ing: { 'La cambriole pour les Nuls': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 1 } },
    4: { lvl: 69, base: 8327, queues: 1, ing: { 'Pierre du Craqueleur Légendaire': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 1, 'Pic de dragodinde': 1 } },
    5: { lvl: 89, base: 8199, queues: 1, ing: { 'Groin de Dragon Cochon': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 2, 'Pic de dragodinde': 1 } },
    6: { lvl: 109, base: 13328, queues: 2, ing: { 'Bourgeon explosif de Damadrya': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 2, 'Pic de dragodinde': 1 } },
    7: { lvl: 129, base: 8856, queues: 2, ing: { 'Laine du Royalmouth': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 2, 'Pic de dragodinde': 2 } },
    8: { lvl: 149, base: 12468, queues: 2, ing: { 'Pistil du Tynril': 1, 'Pépite': 10, 'Sueur de dragodinde': 1, 'Pic de dragodinde dorée': 3, 'Pic de dragodinde': 2 } },
    9: { lvl: 167, base: 25658, queues: 3, ing: { "Mèche Rebelle d'Hell Mina": 1, 'Pépite': 10, 'Sueur de dragodinde': 2, 'Pic de dragodinde dorée': 3, 'Pic de dragodinde': 2 } },
    10: { lvl: 185, base: 10284, queues: 3, glour: 1, ing: { 'Pépite': 10, 'Sueur de dragodinde': 3, 'Pic de dragodinde dorée': 3, 'Pic de dragodinde': 3 } }
  };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function add(map, k, v) { map.set(k, (map.get(k) || 0) + v); }
  function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  var RECIPE = {};
  NAMES.forEach(function (n) { var p = TREE[n].p; if (p.length) RECIPE[key(p[0], p[1])] = n; });
  function recipe(a, b) { return a === b ? null : (RECIPE[key(a, b)] || null); }

  // ---------------------------------------------------------------- probabilités
  function pTarget(LA, LB, opti, s) {
    s = s || {};
    var ob = s.optiBonus == null ? 20 : s.optiBonus, alma = s.alma || 0;
    return clamp((30 + 0.15 * (LA + LB) + (opti ? ob : 0) + alma) / 100, 0, 1);
  }
  /* Une monture = sa couleur + ses VRAIS parents : l'arbre s'arrête aux grands-parents du bébé (guide de l'éleveur 2026).
     Une capture n'a pas de parents ; une monture réussie a pour parents sa recette ; un bébé RATÉ a pour parents le couple
     qui l'a fait naître : il garde donc la recette de l'étape dans son arbre. */
  function canon(m) { return { c: m, p: TREE[m].p }; }
  function lineage(ind) {
    var w = new Map(); add(w, ind.c, 8);
    (ind.p || []).forEach(function (a) { add(w, a, 3); });
    return w;
  }
  function indKey(ind) { return ind.c + '<' + (ind.p || []).join('+'); }
  /* Répartition des issues d'un accouplement — modèle du simulateur dofuselevage.fr (non officiel) :
     parent ×8, grand-parents ×3 ; chaque couple de la grille donne ses deux couleurs et leur croisement s'il existe ;
     pénalité génération^-0,55 ; la génération cible (« la plus haute atteignable selon les parents et les grands-parents »)
     prend pTarget, le reste se répartit au prorata. */
  var OUT_CACHE = {};
  function outcomes(A, B, LA, LB, opti, s) { return outcomesInd(canon(A), canon(B), LA, LB, opti, s); }
  function outcomesInd(ia, ib, LA, LB, opti, s) {
    var ck = [indKey(ia), indKey(ib), LA, LB, opti ? 1 : 0, s && s.optiBonus, s && s.alma].join('~');
    if (OUT_CACHE[ck]) return OUT_CACHE[ck];
    var fa = lineage(ia), fb = lineage(ib), raw = new Map();
    fa.forEach(function (wa, a) {
      fb.forEach(function (wb, b) {
        var loc = new Map(); add(loc, a, 1); add(loc, b, 1);
        var r = recipe(a, b); if (r) add(loc, r, 1);
        loc.forEach(function (sc, m) { add(raw, m, wa * wb * sc * Math.pow(Math.max(1, TREE[m].gen), -0.55)); });
      });
    });
    var tot = 0; raw.forEach(function (v) { tot += v; });
    var items = []; raw.forEach(function (v, m) { items.push({ name: m, gen: TREE[m].gen, raw: v / tot }); });
    var tg = Math.max.apply(null, items.map(function (i) { return i.gen; }));
    var E = items.filter(function (i) { return i.gen === tg; }).reduce(function (x, i) { return x + i.raw; }, 0), C = 1 - E;
    var M = C <= 1e-12 ? 1 : pTarget(LA, LB, opti, s);
    items.forEach(function (i) {
      i.target = i.gen === tg;
      i.p = i.target ? (E > 0 ? i.raw / E * M : M) : (C > 0 ? i.raw / C * (1 - M) : 0);
    });
    items.sort(function (x, y) { return y.p - x.p || x.name.localeCompare(y.name); });
    var res = { items: items, targetGen: tg, pTarget: M, targets: items.filter(function (i) { return i.target; }).map(function (i) { return i.name; }) };
    OUT_CACHE[ck] = res;
    return res;
  }
  // chance qu'un bébé raté soit de la couleur d'un parent (il remplace alors le parent consommé)
  function recovery(A, B, LA, LB, opti, s) {
    var o = outcomes(A, B, LA, LB, opti, s), f = 1 - o.pTarget;
    var pa = 0, pb = 0;
    o.items.forEach(function (i) { if (i.name === A) pa = i.p; if (i.name === B) pb = i.p; });
    return { p: o.pTarget, rA: f > 0 ? pa / f : 0, rB: f > 0 ? pb / f : 0, out: o };
  }
  /* Bébés ratés de A × B : ils ont A et B pour parents. Recroisé avec un parent neuf (ou un autre raté), un raté garde la
     recette A × B dans son arbre : la génération visée reste atteignable. pRe = chance du bébé visé quand un raté est recroisé
     avec un neuf du côté le moins avancé ; genF = génétons moyens qu'un raté rapporte comme parent (selon SA génération). */
  var FAIL_CACHE = {};
  function failStats(A, B, L, opti, s) {
    var ck = [A, B, L, opti ? 1 : 0, s.optiBonus, s.alma].join('~');
    if (FAIL_CACHE[ck]) return FAIL_CACHE[ck];
    var o = outcomes(A, B, L, L, opti, s), X = recipe(A, B), other = TREE[A].gen <= TREE[B].gen ? A : B;
    var fails = o.items.filter(function (i) { return !i.target; }), f = fails.reduce(function (a, i) { return a + i.p; }, 0);
    var pRe = 0, genF = 0, w = 0;
    fails.forEach(function (i) {
      var q = f > 0 ? i.p / f : 0; if (q < 1e-4) return;
      var oc = outcomesInd({ c: i.name, p: [A, B] }, canon(other), L, L, opti, s), px = 0;
      oc.items.forEach(function (j) { if (j.name === X) px = j.p; });
      pRe += q * px; genF += q * GENETONS[i.gen]; w += q;
    });
    return (FAIL_CACHE[ck] = { pRe: w ? pRe / w : o.pTarget, genF: w ? genF / w : 0, fails: fails, other: other });
  }
  /* Réserve de parents d'une étape, suivie par TOURS (modèle moyen) : à chaque tour la moitié de la réserve s'accouple ;
     les deux parents deviennent stériles ; avec le clonage deux stériles redonnent un fertile (niveau 1) ; en recroisant
     les ratés, chaque bébé raté revient dans la réserve ; une réussite en sort.
     d = part de la réserve qui reste après un tour ; y = réussites par parent neuf si on recroise jusqu'au bout. */
  function poolParams(p, s) {
    var reuse = s.reuse !== false, cl = !!s.clone;
    if (reuse && cl) return { d: 1 - p / 2, y: 1 };
    if (reuse) return { d: (1 - p) / 2, y: p / (1 + p) };
    if (cl) return { d: 0.5, y: p };
    return { d: 0, y: p / 2 };
  }
  // parents neufs pour `need` réussites en `k` tours (1 tour = tout en parallèle, sans recroiser)
  function freshFor(need, p, k, s) {
    var pp = poolParams(p, s), kk = pp.d <= 0 ? 1 : Math.max(1, k || 1);
    return need / (pp.y * (1 - Math.pow(pp.d, kk)));
  }

  // ---------------------------------------------------------------- jauges, XP, temps, coûts
  function tierOf(l) { for (var k = 0; k < 4; k++) if (l <= CAPS[k]) return k; return 3; }
  // points vidés en `minutes` à partir d'une jauge à `start` (le débit baisse en changeant de palier)
  function drain(start, minutes) {
    var lvl = start, t = minutes;
    while (t > 1e-9 && lvl > 1e-9) {
      var k = tierOf(lvl), lower = k === 0 ? 0 : CAPS[k - 1], need = (lvl - lower) / RATE[k];
      if (need <= t) { lvl = lower; t -= need; } else { lvl -= RATE[k] * t; t = 0; }
    }
    return start - lvl;
  }
  function famIdx(f) { var i = FAMILIES.indexOf(f); if (i < 0) throw new Error('famille inconnue ' + f); return i; }
  // XP moyenne par heure si tu remplis la Mangeoire jusqu'au plafond de la famille toutes les `refillH` heures
  /* Remplissage de la barre à chaque connexion : le plafond du tier choisi, ou ton remplissage (fill, en points) s'il est donné
     (barre remplie en cliquant dessus). Le tier qui compte est celui où se trouve ce remplissage. */
  function fillOf(fam, fill) { var f = num(fill); return f !== null && f > 0 ? Math.min(f, CAPS[3]) : CAPS[famIdx(fam)]; }
  function xpPerHour(fam, refillH, fill) { return drain(fillOf(fam, fill), refillH * 60) / refillH; }
  // minutes pour délivrer `amount` points depuis une barre à `start` (Infinity si la barre n'en contient pas assez)
  function minutesToDrain(start, amount) {
    var lvl = start, t = 0, left = amount;
    while (left > 1e-9 && lvl > 1e-9) { var k = tierOf(lvl), lower = k === 0 ? 0 : CAPS[k - 1], seg = Math.min(lvl - lower, left); t += seg / RATE[k]; lvl -= seg; left -= seg; }
    return left > 1e-9 ? Infinity : t;
  }
  function num(v) { return v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v; }
  // coût (kamas / 1 000 pts) d'une recharge : chaque tranche se remplit avec la famille la moins chère autorisée à y monter
  function refillCostPer1000(fam, refillH, row, fill) {
    var cap = fillOf(fam, fill), fi = tierOf(cap), d = drain(cap, refillH * 60);
    if (d <= 0) return null;
    var lo = cap - d, cost = 0;
    for (var k = 0; k <= fi; k++) {
      var segLo = k === 0 ? 0 : CAPS[k - 1], a = Math.max(lo, segLo), b = Math.min(cap, CAPS[k]);
      if (b <= a) continue;
      var best = null;
      for (var f = k; f < 4; f++) { var pr = num(row[f]); if (pr !== null && (best === null || pr < best)) best = pr; }
      if (best === null) return null;
      cost += (b - a) / 1000 * best;
    }
    return cost / d * 1000;
  }
  function xpBetween(from, to) { from = clamp(Math.round(from), 1, 200); to = clamp(Math.round(to), 1, 200); return Math.max(0, XP[to] - XP[from]); }
  function levelHours(from, to, s) { return xpBetween(from, to) / xpPerHour(s.xpFam, s.refillH, s.xpFill); }
  function levelCost(from, to, s) {   // kamas par monture (la jauge nourrit toutes les montures de l'enclos)
    var c = refillCostPer1000(s.xpFam, s.refillH, s.fuel['Expérience'], s.xpFill);
    return c === null ? null : xpBetween(from, to) / 1000 * c / s.perEnclos;
  }
  // une fécondité = 2 phases de 20 000 pts (Endurance + Maturité, puis Amour) ; chaque phase attend la connexion suivante
  // une phase : 20 000 points délivrés depuis le remplissage ; une barre trop basse demande plusieurs connexions
  function fertPhaseH(s) {
    var F = fillOf(s.fertFam, s.fertFill), m = minutesToDrain(F, 20000);
    if (isFinite(m)) return m / 60;
    return Math.ceil(20000 / Math.max(1, drain(F, s.refillH * 60))) * s.refillH;
  }
  function fertHours(s) { return 2 * Math.max(fertPhaseH(s), s.refillH); }
  /* Seuils : un carburant remplit la jauge jusqu'à son plafond (Extrait 80 000, Philtre 140 000, Potion 180 000, Élixir 200 000),
     et le débit dépend de la charge, pas du carburant. On combine donc : chaque tranche se remplit avec le carburant le moins cher
     capable de l'atteindre (une tranche basse peut prendre un Philtre ou une Potion s'ils reviennent moins cher). */
  function cheapestFrom(row, k) {
    var best = null;
    for (var f = k; f < 4; f++) { var pr = num(row[f]); if (pr !== null && (best === null || pr < best)) best = pr; }
    return best;
  }
  function fertCost(s) {   // kamas par monture pour une fécondité (3 jauges à 20 000 + sérénité), points consommés dans la tranche de la famille choisie
    var fi = tierOf(fillOf(s.fertFam, s.fertFill)), tot = 0;
    var pts = { 'Endurance': 20000, 'Maturité': 20000, 'Amour': 20000, 'Gain de sérénité': s.seren / 2, 'Perte de sérénité': s.seren / 2 };
    for (var j in pts) { var pr = cheapestFrom(s.fuel[j], fi); if (pr === null) return null; tot += pts[j] / 1000 * pr; }
    return tot / s.perEnclos;
  }
  /* Mise de départ : pour tourner au débit d'une famille, la charge doit rester au-dessus du seuil de la famille d'en dessous.
     Ce socle se pose une fois par jauge et par enclos, au moins cher par tranche (Extraits jusqu'à 80 000, etc.) ; il n'est pas consommé. */
  function baseDeposit(fam, row) {
    var fi = famIdx(fam), tot = 0;
    for (var k = 0; k < fi; k++) {
      var pr = cheapestFrom(row, k); if (pr === null) return null;
      tot += (CAPS[k] - (k === 0 ? 0 : CAPS[k - 1])) / 1000 * pr;
    }
    return tot;
  }
  function depositTotal(s) {   // par enclos : Endurance, Maturité, Amour au palier de fécondité + Expérience au palier d'XP ; × nombre d'enclos
    var t = 0, ok = true;
    ['Endurance', 'Maturité', 'Amour'].forEach(function (j) { var d = baseDeposit(s.fertFam, s.fuel[j]); if (d === null) ok = false; else t += d; });
    var x = baseDeposit(s.xpFam, s.fuel['Expérience']); if (x === null) ok = false; else t += x;
    return ok ? t * s.enclos : null;
  }
  // préparation d'un parent : fécondité + XP ; la Mangeoire tourne aussi pendant la 2e phase (Amour), d'où le chevauchement
  function prepHours(startLvl, L, s) {
    var f = fertHours(s), lv = levelHours(startLvl, L, s);
    return f + Math.max(0, lv - f / 2);
  }
  // coût du craft avec tes prix : ingrédients (0 = droppé par toi) + Queues + Queue de Glourséleste ; null si un prix utile manque
  function optiCraft(gen, s) {
    var o = OPTI[Math.max(2, gen)]; if (!o) return null;
    var P = s.ingPrices || {}, t = 0;
    for (var k in o.ing) { var pr = num(P[k]); if (pr === null) return null; t += o.ing[k] * pr; }
    var q = num(s.queuePrice), gl = num(s.glourPrice);
    if (o.queues && q === null) return null;
    if (o.glour && gl === null) return null;
    return t + o.queues * (q || 0) + (o.glour ? gl : 0);
  }
  function optiCost(gen, s) {   // ton prix d'achat s'il est saisi, sinon le craft
    var buy = num(s.optiBuy && s.optiBuy[gen]);
    return buy !== null ? buy : optiCraft(gen, s);
  }

  /* Parents neufs par côté pour `need` réussites en k tours.
     Étape équilibrée (deux parents de même génération) : la réserve commune (freshFor), moitié de chaque côté.
     Étape déséquilibrée (ex. Prune × Rousse) avec ratés recroisés : chaque neuf du côté le plus avancé lance une « chaîne » ;
     un raté le remplace (il garde la recette dans son arbre) et la chaîne s'arrête à la réussite : en k tours elle réussit avec
     1 − (1 − p)^k. Côté le moins avancé : un neuf par tentative, moins les clones de ses stériles revenus au tour suivant. */
  function freshSplit(need, p, k, A, B, s) {
    var gA = TREE[A].gen, gB = TREE[B].gen, kk = Math.max(1, k || 1);
    if (s.reuse === false || gA === gB || poolParams(p, s).d <= 0) { var N0 = freshFor(need, p, kk, s); return { A: N0 / 2, B: N0 / 2 }; }
    var hi = need / (1 - Math.pow(1 - p, kk)), lo = need / p * (1 - (s.clone ? 0.5 * (kk - 1) / kk : 0));
    return gA > gB ? { A: hi, B: lo } : { A: lo, B: hi };
  }
  // ---------------------------------------------------------------- plan vers une cible
  function startLevel(m, s) { return TREE[m].gen === 1 ? s.capLevel : 1; }
  // places d'enclos : 6 enclos au maximum, 10 montures chacun (guide de l'éleveur 2026)
  function placesOf(s) { return clamp(Math.round(s.enclos || 1), 1, 6) * clamp(Math.round(s.perEnclos || 10), 1, 10); }
  /* Production d'une cible en espérance, de la gén. 10 vers les captures.
     need[X] = nombre de X à réussir. Pour X (parents A, B) au niveau L : chance p ; tentatives = need / p (2 parents préparés chacune).
     Parents NEUFS à fournir : freshFor(need, p, k) — k = tours de recroisement des ratés et des clones à cette étape
     (1 tour = tout en parallèle, sans recroiser) —, moitié A, moitié B, au moins 1 de chaque.
     Chaque tour en plus allonge l'étape d'une préparation : bébés ratés et clones repartent du niveau 1. */
  function nodeStatic(X, pol, s) {
    var c = s.__nc; if (!c) { c = {}; Object.defineProperty(s, '__nc', { value: c, enumerable: false }); }
    var key = X + '|' + pol.L + '|' + (pol.opti ? 1 : 0) + '|' + (pol.k || 1);
    if (c[key]) return c[key];
    var A = TREE[X].p[0], B = TREE[X].p[1], rec = recovery(A, B, pol.L, pol.L, pol.opti, s), p = rec.p;
    var k = poolParams(p, s).d <= 0 ? 1 : Math.max(1, pol.k || 1);
    var sp = freshSplit(1, p, k, A, B, s);
    return (c[key] = { A: A, B: B, p: p, rA: rec.rA, rB: rec.rB, k: k, shareA: sp.A, shareB: sp.B,
      lvA: levelCost(startLevel(A, s), pol.L, s), lvB: levelCost(startLevel(B, s), pol.L, s),
      prepA: prepHours(startLevel(A, s), pol.L, s), prepB: prepHours(startLevel(B, s), pol.L, s), prep1: prepHours(1, pol.L, s),
      fs: failStats(A, B, pol.L, pol.opti, s) });
  }
  /* PORTEURS (règle des grands-parents) : une monture qui reste à la fin d'une étape A × B (bébé raté, clone, parent pas
     accouplé) porte A et B dans son arbre. Plus tard, là où il faut un A (ou un B) comme parent, elle peut le remplacer : la
     génération visée se calcule avec les parents ET les grands-parents. On ne la prend que si la chance d'avoir la bonne couleur
     reste au moins 95 % de la chance normale (sinon la cible se partage avec une autre couleur de même génération). */
  var CARRY_CACHE = {};
  function carrierP(SA, SB, SL, Sopti, C, T, LT, optiT, s) {
    var ck = [SA, SB, SL, Sopti ? 1 : 0, C, T, LT, optiT ? 1 : 0, s.optiBonus, s.alma].join('~');
    if (CARRY_CACHE[ck] !== undefined) return CARRY_CACHE[ck];
    var fs = failStats(SA, SB, SL, Sopti, s), other = TREE[T].p[0] === C ? TREE[T].p[1] : TREE[T].p[0];
    var f = fs.fails.reduce(function (a, i) { return a + i.p; }, 0), acc = 0, w = 0;
    fs.fails.forEach(function (i) {
      var q = f > 0 ? i.p / f : 0; if (q < 1e-4) return;
      var oc = outcomesInd({ c: i.name, p: [SA, SB] }, canon(other), LT, LT, optiT, s), px = 0;
      oc.items.forEach(function (j) { if (j.name === T) px = j.p; });
      acc += q * px; w += q;
    });
    return (CARRY_CACHE[ck] = w ? acc / w : 0);
  }
  // montures qui restent à la fin d'une étape (elles portent ses deux parents)
  function leftoverOf(fA, fB, att, p, k, A, B, s) {
    var pp = poolParams(p, s), lo = 0;
    if (s.reuse === false) lo += att * (1 - p);                                   // ratés jamais recroisés
    if (s.reuse !== false && TREE[A].gen !== TREE[B].gen && pp.d > 0) lo += (TREE[A].gen > TREE[B].gen ? fA : fB) * Math.pow(1 - p, k);   // chaînes encore ratées
    else if (pp.d > 0) lo += (fA + fB) * Math.pow(pp.d, k);                       // réserve restante après k tours
    return lo;
  }
  function plan(target, policy, s) {
    var need = {}; need[target] = s.topNeed || 1;
    var usesBy = {};   // couleur → [{ gen, amt, T, L, opti, node }] : où elle sert de parent
    var order = NAMES.slice().sort(function (a, b) { return TREE[b].gen - TREE[a].gen || a.localeCompare(b); });
    var nodes = [], byName = {}, carried = 0;
    var kamas = 0, fuelK = 0, levK = 0, optiK = 0, placeH = 0, genetons = 0, optiCount = {}, missing = [];
    var fc = fertCost(s);
    if (fc === null) missing.push('prix des carburants Amour, Endurance, Maturité et Sérénité (' + s.fertFam + ')');
    function sumUses(C) { return (usesBy[C] || []).reduce(function (a, u) { return a + u.amt; }, 0); }
    order.forEach(function (X) {
      if (X !== target) need[X] = sumUses(X);
      if (!(need[X] > 1e-9) || TREE[X].gen === 1) return;
      var g = TREE[X].gen, pol = policy[g] || { L: 1, opti: false, k: 1 };
      var ns = nodeStatic(X, pol, s), A = ns.A, B = ns.B, p = ns.p, att = need[X] / p, k = ns.k;
      var fA = Math.max(1, need[X] * ns.shareA), fB = Math.max(1, need[X] * ns.shareB);
      var node = { name: X, gen: g, A: A, B: B, L: pol.L, opti: !!pol.opti, k: k, p: p, pRe: ns.fs.pRe, rA: ns.rA, rB: ns.rB, need: need[X], att: att,
                   fresh: fA + fB, consA: fA, consB: fB, porteurs: [] };
      (usesBy[A] = usesBy[A] || []).push({ gen: g, amt: fA, T: X, L: pol.L, opti: !!pol.opti, node: node });
      (usesBy[B] = usesBy[B] || []).push({ gen: g, amt: fB, T: X, L: pol.L, opti: !!pol.opti, node: node });
      // ce qui reste de cette étape remplace des A et des B demandés plus tard (générations au-dessus)
      if (s.porteurs !== false) {
        var lo = leftoverOf(fA, fB, att, p, k, A, B, s);
        [A, B].forEach(function (C) {
          (usesBy[C] || []).forEach(function (u) {
            if (lo <= 1e-9 || u.gen <= g || u.amt <= 1e-9) return;
            if (carrierP(A, B, pol.L, pol.opti, C, u.T, u.L, u.opti, s) < 0.95 * u.node.p) return;
            var take = Math.min(u.amt, lo); u.amt -= take; lo -= take; carried += take;
            u.node.porteurs.push({ color: C, n: take, from: X });
          });
        });
      }
      var lvA = ns.lvA, lvB = ns.lvB;
      if (lvA === null || lvB === null) { if (missing.indexOf('prix de l’XP (' + s.xpFam + ')') < 0) missing.push('prix de l’XP (' + s.xpFam + ')'); lvA = lvA || 0; lvB = lvB || 0; }
      var levelK = att * (lvA + lvB);
      var fert = att * 2 * (fc || 0);
      var oc = 0;
      if (pol.opti) {
        var unit = optiCost(g, s);
        if (unit === null) { if (missing.indexOf('prix de l’Optimakina gén. ' + g) < 0) missing.push('prix de l’Optimakina gén. ' + g); unit = 0; }
        oc = att * unit; optiCount[g] = (optiCount[g] || 0) + att;
      }
      var prepA = ns.prepA, prepB = ns.prepB, prep1 = ns.prep1;
      var hours = att * (prepA + prepB);
      placeH += hours; levK += levelK; fuelK += fert; optiK += oc;
      // génétons : selon la génération des DEUX parents ; au 1er tour deux neufs, ensuite un parent recyclé (raté ou clone)
      var fs = ns.fs, G = GENETONS[TREE[A].gen] + GENETONS[TREE[B].gen];
      var first = Math.min(need[X], p * Math.min(fA, fB));
      genetons += first * G + (need[X] - first) * (s.reuse !== false ? G / 2 + fs.genF : G);
      node.levelK = levelK; node.fertK = fert; node.optiK = oc; node.hours = hours; node.prepA = prepA; node.prepB = prepB; node.prep1 = prep1;
      nodes.push(node); byName[X] = node;
    });
    var caps = {}, capTot = 0;
    GEN1.forEach(function (g) { if (need[g] > 1e-9) { caps[g] = need[g]; capTot += need[g]; } });
    var filetK = capTot * (1 + s.capMargin) * (num(s.filet) || 0);
    kamas = fuelK + levK + optiK + filetK;
    // chemin critique : chaque étape attend ses parents (fécondité + XP), puis ses tours de recroisement ;
    // un parent fourni par des porteurs attend aussi la fin de l'étape qui les a donnés
    var crit = {};
    function ready(nd, C) {
      var t = cp(C);
      if (nd) nd.porteurs.forEach(function (q) { if (q.color === C) t = Math.max(t, cp(q.from)); });
      return t;
    }
    function cp(m) {
      if (crit[m] !== undefined) return crit[m];
      if (TREE[m].gen === 1) return (crit[m] = 0);
      var nd = byName[m], A = TREE[m].p[0], B = TREE[m].p[1];
      var pa = nd ? nd.prepA : prepHours(startLevel(A, s), 1, s), pb = nd ? nd.prepB : prepHours(startLevel(B, s), 1, s);
      return (crit[m] = Math.max(ready(nd, A) + pa, ready(nd, B) + pb) + (nd ? (nd.k - 1) * nd.prep1 : 0));
    }
    var crit0 = {};
    function cp0(m) {   // sans les tours de recroisement : tout réussit du premier coup
      if (crit0[m] !== undefined) return crit0[m];
      if (TREE[m].gen === 1) return (crit0[m] = 0);
      var nd = byName[m], A = TREE[m].p[0], B = TREE[m].p[1];
      var pa = nd ? nd.prepA : prepHours(startLevel(A, s), 1, s), pb = nd ? nd.prepB : prepHours(startLevel(B, s), 1, s);
      return (crit0[m] = Math.max(cp0(A) + pa, cp0(B) + pb));
    }
    var critH = cp(target), places = placesOf(s);
    var days = Math.max(critH, placeH / places) / 24;
    // calendrier de chaque étape (heures depuis le début, chemin critique) : elle démarre quand ses deux parents sont prêts
    nodes.forEach(function (n) { n.startH = Math.max(ready(n, n.A), ready(n, n.B)); n.doneH = cp(n.name); });
    nodes.sort(function (a, b) { return a.gen - b.gen || a.name.localeCompare(b.name); });
    return { target: target, nodes: nodes, need: need, credit: {}, captures: caps, capTot: capTot, capWithMargin: capTot * (1 + s.capMargin),
             kamas: kamas, fuelK: fuelK, levK: levK, optiK: optiK, filetK: filetK, placeH: placeH, critH: critH, seqH: 0, days: days,
             capDays: placeH / places / 24, bestDays: cp0(target) / 24, carried: carried,
             genetons: genetons, optiCount: optiCount, missing: missing, places: places, captureMin: s.captureMin,
             value: (num(s.neurone) || 0) * TREE[target].gen * (s.topNeed || 1) * (1 - (num(s.tax) || 0)) + genetons * genetonValueCached(s) };
  }
  // coût unitaire (kamas, heures-places) de chaque couleur du plan : sert à valoriser un parent perdu
  function unitCosts(pl, s) {
    var u = {};
    GEN1.forEach(function (g) { u[g] = { kamas: num(s.filet) || 0, hours: 0 }; });
    pl.nodes.forEach(function (n) {   // nodes triés par génération croissante : parents déjà connus
      var ua = u[n.A] || { kamas: 0, hours: 0 }, ub = u[n.B] || { kamas: 0, hours: 0 };
      var per = 1 / n.need;
      u[n.name] = {
        kamas: per * (n.levelK + n.fertK + n.optiK + n.consA * ua.kamas + n.consB * ub.kamas),
        hours: per * (n.hours + n.consA * ua.hours + n.consB * ub.hours)
      };
    });
    return u;
  }
  // les génétons ne comptent PAS dans l'objectif : sinon rater plus souvent (donc réussir plus d'étapes) paraîtrait rentable
  /* Objectif « temps » : jours d'élevage + ton propre temps de capture (s.captureMin minutes par capture, 5 par défaut),
     pour ne pas gagner quelques heures au prix de centaines de captures. */
  function timeOf(pl) { return pl.days + pl.capTot * (num(pl.captureMin) === null ? 5 : pl.captureMin) / 1440; }
  /* « renta » : kamas gagnés par jour = (valeur obtenue − kamas dépensés) ÷ (jours + temps de capture). */
  function objectiveValue(pl, obj) {
    if (obj === 'kamas') return pl.kamas;
    if (obj === 'renta') return -(pl.value - pl.kamas) / Math.max(timeOf(pl), 1e-9);
    return timeOf(pl);
  }
  function better(a, b, obj) {
    var va = objectiveValue(a, obj), vb = objectiveValue(b, obj);
    if (va < vb - 1e-9) return true;
    if (va > vb + 1e-9) return false;
    return obj === 'kamas' ? a.days < b.days - 1e-9 : a.kamas < b.kamas - 1e-9;
  }
  var LEVELS = [1, 20, 40, 60, 80, 100, 120, 134, 150, 167, 184, 200];
  var TOURS = [1, 2, 3, 5];   // tours de recroisement des ratés et des clones à une étape (1 = tout en parallèle)
  function gensOf(target) {
    var gens = [];
    (function walk(m) { if (TREE[m].gen > 1 && gens.indexOf(TREE[m].gen) < 0) gens.push(TREE[m].gen); TREE[m].p.forEach(walk); })(target);
    return gens.sort(function (a, b) { return a - b; });
  }
  /* Recherche du meilleur niveau, de l'Optimakina et du nombre de tours par génération : on part des stratégies uniformes,
     puis on améliore les 3 meilleures génération par génération (descente coordonnée) jusqu'à stabilité. */
  function optimize(target, s, obj, opts) {
    opts = opts || {};
    var gens = gensOf(target), allowOpti = opts.allowOpti !== false, tours = opts.tours || TOURS;
    var options = [];
    LEVELS.forEach(function (L) { [false, true].forEach(function (o) { if (!o || allowOpti) tours.forEach(function (k) { options.push({ L: L, opti: o, k: k }); }); }); });
    var starts = options.filter(function (op) { return op.k <= 3; }).map(function (op) {
      var pol = {}; gens.forEach(function (g) { pol[g] = { L: op.L, opti: op.opti && optiCost(g, s) !== null, k: op.k }; });
      return { pol: pol, pl: plan(target, pol, s) };
    }).sort(function (a, b) { return better(a.pl, b.pl, obj) ? -1 : (better(b.pl, a.pl, obj) ? 1 : 0); }).slice(0, opts.starts || 3);
    var champion = null;
    starts.forEach(function (st) {
      var pol = st.pol, best = st.pl;
      for (var pass = 0; pass < 5; pass++) {
        var changed = false;
        gens.forEach(function (g) {
          options.forEach(function (op) {
            if (op.opti && optiCost(g, s) === null) return;
            var trial = JSON.parse(JSON.stringify(pol)); trial[g] = { L: op.L, opti: op.opti, k: op.k };
            var pl = plan(target, trial, s);
            if (better(pl, best, obj)) { pol = trial; best = pl; changed = true; }
          });
        });
        if (!changed) break;
      }
      if (!champion || better(best, champion.plan, obj)) champion = { policy: pol, plan: best };
    });
    champion.gens = gens;
    return champion;
  }
  function uniformPolicy(target, L, opti, k) {
    var pol = {};
    (function walk(m) { if (TREE[m].gen > 1) pol[TREE[m].gen] = { L: L, opti: opti, k: k || 1 }; TREE[m].p.forEach(walk); })(target);
    return pol;
  }

  // ---------------------------------------------------------------- analyse « à quel niveau accoupler ? » (méthode de la vidéo, en temps)
  /* Pour une étape et chaque niveau : la chance, le temps de préparation (XP de 1 au niveau + fécondité), les tentatives,
     et le temps d'enclos par réussite, en comptant les parents neufs consommés à leur coût de production (values).
     k = tours de recroisement de l'étape (ceux du plan). */
  function levelAnalysis(X, s, values, levels, k) {
    var A = TREE[X].p[0], B = TREE[X].p[1], g = TREE[X].gen;
    var va = values[A] || { kamas: 0, hours: 0 }, vb = values[B] || { kamas: 0, hours: 0 };
    var fc = fertCost(s) || 0, oc = optiCost(g, s), rows = [];
    (levels || LEVELS).forEach(function (L) {
      [false, true].forEach(function (o) {
        var p = recovery(A, B, L, L, o, s).p, att = 1 / p, sp = freshSplit(1, p, k || 1, A, B, s), consA = sp.A, consB = sp.B;
        var lev = (levelCost(startLevel(A, s), L, s) || 0) + (levelCost(startLevel(B, s), L, s) || 0);
        var kam = att * (lev + 2 * fc + (o ? (oc || 0) : 0)) + consA * va.kamas + consB * vb.kamas;
        var prepA = prepHours(startLevel(A, s), L, s), prepB = prepHours(startLevel(B, s), L, s);
        var own = att * (prepA + prepB);
        rows.push({ L: L, opti: o, p: p, att: att, consumed: consA + consB, xpH: levelHours(1, L, s), levK: lev, kamas: kam,
                    ownH: own, placeH: own + consA * va.hours + consB * vb.hours, waitH: Math.max(prepA, prepB),
                    seqDays: att * Math.max(prepA, prepB) / 24, optiMissing: o && oc === null });
      });
    });
    var best = function (key, o) {
      var r = rows.filter(function (x) { return x.opti === o && !x.optiMissing; });
      return r.reduce(function (m, x) { return x[key] < m[key] ? x : m; }, r[0]);
    };
    return { X: X, A: A, B: B, gen: g, rows: rows, bestKamas: [best('kamas', false), best('kamas', true)], bestHours: [best('placeH', false), best('placeH', true)] };
  }

  // ---------------------------------------------------------------- dernier croisement (gén. 10)
  function finalCross(X, L, opti, s) {
    var A = TREE[X].p[0], B = TREE[X].p[1], rec = recovery(A, B, L, L, opti, s), p = rec.p;
    var o = rec.out, fail = 1 - p, back9 = 0;
    o.items.forEach(function (i) { if (!i.target && i.gen === 9) back9 += i.p; });
    var n9 = (TREE[A].gen === 9 ? 1 : 0) + (TREE[B].gen === 9 ? 1 : 0);
    // gén. 9 neuves par gén. 10 réussie, en recroisant ratés et clones jusqu'au bout (un raté garde la gén. 9 dans son arbre)
    var sp = freshSplit(1, p, 50, A, B, s), used9 = (TREE[A].gen === 9 ? sp.A : 0) + (TREE[B].gen === 9 ? sp.B : 0);
    var gen = GENETONS[TREE[A].gen] + GENETONS[TREE[B].gen], fs = failStats(A, B, L, opti, s);
    var other = TREE[A].gen === 9 && TREE[B].gen !== 9 ? B : A;
    return { X: X, A: A, B: B, p: p, pRe: fs.pRe, back9: fail > 0 ? back9 / fail : 0, back9abs: back9, used9: used9, genetons: gen,
             genRe: GENETONS[TREE[other].gen] + fs.genF,
             genPer9: used9 > 0 ? gen / used9 : Infinity, items: o.items };
  }

  // ---------------------------------------------------------------- rentabilité dans le temps (carburants × durée)
  /* Valeur du résultat : le bébé gén. 10 extrait (10 neurones, net de taxe) + tous les génétons gagnés en chemin et au dernier croisement.
     Pour chaque couple (carburant de l'XP, carburant de fécondité), on cherche la meilleure stratégie et on compare durée, kamas et bénéfice par jour. */
  /* Valeur d'un généton : le parchemin de caractéristique qui rapporte le plus de kamas par généton (prix HDV net de taxe ÷ coût).
     Coûts 3.7 chez Eugène Éton : Petit 10, Parchemin 30, Grand 70, Puissant 170 (dofuspourlesnoobs, màj 3.7 ; confirmés par la capture de la boutique).
     Chaque parchemin donne +1 (le Puissant +2) tant que la caractéristique additionnelle est sous son plafond : 25, 50, 75, 100.
     Une valeur saisie à la main (s.genetonValue) l'emporte. */
  var SCROLLS = [['Petit Parchemin', 10, 25, 1], ['Parchemin', 30, 50, 1], ['Grand Parchemin', 70, 75, 1], ['Puissant Parchemin', 170, 100, 2]];   // nom, coût, plafond, gain
  var SCROLL_STATS = ['Vitalité', 'Sagesse', 'Force', 'Intelligence', 'Chance', 'Agilité'];
  function scrollName(size, stat) { return size + (/^[AEÉIOU]/.test(stat) ? " d'" : ' de ') + stat; }
  function scrollValues(s) {
    var tax = num(s.tax) || 0, P = s.scrollPrices || {}, rows = [];
    SCROLL_STATS.forEach(function (st) {
      SCROLLS.forEach(function (sc, i) {
        var pr = num((P[st] || [])[i]); if (pr === null) return;
        rows.push({ stat: st, size: i, name: scrollName(sc[0], st), cost: sc[1], price: pr, perGeneton: pr * (1 - tax) / sc[1] });
      });
    });
    return rows.sort(function (a, b) { return b.perGeneton - a.perGeneton; });
  }
  function genetonValueCached(s) {
    var c = s.__gv; if (c === undefined) { c = genetonValue(s); Object.defineProperty(s, '__gv', { value: c, enumerable: false }); }
    return c;
  }
  function genetonValue(s) {
    var o = num(s.genetonValue); if (o !== null) return o;
    var r = scrollValues(s); return r.length ? r[0].perGeneton : 0;
  }
  function resultValue(pl, s) {
    var neur = (num(s.neurone) || 0) * TREE[pl.target].gen * (1 - (num(s.tax) || 0));
    var gen = pl.genetons * genetonValue(s);
    return { neurones: neur, genetons: gen, total: neur + gen };
  }
  function profitability(target, s, obj) {
    var rows = [];
    FAMILIES.forEach(function (xf) {
      FAMILIES.forEach(function (ff) {
        var t = JSON.parse(JSON.stringify(s)); t.xpFam = xf; t.fertFam = ff; t.xpFill = null; t.fertFill = null;
        var lc = refillCostPer1000(xf, t.refillH, t.fuel['Expérience']), fc = fertCost(t);
        if (lc === null || fc === null) { rows.push({ xpFam: xf, fertFam: ff, missing: true }); return; }
        var r = optimize(target, t, obj, { starts: 1, tours: [1, 2, 3], allowOpti: s.allowOpti !== false }), pl = r.plan, v = resultValue(pl, t);
        rows.push({ xpFam: xf, fertFam: ff, policy: r.policy, plan: pl, days: pl.days, kamas: pl.kamas, fuel: pl.fuelK + pl.levK,
                    value: v.total, valueNeur: v.neurones, valueGen: v.genetons, profit: v.total - pl.kamas,
                    perDay: (v.total - pl.kamas) / Math.max(pl.days, 1e-9) });
      });
    });
    var ok = rows.filter(function (r) { return !r.missing; });
    var cheapest = ok.reduce(function (m, r) { return !m || r.kamas < m.kamas ? r : m; }, null);
    ok.forEach(function (r) {
      var dd = cheapest.days - r.days;
      r.dayGain = dd;
      r.costPerDay = dd > 1e-6 ? (r.kamas - cheapest.kamas) / dd : null;
    });
    return { rows: rows, cheapest: cheapest,
             fastest: ok.reduce(function (m, r) { return !m || r.days < m.days - 1e-9 || (Math.abs(r.days - m.days) <= 1e-9 && r.kamas < m.kamas) ? r : m; }, null),
             bestPerDay: ok.reduce(function (m, r) { return !m || r.perDay > m.perDay ? r : m; }, null) };
  }

  // ---------------------------------------------------------------- brisage des dragodindes
  /* Bonus au niveau L : les guides donnent la valeur maximale (niveau 200) et disent que les bonus montent vite jusqu'au 100 puis lentement.
     Modèle : part c (75 % par défaut = 300 Vitalité sur 400) atteinte linéairement au niveau 100, le reste linéairement de 100 à 200.
     Poids extrait d'une ligne = (3 × valeur × poids × niveau de l'objet / 200 + 1) × coefficient (formule de la vidéo) ;
     les runes sortent de la plus grosse à la plus petite (Ra, puis Pa, puis simple, la dernière en moyenne). */
  function statAtLevel(max, L, b) {
    var c = num(b.curve100); if (c === null) c = 0.75;
    L = clamp(L, 1, 200);
    return L <= 100 ? max * c * L / 100 : max * (c + (1 - c) * (L - 100) / 100);
  }
  /* Modèle « jeu » (par défaut) : taux de brisage fixe de 50 % pour les montures (constaté en jeu par l'utilisateur),
     niveau de l'objet = niveau de la monture, bonus comptés à leur valeur maximale (un muldo sous le niveau 100 n'affiche
     pas son PM mais donne quand même des runes Ga PM). Il retrouve les deux mesures de la vidéo :
     0,756 rune Ga PM au niveau 100 (≈ 0,80 mesuré) et 1,506 au niveau 200 (76 runes pour 50 muldos = 1,52). */
  function itemLevelOf(L, b) { return b.mountLevel === false ? b.itemLevel : clamp(L, 1, 200); }
  /* Le brisage ne donne que des runes SIMPLES (constaté en jeu) ; les Pa et Ra s'obtiennent par fusion :
     3 simples → 1 Pa, 3 Pa → 1 Ra (next-stage.fr), donc 1 Pa = 3 simples et 1 Ra = 9 simples.
     Chaque simple vaut donc le meilleur de : son prix, prix Pa / 3, prix Ra / 9 (prix connus seulement). */
  var FUSION = [1, 3, 9];
  function bestPerSimple(st, prices) {
    var best = null;
    st.runes.forEach(function (r, i) {
      var pr = num(prices[r[0]]); if (pr === null) return;
      var per = pr / FUSION[i];
      if (!best || per > best.per) best = { per: per, rune: r[0], step: i, price: pr };
    });
    return best;
  }
  function runeLine(stat, value, b, prices, tax, L) {
    var st = BR.stats[stat], W = (3 * value * st.weight * itemLevelOf(L, b) / 200 + 1) * b.coef / 100;
    // runes simples seulement (ton choix) : chaque rune vaut le prix de la rune simple ; b.fusion = true → meilleur de simple, Pa ÷ 3, Ra ÷ 9
    var base = st.runes[0], n = W / (base[1] * st.weight), sp = num(prices[base[0]]);
    var best = b.fusion === true ? bestPerSimple(st, prices) : (sp === null ? null : { per: sp, rune: base[0], step: 0, price: sp });
    var kamas = best ? n * best.per * (1 - tax) : 0;
    var got = [{ rune: base[0], n: n, price: num(prices[base[0]]) }];
    var fuse = best && best.step > 0 ? { rune: best.rune, n: n / FUSION[best.step], price: best.price } : null;
    return { stat: stat, value: value, weight: W, runes: got, fuse: fuse, perSimple: best ? best.per : null, kamas: kamas,
             missing: !best, baseRune: base[0], baseCount: n };
  }
  function brisageDD(X, L, s) {
    var b = s.ddBrise, prices = s.runePrices || {}, tax = num(s.tax) || 0, bonus = BR.dd[X] || {};
    var lines = Object.keys(bonus).map(function (st) {
      return runeLine(st, b.jetMax === false ? statAtLevel(bonus[st], L, b) : bonus[st], b, prices, tax, L);
    });
    var kamas = lines.reduce(function (a, l) { return a + l.kamas; }, 0), missing = lines.filter(function (l) { return l.missing; });
    var xp = levelCost(1, L, s), hours = levelHours(1, L, s);
    var extract = TREE[X].gen >= 2 ? TREE[X].gen * (num(s.neurone) || 0) * (1 - tax) : 0;
    var gain = kamas - (xp || 0) - extract;
    // prix de rentabilité : la ligne sans prix la plus lourde, les autres lignes sans prix comptées 0
    var be = null;
    if (missing.length) {
      var key = missing.slice().sort(function (x, y) { return y.weight - x.weight; })[0];
      var need = extract + (xp || 0) - kamas;
      be = { rune: key.baseRune, stat: key.stat, count: key.baseCount, price: need <= 0 ? 0 : need / (key.baseCount * (1 - tax)) };
    }
    return { X: X, gen: TREE[X].gen, L: L, lines: lines, kamas: kamas, missing: missing.length > 0, xp: xp, hours: hours, extract: extract, gain: gain, breakEven: be };
  }
  // meilleur niveau de brisage (gain maximal, prix connus) sur une grille de niveaux
  function bestBrisageLevel(X, s) {
    var best = null;
    for (var L = 1; L <= 200; L += (L < 10 ? 1 : 5)) {
      var r = brisageDD(X, L, s);
      if (r.missing) return null;
      if (!best || r.gain > best.gain) best = r;
    }
    return best;
  }

  /* Rentabilité en TEMPS d'une dragodinde déjà produite : ce que rapporte en plus chaque jour de place d'enclos passé à la monter,
     par rapport au mieux immédiat (l'extraire, ou la briser tout de suite au niveau 1). Une monture mise en enclos y reste au moins
     jusqu'à ta connexion suivante (s.refillH) : les premiers niveaux, presque instantanés, ne divisent pas par zéro. */
  function placeHours(h, s) { return Math.max(h, num(s.refillH) || 12); }
  function instantBest(X, s) { var r = brisageDD(X, 1, s); return r.missing ? 0 : Math.max(0, r.gain); }
  function bestBrisageTime(X, s) {
    var base = instantBest(X, s), best = null;
    for (var L = 2; L <= 200; L += (L < 10 ? 1 : 5)) {
      var r = brisageDD(X, L, s); if (r.missing) return null;
      var v = (r.gain - base) * 24 / placeHours(r.hours, s);
      if (!best || v > best.perPlaceDay) best = { L: L, gain: r.gain, hours: r.hours, perPlaceDay: v };
    }
    return { best: best, base: base };
  }
  // vente au niveau 200, à TON prix (vide = cette monture ne se vend pas)
  function saleDD(X, s) {
    var pr = num((s.sell200 || {})[X]); if (pr === null) return null;
    var tax = num(s.tax) || 0, xp = levelCost(1, 200, s) || 0, hours = levelHours(1, 200, s);
    var extract = TREE[X].gen >= 2 ? TREE[X].gen * (num(s.neurone) || 0) * (1 - tax) : 0;
    var gain = pr * (1 - tax) - xp - extract, base = instantBest(X, s);
    return { price: pr, gain: gain, hours: hours, perPlaceDay: (gain - base) * 24 / placeHours(hours, s) };
  }

  // ---------------------------------------------------------------- multiplier une dragodinde déjà obtenue (ex. 50 gén. 10)
  /* Deux façons d'en faire d'autres, une fois une X obtenue :
     'cap'  : X × une capture gén. 1 de son arbre (la Rousse pour Prune et Rousse). La génération visée est celle de X : même
              chance que X × X. Un raté garde X et la capture dans son arbre : recroisé avec une nouvelle capture, il vise encore X.
              Une X lance donc une « chaîne » qui ne s'arrête pas ; deux X stériles clonées en lancent une de plus.
     'self' : X × X. Deux X fécondes donnent au mieux un bébé X et deux stériles ; le clone de deux stériles ne rend qu'une
              féconde : la réserve de X fécondes ne grandit jamais.
     Modèle dofuselevage (non officiel) : à vérifier dans l'interface d'accouplement du jeu. */
  function shareOf(o, X) { var p = 0; o.items.forEach(function (i) { if (i.name === X) p = i.p; }); return p; }
  function partnerFor(X, L, opti, s) {   // la capture qui laisse toute la chance sur X
    var best = null;
    GEN1.forEach(function (c) {
      var o = outcomesInd(canon(X), canon(c), L, L, opti, s);
      if (o.targetGen !== TREE[X].gen) return;
      var p = shareOf(o, X);
      if (!best || p > best.p) best = { c: c, p: p, full: o.pTarget };
    });
    return best && best.p >= 0.95 * best.full ? best : null;
  }
  function chainP(X, c, L, opti, s) {
    var o = outcomesInd(canon(X), canon(c), L, L, opti, s), p = shareOf(o, X), f = 1 - p, pRe = 0, w = 0;
    o.items.forEach(function (i) {
      if (i.name === X || i.p < 1e-6 || f <= 0) return;
      pRe += i.p / f * shareOf(outcomesInd({ c: i.name, p: [X, c] }, canon(c), L, L, opti, s), X); w += i.p / f;
    });
    pRe = w ? pRe / w : p;
    var piX = p >= 1 ? 1 : pRe / (1 - p + pRe);   // part des têtes de chaîne qui sont des X (les autres : des ratés porteurs)
    return { p: p, pRe: pRe, pEff: piX * p + (1 - piX) * pRe, piX: piX };
  }
  function multiply(X, s, o) {
    o = o || {};
    var L = clamp(Math.round(o.L || 1), 1, 200), opti = !!o.opti, method = o.method || 'cap', start = Math.max(1, o.start || 1);
    var targets = (o.N && o.N.length ? o.N : [o.N || 50]).slice().sort(function (a, b) { return a - b; });
    var g = TREE[X].gen, unit = opti ? optiCost(g, s) : 0;
    if (opti && unit === null) return null;
    var st, partner = null;
    if (method === 'cap') { partner = partnerFor(X, L, opti, s); if (!partner) return null; st = chainP(X, partner.c, L, opti, s); }
    else { var px = shareOf(outcomes(X, X, L, L, opti, s), X); st = { p: px, pRe: 0, pEff: px, piX: 1 }; }
    var refill = num(s.refillH) || 12, places = placesOf(s), hmax = Math.floor(places / 2);
    var prepX = prepHours(1, L, s), prepC = method === 'cap' ? prepHours(s.capLevel || 1, L, s) : prepX;
    var T = Math.max(1, Math.ceil(Math.max(prepX, prepC) / refill - 1e-9)) * refill;   // une tentative par connexion entière
    // ce que coûte une tentative : Makina, filet, XP et fécondité des deux parents (à tes prix de carburant)
    var fc = fertCost(s) || 0, perAtt = (opti ? unit : 0) + (method === 'cap' ? (num(s.filet) || 0) : 0) +
      (levelCost(1, L, s) || 0) + (levelCost(method === 'cap' ? (s.capLevel || 1) : 1, L, s) || 0) + 2 * fc;
    function run(grow) {   // en moyenne, tentative par tentative ; grow = cloner les X stériles pour lancer d'autres chaînes
      var h = method === 'cap' ? Math.min(start, hmax) : Math.min(start, places), Sx = 0, count = start, t = 0, att = 0, clones = 0;
      var hit = {}, k = 0;
      for (var cyc = 0; cyc < 4000 && k < targets.length; cyc++) {
        var a = method === 'cap' ? Math.min(h, hmax) : Math.min(h / 2, hmax);
        if (a < 0.02) break;
        att += a; t += T;
        if (method === 'cap') { count += a * st.pEff; Sx += a * st.piX; }
        else { count += a * st.p; h += a * st.p - 2 * a; Sx += 2 * a; }
        while (k < targets.length && count >= targets[k] - 1e-9) { hit[targets[k]] = { days: t / 24, att: att, clones: clones }; k++; }
        if (grow) {
          var room = method === 'cap' ? hmax - h : places - h, c2 = Math.max(0, Math.min(Sx / 2, room));
          if (c2 > 1e-9) { h += c2; Sx -= 2 * c2; count -= c2; clones += c2; }
        }
      }
      return { hit: hit, max: count };
    }
    var runs = [run(true), run(false)], res = {};
    targets.forEach(function (n) {
      var best = null;
      runs.forEach(function (r, i) { var x = r.hit[n]; if (x && (!best || x.days < best.days)) best = Object.assign({ grow: i === 0 }, x); });
      res[n] = best;
    });
    var perDayAtt = hmax * 24 / T, perDay = method === 'cap' ? perDayAtt * st.pEff : 0;
    var valueX = g * (num(s.neurone) || 0) * (1 - (num(s.tax) || 0));
    return { X: X, method: method, L: L, opti: opti, partner: partner && partner.c, p: st.p, pRe: st.pRe, pEff: st.pEff, T: T, unit: unit,
             perDay: perDay, attPerDay: method === 'cap' ? perDayAtt : 0, costPerAtt: perAtt, valueX: valueX,
             gainPerDay: method === 'cap' ? perDay * valueX - perDayAtt * perAtt : null,
             reach: res, maxReach: Math.max(runs[0].max, runs[1].max), start: start };
  }
  var MULT_LEVELS = [1, 20, 40, 60, 80, 100, 120, 150, 167, 200];
  // meilleur niveau pour multiplier X à la chaîne : 'jours' = le plus de X par jour ; 'renta' = le plus de kamas par jour ; 'sans' = sans Makina
  function bestMultiply(X, s, mode, N) {
    var best = null;
    MULT_LEVELS.forEach(function (L) {
      [false, true].forEach(function (op) {
        if (op && mode === 'sans') return;
        var r = multiply(X, s, { L: L, opti: op, N: N || [50] });
        if (!r) return;
        var v = mode === 'renta' ? r.gainPerDay : r.perDay;
        if (!best || v > best.v + 1e-9) best = { v: v, r: r };
      });
    });
    return best && best.r;
  }

  // ---------------------------------------------------------------- brisage Muldo / Volkorne
  // « jeu » : (3 × bonus × poids × niveau de la monture / 200 + 1) × taux / poids de la rune ; « video » : formule de la vidéo
  function brisageRunes(L, b) {
    if (b.model === 'video') return (3 * (L / 100) * b.weight * b.itemLevel / 200 + 1) / b.divisor;
    var stat = num(b.stat); if (stat === null) stat = 1;
    var coef = num(b.coef); if (coef === null) coef = 50;
    return (3 * stat * b.weight * clamp(L, 1, 200) / 200 + 1) * coef / 100 / b.weight;
  }
  function brisage(L, b) {
    var runes = brisageRunes(L, b);
    var xp = xpBetween(b.capLevel, L), cost = xp * b.pricePerXp / b.perEnclos;
    var gross = runes * b.runePrice * (1 - b.tax);
    var profit = gross - cost - b.filet, hours = xp / b.xpPerHour;
    return { L: L, runes: runes, xp: xp, cost: cost, gross: gross, profit: profit, pct: profit / (cost + b.filet),
             hours: hours, perHour: hours > 0 ? profit / hours : null };
  }

  // ---------------------------------------------------------------- calculateur par cible (comme muldo-calculator, pour les dragodindes)
  /* Tu pars de `mult` lots de captures : un lot = une capture par feuille gén. 1 de l'arbre de la cible
     (une branche indépendante par apparition d'une couleur dans l'arbre, comme muldo-calculator).
     À chaque étape : paires = min(A, B) ; la réserve (2 × paires) se croise pendant k tours (ratés recroisés et clones selon
     tes réglages ; 1 tour = un seul accouplement par paire) ; bébés attendus = réussites. Tout est proportionnel au nombre de lots.
     Durée : une étape attend ses deux parents, puis k préparations (XP au niveau choisi + fécondité). */
  function cascade(target, s, o) {
    o = o || {};
    var mult = Math.max(0, num(o.mult) === null ? 1 : +o.mult), steps = {}, order = [], leaves = {};
    function par(g) {
      var d = o.def || { L: 1, opti: false, k: 1 }, x = (o.perGen && o.perGen[g]) || {};
      return { L: clamp(Math.round(num(x.L) === null ? d.L : x.L), 1, 200), opti: x.opti == null ? !!d.opti : !!x.opti,
               k: Math.max(1, Math.round(num(x.k) === null ? (d.k || 1) : x.k)) };
    }
    function walk(m) {   // { n : montures obtenues, t : heures avant qu'elles soient prêtes }
      if (TREE[m].gen === 1) { leaves[m] = (leaves[m] || 0) + mult; return { n: mult, t: 0 }; }
      var A = TREE[m].p[0], B = TREE[m].p[1], a = walk(A), b = walk(B), g = TREE[m].gen, pr = par(g);
      var p = recovery(A, B, pr.L, pr.L, pr.opti, s).p, pp = poolParams(p, s), k = pp.d <= 0 ? 1 : pr.k;
      var pairs = Math.min(a.n, b.n), babies, gA = TREE[A].gen, gB = TREE[B].gen;
      if (s.reuse !== false && gA !== gB && pp.d > 0) {   // étape déséquilibrée : chaînes du côté avancé, un neuf par tentative de l'autre côté
        var nHi = gA > gB ? a.n : b.n, nLo = gA > gB ? b.n : a.n;
        babies = Math.min(nHi * (1 - Math.pow(1 - p, k)), nLo / (1 - (s.clone ? 0.5 * (k - 1) / k : 0)) * p);
      } else babies = 2 * pairs * pp.y * (1 - Math.pow(pp.d, k));
      var prepA = prepHours(startLevel(A, s), pr.L, s), prepB = prepHours(startLevel(B, s), pr.L, s), prep1 = prepHours(1, pr.L, s);
      var t = Math.max(a.t + prepA, b.t + prepB) + (k - 1) * prep1;
      if (steps[m]) steps[m].groups++;
      else {
        order.push(m);
        steps[m] = { name: m, gen: g, A: A, B: B, nA: a.n, nB: b.n, pairs: pairs, L: pr.L, opti: pr.opti, k: k, p: p,
                     pRe: failStats(A, B, pr.L, pr.opti, s).pRe, attempts: babies / p, babies: babies, firstRound: pairs * p,
                     lost: Math.abs(a.n - b.n), t: t, prep: Math.max(prepA, prepB), groups: 1 };
      }
      return { n: babies, t: t };
    }
    var r = walk(target), list = order.map(function (m) { return steps[m]; });
    var capTot = Object.keys(leaves).reduce(function (x, c) { return x + leaves[c]; }, 0);
    return { target: target, steps: list, babies: r.n, hours: r.t, captures: leaves, capTot: capTot, mult: mult,
             multFor1: mult > 0 && r.n > 0 ? mult / r.n : null, pAtLeastOne: 1 - Math.exp(-r.n) };
  }

  var API = { TREE: TREE, XP: XP, NAMES: NAMES, GEN1: GEN1, GENETONS: GENETONS, FAMILIES: FAMILIES, CAPS: CAPS, RATE: RATE, JAUGES: JAUGES,
              OPTI: OPTI, LEVELS: LEVELS, recipe: recipe, pTarget: pTarget, outcomes: outcomes, recovery: recovery, drain: drain,
              xpPerHour: xpPerHour, fillOf: fillOf, minutesToDrain: minutesToDrain, tierOf: tierOf, refillCostPer1000: refillCostPer1000, xpBetween: xpBetween, levelHours: levelHours, levelCost: levelCost,
              fertHours: fertHours, fertCost: fertCost, cheapestFrom: cheapestFrom, baseDeposit: baseDeposit, depositTotal: depositTotal, prepHours: prepHours, optiCost: optiCost, optiCraft: optiCraft, plan: plan, unitCosts: unitCosts,
              optimize: optimize, uniformPolicy: uniformPolicy, gensOf: gensOf, levelAnalysis: levelAnalysis, finalCross: finalCross, brisage: brisage, resultValue: resultValue, profitability: profitability, BR: BR, statAtLevel: statAtLevel, runeLine: runeLine, brisageDD: brisageDD, bestBrisageLevel: bestBrisageLevel, bestPerSimple: bestPerSimple,
              SCROLLS: SCROLLS, SCROLL_STATS: SCROLL_STATS, scrollName: scrollName, scrollValues: scrollValues, genetonValue: genetonValue,
              TOURS: TOURS, canon: canon, outcomesInd: outcomesInd, failStats: failStats, poolParams: poolParams, freshFor: freshFor, placesOf: placesOf,
              cascade: cascade, freshSplit: freshSplit, carrierP: carrierP, leftoverOf: leftoverOf, multiply: multiply, bestMultiply: bestMultiply, partnerFor: partnerFor, chainP: chainP, MULT_LEVELS: MULT_LEVELS, bestBrisageTime: bestBrisageTime, saleDD: saleDD, instantBest: instantBest };
  if (typeof module !== 'undefined') module.exports = API; else root.DD = API;
})(this);
