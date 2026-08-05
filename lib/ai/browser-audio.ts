'use client';

export const TARGET_VOICE_SAMPLE_RATE = 16_000;

export function mixChannelsToMono(channels: Float32Array[]): Float32Array {
  if (!channels.length || !channels[0]?.length) {
    throw new Error('The recording did not contain usable audio.');
  }

  const length = channels[0].length;
  if (channels.some((channel) => channel.length !== length)) {
    throw new Error('The recording channels were inconsistent.');
  }

  const mono = new Float32Array(length);
  for (const samples of channels) {
    for (let index = 0; index < samples.length; index += 1) {
      mono[index] += samples[index] / channels.length;
    }
  }
  return mono;
}

export function resampleAudio(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (
    !samples.length
    || !Number.isFinite(sourceRate)
    || sourceRate <= 0
    || !Number.isFinite(targetRate)
    || targetRate <= 0
  ) {
    throw new Error('The recording did not contain usable audio.');
  }
  if (sourceRate === targetRate) return samples.slice();

  const outputLength = Math.max(
    1,
    Math.round(samples.length * targetRate / sourceRate)
  );
  const output = new Float32Array(outputLength);
  for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
    const sourcePosition = outputIndex * sourceRate / targetRate;
    const leftIndex = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
    const fraction = sourcePosition - leftIndex;
    const left = samples[leftIndex] ?? 0;
    const right = samples[rightIndex] ?? left;
    output[outputIndex] = left + (right - left) * fraction;
  }
  return output;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeMonoPcm16Wav(
  samples: Float32Array,
  sampleRate: number
): Blob {
  if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('The recording did not contain usable audio.');
  }

  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(
      44 + index * bytesPerSample,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function convertRecordingToWav(recording: Blob): Promise<Blob> {
  if (!recording.size) {
    throw new Error('The recording was empty.');
  }

  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, channel) => decoded.getChannelData(channel)
    );
    const mono = mixChannelsToMono(channels);
    const samples = resampleAudio(
      mono,
      decoded.sampleRate,
      TARGET_VOICE_SAMPLE_RATE
    );
    return encodeMonoPcm16Wav(samples, TARGET_VOICE_SAMPLE_RATE);
  } finally {
    await context.close();
  }
}
