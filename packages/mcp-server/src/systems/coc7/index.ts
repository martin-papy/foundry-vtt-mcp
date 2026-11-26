/**
 * CoC7 System Module
 *
 * Exports for Call of Cthulhu 7th Edition support in the Registry Pattern
 * architecture.
 */

// Type definitions (from central types.ts)
export type { CoC7CreatureIndex } from '../types.js';

// System adapter (runs in MCP server Node.js context)
export { CoC7Adapter } from './adapter.js';

// Index builder (runs in Foundry browser context)
export { CoC7IndexBuilder } from './index-builder.js';

// Filter system
export {
  CoC7ActorTypes,
  CoC7FiltersSchema,
  matchesCoC7Filters,
  describeCoC7Filters,
} from './filters.js';
export type { CoC7ActorType, CoC7Filters } from './filters.js';

// Constants
export {
  CHARACTERISTIC_NAMES,
  CHARACTERISTIC_ORDER,
  CONDITION_KEYS,
  SKILL_ADJUSTMENT_KEYS,
  FIELD_PATHS,
  ITEM_TYPES,
  ACTOR_TYPES,
  STATTED_ACTOR_TYPES,
} from './constants.js';

// Rules helpers
export {
  buildFromCharacteristics,
  damageBonusFromCharacteristics,
  hitPointsFromCharacteristics,
  magicPointsFromCharacteristics,
  skillValue,
} from './rules.js';
