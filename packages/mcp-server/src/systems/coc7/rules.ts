/**
 * CoC7 Rules Helpers
 *
 * Pure functions that read or derive Call of Cthulhu 7e values from actor and
 * item data. Shared by the adapter (Node.js) and the index builder (browser),
 * so they must not touch Foundry globals.
 *
 * The system derives hit points, magic points, movement, damage bonus and
 * build in prepareBaseData, so a live actor already carries them. Data that
 * has not been through that step (e.g. a compendium entry's source) has them
 * as null; the `resolve*` functions then apply the rulebook formulas,
 * mirroring the system's own `*FromCharacteristics` statics
 * (coc7/models/actor/document-class.js).
 *
 * The system's formulas count a missing characteristic as 0. An NPC whose
 * characteristics are still dice formulas therefore carries "derived" values
 * of 0 hit points, damage bonus -2 and so on, which describe nothing. The
 * `resolve*` functions report such an automatic attribute as unknown.
 */

import { CHARACTERISTIC_ORDER } from './constants.js';

/** `system.characteristics` as stored: `{ str: { value: 50 }, ... }`. */
export type CharacteristicsData =
  | Record<string, { value?: number | string | null } | null | undefined>
  | null
  | undefined;

/**
 * Coerce a stored value to a finite number. Empty strings, null and anything
 * non-numeric are "unknown" (undefined), never 0.
 */
export function toNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Trimmed non-empty string, or undefined. Numbers are accepted because some
 * CoC7 string fields (damage bonus, armor) hold bare numbers in older data.
 */
export function toText(raw: unknown): string | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim();
  }
  return undefined;
}

/**
 * A characteristic's dice formula, or undefined when there is nothing to
 * roll. A plain number is not a roll: the system's own check
 * (`hasRollableCharacteristics`) skips it, and its example actors store "0"
 * for a characteristic the actor does not have.
 */
export function rollFormula(raw: unknown): string | undefined {
  const formula = toText(raw);
  if (formula === undefined || !Number.isNaN(Number(formula))) return undefined;
  return formula;
}

function characteristic(characteristics: CharacteristicsData, key: string): number | undefined {
  return toNumber(characteristics?.[key]?.value);
}

/**
 * Characteristic values keyed by lower-case abbreviation, in sheet order.
 * Characteristics an actor does not have (a creature's APP or EDU) are left out.
 */
export function characteristicValues(characteristics: CharacteristicsData): Record<string, number> {
  const values: Record<string, number> = {};
  for (const key of CHARACTERISTIC_ORDER) {
    const value = characteristic(characteristics, key);
    if (value !== undefined) values[key] = value;
  }
  return values;
}

function strengthPlusSize(characteristics: CharacteristicsData): number | undefined {
  const str = characteristic(characteristics, 'str');
  const siz = characteristic(characteristics, 'siz');
  return str === undefined || siz === undefined ? undefined : str + siz;
}

/**
 * Damage bonus from STR + SIZ, in the form the system stores it
 * ("-2", "-1", "0", "1D4", "1D6", "2D6", ...).
 */
export function damageBonusFromCharacteristics(
  characteristics: CharacteristicsData
): string | undefined {
  const sum = strengthPlusSize(characteristics);
  if (sum === undefined) return undefined;
  if (sum < 65) return '-2';
  if (sum < 85) return '-1';
  if (sum < 125) return '0';
  if (sum < 165) return '1D4';
  return `${Math.floor((sum - 45) / 80)}D6`;
}

/**
 * Build from STR + SIZ.
 */
export function buildFromCharacteristics(characteristics: CharacteristicsData): number | undefined {
  const sum = strengthPlusSize(characteristics);
  if (sum === undefined) return undefined;
  if (sum < 65) return -2;
  if (sum < 85) return -1;
  if (sum < 125) return 0;
  if (sum < 165) return 1;
  return Math.floor((sum - 45) / 80) + 1;
}

/**
 * Maximum hit points: (CON + SIZ) / 10, rounded down. This is the standard
 * rule; the Pulp Cthulhu "double hit points" option is a world setting the
 * server cannot see, and only matters for data the system has not derived.
 */
export function hitPointsFromCharacteristics(
  characteristics: CharacteristicsData
): number | undefined {
  const con = characteristic(characteristics, 'con');
  const siz = characteristic(characteristics, 'siz');
  return con === undefined || siz === undefined ? undefined : Math.floor((con + siz) / 10);
}

/**
 * Maximum magic points: POW / 5, rounded down.
 */
