/* Interface de la page : réglages, onglets, tableaux et courbes. Le calcul est dans engine.js. */
(function () {
  'use strict';
  var E = window.DD, KEY = 'dd-elevage-v1';
  var S = load();
  var TAB = (location.hash || '#plan').slice(1);
  var GEN10 = E.NAMES.filter(function (n) { return E.TREE[n].gen === 10; }).sort();
  /* Tiers des barres : une barre monte à 200 000 points en 4 tiers ; plus elle est haute, plus elle se vide vite.
     Chaque carburant ne remplit que jusqu'à son tier : Extrait T1 (80 000), Philtre T2 (140 000), Potion T3 (180 000), Élixir T4 (200 000).
     En interne, le tier reste stocké sous le nom du carburant qui l'atteint (xpFam / fertFam). */
  var TIER_FUEL = ['Extraits', 'Philtres', 'Potions', 'Élixirs'];
  var TIER_CAP = ['80 000', '140 000', '180 000', '200 000'];
  function tierIdx(fam) { return E.FAMILIES.indexOf(fam); }
  function tierOf(fam) { var i = tierIdx(fam); return i < 0 ? esc(fam) : 'T' + (i + 1); }
  function tierLong(fam) { var i = tierIdx(fam); return i < 0 ? esc(fam) : 'T' + (i + 1) + ' (barre jusqu’à ' + TIER_CAP[i] + ', ' + TIER_FUEL[i] + ')'; }
  function tierHow(i) { return i === 0 ? 'Extraits jusqu’à 80 000' : 'Extraits jusqu’à 80 000, puis ' + TIER_FUEL.slice(1, i + 1).map(function (x, j) { return x + ' jusqu’à ' + TIER_CAP[j + 1]; }).join(', puis '); }
  var FAM_HEAD = ['T1 · Extrait', 'T2 · Philtre', 'T3 · Potion', 'T4 · Élixir'];
  // pastilles de couleur des dragodindes (une par couleur de base)
  var COLORS = { 'Amande': '#e6cfa1', 'Dorée': '#e3b22d', 'Rousse': '#c0532b', 'Ébène': '#141414', 'Indigo': '#4b45b8', 'Pourpre': '#a3205a',
                 'Orchidée': '#d97ad4', 'Ivoire': '#f3eedb', 'Turquoise': '#2fc4c0', 'Émeraude': '#2c9e55', 'Prune': '#6d3f9e' };
  function dd(name) {
    return '<span class="dd">' + String(name).split(' et ').map(function (c) { return '<i class="dot" style="background:' + (COLORS[c] || '#888') + '"></i>'; }).join('') + esc(name) + '</span>';
  }
  // clé de cache : tout l'état sauf l'affichage (étapes cochées, mode détaillé, panneau des prix ouvert)
  function skey() { return JSON.stringify(S, function (k, v) { return k === 'done' || k === 'expert' || k === 'pricesOpen' ? undefined : v; }); }

  // ------------------------------------------------------------ état
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    var d = clone(DD_DEFAULTS);
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      // version 1 → 2 : les prix saisis sont gardés ; seul le réglage de brisage des dragodindes (ancien taux de 90 %) repart des valeurs par défaut
      if (saved && saved.version === 1) { delete saved.ddBrise; delete saved.capMargin; saved.version = 2; }
      // version 2 → 3 : taxe HDV 1 % (au lieu de 3 %) si l'ancienne valeur par défaut n'avait pas été changée
      if (saved && saved.version === 2) { if (saved.tax === 0.03) delete saved.tax; if (saved.brisage && saved.brisage.tax === 0.03) delete saved.brisage.tax; saved.version = 3; }
      // version 3 → 4 : prix des runes relevés sur Ombre (vidéo du 12/11) ; seules les anciennes valeurs par défaut sont remplacées, tes saisies restent
      if (saved && saved.version === 3) {
        var OLD = { 'Rune Vi': 135, 'Rune Pa Vi': 442, 'Rune Ra Vi': 1317, 'Rune Ga Pa': 22800, 'Rune Ga Pme': 20000 };
        if (saved.runePrices) Object.keys(saved.runePrices).forEach(function (k) { var v = saved.runePrices[k]; if (v === null || v === '' || v === OLD[k]) delete saved.runePrices[k]; });
        if (saved.brisage && saved.brisage.runePrice === 20000) delete saved.brisage.runePrice;
        saved.version = 4;
      }
      // version 4 → 5 : la valeur du généton se calcule depuis les prix des parchemins ; l'ancien 100 par défaut est retiré, un chiffre saisi reste
      // et les carburants passent à 0 par défaut (tu les fabriques) : une case restée à l'ancien prix relevé repasse à 0, un prix saisi reste
      if (saved && saved.version === 4) {
        if (saved.genetonValue === 100) delete saved.genetonValue;
        if (saved.glourPrice === null) delete saved.glourPrice;
        if (saved.neurone === 23000) delete saved.neurone;
        if (saved.fuel) Object.keys(saved.fuel).forEach(function (j) {
          var ref = DD_DEFAULTS.fuelRef[j], row = saved.fuel[j];
          if (ref && Array.isArray(row)) row.forEach(function (v, i) { if (v === ref[i] && ref[i] !== null) row[i] = 0; });
        });
        if (saved.brisage && saved.brisage.pricePerXp === 0.0125) delete saved.brisage.pricePerXp;
        saved.version = 5;
      }
      // version 5 → 6 : 6 enclos au plus ; le clone repart au niveau 1 ; génétique parents + grands-parents réels ; les ratés se recroisent
      if (saved && saved.version === 5) {
        delete saved.parentsOnly; delete saved.recup; delete saved.cloneKeepsLevel;
        if (saved.enclos > 6) saved.enclos = 6;
        saved.version = 6;
      }
      if (saved && saved.version === d.version) {
        Object.keys(saved).forEach(function (k) {
          if (k === 'fuel' || k === 'brisage' || k === 'optiBuy' || k === 'runePrices' || k === 'scrollPrices' || k === 'ingPrices' || k === 'makina10' || k === 'extract' || k === 'ddBrise' || k === 'sell200' || k === 'calc') d[k] = Object.assign(d[k] || {}, saved[k]); else d[k] = saved[k];
        });
      }
    } catch (e) { /* réglages illisibles : on garde les valeurs par défaut */ }
    // tiers : aucune barre ne monte en T4 pour l'XP et la Maturité (pas d'Élixir) → T3 au plus
    if (d.xpFam === 'Élixir') d.xpFam = 'Potion';
    if (d.fertFam === 'Élixir') d.fertFam = 'Potion';
    if (!d.done || typeof d.done !== 'object') d.done = {};
    if (d.finalL == null) d.finalL = 100;
    if (d.finalOpti == null) d.finalOpti = false;
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage plein ou interdit */ } }
  function eng() {
    var s = clone(S); s.refillH = 24 / S.connexions;
    s.enclos = Math.max(1, Math.min(6, Math.round(+S.enclos || 1)));          // 6 enclos au maximum
    s.perEnclos = Math.max(1, Math.min(10, Math.round(+S.perEnclos || 10)));  // 10 montures par enclos
    return s;
  }
  function setPath(path, value) {
    var parts = path.split('.'), o = S;
    for (var i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value;
  }
  function getPath(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, S); }

  // ------------------------------------------------------------ outils d'affichage
  function f(x, d) {
    if (x === null || x === undefined || x === '' || !isFinite(x)) return '—';
    return (+x).toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: 0 });
  }
  function pct(x, d) { return x == null || !isFinite(x) ? '—' : f(x * 100, d == null ? 0 : d) + ' %'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function h(tag, attrs, html) {
    var a = '';
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) a += ' ' + k + '="' + esc(attrs[k] === true ? '' : attrs[k]) + '"'; });
    return '<' + tag + a + '>' + (html == null ? '' : html) + '</' + tag + '>';
  }
  function table(head, rows, cls) {
    var th = head.map(function (c, i) { return '<th' + (i === 0 || (cls && cls[i] === 'l') ? ' class="l"' : '') + '>' + c + '</th>'; }).join('');
    var tr = rows.map(function (r) {
      var rc = r.cls ? ' class="' + r.cls + '"' : '', cells = r.cells || r;
      return '<tr' + rc + (r.attr || '') + '>' + cells.map(function (c, i) { return '<td' + (i === 0 || (cls && cls[i] === 'l') ? ' class="l"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="tablewrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>';
  }
  function days(x) { return x == null || !isFinite(x) ? '—' : f(x, x < 10 ? 1 : 0) + ' j'; }
  function hours(x) { return x == null || !isFinite(x) ? '—' : (x >= 48 ? f(x / 24, 1) + ' j' : f(x, 1) + ' h'); }
  function card(k, v, s) { return '<div class="card"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; }
  function lvlLabel(p) { return 'niv. ' + p.L + (p.opti ? ' + Optimakina' : ''); }
  function field(label, path, type, opts) {
    opts = opts || {};
    var v = getPath(path), inner;
    if (type === 'select') {
      inner = '<select data-k="' + path + '"' + (opts.num ? ' data-num="1"' : '') + '>' + opts.options.map(function (o) {
        var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') + '</select>';
    } else if (type === 'check') {
      return '<label class="check"><input type="checkbox" data-k="' + path + '"' + (v ? ' checked' : '') + '><span>' + label + (opts.note ? '<br><span class="note">' + opts.note + '</span>' : '') + '</span></label>';
    } else {
      inner = '<input type="number" data-k="' + path + '" data-num="1" step="' + (opts.step || 'any') + '"' + (opts.min != null ? ' min="' + opts.min + '"' : '') +
        (opts.max != null ? ' max="' + opts.max + '"' : '') + ' value="' + (v === null || v === undefined ? '' : esc(v)) + '" placeholder="' + (opts.ph || '') + '">';
    }
    return '<label class="field">' + label + inner + (opts.note ? '<span class="note">' + opts.note + '</span>' : '') + '</label>';
  }

  // ------------------------------------------------------------ calcul (mis en cache par rendu)
  var CACHE = { key: null };
  function compute() {
    var k = skey();
    if (CACHE.key === k) return CACHE.val;
    var s = eng();
    var ao = S.allowOpti !== false;
    var main = E.optimize(S.target, s, S.objective, { allowOpti: ao });
    var other = E.optimize(S.target, s, S.objective === 'jours' ? 'renta' : 'jours', { allowOpti: ao, starts: 1 });
    var pl = main.plan;
    if (S.safety === '90') {   // assez d'essais pour réussir la dernière étape 9 fois sur 10
      var top = pl.nodes.filter(function (n) { return n.name === S.target; })[0];
      var n90 = top.p >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - top.p));
      var s2 = clone(s); s2.topNeed = n90 * top.p;
      pl = E.plan(S.target, main.policy, s2); pl.n90 = n90;
    }
    var uni = [[1, false], [40, false], [40, true], [100, false], [100, true], [167, true], [200, false]].map(function (x) {
      var pol = E.uniformPolicy(S.target, x[0], x[1], 2), sans = [];
      if (x[1]) Object.keys(pol).forEach(function (g) { if (E.optiCost(+g, s) === null) { pol[g].opti = false; sans.push(g); } });
      return { label: 'Tout au niveau ' + x[0] + (x[1] ? ' + Optimakina' : '') + ', ratés recroisés une fois', plan: E.plan(S.target, pol, s), why: sans.length ? 'sans Optimakina gén. ' + sans.join(', ') + ' (prix manquant)' : '' };
    });
    CACHE = { key: k, val: { s: s, main: main, other: other, pl: pl, uni: uni } };
    return CACHE.val;
  }

  // ------------------------------------------------------------ en-tête : réglages globaux
  function renderGlobal() {
    var g = document.getElementById('global');
    // vue simple : la cible, tes enclos et tes connexions ; les tiers et les Optimakinas se choisissent dans « Mon plan »
    var tiers = [0, 1, 2].map(function (i) { return [E.FAMILIES[i], 'T' + (i + 1) + ' · jusqu’à ' + TIER_CAP[i] + ' (' + TIER_FUEL[i] + ')']; });
    g.innerHTML =
      (S.expert ? field('Gén. 10 visée', 'target', 'select', { options: GEN10 }) : '') +
      (S.expert ? field('Je veux', 'objective', 'select', { options: [['jours', 'aller le plus vite (temps)'], ['renta', 'gagner le plus par jour'], ['kamas', 'dépenser le moins']] }) : '') +
      field('Enclos (6 au plus)', 'enclos', 'select', { num: 1, options: [1, 2, 3, 4, 5, 6].map(function (x) { return [x, x + ' (' + x * 10 + ' places · éleveur ' + [1, 40, 80, 120, 160, 200][x - 1] + ')']; }) }) +
      field('Connexions / jour', 'connexions', 'select', { num: 1, options: [1, 2, 3, 4, 6, 8, 12, 24].map(function (x) { return [x, x + ' (toutes les ' + f(24 / x, 1) + ' h)']; }) }) +
      (S.expert ?
        field('Barre XP', 'xpFam', 'select', { options: tiers }) +
        field('Barres Amour · Endurance · Maturité', 'fertFam', 'select', { options: tiers }) +
        field('Niveau des captures', 'capLevel', 'number', { min: 1, max: 200, step: 1 }) +
        field('Optimakinas autorisées', 'allowOpti', 'check') : '');
  }

  // ------------------------------------------------------------ onglets
  var TABS = [['plan', '🗺️ Mon plan'], ['objectif', '🎯 Gén. 10 : ce qu’il te faut'], ['calcul', '🧮 Calculateur par dragodinde'], ['chemin', '🧬 Chemin étape par étape'], ['niveau', '📈 Niveau des parents (temps)'], ['renta', '⏱️ Carburants et temps'],
              ['final', '🎲 Dernier croisement'], ['prix', '💰 Prix et réglages'], ['brisage', '⚒️ Brisage (DD, Muldo, Volkorne)'], ['regles', '📖 Règles et sources']];
  var SIMPLE_TABS = ['plan', 'brisage', 'prix'];   // vue simple ; « Plus de détails » montre les autres
  function visibleTabs() { return S.expert ? TABS : TABS.filter(function (t) { return SIMPLE_TABS.indexOf(t[0]) >= 0; }); }
  function renderTabs() {
    var vis = visibleTabs();
    if (!vis.some(function (t) { return t[0] === TAB; })) TAB = 'plan';
    document.getElementById('tabs').innerHTML = vis.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === TAB) + '">' + t[1] + '</button>';
    }).join('') + '<button type="button" class="more" data-expert="' + (S.expert ? 0 : 1) + '">' +
      (S.expert ? '✨ Vue simple' : '🔧 Plus de détails (' + (TABS.length - SIMPLE_TABS.length) + ' onglets)') + '</button>';
    var cur = document.querySelector('.tabs [aria-selected=true]');
    if (cur && cur.scrollIntoView && window.innerWidth < 700) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  // ------------------------------------------------------------ « Mes prix » : tous les prix, modifiables depuis chaque onglet
  function numInput(path, v, ph) {
    return '<input type="number" step="any" data-k="' + esc(path) + '" data-num="1" value="' + (v === null || v === undefined ? '' : esc(v)) + '" placeholder="' + esc(ph || '?') + '">';
  }
  function pricePanel() {
    var s = eng(), n = 0;
    var gAuto = 'auto : ' + f(E.genetonValue(Object.assign({}, S, { genetonValue: null })));
    var main = [['Neurone de dragodinde', 'neurone'], ['Ambre (extraction Muldo)', 'extract.Muldo'], ['Corne de Volkorne (extraction)', 'extract.Volkorne'], ['Valeur d’un généton (vide = parchemins)', 'genetonValue', gAuto], ['Queue de dragodinde sauvage', 'queuePrice'],
                ['Queue de Glourséleste', 'glourPrice'], ['Filet universel', 'filet'], ['Taxe HDV (0,01 = 1 %)', 'tax']];
    var out = '<details class="prices" id="mes-prix"' + (S.pricesOpen ? ' open' : '') + '><summary>💰 <b>Mes prix</b> <span class="mini">— modifie-les ici depuis n’importe quel onglet : tout se recalcule et reste gardé sur cet appareil</span></summary><div class="prices-in">';
    out += '<div class="pgrid">' + main.map(function (m) { return '<label class="field">' + m[0] + numInput(m[1], getPath(m[1]), m[2]) + '</label>'; }).join('') + '</div>';
    out += '<h4>Parchemins (prix HDV ; coût chez Eugène Éton : 10, 30, 70, 170 génétons)</h4>' + table(['Caractéristique'].concat(E.SCROLLS.map(function (x) { return x[0] + ' (' + x[1] + ')'; })), E.SCROLL_STATS.map(function (st) {
      return [esc(st)].concat(E.SCROLLS.map(function (x, i) { return numInput('scrollPrices.' + st + '.' + i, (S.scrollPrices[st] || [])[i]); }));
    }));
    out += '<h4>Optimakinas (prix d’achat ; vide = coût du craft)</h4><div class="pgrid">' + Object.keys(E.OPTI).map(function (g) {
      var craft = E.optiCraft(+g, S);
      return '<label class="field">Gén. ' + g + numInput('optiBuy.' + g, S.optiBuy[g], craft == null ? 'prix ?' : 'craft ' + f(craft)) + '</label>';
    }).join('') + '</div>';
    out += '<h4>Ingrédients des Makinas (0 = tu le droppes)</h4><div class="pgrid">' + Object.keys(S.ingPrices || {}).map(function (k) {
      return '<label class="field">' + esc(k) + numInput('ingPrices.' + k, S.ingPrices[k]) + '</label>';
    }).join('') + Object.keys(S.makina10 || {}).map(function (sp) {
      return '<label class="field">Ressource Makina gén. 10 ' + esc(sp) + numInput('makina10.' + sp, S.makina10[sp]) + '</label>';
    }).join('') + '</div>';
    out += '<h4>Carburants (kamas pour 1 000 points ; 0 = tu les fabriques, chaque enclos a les siens)</h4>' + table(['Jauge'].concat(FAM_HEAD), E.JAUGES.map(function (j) {
      return [esc(j)].concat(E.FAMILIES.map(function (fm, i) { return numInput('fuel.' + j + '.' + i, S.fuel[j][i]); }));
    }));
    out += '<h4>Runes</h4><div class="pgrid">' + Object.keys(S.runePrices).map(function (k) {
      return '<label class="field">' + esc(k.replace('Rune ', '')) + numInput('runePrices.' + k, S.runePrices[k]) + '</label>';
    }).join('') + '</div>';
    out += '</div></details>';
    return out;
  }
  function render() {
    renderGlobal(); renderTabs();
    var main = document.getElementById('main');
    var fn = { plan: tabPlan, objectif: tabObjectif, calcul: tabCalcul, chemin: tabChemin, niveau: tabNiveau, renta: tabRenta, final: tabFinal, prix: tabPrix, brisage: tabBrisage, regles: tabRegles }[TAB];
    try { main.innerHTML = pricePanel() + fn(); } catch (e) { main.innerHTML = '<div class="box warn">Erreur de calcul : ' + esc(e.message) + '</div>'; console.error(e); }
  }

  // ------------------------------------------------------------ 0. Mon plan : tableaux pour la dragodinde choisie
  /* La solution = la stratégie la PLUS RAPIDE (jours d'élevage + ton temps de capture), avec ou sans Makinas selon ton choix.
     Les tiers de barre et les stratégies « tout au même niveau » sont recalculés à côté pour comparer. */
  var PCACHE = { key: null };
  var FILLKEY = { xpFam: 'xpFill', fertFam: 'fertFill' };
  function planTarget() { var t = S.planTarget; return t && E.TREE[t] && E.TREE[t].gen > 1 ? t : S.target; }
  function planCompute() {
    var k = skey();
    if (PCACHE.key === k) return PCACHE.val;
    var s = eng(), ao = S.allowOpti !== false, X = planTarget();
    var main = E.optimize(X, s, 'jours', { allowOpti: ao });
    var alt = E.optimize(X, s, 'jours', { allowOpti: !ao });
    var tiers = { xpFam: [], fertFam: [] };
    [0, 1, 2].forEach(function (i) {
      ['xpFam', 'fertFam'].forEach(function (key) { var t = clone(s); t[key] = E.FAMILIES[i]; t[FILLKEY[key]] = null; tiers[key].push(E.plan(X, main.policy, t)); });
    });
    var uni = [[1, false, '🎣 Capturer plus : parents niveau 1'], [40, false, 'Parents niveau 40'], [100, false, 'Parents niveau 100'], [200, false, 'Parents niveau 200'],
               [40, true, 'Parents niveau 40 + Makina'], [100, true, 'Parents niveau 100 + Makina'], [167, true, 'Parents niveau 167 + Makina (100 %)']].map(function (u) {
      var pol = E.uniformPolicy(X, u[0], u[1], 2);
      if (u[1]) Object.keys(pol).forEach(function (g) { if (E.optiCost(+g, s) === null) pol[g].opti = false; });
      return { label: u[2], L: u[0], opti: u[1], plan: E.plan(X, pol, s) };
    });
    PCACHE = { key: k, val: { s: s, X: X, main: main, alt: alt, tiers: tiers, uni: uni } };
    return PCACHE.val;
  }
  function optiTotal(pl) { return Object.keys(pl.optiCount).reduce(function (a, g) { return a + pl.optiCount[g]; }, 0); }
  function cnt(x) { return Math.max(1, Math.round(x)); }          // nombre moyen arrondi, au moins 1
  function upto(x) { return Math.max(1, Math.ceil(x - 0.02)); }   // à prévoir
  function startLv(m) { return E.TREE[m].gen === 1 ? Math.max(1, Math.round(+S.capLevel || 1)) : 1; }
  function dayRange(st, en) {   // heures → « 3 → 5 »
    var a = Math.floor(st / 24) + 1, b = Math.max(a, Math.ceil(en / 24));
    return a === b ? 'jour ' + a : a + ' → ' + b;
  }
  function levelsOf(pl) { var ls = []; pl.nodes.forEach(function (n) { if (ls.indexOf(n.L) < 0) ls.push(n.L); }); ls.sort(function (a, b) { return a - b; }); return ls.length > 1 ? ls[0] + ' à ' + ls[ls.length - 1] : String(ls[0] || '—'); }
  function optiGens(pl) { var g = Object.keys(pl.optiCount).map(Number).sort(function (a, b) { return a - b; }); return !g.length ? 'non' : (g.length > 2 ? 'gén. ' + g[0] + ' à ' + g[g.length - 1] : 'gén. ' + g.join(', ')); }
  function tick(id, on) { return '<input type="checkbox" class="tk" data-k="done.' + esc(planTarget()) + '.' + esc(id) + '"' + (on ? ' checked' : '') + ' title="c’est fait">'; }
  // une monture n'entre et ne sort de l'enclos qu'à une connexion : le temps compte en connexions entières
  function slotH(h, s) { return Math.max(1, Math.ceil(h / s.refillH - 1e-9)) * s.refillH; }
  // barre cliquable : clique où tu veux la remplir (0 à 200 000 points, tiers marqués)
  function gauge(famKey, label, max) {
    var key = FILLKEY[famKey], F = E.fillOf(S[famKey], S[key]), t = E.tierOf(F);
    var segs = [[0, 80000, 'T1'], [80000, 140000, 'T2'], [140000, 180000, 'T3'], [180000, 200000, 'T4']].map(function (x) {
      return '<span class="gseg" style="left:' + x[0] / 2000 + '%;width:' + (x[1] - x[0]) / 2000 + '%">' + x[2] + '</span>';
    }).join('');
    return '<div class="grow"><div class="glab">' + label + ' : <b class="gold">' + f(F) + ' points · T' + (t + 1) + '</b> <span class="mini">(' + TIER_FUEL[t] + ')</span></div>' +
      '<div class="gauge2" data-fill="' + famKey + '" data-max="' + max + '" role="slider" aria-valuemin="1000" aria-valuemax="' + max + '" aria-valuenow="' + F + '" title="clique pour remplir la barre jusqu’ici">' +
      '<i class="gfill" style="width:' + F / 2000 + '%"></i>' + segs + (max < 200000 ? '<span class="gno" style="left:' + max / 2000 + '%" title="aucun carburant ne monte jusque-là"></span>' : '') + '</div></div>';
  }
  function tabPlan() {
    var P = planCompute(), s = P.s, X = P.X, pl = P.main.plan, ao = S.allowOpti !== false, top = E.TREE[X].gen;
    var withO = ao ? P.main.plan : P.alt.plan, without = ao ? P.alt.plan : P.main.plan;
    var done = (S.done && S.done[X]) || {};
    var scale = pl.critH > 0 ? Math.max(1, pl.days * 24 / pl.critH) : 1;   // places pleines : le calendrier s'étale
    // choix de la dragodinde : toutes, rangées par génération
    var opts = '';
    for (var g = 2; g <= 10; g++) opts += '<optgroup label="Gén. ' + g + '">' + E.NAMES.filter(function (n) { return E.TREE[n].gen === g; }).sort().map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === X ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</optgroup>';
    var out = '<div class="phead"><h2>🗺️ Mon plan : ' + dd(X) + ' <span class="mini">gén. ' + top + '</span></h2>' +
      '<label class="field">Dragodinde visée<select data-k="planTarget">' + opts + '</select></label></div>';

    // 1. les solutions
    out += h('h3', null, '1. Capturer plus, monter l’XP ou utiliser des Makinas ?');
    var sol = [{ label: '⚡ Solution la plus rapide', pl: withO, opti: 1 }, { label: '🐢 Solution la plus rapide sans Makina', pl: without, opti: 0 }];
    var rowsS = sol.map(function (x) {
      var mine = (x.opti === 1) === ao;
      return { cls: mine ? 'best' : '', attr: ' data-opti="' + x.opti + '" style="cursor:pointer"', cells: ['<b>' + x.label + '</b>' + (mine ? ' <span class="pill g">ton plan</span>' : ' <span class="mini">clique pour l’adopter</span>'),
        levelsOf(x.pl), optiGens(x.pl), f(Math.ceil(x.pl.capTot)), f(Math.ceil(optiTotal(x.pl))), f(x.pl.optiK), '<b>' + days(x.pl.days) + '</b>'] };
    }).concat(P.uni.map(function (u) {
      return [esc(u.label), String(u.L), u.opti ? optiGens(u.plan) : 'non', f(Math.ceil(u.plan.capTot)), f(Math.ceil(optiTotal(u.plan))), f(u.plan.optiK), days(u.plan.days)];
    }));
    out += table(['Stratégie', 'Niveau des parents', 'Makina', 'Captures', 'Makinas', 'Coût des Makinas', 'Durée'], rowsS);
    out += '<p class="note">Durée avec tes ' + pl.places + ' places et ' + S.connexions + ' connexions par jour. Les deux premières lignes choisissent le niveau, la Makina et le recroisement des ratés génération par génération ; les autres mettent tout au même niveau.</p>';

    // 2. dans l'ordre
    out += h('h3', null, '2. Ce qu’il faut faire, dans l’ordre');
    var rowsA = [], nDone = 0, nAll = 0;
    Object.keys(pl.captures).forEach(function (c) {
      var id = 'cap-' + c; nAll++; if (done[id]) nDone++;
      rowsA.push({ cls: done[id] ? 'done' : '', cells: [tick(id, done[id]), '1', dd(c), '<b>' + f(upto(pl.captures[c])) + '</b>', '<span class="mini">capture au filet</span>', '—', 'niv. ' + startLv(c), '—', '—', 'dès le jour 1'] });
    });
    var order = {}; P.main.gens.forEach(function (g, i) { order[g] = i + 2; });
    pl.nodes.forEach(function (n) {
      var id = n.name; nAll++; if (done[id]) nDone++;
      rowsA.push({ cls: done[id] ? 'done' : (n.name === X ? 'sel' : ''), cells: [tick(id, done[id]), String(order[n.gen]), dd(n.name), '<b>' + f(cnt(n.need)) + '</b>',
        dd(n.A) + ' × ' + dd(n.B) + (n.gen === 7 || n.gen === 9 ? ' <span class="pill o">seul couple</span>' : ''),
        f(cnt(n.consA)) + ' + ' + f(cnt(n.consB)), '<b>niv. ' + n.L + '</b>' + (n.opti ? '<br><span class="pill g">+ Makina</span>' : ''),
        '<b>' + pct(n.p) + '</b>' + (n.k > 1 ? '<br><span class="mini">raté recroisé : ' + pct(n.pRe) + '</span>' : ''), f(upto(n.att)), dayRange(n.startH * scale, n.doneH * scale)] });
    });
    out += '<div class="prog"><div class="pbar"><i style="width:' + Math.round(nDone / Math.max(1, nAll) * 100) + '%"></i></div><span><b>' + nDone + ' / ' + nAll + '</b> lignes faites</span></div>';
    out += table(['✓', 'Étape', 'À faire', 'Combien', 'Couple', 'Parents', 'Niveau des parents', 'Chance', 'Accou&shy;plements', 'Jours'], rowsA, ['', '', 'l', '', 'l']);
    out += '<p class="note">Nombres moyens. « Parents » : ceux de l’étape d’avant ; les bébés ratés et les clones (qui repartent au niveau 1) font le reste des accouplements. Coche une ligne finie : c’est gardé sur cet appareil.</p>';

    // 3. les barres : remplissage au clic, et ce que ça donne par jour
    out += h('h3', null, '3. Tes barres et combien de dragodindes tu montes par jour');
    out += '<div class="box barres">' + gauge('xpFam', '🍖 Barre XP (Mangeoire)', 180000) + gauge('fertFam', '💗 Amour · Endurance · Maturité', 180000) +
      '<p class="mini">Clique sur une barre à l’endroit où tu la remplis à chaque connexion. Au-delà de 180 000 : aucun Élixir d’XP ni de Maturité.</p></div>';
    var places = pl.places, xpDay = E.xpPerHour(s.xpFam, s.refillH, s.xpFill) * 24, fH = E.fertHours(s);
    var LVD = [20, 40, 60, 80, 100, 150, 200], planL = pl.nodes.map(function (n) { return n.L; });
    planL.forEach(function (L) { if (LVD.indexOf(L) < 0) LVD.push(L); }); LVD.sort(function (a, b) { return a - b; });
    var rowsP = LVD.map(function (L) {
      var xh = E.levelHours(1, L, s), ph = E.prepHours(1, L, s), mine = planL.indexOf(L) >= 0;
      return { cls: mine ? 'sel' : '', cells: ['<b>' + L + '</b>' + (mine ? ' <span class="pill o">ton plan</span>' : ''), f(E.xpBetween(1, L)), hours(xh), '<b>' + f(places * 24 / slotH(xh, s), 1) + '</b>', hours(ph), '<b>' + f(places * 24 / slotH(ph, s), 1) + '</b>'] };
    });
    rowsP.push(['<b>Fécondité seule</b>', '—', '—', '—', hours(fH), '<b>' + f(places * 24 / slotH(fH, s), 1) + '</b>']);
    out += table(['Niveau visé (depuis le niveau 1)', 'XP par monture', 'Temps d’XP', 'Montées par jour', 'XP + fécondité', 'Prêtes à accoupler par jour'], rowsP);
    out += '<p class="note">Avec tes ' + places + ' places et ' + S.connexions + ' connexions par jour (toutes les ' + f(s.refillH, 1) + ' h) : ta barre XP donne ' + f(xpDay) + ' XP par jour à chaque monture de l’enclos. ' +
      'Une monture ne sort qu’à une connexion : son temps compte en connexions entières. L’XP se fait en partie pendant la fécondité (barre Amour).</p>';
    var tierRows = [['xpFam', 'Barre XP'], ['fertFam', 'Amour · Endurance · Maturité']].map(function (r) {
      var list = P.tiers[r[0]], cur = E.tierOf(E.fillOf(S[r[0]], S[FILLKEY[r[0]]])), d = list.map(function (p) { return p.days; }), min = Math.min.apply(null, d), best = 0;
      while (d[best] > min + 0.05) best++;
      return [esc(r[1])].concat([0, 1, 2].map(function (i) {
        return '<button type="button" class="tierbtn' + (i === cur ? ' cur' : '') + '" data-tier="' + r[0] + '|' + E.FAMILIES[i] + '">' + days(d[i]) + '</button>';
      })).concat(['<b class="gold">T' + (best + 1) + '</b>' + (best ? ' <span class="mini">−' + days(d[0] - d[best]) + '</span>' : '')]);
    });
    out += table(['Durée du plan si la barre est pleine en…', 'T1 · 80 000<br><span class="mini">Extraits</span>', 'T2 · 140 000<br><span class="mini">+ Philtres</span>', 'T3 · 180 000<br><span class="mini">+ Potions</span>', 'Solution'], tierRows);

    // 4. chance selon le niveau (dernier accouplement)
    var last = pl.nodes.filter(function (n) { return n.name === X; })[0], A = last.A, B = last.B;
    out += h('h3', null, '4. Chance de réussite selon le niveau des parents (' + esc(A) + ' × ' + esc(B) + ')');
    var LV = [1, 20, 40, 60, 80, 100, 120, 150, 167, 200];
    if (LV.indexOf(last.L) < 0) { LV.push(last.L); LV.sort(function (a, b) { return a - b; }); }
    var rowsC = LV.map(function (L) {
      var p0 = E.recovery(A, B, L, L, false, s).p, p1 = E.recovery(A, B, L, L, true, s).p;
      return { cls: L === last.L ? 'sel' : '', cells: ['<b>' + L + '</b>' + (L === last.L ? ' <span class="pill o">ton plan</span>' : ''), hours(E.levelHours(1, L, s)), pct(p0), pct(p1), f(1 / p0, 1), f(1 / p1, 1)] };
    });
    out += table(['Niveau des deux parents', 'XP depuis le niveau 1', 'Chance sans Makina', 'Chance avec Makina', 'Accouplements par réussite, sans', 'avec Makina'], rowsC);

    // 5. Makina : coût par dragodinde réussie
    out += h('h3', null, '5. Makina : ce qu’elle coûte par dragodinde réussie');
    var rowsD = P.main.gens.map(function (g) {
      var ns = pl.nodes.filter(function (n) { return n.gen === g; }), n0 = ns[0], L = n0.L, oc = E.optiCost(g, s);
      var p0 = E.recovery(n0.A, n0.B, L, L, false, s).p, p1 = E.recovery(n0.A, n0.B, L, L, true, s).p;
      return [String(g), ns.map(function (n) { return dd(n.name); }).join('<br>'), oc == null ? '<span class="dim">prix ?</span>' : f(oc), 'niv. ' + L, pct(p0), '<b>' + pct(p1) + '</b>',
        f(1 / p1, 2), oc == null ? '—' : '<b>' + f(oc / p1) + '</b>', f(1 / p0 - 1 / p1, 2), n0.opti ? '<span class="pill g">oui</span>' : 'non'];
    });
    out += table(['Gén.', 'Dragodinde', 'Prix d’une Makina', 'Niveau', 'Chance sans', 'Chance avec', 'Makinas par réussite', 'Coût Makina par réussite', 'Accouplements évités par réussite', 'Dans ton plan'], rowsD, ['', 'l']);
    out += '<p class="note">Une Makina par accouplement (+20 % de chance). Prix : ton prix d’achat dans « Mes prix », sinon le coût du craft.</p>';
    return out;
  }

  // ------------------------------------------------------------ 1. objectif
  function capMin() { return S.captureMin == null || S.captureMin === '' ? 5 : +S.captureMin; }
  function capH(pl) { return pl.capWithMargin * capMin() / 60; }
  function perDay(pl) { return (pl.value - pl.kamas) / Math.max(pl.days, 1e-9); }
  var OBJ_LAB = { jours: 'la plus rapide', renta: 'la plus rentable par jour', kamas: 'la moins chère' };
  function stratTable(R) {
    var rows = [];
    function push(label, pl, note, cls) {
      if (!pl) { rows.push([label, '—', '—', '—', '—', '—', '<span class="dim">' + note + '</span>']); return; }
      var optiN = Object.keys(pl.optiCount).reduce(function (a, g) { return a + pl.optiCount[g]; }, 0);
      rows.push({ cls: cls, cells: [label, '<b>' + days(pl.days) + '</b>', f(Math.ceil(pl.capWithMargin)) + ' <span class="mini">(' + hours(capH(pl)) + ')</span>',
        f(Math.ceil(optiN)), f(pl.kamas), f(perDay(pl)), note || ''] });
    }
    push('<b>Recommandée — ' + OBJ_LAB[S.objective] + '</b>', R.main.plan, '', 'best');
    push('Recommandée — ' + (S.objective === 'jours' ? OBJ_LAB.renta : OBJ_LAB.jours), R.other.plan, '');
    R.uni.forEach(function (u) { push(u.label, u.plan, u.why); });
    return table(['Stratégie', 'Durée', 'Captures (ton temps)', 'Optimakinas', 'Kamas dépensés', 'Kamas gagnés / jour', ''], rows, ['l', '', '', '', '', '', 'l']);
  }
  function tabObjectif() {
    var R = compute(), pl = R.pl, pol = R.main.policy;
    var optiN = Object.keys(pl.optiCount).reduce(function (a, g) { return a + pl.optiCount[g]; }, 0);
    var lead = { jours: 'te fait arriver <b>le plus vite</b> (jours d’élevage + ton temps de capture)',
                 renta: 'te rapporte <b>le plus de kamas par jour</b> (neurones et génétons, moins ce que tu dépenses)',
                 kamas: 'te coûte <b>le moins de kamas</b>' }[S.objective] || '';
    var out = h('h2', null, 'Objectif : ta première ' + esc(S.target) + ' (gén. 10)');
    out += '<p class="lead">La stratégie ci-dessous est celle qui ' + lead + ' avec tes réglages. Pour chaque génération, la page cherche le niveau des parents (1 à 200), ' +
      's’il faut une Optimakina, et <b>combien de tours</b> faire en recroisant les bébés ratés et les clones.</p>';
    out += '<div class="cards">' +
      card('Durée estimée', days(pl.days), 'chemin ' + days(pl.critH / 24) + ' · places ' + days(pl.capDays) + ' (' + pl.places + ' places)') +
      card('Captures gén. 1', f(Math.ceil(pl.capWithMargin)), 'ton temps : ' + hours(capH(pl)) + ' à ' + f(capMin()) + ' min la capture') +
      card('Optimakinas', f(Math.ceil(optiN)), optiN ? f(pl.optiK) + ' kamas · gén. ' + Object.keys(pl.optiCount).join(', ') : (S.allowOpti === false ? 'interdites (case en haut de page)' : 'aucune')) +
      card('Kamas gagnés par jour', f(perDay(pl)), 'valeur ' + f(pl.value) + ' (neurones + génétons) − dépenses ' + f(pl.kamas)) +
      card('Génétons gagnés', f(pl.genetons), '≈ ' + f(pl.genetons * E.genetonValue(S)) + ' kamas') + '</div>';
    if (pl.n90) out += '<div class="box">Sûreté 90 % : <b>' + pl.n90 + ' essais</b> prévus pour la dernière étape.</div>';
    if (pl.missing.length) out += '<div class="box warn">⚠ Prix manquants (comptés 0 ou option écartée) : ' + pl.missing.map(esc).join(' · ') + '. Remplis-les dans « Prix et réglages ».</div>';
    var limit = pl.capDays > pl.critH / 24 ? 'Ce qui te limite : <b>tes places d’enclos</b> (' + pl.places + ' places). Un enclos de plus raccourcit le plan.' :
      'Ce qui te limite : <b>le temps de chaque génération</b> (XP, fécondité et tours de recroisement), pas tes enclos.';
    out += '<div class="box ok verdict">' + limit + '</div>';
    var top = pl.nodes.filter(function (n) { return n.name === S.target; })[0];
    if (top && S.reuse !== false) out += '<div class="box">Un <b>bébé raté garde ses deux parents dans son arbre</b> (la génétique compte les parents et les grands-parents). ' +
      'Recroisé avec un parent neuf, il redonne la génération visée presque aussi souvent : ici <b>' + pct(top.pRe) + '</b> au lieu de ' + pct(top.p) + ' pour ' + esc(S.target) + '. ' +
      'Tu n’as donc pas besoin d’une nouvelle ' + esc(E.TREE[top.A].gen >= E.TREE[top.B].gen ? top.A : top.B) + ' après un raté. Chaque <b>tour</b> de recroisement demande moins de parents neufs, mais une préparation de plus (le bébé et le clone repartent du niveau 1).</div>';

    out += h('h3', null, 'Ta stratégie, génération par génération');
    var rows = R.main.gens.map(function (g) {
      var ns = pl.nodes.filter(function (n) { return n.gen === g; });
      var att = ns.reduce(function (a, n) { return a + n.att; }, 0), need = ns.reduce(function (a, n) { return a + n.need; }, 0), fresh = ns.reduce(function (a, n) { return a + n.fresh; }, 0);
      var p = ns.length ? ns.reduce(function (a, n) { return a + n.p * n.att; }, 0) / Math.max(att, 1e-9) : 0;
      return [ 'Gén. ' + g, ns.map(function (n) { return esc(n.name) + (g === 7 || g === 9 ? ' <span class="pill o">croisement imposé</span>' : ''); }).join('<br>'),
        'niv. ' + pol[g].L, pol[g].opti ? '<span class="pill g">oui</span>' : '<span class="pill">non</span>', pct(p), (pol[g].k || 1) + (pol[g].k > 1 ? ' tours' : ' tour'), f(att, 1), f(need, 1), f(fresh, 1) ];
    });
    out += table(['Génération', 'Bébés à faire', 'Parents à monter au', 'Optimakina', 'Chance', 'Recroisement', 'Essais', 'Réussites', 'Parents neufs'], rows, ['l', 'l']);
    out += '<p class="note">« Recroisement » : 1 tour = tous les accouplements en parallèle avec des parents neufs ; 2 tours et plus = les bébés ratés et les clones repassent à l’accouplement (moins de parents neufs, plus de temps). ' +
      '« Parents neufs » : ce que la génération d’avant doit te fournir.</p>';

    out += h('h3', null, 'Ce qu’il te faut');
    var caps = Object.keys(pl.captures).map(function (c) { return [esc(c), f(pl.captures[c], 1), '<b>' + f(Math.ceil(pl.captures[c] * (1 + S.capMargin))) + '</b>']; });
    var optRows = Object.keys(pl.optiCount).map(function (g) {
      var u = E.optiCost(+g, R.s); return ['Optimakina gén. ' + g + ' (craft niv. ' + E.OPTI[g].lvl + ')', f(pl.optiCount[g], 1), '<b>' + f(Math.ceil(pl.optiCount[g])) + '</b>',
        numInput('optiBuy.' + g, S.optiBuy[g], u == null ? 'prix ?' : 'craft ' + f(u))];
    });
    out += '<div class="grid2"><div>' + table(['Capture (gén. 1, filet universel)', 'En moyenne', 'À prévoir'], caps) +
      '<p class="note">Le sexe est tiré au hasard : la marge sert à avoir des couples mâle + femelle (une Animakina choisit le sexe depuis la 3.7).</p></div><div>' +
      (optRows.length ? table(['Makina', 'En moyenne', 'À prévoir', 'Ton prix (vide = craft)'], optRows) : '<div class="box">Aucune Optimakina dans cette stratégie.</div>') + '</div></div>';
    var mid = pl.nodes.filter(function (n) { return n.name !== S.target; }).map(function (n) { return [esc(n.name), n.gen, f(n.need, 2), f(Math.max(1, Math.ceil(n.need)))]; });
    out += '<details><summary class="mini">Les montures intermédiaires à réussir (' + mid.length + ' couleurs)</summary>' + table(['Couleur', 'Gén.', 'En moyenne', 'Au moins'], mid) + '</details>';
    out += fuelBox(R, pl);

    out += h('h3', null, 'Comparer les stratégies');
    out += '<p class="lead">Même cible, mêmes prix. « Tout au niveau 200 » répond à la question du niveau : attendre le 200 donne 90 % de chance, mais coûte des jours d’XP à chaque génération.</p>';
    out += stratTable(R);
    out += '<div style="max-width:320px">' + field('Sûreté sur la dernière étape', 'safety', 'select', { options: [['moyenne', 'en moyenne'], ['90', '9 fois sur 10']] }) + '</div>';
    out += '<p class="note">Durée = le plus long entre (1) le chemin : chaque génération attend ses deux parents (XP + fécondité), puis ses tours de recroisement, et (2) le temps qu’il faut à tes places pour tout préparer. ' +
      '« Kamas gagnés / jour » = (10 neurones de la gén. 10 + génétons gagnés en chemin − kamas dépensés) ÷ durée. Estimation moyenne : la chance peut te faire gagner ou perdre plusieurs jours.</p>';
    return out;
  }

  // ------------------------------------------------------------ calculateur par dragodinde (comme muldo-calculator)
  function tabCalcul() {
    var s = compute().s, C = S.calc;
    var all = E.NAMES.filter(function (n) { return E.TREE[n].gen > 1; });
    if (all.indexOf(C.target) < 0) C.target = S.target;
    var gens = E.gensOf(C.target), adv = C.mode === 'avance';
    var R = E.cascade(C.target, s, { mult: C.mult, def: { L: C.L, opti: C.opti, k: C.k }, perGen: adv ? C.perGen : null });
    var out = h('h2', null, 'Calculateur : ce qu’il te faut pour une dragodinde précise');
    out += '<p class="lead">Comme <a href="https://tt405907.github.io/muldo-calculator/" target="_blank" rel="noopener">muldo-calculator</a>, mais pour les dragodindes : tu choisis la monture, ' +
      'le nombre de <b>lots de captures</b> (un lot = une capture pour chaque gén. 1 de l’arbre), le niveau des parents et l’Optimakina. La page suit tes montures étape par étape : ' +
      'paires, tentatives, bébés attendus. En plus du calculateur Muldo : les <b>ratés recroisés</b> (ils gardent leurs parents dans l’arbre), les tours de clonage et la <b>durée</b>.</p>';
    var opts = [];
    for (var g = 2; g <= 10; g++) {
      opts.push('<optgroup label="Gén. ' + g + '">' + all.filter(function (n) { return E.TREE[n].gen === g; }).sort().map(function (n) {
        return '<option' + (n === C.target ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</optgroup>');
    }
    out += '<div class="form">' +
      '<label class="field">Dragodinde visée<select data-k="calc.target">' + opts.join('') + '</select></label>' +
      field('Lots de captures', 'calc.mult', 'number', { min: 0, step: 1, note: 'multiplicateur, comme muldo-calculator' }) +
      field('Niveau des parents', 'calc.L', 'number', { min: 1, max: 200, step: 1 }) +
      field('Optimakina (+' + f(S.optiBonus) + ' %)', 'calc.opti', 'check') +
      field('Tours de recroisement', 'calc.k', 'select', { num: 1, options: [[1, '1 : chaque paire une fois'], [2, '2 tours'], [3, '3 tours'], [4, '4 tours'], [5, '5 tours'], [8, '8 tours']] }) +
      field('Réglage', 'calc.mode', 'select', { options: [['simple', 'le même pour toutes les générations'], ['avance', 'par génération (avancé)']] }) + '</div>';
    out += '<p class="note">Ratés recroisés : ' + (S.reuse !== false ? 'oui' : 'non') + ' · clonage des stériles : ' + (S.clone ? 'oui' : 'non') + ' (réglables dans « Prix et réglages »). ' +
      'Un tour = une préparation (XP au niveau choisi + fécondité) : les bébés ratés et les clones repartent du niveau 1.</p>';
    var one = R.multFor1;
    out += '<div class="cards">' +
      card(esc(C.target) + ' attendues', f(R.babies, 2), R.babies >= 1 ? 'au moins une : ≈ ' + pct(R.pAtLeastOne) : 'moins d’une en moyenne : augmente les lots') +
      card('Captures', f(R.capTot), f(C.mult) + ' lot' + (C.mult > 1 ? 's' : '') + ' · ton temps ' + hours(R.capTot * capMin() / 60)) +
      card('Durée', hours(R.hours), 'de la capture à la dernière naissance') +
      card('Pour 1 bébé attendu', one == null ? '—' : f(Math.ceil(one * 10) / 10, 1) + (Math.ceil(one * 10) / 10 > 1 ? ' lots' : ' lot'), one == null ? '' : '≈ ' + f(Math.ceil(R.capTot / Math.max(C.mult, 1e-9) * one)) + ' captures') + '</div>';
    var stock = Object.keys(R.captures).map(function (c) {
      var per = R.captures[c] / Math.max(C.mult, 1e-9);
      return [esc(c), f(per), '<b>' + f(R.captures[c]) + '</b>', one == null ? '—' : f(Math.ceil(per * one))];
    });
    out += h('h3', null, 'Captures gén. 1') + table(['Couleur', 'Par lot', 'Pour tes lots', 'Pour 1 bébé attendu'], stock);
    if (adv) {
      out += h('h3', null, 'Réglage par génération');
      out += table(['Génération', 'Niveau', 'Optimakina', 'Tours', 'Chance'], gens.map(function (gg) {
        var pg = (C.perGen && C.perGen[gg]) || {}, L = pg.L == null ? C.L : pg.L, o = pg.opti == null ? C.opti : pg.opti, kk = pg.k == null ? C.k : pg.k;
        return ['Gén. ' + gg, '<input type="number" min="1" max="200" step="1" data-k="calc.perGen.' + gg + '.L" data-num="1" value="' + esc(L) + '">',
          '<input type="checkbox" data-k="calc.perGen.' + gg + '.opti"' + (o ? ' checked' : '') + '>',
          '<input type="number" min="1" max="8" step="1" data-k="calc.perGen.' + gg + '.k" data-num="1" value="' + esc(kk) + '">', pct(E.pTarget(L, L, o, s))];
      }));
    }
    out += h('h3', null, 'Cascade : bébés produits à chaque étape');
    var rows = R.steps.map(function (st) {
      return { cls: st.name === C.target ? 'sel' : '', cells: [ '<b>' + esc(st.name) + '</b>' + (st.groups > 1 ? ' <span class="pill">× ' + st.groups + ' groupes</span>' : ''), st.gen,
        esc(st.A) + ' × ' + esc(st.B), f(st.nA, 2) + ' / ' + f(st.nB, 2), f(st.pairs, 2), 'niv. ' + st.L + (st.opti ? ' + Opti' : ''), pct(st.p), pct(st.pRe), st.k,
        f(st.attempts, 2), '<b>' + f(st.babies, 2) + '</b>', f(st.babies - st.firstRound, 2), hours(st.t) ] };
    });
    out += table(['Bébé', 'Gén.', 'Parents', 'Arrivés (A / B)', 'Paires', 'Niveau', 'Chance', 'Raté recroisé', 'Tours', 'Tentatives', 'Bébés attendus', 'dont ratés recroisés et clones', 'Prêt après'], rows, ['l', '', 'l']);
    out += '<p class="note">Chaque couleur qui revient dans l’arbre est une branche indépendante (« groupes »), comme dans muldo-calculator. Paires = le plus petit des deux côtés : les montures en trop d’un côté sont perdues. ' +
      'Les nombres sont des moyennes : avec moins d’un bébé attendu, tu as de bonnes chances de n’en avoir aucun. Chance d’en avoir au moins un : estimation par la loi de Poisson.</p>';
    return out;
  }

  // ------------------------------------------------------------ 2. chemin
  function treeText(m, prefix, last, seen) {
    var n = E.TREE[m], tag = n.gen === 1 ? ' (capture)' : '';
    var line = prefix + (prefix ? (last ? '└─ ' : '├─ ') : '') + m + '  · gén. ' + n.gen + tag;
    if (!n.p.length) return line + '\n';
    if (seen[m]) return line + '  (voir plus haut)\n';
    seen[m] = true;
    var np = prefix + (prefix ? (last ? '   ' : '│  ') : '');
    return line + '\n' + treeText(n.p[0], np, false, seen) + treeText(n.p[1], np, true, seen);
  }
  function tabChemin() {
    var R = compute(), pl = R.pl;
    var out = h('h2', null, 'Le chemin vers ' + esc(S.target));
    out += '<p class="lead">Chaque ligne est un croisement à faire, de la génération 2 à la 10. ' +
      '<b>Attention aux générations 7 et 9 :</b> une couleur pure ne sort que d’un seul couple précis. Ivoire = Orchidée et Pourpre × Indigo et Pourpre ; Turquoise = Orchidée et Pourpre × Ébène et Orchidée ; ' +
      'Émeraude = Ivoire et Turquoise × Ivoire et Pourpre ; Prune = Ivoire et Turquoise × Turquoise et Orchidée.</p>';
    var rows = pl.nodes.map(function (n) {
      var imposed = [3, 5, 7, 9].indexOf(n.gen) >= 0;
      return { cls: n.name === S.target ? 'sel' : '', cells: [ '<b>' + esc(n.name) + '</b>' + (imposed ? ' <span class="pill o">couleur pure</span>' : ''), n.gen, esc(n.A) + ' × ' + esc(n.B),
        'niv. ' + n.L, n.opti ? '<span class="pill g">oui</span>' : 'non', pct(n.p), pct(n.pRe), n.k, f(n.att, 2), f(n.need, 2), f(n.fresh, 2), hours(Math.max(n.prepA, n.prepB)) ] };
    });
    out += table(['Bébé', 'Gén.', 'Parents', 'Niveau', 'Optimakina', 'Chance', 'Raté recroisé', 'Tours', 'Essais', 'Réussites', 'Parents neufs', 'Préparation'], rows, ['l', '', 'l']);
    out += '<p class="note">« Raté recroisé » : chance d’avoir le bébé visé quand un bébé raté de cette étape (il a les deux parents dans son arbre) est recroisé avec un parent neuf. ' +
      '« Tours » : combien de fois les ratés et les clones repassent à l’accouplement (1 = tout en parallèle avec des parents neufs). « Parents neufs » : ce que l’étape d’avant doit fournir. ' +
      '« Préparation » : XP + fécondité du parent le plus long à préparer.</p>';
    out += h('h3', null, 'L’arbre complet');
    out += '<div class="tree">' + esc(treeText(S.target, '', true, {})) + '</div>';
    return out;
  }

  // ------------------------------------------------------------ 3. niveau des parents (méthode de la vidéo)
  function lineChart(series, opt) {
    var W = 760, H = 300, L = 54, Rr = 54, T = 16, B = 34, xs = opt.xs, xmin = xs[0], xmax = xs[xs.length - 1];
    var X = function (x) { return L + (x - xmin) / (xmax - xmin) * (W - L - Rr); };
    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.title || 'courbe') + '">';
    var axes = {};
    series.forEach(function (s) {
      var ax = s.axis || 'l'; var v = s.ys.filter(function (y) { return y != null && isFinite(y); });
      if (!axes[ax]) axes[ax] = { min: Infinity, max: -Infinity };
      v.forEach(function (y) { axes[ax].min = Math.min(axes[ax].min, y); axes[ax].max = Math.max(axes[ax].max, y); });
    });
    Object.keys(axes).forEach(function (k) { var a = axes[k]; if (k === 'r' && opt.rmax) { a.min = 0; a.max = opt.rmax; } else { a.min = Math.min(0, a.min); if (a.max <= a.min) a.max = a.min + 1; } });
    var Y = function (y, ax) { var a = axes[ax || 'l']; return H - B - (y - a.min) / (a.max - a.min) * (H - T - B); };
    for (var i = 0; i <= 4; i++) {
      var yy = T + i * (H - T - B) / 4;
      out += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yy + '" y2="' + yy + '" stroke="#2e3646"/>';
      if (axes.l) { var vl = axes.l.max - i * (axes.l.max - axes.l.min) / 4; out += '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" fill="#9aa3b5" font-size="11" text-anchor="end">' + f(vl) + '</text>'; }
      if (axes.r) { var vr = axes.r.max - i * (axes.r.max - axes.r.min) / 4; out += '<text x="' + (W - Rr + 6) + '" y="' + (yy + 4) + '" fill="#9aa3b5" font-size="11">' + (opt.rfmt ? opt.rfmt(vr) : f(vr)) + '</text>'; }
    }
    opt.xticks.forEach(function (x) { out += '<text x="' + X(x) + '" y="' + (H - B + 16) + '" fill="#9aa3b5" font-size="11" text-anchor="middle">' + x + '</text>'; });
    out += '<text x="' + ((L + W - Rr) / 2) + '" y="' + (H - 4) + '" fill="#6c7589" font-size="11" text-anchor="middle">' + esc(opt.xlabel || '') + '</text>';
    series.forEach(function (s) {
      var d = '', pen = false;
      s.ys.forEach(function (y, i) { if (y == null || !isFinite(y)) { pen = false; return; } d += (pen ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(y, s.axis).toFixed(1) + ' '; pen = true; });
      out += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.2"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
      if (s.mark != null) { var i0 = xs.indexOf(s.mark); if (i0 >= 0 && s.ys[i0] != null) out += '<circle cx="' + X(xs[i0]) + '" cy="' + Y(s.ys[i0], s.axis) + '" r="5" fill="' + s.color + '" stroke="#12151c" stroke-width="2"/>'; }
    });
    out += '</svg><div class="legend">' + series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    return out;
  }
  function tabNiveau() {
    var R = compute(), pl = R.pl, s = R.s;
    var names = pl.nodes.map(function (n) { return n.name; }).reverse();
    if (!S.stepX || names.indexOf(S.stepX) < 0) S.stepX = S.target;
    var node = pl.nodes.filter(function (n) { return n.name === S.stepX; })[0], k = node ? node.k : 1;
    var vals = E.unitCosts(pl, s);
    var la = E.levelAnalysis(S.stepX, s, vals, E.LEVELS, k);
    var fine = []; for (var L = 1; L <= 200; L += (L === 1 ? 4 : 5)) fine.push(L);
    if (fine.indexOf(167) < 0) fine.push(167); fine.sort(function (a, b) { return a - b; });
    var lf = E.levelAnalysis(S.stepX, s, vals, fine, k);
    var pick = function (o) { return lf.rows.filter(function (r) { return r.opti === o; }); };
    var bh = lf.bestHours, bk = lf.bestKamas, oc = E.optiCost(lf.gen, s);
    var useO = bh[1] && oc != null && S.allowOpti !== false && bh[1].placeH < bh[0].placeH, bt = useO ? bh[1] : bh[0];
    var out = h('h2', null, 'À quel niveau accoupler ? (en temps)');
    out += '<p class="lead">La courbe d’XP monte <b>très vite au début, puis de moins en moins vite</b> : du niveau 1 au 50 il faut ' + hours(E.levelHours(1, 50, s)) +
      ', du 50 au 100 ' + hours(E.levelHours(50, 100, s)) + ', du 100 au 150 ' + hours(E.levelHours(100, 150, s)) + ', du 150 au 200 ' + hours(E.levelHours(150, 200, s)) +
      ' (barre XP en ' + tierLong(S.xpFam) + ', ' + S.connexions + ' connexions par jour). La chance, elle, monte en ligne droite : <b>+0,3 %</b> par niveau des deux parents. ' +
      'Le bon niveau est celui où une heure d’XP de plus ne rapporte plus assez de chance. Un parent neuf consommé est compté à son temps de production.</p>';
    out += '<label class="field" style="max-width:420px">Étape analysée<select data-k="stepX">' + names.map(function (n) {
      return '<option' + (n === S.stepX ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>';
    out += '<div class="box verdict">Pour <b>' + esc(S.stepX) + '</b> (' + esc(lf.A) + ' × ' + esc(lf.B) + ', ' + k + (k > 1 ? ' tours' : ' tour') + ' de recroisement) :<br>' +
      '• le <b>moins de temps d’enclos par réussite</b> : niv. <b>' + bt.L + (useO ? ' + Optimakina' : '') + '</b> → ' + days(bt.placeH / 24 / pl.places) + ' de tes ' + pl.places + ' places par réussite (' +
      hours(bt.placeH) + ' de place), chance ' + pct(bt.p) + ', préparation ' + hours(bt.waitH) + ' par essai<br>' +
      (useO ? '• sans Optimakina : niv. <b>' + bh[0].L + '</b> → ' + days(bh[0].placeH / 24 / pl.places) + ' par réussite<br>' : '') +
      '• attendre le <b>niveau 200</b> : chance ' + pct(E.pTarget(200, 200, false, s)) + ' sans Optimakina, mais ' + hours(E.levelHours(1, 200, s)) + ' d’XP par parent ; ' +
      'avec une Optimakina, le niveau <b>167</b> suffit pour 100 %<br>' +
      '<span class="note">Le moins cher en kamas : niv. ' + (bk[1] && oc != null && bk[1].kamas < bk[0].kamas ? bk[1].L + ' + Optimakina' : bk[0].L) + '. Pour le calendrier complet (générations en parallèle, tours), regarde l’onglet « Gén. 10 ».</span>' +
      (oc == null ? '<br><span class="warnc">Optimakina gén. ' + lf.gen + ' : prix manquant.</span>' : '') + '</div>';
    out += lineChart([
      { name: 'Heures de place par réussite, sans Optimakina', color: '#7aa7ff', ys: pick(false).map(function (r) { return r.placeH; }), mark: bh[0] && bh[0].L },
      { name: 'Heures de place par réussite, avec Optimakina', color: '#d6aa4f', ys: pick(true).map(function (r) { return r.optiMissing ? null : r.placeH; }), mark: bh[1] && bh[1].L },
      { name: 'Chance sans Optimakina (axe de droite)', color: '#5fcf8f', ys: pick(false).map(function (r) { return r.p; }), axis: 'r', dash: true },
      { name: 'Chance avec Optimakina (axe de droite)', color: '#ef7a6c', ys: pick(true).map(function (r) { return r.p; }), axis: 'r', dash: true }
    ], { xs: fine, xticks: [1, 25, 50, 75, 100, 125, 150, 175, 200], xlabel: 'niveau des deux parents', rmax: 1, rfmt: function (v) { return f(v * 100) + ' %'; }, title: 'temps par réussite selon le niveau' });
    var prev = 1;
    var rows = E.LEVELS.map(function (L) {
      var a = la.rows.filter(function (r) { return r.L === L && !r.opti; })[0], b = la.rows.filter(function (r) { return r.L === L && r.opti; })[0];
      var step = E.levelHours(prev, L, s), from = prev; prev = L;
      var best = L === bt.L;
      return { cls: best ? 'best' : '', cells: [ 'niv. ' + L, f(E.xpBetween(1, L)), hours(a.xpH), L === 1 ? '—' : hours(step) + ' <span class="mini">(' + from + ' → ' + L + ')</span>', pct(a.p), pct(b.p),
        f(a.att, 2) + ' / ' + f(b.att, 2), f(a.consumed, 2), '<b>' + hours(a.placeH) + '</b> / ' + (b.optiMissing ? '—' : '<b>' + hours(b.placeH) + '</b>'), hours(a.waitH),
        f(a.kamas) + ' / ' + (b.optiMissing ? '—' : f(b.kamas)) ] };
    });
    out += table(['Niveau', 'XP par parent', 'Temps d’XP depuis le niv. 1', 'Temps du palier', 'Chance', 'Chance + Opti', 'Essais (sans / Opti)', 'Parents neufs', 'Temps de place / réussite (sans / Opti)', 'Préparation par essai', 'Kamas / réussite (sans / Opti)'], rows);
    out += '<p class="note">« Temps de place / réussite » : heures d’une place d’enclos pour préparer les parents de tous les essais, plus le temps de production des parents neufs consommés. ' +
      'Les deux parents sont montés au même niveau. L’XP de la Mangeoire tourne aussi pendant la phase Amour : les premiers niveaux sont presque gratuits en temps.</p>';
    return out;
  }

  // ------------------------------------------------------------ 4. dernier croisement
  function tabFinal() {
    var R0 = compute(), s = R0.s, L = S.finalL, o = !!S.finalOpti, vals = E.unitCosts(R0.pl, s);
    var list = GEN10.map(function (X) { return E.finalCross(X, L, o, s); }).sort(function (a, b) { return b.genPer9 - a.genPer9 || b.p - a.p; });
    if (!S.finalX || GEN10.indexOf(S.finalX) < 0) S.finalX = S.target;
    var pr = E.finalCross('Prune et Rousse', L, o, s), pe = E.finalCross('Prune et Émeraude', L, o, s);
    var oc = E.optiCost(10, s);
    var out = h('h2', null, 'Le dernier croisement : gén. 9 × gén. 1, ou Prune × Émeraude ?');
    out += '<div class="form" style="max-width:640px">' + field('Niveau des deux parents', 'finalL', 'number', { min: 1, max: 200, step: 1 }) +
      field('Avec une Optimakina gén. 10', 'finalOpti', 'check', { note: oc == null ? 'prix manquant (Queue de Glourséleste)' : f(oc) + ' kamas pièce' }) + '</div>';
    out += '<div class="box verdict">Au niveau ' + L + (o ? ' avec Optimakina' : '') + ', <b>Prune × Rousse</b> donne la gén. 10 à <b>' + pct(pr.p) + '</b>. ' +
      'Si c’est raté, le bébé (le plus souvent une Rousse) <b>garde la Prune dans son arbre</b> : recroisé avec une Rousse neuve, il redonne la gén. 10 à <b>' + pct(pr.pRe) + '</b>. ' +
      'Tu n’as donc pas besoin d’une nouvelle Prune : en recroisant ratés et clones, il faut en moyenne <b>' + f(pr.used9, 2) + ' Prune neuve</b> par gén. 10. ' +
      'Attention aux génétons : ils comptent la génération des <b>deux parents</b>. Avec la Prune : ' + f(pr.genetons) + ' génétons ; avec un raté recroisé : <b>' + f(pr.genRe) + '</b> seulement. ' +
      '<b>Prune × Émeraude</b> : gén. 10 à ' + pct(pe.p) + ', ' + f(pe.genetons) + ' génétons quand les deux gén. 9 sont neuves.</div>';
    function otherCost(c) {
      var other = E.TREE[c.A].gen === 9 && E.TREE[c.B].gen === 9 ? null : (E.TREE[c.A].gen === 9 ? c.B : c.A);
      if (!other) return '<span class="dim">deux gén. 9</span>';
      var v = vals[other]; return v ? 'gén. ' + E.TREE[other].gen + ' · ' + days(v.hours / 24 / R0.pl.places) + ' de places' : 'gén. ' + E.TREE[other].gen + ' · <span class="dim">hors de ton chemin</span>';
    }
    var rows = list.map(function (c) {
      return { cls: c.X === S.finalX ? 'sel' : '', attr: ' data-final="' + esc(c.X) + '" style="cursor:pointer"', cells: [esc(c.X), esc(c.A) + ' × ' + esc(c.B), pct(c.p), pct(c.pRe),
        f(c.genetons), f(c.genRe), f(c.used9, 2), '<b>' + f(c.genPer9) + '</b>', otherCost(c)] };
    });
    out += table(['Bébé gén. 10', 'Parents', 'Chance gén. 10', 'Raté recroisé → gén. 10', 'Génétons (parents neufs)', 'Génétons (raté recroisé)', 'Gén. 9 neuves par réussite', 'Génétons par gén. 9 neuve', 'Autre parent : temps de production'], rows, ['l', 'l']);
    out += '<p class="note">« Gén. 9 neuves par réussite » : en recroisant ratés et clones jusqu’au bout (un raté garde la gén. 9 dans son arbre ; deux stériles de même génération se clonent). ' +
      'Un gén. 7 ou 8 comme autre parent rapporte plus de génétons, mais demande bien plus de temps à produire qu’une gén. 1 (dernière colonne). Clique une ligne pour voir toutes les issues.</p>';
    var sel = E.finalCross(S.finalX, L, o, s), mx = sel.items[0].p;
    out += h('h3', null, 'Toutes les issues de ' + esc(sel.A) + ' × ' + esc(sel.B));
    out += '<div class="bars">' + sel.items.slice(0, 14).map(function (i) {
      return '<div><span>' + esc(i.name) + ' <span class="dim">gén. ' + i.gen + '</span></span><span class="b' + (i.target ? ' t' : '') + '" style="width:' + Math.max(1, i.p / mx * 100) + '%"></span><span>' + pct(i.p, 1) + '</span></div>';
    }).join('') + '</div><p class="note">Modèle de répartition de dofuselevage.fr (non officiel) : parents ×8, grands-parents ×3, les hautes générations sortent moins souvent.</p>';
    return out;
  }

  // ------------------------------------------------------------ rentabilité dans le temps
  var RCACHE = { key: null };
  function tabRenta() {
    var R = compute(), s = R.s, k = JSON.stringify(S);
    if (RCACHE.key !== k) RCACHE = { key: k, val: E.profitability(S.target, s, S.objective) };
    var P = RCACHE.val, cur = P.rows.filter(function (r) { return r.xpFam === S.xpFam && r.fertFam === S.fertFam; })[0];
    var out = h('h2', null, 'Rentabilité dans le temps : quel carburant pour ' + esc(S.target) + ' ?');
    out += '<p class="lead">Chaque ligne refait tout le calcul (meilleur niveau et Optimakina à chaque génération) avec un autre carburant pour l’<b>XP</b> et pour l’<b>Amour, l’Endurance et la Maturité</b> (les trois jauges qui rendent féconde). ' +
      'On compare ce que ça <b>coûte</b> (carburants, XP, Makinas, filets), ce que ça <b>rapporte</b> (le bébé gén. 10 extrait : 10 neurones, plus tous les génétons gagnés) et le <b>temps</b> qu’il faut.</p>';
    var vb = cur && !cur.missing ? E.resultValue(cur.plan, s) : null;
    out += '<div class="cards">' +
      card('Valeur du résultat', vb ? f(vb.total) + ' kamas' : '—', vb ? f(vb.neurones) + ' en neurones + ' + f(vb.genetons) + ' en génétons' : 'prix manquant') +
      card('Le plus rentable par jour', P.bestPerDay ? 'XP ' + tierOf(P.bestPerDay.xpFam) + ' / ' + tierOf(P.bestPerDay.fertFam) : '—', P.bestPerDay ? f(P.bestPerDay.perDay) + ' kamas par jour' : '') +
      card('Le plus rapide', P.fastest ? days(P.fastest.days) : '—', P.fastest ? 'XP ' + tierOf(P.fastest.xpFam) + ' / ' + tierOf(P.fastest.fertFam) + ' · ' + f(P.fastest.kamas) + ' kamas' : '') +
      card('Le moins cher', P.cheapest ? f(P.cheapest.kamas) + ' kamas' : '—', P.cheapest ? 'XP ' + tierOf(P.cheapest.xpFam) + ' / ' + tierOf(P.cheapest.fertFam) + ' · ' + days(P.cheapest.days) : '') + '</div>';
    if (P.fastest && P.cheapest && P.fastest !== P.cheapest) {
      var dd = P.cheapest.days - P.fastest.days, dk = P.fastest.kamas - P.cheapest.kamas;
      out += '<div class="box verdict">Aller le plus vite te fait gagner <b>' + days(dd) + '</b> pour <b>' + f(dk) + ' kamas</b> de plus, soit <b>' + f(dd > 0 ? dk / dd : null) + ' kamas par jour gagné</b>. ' +
        'Si une journée d’élevage te rapporte plus que ça, la vitesse vaut le coup.</div>';
    }
    out += '<div class="box">La valeur d’un généton (' + f(E.genetonValue(S)) + ' kamas' + (S.genetonValue == null ? ', calculée depuis les parchemins' : ', saisie à la main') + ') et le neurone (' + f(S.neurone) + ' kamas) se changent dans « Prix et réglages ». ' +
      'Les bébés ratés en chemin (gén. 2 à 9) ne sont pas comptés : ils rapportent en plus, à l’extraction.</div>';
    var rows = P.rows.slice().sort(function (a, b) { return (a.missing ? 1 : 0) - (b.missing ? 1 : 0) || (b.perDay || 0) - (a.perDay || 0); }).map(function (r) {
      var lab = 'XP <b>' + tierOf(r.xpFam) + '</b> / ' + tierOf(r.fertFam);
      if (r.missing) return [lab, '—', '—', '—', '—', '—', '—', '—', '<span class="dim">prix de carburant manquant</span>'];
      var mine = r.xpFam === S.xpFam && r.fertFam === S.fertFam;
      var cls = r === P.bestPerDay ? 'best' : (mine ? 'sel' : '');
      return { cls: cls, attr: ' data-fuel="' + esc(r.xpFam) + '|' + esc(r.fertFam) + '" style="cursor:pointer"', cells: [lab + (mine ? ' <span class="pill o">ton réglage</span>' : ''), days(r.days), f(r.fuel), f(r.plan.optiK), f(r.kamas), f(r.value),
        '<b class="' + (r.profit >= 0 ? 'ok' : 'ko') + '">' + f(r.profit) + '</b>', '<b>' + f(r.perDay) + '</b>', r.costPerDay == null ? (r === P.cheapest ? 'référence' : '<span class="dim">pas plus rapide</span>') : f(r.costPerDay)] };
    });
    out += table(['Tier barre XP / Amour · Endurance · Maturité', 'Durée', 'Carburants (Amour · Endurance · Maturité + XP)', 'Makinas', 'Coût total', 'Valeur obtenue', 'Bénéfice', 'Bénéfice par jour', 'Kamas par jour gagné'], rows);
    out += '<p class="note">Clique une ligne pour l’adopter comme réglage (elle passe en haut de page). « Kamas par jour gagné » : ce que coûte chaque jour gagné par rapport à la solution la moins chère. ' +
      'Avec ' + S.connexions + ' connexions par jour, un carburant rapide ne rend féconde plus vite que si la jauge se vide avant ta connexion suivante : monte le nombre de connexions en haut de page pour voir la différence.</p>';
    out += h('h3', null, 'Ce que coûte chaque carburant à crafter');
    var fr = E.JAUGES.map(function (j) {
      return [esc(j)].concat(E.FAMILIES.map(function (fm, i) {
        var pr = S.fuel[j][i], rn = S.fuelRecipe && S.fuelRecipe[j] ? S.fuelRecipe[j][i] : '';
        return numInput('fuel.' + j + '.' + i, pr) + (rn && rn !== '—' ? '<br><span class="mini">' + esc(rn) + '</span>' : '');
      }));
    });
    out += table(['Jauge (kamas pour 1 000 pts)'].concat(FAM_HEAD), fr);
    out += '<p class="note">Recette la moins chère de chaque case, d’après les prix de ses ingrédients (classeur, relevés Ombre sinon Kourial). Tes prix se changent dans « Prix et réglages ».</p>';
    return out;
  }

  // ------------------------------------------------------------ carburants : ce qu'ils coûtent sur ton élevage, par enclos
  /* Chaque enclos a ses propres jauges : ses carburants se posent dans CET enclos et nourrissent ses montures ; la mise de départ
     se pose dans chaque enclos. Le coût affiché vient de tes prix (0 par défaut) ; le repère au prix HDV refait le même plan avec fuelRef. */
  function fuelCosts(R, pl) {
    var nE = Math.max(1, +S.enclos || 1), tot = pl.fuelK + pl.levK, dep = E.depositTotal(R.s);
    var sr = clone(R.s); sr.fuel = clone(S.fuelRef || DD_DEFAULTS.fuelRef); sr.topNeed = pl.need[S.target];
    var pr = E.plan(S.target, R.main.policy, sr);
    return { nE: nE, tot: tot, perEnclos: tot / nE, dep: dep, depPerEnclos: dep === null ? null : dep / nE,
             refTot: pr.fuelK + pr.levK, refDep: E.depositTotal(sr) };
  }
  function fuelBox(R, pl) {
    var c = fuelCosts(R, pl);
    var out = '<div class="box" id="carburants"><b>Carburants : ' + f(c.tot) + ' kamas</b> (Amour · Endurance · Maturité ' + f(pl.fuelK) + ' · XP ' + f(pl.levK) + '), soit <b>' + f(c.perEnclos) + ' par enclos</b> sur tes ' + c.nE + ' enclos.';
    if (c.dep !== null) out += ' Mise de départ : <b>' + f(c.dep) + '</b> (' + f(c.depPerEnclos) + ' par enclos, une seule fois).';
    if (c.tot === 0 && !c.dep) out += '<br><span class="note">Tes prix de carburant sont à 0 (tu les fabriques). Mets un prix dans « Mes prix » : le coût sur ton élevage s’affiche ici. Mets-le pour chaque famille : un carburant laissé à 0 compte gratuit et remplit aussi les tranches basses (un Philtre à 0 remplace un Extrait payant).</span>';
    out += '<br>Au prix HDV relevé (repère du classeur), ces mêmes carburants vaudraient <b>' + f(c.refTot) + ' kamas</b>' +
      (c.refDep !== null ? ' + ' + f(c.refDep) + ' de mise de départ' : '') + ' : c’est ce que tu gagnes en les fabriquant toi-même.';
    out += '<br><b>Makinas :</b> ' + f(pl.optiK) + ' kamas · <b>Filets :</b> ' + f(pl.filetK) + ' kamas.';
    out += '<br><span class="note"><b>Chaque enclos a ses propres jauges</b> : ses carburants se posent dans cet enclos et nourrissent ses ' + S.perEnclos + ' montures, ' +
      'et la mise de départ (le socle sous le seuil de ton carburant) se pose dans chaque enclos ; elle reste dans les jauges. ' +
      'Barre XP en ' + tierLong(S.xpFam) + ', Amour, Endurance et Maturité en ' + tierLong(S.fertFam) + ', ' + S.connexions + ' connexions par jour. ' +
      'Chaque tranche de jauge prend le carburant le moins cher capable de l’atteindre (seuils 80 000 / 140 000 / 180 000 / 200 000).</span></div>';
    return out;
  }
  // ------------------------------------------------------------ Makina gén. 10 par espèce
  /* Même fonctionnement que la dragodinde (indication de l'utilisateur) : 1 ressource propre à l'espèce + 10 Pépites + des ressources droppées.
     Le chemin vers la gén. 10 de la page ne couvre que les dragodindes : ce tableau donne le coût de la Makina gén. 10 des trois espèces. */
  function makina10Section() {
    var pep = 10 * (+((S.ingPrices || {})['Pépite']) || 0), dd = E.optiCraft(10, S);
    var ex = S.extract || {};
    var rows = [['Dragodinde', 'Queue de Glourséleste', f(S.glourPrice), f(pep), dd == null ? '<span class="warnc">prix ?</span>' : '<b>' + f(dd) + '</b>', 'Neurone ' + f(S.neurone)]];
    Object.keys(S.makina10 || {}).forEach(function (sp) {
      var r = S.makina10[sp]; rows.push([esc(sp), 'ressource gén. 10 ' + esc(sp), r == null ? '?' : f(r), f(pep), r == null ? '<span class="warnc">prix ?</span>' : '<b>' + f(+r + pep) + '</b>',
        (sp === 'Muldo' ? 'Ambre ' : 'Corne ') + (ex[sp] == null ? '?' : f(ex[sp]))]);
    });
    return h('h3', null, 'Makina gén. 10 et extraction, par espèce') + table(['Espèce', 'Ressource propre', 'Son prix', '10 Pépites', 'Makina gén. 10', 'Extraction (prix unitaire)'], rows) +
      '<p class="note">Muldo et Volkorne : même recette que la dragodinde d’après toi (ressource propre + 10 Pépites + drops à 0). ' +
      'Les Queues de dragodinde sauvage de la dragodinde sont comptées à ' + f(S.queuePrice) + '. Le chemin vers la gén. 10 de cette page ne traite que les dragodindes.</p>';
  }
  // ------------------------------------------------------------ parchemins : que vaut un généton ?
  function scrollSection() {
    var vals = E.scrollValues(S), best = vals[0], by = {};
    vals.forEach(function (v) { by[v.stat + '|' + v.size] = v; });
    var out = h('h3', null, 'Parchemins : que vaut un généton ?');
    out += table(['Caractéristique'].concat(E.SCROLLS.map(function (x) { return x[0] + '<br><span class="mini">(' + x[1] + ' gén. · +' + x[3] + ' jusqu’à ' + x[2] + ')</span>'; })), E.SCROLL_STATS.map(function (st) {
      return [esc(st)].concat(E.SCROLLS.map(function (x, i) {
        var v = by[st + '|' + i]; if (!v) return '<span class="warnc">prix ?</span>';
        var t = f(v.perGeneton) + ' <span class="mini">(' + f(v.price) + ')</span>';
        return v === best ? '<b class="gold">' + t + '</b>' : t;
      }));
    }));
    out += '<p class="note">Kamas par généton = prix HDV × (1 − taxe) ÷ coût en génétons ; entre parenthèses le prix du parchemin. ' +
      (best ? 'Le meilleur échange : <b>' + esc(best.name) + '</b>, soit <b>' + f(best.perGeneton) + ' kamas</b> par généton. ' : '') +
      'Prix par défaut : moyennes HDV Ombre de tes captures du 12/11/2026 ; ils se changent dans « Mes prix ». ' +
      'Prix moyens : si tu vends beaucoup du même parchemin, le prix baisse ; répartis tes échanges sur les 2 ou 3 meilleurs. ' +
      'Pour toi : Petit, Parchemin et Grand donnent +1 jusqu’à 25, 50 et 75 ; le Puissant +2 jusqu’à 100 (85 génétons le point). ' +
      'Les génétons ne tombent que si le bébé a une génération plus haute que toutes les montures de l’arbre des deux parents ; chaque parent rapporte selon sa génération (2, 4, 8, 16, 30, 60, 120, 240, 500).</p>';
    return out;
  }
  // ------------------------------------------------------------ 5. prix et réglages
  function tabPrix() {
    var s = compute().s;
    var out = h('h2', null, 'Prix et réglages');
    out += '<p class="lead">Les prix viennent du classeur (relevés communautaires Ombre, sinon Kourial). Mets tes prix du jour : tout se recalcule et reste gardé sur cet appareil.</p>';
    out += h('h3', null, 'Carburants : kamas pour 1 000 points (recette la moins chère)');
    var rows = E.JAUGES.map(function (j) { return [esc(j)].concat(E.FAMILIES.map(function (fm, i) { return '<input type="number" step="any" data-k="fuel.' + j + '.' + i + '" data-num="1" value="' + (S.fuel[j][i] == null ? '' : S.fuel[j][i]) + '" placeholder="?">'; })); });
    out += table(['Jauge'].concat(FAM_HEAD), rows);
    out += '<p class="note">0 par défaut : tu fabriques tes carburants. Mets ton prix (achat HDV ou valeur de tes ressources) et le coût sur ton élevage s’affiche dans l’onglet du chemin, par enclos.</p>';
    out += '<details><summary class="mini">Repère : prix HDV relevés dans le classeur (kamas pour 1 000 points)</summary>' + table(['Jauge'].concat(E.FAMILIES), E.JAUGES.map(function (j) { return [esc(j)].concat(E.FAMILIES.map(function (fm, i) { var v = (S.fuelRef || DD_DEFAULTS.fuelRef)[j][i]; return v == null ? '—' : f(v, 1); })); })) + '</details>';
    out += h('h3', null, 'Ce que coûte ton carburant, avec tes connexions');
    var fr = E.FAMILIES.map(function (fm) {
      var t = clone(s); t.xpFam = fm; t.fertFam = fm;
      var c = E.refillCostPer1000(fm, s.refillH, S.fuel['Expérience']), xh = E.xpPerHour(fm, s.refillH);
      return [FAM_HEAD[E.FAMILIES.indexOf(fm)], f(xh), c == null ? '—' : f(c, 1), hours(E.levelHours(1, 100, t)) + ' · ' + f(E.levelCost(1, 100, t)), hours(E.levelHours(1, 167, t)) + ' · ' + f(E.levelCost(1, 167, t)),
              hours(E.levelHours(1, 200, t)) + ' · ' + f(E.levelCost(1, 200, t)), hours(E.fertHours(t)) + ' · ' + f(E.fertCost(t))];
    });
    out += table(['Tier (carburant)', 'XP / heure (moyenne)', 'Kamas / 1 000 XP', 'Niv. 100 : temps · kamas', 'Niv. 167', 'Niv. 200', 'Rendre féconde : temps · kamas'], fr);
    out += '<p class="note">Kamas par monture : une jauge nourrit les ' + S.perEnclos + ' montures de l’enclos. Entre deux connexions la jauge redescend de palier : l’XP moyenne tient compte de ce ralentissement (Élixir à 40 XP / 10 s seulement au-dessus de 180 000).</p>';
    out += h('h3', null, 'Optimakinas de Dragodinde');
    var orow = Object.keys(E.OPTI).map(function (g) {
      var o = E.OPTI[g], c = E.optiCost(+g, s), cr = E.optiCraft(+g, s);
      var rec = Object.keys(o.ing).map(function (k) { return o.ing[k] + ' ' + esc(k); }).concat(o.glour ? ['1 Queue de Glourséleste'] : []).join(', ');
      return ['gén. ' + g, o.lvl, '<span class="mini">' + rec + '</span>', cr == null ? '<span class="warnc">prix ?</span>' : f(cr), o.queues,
              '<input type="number" step="any" data-k="optiBuy.' + g + '" data-num="1" value="' + (S.optiBuy[g] == null ? '' : S.optiBuy[g]) + '" placeholder="achat HDV">', c == null ? '<span class="warnc">prix manquant</span>' : '<b>' + f(c) + '</b>'];
    });
    out += table(['Optimakina', 'Niv. de craft', 'Recette (hors Queues)', 'Craft à tes prix', 'Queues de dragodinde sauvage', 'Ton prix d’achat', 'Coût retenu'], orow);
    out += '<p class="note">Craft à tes prix = ingrédients de « Mes prix » (Pépite ' + f((S.ingPrices || {})['Pépite']) + ', le reste à 0 si tu le droppes) + Queues + Queue de Glourséleste. Les ressources de boss et les Pics se changent dans « Mes prix ».</p>';
    out += makina10Section();
    out += '<div class="form">' +
      field('Queue de dragodinde sauvage (kamas)', 'queuePrice', 'number', { min: 0, note: '0 = tu la farmes pendant tes captures (drop ×3 sur Ombre)' }) +
      field('Queue de Glourséleste (kamas)', 'glourPrice', 'number', { min: 0, ph: 'à relever', note: 'Optimakina gén. 10 de dragodinde ; ton prix : 30 000' }) +
      field('Filet universel (kamas)', 'filet', 'number', { min: 0, note: '10 Bois de Frêne + 10 Fer' }) +
      field('Neurone de dragodinde (kamas)', 'neurone', 'number', { min: 0 }) +
      '<label class="field">Valeur d’un généton (kamas)' + numInput('genetonValue', S.genetonValue, 'auto : ' + f(E.genetonValue(Object.assign({}, S, { genetonValue: null })))) +
        '<span class="note">vide = le parchemin le plus rentable (tableau ci-dessous) ; un chiffre saisi l’emporte</span></label>' +
      field('Taxe HDV', 'tax', 'number', { min: 0, max: 1, step: 0.01 }) + '</div>';
    out += scrollSection();
    out += h('h3', null, 'Règles du calcul');
    out += '<div class="form">' +
      field('Bonus Optimakina (%)', 'optiBonus', 'number', { min: 0, max: 100, note: '20 depuis la 3.7 (dofuspourlesnoobs), 10 avant' }) +
      field('Bonus du jour (%)', 'alma', 'number', { min: 0, max: 100, note: 'Takeza ou Almanax : +20' }) +
      field('Sérénité à corriger par fournée', 'seren', 'number', { min: 0 }) +
      field('Montures par enclos', 'perEnclos', 'number', { min: 1, max: 10, step: 1 }) +
      field('Marge de captures', 'capMargin', 'number', { min: 0, max: 3, step: 0.05, note: '0 = capture sûre à 100 % ; 0,25 si tu veux une marge pour les sexes' }) + '</div><div class="form" style="margin-top:10px">' +
      field('Cloner les stériles (2 stériles de même génération → 1 fertile)', 'clone', 'check', { note: 'le clone repart au niveau 1 (constaté en jeu) et garde l’arbre d’un des deux stériles' }) +
      field('Recroiser les bébés ratés', 'reuse', 'check', { note: 'un raté garde ses deux parents dans son arbre : recroisé, il redonne la génération visée' }) +
      field('Temps par capture (minutes)', 'captureMin', 'number', { min: 0, step: 1, note: 'ton temps de jeu, compté dans « aller le plus vite »' }) + '</div>';
    out += '<p style="margin-top:14px"><button type="button" class="btn" data-reset="1">Remettre les valeurs par défaut</button></p>';
    return out;
  }

  // ------------------------------------------------------------ 6. brisage
  // ------------------------------------------------------------ brisage : la solution, dragodinde par dragodinde
  /* Pour une dragodinde déjà produite (un raté, un surplus) : extraire ses neurones tout de suite, la briser au niveau le plus
     rentable EN TEMPS (kamas en plus par jour de place d'enclos), ou la vendre au niveau 200 à ton prix. */
  function brisageSolution() {
    var s = compute().s, X0 = planTarget();
    var names = E.NAMES.slice().sort(function (a, b) { return E.TREE[a].gen - E.TREE[b].gen || a.localeCompare(b); });
    var rows = names.map(function (X) {
      var r1 = E.brisageDD(X, 1, s), neur = r1.extract, bt = E.bestBrisageTime(X, s), sale = E.saleDD(X, s), top = E.bestBrisageLevel(X, s);
      var opts = [], base = bt ? bt.base : 0;
      opts.push(base > 0 ? { t: 'Briser tout de suite', v: 0 } : { t: E.TREE[X].gen >= 2 ? 'Extraire les neurones' : 'Briser tout de suite', v: 0 });
      if (bt && bt.best && bt.best.perPlaceDay > 0) opts.push({ t: 'Briser au niv. ' + bt.best.L, v: bt.best.perPlaceDay });
      if (sale && sale.perPlaceDay > 0) opts.push({ t: 'Vendre au niv. 200', v: sale.perPlaceDay });
      var win = opts.reduce(function (m, o) { return o.v > m.v ? o : m; });
      var bCell = !bt ? '<span class="dim">prix de rune ?</span>' : (bt.best && bt.best.perPlaceDay > 0 ?
        '<b>niv. ' + bt.best.L + '</b> · ' + f(bt.best.gain + neur) + ' · ' + hours(bt.best.hours) : '<span class="dim">jamais mieux</span>');
      var bDay = bt && bt.best && bt.best.perPlaceDay > 0 ? '<b class="ok">+' + f(bt.best.perPlaceDay) + '</b>' : '—';
      var sCell = numInput('sell200.' + X, (S.sell200 || {})[X], 'ton prix') + (sale ? '<br><span class="mini">' + f(sale.gain + neur) + ' · ' + hours(sale.hours) + ' · ' +
        (sale.perPlaceDay > 0 ? '<b class="ok">+' + f(sale.perPlaceDay) + '</b>' : '<span class="ko">' + f(sale.perPlaceDay) + '</span>') + ' / place / jour</span>' : '');
      return { cls: X === X0 ? 'sel' : '', cells: [dd(X), String(E.TREE[X].gen), neur ? f(neur) : '—', r1.missing ? '<span class="dim">?</span>' : f(r1.kamas - (r1.xp || 0)),
        bCell, bDay, top && top.gain > 0 ? 'niv. ' + top.L + ' · ' + f(top.gain + neur) : '—', sCell, '<b class="gold">' + win.t + '</b>'] };
    });
    var out = h('h2', null, '⚒️ Briser, vendre ou extraire ? La solution pour chaque dragodinde');
    out += table(['Dragodinde', 'Gén.', 'Neurones<br><span class="mini">tout de suite</span>', 'Briser au niv. 1<br><span class="mini">tout de suite</span>',
      'Briser au meilleur niveau<br><span class="mini">niveau · kamas · temps d’XP</span>', 'Kamas en plus<br><span class="mini">par place et par jour</span>',
      'Max de kamas<br><span class="mini">sans compter le temps</span>', 'Vendre au niv. 200<br><span class="mini">ton prix · kamas · temps · par jour</span>', 'Solution'], rows, ['l', '', '', '', 'l', '', '', 'l', 'l']);
    out += '<p class="note">Kamas nets : runes (ou vente, taxe déduite) moins l’XP, carburants à tes prix. « Kamas en plus par place et par jour » : ce que la monture rapporte de plus que le mieux immédiat (neurones ou brisage au niveau 1), ' +
      'divisé par les jours qu’elle occupe une place d’enclos. Le meilleur niveau est celui qui maximise ce chiffre. Laisse vide le prix de vente d’une dragodinde qui ne se vend pas.</p>';
    return out;
  }

  function brisageDDSection() {
    var s = compute().s, b = S.ddBrise, L = Math.max(1, Math.min(200, Math.round(b.L || 100)));
    var out = h('h2', null, 'Dragodindes : briser ou extraire ?');
    out += '<p class="lead">Briser une dragodinde détruit la monture, comme l’extraire. La page compare les deux, pour une monture <b>déjà produite</b> (un raté, un surplus) : ' +
      'runes obtenues selon ses bonus, moins l’XP pour la monter au niveau de brisage, contre ses neurones à l’extraction. ' +
      '<b>Les dragodindes capturées (« sauvages ») n’ont aucun bonus</b> : leur brisage ne donne rien.</p>';
    out += '<div class="form">' + field('Niveau de brisage', 'ddBrise.L', 'number', { min: 1, max: 200, step: 1 }) +
      field('Taux de brisage (%)', 'ddBrise.coef', 'number', { min: 1, max: 4000, note: 'montures : 50 % fixe, ni plus ni moins' }) + '</div>' +
      '<details style="margin:6px 0"><summary class="mini">Réglages avancés du modèle</summary><div class="form" style="margin-top:8px">' +
      field('Niveau de l’objet = niveau de la monture', 'ddBrise.mountLevel', 'check', { note: 'retrouve les mesures de la vidéo aux niveaux 100 et 200' }) +
      field('Bonus comptés à leur maximum', 'ddBrise.jetMax', 'check', { note: 'un muldo sous le niveau 100 donne déjà des runes PM' }) +
      field('Niveau d’objet fixe (si case décochée)', 'ddBrise.itemLevel', 'number', { min: 1, max: 200, step: 1 }) +
      field('Part du bonus au niveau 100 (si case décochée)', 'ddBrise.curve100', 'number', { min: 0, max: 1, step: 0.05 }) + '</div></details>';
    var rows = E.NAMES.map(function (X) { return E.brisageDD(X, L, s); });
    var priced = rows.filter(function (r) { return !r.missing; }).sort(function (a, c) { return c.gain - a.gain; });
    var unpriced = rows.filter(function (r) { return r.missing; }).sort(function (a, c) { return a.breakEven.price - c.breakEven.price; });
    var win = priced.filter(function (r) { return r.gain > 0; }), sure = unpriced.filter(function (r) { return r.gain > 0; });
    out += '<div class="box verdict">Au niveau ' + L + ' : ' + (!priced.length ? '' : 'avec les prix connus, <b>' + win.length + '</b> dragodinde' + (win.length > 1 ? 's' : '') + ' sur ' + priced.length + ' chiffrée' + (priced.length > 1 ? 's' : '') +
      ' rapportent plus brisées qu’extraites' + (win.length ? ' (la meilleure : <b>' + esc(win[0].X) + '</b>, +' + f(win[0].gain) + ' kamas)' : '') + '. ') +
      (sure.length ? '<b>' + sure.length + '</b> ' + (priced.length ? 'autres ' : 'dragodindes ') + 'sont rentables même sans connaître le prix de leur rune principale (surtout les gén. 1 élevées, qui ne donnent aucun neurone). ' : '') +
      (unpriced.length - sure.length > 0 ? (unpriced.length - sure.length) + ' ' + (sure.length ? 'autres ' : 'dragodindes ') + 'attendent le prix d’une rune : la colonne « Rentable si » dit le prix à partir duquel le brisage gagne.' :
        (priced.length && win.length < priced.length ? 'Les autres valent plus extraites : leurs neurones (gén. × ' + f(+S.neurone || 0) + ' kamas) dépassent leurs runes.' : '')) + '</div>';
    function runesTxt(r) {
      return r.lines.map(function (l) {
        var x = l.runes[0], s = f(x.n, x.n < 10 ? 1 : 0) + ' ' + esc(x.rune.replace('Rune ', ''));
        return l.fuse ? s + ' <span class="gold">→ ' + f(l.fuse.n, 1) + ' ' + esc(l.fuse.rune.replace('Rune ', '')) + '</span>' : s;
      }).join(' · ');
    }
    function bonusTxt(r) { return r.lines.map(function (l) { return f(l.value, l.value < 10 ? 1 : 0) + ' ' + esc(l.stat); }).join(', '); }
    var trs = priced.concat(unpriced).map(function (r) {
      var be = r.breakEven, bt = E.bestBrisageTime(r.X, s), sale = E.saleDD(r.X, s);
      var tcell = !bt ? '<span class="dim">prix ?</span>' : (bt.best && bt.best.perPlaceDay > 0 ? 'niv. ' + bt.best.L + ' · <b>+' + f(bt.best.perPlaceDay) + '</b>' : (bt.base > 0 ? 'briser tout de suite' : 'extraire'));
      return { cls: r.gain > 0 ? 'best' : '', cells: ['<b>' + esc(r.X) + '</b>', r.gen, bonusTxt(r), '<span class="mini">' + runesTxt(r) + '</span>',
        r.missing ? '<span class="dim">' + f(r.kamas) + ' + ?</span>' : f(r.kamas), f(r.xp), f(r.extract),
        r.missing ? (r.gain > 0 ? '<b class="ok">≥ ' + f(r.gain) + '</b>' : '—') : '<b class="' + (r.gain >= 0 ? 'ok' : 'ko') + '">' + f(r.gain) + '</b>',
        be ? (be.price <= 0 ? '<span class="ok">déjà rentable</span>' : esc(be.rune) + ' ≥ <b>' + f(be.price) + '</b>') : '—', tcell] };
    });
    out += table(['Dragodinde', 'Gén.', 'Bonus au niveau ' + L, 'Runes obtenues', 'Kamas des runes', 'Coût de l’XP', 'Extraction<br>(neurones)', 'Brisage −<br>extraction', 'Rentable si',
      'En temps : briser au<br><span class="mini">kamas en plus / place / jour</span>'], trs, ['l', '', 'l', 'l']);
    out += '<p class="note"><b>En temps</b> : une monture que tu montes occupe une place d’enclos. « Kamas en plus / place / jour » = ce qu’elle rapporte de plus que le mieux immédiat (l’extraire, ou la briser tout de suite), ' +
      'divisé par les jours d’XP. Les prix de vente au niveau 200 sont à toi : laisse vide les dragodindes qui ne se vendent pas.</p>';
    out += '<p class="note">« Rentable si » : prix de vente de la rune simple (taxe déduite) à partir duquel briser rapporte autant qu’extraire, en comptant 0 pour les autres runes sans prix. ' +
      '<b>Le brisage ne donne que des runes simples.</b> 3 simples fusionnent en 1 Pa, 3 Pa en 1 Ra : la page compte chaque simple au meilleur de son prix, du prix de la Pa ÷ 3 et de la Ra ÷ 9, ' +
      'et la flèche dorée dit quand fusionner (ex. « → 6,7 Ra Vi »). Coût de l’XP : barre en ' + tierLong(S.xpFam) + ', partagé entre les ' + S.perEnclos + ' montures de l’enclos.</p>';
    out += h('h3', null, 'Prix des runes (Ombre) — mets les tiens');
    var rp = Object.keys(S.runePrices).map(function (k) {
      return [esc(k), '<input type="number" step="any" data-k="runePrices.' + k + '" data-num="1" value="' + (S.runePrices[k] == null ? '' : S.runePrices[k]) + '" placeholder="?">'];
    });
    var half = Math.ceil(rp.length / 2);
    out += '<div class="grid2"><div>' + table(['Rune', 'Prix'], rp.slice(0, half)) + '</div><div>' + table(['Rune', 'Prix'], rp.slice(half)) + '</div></div>';
    var fz = Object.keys(E.BR.stats).map(function (st) {
      var o = E.BR.stats[st], bst = E.bestPerSimple(o, S.runePrices);
      return bst ? [esc(st), esc(o.runes[0][0].replace('Rune ', '')), f(bst.per, 1), bst.step === 0 ? 'vendre les simples' : '<span class="gold">fusionner en ' + esc(bst.rune.replace('Rune ', '')) + '</span>'] : null;
    }).filter(Boolean);
    out += h('h3', null, 'Vendre les simples ou fusionner ?') + table(['Caractéristique', 'Rune simple', 'Valeur d’une simple', 'Le mieux'], fz);
    out += '<p class="note">Prix par défaut : hôtel des ventes Ombre relevé le 12/11/2026 sur ta vidéo. Rune Fo, Cha et Age simples n’y sont pas visibles : mets-les si tu les connais. ' +
      'Poids des caractéristiques : DofusDB (Vitalité 0,2 · Initiative 0,1 · Force, Intelligence, Chance, Agilité 1 · Puissance 2 · Prospection 3 · Soins et Critique 10 · Invocation 30 · Portée 51). ' +
      'Bonus maximum : dofuspourlesnoobs (400 Vitalité ; 2 Portée pour la Prune ; 14 % Critique pour l’Émeraude…).</p>';
    return out;
  }
  function tabBrisage() {
    // le prix de la rune visée vient de « Mes prix » (Rune Ga Pme pour le muldo, Rune Ga Pa pour le volkorne)
    var rk = +S.brisage.weight === 100 ? 'Rune Ga Pa' : 'Rune Ga Pme', rpz = S.runePrices[rk];
    var b = Object.assign({}, S.brisage, rpz != null && rpz !== '' ? { runePrice: +rpz } : {});
    var rows = [], fine = [], places = S.enclos * b.perEnclos, cpd = Math.max(1, +b.capturesPerDay || 40);
    for (var L = 1; L <= 200; L++) {
      var r0 = E.brisage(L, b);
      // débit par jour : tes captures, ou ce que tes places d'enclos peuvent monter à ce niveau ; le plus petit des deux
      r0.perDayMounts = r0.hours > 0 ? Math.min(cpd, places * 24 / r0.hours) : cpd;
      r0.perDay = r0.profit * r0.perDayMounts;
      r0.perPlaceDay = r0.hours > 0 ? r0.profit * 24 / r0.hours : null;
      fine.push(r0);
    }
    var best = function (k) { return fine.filter(function (r) { return r[k] != null && isFinite(r[k]); }).reduce(function (m, r) { return r[k] > m[k] ? r : m; }); };
    var bp = best('pct'), bd = best('perDay'), bg = best('profit'), bpp = best('perPlaceDay');
    var out = brisageSolution() + '<details class="detail"><summary>Détail : les runes de chaque dragodinde à un niveau choisi</summary>' + brisageDDSection() + '</details>' +
      '<hr style="border:0;border-top:1px solid var(--line);margin:26px 0">' + h('h2', null, 'Muldo / Volkorne : à quel niveau briser ?');
    out += '<p class="lead">On monte les montures capturées à un niveau, puis on les brise pour des runes Ga PM (muldo) ou Ga PA (volkorne). ' +
      (b.model === 'video' ? 'Formule de la vidéo : runes = (3 × niveau/100 × poids × 60 / 200 + 1) / 100.' :
        'Formule « jeu » : runes = (3 × 1 × poids × niveau / 200 + 1) × <b>50 %</b> / poids. Elle retrouve les deux mesures de la vidéo : <b>0,76</b> rune au niveau 100 (≈ 0,80 mesuré) et <b>1,51</b> au niveau 200 (76 runes pour 50 muldos).') + '</p>';
    out += '<div class="form">' +
      field('Formule', 'brisage.model', 'select', { options: [['jeu', 'jeu : taux 50 %, niveau de la monture'], ['video', 'celle de la vidéo']] }) +
      field('Rune visée', 'brisage.weight', 'select', { num: 1, options: [[90, 'Ga PM (poids 90)'], [100, 'Ga PA (poids 100)']] }) +
      field('Captures par jour', 'brisage.capturesPerDay', 'number', { min: 1, step: 1, note: 'ce que tu captures vraiment (risque de mort sur Ombre)' }) +
      '<label class="field">Prix de la ' + esc(rk) + ' (kamas)' + numInput('runePrices.' + rk, S.runePrices[rk]) + '<span class="note">le même que dans « Mes prix »</span></label>' +
      field('Filet (kamas)', 'brisage.filet', 'number', { min: 0, note: 'vidéo : 1 210' }) +
      field('Kamas par point d’XP', 'brisage.pricePerXp', 'number', { min: 0, step: 0.0001, note: 'classeur (Extrait) 0,0125 · vidéo 0,33' }) +
      field('XP par heure', 'brisage.xpPerHour', 'number', { min: 1, note: 'Extrait : 3 600' }) +
      field('Montures par enclos', 'brisage.perEnclos', 'number', { min: 1, max: 10, step: 1 }) +
      field('Taxe HDV', 'brisage.tax', 'number', { min: 0, max: 1, step: 0.01 }) +
      field('Prix de vente au niveau 200 (ton prix)', 'brisage.sell200', 'number', { min: 0, ph: 'vide = ne se vend pas', note: 'pour comparer avec le brisage' }) + '</div>';
    var lim = places * 24 / Math.max(1, cpd), Lfit = fine.filter(function (r) { return r.hours <= lim; }).pop();
    out += '<div class="box verdict"><b>Ton meilleur niveau : ' + bd.L + '</b> → ' + f(bd.perDay) + ' kamas par jour (' + f(bd.perDayMounts, 1) + ' montures brisées par jour, ' + f(bd.profit) + ' kamas chacune). ' +
      'Avec ' + cpd + ' captures par jour et ' + places + ' places, chaque monture peut rester ' + hours(lim) + ' en enclos : c’est le niveau ' + (Lfit ? Lfit.L : 1) + '. ' +
      'Au-dessus, tes enclos ne suivent plus tes captures ; en dessous, tu brises des montures moins rentables.</div>';
    out += '<div class="box">Les autres repères, à ne pas confondre : meilleur <b>% de bénéfice</b> au niveau <b>' + bp.L + '</b> (' + pct(bp.pct) + ', le meilleur rendement de chaque kama dépensé) · ' +
      'plus gros <b>bénéfice par monture</b> au niveau <b>' + bg.L + '</b> (' + f(bg.profit) + ' kamas). ' +
      'Le « niveau 42-45 » de la vidéo est son meilleur %, avec une XP chère (0,33 kama par point, filet à 1 210) : avec les Extraits du classeur, l’XP coûte 26 fois moins et ce repère monte vers 100.</div>';
    if (b.sell200 != null && b.sell200 !== '') {
      var x200 = fine[199], net = +b.sell200 * (1 - b.tax) - x200.cost - b.filet, ppd = x200.hours > 0 ? net * 24 / x200.hours : null;
      out += '<div class="box">Vendre au <b>niveau 200</b> à ' + f(+b.sell200) + ' : ' + f(net) + ' kamas par monture après ' + hours(x200.hours) + ' d’XP, soit <b>' + f(ppd) + ' kamas par jour de place</b>, ' +
        'contre <b>' + f(bpp.perPlaceDay) + '</b> en brisant au niveau ' + bpp.L + ' (le meilleur par jour de place). ' + (ppd > bpp.perPlaceDay ? '<b class="ok">La vente est plus rentable en temps.</b>' : '<b>Le brisage est plus rentable en temps.</b>') + '</div>';
    }
    var xs = fine.map(function (r) { return r.L; });
    out += lineChart([
      { name: 'Bénéfice par monture (kamas)', color: '#d6aa4f', ys: fine.map(function (r) { return r.profit; }), mark: bg.L },
      { name: '% de bénéfice (axe de droite)', color: '#5fcf8f', ys: fine.map(function (r) { return r.pct; }), axis: 'r', dash: true, mark: bp.L }
    ], { xs: xs, xticks: [1, 25, 50, 75, 100, 125, 150, 175, 200], xlabel: 'niveau au moment du brisage', rfmt: function (v) { return f(v * 100) + ' %'; }, title: 'bénéfice du brisage' });
    var lv = [1, 10, 20, 30, 40, 42, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200];
    if (lv.indexOf(bd.L) < 0) lv.push(bd.L);
    lv.sort(function (x, y) { return x - y; }).forEach(function (L) {
      var r = fine[L - 1], hi = L === bd.L;
      rows.push({ cls: hi ? 'best' : (L === bp.L || L === bg.L ? 'sel' : ''), cells: ['niv. ' + L, f(r.runes, 2), f(r.xp), f(r.cost), '<b>' + f(r.profit) + '</b>', pct(r.pct), hours(r.hours), f(r.perHour), f(r.perPlaceDay), f(r.perDayMounts, 1), '<b>' + f(r.perDay) + '</b>'] });
    });
    out += table(['Niveau', 'Runes', 'XP', 'Coût XP', 'Bénéfice / monture', '% bénéfice', 'Temps d’XP', 'Kamas / heure (vidéo)', 'Kamas / place / jour', 'Montures / jour', 'Kamas / jour'], rows);
    out += '<p class="note">Le coût de l’XP est partagé entre les ' + b.perEnclos + ' montures de l’enclos, le filet compté une fois par monture. Les runes montent en ligne droite avec le niveau, l’XP de plus en plus vite : ' +
      'le bénéfice par monture grimpe jusqu’au 200, mais chaque monture occupe une place plus longtemps. « Kamas / jour » prend le plus petit entre tes captures et ce que tes places peuvent monter.</p>';
    return out;
  }

  // ------------------------------------------------------------ 7. règles
  function tabRegles() {
    var li = function (a) { return '<ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; };
    var out = h('h2', null, 'Règles utilisées, et ce qui reste incertain');
    out += h('h3', null, 'Confirmé par les guides');
    out += li([
      'Niveaux de monture 1 à 200. XP cumulée : 172 668 au niveau 100, 570 057 au 167, 867 582 au 200 : la courbe monte vite au début puis ralentit (du 100 au 200, quatre fois plus d’XP que du 1 au 100).',
      'Génération visée = la plus haute atteignable avec les <b>vrais</b> parents et grands-parents (dofuselevage). Un bébé raté a pour parents le couple qui l’a fait naître : recroisé, il redonne la génération visée.',
      '6 enclos de 10 places au plus, débloqués aux niveaux d’éleveur 1, 40, 80, 120, 160 et 200 (guide de l’éleveur).',
      'Chance de la génération cible = 30 % + 0,15 % × (niveau du parent A + niveau du parent B) ; Optimakina +20 % depuis la 3.7 (+10 % avant) ; Takeza +20 %. Deux parents niveau 167 + Optimakina = 100 % ; deux niveau 200 sans Optimakina = 90 %.',
      'Naissance immédiate, bébé niveau 1 jauges à 0 ; les deux parents deviennent stériles.',
      'Clonage : deux stériles de même génération donnent un fertile, qui garde l’arbre d’un des deux ; il repart au <b>niveau 1</b> (constaté en jeu), jauges à 0 ; la capacité est perdue.',
      'Une monture est féconde quand l’Amour, l’Endurance et la Maturité atteignent 20 000. Il n’y a pas de carburant « fécondité » : Dragofesse (Amour), Foudroyeur (Endurance), Abreuvoir (Maturité), Caresseur et Baffeur (Sérénité + et −), Mangeoire (XP). Deux jauges actives à la fois par enclos ; une jauge nourrit toutes les montures de l’enclos.',
      'Jauges 3.7 : 200 000 points au maximum ; Extrait jusqu’à 80 000, Philtre 140 000, Potion 180 000, Élixir 200 000 ; 10 / 20 / 30 / 40 points toutes les 10 s selon le palier.',
      'Génétons : seulement si le bébé dépasse toutes les générations des deux arbres ; par parent 2, 4, 8, 16, 30, 60, 120, 240, 500 (gén. 1 à 9).',
      'Gén. 7 et 9 : un seul couple possible par couleur (voir « Chemin »).'
    ]);
    out += h('h3', null, 'Hypothèses (à vérifier en jeu)');
    out += li([
      '<b>Issue d’un raté</b> : modèle de répartition de dofuselevage.fr, non officiel (parents ×8, grands-parents ×3, pénalité selon la génération).',
      '<b>Clone</b> : dofuspourlesnoobs et le calculateur Muldo le disent tiré <b>au hasard</b> entre les deux stériles. Pour choisir, clone deux stériles de la même couleur (ou du même sexe).',
      '<b>Tours de recroisement</b> : modèle moyen (à chaque tour la moitié de la réserve s’accouple ; ratés et clones y reviennent au niveau 1). En jeu, la chance et les sexes font varier le résultat.',
      '<b>Ton temps de capture</b> : 5 minutes par capture par défaut (réglable dans « Prix et réglages »), compté dans « aller le plus vite ».',
      '<b>Niveau d’une capture</b> : non documenté (niveau 1 par défaut, réglable en haut).',
      '<b>Durée</b> : estimation moyenne (voir « Gén. 10 ») ; avec 2 connexions par jour, une fécondité prend une journée.',
      '<b>Minuteur</b> : mêmes règles que le <a href="https://dofus-portals.fr/outils/timer-elevage/" target="_blank" rel="noopener">timer d’élevage de dofus-portals</a> (un tic toutes les 10 s, gain de 10 / 20 / 30 / 40 selon la charge restante), avec les paliers doublés de la 3.7. ' +
        'Non compté ici : une capacité (Amoureuse, Endurante, Précoce, Sage) ou la méryde du jour double le gain de sa jauge, jusqu’à ×4, sans vider la charge plus vite — tes durées réelles peuvent donc être plus courtes.',
      '<b>Brisage des montures</b> : taux fixe de 50 % (constaté en jeu), niveau de l’objet = niveau de la monture, bonus à leur maximum ; ce modèle retrouve les mesures de la vidéo (0,76 rune Ga PM au niveau 100, 1,51 au 200). Il ne donne que des <b>runes simples</b> : 3 simples fusionnent en 1 Pa, 3 Pa en 1 Ra.'
    ]);
    out += h('h3', null, 'Sources');
    out += li([
      '<a href="https://www.dofuspourlesnoobs.com/guide-de-l-eleveur.html" target="_blank" rel="noopener">Guide de l’éleveur 2026 — dofuspourlesnoobs</a>',
      '<a href="https://www.dofuspourlesnoobs.com/les-dragodindes.html" target="_blank" rel="noopener">Arbre des dragodindes — dofuspourlesnoobs</a>',
      '<a href="https://dofuselevage.fr/tools/reproduction/dragodinde" target="_blank" rel="noopener">Simulateur de reproduction — dofuselevage.fr</a>',
      '<a href="https://beta.sigilos.fr/guides/guide-elevage-enclos-guilde-dofus" target="_blank" rel="noopener">Élevage 3.7 — sigilos</a>',
      '<a href="https://www.next-stage.fr/2026/04/tuto-elevage-dragodinde-dofus-guide-complet-a-z.html" target="_blank" rel="noopener">Tuto élevage — next-stage</a>',
      '<a href="https://tt405907.github.io/muldo-calculator/" target="_blank" rel="noopener">Calculateur Muldo (Chikkin Sama)</a> — modèle en cascade et table d’XP',
      '<a href="https://www.youtube.com/watch?v=-eOWUAir9j8" target="_blank" rel="noopener">Vidéo : optimiser son brisage de montures (runes PA / PM)</a>',
      'Recettes et niveaux de craft : <a href="https://dofusdb.fr" target="_blank" rel="noopener">DofusDB</a> ; prix : dofus-calculator.fr'
    ]);
    return out;
  }

  // ------------------------------------------------------------ événements
  function onChange(e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-k');
    if (!k) return;
    var v;
    if (t.type === 'checkbox') v = t.checked;
    else if (t.getAttribute('data-num')) v = t.value === '' ? null : +t.value;
    else v = t.value;
    if ((k === 'capLevel' || k === 'finalL' || k === 'calc.L' || /^calc.perGen.d+.L$/.test(k)) && v != null) v = Math.max(1, Math.min(200, Math.round(v)));
    if ((k === 'calc.k' || /^calc.perGen.d+.k$/.test(k)) && v != null) v = Math.max(1, Math.min(8, Math.round(v)));
    if (k === 'calc.mult' && v != null) v = Math.max(0, v);
    if (k === 'enclos' && v != null) v = Math.max(1, Math.min(6, Math.round(v)));
    if (k === 'xpFam') S.xpFill = null;
    if (k === 'fertFam') S.fertFill = null;
    setPath(k, v);
    if (k === 'brisage.weight') S.brisage.rune = v === 100 ? 'PA' : 'PM';
    save(); render();
  }
  document.addEventListener('change', onChange);
  document.addEventListener('toggle', function (e) { if (e.target && e.target.id === 'mes-prix') { S.pricesOpen = e.target.open; save(); } }, true);
  document.addEventListener('click', function (e) {
    var ex = e.target.closest('[data-expert]');
    if (ex) { S.expert = ex.getAttribute('data-expert') === '1'; save(); render(); return; }
    var ti = e.target.closest('[data-tier]');
    if (ti) { var tp = ti.getAttribute('data-tier').split('|'); S[tp[0]] = tp[1]; S[tp[0] === 'xpFam' ? 'xpFill' : 'fertFill'] = null; save(); render(); return; }
    var gz = e.target.closest('[data-fill]');
    if (gz) {   // barre cliquée : remplissage à l'endroit du clic, arrondi à 1 000 points
      var rc = gz.getBoundingClientRect(), fam = gz.getAttribute('data-fill'), mx = +gz.getAttribute('data-max') || 200000;
      var F = Math.max(1000, Math.min(mx, Math.round((e.clientX - rc.left) / rc.width * 200) * 1000));
      S[fam === 'xpFam' ? 'xpFill' : 'fertFill'] = F; S[fam] = E.FAMILIES[E.tierOf(F)]; save(); render(); return;
    }
    var op = e.target.closest('[data-opti]');
    if (op) { S.allowOpti = op.getAttribute('data-opti') === '1'; save(); render(); return; }
    var tb = e.target.closest('[data-tab]');
    if (tb) { TAB = tb.getAttribute('data-tab'); history.replaceState(null, '', '#' + TAB); render(); window.scrollTo(0, 0); return; }
    var fu = e.target.closest('[data-fuel]');
    if (fu) { var pp = fu.getAttribute('data-fuel').split('|'); S.xpFam = pp[0]; S.fertFam = pp[1]; S.xpFill = null; S.fertFill = null; save(); render(); return; }
    var fr = e.target.closest('[data-final]');
    if (fr) { S.finalX = fr.getAttribute('data-final'); save(); render(); return; }
    if (e.target.closest('[data-reset]')) { if (confirm('Remettre tous les prix et réglages par défaut ?')) { localStorage.removeItem(KEY); S = load(); render(); } }
  });
  window.addEventListener('hashchange', function () { TAB = location.hash.slice(1) || 'plan'; render(); });
  document.getElementById('ver').textContent = ' · version du 12/11/2026 (« Mon plan » en tableaux pour toute dragodinde, barres à remplir au clic, brisage : la solution par dragodinde)';
  render();
})();
