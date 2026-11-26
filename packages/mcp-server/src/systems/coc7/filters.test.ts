/**
 * CoC7 Filter Tests
 */

import { describe, it, expect } from 'vitest';
import { CoC7Adapter } from './adapter.js';
import { matchesCoC7Filters, describeCoC7Filters } from './filters.js';

describe('CoC7 creature filters', () => {
  const ghoul = {
    id: 'ghoul',
    name: 'Ghoul',
    type: 'creature',
    systemData: { creatureType: 'Mythos servitor', hitPoints: 13, build: 1, hasSpells: false },
  };
  const sorcerer = {
    id: 'sorcerer',
    name: 'Sorcerer',
    type: 'npc',
    systemData: { occupation: 'Antiquarian', hitPoints: 10, build: 0, hasSpells: true },
  };

  it('matches everything when no filter is given', () => {
    expect(matchesCoC7Filters(ghoul, {})).toBe(true);
  });

  it('filters by actor type', () => {
    expect(matchesCoC7Filters(ghoul, { actorType: 'creature' })).toBe(true);
    expect(matchesCoC7Filters(sorcerer, { actorType: 'creature' })).toBe(false);
  });

  it('filters by creature type, case-insensitively, as a substring', () => {
    expect(matchesCoC7Filters(ghoul, { creatureType: 'mythos' })).toBe(true);
    expect(matchesCoC7Filters(sorcerer, { creatureType: 'mythos' })).toBe(false);
  });

  it('filters by occupation', () => {
    expect(matchesCoC7Filters(sorcerer, { occupation: 'antiq' })).toBe(true);
    expect(matchesCoC7Filters(ghoul, { occupation: 'antiq' })).toBe(false);
  });

  it('filters by spellcasting', () => {
    expect(matchesCoC7Filters(sorcerer, { hasSpells: true })).toBe(true);
    expect(matchesCoC7Filters(ghoul, { hasSpells: true })).toBe(false);
    expect(matchesCoC7Filters(ghoul, { hasSpells: false })).toBe(true);
  });

  it('filters by exact hit points or a range', () => {
    expect(matchesCoC7Filters(ghoul, { hitPoints: 13 })).toBe(true);
    expect(matchesCoC7Filters(ghoul, { hitPoints: 12 })).toBe(false);
    expect(matchesCoC7Filters(ghoul, { hitPoints: { min: 12 } })).toBe(true);
    expect(matchesCoC7Filters(sorcerer, { hitPoints: { min: 12 } })).toBe(false);
    expect(matchesCoC7Filters(sorcerer, { hitPoints: { max: 10 } })).toBe(true);
  });

  it('excludes a creature with unknown hit points from a hit-point filter', () => {
    const unknown = { id: 'x', name: 'Shade', type: 'creature', systemData: { hasSpells: false } };
    expect(matchesCoC7Filters(unknown, { hitPoints: { min: 1 } })).toBe(false);
  });

  it('rejects invalid filters through the adapter', () => {
    const adapter = new CoC7Adapter();
    expect(adapter.matchesFilters(ghoul as any, { actorType: 'dragon' })).toBe(false);
    expect(adapter.describeFilters({ actorType: 'dragon' })).toBe('invalid filters');
  });

  it('describes filters in plain words', () => {
    expect(describeCoC7Filters({})).toBe('no filters');
    expect(
      describeCoC7Filters({ actorType: 'creature', creatureType: 'Mythos', hasSpells: true })
    ).toBe('creature, Mythos, spellcaster');
    expect(describeCoC7Filters({ hitPoints: 13 })).toBe('HP 13');
    expect(describeCoC7Filters({ hitPoints: { min: 10, max: 20 } })).toBe('HP 10-20');
    expect(describeCoC7Filters({ hitPoints: { min: 10 } })).toBe('HP 10+');
    expect(describeCoC7Filters({ hitPoints: { max: 20 } })).toBe('HP up to 20');
  });
});
