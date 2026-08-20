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
    output: '01_today.png',
    source: 'today.png',
    title: ['Start with what', 'matters today.'],
    body: ['Mood, guidance, and your next useful step', 'in one calm view.'],
  },
  {
    output: '02_mood.png',
    source: 'mood.png',
    title: ['Name the moment', 'without a score.'],
    body: ['A quick check-in, optional context, and trends', 'you control.'],
  },
  {
    output: '03_together.png',
    source: 'together.png',
    title: ['Follow through with', 'someone you trust.'],
    body: ['Share one commitment, check in, and celebrate', 'the effort together.'],
  },
  {
    output: '04_tools.png',
    source: 'tools.png',
    title: ['Choose the right tool', 'for right now.'],
    body: ['Grounding, planning, reflection, learning,', 'and more in one toolkit.'],
  },
  {
    output: '05_goals.png',
    source: 'goals.png',
    title: ['Turn a goal into', 'the next clear step.'],
    body: ['Add milestones, due dates, reminders, notes,', 'and supporting files.'],
  },
  {
    output: '06_library.png',
    source: 'library.png',
    title: ['Find practical ideas', 'worth using.'],
    body: ['Explore reviewed books, talks, stories, and', 'action templates.'],
  },
  {
    output: '07_grounding.png',
    source: 'ground.png',
    title: ['Get steady one guided', 'step at a time.'],
    body: ['Choose what is happening and begin a focused', 'grounding practice.'],
  },
  {
    output: '08_focus.png',
    source: 'focus.png',
    title: ['Protect one outcome', 'and one block.'],
    body: ['Plan the task, set the interval, and choose', 'an optional focus sound.'],
  },
  {
    output: '09_yoga.png',
    source: 'yoga.png',
    title: ['Move gently with', 'clear guidance.'],
    body: ['Choose seated, floor, or restorative sequences', 'with easy exits.'],
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
  const [firstBodyLine, secondBodyLine] = screen.body.map(escapeXml);
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#f3f0e4"/>
      <circle cx="1175" cy="82" r="130" fill="#edf4ea"/>
      <circle cx="1175" cy="82" r="78" fill="none" stroke="#84ac95" stroke-width="4" opacity="0.7"/>
      <text x="82" y="70" font-family="Avenir Next, Helvetica, sans-serif" font-size="25" font-weight="700" letter-spacing="6" fill="#c65f3d">MHTOOLKIT</text>
      <text x="82" y="185" font-family="Georgia, serif" font-size="67" font-weight="700" fill="#163a32">
        <tspan x="82" dy="0">${firstLine}</tspan>
        <tspan x="82" dy="76">${secondLine}</tspan>
      </text>
      <text x="82" y="368" font-family="Avenir Next, Helvetica, sans-serif" font-size="29" font-weight="500" fill="#587169">
        <tspan x="82" dy="0">${firstBodyLine}</tspan>
        <tspan x="82" dy="39">${secondBodyLine}</tspan>
      </text>
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
