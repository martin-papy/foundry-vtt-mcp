/**
 * CoC7 Adapter Tests
 *
 * Validates character-stat extraction against representative Call of Cthulhu
 * 7th Edition actors: an investigator with system-derived attributes (as the
 * Foundry module sends a live actor), an NPC with source-style data (derived
 * values still null, exercising the fallback rules), an NPC whose
 * characteristics are still dice formulas, and a creature. Also covers adapter
 * metadata and creature formatting.
 */

import { describe, it, expect } from 'vitest';
import { CoC7Adapter } from './adapter.js';
import { SystemRegistry } from '../system-registry.js';

/**
 * Investigator as read from a live world: `attribs` already carry the values
 * the system derives in prepareBaseData (hp.max, mp.max, db, build, mov).
 */
const investigator: any = {
  name: 'Eleanor Marsh',
  type: 'character',
  system: {
    characteristics: {
      str: { formula: '', value: 40 },
      con: { formula: '', value: 50 },
      siz: { formula: '', value: 60 },
      dex: { formula: '', value: 55 },
      app: { formula: '', value: 65 },
      int: { formula: '', value: 85 },
      pow: { formula: '', value: 60 },
      edu: { formula: '', value: 80 },
    },
    attribs: {
      hp: { value: 9, max: 11, auto: true },
      mp: { value: 12, max: 12, auto: true },
      lck: { value: 45 },
      san: { value: 52, max: 94, dailyLoss: 3, dailyLimit: 10, auto: true },
      mov: { value: 6, auto: true, type: 'walk' },
      db: { value: '0', auto: true },
      build: { value: 0, auto: true },
      armor: { notes: false, value: null },
    },
    conditions: {
      criticalWounds: { value: false },
      unconscious: { value: false },
      dying: { value: false },
      dead: { value: false },
      prone: { value: true },
      tempoInsane: { value: true, realTime: false, duration: 4 },
      indefInsane: { value: false },
    },
    infos: {
      occupation: 'Librarian',
      age: '42',
      sex: 'F',
      residence: 'Arkham',
      birthplace: 'Boston',
      archetype: '',
      organization: '',
      playername: 'Sam',
    },
  },
  items: [
    {
      id: 'skillSpotHidden01',
      type: 'skill',
      name: 'Spot Hidden',
      system: {
        base: '25',
        adjustments: {
          base: 25,
          personal: 10,
          occupation: 30,
          archetype: 0,
          experiencePackage: 0,
          experience: 5,
        },
        flags: { occupation: true },
      },
    },
    {
      id: 'skillLibraryUse01',
      type: 'skill',
      name: 'Library Use',
      system: {
        base: '20',
        adjustments: {
          base: 20,
          personal: 0,
          occupation: 50,
          archetype: 0,
          experiencePackage: 0,
          experience: 0,
        },
        flags: { occupation: true },
      },
    },
    {
      id: 'skillHandgun0001',
      type: 'skill',
      name: 'Firearms (Handgun)',
      system: {
        base: '20',
        adjustments: {
          base: 20,
          personal: 20,
          occupation: 0,
          archetype: 0,
          experiencePackage: 0,
          experience: 0,
        },
        flags: { occupation: false },
      },
    },
    {
      id: 'weaponRevolver01',
      type: 'weapon',
      name: '.38 Revolver',
      system: {
        skill: { main: { name: 'Firearms (Handgun)', id: 'skillHandgun0001' } },
        range: { normal: { value: '15 yards', damage: '1D10' } },
        usesPerRound: { normal: '1', max: '3', burst: null },
        properties: { rngd: true, addb: false, ahdb: false },
      },
    },
    {
      id: 'spellElderSign01',
      type: 'spell',
      name: 'Elder Sign',
      system: { costs: { magicPoints: '10', sanity: '1D6' } },
    },
    { id: 'itemLantern00001', type: 'item', name: 'Lantern', system: { quantity: 1 } },
  ],
};

/**
 * NPC in source-style data (e.g. read from a compendium): auto-calculated
 * attributes are still null, so the adapter must apply the rulebook formulas.
 */
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

describe('CoC7Adapter registration', () => {
  it('is found by the registry under the lower-cased and the raw Foundry id', () => {
    const registry = new SystemRegistry();
    registry.register(new CoC7Adapter());

    expect(registry.getAdapter('coc7')).toBeInstanceOf(CoC7Adapter);
    expect(registry.getAdapter('CoC7')).toBeInstanceOf(CoC7Adapter);
  });
});

