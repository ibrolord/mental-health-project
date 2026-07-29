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
    .removeAlpha()
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

  // Android adaptive icon foreground: the same mark without a baked-in mask.
  const foregroundSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M395 318c-78 0-139 59-139 135 0 45 20 81 53 105-25 26-38 59-38 98 0 82 65 144 151 144h76V318H395Z" fill="#fffef8"/>
    <path d="M629 318c78 0 139 59 139 135 0 45-20 81-53 105 25 26 38 59 38 98 0 82-65 144-151 144h-76V318h103Z" fill="#fffef8"/>
    <path d="M330 438c49-17 98 17 139 0M313 540c50-17 101 17 156 0M333 642c49-17 96 17 136 0M357 731c42-14 79 13 112 0" fill="none" stroke="#c65f3d" stroke-width="18" stroke-linecap="round"/>
    <path d="M555 438c41-17 90 17 139 0M555 540c55-17 106 17 156 0M555 642c40-17 87 17 136 0M555 731c33-13 70 14 112 0" fill="none" stroke="#c65f3d" stroke-width="18" stroke-linecap="round"/>
    <path d="M512 354c-14-27-36-41-62-41-43 0-70 31-70 67 0 61 71 105 132 146 61-41 132-85 132-146 0-36-27-67-70-67-26 0-48 14-62 41Z" fill="#c65f3d"/>
  </svg>`;

  await sharp(Buffer.from(foregroundSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-foreground.png'));
  console.log('Generated android-icon-foreground.png (1024x1024)');

  // Android background.
  const bgSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#163a32"/>
  </svg>`;

  await sharp(Buffer.from(bgSvg))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'android-icon-background.png'));
  console.log('Generated android-icon-background.png (1024x1024)');

  // Monochrome icon (white silhouette on transparent)
  const monoSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M395 318c-78 0-139 59-139 135 0 45 20 81 53 105-25 26-38 59-38 98 0 82 65 144 151 144h76V318H395Z" fill="white"/>
    <path d="M629 318c78 0 139 59 139 135 0 45-20 81-53 105 25 26 38 59 38 98 0 82-65 144-151 144h-76V318h103Z" fill="white"/>
    <path d="M512 354c-14-27-36-41-62-41-43 0-70 31-70 67 0 61 71 105 132 146 61-41 132-85 132-146 0-36-27-67-70-67-26 0-48 14-62 41Z" fill="white"/>
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

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
