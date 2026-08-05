# AGENTS.md

See `~/.claude/AGENTS.md` for the shared multi-model workflow (Claude lead, Codex correctness reviewer, Gemini architecture reviewer).

When invoked as a reviewer sub-agent in this repo, follow the role assigned by Claude in the invocation prompt. Do not write files.

## Project-specific notes

- Never claim native QA is complete, release-ready, or safe to submit unless the
  exact installed artifact has a completed run generated from
  `mobile/qa/ios-release-checklist.json` and
  the run SHA-256 is pinned outside the mutable run file, and
  `npm run qa:ios:verify -- --run <path> --expected-run-sha256 <hash>` exits zero.
- A build, static test, visible control, screenshot, happy path, or prior run is
  not evidence that a control works. Record the action, observed destination or
  persisted state, exact artifact, device, OS, and evidence reference.
- After a fix, rerun the failed check, its route-level control sweep, every
  affected cross-route workflow, and the regression section. Do not edit a
  previous run to represent a new artifact.
- Stateful and destructive paths require disposable anonymous, owner, partner,
  and post-revocation identities as specified by `mobile/QA_PROTOCOL.md`.