export function magicPointsFromCharacteristics(
  characteristics: CharacteristicsData
): number | undefined {
  const pow = characteristic(characteristics, 'pow');
  return pow === undefined ? undefined : Math.floor(pow / 5);
}

/**
 * Whether an attribute's stored value means anything. A value the Keeper set
 * by hand (`auto: false`) always does. An automatic one is derived from the
 * characteristics in `inputs`; with none of them rolled, the system derived it
 * from zeros and it is unknown. With only some present (a creature with SIZ
 * but no CON) the stored value is still what the sheet shows, so it stands.
 */
function isMeaningful(attribute: any, system: any, inputs: readonly string[]): boolean {
  if (attribute?.auto === false) return true;
  return inputs.some(key => characteristic(system?.characteristics, key) !== undefined);
}

/**
 * A pool (hit points or magic points) as `{ value, max }`. Prefers the stored
 * numbers; a missing maximum is derived, and a missing current value is taken
 * to be full, as the system does.
 */
function resolvePool(
  pool: any,
  derivedMax: number | undefined
): { value: number; max: number } | undefined {
  const max = toNumber(pool?.max) ?? derivedMax;
  const value = toNumber(pool?.value) ?? max;
  if (value === undefined || max === undefined) return undefined;
  return { value, max };
}

export function resolveHitPoints(system: any): { value: number; max: number } | undefined {
  const pool = system?.attribs?.hp;
  if (!isMeaningful(pool, system, ['con', 'siz'])) return undefined;
  return resolvePool(pool, hitPointsFromCharacteristics(system?.characteristics));
}

export function resolveMagicPoints(system: any): { value: number; max: number } | undefined {
  const pool = system?.attribs?.mp;
  if (!isMeaningful(pool, system, ['pow'])) return undefined;
  return resolvePool(pool, magicPointsFromCharacteristics(system?.characteristics));
}

export function resolveDamageBonus(system: any): string | undefined {
  const damageBonus = system?.attribs?.db;
  if (!isMeaningful(damageBonus, system, ['str', 'siz'])) return undefined;
  return toText(damageBonus?.value) ?? damageBonusFromCharacteristics(system?.characteristics);
}

export function resolveBuild(system: any): number | undefined {
  const build = system?.attribs?.build;
  if (!isMeaningful(build, system, ['str', 'siz'])) return undefined;
  return toNumber(build?.value) ?? buildFromCharacteristics(system?.characteristics);
}

/**
 * Movement rate as stored. Never derived here: the system's formula also
 * depends on age and a world setting, so an underived value stays unknown
 * rather than guessed.
 */
export function resolveMovement(system: any): number | undefined {
  const movement = system?.attribs?.mov;
  if (!isMeaningful(movement, system, ['dex', 'siz', 'str'])) return undefined;
  return toNumber(movement?.value);
}

/**
 * Sanity loss for encountering an NPC or creature, as "passed/failed"
 * (e.g. "0/1D6"). A half the sheet leaves empty is shown as "?" rather than
 * assumed to be zero. Undefined when the actor defines neither.
 */
export function formatSanityLoss(system: any): string | undefined {
  const sanLoss = system?.special?.sanLoss;
  const passed = toText(sanLoss?.checkPassed);
  // "checkFailled" is the system's own spelling of the field.
  const failed = toText(sanLoss?.checkFailled);
  if (passed === undefined && failed === undefined) return undefined;
  return `${passed ?? '?'}/${failed ?? '?'}`;
}

/**
 * A skill item's value. The system computes it as the sum of
 * `system.adjustments` (base + personal + occupation + archetype +
 * experiencePackage + experience); that getter is not part of the serialized
 * item, so it is recomputed here. Active-effect changes to a skill are
 * therefore not reflected.
 *
 * Falls back to a stored `value` (data from before the adjustments model),
 * then to a plain-number `base`. A formula base ("1/2*@DEX") cannot be
 * resolved without the owning actor, so it yields undefined.
 */
export function skillValue(skillSystem: any): number | undefined {
  if (!skillSystem || typeof skillSystem !== 'object') return undefined;

  const adjustments = skillSystem.adjustments;
  if (adjustments && typeof adjustments === 'object') {
    return Object.values(adjustments).reduce<number>(
      (total, raw) => total + (toNumber(raw) ?? 0),
      0
    );
  }

  // Older data stored -1 for "not set".
  const stored = toNumber(skillSystem.value);
  if (stored !== undefined && stored >= 0) return stored;

  return toNumber(skillSystem.base);
}