describe('CoC7Adapter metadata', () => {
  const adapter = new CoC7Adapter();

  it('identifies as coc7 and handles the mixed-case Foundry system id', () => {
    expect(adapter.getMetadata().id).toBe('coc7');
    expect(adapter.canHandle('CoC7')).toBe(true);
    expect(adapter.canHandle('coc7')).toBe(true);
    expect(adapter.canHandle('dnd5e')).toBe(false);
  });

  it('reports character-focused feature support', () => {
    const features = adapter.getMetadata().supportedFeatures;
    expect(features.characterStats).toBe(true);
    expect(features.spellcasting).toBe(true);
    expect(features.creatureIndex).toBe(false);
    expect(features.powerLevel).toBe(false);
  });

  it('has no power-level metric', () => {
    expect(adapter.getPowerLevel({} as any)).toBeUndefined();
  });
});

describe('CoC7Adapter.extractCharacterStats (investigator, derived data)', () => {
  const stats = new CoC7Adapter().extractCharacterStats(investigator);

  it('keeps identifying info', () => {
    expect(stats.name).toBe('Eleanor Marsh');
    expect(stats.type).toBe('character');
  });

  it('lists the eight characteristics in sheet order with their names', () => {
    expect(Object.keys(stats.characteristics)).toEqual([
      'STR',
      'CON',
      'SIZ',
      'DEX',
      'APP',
      'INT',
      'POW',
      'EDU',
    ]);
    expect(stats.characteristics.INT).toEqual({ value: 85, name: 'Intelligence' });
  });

  it('extracts hit points, magic points, sanity and luck', () => {
    expect(stats.hitPoints).toEqual({ value: 9, max: 11 });
    expect(stats.magicPoints).toEqual({ value: 12, max: 12 });
    expect(stats.sanity).toEqual({ value: 52, max: 94, dailyLoss: 3 });
    expect(stats.luck).toBe(45);
  });

  it('uses the system-derived movement, damage bonus and build verbatim', () => {
    expect(stats.movement).toBe(6);
    expect(stats.damageBonus).toBe('0');
    expect(stats.build).toBe(0);
  });

  it('omits armor when none is set', () => {
    expect(stats.armor).toBeUndefined();
  });

  it('lists only the active conditions', () => {
    expect(stats.conditions).toEqual(['prone', 'tempoInsane']);
  });

  it('extracts identity, skipping empty fields', () => {
    expect(stats.identity).toEqual({
      occupation: 'Librarian',
      age: '42',
      sex: 'F',
      residence: 'Arkham',
      birthplace: 'Boston',
      playerName: 'Sam',
    });
  });

  it('reports each skill as the sum of its adjustments, sorted by name', () => {
    expect(stats.skills).toEqual([
      { name: 'Firearms (Handgun)', value: 40 },
      { name: 'Library Use', value: 70, occupational: true },
      { name: 'Spot Hidden', value: 70, occupational: true },
    ]);
  });

  it('describes weapons with the value of the skill they use', () => {
    expect(stats.weapons).toEqual([
      {
        name: '.38 Revolver',
        skill: 'Firearms (Handgun)',
        skillValue: 40,
        damage: '1D10',
        range: '15 yards',
        ranged: true,
      },
    ]);
  });

  it('lists known spells', () => {
    expect(stats.spellcasting).toEqual({ hasSpells: true, spells: ['Elder Sign'] });
  });

  it('does not report NPC-only fields on an investigator', () => {
    expect(stats.sanityLoss).toBeUndefined();
    expect(stats.attacksPerRound).toBeUndefined();
  });
});

describe('CoC7Adapter.extractCharacterStats (NPC, source data)', () => {
  const stats = new CoC7Adapter().extractCharacterStats(cultist);

  it('derives hit points and magic points when the system has not', () => {
    // floor((CON 55 + SIZ 65) / 10) = 12; floor(POW 45 / 5) = 9
    expect(stats.hitPoints).toEqual({ value: 12, max: 12 });
    expect(stats.magicPoints).toEqual({ value: 9, max: 9 });
  });

  it('derives damage bonus and build from STR + SIZ (135)', () => {
    expect(stats.damageBonus).toBe('1D4');
    expect(stats.build).toBe(1);
  });

  it('leaves movement out rather than guessing it', () => {
    expect(stats.movement).toBeUndefined();
  });

  it('omits luck when the actor has none', () => {
    expect(stats.luck).toBeUndefined();
  });

  it('reports armor and NPC identity', () => {
    expect(stats.armor).toBe('1');
    expect(stats.identity).toEqual({
      occupation: 'Cultist',
      organization: 'Order of the Stone',
      creatureType: 'Human',
    });
  });

  it('resolves a weapon skill by name when the linked id is not on the actor', () => {
    expect(stats.weapons).toEqual([
      {
        name: 'Ritual Knife',
        skill: 'fighting (brawl)',
        skillValue: 55,
        damage: '1D4+2',
        addsDamageBonus: 'full',
      },
    ]);
  });

  it('reports attacks per round but no sanity loss when none is defined', () => {
    expect(stats.attacksPerRound).toBe('1');
    expect(stats.sanityLoss).toBeUndefined();
  });

  it('reports no conditions or spellcasting when there are none', () => {
    expect(stats.conditions).toBeUndefined();
    expect(stats.spellcasting).toBeUndefined();
  });
});

