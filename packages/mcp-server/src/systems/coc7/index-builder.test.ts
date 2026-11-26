/**
 * CoC7 Index Builder Tests
 *
 * The builder runs in Foundry's browser context; here it is fed plain objects
 * shaped like compendium actor documents.
 */

import { describe, it, expect } from 'vitest';
import { CoC7IndexBuilder } from './index-builder.js';

/** A creature whose attributes the system has already derived. */
const deepOne: any = {
  name: 'Deep One',
  type: 'creature',
  system: {
    characteristics: {
      str: { value: 90 },
      con: { value: 50 },
      siz: { value: 80 },
      dex: { value: 50 },
      app: { value: null },
      int: { value: 65 },
      pow: { value: 50 },
      edu: { value: null },
    },
    attribs: {
      hp: { value: 13, max: 13, auto: true },
      mp: { value: 10, max: 10, auto: true },
      lck: { value: null },
      san: { value: null, max: 99, auto: true },
      mov: { value: 8, auto: true, type: 'walk' },
      db: { value: '1D6', auto: true },
      build: { value: 2, auto: true },
      armor: { notes: false, value: '1' },
    },
    infos: { type: 'Mythos servitor', occupation: '', organization: '', age: '' },
    special: {
      sanLoss: { checkPassed: '0', checkFailled: '1D6' },
      attacksPerRound: '1',
      movement: [{ value: 8, type: 'swim' }],
    },
  },
  items: [],
};

/** An NPC in source-style data: derived attributes are still null. */
const cultist: any = {
  name: 'Robed Cultist',
  type: 'npc',
  system: {
    characteristics: {
      str: { value: 70 },
      con: { value: 55 },
      siz: { value: 65 },
      dex: { value: 50 },
      app: { value: 40 },
      int: { value: 50 },
      pow: { value: 45 },
      edu: { value: 40 },
    },
    attribs: {
      hp: { value: null, max: null, auto: true },
      mp: { value: null, max: null, auto: true },
      lck: { value: null },
      san: { value: 0, max: 99, dailyLoss: 0, dailyLimit: 0, auto: true },
      mov: { value: null, auto: true, type: 'walk' },
      db: { value: null, auto: true },
      build: { value: null, auto: true },
      armor: { notes: false, value: '1' },
    },
    infos: { type: 'Human', occupation: 'Cultist', organization: 'Order of the Stone', age: '' },
    special: {
      sanLoss: { checkPassed: null, checkFailled: null },
      attacksPerRound: '1',
    },
  },
  items: [
    {
      id: 'skillBrawl000001',
      type: 'skill',
      name: 'Fighting (Brawl)',
      system: { base: '25', adjustments: { base: 25, personal: 30 } },
    },
    {
      id: 'weaponKnife00001',
      type: 'weapon',
      name: 'Ritual Knife',
      system: {
        // Linked by name only: the id points at an item this actor does not own.
        skill: { main: { name: 'fighting (brawl)', id: 'unknownSkillId00' } },
        range: { normal: { value: '', damage: '1D4+2' } },
        properties: { rngd: false, addb: true, ahdb: false },
      },
    },
  ],
};

describe('CoC7IndexBuilder.extractCreatureData', () => {
  const builder = new CoC7IndexBuilder();
  const pack = { metadata: { id: 'CoC7.examples', label: 'Examples' } };

  it('identifies as the coc7 builder', () => {
    expect(builder.getSystemId()).toBe('coc7');
  });

  it('indexes a creature from its document', () => {
    const doc = { _id: 'deep1', img: 'deep.svg', ...deepOne };
    const result = builder.extractCreatureData(doc, pack);
    expect(result?.errors).toBe(0);
    expect(result?.creature).toEqual({
      id: 'deep1',
      name: 'Deep One',
      type: 'creature',
      packName: 'CoC7.examples',
      packLabel: 'Examples',
      img: 'deep.svg',
      system: 'coc7',
      systemData: {
        creatureType: 'Mythos servitor',
        hitPoints: 13,
        magicPoints: 10,
        build: 2,
        damageBonus: '1D6',
        sanityLoss: '0/1D6',
        hasSpells: false,
        characteristics: { str: 90, con: 50, siz: 80, dex: 50, int: 65, pow: 50 },
      },
    });
  });

  it('derives attributes for source data and reads items from a Foundry collection', () => {
    // Foundry exposes embedded items as a Map-like collection, not an array.
    const items = new Map<string, any>([
      ['s1', { type: 'spell', name: 'Shrivelling' }],
      ['w1', { type: 'weapon', name: 'Knife' }],
    ]);
    const doc = { _id: 'cult1', ...cultist, items };
    const result = builder.extractCreatureData(doc, pack);
    expect(result?.creature.systemData).toMatchObject({
      creatureType: 'Human',
      occupation: 'Cultist',
      hitPoints: 12,
      magicPoints: 9,
      build: 1,
      damageBonus: '1D4',
      hasSpells: true,
    });
    expect(result?.creature.systemData.sanityLoss).toBeUndefined();
  });

  it('skips containers and vehicles when reading a pack', async () => {
    const docs = [
      { _id: 'a', name: 'Trunk', type: 'container', system: {} },
      { _id: 'b', name: 'Model T', type: 'vehicle', system: {} },
      { _id: 'c', img: 'deep.svg', ...deepOne },
    ];
    const result = await builder.extractDataFromPack({
      ...pack,
      getDocuments: () => Promise.resolve(docs),
    });
    expect(result.errors).toBe(0);
    expect(result.creatures.map(c => c.name)).toEqual(['Deep One']);
  });

  it('counts a pack that fails to load as an error instead of throwing', async () => {
    const result = await builder.extractDataFromPack({
      ...pack,
      getDocuments: () => Promise.reject(new Error('pack locked')),
    });
    expect(result).toEqual({ creatures: [], errors: 1 });
  });
});
