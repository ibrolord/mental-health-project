import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sampleRate = 48_000;
const durationSeconds = 90;
const crossfadeSeconds = 6;
const sampleCount = sampleRate * durationSeconds;
const rawSampleCount = sampleCount + sampleRate * crossfadeSeconds;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileOutputDir = resolve(scriptDir, '../assets/audio');
const webOutputDir = resolve(scriptDir, '../../public/audio/focus');
const generationDir = mkdtempSync(resolve(tmpdir(), 'mhtoolkit-soundscapes-'));

mkdirSync(mobileOutputDir, { recursive: true });
mkdirSync(webOutputDir, { recursive: true });

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0xffffffff;
  };
}

function createStereo() {
  return {
    left: new Float32Array(rawSampleCount),
    right: new Float32Array(rawSampleCount),
  };
}

function makeSeamless(channel) {
  const fadeSamples = sampleRate * crossfadeSeconds;
  const output = new Float32Array(sampleCount);
  for (let index = 0; index < fadeSamples; index += 1) {
    const progress = index / (fadeSamples - 1);
    const fadeIn = Math.sin(progress * Math.PI * 0.5);
    const fadeOut = Math.cos(progress * Math.PI * 0.5);
    output[index] =
      channel[index] * fadeIn + channel[sampleCount + index] * fadeOut;
  }
  output.set(channel.subarray(fadeSamples, sampleCount), fadeSamples);
  return output;
}

function normalize(stereo, targetPeak) {
  let peak = 0;
  for (let index = 0; index < stereo.left.length; index += 1) {
    peak = Math.max(
      peak,
      Math.abs(stereo.left[index]),
      Math.abs(stereo.right[index])
    );
  }
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (let index = 0; index < stereo.left.length; index += 1) {
    stereo.left[index] *= scale;
    stereo.right[index] *= scale;
  }
  return stereo;
}

function finish(raw, targetPeak = 0.72) {
  return normalize(
    {
      left: makeSeamless(raw.left),
      right: makeSeamless(raw.right),
    },
    targetPeak
  );
}

function deepBrownNoise() {
  const randomLeft = randomGenerator(0x14ca8f);
  const randomRight = randomGenerator(0x14ca90);
  const stereo = createStereo();
  let brownLeft = 0;
  let brownRight = 0;
  let warmthLeft = 0;
  let warmthRight = 0;

  for (let index = 0; index < rawSampleCount; index += 1) {
    const whiteLeft = randomLeft() * 2 - 1;
    const whiteRight = randomRight() * 2 - 1;
    brownLeft = (brownLeft + whiteLeft * 0.018) / 1.018;
    brownRight = (brownRight + whiteRight * 0.018) / 1.018;
    warmthLeft = warmthLeft * 0.9985 + brownLeft * 0.0015;
    warmthRight = warmthRight * 0.9985 + brownRight * 0.0015;
    stereo.left[index] = brownLeft * 2.35 + warmthRight * 0.32;
    stereo.right[index] = brownRight * 2.35 + warmthLeft * 0.32;
  }

  return finish(stereo, 0.68);
}

function steadyRain() {
  const randomLeft = randomGenerator(0x72a11);
  const randomRight = randomGenerator(0x72a12);
  const eventRandom = randomGenerator(0x72a13);
  const stereo = createStereo();
  let lowLeft = 0;
  let lowRight = 0;
  let washLeft = 0;
  let washRight = 0;

  for (let index = 0; index < rawSampleCount; index += 1) {
    const whiteLeft = randomLeft() * 2 - 1;
    const whiteRight = randomRight() * 2 - 1;
    lowLeft = lowLeft * 0.94 + whiteLeft * 0.06;
    lowRight = lowRight * 0.94 + whiteRight * 0.06;
    const highLeft = whiteLeft - lowLeft;
    const highRight = whiteRight - lowRight;
    washLeft = washLeft * 0.78 + highLeft * 0.22;
    washRight = washRight * 0.78 + highRight * 0.22;
    stereo.left[index] = washLeft * 0.44 + lowLeft * 0.12;
    stereo.right[index] = washRight * 0.44 + lowRight * 0.12;
  }

  const eventCount = Math.floor(durationSeconds * 2.4);
  for (let event = 0; event < eventCount; event += 1) {
    const start = Math.floor(eventRandom() * (rawSampleCount - sampleRate * 0.12));
    const length = Math.floor(sampleRate * (0.025 + eventRandom() * 0.07));
    const frequency = 1_600 + eventRandom() * 4_800;
    const pan = eventRandom();
    const strength = 0.035 + eventRandom() * 0.065;
    for (let offset = 0; offset < length; offset += 1) {
      const progress = offset / length;
      const envelope = Math.sin(progress * Math.PI) * Math.exp(-progress * 3.2);
      const drop =
        Math.sin((offset / sampleRate) * Math.PI * 2 * frequency) *
        envelope *
        strength;
      stereo.left[start + offset] += drop * Math.sqrt(1 - pan);
      stereo.right[start + offset] += drop * Math.sqrt(pan);
    }
  }

  return finish(stereo, 0.7);
}

