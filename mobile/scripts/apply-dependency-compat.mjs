import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep Expo 54's callers compatible with the security-patched dependencies.
// Fail installation rather than silently applying a patch to an unknown version.
export function patchedSource(source, before, after) {
  if (source.includes(after) && !source.includes(before)) return source;
  if (source.split(before).length !== 2 || source.includes(after)) {
    throw new Error('Dependency compatibility patch does not match the installed source.');
  }
  return source.replace(before, after);
}

export function applyCompatibility(mobileRoot) {
  const require = createRequire(path.join(mobileRoot, 'package.json'));
  const patch = (packageJson, versions, relativeFile, before, after) => {
    const manifest = JSON.parse(readFileSync(packageJson, 'utf8'));
    if (!versions.includes(manifest.version)) {
      throw new Error(`Review compatibility patch for ${manifest.name}@${manifest.version}.`);
    }
    const file = path.join(path.dirname(packageJson), relativeFile);
    const source = readFileSync(file, 'utf8');
    const updated = patchedSource(source, before, after);
    if (source !== updated) writeFileSync(file, updated);
  };
  patch(require.resolve('query-string/package.json'), ['7.1.3'], 'index.js',
    "const decodeComponent = require('decode-uri-component');",
    "const decoder = require('decode-uri-component');\nconst decodeComponent = decoder.default ?? decoder;");

  const expoRequire = createRequire(require.resolve('@expo/metro/package.json'));
  const metroPackages = new Set([
    require.resolve('metro/package.json'),
    expoRequire.resolve('metro/package.json'),
  ]);
  for (const manifest of metroPackages) {
    patch(manifest, ['0.83.3', '0.83.5'], 'src/Assets.js',
      'const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;',
      'const dimensions = isImage ? (0, _imageSize.default)(typeof isImageInput === "string" ? _fs.default.readFileSync(isImageInput) : isImageInput) : null;');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyCompatibility(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  console.log('Applied pinned Expo dependency compatibility patches.');
}
