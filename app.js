/* Interface de la page : réglages, onglets, tableaux et courbes. Le calcul est dans engine.js. */
(function () {
  'use strict';
  var E = window.DD, KEY = 'dd-elevage-v1';
  var S = load();
  var TAB = (location.hash || '#objectif').slice(1);
  var GEN10 = E.NAMES.filter(function (n) { return E.TREE[n].gen === 10; }).sort();

  // ------------------------------------------------------------ état
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    var d = clone(DD_DEFAULTS);
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && saved.version === d.version) {
        Object.keys(saved).forEach(function (k) {
          if (k === 'fuel' || k === 'brisage' || k === 'optiBuy') d[k] = Object.assign(d[k], saved[k]); else d[k] = saved[k];
        });
      }
    } catch (e) { /* réglages illisibles : on garde les valeurs par défaut */ }
    if (d.finalL == null) d.finalL = 100;
    if (d.finalOpti == null) d.finalOpti = false;
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage plein ou interdit */ } }
  function eng() { var s = clone(S); s.refillH = 24 / S.connexions; return s; }
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
    var k = JSON.stringify(S);
    if (CACHE.key === k) return CACHE.val;
    var s = eng();
    var main = E.optimize(S.target, s, S.objective);
    var other = E.optimize(S.target, s, S.objective === 'jours' ? 'kamas' : 'jours');
    var pl = main.plan;
    if (S.safety === '90') {   // assez d'essais pour réussir la dernière étape 9 fois sur 10
      var top = pl.nodes.filter(function (n) { return n.name === S.target; })[0];
      var n90 = top.p >= 1 ? 1 : Math.ceil(Math.log(0.1) / Math.log(1 - top.p));
      var s2 = clone(s); s2.topNeed = n90 * top.p;
      pl = E.plan(S.target, main.policy, s2); pl.n90 = n90;
    }
    var uni = [[1, false], [40, false], [40, true], [100, false], [100, true], [167, true], [200, false]].map(function (x) {
      var pol = E.uniformPolicy(S.target, x[0], x[1]), sans = [];
      if (x[1]) Object.keys(pol).forEach(function (g) { if (E.optiCost(+g, s) === null) { pol[g].opti = false; sans.push(g); } });
      return { label: 'Tout au niveau ' + x[0] + (x[1] ? ' + Optimakina' : ''), plan: E.plan(S.target, pol, s), why: sans.length ? 'sans Optimakina gén. ' + sans.join(', ') + ' (prix manquant)' : '' };
    });
    CACHE = { key: k, val: { s: s, main: main, other: other, pl: pl, uni: uni } };
    return CACHE.val;
  }

  // ------------------------------------------------------------ en-tête : réglages globaux
  function renderGlobal() {
    var g = document.getElementById('global');
    g.innerHTML =
      field('Gén. 10 visée', 'target', 'select', { options: GEN10 }) +
      field('Je veux', 'objective', 'select', { options: [['jours', 'aller le plus vite'], ['kamas', 'dépenser le moins']] }) +
      field('Enclos', 'enclos', 'select', { num: 1, options: [1, 2, 3, 4, 5, 6, 8, 10, 12].map(function (x) { return [x, x + ' (' + x * 10 + ' places)']; }) }) +
      field('Connexions / jour', 'connexions', 'select', { num: 1, options: [1, 2, 3, 4, 6, 8, 12, 24].map(function (x) { return [x, x + ' (toutes les ' + f(24 / x, 1) + ' h)']; }) }) +
      field('Carburant pour l’XP', 'xpFam', 'select', { options: E.FAMILIES }) +
      field('Carburant fécondité', 'fertFam', 'select', { options: E.FAMILIES }) +
      field('Niveau des captures', 'capLevel', 'number', { min: 1, max: 200, step: 1 });
  }

  // ------------------------------------------------------------ onglets
  var TABS = [['objectif', '🎯 Gén. 10 : ce qu’il te faut'], ['chemin', '🧬 Chemin étape par étape'], ['niveau', '📈 Niveau des parents'],
              ['final', '🎲 Dernier croisement'], ['prix', '💰 Prix et réglages'], ['brisage', '⚒️ Brisage Muldo / Volkorne'], ['regles', '📖 Règles et sources']];
  function renderTabs() {
    if (!TABS.some(function (t) { return t[0] === TAB; })) TAB = 'objectif';
    document.getElementById('tabs').innerHTML = TABS.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === TAB) + '">' + t[1] + '</button>';
    }).join('');
    var cur = document.querySelector('.tabs [aria-selected=true]');
    if (cur && cur.scrollIntoView && window.innerWidth < 700) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function render() {
    renderGlobal(); renderTabs();
    var main = document.getElementById('main');
    var fn = { objectif: tabObjectif, chemin: tabChemin, niveau: tabNiveau, final: tabFinal, prix: tabPrix, brisage: tabBrisage, regles: tabRegles }[TAB];
    try { main.innerHTML = fn(); } catch (e) { main.innerHTML = '<div class="box warn">Erreur de calcul : ' + esc(e.message) + '</div>'; console.error(e); }
  }

  // ------------------------------------------------------------ 1. objectif
  function stratTable(R) {
    var rows = [];
    function push(label, pl, note, cls) {
      if (!pl) { rows.push([label, '—', '—', '—', '—', '<span class="dim">' + note + '</span>']); return; }
      var optiN = Object.keys(pl.optiCount).reduce(function (a, g) { return a + pl.optiCount[g]; }, 0);
      rows.push({ cls: cls, cells: [label, days(pl.days), f(pl.kamas), f(Math.ceil(pl.capWithMargin)), f(Math.ceil(optiN)), note || ''] });
    }
    push('<b>Recommandée — ' + (S.objective === 'jours' ? 'la plus rapide' : 'la moins chère') + '</b>', R.main.plan, '', 'best');
    push('Recommandée — ' + (S.objective === 'jours' ? 'la moins chère' : 'la plus rapide'), R.other.plan, '');
    R.uni.forEach(function (u) { push(u.label, u.plan, u.why); });
    return table(['Stratégie', 'Durée', 'Kamas', 'Captures', 'Optimakinas', ''], rows, ['l', '', '', '', '', 'l']);
  }
  function tabObjectif() {
    var R = compute(), pl = R.pl, pol = R.main.policy;
    var optiN = Object.keys(pl.optiCount).reduce(function (a, g) { return a + pl.optiCount[g]; }, 0);
    var out = h('h2', null, 'Objectif : ta première ' + esc(S.target) + ' (gén. 10)');
    out += '<p class="lead">La stratégie ci-dessous est celle qui ' + (S.objective === 'jours' ? 'te fait arriver <b>le plus vite</b>' : 'te coûte <b>le moins de kamas</b>') +
      ' avec tes réglages. La page cherche pour chaque génération le niveau des parents (1 à 200) et s’il faut une Optimakina.</p>';
    out += '<div class="cards">' +
      card('Durée estimée', days(pl.days), 'au mieux ' + days(pl.bestDays) + ' si tout réussit du premier coup') +
      card('Captures gén. 1', f(Math.ceil(pl.capWithMargin)), 'dont ' + Math.round(S.capMargin * 100) + ' % de marge (sexes, hasard)') +
      card('Optimakinas', f(Math.ceil(optiN)), Object.keys(pl.optiCount).length ? 'gén. ' + Object.keys(pl.optiCount).join(', ') : 'aucune') +
      card('Budget', f(pl.kamas) + ' kamas', 'carburant, XP, Makinas, filets') +
      card('Génétons en chemin', f(pl.genetons), 'en plus de la gén. 10 (~' + f(pl.genetons * (S.genetonValue || 0)) + ' kamas)') + '</div>';
    if (pl.n90) out += '<div class="box">Sûreté 90 % : <b>' + pl.n90 + ' essais</b> prévus pour la dernière étape.</div>';
    if (pl.missing.length) out += '<div class="box warn">⚠ Prix manquants (comptés 0 ou option écartée) : ' + pl.missing.map(esc).join(' · ') + '. Remplis-les dans « Prix et réglages ».</div>';
    var limit = pl.capDays > pl.bestDays + pl.seqH / 24 ? 'Ce qui te limite : <b>le nombre de places d’enclos</b> (' + pl.places + ' places). Un enclos de plus raccourcit le plan.' :
      'Ce qui te limite : <b>le temps de chaque génération</b> (fécondité' + (pl.seqH > 1 ? ' + ratés à rejouer en haut de l’arbre' : '') + '), pas tes enclos.';
    out += '<div class="box ok verdict">' + limit + '</div>';

    out += h('h3', null, 'Ta stratégie, génération par génération');
    var rows = R.main.gens.map(function (g) {
      var ns = pl.nodes.filter(function (n) { return n.gen === g; });
      var att = ns.reduce(function (a, n) { return a + n.att; }, 0), need = ns.reduce(function (a, n) { return a + n.need; }, 0);
      var p = ns.length ? ns.reduce(function (a, n) { return a + n.p * n.att; }, 0) / Math.max(att, 1e-9) : 0;
      return [ 'Gén. ' + g, ns.map(function (n) { return esc(n.name) + (g === 7 || g === 9 ? ' <span class="pill o">croisement imposé</span>' : ''); }).join('<br>'),
        'niv. ' + pol[g].L, pol[g].opti ? '<span class="pill g">oui</span>' : '<span class="pill">non</span>', pct(p), f(att, 1), f(need, 1) ];
    });
    out += table(['Génération', 'Bébés à faire', 'Parents à monter au', 'Optimakina', 'Chance', 'Essais', 'Réussites'], rows, ['l', 'l']);

    out += h('h3', null, 'Ce qu’il te faut');
    var caps = Object.keys(pl.captures).map(function (c) { return [esc(c), f(pl.captures[c], 1), '<b>' + f(Math.ceil(pl.captures[c] * (1 + S.capMargin))) + '</b>']; });
    var optRows = Object.keys(pl.optiCount).map(function (g) {
      var u = E.optiCost(+g, R.s); return ['Optimakina gén. ' + g + ' (craft niv. ' + E.OPTI[g].lvl + ')', f(pl.optiCount[g], 1), '<b>' + f(Math.ceil(pl.optiCount[g])) + '</b>', u == null ? 'prix manquant' : f(u) + ' kamas pièce'];
    });
    out += '<div class="grid2"><div>' + table(['Capture (gén. 1, filet universel)', 'En moyenne', 'À prévoir'], caps) +
      '<p class="note">Le sexe est tiré au hasard : la marge sert à avoir des couples mâle + femelle.</p></div><div>' +
      (optRows.length ? table(['Makina', 'En moyenne', 'À prévoir', 'Prix'], optRows) : '<div class="box">Aucune Optimakina dans cette stratégie.</div>') + '</div></div>';
    var mid = pl.nodes.filter(function (n) { return n.name !== S.target; }).map(function (n) { return [esc(n.name), n.gen, f(n.need, 2), f(Math.max(1, Math.ceil(n.need)))]; });
    out += '<details><summary class="mini">Les montures intermédiaires à réussir (' + mid.length + ' couleurs)</summary>' + table(['Couleur', 'Gén.', 'En moyenne', 'Au moins'], mid) + '</details>';
    out += '<div class="box"><b>Carburant :</b> ' + f(pl.fuelK) + ' kamas de fécondité · ' + f(pl.levK) + ' kamas d’XP · <b>Makinas :</b> ' + f(pl.optiK) + ' kamas · <b>Filets :</b> ' + f(pl.filetK) + ' kamas. ' +
      '<span class="note">XP au carburant « ' + esc(S.xpFam) + ' », fécondité au « ' + esc(S.fertFam) + ' », ' + S.connexions + ' connexions par jour.</span></div>';

    out += h('h3', null, 'Comparer les stratégies');
    out += '<p class="lead">Même cible, mêmes prix. « Tout au niveau 200 » répond à ta question : attendre le niveau 200 coûte peu de kamas mais beaucoup de jours.</p>';
    out += stratTable(R);
    out += '<div style="max-width:320px">' + field('Sûreté sur la dernière étape', 'safety', 'select', { options: [['moyenne', 'en moyenne'], ['90', '9 fois sur 10']] }) + '</div>';
    out += '<p class="note">Durée = le plus long entre (1) le temps de 9 générations à la suite, plus les ratés à rejouer quand il ne reste qu’un ou deux parents, et (2) le temps qu’il faut à tes places d’enclos pour tout préparer. ' +
      'C’est une estimation moyenne : la chance peut te faire gagner ou perdre plusieurs jours.</p>';
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
        'niv. ' + n.L, n.opti ? '<span class="pill g">oui</span>' : 'non', pct(n.p), pct((1 - n.p) * (n.rA + n.rB)), f(n.att, 2), f(n.need, 2), hours(Math.max(n.prepA, n.prepB)),
        f(n.levelK + n.fertK + n.optiK) ] };
    });
    out += table(['Bébé', 'Gén.', 'Parents', 'Niveau', 'Optimakina', 'Chance', 'Raté qui rend un parent', 'Essais', 'Réussites', 'Préparation', 'Kamas'], rows, ['l', '', 'l']);
    out += '<p class="note">« Raté qui rend un parent » : part des accouplements où le bébé raté a la couleur d’un des deux parents, qui est donc remplacé (modèle de dofuselevage.fr). ' +
      '« Préparation » : fécondité + XP du parent le plus long à préparer.</p>';
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
    var vals = E.unitCosts(pl, s);
    var la = E.levelAnalysis(S.stepX, s, vals, E.LEVELS, pl.credit);
    var fine = []; for (var L = 1; L <= 200; L += (L === 1 ? 4 : 5)) fine.push(L);
    if (fine.indexOf(167) < 0) fine.push(167); fine.sort(function (a, b) { return a - b; });
    var lf = E.levelAnalysis(S.stepX, s, vals, fine, pl.credit);
    var pick = function (o) { return lf.rows.filter(function (r) { return r.opti === o; }); };
    var bk = la.bestKamas, bh = la.bestHours, oc = E.optiCost(la.gen, s);
    var out = h('h2', null, 'À quel niveau accoupler ? (méthode de la vidéo)');
    out += '<p class="lead">Comme dans la vidéo sur le brisage : pour chaque niveau, ce que coûte l’XP (en kamas et en temps), et ce qu’elle rapporte (plus de chances d’avoir la génération suivante, donc moins de parents perdus). ' +
      'Un parent perdu est compté à son <b>vrai coût de remplacement</b> : ce qu’il a fallu pour le produire.</p>';
    out += '<label class="field" style="max-width:420px">Étape analysée<select data-k="stepX">' + names.map(function (n) {
      return '<option' + (n === S.stepX ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>';
    out += '<div class="box verdict">Pour <b>' + esc(S.stepX) + '</b> (' + esc(la.A) + ' × ' + esc(la.B) + ') :<br>' +
      '• le <b>moins cher</b> : ' + (bk[1] && oc != null && bk[1].kamas < bk[0].kamas ? 'niv. <b>' + bk[1].L + ' + Optimakina</b> (' + f(bk[1].kamas) + ' kamas par réussite)' : 'niv. <b>' + bk[0].L + '</b> sans Optimakina (' + f(bk[0].kamas) + ' kamas par réussite)') + '<br>' +
      '• le <b>moins de temps d’enclos</b> : ' + (bh[1] && oc != null && bh[1].placeH < bh[0].placeH ? 'niv. <b>' + bh[1].L + ' + Optimakina</b>' : 'niv. <b>' + bh[0].L + '</b> sans Optimakina') + ' (' + days((bh[1] && oc != null && bh[1].placeH < bh[0].placeH ? bh[1] : bh[0]).placeH / 24 / pl.places) + ' de tes ' + pl.places + ' places par réussite, remplacement des parents perdus compris)<br>' +
      '<span class="note">Pour le calendrier complet jusqu’à la gén. 10 (générations en parallèle, ratés à rejouer), regarde l’onglet « Gén. 10 ».</span><br>' +
      '• attendre le <b>niveau 200</b> : chance ' + pct(E.pTarget(200, 200, false, s)) + ' sans Optimakina, mais ' + hours(E.levelHours(1, 200, s)) + ' d’XP par parent au carburant « ' + esc(S.xpFam) + ' » ; ' +
      'avec une Optimakina, le niveau <b>167</b> suffit pour 100 %.' + (oc == null ? '<br><span class="warnc">Optimakina gén. ' + la.gen + ' : prix manquant, colonne « avec Optimakina » sans le prix de la Makina.</span>' : '') + '</div>';
    out += lineChart([
      { name: 'Kamas par réussite, sans Optimakina', color: '#7aa7ff', ys: pick(false).map(function (r) { return r.kamas; }), mark: bk[0] && bk[0].L },
      { name: 'Kamas par réussite, avec Optimakina', color: '#d6aa4f', ys: pick(true).map(function (r) { return r.optiMissing ? null : r.kamas; }), mark: bk[1] && bk[1].L },
      { name: 'Chance sans Optimakina (axe de droite)', color: '#5fcf8f', ys: pick(false).map(function (r) { return r.p; }), axis: 'r', dash: true },
      { name: 'Chance avec Optimakina (axe de droite)', color: '#ef7a6c', ys: pick(true).map(function (r) { return r.p; }), axis: 'r', dash: true }
    ], { xs: fine, xticks: [1, 25, 50, 75, 100, 125, 150, 175, 200], xlabel: 'niveau des deux parents', rmax: 1, rfmt: function (v) { return f(v * 100) + ' %'; }, title: 'coût par réussite selon le niveau' });
    var rows = E.LEVELS.map(function (L) {
      var a = la.rows.filter(function (r) { return r.L === L && !r.opti; })[0], b = la.rows.filter(function (r) { return r.L === L && r.opti; })[0];
      var best = (bk[0] && L === bk[0].L) || (bk[1] && L === bk[1].L);
      return { cls: best ? 'best' : '', cells: [ 'niv. ' + L, f(E.xpBetween(1, L)), hours(a.xpH), f(a.levK), pct(a.p), pct(b.p), f(a.att, 2) + ' / ' + f(b.att, 2), f(a.consumed, 2), '<b>' + f(a.kamas) + '</b>',
        b.optiMissing ? '—' : '<b>' + f(b.kamas) + '</b>', days(a.placeH / 24 / pl.places) + ' / ' + days(b.placeH / 24 / pl.places), hours(a.waitH) ] };
    });
    out += table(['Niveau', 'XP par parent', 'Temps d’XP', 'Coût XP (2 parents)', 'Chance', 'Chance + Opti', 'Essais (sans / Opti)', 'Parents perdus', 'Kamas / réussite', 'Kamas / réussite + Opti', 'Temps d’enclos / réussite (sans / Opti)', 'Préparation par essai'], rows);
    out += '<p class="note">Valeur d’un parent perdu : ' + esc(la.A) + ' ≈ ' + f((vals[la.A] || {}).kamas) + ' kamas et ' + days(((vals[la.A] || {}).hours || 0) / 24 / pl.places) + ' d’enclos ; ' + esc(la.B) + ' ≈ ' + f((vals[la.B] || {}).kamas) + ' kamas et ' + days(((vals[la.B] || {}).hours || 0) / 24 / pl.places) + ' (avec tes ' + pl.places + ' places). ' +
      'Les deux parents sont montés au même niveau. L’XP de la Mangeoire tourne aussi pendant la phase Amour de la fécondité : les premiers niveaux sont presque gratuits en temps.</p>';
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
    out += '<div class="box verdict">Ta question « un gén. 9 avec un gén. 1, 50 % d’avoir la dernière gén. ? » : au niveau ' + L + (o ? ' avec Optimakina' : '') +
      ', <b>Prune × Rousse</b> donne la gén. 10 à <b>' + pct(pr.p) + '</b> ; si c’est raté, le bébé est une gén. 9 seulement <b>' + pct(pr.back9) + '</b> du temps (le plus souvent une Rousse). ' +
      '<b>Prune × Émeraude</b> : gén. 10 à ' + pct(pe.p) + ', et un raté rend une gén. 9 <b>' + pct(pe.back9) + '</b> du temps. ' +
      'Avec un gén. 1, il te suffit d’<b>une seule</b> gén. 9 : c’est le plus rapide pour ta première gén. 10. Une fois l’élevage lancé, Prune × Émeraude rapporte <b>2 fois plus de génétons par accouplement</b> et perd moins en cas de raté.</div>';
    function otherCost(c) {
      var other = E.TREE[c.A].gen === 9 && E.TREE[c.B].gen === 9 ? null : (E.TREE[c.A].gen === 9 ? c.B : c.A);
      if (!other) return '<span class="dim">deux gén. 9</span>';
      var v = vals[other]; return v ? 'gén. ' + E.TREE[other].gen + ' · ' + f(v.kamas) + ' kamas' : 'gén. ' + E.TREE[other].gen + ' · <span class="dim">hors de ton chemin</span>';
    }
    var rows = list.map(function (c) {
      return { cls: c.X === S.finalX ? 'sel' : '', attr: ' data-final="' + esc(c.X) + '" style="cursor:pointer"', cells: [esc(c.X), esc(c.A) + ' × ' + esc(c.B), pct(c.p), pct(c.back9), f(c.genetons), f(c.used9, 2), '<b>' + f(c.genPer9) + '</b>', otherCost(c)] };
    });
    out += table(['Bébé gén. 10', 'Parents', 'Chance gén. 10', 'Raté → gén. 9 rendue', 'Génétons si réussi', 'Gén. 9 usées par réussite', 'Génétons par gén. 9 usée', 'Autre parent : coût de production'], rows, ['l', 'l']);
    out += '<p class="note">« Gén. 9 usées » : une gén. 9 utilisée compte pour ½ (deux stériles de gén. 9 se clonent en une fertile), moins les ratés qui rendent une gén. 9. C’est la vue d’un élevage déjà lancé. Un gén. 7 ou 8 comme autre parent rapporte plus de génétons, mais coûte bien plus cher à produire qu’une gén. 1 (dernière colonne, selon ton chemin). Clique une ligne pour voir toutes les issues.</p>';
    var sel = E.finalCross(S.finalX, L, o, s), mx = sel.items[0].p;
    out += h('h3', null, 'Toutes les issues de ' + esc(sel.A) + ' × ' + esc(sel.B));
    out += '<div class="bars">' + sel.items.slice(0, 14).map(function (i) {
      return '<div><span>' + esc(i.name) + ' <span class="dim">gén. ' + i.gen + '</span></span><span class="b' + (i.target ? ' t' : '') + '" style="width:' + Math.max(1, i.p / mx * 100) + '%"></span><span>' + pct(i.p, 1) + '</span></div>';
    }).join('') + '</div><p class="note">Modèle de répartition de dofuselevage.fr (non officiel) : parents ×8, grands-parents ×3, les hautes générations sortent moins souvent.</p>';
    return out;
  }

  // ------------------------------------------------------------ 5. prix et réglages
  function tabPrix() {
    var s = compute().s;
    var out = h('h2', null, 'Prix et réglages');
    out += '<p class="lead">Les prix viennent du classeur (relevés communautaires Ombre, sinon Kourial). Mets tes prix du jour : tout se recalcule et reste gardé sur cet appareil.</p>';
    out += h('h3', null, 'Carburants : kamas pour 1 000 points (recette la moins chère)');
    var rows = E.JAUGES.map(function (j) { return [esc(j)].concat(E.FAMILIES.map(function (fm, i) { return '<input type="number" step="any" data-k="fuel.' + j + '.' + i + '" data-num="1" value="' + (S.fuel[j][i] == null ? '' : S.fuel[j][i]) + '" placeholder="?">'; })); });
    out += table(['Jauge'].concat(E.FAMILIES), rows);
    out += h('h3', null, 'Ce que coûte ton carburant, avec tes connexions');
    var fr = E.FAMILIES.map(function (fm) {
      var t = clone(s); t.xpFam = fm; t.fertFam = fm;
      var c = E.refillCostPer1000(fm, s.refillH, S.fuel['Expérience']), xh = E.xpPerHour(fm, s.refillH);
      return [fm, f(xh), c == null ? '—' : f(c, 1), hours(E.levelHours(1, 100, t)) + ' · ' + f(E.levelCost(1, 100, t)), hours(E.levelHours(1, 167, t)) + ' · ' + f(E.levelCost(1, 167, t)),
              hours(E.levelHours(1, 200, t)) + ' · ' + f(E.levelCost(1, 200, t)), hours(E.fertHours(t)) + ' · ' + f(E.fertCost(t))];
    });
    out += table(['Famille', 'XP / heure (moyenne)', 'Kamas / 1 000 XP', 'Niv. 100 : temps · kamas', 'Niv. 167', 'Niv. 200', 'Fécondité : temps · kamas'], fr);
    out += '<p class="note">Kamas par monture : une jauge nourrit les ' + S.perEnclos + ' montures de l’enclos. Entre deux connexions la jauge redescend de palier : l’XP moyenne tient compte de ce ralentissement (Élixir à 40 XP / 10 s seulement au-dessus de 180 000).</p>';
    out += h('h3', null, 'Optimakinas de Dragodinde');
    var orow = Object.keys(E.OPTI).map(function (g) {
      var o = E.OPTI[g], c = E.optiCost(+g, s);
      return ['gén. ' + g, o.lvl, f(o.base), o.queues + (o.glour ? ' + 1 Queue de Glourséleste' : ''),
              '<input type="number" step="any" data-k="optiBuy.' + g + '" data-num="1" value="' + (S.optiBuy[g] == null ? '' : S.optiBuy[g]) + '" placeholder="achat HDV">', c == null ? '<span class="warnc">prix manquant</span>' : '<b>' + f(c) + '</b>'];
    });
    out += table(['Optimakina', 'Niv. de craft', 'Craft hors Queues', 'Queues de dragodinde sauvage', 'Ton prix d’achat', 'Coût retenu'], orow);
    out += '<div class="form">' +
      field('Queue de dragodinde sauvage (kamas)', 'queuePrice', 'number', { min: 0, note: '0 = tu la farmes pendant tes captures (drop ×3 sur Ombre)' }) +
      field('Queue de Glourséleste (kamas)', 'glourPrice', 'number', { min: 0, ph: 'à relever', note: 'Optimakina gén. 10 uniquement' }) +
      field('Filet universel (kamas)', 'filet', 'number', { min: 0, note: '10 Bois de Frêne + 10 Fer' }) +
      field('Neurone de dragodinde (kamas)', 'neurone', 'number', { min: 0 }) +
      field('Valeur d’un généton (kamas)', 'genetonValue', 'number', { min: 0, note: 'parchemin le plus rentable / son coût en génétons' }) +
      field('Taxe HDV', 'tax', 'number', { min: 0, max: 1, step: 0.01 }) + '</div>';
    out += h('h3', null, 'Règles du calcul');
    out += '<div class="form">' +
      field('Bonus Optimakina (%)', 'optiBonus', 'number', { min: 0, max: 100, note: '20 depuis la 3.7 (dofuspourlesnoobs), 10 avant' }) +
      field('Bonus du jour (%)', 'alma', 'number', { min: 0, max: 100, note: 'Takeza ou Almanax : +20' }) +
      field('Sérénité à corriger par fournée', 'seren', 'number', { min: 0 }) +
      field('Montures par enclos', 'perEnclos', 'number', { min: 1, max: 10, step: 1 }) +
      field('Marge de captures', 'capMargin', 'number', { min: 0, max: 3, step: 0.05, note: '0,25 = 25 %' }) + '</div><div class="form" style="margin-top:10px">' +
      field('Cloner les stériles (2 stériles de même génération → 1 fertile)', 'clone', 'check') +
      field('Compter les ratés de la couleur d’un parent comme un parent récupéré', 'recup', 'check') +
      field('Le clone garde son niveau', 'cloneKeepsLevel', 'check', { note: 'non documenté : décoché par prudence' }) + '</div>';
    out += '<p style="margin-top:14px"><button type="button" class="btn" data-reset="1">Remettre les valeurs par défaut</button></p>';
    return out;
  }

  // ------------------------------------------------------------ 6. brisage
  function tabBrisage() {
    var b = S.brisage, rows = [], fine = [], places = S.enclos * b.perEnclos, capRate = 60 / Math.max(0.1, b.captureMin || 5);
    for (var L = 1; L <= 200; L++) {
      var r0 = E.brisage(L, b);
      // débit : tu captures à ton rythme, tes enclos montent « places » montures à la fois ; le plus lent des deux fixe le débit
      r0.rate = r0.hours > 0 ? Math.min(capRate, places / r0.hours) : capRate;
      r0.perHour = r0.profit * r0.rate;
      fine.push(r0);
    }
    var best = function (k) { return fine.filter(function (r) { return r[k] != null && isFinite(r[k]); }).reduce(function (m, r) { return r[k] > m[k] ? r : m; }); };
    var bp = best('pct'), bh = best('perHour'), bg = best('profit');
    var out = h('h2', null, 'Brisage Muldo / Volkorne : à quel niveau briser ?');
    out += '<p class="lead">Reprise de la méthode de la vidéo : on monte les montures capturées à un niveau, puis on les brise pour des runes Ga PM ou Ga PA. ' +
      'Formule de la vidéo : runes = (3 × niveau/100 × poids × 60 / 200 + 1) / 100, ce qui donne 0,82 rune Ga PM au niveau 100 (≈ 80 % observé).</p>';
    out += '<div class="form">' +
      field('Rune visée', 'brisage.weight', 'select', { num: 1, options: [[90, 'Ga PM (poids 90)'], [100, 'Ga PA (poids 100)']] }) +
      field('Prix de la rune (kamas)', 'brisage.runePrice', 'number', { min: 0, note: 'vidéo : Ga PM 20 000, Ga PA 22 800' }) +
      field('Filet (kamas)', 'brisage.filet', 'number', { min: 0, note: 'vidéo : 1 210' }) +
      field('Kamas par point d’XP', 'brisage.pricePerXp', 'number', { min: 0, step: 0.0001, note: 'classeur (Extrait) 0,0125 · vidéo 0,33' }) +
      field('XP par heure', 'brisage.xpPerHour', 'number', { min: 1, note: 'Extrait : 3 600' }) +
      field('Montures par enclos', 'brisage.perEnclos', 'number', { min: 1, max: 10, step: 1 }) +
      field('Taxe HDV', 'brisage.tax', 'number', { min: 0, max: 1, step: 0.01 }) +
      field('Minutes de jeu par capture', 'brisage.captureMin', 'number', { min: 0.1, step: 0.5, note: 'combat + filet, par monture' }) + '</div>';
    out += '<p class="note">Débit : avec tes ' + places + ' places d’enclos (réglage « Enclos » en haut) et une capture toutes les ' + f(b.captureMin || 5, 1) + ' min, ce qui te limite est le plus lent des deux.</p>';
    out += '<div class="box verdict">Meilleur <b>% de bénéfice</b> : niv. <b>' + bp.L + '</b> (' + pct(bp.pct) + ') · meilleur <b>kamas par heure</b> en capturant en continu : niv. <b>' + bh.L + '</b> (' + f(bh.perHour) + ' kamas/h, ' + f(bh.rate, 1) + ' montures/h) · plus gros <b>bénéfice brut</b> : niv. <b>' + bg.L + '</b> (' + f(bg.profit) + ' kamas par monture).</div>';
    var xs = fine.map(function (r) { return r.L; });
    out += lineChart([
      { name: 'Bénéfice par monture (kamas)', color: '#d6aa4f', ys: fine.map(function (r) { return r.profit; }), mark: bg.L },
      { name: '% de bénéfice (axe de droite)', color: '#5fcf8f', ys: fine.map(function (r) { return r.pct; }), axis: 'r', dash: true, mark: bp.L }
    ], { xs: xs, xticks: [1, 25, 50, 75, 100, 125, 150, 175, 200], xlabel: 'niveau au moment du brisage', rfmt: function (v) { return f(v * 100) + ' %'; }, title: 'bénéfice du brisage' });
    [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200].forEach(function (L) {
      var r = fine[L - 1], hi = L === bp.L || L === bh.L || L === bg.L;
      rows.push({ cls: hi ? 'best' : '', cells: ['niv. ' + L, f(r.runes, 2), f(r.xp), f(r.cost), f(r.gross), '<b>' + f(r.profit) + '</b>', pct(r.pct), hours(r.hours), f(r.rate, 1), f(r.perHour)] });
    });
    out += table(['Niveau', 'Runes', 'XP', 'Coût XP', 'Kamas bruts', 'Bénéfice', '% bénéfice', 'Temps d’XP', 'Montures / h', 'Kamas / heure'], rows);
    out += '<p class="note">Comme dans la vidéo : le coût de l’XP est divisé par le nombre de montures de l’enclos, et le filet est compté une fois par monture. Le bénéfice brut monte avec le niveau ; le % et les kamas par heure passent par un maximum.</p>';
    return out;
  }

  // ------------------------------------------------------------ 7. règles
  function tabRegles() {
    var li = function (a) { return '<ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; };
    var out = h('h2', null, 'Règles utilisées, et ce qui reste incertain');
    out += h('h3', null, 'Confirmé par les guides');
    out += li([
      'Niveaux de monture 1 à 200. XP cumulée : 172 668 au niveau 100, 570 057 au 167, 867 582 au 200.',
      'Chance de la génération cible = 30 % + 0,15 % × (niveau du parent A + niveau du parent B) ; Optimakina +20 % depuis la 3.7 (+10 % avant) ; Takeza +20 %. Deux parents niveau 167 + Optimakina = 100 % ; deux niveau 200 sans Optimakina = 90 %.',
      'Naissance immédiate, bébé niveau 1 jauges à 0 ; les deux parents deviennent stériles.',
      'Clonage : deux stériles de même génération donnent un fertile ; les jauges repartent de 0 ; la capacité est perdue.',
      'Fécondité : Endurance, Maturité et Amour à 20 000 ; deux jauges actives à la fois par enclos ; une jauge nourrit toutes les montures de l’enclos.',
      'Jauges 3.7 : 200 000 points au maximum ; Extrait jusqu’à 80 000, Philtre 140 000, Potion 180 000, Élixir 200 000 ; 10 / 20 / 30 / 40 points toutes les 10 s selon le palier.',
      'Génétons : seulement si le bébé dépasse toutes les générations des deux arbres ; par parent 2, 4, 8, 16, 30, 60, 120, 240, 500 (gén. 1 à 9).',
      'Gén. 7 et 9 : un seul couple possible par couleur (voir « Chemin »).'
    ]);
    out += h('h3', null, 'Hypothèses (à vérifier en jeu)');
    out += li([
      '<b>Issue d’un raté</b> : modèle de répartition de dofuselevage.fr, non officiel (parents ×8, grands-parents ×3, pénalité selon la génération).',
      '<b>Clone</b> : dofuspourlesnoobs et le calculateur Muldo le disent tiré <b>au hasard</b> entre les deux stériles. Pour choisir, clone deux stériles de la même couleur (ou du même sexe).',
      '<b>Le clone garde-t-il son niveau ?</b> Aucune source : décoché par défaut.',
      '<b>Niveau d’une capture</b> : non documenté (niveau 1 par défaut, réglable en haut).',
      '<b>Durée</b> : estimation moyenne (voir « Gén. 10 ») ; avec 2 connexions par jour, une fécondité prend une journée.'
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
    if ((k === 'capLevel' || k === 'finalL') && v != null) v = Math.max(1, Math.min(200, Math.round(v)));
    setPath(k, v);
    if (k === 'brisage.weight') S.brisage.rune = v === 100 ? 'PA' : 'PM';
    save(); render();
  }
  document.addEventListener('change', onChange);
  document.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]');
    if (tb) { TAB = tb.getAttribute('data-tab'); history.replaceState(null, '', '#' + TAB); render(); window.scrollTo(0, 0); return; }
    var fr = e.target.closest('[data-final]');
    if (fr) { S.finalX = fr.getAttribute('data-final'); save(); render(); return; }
    if (e.target.closest('[data-reset]')) { if (confirm('Remettre tous les prix et réglages par défaut ?')) { localStorage.removeItem(KEY); S = load(); render(); } }
  });
  window.addEventListener('hashchange', function () { TAB = location.hash.slice(1) || 'objectif'; render(); });
  document.getElementById('ver').textContent = ' · version du 12/11/2026';
  render();
})();
