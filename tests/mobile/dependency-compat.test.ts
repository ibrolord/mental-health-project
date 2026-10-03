import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { patchedSource } from '../../mobile/scripts/apply-dependency-compat.mjs';

const mobile = path.resolve(process.cwd(), 'mobile');
const requireMobile = createRequire(path.join(mobile, 'package.json'));

describe('patched mobile dependency compatibility', () => {
  it('applies once, stays idempotent, and rejects missing or ambiguous source', () => {
    expect(patchedSource('before', 'before', 'after')).toBe('after');
    expect(patchedSource('after', 'before', 'after')).toBe('after');
    expect(() => patchedSource('unknown', 'before', 'after')).toThrow();
    expect(() => patchedSource('before before', 'before', 'after')).toThrow();
  });

  it('pins the patched parser releases without changing the native framework', () => {
    const lock = JSON.parse(readFileSync(path.join(mobile, 'package-lock.json'), 'utf8'));
    expect(lock.packages['node_modules/image-size'].version).toBe('2.0.4');
    expect(lock.packages['node_modules/decode-uri-component'].version).toBe('0.5.0');
    expect(lock.packages['node_modules/expo'].version).toBe('54.0.37');
    expect(lock.packages['node_modules/react-native'].version).toBe('0.81.5');
    expect(lock.packages['node_modules/expo-router'].version).toBe('6.0.24');
  });

  it('preserves query-string namespace exports and ordinary Unicode query round trips', () => {
    const query = requireMobile('query-string');
    const input = { next: '/journal', title: 'A calm day', emoji: '\u{1f642}' };
    expect(query.parse(query.stringify(input))).toEqual(input);
    expect(query.parse('tag=one&tag=two')).toEqual({ tag: ['one', 'two'] });
    expect(query.parseUrl('mhtoolkit://auth/callback?next=%2Fgoals').query).toEqual({ next: '/goals' });
  });

  it.each(['root', 'expo'] as const)('preserves %s Metro image asset dimensions from filenames and buffers', async (installation) => {
    const resolver = installation === 'root'
      ? requireMobile
      : createRequire(requireMobile.resolve('@expo/metro/package.json'));
    const metroRoot = path.dirname(resolver.resolve('metro/package.json'));
    const assets = requireMobile(path.join(metroRoot, 'src/Assets.js'));
    const icon = path.join(mobile, 'assets/icon.png');
    const data = await assets.getAssetData(icon, 'assets/icon.png', [], 'ios', '/assets');
    expect(data.width).toBeGreaterThan(0);
    expect(data.height).toBeGreaterThan(0);
    expect(assets.getAssetSize('png', readFileSync(icon), icon)).toMatchObject({ width: data.width, height: data.height });
  });
});
