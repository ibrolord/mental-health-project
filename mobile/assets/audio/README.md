# MHtoolkit soundscapes

`deep-brown.m4a`, `steady-rain.m4a`, and `ocean-wash.m4a` are deterministic,
procedurally generated MHtoolkit assets. They contain no third-party recordings
or music. Regenerate the 90-second, seamless 48 kHz stereo AAC files with:

```bash
node mobile/scripts/generate-soundscapes.mjs
```

The generator also writes the matching web assets under `public/audio/focus/`.
