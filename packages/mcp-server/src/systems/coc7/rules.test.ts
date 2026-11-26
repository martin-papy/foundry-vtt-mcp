/**
 * CoC7 Rules Helper Tests
 *
 * The rulebook formulas the adapter falls back on when the system has not
 * derived a value, and the skill-value computation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFromCharacteristics,
  damageBonusFromCharacteristics,
  formatSanityLoss,
  hitPointsFromCharacteristics,
  magicPointsFromCharacteristics,
  resolveBuild,
  resolveDamageBonus,
  resolveHitPoints,
  resolveMagicPoints,
  resolveMovement,
  rollFormula,
  skillValue,
} from './rules.js';

describe('CoC7 rules helpers', () => {
  it('derives damage bonus from STR + SIZ at each threshold', () => {
    const db = (str: number, siz: number) =>
      damageBonusFromCharacteristics({ str: { value: str }, siz: { value: siz } });
    expect(db(30, 34)).toBe('-2'); // 64
    expect(db(30, 35)).toBe('-1'); // 65
    expect(db(40, 44)).toBe('-1'); // 84
    expect(db(40, 45)).toBe('0'); // 85
    expect(db(60, 64)).toBe('0'); // 124
    expect(db(60, 65)).toBe('1D4'); // 125
    expect(db(80, 84)).toBe('1D4'); // 164
    expect(db(80, 85)).toBe('1D6'); // 165
    expect(db(100, 105)).toBe('2D6'); // 205
  });

  it('derives build from STR + SIZ at each threshold', () => {
    const build = (str: number, siz: number) =>
      buildFromCharacteristics({ str: { value: str }, siz: { value: siz } });
    expect(build(30, 34)).toBe(-2);
    expect(build(40, 44)).toBe(-1);
    expect(build(60, 64)).toBe(0);
    expect(build(80, 84)).toBe(1);
    expect(build(80, 85)).toBe(2);
    expect(build(100, 105)).toBe(3);
  });

  it('derives hit points and magic points, rounding down', () => {
    expect(hitPointsFromCharacteristics({ con: { value: 55 }, siz: { value: 65 } })).toBe(12);
    expect(hitPointsFromCharacteristics({ con: { value: 50 }, siz: { value: 45 } })).toBe(9);
    expect(magicPointsFromCharacteristics({ pow: { value: 45 } })).toBe(9);
    expect(magicPointsFromCharacteristics({ pow: { value: 60 } })).toBe(12);
  });

  it('returns undefined when the characteristics needed are missing', () => {
    expect(damageBonusFromCharacteristics({ str: { value: 50 } })).toBeUndefined();
    expect(buildFromCharacteristics({})).toBeUndefined();
    expect(hitPointsFromCharacteristics({ con: { value: null }, siz: { value: 60 } })).toBe(
      undefined
    );
    expect(magicPointsFromCharacteristics(undefined)).toBeUndefined();
  });

  it('computes a skill value as the sum of its adjustments', () => {
    expect(
      skillValue({ adjustments: { base: 25, personal: 10, occupation: 30, experience: 5 } })
    ).toBe(70);
    // Stored numbers may arrive as numeric strings.
    expect(skillValue({ adjustments: { base: '20', personal: '15' } })).toBe(35);
    // A legitimately untrained skill is 0, not unknown.
    expect(skillValue({ adjustments: { base: 0, personal: 0 } })).toBe(0);
  });

  it('falls back to a legacy stored value, then to a numeric base', () => {
    expect(skillValue({ value: 45, base: '20' })).toBe(45);
    expect(skillValue({ base: '20' })).toBe(20);
    // A formula base cannot be resolved without the actor.
    expect(skillValue({ base: '1/2*@DEX' })).toBeUndefined();
    expect(skillValue(undefined)).toBeUndefined();
  });
});

describe('CoC7 attribute resolution', () => {
  /**
   * A live actor whose characteristics are still dice formulas. The system has
   * already "derived" its automatic attributes from nothing: every missing
   * characteristic counts as 0 in its formulas.
   */
  const unrolled = {
    characteristics: { str: { formula: '5*3d6', value: null }, siz: { formula: '5*3d6' } },
    attribs: {
      hp: { value: 0, max: 0, auto: true },
      mp: { value: 0, max: 0, auto: true },
      mov: { value: 8, auto: true },
      db: { value: '-2', auto: true },
      build: { value: -2, auto: true },
    },
  };

  it('treats automatic attributes as unknown while their characteristics are unrolled', () => {
    expect(resolveHitPoints(unrolled)).toBeUndefined();
    expect(resolveMagicPoints(unrolled)).toBeUndefined();
    expect(resolveDamageBonus(unrolled)).toBeUndefined();
    expect(resolveBuild(unrolled)).toBeUndefined();
    expect(resolveMovement(unrolled)).toBeUndefined();
  });

  it('keeps a value the Keeper set by hand, even without characteristics', () => {
    const manual = {
      characteristics: {},
      attribs: {
        hp: { value: 7, max: 20, auto: false },
        mp: { value: 3, max: 3, auto: false },
        mov: { value: 12, auto: false },
        db: { value: '2D6', auto: false },
        build: { value: 3, auto: false },
      },
    };
    expect(resolveHitPoints(manual)).toEqual({ value: 7, max: 20 });
    expect(resolveMagicPoints(manual)).toEqual({ value: 3, max: 3 });
    expect(resolveMovement(manual)).toBe(12);
    expect(resolveDamageBonus(manual)).toBe('2D6');
    expect(resolveBuild(manual)).toBe(3);
  });

  it('reports what the system derived when only some characteristics exist', () => {
    // A creature with SIZ but no CON: the sheet shows floor(SIZ / 10) hit points.
    const partial = {
      characteristics: { siz: { value: 80 } },
      attribs: { hp: { value: 8, max: 8, auto: true } },
    };
    expect(resolveHitPoints(partial)).toEqual({ value: 8, max: 8 });
  });

  it('never derives movement, which depends on age and a world setting', () => {
    const source = {
      characteristics: { str: { value: 50 }, dex: { value: 50 }, siz: { value: 50 } },
      attribs: { mov: { value: null, auto: true } },
    };
    expect(resolveMovement(source)).toBeUndefined();
  });
});

