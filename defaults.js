/* Réglages par défaut. Prix des carburants : classeur Elevage_Dragodindes_Ombre.xlsx (relevés dofus-calculator.fr,
   Ombre sinon Kourial, novembre 2026) — coût en kamas pour 1 000 points de jauge, recette la moins chère de chaque famille.
   null = aucun prix connu (un ingrédient sans relevé). Tout se modifie dans l'onglet « Prix et réglages ». */
var DD_DEFAULTS = {
  version: 4,
  target: 'Prune et Rousse',
  objective: 'jours',
  enclos: 2,
  perEnclos: 10,
  connexions: 2,
  xpFam: 'Extrait',
  fertFam: 'Extrait',
  capLevel: 1,
  clone: true,
  parentsOnly: false,   // génétique : false = parents + grands-parents (guides 2026), true = parents seuls (hypothèse à tester)
  recup: true,
  cloneKeepsLevel: false,
  optiBonus: 20,
  alma: 0,
  safety: 'moyenne',
  capMargin: 0,   // capture sûre à 100 % (gén. 1) : aucune marge par défaut
  seren: 6000,
  filet: 310,
  neurone: 23000,
  genetonValue: 100,
  tax: 0.01,   // taxe de l’hôtel des ventes : 1 % (constaté en jeu)
  queuePrice: 0,
  glourPrice: null,
  optiBuy: {},
  fuel: {
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
    pricePerXp: 0.0125,
    perEnclos: 10,
    capLevel: 1,
    xpPerHour: 3600,
    captureMin: 5,
    // modèle « jeu » : taux fixe de 50 % pour les montures, niveau de l'objet = niveau de la monture, bonus de 1 PM / 1 PA
    model: 'jeu',
    coef: 50,
    stat: 1,
    capturesPerDay: 40
  }
};
if (typeof module !== 'undefined') module.exports = DD_DEFAULTS;
