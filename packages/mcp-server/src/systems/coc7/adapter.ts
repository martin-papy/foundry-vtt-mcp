/**
 * CoC7 System Adapter
 *
 * Character-focused SystemAdapter for Call of Cthulhu 7th Edition: extracts
 * investigator, NPC and creature stats so the get-character / list-characters
 * tools work against CoC7 worlds, and documents the actor schema for the
 * generic manage-actors tool. Creature indexing is minimal (Call of Cthulhu
 * has no Challenge Rating or level metric).
 */

import type {
  SystemAdapter,
  SystemMetadata,
  SystemCreatureIndex,
  CoC7CreatureIndex,
} from '../types.js';
import { CoC7FiltersSchema, matchesCoC7Filters, describeCoC7Filters } from './filters.js';
import {
  ACTOR_TYPES,
  CHARACTERISTIC_NAMES,
  CHARACTERISTIC_ORDER,
  CONDITION_KEYS,
  FIELD_PATHS,
  ITEM_TYPES,
  SKILL_ADJUSTMENT_KEYS,
  STATTED_ACTOR_TYPES,
} from './constants.js';
import {
  formatSanityLoss,
  resolveBuild,
  resolveDamageBonus,
  resolveHitPoints,
  resolveMagicPoints,
  resolveMovement,
  rollFormula,
  skillValue,
  toNumber,
  toText,
} from './rules.js';

/**
 * `system.infos` keys and the name each is reported under. `type` is the
 * free-text kind on NPC and creature sheets ("Human", "Mythos servitor").
 */
const IDENTITY_FIELDS: ReadonlyArray<[infosKey: string, reportedAs: string]> = [
  ['occupation', 'occupation'],
  ['age', 'age'],
  ['sex', 'sex'],
  ['residence', 'residence'],
  ['birthplace', 'birthplace'],
  ['archetype', 'archetype'],
  ['organization', 'organization'],
  ['playername', 'playerName'],
  ['type', 'creatureType'],
];

/** A CoC id reference to a skill, e.g. "i.skill.firearms-handgun". */
const COC_ID_REFERENCE = /^i\.skill\./;

/**
 * CoC7 system adapter.
 */
export class CoC7Adapter implements SystemAdapter {
  getMetadata(): SystemMetadata {
    return {
      id: 'coc7',
      name: 'coc7',
      displayName: 'Call of Cthulhu 7th Edition',
      version: '1.0.0',
      description:
        'Character-focused support for Call of Cthulhu 7th Edition: 8 characteristics, ' +
        'hit points, magic points, sanity, luck, damage bonus and build, skills, weapons ' +
        'and spells for investigators, NPCs and creatures.',
      supportedFeatures: {
        creatureIndex: false,
        characterStats: true,
        spellcasting: true,
        powerLevel: false, // Call of Cthulhu has no Challenge Rating / level metric
      },
    };
  }

  /**
   * Foundry registers the system as "CoC7"; compare case-insensitively.
   */
  canHandle(systemId: string): boolean {
    return systemId.toLowerCase() === 'coc7';
  }

  /**
   * Creature extraction runs in the Foundry browser context via the
   * IndexBuilder; the adapter only delegates (matches the dsa5 pattern).
   */
  extractCreatureData(
    _doc: any,
    _pack: any
  ): { creature: SystemCreatureIndex; errors: number } | null {
    throw new Error('extractCreatureData should be called from CoC7IndexBuilder, not the adapter');
  }

  getFilterSchema() {
    return CoC7FiltersSchema;
  }

  matchesFilters(creature: SystemCreatureIndex, filters: Record<string, any>): boolean {
    const validated = CoC7FiltersSchema.safeParse(filters);
    if (!validated.success) {
      return false;
    }
    return matchesCoC7Filters(creature, validated.data);
  }

