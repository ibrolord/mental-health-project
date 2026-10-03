import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const requireRoot = createRequire(path.resolve('package.json'));
const icon = readFileSync(path.resolve('public/icon.png'));

describe('patched image runtime compatibility', () => {
  it('loads the same Sharp implementation through Next and ESM', async () => {
    const { getSharp } = requireRoot('next/dist/server/image-optimizer');
    const nextSharp: typeof sharp = getSharp();
    expect(nextSharp.versions.sharp).toBe(sharp.versions.sharp);
    const output = await nextSharp(icon).resize(42, 42).webp().toBuffer();
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: 42,
      height: 42,
      format: 'webp',
    });
  });

  it('preserves the resize, modulation, and compositing used for brand assets', async () => {
    const overlay = Buffer.from('<svg width="8" height="8"><rect width="8" height="8" fill="#fff"/></svg>');
    const output = await sharp(icon)
      .resize(64, 64)
      .modulate({ saturation: 0.8 })
      .composite([{ input: overlay, gravity: 'southeast' }])
      .png()
      .toBuffer();
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: 64,
      height: 64,
      format: 'png',
    });
  });
});
