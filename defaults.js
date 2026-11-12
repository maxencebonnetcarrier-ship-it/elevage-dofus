/* Réglages par défaut. Prix des carburants : classeur Elevage_Dragodindes_Ombre.xlsx (relevés dofus-calculator.fr,
   Ombre sinon Kourial, novembre 2026) — coût en kamas pour 1 000 points de jauge, recette la moins chère de chaque famille.
   null = aucun prix connu (un ingrédient sans relevé). Tout se modifie dans l'onglet « Prix et réglages ». */
var DD_DEFAULTS = {
  version: 6,
  target: 'Prune et Rousse',
  objective: 'jours',
  enclos: 2,
  perEnclos: 10,
  connexions: 2,
  xpFam: 'Extrait',
  fertFam: 'Extrait',
  capLevel: 1,
  clone: true,          // 2 stériles de même génération → 1 fertile ; le clone repart au niveau 1 (constaté en jeu)
  reuse: true,          // recroiser les bébés ratés : ils gardent leurs deux parents dans leur arbre (génétique parents + grands-parents)
  allowOpti: true,
  captureMin: 5,        // ton temps par capture (minutes), compté dans l'objectif « aller le plus vite »
  optiBonus: 20,
  alma: 0,
  safety: 'moyenne',
  capMargin: 0,   // capture sûre à 100 % (gén. 1) : aucune marge par défaut
  seren: 6000,
  filet: 310,
  neurone: 35000,   // prix de l'utilisateur, 12/11/2026
  // ce que donne l'extraction des autres espèces (prix de l'utilisateur, 12/11/2026) : Ambre pour le Muldo, Corne pour le Volkorne
  extract: { 'Muldo': 153000, 'Volkorne': 57000 },
  genetonValue: null,   // vide = calculée depuis les parchemins (le plus rentable par généton) ; un chiffre saisi l'emporte
  // prix moyens HDV Ombre des parchemins de caractéristique (captures de l'utilisateur, 12/11/2026) : Petit, Parchemin, Grand, Puissant
  // coût chez Eugène Éton (3.7) : 10, 30, 70, 170 génétons
  scrollPrices: {
    'Vitalité': [7942, 18578, 69985, 161792],
    'Sagesse': [8546, 29841, 63857, 166670],
    'Force': [5612, 21978, 47626, 140681],
    'Intelligence': [10009, 28914, 69775, 127674],
    'Chance': [7862, 23851, 57693, 144363],
    'Agilité': [9306, 25258, 62291, 144736]
  },
  tax: 0.01,   // taxe de l’hôtel des ventes : 1 % (constaté en jeu)
  queuePrice: 0,
  glourPrice: 30000,   // Queue de Glourséleste (Optimakina gén. 10), prix de l'utilisateur le 12/11/2026
  // ingrédients des Optimakinas : Pépite 5 000 (prix de l'utilisateur, 12/11/2026) ; le reste, il le droppe → 0
  // ressource propre de la Makina gén. 10 du Muldo et du Volkorne (prix de l'utilisateur, 12/11/2026) ; le reste : 10 Pépites + drops
  makina10: { 'Muldo': 74000, 'Volkorne': 18000 },
  ingPrices: {
    'Pépite': 5000, 'Sueur de dragodinde': 0, 'Pic de dragodinde dorée': 0, 'Pic de dragodinde': 0,
    'Fémur du Chafer Rōnin': 0, 'La cambriole pour les Nuls': 0, 'Pierre du Craqueleur Légendaire': 0, 'Groin de Dragon Cochon': 0,
    'Bourgeon explosif de Damadrya': 0, 'Laine du Royalmouth': 0, 'Pistil du Tynril': 0, "Mèche Rebelle d'Hell Mina": 0
  },
  optiBuy: {},
  // prix de vente d'une dragodinde au niveau 200, à TON prix (vide = elle ne se vend pas) : { 'Prune': 500000, ... }
  sell200: {},
  // calculateur par dragodinde (comme muldo-calculator) : lots de captures, niveau, Optimakina, tours de recroisement
  calc: { target: 'Prune et Rousse', mult: 1, L: 40, opti: true, k: 2, mode: 'simple', perGen: {} },
  // carburants : 0 par défaut (tu les fabriques) ; mets un prix pour voir ce qu'ils coûtent. null = recette inexistante.
  fuel: {
    'Endurance': [0, 0, 0, 0],
    'Maturité': [0, 0, 0, null],
    'Amour': [0, 0, 0, 0],
    'Gain de sérénité': [0, 0, 0, 0],
    'Perte de sérénité': [0, 0, 0, 0],
    'Expérience': [0, 0, 0, null]
  },
  // repère HDV (classeur, relevés dofus-calculator.fr) : sert seulement à montrer ce que vaudraient tes carburants au prix du marché
  fuelRef: {
    'Endurance': [18.7, 180.8, 1310.2, 2474.5],
    'Maturité': [46.5, 50.9, 247.3, null],
    'Amour': [3.4, 134.3, 1077.5, 3499.0],
    'Gain de sérénité': [21.7, 263.5, 409.4, 1154.8],
    'Perte de sérénité': [7.8, 153.7, 404.5, 5175.3],
    'Expérience': [12.5, 363.0, 347.0, null]
  },
  // recette la moins chère de chaque case (classeur, feuille « Synthèse carburants »)
  fuelRecipe: {
    "Endurance": ["Extrait d'Endurance","Philtre d'Endurance","Potion d'Endurance","Gigantesque Élixir d'Endurance"],
    "Maturité": ["Grand Extrait de Maturité","Gigantesque Philtre de Maturité","Gigantesque Potion de Maturité","—"],
    "Amour": ["Gigantesque Extrait d'Amour","Petit Philtre d'Amour","Petite Potion d'Amour","Minuscule Élixir d'Amour"],
    "Gain de sérénité": ["Gigantesque Extrait de gain de Sérénité","Minuscule Philtre de gain de Sérénité","Gigantesque Potion de gain de Sérénité","Petit Élixir de gain de Sérénité"],
    "Perte de sérénité": ["Grand Extrait de perte de Sérénité","Philtre de perte de Sérénité","Minuscule Potion de perte de Sérénité","Grand Élixir de perte de Sérénité"],
    "Expérience": ["Grand Extrait d'Expérience de monture","Philtre d'Expérience de monture","Grande Potion d'Expérience de monture","—"]
  },
  // prix des runes : hôtel des ventes Ombre, relevés le 12/11/2026 sur la vidéo de l'utilisateur (runes.mp4).
  // Rune Fo, Cha et Age simples : hors de l'écran dans la vidéo → à saisir (la Pa et la Ra suffisent en attendant, par fusion).
  runePrices: {
    'Rune Vi': 95, 'Rune Pa Vi': 320, 'Rune Ra Vi': 1044, 'Rune Ga Pa': 15566, 'Rune Ga Pme': 14139,
    'Rune Ini': 33, 'Rune Pa Ini': 133, 'Rune Ra Ini': 353, 'Rune Fo': null, 'Rune Pa Fo': 127, 'Rune Ra Fo': 346,
    'Rune Ine': 51, 'Rune Pa Ine': 141, 'Rune Ra Ine': 318, 'Rune Cha': null, 'Rune Pa Cha': 140, 'Rune Ra Cha': 527,
    'Rune Age': null, 'Rune Pa Age': 253, 'Rune Ra Age': 674, 'Rune Pui': 109, 'Rune Pa Pui': 396, 'Rune Ra Pui': 1335,
    'Rune Prospe': 168, 'Rune Pa Prospe': 399, 'Rune So': 167, 'Rune Pa So': 746, 'Rune Invo': 1961, 'Rune Cri': 760, 'Rune Po': 3501
  },
  // brisage des dragodindes : taux fixe de 50 % pour les montures, niveau de l'objet = niveau de la monture, bonus à leur maximum
  // (mountLevel: false → niveau d'objet fixe itemLevel ; jetMax: false → bonus selon le niveau, curve100 atteint au niveau 100)
  ddBrise: { L: 100, coef: 50, mountLevel: true, jetMax: true, itemLevel: 60, curve100: 0.75 },
  brisage: {
    rune: 'PM',
    weight: 90,
    itemLevel: 60,
    divisor: 100,
    runePrice: 14139,   // repli ; la page prend le prix Ga PM / Ga PA de « Mes prix »
    tax: 0.01,
    filet: 310,
    pricePerXp: 0,   // XP des montures : carburant à 0 par défaut (repère Extrait 0,0125 kama par point)
    perEnclos: 10,
    capLevel: 1,
    xpPerHour: 3600,
    captureMin: 5,
    // modèle « jeu » : taux fixe de 50 % pour les montures, niveau de l'objet = niveau de la monture, bonus de 1 PM / 1 PA
    model: 'jeu',
    coef: 50,
    stat: 1,
    capturesPerDay: 40,
    sell200: null   // prix de vente d'un muldo / volkorne niveau 200 (ton prix) ; vide = pas de vente
  }
};
if (typeof module !== 'undefined') module.exports = DD_DEFAULTS;
