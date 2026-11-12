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