function oceanWash() {
  const randomLeft = randomGenerator(0x0cea7);
  const randomRight = randomGenerator(0x0cea8);
  const stereo = createStereo();
  let bodyLeft = 0;
  let bodyRight = 0;
  let foamLeft = 0;
  let foamRight = 0;

  for (let index = 0; index < rawSampleCount; index += 1) {
    const seconds = index / sampleRate;
    const whiteLeft = randomLeft() * 2 - 1;
    const whiteRight = randomRight() * 2 - 1;
    bodyLeft = bodyLeft * 0.992 + whiteLeft * 0.008;
    bodyRight = bodyRight * 0.992 + whiteRight * 0.008;
    foamLeft = foamLeft * 0.84 + (whiteLeft - bodyLeft) * 0.16;
    foamRight = foamRight * 0.84 + (whiteRight - bodyRight) * 0.16;
    const swell =
      0.46 +
      Math.sin(seconds * 0.29) * 0.18 +
      Math.sin(seconds * 0.117 + 1.7) * 0.12 +
      Math.sin(seconds * 0.047 + 0.4) * 0.08;
    const foam = Math.max(0.12, swell - 0.25);
    stereo.left[index] = bodyLeft * swell * 1.8 + foamLeft * foam * 0.44;
    stereo.right[index] = bodyRight * swell * 1.8 + foamRight * foam * 0.44;
  }

  return finish(stereo, 0.74);
}

function wavBuffer({ left, right }) {
  const bytesPerFrame = 4;
  const dataSize = left.length * bytesPerFrame;
  const buffer = Buffer.allocUnsafe(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerFrame, 28);
  buffer.writeUInt16LE(bytesPerFrame, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < left.length; index += 1) {
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, left[index])) * 32767),
      44 + index * bytesPerFrame
    );
    buffer.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, right[index])) * 32767),
      46 + index * bytesPerFrame
    );
  }
  return buffer;
}

function encodeSoundscape(filename, createSamples) {
  const temporaryWav = resolve(generationDir, `${filename}.wav`);
  const temporaryOutput = resolve(generationDir, `${filename}.m4a`);
  writeFileSync(temporaryWav, wavBuffer(createSamples()));

  const encoded = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      temporaryWav,
      '-c:a',
      'aac',
      '-profile:a',
      'aac_low',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      temporaryOutput,
    ],
    { encoding: 'utf8' }
  );
  if (encoded.status !== 0) {
    throw new Error(encoded.stderr || 'ffmpeg could not encode the soundscape.');
  }

  const probed = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate,channels:format=duration',
      '-of',
      'json',
      temporaryOutput,
    ],
    { encoding: 'utf8' }
  );
  if (probed.status !== 0) {
    throw new Error(probed.stderr || 'ffprobe could not inspect the soundscape.');
  }
  const metadata = JSON.parse(probed.stdout);
  const stream = metadata.streams?.[0];
  const duration = Number(metadata.format?.duration);
  if (
    stream?.codec_name !== 'aac' ||
    Number(stream.sample_rate) !== sampleRate ||
    Number(stream.channels) !== 2 ||
    Math.abs(duration - durationSeconds) > 0.05
  ) {
    throw new Error(`Generated ${filename}.m4a has unexpected audio metadata.`);
  }
  return temporaryOutput;
}

function atomicCopy(source, destination) {
  const staged = `${destination}.tmp-${process.pid}-${Date.now()}`;
  copyFileSync(source, staged);
  renameSync(staged, destination);
}

try {
  const generated = [
    ['deep-brown', encodeSoundscape('deep-brown', deepBrownNoise)],
    ['steady-rain', encodeSoundscape('steady-rain', steadyRain)],
    ['ocean-wash', encodeSoundscape('ocean-wash', oceanWash)],
  ];

  for (const [filename, temporaryOutput] of generated) {
    atomicCopy(temporaryOutput, resolve(mobileOutputDir, `${filename}.m4a`));
    atomicCopy(temporaryOutput, resolve(webOutputDir, `${filename}.m4a`));
    console.log(`Generated ${filename}.m4a`);
  }
} finally {
  rmSync(generationDir, { recursive: true, force: true });
}

console.log(
  `Generated 90-second, seamless 48 kHz stereo soundscapes in ${mobileOutputDir} and ${webOutputDir}`
);