  getDataPaths(): Record<string, string | null> {
    return {
      // CoC7-specific paths
      characteristics: FIELD_PATHS.CHARACTERISTICS,
      hitPoints: FIELD_PATHS.ATTRIBS_HP,
      magicPoints: FIELD_PATHS.ATTRIBS_MP,
      sanity: FIELD_PATHS.ATTRIBS_SAN,
      luck: FIELD_PATHS.ATTRIBS_LUCK,
      movement: FIELD_PATHS.ATTRIBS_MOV,
      damageBonus: FIELD_PATHS.ATTRIBS_DB,
      build: FIELD_PATHS.ATTRIBS_BUILD,
      armor: FIELD_PATHS.ATTRIBS_ARMOR,
      conditions: FIELD_PATHS.CONDITIONS,
      occupation: FIELD_PATHS.INFOS_OCCUPATION,
      creatureType: FIELD_PATHS.INFOS_TYPE,
      description: FIELD_PATHS.DESCRIPTION,
      keeperNotes: FIELD_PATHS.KEEPER_NOTES,

      // D&D5e / PF2e paths that do not exist in CoC7
      challengeRating: null,
      level: null,
      size: null,
      alignment: null,
      armorClass: null,
      legendaryActions: null,
      legendaryResistances: null,
      perception: null,
      saves: null,
      rarity: null,
    };
  }

  formatCreatureForList(creature: SystemCreatureIndex): any {
    const data = (creature as CoC7CreatureIndex).systemData;
    const formatted: any = {
      id: creature.id,
      name: creature.name,
      type: creature.type,
      pack: {
        id: creature.packName,
        label: creature.packLabel,
      },
    };

    if (data) {
      const stats: any = {};
      if (data.creatureType) stats.creatureType = data.creatureType;
      if (data.occupation) stats.occupation = data.occupation;
      if (data.hitPoints !== undefined) stats.hitPoints = data.hitPoints;
      if (data.build !== undefined) stats.build = data.build;
      if (data.damageBonus !== undefined) stats.damageBonus = data.damageBonus;
      if (data.sanityLoss) stats.sanityLoss = data.sanityLoss;
      if (data.hasSpells) stats.spellcaster = true;
      if (Object.keys(stats).length > 0) formatted.stats = stats;
    }

    if (creature.img) formatted.hasImage = true;

    return formatted;
  }

  formatCreatureForDetails(creature: SystemCreatureIndex): any {
    const data = (creature as CoC7CreatureIndex).systemData;
    const formatted = this.formatCreatureForList(creature);

    if (data) formatted.detailedStats = { ...data };
    if (creature.img) formatted.img = creature.img;

    return formatted;
  }

  describeFilters(filters: Record<string, any>): string {
    const validated = CoC7FiltersSchema.safeParse(filters);
    if (!validated.success) {
      return 'invalid filters';
    }
    return describeCoC7Filters(validated.data);
  }

  getPowerLevel(_creature: SystemCreatureIndex): number | undefined {
    // Call of Cthulhu has no Challenge Rating / level equivalent.
    return undefined;
  }

  /**
   * Extract character statistics from actor data.
   * Receives the full character object (system + items). Fields the actor
   * does not have are left out rather than reported as zero.
   */
  extractCharacterStats(actorData: any): any {
    const stats: any = { name: actorData.name, type: actorData.type };

    // Containers and vehicles carry no characteristics, attributes or skills.
    if (actorData.type && !STATTED_ACTOR_TYPES.includes(actorData.type)) {
      return stats;
    }

    const system = actorData.system || {};
    const items: any[] = Array.isArray(actorData.items) ? actorData.items : [];

    this.addCharacteristics(stats, system);
    this.addAttributes(stats, system);
    this.addConditions(stats, system);
    this.addIdentity(stats, system);

    if (actorData.type !== ACTOR_TYPES.CHARACTER) {
      this.addEncounterInfo(stats, system);
    }

    const skills = items.filter(item => item?.type === ITEM_TYPES.SKILL);
    this.addSkills(stats, skills);
    this.addWeapons(stats, items, skills);
    this.addSpells(stats, items);

    return stats;
  }

