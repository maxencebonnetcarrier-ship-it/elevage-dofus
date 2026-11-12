/* Réglages par défaut. Prix des carburants : classeur Elevage_Dragodindes_Ombre.xlsx (relevés dofus-calculator.fr,
   Ombre sinon Kourial, novembre 2026) — coût en kamas pour 1 000 points de jauge, recette la moins chère de chaque famille.
   null = aucun prix connu (un ingrédient sans relevé). Tout se modifie dans l'onglet « Prix et réglages ». */
var DD_DEFAULTS = {
  version: 1,
  target: 'Prune et Rousse',
  objective: 'jours',
  enclos: 2,
  perEnclos: 10,
  connexions: 2,
  xpFam: 'Extrait',
  fertFam: 'Extrait',
  capLevel: 1,
  clone: true,
  recup: true,
  cloneKeepsLevel: false,
  optiBonus: 20,
  alma: 0,
  safety: 'moyenne',
  capMargin: 0.25,
  seren: 6000,
  filet: 310,
  neurone: 23000,
  genetonValue: 100,
  tax: 0.03,
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
  // prix des runes : Vi / Pa Vi / Ra Vi = Kourial (dofus-calculator.fr, 01/04/2026) ; Ga PA / Ga PM = vidéo ; le reste à relever sur Ombre
  runePrices: {
    'Rune Vi': 135, 'Rune Pa Vi': 442, 'Rune Ra Vi': 1317, 'Rune Ga Pa': 22800, 'Rune Ga Pme': 20000,
    'Rune Ini': null, 'Rune Pa Ini': null, 'Rune Ra Ini': null, 'Rune Fo': null, 'Rune Pa Fo': null, 'Rune Ra Fo': null,
    'Rune Ine': null, 'Rune Pa Ine': null, 'Rune Ra Ine': null, 'Rune Cha': null, 'Rune Pa Cha': null, 'Rune Ra Cha': null,
    'Rune Age': null, 'Rune Pa Age': null, 'Rune Ra Age': null, 'Rune Pui': null, 'Rune Pa Pui': null, 'Rune Ra Pui': null,
    'Rune Prospe': null, 'Rune Pa Prospe': null, 'Rune So': null, 'Rune Invo': null, 'Rune Cri': null, 'Rune Po': null
  },
  // brisage des dragodindes : niveau, niveau d'objet, coefficient (90 % recale la formule sur les 0,82 rune Ga PM de la vidéo), part du bonus au niveau 100
  ddBrise: { L: 100, itemLevel: 60, coef: 90, curve100: 0.75 },
  brisage: {
    rune: 'PM',
    weight: 90,
    itemLevel: 60,
    divisor: 100,
    runePrice: 20000,
    tax: 0.03,
    filet: 310,
    pricePerXp: 0.0125,
    perEnclos: 10,
    capLevel: 1,
    xpPerHour: 3600,
    captureMin: 5
  }
};
if (typeof module !== 'undefined') module.exports = DD_DEFAULTS;
