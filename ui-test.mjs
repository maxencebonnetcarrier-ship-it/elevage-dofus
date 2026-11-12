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
  await send('Page.navigate', { url: URL0 + '#objectif' }); await sleep(2500);
  const card = () => ev(`[...document.querySelectorAll('.card')].map(c => c.querySelector('.k').textContent + '=' + c.querySelector('.v').textContent)`);
  const before = await card();
  check('page chargée, 5 cartes', before.length === 5, before);
  const setSel = (k, v) => ev(`(() => { const e = document.querySelector('[data-k="${k}"]'); e.value = ${JSON.stringify(String(v))}; e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  // 1. objectif « dépenser le moins » : la durée doit s'allonger et le budget baisser
  await setSel('objective', 'kamas'); await sleep(1500);
  const cheap = await card();
  const num = s => +s.replace(/[^\d,]/g, '').replace(',', '.');
  const dur = a => num(a.find(x => x.startsWith('Durée')).split('=')[1]), bud = a => num(a.find(x => x.startsWith('Budget')).split('=')[1]);
  check('« dépenser le moins » : budget plus bas', bud(cheap) < bud(before), [bud(before), bud(cheap)]);
  check('« dépenser le moins » : durée plus longue', dur(cheap) > dur(before), [dur(before), dur(cheap)]);
  // 2. un enclos de plus ne doit jamais allonger le plan
  await setSel('objective', 'jours'); await sleep(1200);
  const d2 = dur(await card()); await setSel('enclos', 4); await sleep(1500); const d4 = dur(await card());
  check('4 enclos au lieu de 2 : pas plus long', d4 <= d2, [d2, d4]);
  // 3. prix de la Queue de Glourséleste : l'Optimakina gén. 10 devient possible
  await ev(`location.hash = '#prix'`); await sleep(1200);
  await ev(`(() => { const e = document.querySelector('[data-k="glourPrice"]'); e.value = '20000'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(1500);
  const opt10 = await ev(`[...document.querySelectorAll('tr')].map(t => t.textContent).find(t => t.startsWith('gén. 10'))`);
  check('Optimakina gén. 10 chiffrée après saisie du prix', /30\s?284/.test(opt10.replace(/\u202f/g, ' ')), opt10);
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
  for (const t of ['objectif', 'chemin', 'niveau', 'renta', 'final', 'prix', 'brisage', 'regles']) {
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
  check('captures sans marge (capture sûre)', capCard.includes('100 %'), capCard);
  // 7. remise à zéro
  await ev(`window.confirm = () => true; document.querySelector('[data-tab="prix"]').click()`); await sleep(1000);
  await ev(`document.querySelector('[data-reset]').click()`); await sleep(1500);
  const back = await ev(`document.querySelector('[data-k="enclos"]').value`);
  check('remise à zéro : 2 enclos', back === '2', back);
  // 8. mise à niveau des réglages d'une ancienne version (3) : anciens prix par défaut remplacés, saisies gardées
  await ev(`localStorage.setItem('dd-elevage-v1', JSON.stringify({ version: 3, enclos: 3, runePrices: { 'Rune Vi': 135, 'Rune Ra Vi': 1317, 'Rune Pui': 999, 'Rune Ine': null }, brisage: { runePrice: 20000 } }))`);
  await send('Page.reload'); await sleep(2500);
  await ev(`location.hash = '#brisage'`); await sleep(1500);
  const mig = await ev(`['Rune Vi', 'Rune Ra Vi', 'Rune Pui', 'Rune Ine'].map(k => document.querySelector('#mes-prix [data-k="runePrices.' + k + '"]').value).join(',') + '|' + document.querySelector('[data-k="enclos"]').value`);
  check('version 3 → 4 : prix vidéo à la place des anciens défauts, saisie 999 et 3 enclos gardés', mig === '95,1044,999,51|3', mig);
  check('aucune erreur JavaScript', errors.length === 0, errors);
} catch (e) { console.log('KO  exception : ' + e.message); ok = false; }
finally { try { ws && ws.close(); } catch { } ch.kill(); }
console.log(ok ? 'UI : TOUT VERT' : 'UI : ÉCHEC');
process.exit(ok ? 0 : 1);