  /**
   * Seed the get-character `basicInfo` block with CoC7-native fields.
   * Call of Cthulhu has no armour class; armor is a damage reduction reported
   * with the stats instead.
   */
  extractBasicInfo(actorData: any): any {
    const system = actorData.system || {};
    const basicInfo: any = {};

    const hitPoints = resolveHitPoints(system);
    if (hitPoints) {
      basicInfo.hitPoints = { current: hitPoints.value, max: hitPoints.max };
    }

    const movement = resolveMovement(system);
    if (movement !== undefined) {
      basicInfo.movement = movement;
    }

    return basicInfo;
  }

  /**
   * Schema notes for the manage-actors "describe" action. Everything here is
   * read from the system's data models; nothing is normalised on the way in,
   * so the paths are the ones Foundry stores.
   */
  describeActorSchema(): string {
    return [
      '=== Call of Cthulhu 7e (CoC7) Actor Schema Reference ===',
      '',
      'ACTOR TYPES: character, npc, creature, container, vehicle',
      '  character = investigator; npc = human NPC; creature = monster or animal',
      '  (npc and creature share one data model). container and vehicle have no statistics.',
      '',
      'CHARACTERISTICS (character/npc/creature) — system.characteristics:',
      '  { str:{value:50}, con:{value:60}, siz:{value:65}, dex:{value:55},',
      '    app:{value:45}, int:{value:70}, pow:{value:50}, edu:{value:60} }',
      '  Percentile values (a human is roughly 15-90). Leave a value out for a',
      '  characteristic the creature does not have.',
      '  An npc/creature may give a dice formula instead, e.g. str:{formula:"5*3d6"}.',
      '  When a token is placed the system may roll or average every formula,',
      "  depending on the world's token-drop setting, replacing any value already",
      '  there: send a value OR a formula for a characteristic, not both.',
      '',
      'ATTRIBUTES — system.attribs:',
      '  hp:{value,max,auto}  mp:{value,max,auto}  san:{value,max,auto}  lck:{value}',
      '  mov:{value,auto}  db:{value,auto}  build:{value,auto}  armor:{value}',
      '  With auto:true (the default) the system derives hp.max, mp.max, mov, db and build',
      '  from the characteristics, so send the characteristics and leave those five out.',
      '  To force one of them, set it together with auto:false.',
      '  san.value and lck.value are NOT derived: set them yourself when they matter.',
      '  db and armor are strings ("1D4", "-1", "2").',
      '',
      'IDENTITY — system.infos (all strings):',
      '  character:     occupation, age, sex, residence, birthplace, archetype,',
      '                 organization, playername',
      '  npc/creature:  type, occupation, organization, age',
      '',
      'TEXT (HTML):',
      '  system.description.keeper                    Keeper-only notes (all actor types)',
      '  system.biography.personalDescription.value   description (npc/creature)',
      '',
      'NPC/CREATURE EXTRAS — system.special:',
      '  sanLoss:{checkPassed:"0", checkFailled:"1D6"}   sanity loss for encountering it',
      '      (the key really is spelled "checkFailled")',
      '  attacksPerRound:"1"',
      '  movement:[{value:8, type:"swim"}]               extra movement modes',
      '',
      'CONDITIONS — system.conditions.<key>.value (boolean):',
      `  ${CONDITION_KEYS.join(', ')}`,
      '',
      'SKILLS, WEAPONS, SPELLS AND POSSESSIONS ARE EMBEDDED ITEMS, not actor fields.',
      '  Create the actor first, then attach items with manage-world-items (add-to-actor).',
      `  Item types: ${Object.values(ITEM_TYPES).join(', ')}`,
      '',
      'SKILL ITEM (type "skill"):',
      '  name: "Spot Hidden", or "Specialization (Name)" for a specialised skill,',
      '    e.g. "Fighting (Brawl)", "Firearms (Handgun)", "Language (French)".',
      '  system.base: base chance as a string — a number ("25") or a formula over',
      '    characteristics ("@EDU", "1/2*@DEX").',
      `  system.adjustments: { ${SKILL_ADJUSTMENT_KEYS.join(', ')} } — the skill's value`,
      '    is the SUM of these. When a skill is added to an actor the system fills',
      '    adjustments.base from system.base, so put the points above base in',
      '    adjustments.personal (value = base + personal).',
      '  Avoid names ending in "(Any)": the system treats that as an unnamed',
      "    specialization and opens a dialog in the GM's browser.",
      '',
      'WEAPON ITEM (type "weapon"):',
      '  system.skill.main.name: name of the skill used, e.g. "Fighting (Brawl)"',
      '  system.range.normal: { value:"15 yards", damage:"1D10" }',
      '  system.usesPerRound: { normal:"1", max:"3" }   system.bullets, system.malfunction',
      '  system.properties (booleans): rngd (ranged), addb (add damage bonus),',
      '    ahdb (add half damage bonus), impl (impaling), thrown, shotgun, brst, auto',
    ].join('\n');
  }

