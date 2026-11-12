// Test d'interface : pilote Chrome sans fenêtre (protocole de débogage), change des réglages comme un utilisateur et lit le résultat.
// Usage : node ui-test.mjs <url de index.html>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL0 = process.argv[2];
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), 'dd-ui-'));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { }
    await sleep(200);
  }
  throw new Error('Chrome ne répond pas');
}
function send(method, params = {}) { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pend.set(i, { res, rej })); }
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description)); return r.result.value; }
let ok = true;
function check(label, cond, got) { console.log((cond ? 'OK  ' : 'KO  ') + label + (got !== undefined ? ' | ' + JSON.stringify(got) : '')); if (!cond) ok = false; }
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id).res(d.result || {}); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value || a.description).join(' ')); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL0 + '#plan' }); await sleep(4000);
  const numP = s => +String(s).replace(/[^\d,]/g, '').replace(',', '.');
  const selP = (k, v) => ev(`(() => { const e = document.querySelector('[data-k="${k}"]'); e.value = ${JSON.stringify(String(v))}; e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  // 00. vue simple : « Mon plan » ouvert, dragodinde au choix (toutes générations)
  const pv = await ev(`[...document.querySelectorAll('#tabs [data-tab]')].map(b => b.dataset.tab).join(',') + '|' + !!document.querySelector('#global [data-k="xpFam"]') + '|' + document.querySelectorAll('[data-k="planTarget"] option').length`);
  check('vue simple : 3 onglets, pas de réglage de carburant en haut, 63 dragodindes au choix', pv === 'plan,prix,brisage|false|63', pv);
  const tblAfter = t => ev(`(() => { const h = [...document.querySelectorAll('main h3')].find(x => x.textContent.startsWith(${JSON.stringify(t)})); let n = h && h.nextElementSibling; while (n && !n.querySelector('table')) n = n.nextElementSibling; return n ? [...n.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' ¦ ')) : []; })()`);
  const sols = await tblAfter('1.');
  check('tableau 1 : la solution la plus rapide en tête, « ton plan », plus 7 stratégies à comparer', sols.length === 9 && sols[0].includes('Solution la plus rapide') && sols[0].includes('ton plan') && sols[2].includes('Capturer plus'), sols.slice(0, 3));
  const ord = await tblAfter('2.');
  const lastRow = ord[ord.length - 1] || '';
  check('tableau 2 : 3 captures + 17 dragodindes, dans l’ordre, la dernière = Prune et Rousse (Prune × Rousse, niveau, chance)', ord.length === 20 && ord[0].includes('capture au filet') && lastRow.includes('Prune et Rousse') && lastRow.includes('Prune × ') && /niv\. \d+/.test(lastRow) && lastRow.includes('%'), [ord.length, lastRow]);
  const t4 = (await tblAfter('4.')).length, t5 = (await tblAfter('5.')).length;
  check('tableaux 4 et 5 : chance selon le niveau, coût de Makina par réussite', t4 >= 10 && t5 === 9, [t4, t5]);
  await ev(`document.querySelector('tr[data-opti="0"]').click()`); await sleep(3000);
  const sols0 = await tblAfter('1.'), ord0 = await tblAfter('2.');
  check('clic sur « sans Makina » : adopté, plus aucune Makina dans le plan', sols0[1].includes('ton plan') && !ord0.some(r => r.includes('+ Makina')), sols0[1]);
  // barre XP remplie en cliquant dessus, à 60 % de sa largeur → 120 000 points (T2)
  const perDay = async () => numP((await tblAfter('3.')).find(r => r.startsWith('100')).split(' ¦ ')[3]);
  const pd1 = await perDay();
  await ev(`(() => { const g = document.querySelector('[data-fill="xpFam"]'), r = g.getBoundingClientRect(); g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * 0.6, clientY: r.top + r.height / 2 })); })()`); await sleep(3000);
  const gz = await ev(`document.querySelector('[data-fill="xpFam"]').getAttribute('aria-valuenow') + '|' + document.querySelector('[data-fill="xpFam"]').previousElementSibling.textContent`);
  const pd2 = await perDay();
  check('clic sur la barre XP à 60 % : 120 000 points, T2, plus de montures niveau 100 par jour', gz.startsWith('120000|') && gz.includes('T2') && pd2 > pd1, [gz, pd1, pd2]);
  await ev(`document.querySelector('[data-tier="xpFam|Extrait"]').click()`); await sleep(3000);
  const gz1 = await ev(`document.querySelector('[data-fill="xpFam"]').getAttribute('aria-valuenow')`);
  check('bouton T1 du tableau des tiers : barre remise à 80 000', gz1 === '80000', gz1);
  // autre dragodinde : Turquoise (gén. 7)
  await selP('planTarget', 'Turquoise'); await sleep(3500);
  const tq = await ev(`document.querySelector('main h2').textContent`), ordT = await tblAfter('2.');
  check('dragodinde visée = Turquoise : plan recalculé jusqu’à la gén. 7', tq.includes('Turquoise') && tq.includes('gén. 7') && (ordT[ordT.length - 1] || '').includes('Turquoise'), [tq, ordT.length]);
  // case « c'est fait » gardée après rechargement
  await ev(`(() => { const c = document.querySelector('input.tk'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(2500);
  await send('Page.reload'); await sleep(4000);
  const pr = await ev(`document.querySelector('.prog').textContent + '|' + document.querySelector('input.tk').checked + '|' + document.querySelector('input.tk').closest('tr').className`);
  check('ligne cochée : comptée, gardée après rechargement', /1 \/ \d+/.test(pr) && pr.endsWith('|true|done'), pr);
  // brisage : la solution pour chaque dragodinde
  await ev(`location.hash = '#brisage'`); await sleep(2500);
  const bs = await ev(`(() => { const t = document.querySelector('main h2').nextElementSibling.querySelector('table'); const r = [...t.querySelectorAll('tbody tr')]; const cell = n => { const x = r.find(y => y.children[0].textContent.trim() === n); return x ? x.lastElementChild.textContent : ''; }; return r.length + '|' + cell('Rousse') + '|' + cell('Prune et Rousse'); })()`);
  check('brisage : 66 dragodindes, Rousse à briser à un niveau, Prune et Rousse à extraire', bs.startsWith('66|Briser au niv.') && bs.endsWith('|Extraire les neurones'), bs);
  await ev(`location.hash = '#plan'`); await sleep(1500);
  await selP('planTarget', 'Prune et Rousse'); await sleep(3500);
  await ev(`document.querySelector('tr[data-opti="1"]').click()`); await sleep(3500);
  await ev(`document.querySelector('[data-expert="1"]').click()`); await sleep(800);
  const nt = await ev(`document.querySelectorAll('#tabs [data-tab]').length + '|' + !!document.querySelector('#global [data-k="xpFam"]')`);
  check('« Plus de détails » : les 10 onglets et les réglages des barres', nt === '10|true', nt);
  await ev(`location.hash = '#objectif'`); await sleep(2500);
  const card = () => ev(`[...document.querySelectorAll('.card')].map(c => c.querySelector('.k').textContent + '=' + c.querySelector('.v').textContent)`);
  const before = await card();
  check('page chargée, 5 cartes', before.length === 5, before);
  const setSel = (k, v) => ev(`(() => { const e = document.querySelector('[data-k="${k}"]'); e.value = ${JSON.stringify(String(v))}; e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  // 0. en-tête : 6 enclos au plus, aucun « carburant fécondité »
  const hdr = await ev(`document.querySelectorAll('[data-k="enclos"] option').length + '|' + document.getElementById('global').textContent`);
  check('en-tête : 6 enclos au plus, barres Amour · Endurance · Maturité en tiers (pas de « carburant fécondité »)', hdr.startsWith('6|') && hdr.includes('Barres Amour · Endurance · Maturité') && hdr.includes('T2 · jusqu’à 140 000') && !/carburant f[ée]condit[ée]/i.test(hdr), hdr.slice(0, 120));
  // 1. objectif « dépenser le moins » : la durée doit s'allonger et les Optimakinas disparaître
  await setSel('objective', 'kamas'); await sleep(1500);
  const cheap = await card();
  const num = s => +s.replace(/[^\d,\-−]/g, '').replace('−', '-').replace(',', '.');
  const val = (a, k) => num(a.find(x => x.startsWith(k)).split('=')[1]);
  const dur = a => val(a, 'Durée');
  check('« dépenser le moins » : moins d’Optimakinas', val(cheap, 'Optimakinas') < val(before, 'Optimakinas'), [val(before, 'Optimakinas'), val(cheap, 'Optimakinas')]);
  check('« dépenser le moins » : durée plus longue', dur(cheap) > dur(before), [dur(before), dur(cheap)]);
  await setSel('objective', 'renta'); await sleep(1800);
  const renta = await card();
  check('« gagner le plus par jour » : plus de kamas par jour qu’« aller le plus vite »', val(renta, 'Kamas gagnés par jour') >= val(before, 'Kamas gagnés par jour'), [val(before, 'Kamas gagnés par jour'), val(renta, 'Kamas gagnés par jour')]);
  // 2. un enclos de plus ne doit jamais allonger le plan
  await setSel('objective', 'jours'); await sleep(1200);
  const d2 = dur(await card()); await setSel('enclos', 4); await sleep(1500); const d4 = dur(await card());
  check('4 enclos au lieu de 2 : pas plus long', d4 <= d2, [d2, d4]);
  // 3. prix de la Queue de Glourséleste : l'Optimakina gén. 10 suit (10 Pépites à 5 000 + Queue)
  await ev(`location.hash = '#prix'`); await sleep(1200);
  await ev(`(() => { const e = document.querySelector('[data-k="glourPrice"]'); e.value = '20000'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(1500);
  const opt10 = await ev(`[...document.querySelectorAll('tr')].map(t => t.textContent).find(t => t.startsWith('gén. 10'))`);
  const nsp = t => t.replace(/[\s\u00a0\u202f]/g, '');
  check('Queue de Glourséleste à 20 000 : Optimakina gén. 10 = 50 000 + 20 000', nsp(opt10).includes('70000'), opt10);
  const mk = await ev(`[...document.querySelectorAll('main tr')].map(t => t.textContent).filter(t => t.startsWith('Muldoressource') || t.startsWith('Volkorneressource')).join(' | ')`);
  check('Makina gén. 10 : Muldo 74 000 + 50 000, Volkorne 18 000 + 50 000', nsp(mk).includes('124000') && nsp(mk).includes('68000'), mk);
  check('extraction : Ambre 153 000 (Muldo), Corne 57 000 (Volkorne)', nsp(mk).includes('Ambre153000') && nsp(mk).includes('Corne57000'), mk);
  // 4. les réglages survivent à un rechargement (stockage local)
  await send('Page.reload'); await sleep(2500);
  const kept = await ev(`document.querySelector('[data-k="glourPrice"]').value + '|' + document.querySelector('[data-k="enclos"]').value`);
  check('réglages gardés après rechargement', kept === '20000|4', kept);
  // 5. onglet dernier croisement : clic sur une ligne
  await ev(`location.hash = '#final'`); await sleep(1500);
  await ev(`document.querySelector('[data-final="Prune et Émeraude"]').click()`); await sleep(1200);
  const h3 = await ev(`[...document.querySelectorAll('h3')].map(h => h.textContent).join(' | ')`);
  check('clic sur Prune et Émeraude : issues affichées', h3.includes('Prune × Émeraude'), h3);
  // 6. tous les onglets sans erreur
  await ev(`location.hash = '#brisage'`); await sleep(1500);
  const ddRows = await ev(`[...document.querySelectorAll('h2')].map(x => x.textContent).join(' | ') + ' #' + Math.max(...[...document.querySelectorAll('main table')].filter(t => !t.closest('#mes-prix')).map(t => t.querySelectorAll('tbody tr').length))`);
  check('brisage : section dragodindes avec 66 lignes', ddRows.includes('briser ou extraire') && ddRows.endsWith('#66'), ddRows);
  await ev(`(() => { const e = document.querySelector('[data-k="runePrices.Rune Po"]'); e.value = '200000'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(1500);
  const prune = await ev(`[...document.querySelectorAll('main tr')].map(t => t.textContent).find(t => t.startsWith('Prune1') || t.startsWith('Prune9'))`);
  check('prix de la Rune Po saisi : la Prune devient chiffrée', prune && !prune.includes('?'), prune);
  const fz = await ev(`(() => { const r = [...document.querySelectorAll('main tr')].map(t => t.textContent); return [r.find(t => t.startsWith('VitalitéVi')), r.find(t => t.startsWith('IntelligenceIne'))].join(' | '); })()`);
  check('fusion : Vi à fusionner en Ra, Ine à vendre en simples', fz.includes('fusionner en Ra Vi') && fz.includes('vendre les simples'), fz);
  const gaPme = await ev(`[...document.querySelectorAll('main [data-k="runePrices.Rune Ga Pme"]')].filter(e => !e.closest('#mes-prix')).map(e => e.value).join(',')`);
  check('muldo : le prix de la Ga PM vient de « Mes prix » (14 139)', gaPme.length > 0 && gaPme.split(',').every(v => v === '14139'), gaPme);
  // 5 bis. vente au niveau 200 à ton prix (brisage des dragodindes)
  await ev(`(() => { const e = document.querySelector('[data-k="sell200.Prune"]'); e.value = '900000'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(1500);
  const sale = await ev(`(() => { const e = document.querySelector('[data-k="sell200.Prune"]'); return e.value + '|' + e.closest('td').textContent; })()`);
  check('vente niv. 200 de la Prune à 900 000 : kamas en plus par jour de place', sale.startsWith('900000|') && sale.includes('place / jour'), sale);
  for (const t of ['objectif', 'calcul', 'chemin', 'niveau', 'renta', 'final', 'prix', 'brisage', 'regles']) {
    await ev(`location.hash = '#${t}'`); await sleep(900);
    const bad = await ev(`document.querySelector('main').textContent.includes('Erreur de calcul') || document.querySelector('main').textContent.length < 300`);
    check('onglet ' + t + ' affiché', !bad);
  }
  // 6 bis. rentabilité : clic sur une ligne = nouveau réglage de carburant
  await ev(`location.hash = '#renta'`); await sleep(4000);
  const nrows = await ev(`document.querySelectorAll('[data-fuel]').length`);
  check('rentabilité : combinaisons de carburants chiffrées', nrows >= 9, nrows);
  await ev(`document.querySelector('[data-fuel="Potion|Extrait"]').click()`); await sleep(3500);
  const fam = await ev(`document.querySelector('[data-k="xpFam"]').value + '|' + document.querySelector('[data-k="fertFam"]').value`);
  check('clic sur Potion / Extrait : réglage adopté', fam === 'Potion|Extrait', fam);
  // 6 ter. « Mes prix » : présent sur chaque onglet, une saisie recalcule l'onglet en cours
  await ev(`location.hash = '#objectif'`); await sleep(1500);
  const panel = await ev(`!!document.querySelector('#mes-prix') && document.querySelectorAll('#mes-prix input').length`);
  check('« Mes prix » sur l’onglet Gén. 10, avec ses champs', panel > 60, panel);
  // une Optimakina vraiment utilisée par la stratégie affichée (première ligne du tableau « Makina », hors panneau)
  const usedGen = await ev(`(() => { const i = [...document.querySelectorAll('[data-k^="optiBuy."]')].find(x => !x.closest('#mes-prix')); return i ? i.getAttribute('data-k').split('.')[1] : null; })()`);
  const before2 = await ev(`document.querySelectorAll('.card .v')[3].textContent`);
  await ev(`(() => { const e = document.querySelector('#mes-prix [data-k="optiBuy.${usedGen}"]'); e.value = '90000'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(2500);
  const after2 = await ev(`document.querySelectorAll('.card .v')[3].textContent + ' | ' + document.querySelector('#mes-prix [data-k="optiBuy.${usedGen}"]').value`);
  check('prix d’une Optimakina utilisée (gén. ' + usedGen + ') changé depuis « Mes prix » : budget recalculé', usedGen && after2.split(' | ')[0] !== before2 && after2.endsWith('| 90000'), [before2, after2]);
  const capCard = await ev(`document.querySelectorAll('.card .s')[1].textContent`);
  check('captures : ton temps de capture affiché', capCard.includes('min la capture'), capCard);
  // 6 quater. calculateur par dragodinde (comme muldo-calculator)
  await ev(`location.hash = '#calcul'`); await sleep(1500);
  const c1 = await card();
  await setSel('calc.mult', 3); await sleep(1200);
  const c3 = await card();
  const bb = a => num(a[0].split('=')[1]);
  check('calculateur : 3 lots = 3 fois plus de bébés', Math.abs(bb(c3) - 3 * bb(c1)) <= 0.02 + 0.01 * bb(c3), [c1[0], c3[0]]);
  const casc = await ev(`[...document.querySelectorAll('h3')].map(h => h.textContent).join(' | ') + ' #' + [...document.querySelectorAll('main table')].filter(t => !t.closest('#mes-prix')).pop().querySelectorAll('tbody tr').length`);
  check('calculateur : cascade étape par étape', casc.includes('Cascade') && +casc.split('#').pop() >= 9, casc);
  await setSel('calc.mode', 'avance'); await sleep(1200);
  const adv = await ev(`document.querySelectorAll('[data-k^="calc.perGen."]').length`);
  check('calculateur avancé : niveau, Optimakina et tours par génération', adv >= 27, adv);
  // 7. remise à zéro
  await ev(`window.confirm = () => true; document.querySelector('[data-tab="prix"]').click()`); await sleep(1000);
  await ev(`document.querySelector('[data-reset]').click()`); await sleep(1500);
  const back = await ev(`document.querySelector('[data-k="enclos"]').value`);
  check('remise à zéro : 2 enclos', back === '2', back);
  // 7 bis. mise à niveau 5 → 6 : 12 enclos ramenés à 6, anciennes options retirées
  await ev(`localStorage.setItem('dd-elevage-v1', JSON.stringify({ version: 5, enclos: 12, parentsOnly: true, cloneKeepsLevel: true, neurone: 36000 }))`);
  await send('Page.reload'); await sleep(2500);
  await ev(`location.hash = '#prix'`); await sleep(1500);
  const v6 = await ev(`document.querySelector('[data-k="enclos"]').value + '|' + !!document.querySelector('[data-k="parentsOnly"]') + '|' + !!document.querySelector('[data-k="cloneKeepsLevel"]') + '|' + !!document.querySelector('[data-k="reuse"]') + '|' + document.querySelector('#mes-prix [data-k="neurone"]').value`);
  check('version 5 → 6 : 6 enclos au plus, options « parents seuls » et « clone garde son niveau » retirées, saisie gardée', v6 === '6|false|false|true|36000', v6);
  // 8. mise à niveau des réglages d'une ancienne version (3) : anciens prix par défaut remplacés, saisies gardées
  await ev(`localStorage.setItem('dd-elevage-v1', JSON.stringify({ version: 3, enclos: 3, runePrices: { 'Rune Vi': 135, 'Rune Ra Vi': 1317, 'Rune Pui': 999, 'Rune Ine': null }, brisage: { runePrice: 20000 } }))`);
  await send('Page.reload'); await sleep(2500);
  await ev(`location.hash = '#brisage'`); await sleep(1500);
  const mig = await ev(`['Rune Vi', 'Rune Ra Vi', 'Rune Pui', 'Rune Ine'].map(k => document.querySelector('#mes-prix [data-k="runePrices.' + k + '"]').value).join(',') + '|' + document.querySelector('[data-k="enclos"]').value`);
  check('version 3 → 4 : prix vidéo à la place des anciens défauts, saisie 999 et 3 enclos gardés', mig === '95,1044,999,51|3', mig);
  // 9. parchemins : valeur du généton calculée, ancien 100 par défaut retiré, prix modifiable depuis « Mes prix »
  await ev(`localStorage.setItem('dd-elevage-v1', JSON.stringify({ version: 4, genetonValue: 100, neurone: 23000 }))`);
  await send('Page.reload'); await sleep(2500);
  await ev(`location.hash = '#prix'`); await sleep(1500);
  const gv = await ev(`(() => { const e = document.querySelector('#mes-prix [data-k="genetonValue"]'); return e.value + '|' + e.placeholder + '|' + [...document.querySelectorAll('main b.gold')].map(b => b.textContent).join(','); })()`);
  check('version 4 → 5 : généton auto (991, Petit Parchemin d’Intelligence en tête)', gv.startsWith('|auto : 991|') && gv.includes('991'), gv);
  const nr = await ev(`document.querySelector('#mes-prix [data-k="neurone"]').value`);
  check('version 4 → 5 : neurone à l’ancien défaut 23 000 → 35 000', nr === '35000', nr);
  await ev(`(() => { const e = document.querySelector('#mes-prix [data-k="scrollPrices.Sagesse.3"]'); e.value = '300000'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(1500);
  const gv2 = await ev(`document.querySelector('#mes-prix [data-k="genetonValue"]').placeholder + '|' + document.querySelector('main').textContent.includes('Puissant Parchemin de Sagesse, soit')`);
  check('Puissant Parchemin de Sagesse à 300 000 : le généton passe à 1 747', gv2.replace(/[\s  ]/g, '') === 'auto:1747|true', gv2);
  // 10. carburants : 0 par défaut, coût affiché dès qu'un prix est saisi, par enclos ; anciens prix relevés remis à 0 à la mise à niveau
  await ev(`localStorage.setItem('dd-elevage-v1', JSON.stringify({ version: 4, fuel: { 'Expérience': [12.5, 999, 347.0, null] } }))`);
  await send('Page.reload'); await sleep(2500);
  const fx = await ev(`[0, 1, 2].map(i => document.querySelector('#mes-prix [data-k="fuel.Expérience.' + i + '"]').value).join(',')`);
  check('version 4 → 5 : carburant à l’ancien prix relevé → 0, prix saisi (999) gardé', fx === '0,999,0', fx);
  await ev(`localStorage.removeItem('dd-elevage-v1')`); await send('Page.reload'); await sleep(2500);
  await ev(`document.querySelector('[data-expert="1"]').click()`); await sleep(600);
  await ev(`location.hash = '#objectif'`); await sleep(1500);
  const fb0 = await ev(`(document.getElementById('carburants') || {}).textContent || ''`);
  const norm = t => t.replace(/[\s  ]/g, '');
  check('carburants à 0 : coût 0 sur l’élevage, repère HDV affiché', norm(fb0).startsWith('Carburants:0kamas') && /vaudraient[\d]+kamas/.test(norm(fb0)) && !norm(fb0).includes('vaudraient0kamas'), fb0.slice(0, 160));
  for (const [i, v] of [[0, '12.5'], [1, '363'], [2, '347']]) { await ev(`(() => { const e = document.querySelector('#mes-prix [data-k="fuel.Expérience.${i}"]'); e.value = '${v}'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(1200); }
  const fb1 = await ev(`(document.getElementById('carburants') || {}).textContent || ''`);
  const m1 = norm(fb1).match(/^Carburants:(\d+)kamas.*soit(\d+)parenclos/);
  check('prix des carburants d’XP saisis : le coût s’affiche, partagé par enclos', m1 && +m1[1] > 0 && Math.abs(+m1[2] * 2 - +m1[1]) <= 2, fb1.slice(0, 160));
  check('aucune erreur JavaScript', errors.length === 0, errors);
} catch (e) { console.log('KO  exception : ' + e.message); ok = false; }
finally { try { ws && ws.close(); } catch { } ch.kill(); }
console.log(ok ? 'UI : TOUT VERT' : 'UI : ÉCHEC');
process.exit(ok ? 0 : 1);
