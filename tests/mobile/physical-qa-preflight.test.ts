import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptUrl = pathToFileURL(
  resolve(process.cwd(), 'mobile/scripts/qa-physical-preflight.mjs')
).href;

describe('physical iOS QA preflight', () => {
  it('distinguishes available physical iPhones and iPads from simulators', async () => {
    const { evaluateDeviceInventory } = await import(scriptUrl);
    const inventory = evaluateDeviceInventory([
      {
        simulator: false,
        platform: 'com.apple.platform.iphoneos',
        modelName: 'iPhone 16 Pro Max',
        available: true,
      },
      {
        simulator: false,
        platform: 'com.apple.platform.iphoneos',
        modelName: 'iPad Pro',
        available: false,
      },
      {
        simulator: true,
        platform: 'com.apple.platform.iphonesimulator',
        modelName: 'iPad Pro',
        available: true,
      },
    ]);

    expect(inventory.availableIphones).toHaveLength(1);
    expect(inventory.ipads).toHaveLength(1);
    expect(inventory.availableIpads).toHaveLength(0);
  });

  it('requires all seven unique artifact-bound identity roles', async () => {
    const { REQUIRED_IDENTITY_ROLES, validateIdentityRoles } = await import(scriptUrl);
    const identities = REQUIRED_IDENTITY_ROLES.map((role: string, index: number) => ({
      id: `identity-${index}`,
      role,
    }));

    expect(validateIdentityRoles({ metadata: { identities } })).toEqual([]);
    expect(
      validateIdentityRoles({
        metadata: { identities: identities.slice(0, -1) },
      })
    ).toContain('Missing identity role revoked-partner.');
  });

  it('keeps TestFlight usable when Developer Mode prevents Xcode inspection', async () => {
    const { classifyInstalledAppInspection } = await import(scriptUrl);
    const result = {
      ok: false,
      code: 'developer-mode-disabled',
      reason: 'Developer Mode is disabled.',
    };

    expect(classifyInstalledAppInspection(result, 'TestFlight')).toMatchObject({
      blocker: false,
      manual: true,
    });
    expect(classifyInstalledAppInspection(result, 'Xcode')).toMatchObject({
      blocker: true,
      manual: false,
    });
  });
});
