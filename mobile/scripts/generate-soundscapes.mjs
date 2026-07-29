import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22_050;
const durationSeconds = 8;
const sampleCount = sampleRate * durationSeconds;
const outputDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../assets/audio'
);

mkdirSync(outputDir, { recursive: true });

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0xffffffff;
  };
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  });
  return buffer;
}

function fadeLoop(samples) {
  const fadeSamples = Math.floor(sampleRate * 0.8);
  for (let index = 0; index < fadeSamples; index += 1) {
    const mix = index / fadeSamples;
    const tailIndex = samples.length - fadeSamples + index;
    const start = samples[index];
    const tail = samples[tailIndex];
    samples[index] = start * mix + tail * (1 - mix);
    samples[tailIndex] = tail * mix + start * (1 - mix);
  }
  return samples;
}

function brownNoise() {
  const random = randomGenerator(0x14ca8f);
  const samples = new Float32Array(sampleCount);
  let brown = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const white = random() * 2 - 1;
    brown = (brown + white * 0.02) / 1.02;
    samples[index] = brown * 2.7;
  }
  return fadeLoop(samples);
}

function rainTexture() {
  const random = randomGenerator(0x72a11);
  const samples = new Float32Array(sampleCount);
  let previous = 0;
  let wash = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const white = random() * 2 - 1;
    const high = white - previous * 0.91;
    previous = white;
    wash = wash * 0.96 + high * 0.04;
    const drop = random() > 0.998 ? (random() * 2 - 1) * 0.32 : 0;
    samples[index] = wash * 0.42 + drop;
  }
  return fadeLoop(samples);
}

function slowTide() {
  const random = randomGenerator(0x0cea7);
  const samples = new Float32Array(sampleCount);
  let low = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    low = low * 0.985 + (random() * 2 - 1) * 0.015;
    const seconds = index / sampleRate;
    const swell = 0.38 + 0.28 * Math.sin((seconds / durationSeconds) * Math.PI * 2);
    samples[index] = low * swell;
  }
  return fadeLoop(samples);
}

const soundscapes = [
  ['brown-noise.wav', brownNoise()],
  ['soft-rain.wav', rainTexture()],
  ['slow-tide.wav', slowTide()],
];

for (const [filename, samples] of soundscapes) {
  writeFileSync(resolve(outputDir, filename), wavBuffer(samples));
}

console.log(`Generated ${soundscapes.length} deterministic soundscapes in ${outputDir}`);
