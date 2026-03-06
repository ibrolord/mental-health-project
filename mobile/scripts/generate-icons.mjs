import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

async function generate() {
  const iconSvg = readFileSync(join(assetsDir, 'icon.svg'));
  const splashSvg = readFileSync(join(assetsDir, 'splash-icon.svg'));

  // App icon (1024x1024)
  await sharp(iconSvg)
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'icon.png'));
  console.log('Generated icon.png (1024x1024)');

  // Adaptive icon foreground (1024x1024) - same as icon but no rounded rect bg
  // For adaptive icon, Android applies its own mask, so we use the full icon
  await sharp(iconSvg)
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'adaptive-icon.png'));
  console.log('Generated adaptive-icon.png (1024x1024)');

  // Android adaptive icon foreground (brain+heart only, centered with padding)
  const foregroundSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#3b82f6"/>
        <stop offset="50%" style="stop-color:#6366f1"/>
        <stop offset="100%" style="stop-color:#8b5cf6"/>
      </linearGradient>
    </defs>
    <!-- Left brain hemisphere -->
    <path d="M 400 340 C 340 340, 290 390, 290 450 C 290 490, 310 520, 340 540 C 320 560, 310 590, 310 620 C 310 680, 360 730, 420 730 L 500 730 L 500 340 C 460 340, 430 340, 400 340 Z" fill="white" opacity="0.95"/>
    <path d="M 624 340 C 684 340, 734 390, 734 450 C 734 490, 714 520, 684 540 C 704 560, 714 590, 714 620 C 714 680, 664 730, 604 730 L 524 730 L 524 340 C 564 340, 594 340, 624 340 Z" fill="white" opacity="0.95"/>
    <path d="M 360 420 C 400 410, 440 440, 480 420" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 340 500 C 380 490, 420 520, 480 500" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 360 580 C 400 570, 440 600, 480 580" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 380 660 C 410 650, 440 670, 480 660" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 544 420 C 584 410, 624 440, 664 420" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 544 500 C 584 490, 624 520, 684 500" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 544 580 C 584 570, 624 600, 664 580" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 544 660 C 574 650, 604 670, 644 660" stroke="url(#bg2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 512 370 C 512 360, 500 345, 488 345 C 472 345, 462 360, 462 372 C 462 395, 512 420, 512 420 C 512 420, 562 395, 562 372 C 562 360, 552 345, 536 345 C 524 345, 512 360, 512 370 Z" fill="#f472b6"/>
  </svg>`;

  await sharp(Buffer.from(foregroundSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-foreground.png'));
  console.log('Generated android-icon-foreground.png (1024x1024)');

  // Android background (solid gradient as PNG)
  const bgSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#3b82f6"/>
        <stop offset="50%" style="stop-color:#6366f1"/>
        <stop offset="100%" style="stop-color:#8b5cf6"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg3)"/>
  </svg>`;

  await sharp(Buffer.from(bgSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-background.png'));
  console.log('Generated android-icon-background.png (1024x1024)');

  // Monochrome icon (white silhouette on transparent)
  const monoSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M 400 340 C 340 340, 290 390, 290 450 C 290 490, 310 520, 340 540 C 320 560, 310 590, 310 620 C 310 680, 360 730, 420 730 L 500 730 L 500 340 C 460 340, 430 340, 400 340 Z" fill="white"/>
    <path d="M 624 340 C 684 340, 734 390, 734 450 C 734 490, 714 520, 684 540 C 704 560, 714 590, 714 620 C 714 680, 664 730, 604 730 L 524 730 L 524 340 C 564 340, 594 340, 624 340 Z" fill="white"/>
    <path d="M 512 370 C 512 360, 500 345, 488 345 C 472 345, 462 360, 462 372 C 462 395, 512 420, 512 420 C 512 420, 562 395, 562 372 C 562 360, 552 345, 536 345 C 524 345, 512 360, 512 370 Z" fill="white"/>
  </svg>`;

  await sharp(Buffer.from(monoSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-monochrome.png'));
  console.log('Generated android-icon-monochrome.png (1024x1024)');

  // Splash icon (200x200)
  await sharp(splashSvg)
    .resize(200, 200)
    .png()
    .toFile(join(assetsDir, 'splash-icon.png'));
  console.log('Generated splash-icon.png (200x200)');

  // Favicon (48x48)
  await sharp(iconSvg)
    .resize(48, 48)
    .png()
    .toFile(join(assetsDir, 'favicon.png'));
  console.log('Generated favicon.png (48x48)');

  console.log('\nAll icons generated!');
}

generate().catch(console.error);
