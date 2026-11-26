/**
 * CoC7 Index Builder
 *
 * Builds a basic creature index from Foundry compendiums. Runs in Foundry's
 * browser context (not Node.js).
 *
 * This adapter is character-focused, so the creature index is intentionally
 * lightweight (type, occupation, hit points, build, sanity loss, spellcaster
 * flag). It follows the wfrp4e / dsa5 IndexBuilder structure for consistency.
 */

import type { IndexBuilder, CoC7CreatureIndex } from '../types.js';
import { ITEM_TYPES, STATTED_ACTOR_TYPES } from './constants.js';
import {
  characteristicValues,
  formatSanityLoss,
  resolveBuild,
  resolveDamageBonus,
  resolveHitPoints,
  resolveMagicPoints,
  toText,
} from './rules.js';

// Foundry browser global (unavailable during Node.js TypeScript compilation)
declare const ui: any;

interface CoC7ExtractionResult {
  creature: CoC7CreatureIndex;
  errors: number;
}

/**
 * CoC7 implementation of IndexBuilder.
 */
export class CoC7IndexBuilder implements IndexBuilder {
  private moduleId: string;

  constructor(moduleId: string = 'foundry-mcp-bridge') {
    this.moduleId = moduleId;
  }

  getSystemId() {
    return 'coc7' as const;
  }

  async buildIndex(packs: any[], _force = false): Promise<CoC7CreatureIndex[]> {
    const startTime = Date.now();
    let totalErrors = 0;

    const actorPacks = packs.filter(pack => pack.metadata.type === 'Actor');
    const creatures: CoC7CreatureIndex[] = [];

    console.log(
      `[${this.moduleId}] Building CoC7 creature index from ${actorPacks.length} packs...`
    );

    for (const pack of actorPacks) {
      try {
        if (!pack.indexed) {
          await pack.getIndex({});
        }
        const packResult = await this.extractDataFromPack(pack);
        creatures.push(...packResult.creatures);
        totalErrors += packResult.errors;
      } catch (error) {
        console.warn(`[${this.moduleId}] Failed to process pack ${pack.metadata.label}:`, error);
        if (typeof ui !== 'undefined' && ui.notifications) {
          ui.notifications.warn(`Warning: failed to index "${pack.metadata.label}" - continuing`);
        }
      }
    }

    const seconds = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `[${this.moduleId}] CoC7 creature index complete: ${creatures.length} creatures from ` +
        `${actorPacks.length} packs in ${seconds}s${
          totalErrors > 0 ? ` (${totalErrors} extraction errors)` : ''
        }`
    );

    return creatures;
  }

  async extractDataFromPack(
    pack: any
  ): Promise<{ creatures: CoC7CreatureIndex[]; errors: number }> {
    const creatures: CoC7CreatureIndex[] = [];
    let errors = 0;

    try {
      const documents = await pack.getDocuments();
      for (const doc of documents) {
        try {
          // Containers and vehicles have no characteristics to index.
          if (!STATTED_ACTOR_TYPES.includes(doc.type)) {
            continue;
          }
          const result = this.extractCreatureData(doc, pack);
          if (result) {
            creatures.push(result.creature);
            errors += result.errors;
          }
        } catch (error) {
          console.warn(
            `[${this.moduleId}] Failed to extract CoC7 data from ${doc.name} in ${pack.metadata.label}:`,
            error
          );
          errors++;
        }
      }
    } catch (error) {
      console.warn(
        `[${this.moduleId}] Failed to load documents from ${pack.metadata.label}:`,
        error
      );
      errors++;
    }

    return { creatures, errors };
  }

  extractCreatureData(doc: any, pack: any): CoC7ExtractionResult | null {
    try {
      const system = doc.system || {};
      const items: any[] = Array.from(doc.items?.values?.() ?? doc.items ?? []);

      const creatureType = toText(system.infos?.type);
      const occupation = toText(system.infos?.occupation);
      const hitPoints = resolveHitPoints(system)?.max;
      const magicPoints = resolveMagicPoints(system)?.max;
      const build = resolveBuild(system);
      const damageBonus = resolveDamageBonus(system);
      const sanityLoss = formatSanityLoss(system);
      const characteristics = characteristicValues(system.characteristics);

      // Build systemData omitting undefined keys (exactOptionalPropertyTypes).
      const systemData: CoC7CreatureIndex['systemData'] = {
        hasSpells: items.some(item => item?.type === ITEM_TYPES.SPELL),
      };
      if (creatureType !== undefined) systemData.creatureType = creatureType;
      if (occupation !== undefined) systemData.occupation = occupation;
      if (hitPoints !== undefined) systemData.hitPoints = hitPoints;
      if (magicPoints !== undefined) systemData.magicPoints = magicPoints;
      if (build !== undefined) systemData.build = build;
      if (damageBonus !== undefined) systemData.damageBonus = damageBonus;
      if (sanityLoss !== undefined) systemData.sanityLoss = sanityLoss;
      if (Object.keys(characteristics).length > 0) systemData.characteristics = characteristics;

      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          packName: pack.metadata.id,
          packLabel: pack.metadata.label,
          img: doc.img,
          system: 'coc7',
          systemData,
        },
        errors: 0,
      };
    } catch (error) {
      console.warn(`[${this.moduleId}] Failed to extract CoC7 data from ${doc.name}:`, error);
      return {
        creature: {
          id: doc._id,
          name: doc.name,
          type: doc.type,
          packName: pack.metadata.id,
          packLabel: pack.metadata.label,
          img: doc.img,
          system: 'coc7',
          systemData: { hasSpells: false },
        },
        errors: 1,
      };
    }
  }
}