describe('CoC7Adapter.extractCharacterStats (creature)', () => {
  const stats = new CoC7Adapter().extractCharacterStats(deepOne);

  it('skips characteristics the creature does not have', () => {
    expect(Object.keys(stats.characteristics)).toEqual(['STR', 'CON', 'SIZ', 'DEX', 'INT', 'POW']);
  });

  it('omits sanity when the creature has no sanity value', () => {
    expect(stats.sanity).toBeUndefined();
  });

  it('reports the sanity loss for encountering it as passed/failed', () => {
    expect(stats.sanityLoss).toBe('0/1D6');
  });

  it('reports creature type, build and extra movement modes', () => {
    expect(stats.identity).toEqual({ creatureType: 'Mythos servitor' });
    expect(stats.build).toBe(2);
    expect(stats.damageBonus).toBe('1D6');
    expect(stats.movement).toBe(8);
    expect(stats.otherMovement).toEqual([{ type: 'swim', value: 8 }]);
  });

  it('has no skills or weapons entries when the actor owns none', () => {
    expect(stats.skills).toBeUndefined();
    expect(stats.weapons).toBeUndefined();
  });
});

describe('CoC7Adapter.extractCharacterStats (unrolled NPC)', () => {
  /**
   * Shaped like the "Goon" in the system's own Examples compendium: the
   * characteristics are dice formulas the system rolls when a token is placed,
   * and the weapon links to its skill by id only, with no skill name stored.
   */
  const goon: any = {
    name: 'Goon',
    type: 'npc',
    system: {
      characteristics: {
        str: { formula: '5*2d6+6' },
        con: { formula: '5*3d6' },
        siz: { formula: '5*3d6', value: null },
        dex: { formula: '5*3d6' },
        app: { formula: '' },
        int: { formula: '5*1d6', value: 30 },
        // The system's examples store "0" for a characteristic the actor lacks.
        pow: { formula: '0' },
        edu: { formula: '0', value: null },
      },
      // What a live actor carries before its characteristics are rolled: the
      // system derives the automatic attributes counting each missing
      // characteristic as 0.
      attribs: {
        hp: { value: 0, max: 0, auto: true },
        mp: { value: 0, max: 0, auto: true },
        mov: { value: 8, auto: true, type: 'walk' },
        db: { value: '-2', auto: true },
        build: { value: -2, auto: true },
        armor: { value: 0 },
      },
    },
    items: [
      {
        _id: 'PR4ptRvBvRso7GLJ',
        type: 'skill',
        name: 'Fighting (Brawl)',
        system: { base: '25', adjustments: { base: 25 } },
      },
      {
        _id: 'weaponClub000001',
        type: 'weapon',
        name: 'Club',
        system: {
          skill: { main: { id: 'PR4ptRvBvRso7GLJ' } },
          range: { normal: { damage: '1D4' } },
          properties: { ahdb: true },
        },
      },
    ],
  };
  const stats = new CoC7Adapter().extractCharacterStats(goon);

  it('reports the formula of a characteristic that has not been rolled', () => {
    expect(stats.characteristics.STR).toEqual({ formula: '5*2d6+6', name: 'Strength' });
    expect(stats.characteristics.SIZ).toEqual({ formula: '5*3d6', name: 'Size' });
  });

  it('prefers the rolled value over the formula', () => {
    expect(stats.characteristics.INT).toEqual({ value: 30, name: 'Intelligence' });
  });

  it('leaves out a characteristic with neither a value nor a formula', () => {
    expect(Object.keys(stats.characteristics)).toEqual(['STR', 'CON', 'SIZ', 'DEX', 'INT']);
  });

  it('leaves out a characteristic whose formula is a plain number', () => {
    expect(stats.characteristics.POW).toBeUndefined();
    expect(stats.characteristics.EDU).toBeUndefined();
  });

  it('does not report attributes the system derived from unrolled characteristics', () => {
    expect(stats.hitPoints).toBeUndefined();
    expect(stats.magicPoints).toBeUndefined();
    expect(stats.damageBonus).toBeUndefined();
    expect(stats.build).toBeUndefined();
    expect(stats.movement).toBeUndefined();
  });

  it('reports no hit points in basicInfo either', () => {
    expect(new CoC7Adapter().extractBasicInfo(goon)).toEqual({});
  });

  it('names the skill a weapon links to by id when the weapon stores no skill name', () => {
    expect(stats.weapons).toEqual([
      {
        name: 'Club',
        skill: 'Fighting (Brawl)',
        skillValue: 25,
        damage: '1D4',
        addsDamageBonus: 'half',
      },
    ]);
  });

  it('reports a numeric armor value as text', () => {
    expect(stats.armor).toBe('0');
  });

  it('does not show an unresolved CoC id as a weapon skill name', () => {
    // A weapon can reference its skill by CoC id ("i.skill.dodge"); item flags
    // are not sent, so the id cannot be matched to an owned skill here.
    const armed = {
      name: 'Guard',
      type: 'npc',
      system: {},
      items: [
        {
          id: 'w1',
          type: 'weapon',
          name: 'Pistol',
          system: {
            skill: { main: { name: 'i.skill.firearms-handgun', id: '' } },
            range: { normal: { damage: '1D8' } },
          },
        },
      ],
    };
    expect(new CoC7Adapter().extractCharacterStats(armed).weapons).toEqual([
      { name: 'Pistol', damage: '1D8' },
    ]);
  });
});

