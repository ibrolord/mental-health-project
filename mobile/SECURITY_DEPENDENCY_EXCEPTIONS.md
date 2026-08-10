# Mobile Dependency Security Exceptions

This file records unresolved `npm audit` findings that cannot currently be
removed without an unsafe framework change. It is not a blanket vulnerability
allowlist. Re-run `npm audit --json` before every release and fail on any
advisory not listed here.

## Current status

Audit date: 2026-08-10

- 0 critical
- 11 high
- 0 moderate
- 0 low

The eleven package-level findings reduce to three advisories in two transitive
build-tool packages.

## `image-size`

Advisories:

- `GHSA-w3rx-r6r6-pgpr`: crafted ICNS input can cause an infinite loop
- `GHSA-5p2g-fcmc-qvqq`: crafted JXL or HEIF input can cause an infinite loop

The installed `image-size@1.2.1` is pulled in by Metro. As of 2026-08-09, npm's
latest release is `2.0.2` and both advisories affect every published version
through `2.0.2`, so no patched version exists. The audit expands this one
transitive issue across Expo, Metro, React Native, and their configuration
packages.

Mitigation:

- Metro processes only trusted, version-controlled application assets.
- Do not allow user uploads or other untrusted images into the build pipeline.
- Do not run `npm audit fix --force`; its proposed Expo and React Native
  versions are incompatible downgrades and do not provide a patched
  `image-size` release.
- Re-check npm and the Expo SDK release notes before every build. Remove this
  exception immediately when a patched `image-size` path is available.

## `nanoid`

Advisory:

- `GHSA-2v37-7h3g-55p8`: a custom generator can loop indefinitely when called
  with size zero

The installed `nanoid@3.3.16` is transitive through React Navigation and Expo;
the root web dependency tree also contains an affected 3.x copy.
`3.3.17` fixes the advisory, but it was published at
`2026-08-03T10:39:22Z`. The repository's seven-day package-age policy permits
it after `2026-08-10T10:39:22Z`.

Required action after that time:

1. Add the compatible root override `"nanoid": "3.3.17"`.
2. Run `npm install` and `npm audit --json` from `mobile/`.
3. Run Expo Doctor, TypeScript, the complete test suite, the iOS production
   bundle export, and the native Release build.
4. Remove this section after the audit confirms the advisory is gone.

## Safe fixes already applied

The 2026-08-09 remediation updated `undici`, `brace-expansion`, `js-yaml`,
`fast-uri`, and `postcss` to non-vulnerable, package-age-compliant versions.
That reduced the audit from 17 findings (15 high and 2 moderate) to the 11 high
package-level findings described above.