  /**
   * Characteristics in sheet order. An NPC or creature may store a dice
   * formula instead of a value (the system can roll it when a token is
   * placed); the formula is reported until a value exists. A characteristic
   * with neither (a creature's APP or EDU) is left out.
   */
  private addCharacteristics(stats: any, system: any): void {
    const stored = system.characteristics || {};
    const characteristics: any = {};

    for (const key of CHARACTERISTIC_ORDER) {
      const value = toNumber(stored[key]?.value);
      const formula = rollFormula(stored[key]?.formula);
      if (value === undefined && formula === undefined) continue;

      const { short, name } = CHARACTERISTIC_NAMES[key];
      characteristics[short] = value !== undefined ? { value, name } : { formula, name };
    }

    if (Object.keys(characteristics).length > 0) stats.characteristics = characteristics;
  }

  /**
   * Hit points, magic points, sanity, luck, movement, damage bonus, build and
   * armor. Sanity and luck are reported as stored; the system derives neither.
   */
  private addAttributes(stats: any, system: any): void {
    const attribs = system.attribs || {};

    const hitPoints = resolveHitPoints(system);
    if (hitPoints) stats.hitPoints = hitPoints;

    const magicPoints = resolveMagicPoints(system);
    if (magicPoints) stats.magicPoints = magicPoints;

    // Creatures usually have no sanity score at all.
    const sanity = toNumber(attribs.san?.value);
    if (sanity !== undefined) {
      const max = toNumber(attribs.san?.max);
      const dailyLoss = toNumber(attribs.san?.dailyLoss);
      stats.sanity = {
        value: sanity,
        ...(max !== undefined && { max }),
        ...(dailyLoss !== undefined && dailyLoss > 0 && { dailyLoss }),
      };
    }

    const luck = toNumber(attribs.lck?.value);
    if (luck !== undefined) stats.luck = luck;

    const movement = resolveMovement(system);
    if (movement !== undefined) stats.movement = movement;

    const damageBonus = resolveDamageBonus(system);
    if (damageBonus !== undefined) stats.damageBonus = damageBonus;

    const build = resolveBuild(system);
    if (build !== undefined) stats.build = build;

    const armor = toText(attribs.armor?.value);
    if (armor !== undefined) stats.armor = armor;
  }

  private addConditions(stats: any, system: any): void {
    const conditions = system.conditions;
    if (!conditions) return;

    const active = CONDITION_KEYS.filter(key => conditions[key]?.value === true);
    if (active.length > 0) stats.conditions = active;
  }

  private addIdentity(stats: any, system: any): void {
    const infos = system.infos;
    if (!infos) return;

    const identity: any = {};
    for (const [infosKey, reportedAs] of IDENTITY_FIELDS) {
      const value = toText(infos[infosKey]);
      if (value !== undefined) identity[reportedAs] = value;
    }
    if (Object.keys(identity).length > 0) stats.identity = identity;
  }

