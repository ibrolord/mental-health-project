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
    <rect x="332" y="570" width="360" height="150" rx="75" fill="#fffef8"/>
    <rect x="352" y="425" width="300" height="130" rx="65" fill="#84ac95"/>
    <rect x="407" y="300" width="230" height="110" rx="55" fill="#c65f3d"/>
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
    <rect x="332" y="570" width="360" height="150" rx="75" fill="white"/>
    <rect x="352" y="425" width="300" height="130" rx="65" fill="white"/>
    <rect x="407" y="300" width="230" height="110" rx="55" fill="white"/>
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
