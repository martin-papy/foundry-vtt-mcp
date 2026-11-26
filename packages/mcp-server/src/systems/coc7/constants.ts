/**
 * CoC7 Constants
 *
 * Central definitions for the Call of Cthulhu 7th Edition system:
 * characteristic names, field paths, and type maps.
 *
 * Foundry registers this system under the mixed-case id "CoC7"; this codebase
 * compares system ids in lower case, hence 'coc7' throughout.
 *
 * Data model reference (DataModel-based system), under coc7/models in:
 * https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT
 */

/**
 * The 8 CoC7 characteristics (abbreviation -> full name).
 * Keys match `system.characteristics.<key>`.
 */
export const CHARACTERISTIC_NAMES: Record<string, { short: string; name: string }> = {
  str: { short: 'STR', name: 'Strength' },
  con: { short: 'CON', name: 'Constitution' },
  siz: { short: 'SIZ', name: 'Size' },
  dex: { short: 'DEX', name: 'Dexterity' },
  app: { short: 'APP', name: 'Appearance' },
  int: { short: 'INT', name: 'Intelligence' },
  pow: { short: 'POW', name: 'Power' },
  edu: { short: 'EDU', name: 'Education' },
};

/**
 * Ordered list of characteristic keys (investigator sheet order).
 */
export const CHARACTERISTIC_ORDER = [
  'str',
  'con',
  'siz',
  'dex',
  'app',
  'int',
  'pow',
  'edu',
] as const;

/**
 * Condition flags under `system.conditions.<key>.value`, in sheet order.
 */
export const CONDITION_KEYS = [
  'criticalWounds',
  'unconscious',
  'dying',
  'dead',
  'prone',
  'tempoInsane',
  'indefInsane',
] as const;

/**
 * Keys of `system.adjustments` on a skill item. A skill's value is their sum.
 */
export const SKILL_ADJUSTMENT_KEYS = [
  'base',
  'personal',
  'occupation',
  'archetype',
  'experiencePackage',
  'experience',
] as const;

/**
 * Common CoC7 field paths for system data access.
 */
export const FIELD_PATHS = {
  // Characteristics
  CHARACTERISTICS: 'system.characteristics',

  // Attributes
  ATTRIBS_HP: 'system.attribs.hp',
  ATTRIBS_MP: 'system.attribs.mp',
  ATTRIBS_SAN: 'system.attribs.san',
  ATTRIBS_LUCK: 'system.attribs.lck.value',
  ATTRIBS_MOV: 'system.attribs.mov.value',
  ATTRIBS_DB: 'system.attribs.db.value',
  ATTRIBS_BUILD: 'system.attribs.build.value',
  ATTRIBS_ARMOR: 'system.attribs.armor.value',

  // Conditions
  CONDITIONS: 'system.conditions',

  // Identity
  INFOS_OCCUPATION: 'system.infos.occupation',
  INFOS_AGE: 'system.infos.age',
  INFOS_TYPE: 'system.infos.type', // npc / creature only
  INFOS_ORGANIZATION: 'system.infos.organization',

  // NPC / creature only ("checkFailled" is the system's own spelling)
  SAN_LOSS_PASSED: 'system.special.sanLoss.checkPassed',
  SAN_LOSS_FAILED: 'system.special.sanLoss.checkFailled',
  ATTACKS_PER_ROUND: 'system.special.attacksPerRound',

  // Text
  DESCRIPTION: 'system.biography.personalDescription.value',
  KEEPER_NOTES: 'system.description.keeper',
} as const;

/**
 * Item types in CoC7.
 */
export const ITEM_TYPES = {
  SKILL: 'skill',
  WEAPON: 'weapon',
  ITEM: 'item', // Generic possession
  BOOK: 'book',
  SPELL: 'spell',
  TALENT: 'talent', // Pulp Cthulhu
  STATUS: 'status', // Phobias and manias
  ARMOR: 'armor',
  OCCUPATION: 'occupation',
  ARCHETYPE: 'archetype', // Pulp Cthulhu
  EXPERIENCE_PACKAGE: 'experiencePackage',
  SETUP: 'setup',
  CHASE: 'chase',
} as const;

/**
 * Actor types in CoC7.
 */
export const ACTOR_TYPES = {
  CHARACTER: 'character', // Investigators
  NPC: 'npc', // Human non-player characters
  CREATURE: 'creature', // Monsters and animals (same data model as npc)
  CONTAINER: 'container', // Storage, no statistics
  VEHICLE: 'vehicle',
} as const;

/**
 * Actor types that have characteristics, attributes and skills.
 */
export const STATTED_ACTOR_TYPES: readonly string[] = [
  ACTOR_TYPES.CHARACTER,
  ACTOR_TYPES.NPC,
  ACTOR_TYPES.CREATURE,
];