  /**
   * NPC and creature fields a Keeper needs when one is encountered.
   */
  private addEncounterInfo(stats: any, system: any): void {
    const special = system.special;
    if (!special) return;

    const sanityLoss = formatSanityLoss(system);
    if (sanityLoss !== undefined) stats.sanityLoss = sanityLoss;

    const attacksPerRound = toText(special.attacksPerRound);
    if (attacksPerRound !== undefined) stats.attacksPerRound = attacksPerRound;

    const otherMovement = (Array.isArray(special.movement) ? special.movement : [])
      .map((entry: any) => ({ type: toText(entry?.type), value: toNumber(entry?.value) }))
      .filter((entry: any) => entry.type !== undefined && entry.value !== undefined);
    if (otherMovement.length > 0) stats.otherMovement = otherMovement;
  }

  private addSkills(stats: any, skills: any[]): void {
    if (skills.length === 0) return;

    stats.skills = skills
      .map(skill => {
        const value = skillValue(skill.system);
        return {
          name: String(skill.name ?? ''),
          ...(value !== undefined && { value }),
          ...(skill.system?.flags?.occupation === true && { occupational: true }),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private addWeapons(stats: any, items: any[], skills: any[]): void {
    const weapons = items.filter(item => item?.type === ITEM_TYPES.WEAPON);
    if (weapons.length === 0) return;

    stats.weapons = weapons
      .map(weapon => {
        const weaponSystem = weapon.system || {};
        const storedSkillName = this.readableSkillName(weaponSystem.skill?.main?.name);
        const skill = this.findWeaponSkill(skills, weaponSystem.skill?.main?.id, storedSkillName);
        // A weapon may link to its skill by id alone, storing no name.
        const skillName = storedSkillName ?? toText(skill?.name);
        const usedSkillValue = skill ? skillValue(skill.system) : undefined;
        const damage = toText(weaponSystem.range?.normal?.damage);
        const range = toText(weaponSystem.range?.normal?.value);
        const properties = weaponSystem.properties || {};
        const addsDamageBonus = properties.addb ? 'full' : properties.ahdb ? 'half' : undefined;

        return {
          name: String(weapon.name ?? ''),
          ...(skillName !== undefined && { skill: skillName }),
          ...(usedSkillValue !== undefined && { skillValue: usedSkillValue }),
          ...(damage !== undefined && { damage }),
          ...(range !== undefined && { range }),
          ...(properties.rngd === true && { ranged: true }),
          ...(addsDamageBonus !== undefined && { addsDamageBonus }),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * A weapon's stored skill name, unless it is a CoC id reference
   * ("i.skill.dodge"). The system resolves those through item flags, which
   * are not part of the data sent here, so the raw id is not shown as a name.
   */
  private readableSkillName(raw: unknown): string | undefined {
    const name = toText(raw);
    return name !== undefined && COC_ID_REFERENCE.test(name) ? undefined : name;
  }

  /**
   * The skill a weapon rolls against: the owned skill it links to by id, or
   * failing that the owned skill of the same name.
   */
  private findWeaponSkill(skills: any[], skillId: unknown, skillName: string | undefined): any {
    if (typeof skillId === 'string' && skillId !== '') {
      const byId = skills.find(skill => skill.id === skillId || skill._id === skillId);
      if (byId) return byId;
    }
    if (skillName === undefined) return undefined;

    const wanted = skillName.toLowerCase();
    return skills.find(skill => String(skill.name ?? '').toLowerCase() === wanted);
  }

  private addSpells(stats: any, items: any[]): void {
    const spells = items
      .filter(item => item?.type === ITEM_TYPES.SPELL)
      .map(item => String(item.name ?? ''))
      .sort((a, b) => a.localeCompare(b));

    if (spells.length > 0) stats.spellcasting = { hasSpells: true, spells };
  }
}