describe('CoC7Adapter.extractCharacterStats (robustness)', () => {
  const adapter = new CoC7Adapter();

  it('copes with an actor that has no system data or items', () => {
    expect(adapter.extractCharacterStats({ name: 'Blank', type: 'npc' })).toEqual({
      name: 'Blank',
      type: 'npc',
    });
  });

  it('skips containers and vehicles gracefully', () => {
    const stats = adapter.extractCharacterStats({
      name: 'Steamer Trunk',
      type: 'container',
      system: { description: { value: '<p>Heavy.</p>' } },
      items: [{ id: 'a', type: 'item', name: 'Rope', system: {} }],
    });
    expect(stats).toEqual({ name: 'Steamer Trunk', type: 'container' });
  });
});

describe('CoC7Adapter.extractBasicInfo', () => {
  const adapter = new CoC7Adapter();

  it('maps hit points and movement for a live actor', () => {
    expect(adapter.extractBasicInfo(investigator)).toEqual({
      hitPoints: { current: 9, max: 11 },
      movement: 6,
    });
  });

  it('derives hit points for source data and leaves movement out', () => {
    expect(adapter.extractBasicInfo(cultist)).toEqual({ hitPoints: { current: 12, max: 12 } });
  });

  it('does not invent an armour class (CoC7 has none)', () => {
    expect(adapter.extractBasicInfo(investigator).armorClass).toBeUndefined();
  });
});

describe('CoC7Adapter.describeActorSchema', () => {
  const notes = new CoC7Adapter().describeActorSchema();

  it('names the actor types and the key data paths', () => {
    expect(notes).toContain('character, npc, creature, container, vehicle');
    expect(notes).toContain('system.characteristics');
    expect(notes).toContain('system.attribs');
    expect(notes).toContain('system.adjustments');
  });

  it('says which attributes the system does not derive', () => {
    expect(notes).toContain('san.value and lck.value are NOT derived');
  });
});

describe('CoC7Adapter creature formatting', () => {
  const adapter = new CoC7Adapter();
  const indexed: any = {
    id: 'abc',
    name: 'Deep One',
    type: 'creature',
    packName: 'CoC7.examples',
    packLabel: 'Examples',
    img: 'systems/CoC7/assets/icons/deep-one.svg',
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
  };

  it('formats a compact list entry', () => {
    expect(adapter.formatCreatureForList(indexed)).toEqual({
      id: 'abc',
      name: 'Deep One',
      type: 'creature',
      pack: { id: 'CoC7.examples', label: 'Examples' },
      stats: {
        creatureType: 'Mythos servitor',
        hitPoints: 13,
        build: 2,
        damageBonus: '1D6',
        sanityLoss: '0/1D6',
      },
      hasImage: true,
    });
  });

  it('adds the full snapshot to the detailed entry', () => {
    const details = adapter.formatCreatureForDetails(indexed);
    expect(details.detailedStats).toEqual(indexed.systemData);
    expect(details.img).toBe('systems/CoC7/assets/icons/deep-one.svg');
  });

  it('refuses to extract creature data outside the index builder', () => {
    expect(() => adapter.extractCreatureData({}, {})).toThrow(/CoC7IndexBuilder/);
  });
});
