import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mobileAssets = join(root, "mobile", "assets");
const publicDir = join(root, "public");

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function generate() {
  await mkdir(publicDir, { recursive: true });

  await Promise.all([
    copyFile(join(mobileAssets, "icon.svg"), join(publicDir, "icon.svg")),
    copyFile(join(mobileAssets, "icon.png"), join(publicDir, "icon.png")),
    copyFile(join(mobileAssets, "favicon.png"), join(publicDir, "favicon.png")),
  ]);

  await sharp(join(mobileAssets, "icon.png"))
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, "apple-touch-icon.png"));

  const botanical = await sharp(join(mobileAssets, "today-botanical.png"))
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .modulate({ brightness: 1.08, saturation: 0.72 })
    .png()
    .toBuffer();
  const icon = await sharp(await readFile(join(mobileAssets, "icon.png")))
    .resize(124, 124)
    .png()
    .toBuffer();
  const title = escapeXml("MHtoolkit");
  const subtitle = escapeXml("Private tools for steadier days.");
  const text = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#f8f3e7" fill-opacity="0.72"/>
      <text x="96" y="315" fill="#163a32" font-family="Georgia, serif" font-size="88" font-weight="700">${title}</text>
      <text x="100" y="385" fill="#496b62" font-family="Arial, sans-serif" font-size="34">${subtitle}</text>
    </svg>
  `);

  await sharp(botanical)
    .composite([
      { input: text, top: 0, left: 0 },
      { input: icon, top: 106, left: 96 },
    ])
    .png()
    .toFile(join(publicDir, "og-image.png"));
}

// Web app manifest icons (see app/manifest.ts). Run on its own with
// `node scripts/generate-brand-assets.mjs --pwa-icons` to avoid regenerating
// the other brand assets.
async function generatePwaIcons() {
  const iconsDir = join(publicDir, "icons");
  const source = join(publicDir, "icon.png");
  await mkdir(iconsDir, { recursive: true });

  for (const size of [192, 512]) {
    await sharp(source).resize(size, size).png().toFile(join(iconsDir, `icon-${size}.png`));
  }

  // Maskable icons can be cropped to a circle, so keep the artwork inside the
  // central 80% safe zone and fill the rest with the icon's own edge colour.
  const { data } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
  const background = { r: data[0], g: data[1], b: data[2], alpha: 1 };
  const inner = 410;
  const pad = (512 - inner) / 2;
  await sharp(source)
    .resize(inner, inner)
    .extend({ top: Math.floor(pad), bottom: Math.ceil(pad), left: Math.floor(pad), right: Math.ceil(pad), background })
    .png()
    .toFile(join(iconsDir, "icon-maskable-512.png"));
}

const run = process.argv.includes("--pwa-icons")
  ? generatePwaIcons
  : async () => {
      await generate();
      await generatePwaIcons();
    };

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
