import { describe, expect, it } from 'vitest';
import {
  encodeMonoPcm16Wav,
  mixChannelsToMono,
  resampleAudio,
} from '../../lib/ai/browser-audio';

describe('browser audio conversion', () => {
  it('encodes mono PCM samples as a valid little-endian WAV file', async () => {
    const wav = encodeMonoPcm16Wav(
      new Float32Array([-1, -0.5, 0, 0.5, 1]),
      16_000
    );
    const view = new DataView(await wav.arrayBuffer());
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(
        ...Array.from({ length }, (_, index) => view.getUint8(offset + index))
      );

    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBe(54);
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44, true)).toBe(-32_768);
    expect(view.getInt16(52, true)).toBe(32_767);
  });

  it('rejects empty or invalid PCM input', () => {
    expect(() => encodeMonoPcm16Wav(new Float32Array(), 16_000)).toThrow(
      'usable audio'
    );
    expect(() => encodeMonoPcm16Wav(new Float32Array([0]), 0)).toThrow(
      'usable audio'
    );
  });

  it('mixes multiple equal-length channels to mono', () => {
    expect(
      Array.from(mixChannelsToMono([
        new Float32Array([1, -1]),
        new Float32Array([-1, 1]),
      ]))
    ).toEqual([0, 0]);
    expect(() => mixChannelsToMono([])).toThrow('usable audio');
    expect(() => mixChannelsToMono([
      new Float32Array([1]),
      new Float32Array([1, 2]),
    ])).toThrow('inconsistent');
  });

  it('resamples both higher and lower source rates to the target length', () => {
    const downsampled = resampleAudio(
      new Float32Array([0, 1, 0, -1]),
      32_000,
      16_000
    );
    const upsampled = resampleAudio(
      new Float32Array([0, 1]),
      8_000,
      16_000
    );

    expect(Array.from(downsampled)).toEqual([0, 0]);
    expect(Array.from(upsampled)).toEqual([0, 0.5, 1, 1]);
    expect(() => resampleAudio(new Float32Array(), 16_000, 16_000)).toThrow(
      'usable audio'
    );
  });
});
