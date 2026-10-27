import { DOTS_COEFFICIENTS, IPF_GL_COEFFICIENTS, SCORE_BW_RANGES_KG, WILKS_COEFFICIENTS } from './constants';
import { assertPositive, CalculationError, finite, type Sex } from './shared';
function checkSex(sex: Sex): void { if (sex !== 'male' && sex !== 'female') throw new CalculationError('invalid_input', 'Sex must be male or female.'); }
export interface ScoreInput { totalKg: number; bodyweightKg: number; sex: Sex; }
export interface ScoreResult { dots: number; wilks: number; ipfGl: number; }
function checkRange(bodyweightKg: number, range: readonly number[]): void { assertPositive(bodyweightKg, 'bodyweight'); if (bodyweightKg < range[0] || bodyweightKg > range[1]) throw new CalculationError('out_of_range', `Bodyweight must be between ${range[0]} and ${range[1]} kg for this formula.`); }
export function dotsPoints(totalKg: number, bodyweightKg: number, sex: Sex): number {
  checkSex(sex); assertPositive(totalKg, 'total'); checkRange(bodyweightKg, SCORE_BW_RANGES_KG.dots[sex]);
  // DOTS (Konertz, 2019; coefficients published by USA Powerlifting), points = total × 500 / sex-specific quartic.
  const [a, b, c, d, e] = DOTS_COEFFICIENTS[sex]; return finite(totalKg * 500 / ((((a * bodyweightKg + b) * bodyweightKg + c) * bodyweightKg + d) * bodyweightKg + e), 'DOTS score');
}
export function wilksPoints(totalKg: number, bodyweightKg: number, sex: Sex): number {
  checkSex(sex); assertPositive(totalKg, 'total'); checkRange(bodyweightKg, SCORE_BW_RANGES_KG.wilks[sex]);
  // Original Wilks formula (Robert Wilks; coefficients reproduced in IPF Models Evaluation I, 2020): points = total × 500 / a polynomial.
  const [a, b, c, d, e, f] = WILKS_COEFFICIENTS[sex]; const denominator = a + b * bodyweightKg + c * bodyweightKg ** 2 + d * bodyweightKg ** 3 + e * bodyweightKg ** 4 + f * bodyweightKg ** 5;
  return finite(totalKg * 500 / denominator, 'Wilks score');
}
export function ipfGlPoints(totalKg: number, bodyweightKg: number, sex: Sex): number {
  checkSex(sex); assertPositive(totalKg, 'total'); assertPositive(bodyweightKg, 'bodyweight');
  // IPF GL Coefficients 2020 v0.6.5, classic powerlifting: coefficient=100/(A-B*exp(-C*BW)); points=total*coefficient.
  const { a, b, c } = IPF_GL_COEFFICIENTS[sex]; const coefficient = 100 / (a - b * Math.exp(-c * bodyweightKg)); return finite(totalKg * coefficient, 'IPF GL score');
}
export function calculateScores(totalKg: number, bodyweightKg: number, sex: Sex): ScoreResult { return { dots: dotsPoints(totalKg, bodyweightKg, sex), wilks: wilksPoints(totalKg, bodyweightKg, sex), ipfGl: ipfGlPoints(totalKg, bodyweightKg, sex) }; }
