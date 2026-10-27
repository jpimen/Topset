export const KG_PER_LB = 1 / 2.20462262;
export const LB_PER_KG = 2.20462262;
export const DEFAULT_ROUNDING_KG = 2.5;
export const DEFAULT_ROUNDING_LB = 5;
export const MAX_E1RM_REPS = 12;
export const LOW_CONFIDENCE_REPS = 10;
export const MIN_RPE = 5;
export const MAX_RPE = 10;
export const HARD_SET_RPE = 7;
export const DEFAULT_COLLAR_KG_PER_SIDE = 2.5;
export const BAR_WEIGHTS_KG = { men: 20, women: 15 } as const;
export const DEFAULT_BAR_KG = BAR_WEIGHTS_KG.men;
export const DEFAULT_BAR_LB = 45;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25] as const;
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5] as const;

// Approximate all-out repetitions-to-%1RM data following the common RTS/Tuchscherer chart.
// Verified published chart values are available only through 10 reps. UNVERIFIED: the requested
// 11-12 cells are omitted rather than guessed. RPE 5-6.5 can also imply more than 12 effective reps.
export const ALL_OUT_PERCENT_BY_REPS: Readonly<Record<number, number>> = {
  1: 100, 2: 95.5, 3: 92.2, 4: 89.2, 5: 86.3,
  6: 83.7, 7: 81.1, 8: 78.6, 9: 76.2, 10: 73.9,
};

// DOTS formula limits come from USA Powerlifting's published calculator notes; Wilks limits follow its published weight tables.
export const DOTS_COEFFICIENTS = {
  male: [-0.0000010930, 0.0007391293, -0.1918759221, 24.0900756, -307.75076],
  female: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288],
} as const;
export const SCORE_BW_RANGES_KG = {
  dots: { male: [40, 210], female: [40, 150] },
  wilks: { male: [40, 205], female: [40, 150] },
} as const;

// IPF GL classic powerlifting constants (IPF GL Coefficients, 2020 v0.6.5).
export const IPF_GL_COEFFICIENTS = {
  male: { a: 1199.72839, b: 1025.18162, c: 0.00921 },
  female: { a: 610.32796, b: 1045.59282, c: 0.03048 },
} as const;

// Original Wilks polynomial coefficients, Robert Wilks (Powerlifting Australia).
export const WILKS_COEFFICIENTS = {
  male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291],
  female: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054],
} as const;

// Banister fitness-fatigue defaults are editable population-level assumptions, not individually fitted.
export const BANISTER_DEFAULTS = { k1: 1, k2: 2, tau1Days: 45, tau2Days: 10, baseline: 0 } as const;
export const TAPER_DEFAULTS = { days: 10, totalReduction: 0.5 } as const;
export const ATTEMPT_DEFAULTS = { opener: 0.92, second: 0.965, third: 1 } as const;
export const DEFAULT_WARMUP_SCHEME = [
  { fraction: 0, reps: 8 }, { fraction: 0.4, reps: 5 }, { fraction: 0.6, reps: 3 },
  { fraction: 0.75, reps: 2 }, { fraction: 0.875, reps: 1 },
] as const;
