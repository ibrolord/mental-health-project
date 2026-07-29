import { access, mkdir, readdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileDir = join(scriptDir, '..');
const rawDir = join(mobileDir, 'fastlane', 'screenshots', 'raw', 'en-US');
const outputDir = join(mobileDir, 'fastlane', 'screenshots', 'en-US');

const WIDTH = 1284;
const HEIGHT = 2778;
const SCREENSHOT_WIDTH = 1030;
const SCREENSHOT_HEIGHT = 2238;
const SCREENSHOT_X = 127;
const SCREENSHOT_Y = 510;

const screens = [
  {
    output: '01_dashboard.png',
    source: 'dashboard.png',
    title: ['A calmer place', 'to check in.'],
    body: 'Notice patterns, protect your privacy, and choose one next step.',
  },
  {
    output: '02_library.png',
    source: 'library.png',
    title: ['107 resources.', 'One thoughtful library.'],
    body: 'Books, talks, and real stories with notes, sources, and practical actions.',
  },
  {
    output: '03_chat.png',
    source: 'chat.png',
    title: ['AI context stays', 'in your hands.'],
    body: 'Personal context starts off. You choose what each conversation can use.',
  },
  {
    output: '04_assessments.png',
    source: 'assessments.png',
    title: ['Screen patterns,', 'not diagnoses.'],
    body: 'Published-source tools with recall periods, scoring limits, and citations.',
  },
  {
    output: '05_journal.png',
    source: 'journal.png',
    title: ['Make space for', 'what matters.'],
    body: 'Write privately, connect useful ideas, and return on your own terms.',
  },
  {
    output: '06_ground.png',
    source: 'ground.png',
    title: ['Find the next', 'grounding step.'],
    body: 'Choose a guided technique for panic, numbness, overwhelm, or spiraling thoughts.',
  },
  {
    output: '07_focus.png',
    source: 'focus.png',
    title: ['One outcome.', 'One focused block.'],
    body: 'Plan a bounded task, take a real break, and save your session.',
  },
  {
    output: '08_habits.png',
    source: 'habits.png',
    title: ['Build momentum without', 'all-or-nothing rules.'],
    body: 'Create routines, track streaks, and involve a partner only when you choose.',
  },
  {
    output: '09_meditation.png',
    source: 'meditation.png',
    title: ['A practice for', 'this moment.'],
    body: 'Choose short guided options for stress, sleep, grief, focus, and restlessness.',
  },
];

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function headerSvg(screen) {
  const [firstLine, secondLine] = screen.title.map(escapeXml);
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#f3f0e4"/>
      <circle cx="1175" cy="82" r="130" fill="#edf4ea"/>
      <circle cx="1175" cy="82" r="78" fill="none" stroke="#84ac95" stroke-width="4" opacity="0.7"/>
      <text x="82" y="70" font-family="Avenir Next, Helvetica, sans-serif" font-size="25" font-weight="700" letter-spacing="6" fill="#c65f3d">MHTOOLKIT</text>
      <text x="82" y="160" font-family="Georgia, serif" font-size="67" font-weight="700" fill="#163a32">
        <tspan x="82" dy="0">${firstLine}</tspan>
        <tspan x="82" dy="76">${secondLine}</tspan>
      </text>
      <text x="82" y="382" font-family="Avenir Next, Helvetica, sans-serif" font-size="29" font-weight="500" fill="#587169">${escapeXml(screen.body)}</text>
      <rect x="${SCREENSHOT_X - 8}" y="${SCREENSHOT_Y - 8}" width="${SCREENSHOT_WIDTH + 16}" height="${SCREENSHOT_HEIGHT + 16}" rx="58" fill="#bfd0c4"/>
    </svg>
  `);
}

function roundedMask() {
  return Buffer.from(`
    <svg width="${SCREENSHOT_WIDTH}" height="${SCREENSHOT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${SCREENSHOT_WIDTH}" height="${SCREENSHOT_HEIGHT}" rx="50" fill="white"/>
    </svg>
  `);
}

async function generateScreen(screen) {
  const sourcePath = join(rawDir, screen.source);
  await access(sourcePath);

  const appScreenshot = await sharp(sourcePath)
    .resize(SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, {
      fit: 'cover',
      position: 'top',
    })
    .composite([{ input: roundedMask(), blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: '#f3f0e4',
    },
  })
    .composite([
      { input: headerSvg(screen), left: 0, top: 0 },
      { input: appScreenshot, left: SCREENSHOT_X, top: SCREENSHOT_Y },
    ])
    .removeAlpha()
    .png()
    .toFile(join(outputDir, screen.output));

  console.log(`Generated ${screen.output}`);
}

await mkdir(outputDir, { recursive: true });

const expectedOutputs = new Set(screens.map((screen) => screen.output));
for (const existingFile of await readdir(outputDir)) {
  if (existingFile.endsWith('.png') && !expectedOutputs.has(existingFile)) {
    await unlink(join(outputDir, existingFile));
    console.log(`Removed stale ${existingFile}`);
  }
}

for (const screen of screens) {
  await generateScreen(screen);
}
