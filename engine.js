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
  // Optimakina de Dragodinde : coût du craft hors Queue de dragodinde sauvage (classeur, prix Ombre/Kourial) et nombre de Queues
  var OPTI = {
    2: { lvl: 29, base: 8400, queues: 0 }, 3: { lvl: 49, base: 9630, queues: 1 }, 4: { lvl: 69, base: 8327, queues: 1 },
    5: { lvl: 89, base: 8199, queues: 1 }, 6: { lvl: 109, base: 13328, queues: 2 }, 7: { lvl: 129, base: 8856, queues: 2 },
    8: { lvl: 149, base: 12468, queues: 2 }, 9: { lvl: 167, base: 25658, queues: 3 }, 10: { lvl: 185, base: 10284, queues: 3, glour: 1 }
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
  // parentsOnly : réglage « parents seuls » (hypothèse à tester en jeu) ; par défaut parents + grands-parents, comme les guides 2026
  function lineage(m, parentsOnly) {
    var w = new Map(); add(w, m, 8);
    if (!parentsOnly) TREE[m].p.forEach(function (a) { add(w, a, 3); });
    return w;
  }
  /* Répartition des issues d'un accouplement — modèle du simulateur dofuselevage.fr (non officiel) :
     parent ×8, grand-parents ×3 ; chaque couple de la grille donne ses deux couleurs et leur croisement s'il existe ;
     pénalité génération^-0,55 ; la génération cible prend pTarget, le reste se répartit au prorata. */
  var OUT_CACHE = {};
  function outcomes(A, B, LA, LB, opti, s) {
    var po = !!(s && s.parentsOnly);
    var ck = [A, B, LA, LB, opti ? 1 : 0, s && s.optiBonus, s && s.alma, po ? 1 : 0].join('~');
    if (OUT_CACHE[ck]) return OUT_CACHE[ck];
    var fa = lineage(A, po), fb = lineage(B, po), raw = new Map();
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
  function xpPerHour(fam, refillH) { return drain(CAPS[famIdx(fam)], refillH * 60) / refillH; }
  function num(v) { return v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v; }
  // coût (kamas / 1 000 pts) d'une recharge : chaque tranche se remplit avec la famille la moins chère autorisée à y monter
  function refillCostPer1000(fam, refillH, row) {
    var fi = famIdx(fam), cap = CAPS[fi], d = drain(cap, refillH * 60);
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
  function levelHours(from, to, s) { return xpBetween(from, to) / xpPerHour(s.xpFam, s.refillH); }
  function levelCost(from, to, s) {   // kamas par monture (la jauge nourrit toutes les montures de l'enclos)
    var c = refillCostPer1000(s.xpFam, s.refillH, s.fuel['Expérience']);
    return c === null ? null : xpBetween(from, to) / 1000 * c / s.perEnclos;
  }
  // une fécondité = 2 phases de 20 000 pts (Endurance + Maturité, puis Amour) ; chaque phase attend la connexion suivante
  function fertHours(s) { var phase = 20000 / RATE[famIdx(s.fertFam)] / 60; return 2 * Math.max(phase, s.refillH); }
  /* Seuils : un carburant remplit la jauge jusqu'à son plafond (Extrait 80 000, Philtre 140 000, Potion 180 000, Élixir 200 000),
     et le débit dépend de la charge, pas du carburant. On combine donc : chaque tranche se remplit avec le carburant le moins cher
     capable de l'atteindre (une tranche basse peut prendre un Philtre ou une Potion s'ils reviennent moins cher). */
  function cheapestFrom(row, k) {
    var best = null;
    for (var f = k; f < 4; f++) { var pr = num(row[f]); if (pr !== null && (best === null || pr < best)) best = pr; }
    return best;
  }
  function fertCost(s) {   // kamas par monture pour une fécondité (3 jauges à 20 000 + sérénité), points consommés dans la tranche de la famille choisie
    var fi = famIdx(s.fertFam), tot = 0;
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
  function optiCost(gen, s) {
    var buy = num(s.optiBuy && s.optiBuy[gen]);
    if (buy !== null) return buy;
    var o = OPTI[Math.max(2, gen)]; if (!o) return null;
    var q = num(s.queuePrice), gl = num(s.glourPrice);
    if (o.queues && q === null) return null;
    if (o.glour && gl === null) return null;
    return o.base + o.queues * (q || 0) + (o.glour ? gl : 0);
  }

  // ---------------------------------------------------------------- plan vers une cible
  function startLevel(m, s) { return TREE[m].gen === 1 ? s.capLevel : 1; }
  /* Production d'une cible en espérance.
     need[X] = nombre de X à réussir. Pour X (parents A, B) : tentatives = need / p, chacune utilise un A et un B.
     Chaque parent utilisé devient stérile. Deux stériles de la MÊME génération donnent un clone fertile : avec U usages
     d'une génération, on récupère environ (U − 1) / 2 clones (un stérile seul ne se clone pas) — prudent pour les petits nombres.
     Un bébé raté de la couleur d'un parent le remplace (récupération). Les générations sont traitées de la plus haute à la plus basse :
     quand on arrive à une génération, tous ses usages sont connus. */
  function cloneCredit(U, s) { return !s.clone || U <= 1 ? 0 : (U - 1) / (2 * U); }
  function plan(target, policy, s) {
    var need = {}; need[target] = s.topNeed || 1;
    var uses = {}, recov = {}, genUses = {}, credit = {};
    var order = NAMES.slice().sort(function (a, b) { return TREE[b].gen - TREE[a].gen || a.localeCompare(b); });
    var nodes = [];
    var kamas = 0, fuelK = 0, levK = 0, optiK = 0, placeH = 0, genetons = 0, optiCount = {}, missing = [];
    var fc = fertCost(s);
    if (fc === null) missing.push('prix des carburants de fécondité (' + s.fertFam + ')');
    function settle(Y) {   // besoin net d'une couleur = usages − clones récupérés − ratés de sa couleur
      if (Y === target) return;
      var g = TREE[Y].gen;
      if (credit[g] === undefined) credit[g] = cloneCredit(genUses[g] || 0, s);
      need[Y] = Math.max(0, (uses[Y] || 0) * (1 - credit[g]) - (s.recup ? (recov[Y] || 0) : 0));
    }
    order.forEach(function (X) {
      settle(X);
      if (!need[X] || TREE[X].gen === 1) return;
      var g = TREE[X].gen, pol = policy[g] || { L: 1, opti: false };
      var A = TREE[X].p[0], B = TREE[X].p[1];
      var rec = recovery(A, B, pol.L, pol.L, pol.opti, s), p = rec.p, att = need[X] / p;
      uses[A] = (uses[A] || 0) + att; uses[B] = (uses[B] || 0) + att;
      genUses[TREE[A].gen] = (genUses[TREE[A].gen] || 0) + att; genUses[TREE[B].gen] = (genUses[TREE[B].gen] || 0) + att;
      recov[A] = (recov[A] || 0) + att * (1 - p) * rec.rA; recov[B] = (recov[B] || 0) + att * (1 - p) * rec.rB;
      var consA = att, consB = att;   // remplacé plus bas, une fois les clones de chaque génération connus
      // XP : un parent sur deux est un clone ; s'il garde son niveau, il n'a plus que sa fécondité à refaire
      var keep = s.cloneKeepsLevel ? 0.5 : 0;
      var lvA = levelCost(startLevel(A, s), pol.L, s), lvB = levelCost(startLevel(B, s), pol.L, s);
      if (lvA === null || lvB === null) { if (missing.indexOf('prix de l’XP (' + s.xpFam + ')') < 0) missing.push('prix de l’XP (' + s.xpFam + ')'); lvA = lvA || 0; lvB = lvB || 0; }
      var levelK = att * (1 - keep) * (lvA + lvB);
      var fert = att * 2 * (fc || 0);
      var oc = 0;
      if (pol.opti) {
        var unit = optiCost(g, s);
        if (unit === null) { if (missing.indexOf('prix de l’Optimakina gén. ' + g) < 0) missing.push('prix de l’Optimakina gén. ' + g); unit = 0; }
        oc = att * unit; optiCount[g] = (optiCount[g] || 0) + att;
      }
      var prepA = prepHours(startLevel(A, s), pol.L, s), prepB = prepHours(startLevel(B, s), pol.L, s), f = fertHours(s);
      var hours = att * ((prepA + prepB) - keep * (prepA - f + prepB - f));
      placeH += hours; levK += levelK; fuelK += fert; optiK += oc;
      genetons += need[X] * (GENETONS[TREE[A].gen] + GENETONS[TREE[B].gen]);
      nodes.push({ name: X, gen: g, A: A, B: B, L: pol.L, opti: !!pol.opti, p: p, rA: rec.rA, rB: rec.rB, need: need[X], att: att,
                   consA: consA, consB: consB, levelK: levelK, fertK: fert, optiK: oc, hours: hours, prepA: prepA, prepB: prepB });
    });
    // consommation nette de chaque parent par nœud (sert à valoriser un parent perdu)
    nodes.forEach(function (n) {
      var r = s.recup;
      n.consA = Math.max(0, n.att * (1 - (credit[TREE[n.A].gen] || 0)) - (r ? n.att * (1 - n.p) * n.rA : 0));
      n.consB = Math.max(0, n.att * (1 - (credit[TREE[n.B].gen] || 0)) - (r ? n.att * (1 - n.p) * n.rB : 0));
    });
    var caps = {}, capTot = 0;
    GEN1.forEach(function (g) { if (need[g]) { caps[g] = need[g]; capTot += need[g]; } });
    var filetK = capTot * (1 + s.capMargin) * (num(s.filet) || 0);
    kamas = fuelK + levK + optiK + filetK;
    // chemin critique : chaque génération attend que ses parents soient prêts (fécondité + XP)
    var crit = {};
    function cp(m) {
      if (crit[m] !== undefined) return crit[m];
      if (TREE[m].gen === 1) return (crit[m] = 0);
      var nd = nodes.filter(function (n) { return n.name === m; })[0];
      var A = TREE[m].p[0], B = TREE[m].p[1];
      var pa = nd ? nd.prepA : prepHours(startLevel(A, s), 1, s), pb = nd ? nd.prepB : prepHours(startLevel(B, s), 1, s);
      return (crit[m] = Math.max(cp(A) + pa, cp(B) + pb));
    }
    var critH = cp(target), places = s.enclos * s.perEnclos;
    /* Ratés en série : en haut de l'arbre tu n'as qu'un ou deux parents ; un raté se rejoue au cycle suivant.
       On suit le chemin critique depuis la cible et, tant que le besoin est inférieur à 2, on ajoute (1/p − 1) cycles. */
    var seqH = 0, m = target;
    while (TREE[m].gen > 1) {
      var nd = nodes.filter(function (x) { return x.name === m; })[0];
      if (!nd) break;
      if (nd.need < 2) seqH += (1 / nd.p - 1) * Math.max(nd.prepA, nd.prepB);
      m = (crit[nd.A] + nd.prepA >= crit[nd.B] + nd.prepB) ? nd.A : nd.B;
    }
    var days = Math.max(critH + seqH, placeH / places) / 24;
    nodes.sort(function (a, b) { return a.gen - b.gen || a.name.localeCompare(b.name); });
    return { target: target, nodes: nodes, need: need, credit: credit, captures: caps, capTot: capTot, capWithMargin: capTot * (1 + s.capMargin),
             kamas: kamas, fuelK: fuelK, levK: levK, optiK: optiK, filetK: filetK, placeH: placeH, critH: critH, seqH: seqH, days: days,
             capDays: placeH / places / 24, bestDays: critH / 24,
             genetons: genetons, optiCount: optiCount, missing: missing, places: places };
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
  function objectiveValue(pl, obj) { return obj === 'kamas' ? pl.kamas : pl.days; }
  function better(a, b, obj) {
    var va = objectiveValue(a, obj), vb = objectiveValue(b, obj);
    if (va < vb - 1e-9) return true;
    if (va > vb + 1e-9) return false;
    return obj === 'kamas' ? a.days < b.days - 1e-9 : a.kamas < b.kamas - 1e-9;
  }
  var LEVELS = [1, 20, 40, 60, 80, 100, 120, 134, 150, 167, 184, 200];
  function gensOf(target) {
    var gens = [];
    (function walk(m) { if (TREE[m].gen > 1 && gens.indexOf(TREE[m].gen) < 0) gens.push(TREE[m].gen); TREE[m].p.forEach(walk); })(target);
    return gens.sort(function (a, b) { return a - b; });
  }
  /* Recherche du meilleur niveau et de l'Optimakina par génération : on part des 24 stratégies uniformes,
     puis on améliore les 3 meilleures génération par génération (descente coordonnée) jusqu'à stabilité. */
  function optimize(target, s, obj, opts) {
    opts = opts || {};
    var gens = gensOf(target), allowOpti = opts.allowOpti !== false;
    var options = [];
    LEVELS.forEach(function (L) { [false, true].forEach(function (o) { if (!o || allowOpti) options.push({ L: L, opti: o }); }); });
    var starts = options.map(function (op) {
      var pol = {}; gens.forEach(function (g) { pol[g] = { L: op.L, opti: op.opti && optiCost(g, s) !== null }; });
      return { pol: pol, pl: plan(target, pol, s) };
    }).sort(function (a, b) { return better(a.pl, b.pl, obj) ? -1 : (better(b.pl, a.pl, obj) ? 1 : 0); }).slice(0, 3);
    var champion = null;
    starts.forEach(function (st) {
      var pol = st.pol, best = st.pl;
      for (var pass = 0; pass < 5; pass++) {
        var changed = false;
        gens.forEach(function (g) {
          options.forEach(function (op) {
            if (op.opti && optiCost(g, s) === null) return;
            var trial = JSON.parse(JSON.stringify(pol)); trial[g] = { L: op.L, opti: op.opti };
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
  function uniformPolicy(target, L, opti) {
    var pol = {};
    (function walk(m) { if (TREE[m].gen > 1) pol[TREE[m].gen] = { L: L, opti: opti }; TREE[m].p.forEach(walk); })(target);
    return pol;
  }

  // ---------------------------------------------------------------- analyse « à quel niveau accoupler ? » (méthode de la vidéo)
  function levelAnalysis(X, s, values, levels, credits) {
    var A = TREE[X].p[0], B = TREE[X].p[1], g = TREE[X].gen;
    var cA = 1 - (credits ? (credits[TREE[A].gen] || 0) : (s.clone ? 0.5 : 0)), cB = 1 - (credits ? (credits[TREE[B].gen] || 0) : (s.clone ? 0.5 : 0));
    var va = values[A] || { kamas: 0, hours: 0 }, vb = values[B] || { kamas: 0, hours: 0 };
    var fc = fertCost(s) || 0, oc = optiCost(g, s), rows = [];
    (levels || LEVELS).forEach(function (L) {
      [false, true].forEach(function (o) {
        var rec = recovery(A, B, L, L, o, s), p = rec.p, att = 1 / p;
        var consA = att * Math.max(0, cA - (s.recup ? (1 - p) * rec.rA : 0)), consB = att * Math.max(0, cB - (s.recup ? (1 - p) * rec.rB : 0));
        var lev = (levelCost(startLevel(A, s), L, s) || 0) + (levelCost(startLevel(B, s), L, s) || 0);
        var keep = s.cloneKeepsLevel ? 0.5 : 0;
        var perAtt = (1 - keep) * lev + 2 * fc + (o ? (oc || 0) : 0);
        var kam = att * perAtt + consA * va.kamas + consB * vb.kamas;
        var prepA = prepHours(startLevel(A, s), L, s), prepB = prepHours(startLevel(B, s), L, s), f = fertHours(s);
        var hours = att * (prepA + prepB - keep * (prepA - f + prepB - f)) + consA * va.hours + consB * vb.hours;
        rows.push({ L: L, opti: o, p: p, att: att, rA: rec.rA, rB: rec.rB, consumed: consA + consB, xpH: levelHours(1, L, s),
                    levK: lev, kamas: kam, placeH: hours, waitH: Math.max(prepA, prepB), seqDays: att * Math.max(prepA, prepB) / 24,
                    optiMissing: o && oc === null });
      });
    });
    var best = function (k, o) {
      var r = rows.filter(function (x) { return x.opti === o && !x.optiMissing; });
      return r.reduce(function (m, x) { return x[k] < m[k] ? x : m; }, r[0]);
    };
    return { X: X, A: A, B: B, gen: g, rows: rows, bestKamas: [best('kamas', false), best('kamas', true)], bestHours: [best('placeH', false), best('placeH', true)] };
  }

  // ---------------------------------------------------------------- dernier croisement (gén. 10)
  function finalCross(X, L, opti, s) {
    var A = TREE[X].p[0], B = TREE[X].p[1], rec = recovery(A, B, L, L, opti, s), p = rec.p, c = s.clone ? 0.5 : 1;
    var o = rec.out, fail = 1 - p, back9 = 0;
    o.items.forEach(function (i) { if (!i.target && i.gen === 9) back9 += i.p; });
    var n9 = (TREE[A].gen === 9 ? 1 : 0) + (TREE[B].gen === 9 ? 1 : 0);
    // gén. 9 consommées par gén. 10 réussie : chaque gén. 9 utilisée vaut 0,5 (clonage) ; un raté gén. 9 en rend une
    var used9 = (1 / p) * Math.max(0, n9 * c - back9);
    var gen = GENETONS[TREE[A].gen] + GENETONS[TREE[B].gen];
    return { X: X, A: A, B: B, p: p, back9: fail > 0 ? back9 / fail : 0, back9abs: back9, used9: used9, genetons: gen,
             genPer9: used9 > 0 ? gen / used9 : Infinity, items: o.items };
  }

  // ---------------------------------------------------------------- rentabilité dans le temps (carburants × durée)
  /* Valeur du résultat : le bébé gén. 10 extrait (10 neurones, net de taxe) + tous les génétons gagnés en chemin et au dernier croisement.
     Pour chaque couple (carburant de l'XP, carburant de fécondité), on cherche la meilleure stratégie et on compare durée, kamas et bénéfice par jour. */
  function resultValue(pl, s) {
    var neur = (num(s.neurone) || 0) * TREE[pl.target].gen * (1 - (num(s.tax) || 0));
    var gen = pl.genetons * (num(s.genetonValue) || 0);
    return { neurones: neur, genetons: gen, total: neur + gen };
  }
  function profitability(target, s, obj) {
    var rows = [];
    FAMILIES.forEach(function (xf) {
      FAMILIES.forEach(function (ff) {
        var t = JSON.parse(JSON.stringify(s)); t.xpFam = xf; t.fertFam = ff;
        var lc = refillCostPer1000(xf, t.refillH, t.fuel['Expérience']), fc = fertCost(t);
        if (lc === null || fc === null) { rows.push({ xpFam: xf, fertFam: ff, missing: true }); return; }
        var r = optimize(target, t, obj), pl = r.plan, v = resultValue(pl, t);
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
  function runeLine(stat, value, b, prices, tax, L) {
    var st = BR.stats[stat], W = (3 * value * st.weight * itemLevelOf(L, b) / 200 + 1) * b.coef / 100;
    var rs = st.runes.slice().sort(function (x, y) { return y[1] - x[1]; }), left = W, kamas = 0, missing = false, got = [];
    rs.forEach(function (r, i) {
      var rw = r[1] * st.weight, n = i === rs.length - 1 ? left / rw : Math.floor(left / rw + 1e-9);
      if (n <= 0) return;
      left -= n * rw;
      var pr = num(prices[r[0]]);
      if (pr === null) missing = true; else kamas += n * pr * (1 - tax);
      got.push({ rune: r[0], n: n, price: pr });
    });
    var base = st.runes[0];
    return { stat: stat, value: value, weight: W, runes: got, kamas: kamas, missing: missing, baseRune: base[0], baseCount: W / (base[1] * st.weight) };
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

  var API = { TREE: TREE, XP: XP, NAMES: NAMES, GEN1: GEN1, GENETONS: GENETONS, FAMILIES: FAMILIES, CAPS: CAPS, RATE: RATE, JAUGES: JAUGES,
              OPTI: OPTI, LEVELS: LEVELS, recipe: recipe, pTarget: pTarget, outcomes: outcomes, recovery: recovery, drain: drain,
              xpPerHour: xpPerHour, refillCostPer1000: refillCostPer1000, xpBetween: xpBetween, levelHours: levelHours, levelCost: levelCost,
              fertHours: fertHours, fertCost: fertCost, cheapestFrom: cheapestFrom, baseDeposit: baseDeposit, depositTotal: depositTotal, prepHours: prepHours, optiCost: optiCost, plan: plan, unitCosts: unitCosts,
              optimize: optimize, uniformPolicy: uniformPolicy, gensOf: gensOf, levelAnalysis: levelAnalysis, finalCross: finalCross, brisage: brisage, resultValue: resultValue, profitability: profitability, BR: BR, statAtLevel: statAtLevel, runeLine: runeLine, brisageDD: brisageDD, bestBrisageLevel: bestBrisageLevel };
  if (typeof module !== 'undefined') module.exports = API; else root.DD = API;
})(this);
