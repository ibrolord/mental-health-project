#!/usr/bin/env node
/**
 * Every URL in lib/resources.ts points somewhere a person in distress may try
 * to go. A dead link there is a real failure, not a cosmetic one, so this
 * checks them rather than trusting that they were right when written.
 *
 * Some hosts reject HEAD or bot-like requests but serve real browsers fine, so
 * a HEAD failure falls back to GET before anything is reported as broken.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'lib', 'resources.ts'), 'utf8');

const urls = [...new Set(source.match(/https:\/\/[^\s'"`]+/g) ?? [])];
if (urls.length === 0) {
  console.error('FAIL no URLs found in lib/resources.ts');
  process.exit(1);
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': UA, accept: '*/*' },
      });
      clearTimeout(timer);
      if (res.ok || res.status === 403 || res.status === 405) {
        // 403/405 means the host is up but dislikes automated probes. That is
        // not a broken link, so report it rather than failing the build.
        return { url, status: res.status, ok: true, note: res.ok ? '' : 'bot-blocked' };
      }
      if (method === 'GET') return { url, status: res.status, ok: false };
    } catch (error) {
      if (method === 'GET') return { url, status: error.name === 'AbortError' ? 'timeout' : 'error', ok: false };
    }
  }
  return { url, status: 'unknown', ok: false };
}

const results = await Promise.all(urls.map(probe));
const broken = results.filter((r) => !r.ok);

for (const r of results.sort((a, b) => Number(a.ok) - Number(b.ok))) {
  const label = r.ok ? (r.note ? `OK(${r.note})` : 'OK') : 'BROKEN';
  console.log(`${label.padEnd(15)} ${String(r.status).padEnd(8)} ${r.url}`);
}

console.log(`\n${results.length - broken.length}/${results.length} reachable`);

if (broken.length > 0) {
  console.error(`FAIL ${broken.length} resource link(s) unreachable`);
  process.exit(1);
}
console.log('PASS all resource links reachable');