describe('CoC7 rollFormula', () => {
  it('returns a dice formula', () => {
    expect(rollFormula('5*3d6')).toBe('5*3d6');
    expect(rollFormula(' (2D6+6)*5 ')).toBe('(2D6+6)*5');
  });

  it('ignores a plain number, which the system does not roll', () => {
    // The system's example actors store "0" for a characteristic they lack.
    expect(rollFormula('0')).toBeUndefined();
    expect(rollFormula('50')).toBeUndefined();
    expect(rollFormula(0)).toBeUndefined();
  });

  it('ignores an empty or missing formula', () => {
    expect(rollFormula('')).toBeUndefined();
    expect(rollFormula(null)).toBeUndefined();
    expect(rollFormula(undefined)).toBeUndefined();
  });
});

describe('CoC7 formatSanityLoss', () => {
  const withLoss = (checkPassed: unknown, checkFailled: unknown) => ({
    special: { sanLoss: { checkPassed, checkFailled } },
  });

  it('formats both halves as passed/failed', () => {
    expect(formatSanityLoss(withLoss('0', '1D6'))).toBe('0/1D6');
    expect(formatSanityLoss(withLoss('1D2', '1D6'))).toBe('1D2/1D6');
  });

  it('marks a half that is not set rather than inventing a zero', () => {
    expect(formatSanityLoss(withLoss('1D2', null))).toBe('1D2/?');
    expect(formatSanityLoss(withLoss('', '1D10'))).toBe('?/1D10');
  });

  it('is undefined when the actor defines no sanity loss', () => {
    expect(formatSanityLoss(withLoss(null, null))).toBeUndefined();
    expect(formatSanityLoss({})).toBeUndefined();
    expect(formatSanityLoss(undefined)).toBeUndefined();
  });
});
