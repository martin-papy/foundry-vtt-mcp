/**
 * CoC7 Filter Schemas
 *
 * Lightweight creature filters. Call of Cthulhu has no Challenge Rating or
 * level, so creatures are narrowed by kind, free-text type, spellcasting and
 * hit points instead.
 */

import { z } from 'zod';

/**
 * Actor types that can appear in the creature index.
 */
export const CoC7ActorTypes = ['character', 'npc', 'creature'] as const;
export type CoC7ActorType = (typeof CoC7ActorTypes)[number];

/**
 * CoC7 creature filter schema (permissive).
 */
export const CoC7FiltersSchema = z.object({
  // Actor type: investigator, human NPC, or creature
  actorType: z.enum(CoC7ActorTypes).optional(),

  // Free-form type from the NPC/creature sheet (e.g. "Mythos servitor", "Human")
  creatureType: z.string().optional(),

  // Free-form occupation (e.g. "Cultist", "Antiquarian")
  occupation: z.string().optional(),

  // Knows at least one spell
  hasSpells: z.boolean().optional(),

  // Maximum hit points: an exact value or a range
  hitPoints: z
    .union([
      z.number(),
      z.object({
        min: z.number().optional(),
        max: z.number().optional(),
      }),
    ])
    .optional(),
});

export type CoC7Filters = z.infer<typeof CoC7FiltersSchema>;

function includesIgnoringCase(haystack: unknown, needle: string): boolean {
  return typeof haystack === 'string' && haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Check if a creature matches CoC7 filters.
 */
export function matchesCoC7Filters(creature: any, filters: CoC7Filters): boolean {
  const data = creature.systemData ?? {};

  if (filters.actorType && creature.type !== filters.actorType) {
    return false;
  }

  if (filters.creatureType && !includesIgnoringCase(data.creatureType, filters.creatureType)) {
    return false;
  }

  if (filters.occupation && !includesIgnoringCase(data.occupation, filters.occupation)) {
    return false;
  }

  if (filters.hasSpells !== undefined && Boolean(data.hasSpells) !== filters.hasSpells) {
    return false;
  }

  if (filters.hitPoints !== undefined) {
    const hitPoints = data.hitPoints;
    // A creature whose hit points are unknown cannot satisfy a hit-point filter.
    if (typeof hitPoints !== 'number') return false;

    if (typeof filters.hitPoints === 'number') {
      if (hitPoints !== filters.hitPoints) return false;
    } else {
      const { min, max } = filters.hitPoints;
      if (min !== undefined && hitPoints < min) return false;
      if (max !== undefined && hitPoints > max) return false;
    }
  }

  return true;
}

function describeHitPoints(hitPoints: NonNullable<CoC7Filters['hitPoints']>): string | undefined {
  if (typeof hitPoints === 'number') return `HP ${hitPoints}`;

  const { min, max } = hitPoints;
  if (min !== undefined && max !== undefined) return `HP ${min}-${max}`;
  if (min !== undefined) return `HP ${min}+`;
  if (max !== undefined) return `HP up to ${max}`;
  return undefined;
}

/**
 * Generate a human-readable description of CoC7 filters.
 */
export function describeCoC7Filters(filters: CoC7Filters): string {
  const parts: string[] = [];

  if (filters.actorType) parts.push(filters.actorType);
  if (filters.creatureType) parts.push(filters.creatureType);
  if (filters.occupation) parts.push(filters.occupation);
  if (filters.hasSpells) parts.push('spellcaster');
  if (filters.hitPoints !== undefined) {
    const hitPoints = describeHitPoints(filters.hitPoints);
    if (hitPoints) parts.push(hitPoints);
  }

  return parts.length > 0 ? parts.join(', ') : 'no filters';
}
