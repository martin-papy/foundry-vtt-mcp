import { beforeEach, describe, expect, it } from 'vitest';
import { clearSystemCache, detectGameSystem, getCachedSystemId } from './system-detection.js';

/** A FoundryClient stand-in that answers getWorldInfo with the given system. */
function clientReporting(system: unknown): any {
  return { query: () => Promise.resolve({ system }) };
}

describe('detectGameSystem', () => {
  beforeEach(() => {
    clearSystemCache();
  });

  it('detects Call of Cthulhu 7e from its mixed-case Foundry id', async () => {
    // Foundry v13+ reports the system as an object; the id is "CoC7".
    const detected = await detectGameSystem(clientReporting({ id: 'CoC7', version: '9.2' }));

    expect(detected).toBe('coc7');
    expect(getCachedSystemId()).toBe('coc7');
  });

  it('detects Call of Cthulhu 7e when the system is reported as a plain string', async () => {
    expect(await detectGameSystem(clientReporting('CoC7'))).toBe('coc7');
  });

  it('still reports an unknown system as other', async () => {
    expect(await detectGameSystem(clientReporting({ id: 'some-homebrew' }))).toBe('other');
  });

  it('does not cache a failed detection, so the next call retries', async () => {
    const failing: any = { query: () => Promise.reject(new Error('Foundry not connected')) };

    expect(await detectGameSystem(failing)).toBe('other');
    expect(await detectGameSystem(clientReporting({ id: 'CoC7' }))).toBe('coc7');
  });
});
