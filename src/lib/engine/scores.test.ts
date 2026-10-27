import { describe, expect, it } from 'vitest';
import { calculateScores, dotsPoints, ipfGlPoints, wilksPoints } from './scores';
describe('strength scores', () => {
  it('matches independently calculated examples from the published coefficient sets', () => { expect(dotsPoints(600, 83, 'male')).toBeCloseTo(405.0524, 3); expect(ipfGlPoints(1035, 92.04, 'male')).toBeCloseTo(136.0882, 3); expect(wilksPoints(600, 83, 'male')).toBeCloseTo(400.5, 1); expect(calculateScores(600, 83, 'male').ipfGl).toBeGreaterThan(0); });
  it('rejects out-of-range bodyweights and invalid runtime sex values', () => { expect(() => dotsPoints(600, 39, 'male')).toThrow(); expect(() => wilksPoints(600, 39, 'female')).toThrow(); expect(() => dotsPoints(600, 83, 'other' as never)).toThrow(); });
});
