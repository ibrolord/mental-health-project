# MHtoolkit Clinical Product-Safety Release Guardrails

Status: mandatory pre-release gates for planned features

Applies to: low-energy mode, small-step activity planning, structured Safety
Plan, Staying Well/recovery plan, sleep diary, partner support preferences,
privacy activity, and deterministic Visit Brief

Evidence basis: `clinical-evidence-register.md`

These gates do not assert that a feature exists or has passed review. A design,
pull request, test result, screenshot, simulator run, or store build is not
release evidence unless the exact shipped artifact and user journey were tested
and the required reviewers signed the recorded version.

## Release Scope

- Initial release is for adults age 18 and over only.
- The features are self-management and communication aids. They are not medical
  devices, emergency services, clinical monitoring, diagnosis, treatment,
  therapy, or substitutes for professional care.
- The product must not invite or knowingly onboard a person under 18 into these
  features. Store metadata, onboarding, help, and marketing must say "18+."
- A future minor release requires separate evidence, safeguarding, consent,
  parental/guardian, abuse-reporting, crisis, clinical, privacy, and legal work.
- Launch-market crisis resources and privacy obligations must be reviewed by
  locale. US-only 988 copy must not be presented as a global service.

## Universal Release Gates

All eight features must pass every applicable gate below.

### Clinical and Claims

- A named licensed adult mental health clinician has reviewed the exact user
  copy, fields, defaults, empty states, reminders, notifications, errors,
  exports, help content, and marketing claims.
- Each field is tagged `SB`, `PI`, or `OG` in the product specification. No
  feature is tagged or marketed `VI`.
- The implementation does not silently expand a source-backed category into a
  clinical interpretation, score, recommendation, or treatment workflow.
- Distress, worsening, self-harm, and crisis states have a reviewed route that
  does not depend on AI output, account access, payment, partner availability,
  or a completed plan.
- User copy uses "may," "can," or descriptive language where evidence is
  limited. It does not promise an outcome.

### Choice and Accessibility

- Every non-essential activity is optional and has a clear skip, back, save,
  edit, and delete path.
- Low-energy mode preserves all safety, privacy, consent, error, save, and exit
  controls. It changes presentation, not rights or meaning.
- No streak loss, guilt, celebratory pressure, countdown, forced completion, or
  escalating reminders follow a skipped wellbeing task.
- The exact release is tested with keyboard navigation, screen reader, text
  scaling/reflow, high contrast, reduced motion, and interruption controls.
- A user can resume a partially completed task without losing context or being
  forced to start again.

### Privacy and Sharing

- Mental health, safety, sleep, medication, alcohol, journal, support, and visit
  data are treated as sensitive.
- Collection and sharing are data-minimized. Optional fields remain optional,
  and blank values are not replaced with defaults that look user-authored.
- Before any share or export, the user sees the exact data, recipient or
  destination, purpose, persistence risk, and a cancel action.
- Partner access defaults off by person and data category. Naming a partner does
  not grant access.
- Consent withdrawal and partner revocation are tested against the backend,
  cached clients, notifications, deep links, exports, and re-authentication.
- Copy distinguishes stopping future access from deleting copies a recipient
  already received.
- Retention, deletion, export, and privacy-activity statements match observed
  system behavior. "Deleted" is not shown while work is queued or pending.

### Provenance and Determinism

- Summaries and exports identify their source records and date range.
- Deterministic output has a fixed, documented section and ordering policy.
- Re-running the generator on the same versioned input produces byte-equivalent
  content apart from explicitly allowed metadata such as generation time.
- User-entered wording, units, and uncertainty are preserved. Conflicts and
  missing values are not silently reconciled.
- AI, classifiers, embeddings, generative rewriting, and inferred clinical
  facts are excluded from the deterministic Visit Brief path.
- Analytics events contain no free-text clinical content or partner/safety-plan
  details unless separately justified, consented, minimized, and approved.

### Source Rights

- Product counsel has recorded the exact source version, intended use,
  territory, commercial status, attribution, and licence for every adapted
  element.
- Written permission to use or adapt the VA Safety Planning Intervention Manual
  outside VA is on file before implementation based on that manual ships.
- Stanley and Brown/SAMHSA rights are cleared before copying Safety Plan labels,
  sequence wording, form layout, or artwork.
- NICE international reuse permission is on file before NICE wording or
  recommendation structure is reproduced outside the UK.
- WHO Step-by-Step material is not incorporated into a commercial product under
  `CC BY-NC-SA 3.0 IGO` without additional permission. Attribution,
  share-alike, translation, logo, third-party, and non-endorsement terms are
  satisfied for any permitted use.
- AHRQ, NHLBI, W3C, and OPC wording, forms, scales, examples, branding, and
  third-party elements are independently checked. Linking to a source does not
  by itself permit adaptation.

## Feature-Specific Gates

### Low-Energy Mode

Release only when:

- The mode is user-selected, reversible, and named as a display preference, not
  a detected condition.
- It removes only non-critical content and interruptions. Required consent,
  risk, side-effect, crisis, and data-use information stays available without
  extra hunting.
- The same task outcome can be reached with the mode on or off.
- Draft state, validation errors, focus location, and progress survive mode
  changes.
- The clinician and accessibility reviewers approve the claim boundary: no
  treatment of low energy, fatigue, executive dysfunction, or depression.

### Small-Step Activity Planning

Release only when:

- The user chooses the activity and each step. The product does not prescribe a
  target, intensity, duration, frequency, or progression.
- "Small" is editable and contextual. The app never frames a larger step as
  clinically better.
- Change, pause, skip, and stop are first-class outcomes and do not trigger
  negative feedback.
- Copy says this is a planning aid, not behavioural activation therapy or a
  depression treatment.
- Physical limitations, pain, disability, unsafe environments, caregiving,
  financial limits, and clinician advice are not treated as avoidance to
  overcome.
- Any link between activity and mood is descriptive self-report, not a causal or
  predictive result.

### Structured Safety Plan

This feature has the strictest gate. Release only when:

- A licensed clinician with current suicide safety-planning competence has
  approved the end-to-end flow and signed the exact content version.
- The feature is framed as a record created collaboratively with a qualified
  clinician. Completing fields is not presented as receiving the Safety
  Planning Intervention.
- The six source-backed areas remain distinct and user-specific: warning signs,
  internal coping, distraction, people who can help, professional/crisis help,
  and making the environment safer.
- The workflow does not screen, score, classify, or predict suicide risk.
- "Make the environment safer" copy is clinician-reviewed, avoids method detail,
  and records agreed actions and support rather than generating instructions.
- An urgent-help action is visible from entry, edit, read, error, offline, and
  export states. It is not conditional on plan completion.
- Crisis destinations are verified for the launch locale, operating hours,
  phone/text capability, and accessibility immediately before release. Local
  emergency services are shown for immediate danger.
- The product clearly says it does not monitor the plan, know whether the user
  is safe, contact a clinician or partner automatically, or provide 24/7 care.
- The plan can be opened quickly on the exact supported device and build. If
  offline access is promised, it is tested offline after logout, restart,
  update, and loss of network. If it is not available offline, copy states that
  limitation before reliance.
- Editing, review date, stale contact handling, export preview, deletion, and
  partner permissions are tested with a complete and partially complete plan.
- Copyright/adaptation permissions are on file. Lack of permission is stop-ship.

Minimum crisis copy, localized before release:

> MHtoolkit is not an emergency service and does not monitor this plan. If you
> may act now or cannot stay safe, call local emergency services now.

Do not use a generic global crisis number or infer locale silently from IP
address. Let the user confirm or change locale.

### Staying Well / Recovery Plan

Release only when:

- "Staying well" and "recovery" are user-selectable labels or neutrally
  explained; neither implies cure, remission, or a required identity.
- The plan separates prior warning signs from current crisis status.
- Every warning sign can have a user-authored contingency action and support
  contact, including "contact my clinician."
- No generated action changes medication, treatment, appointment frequency, or
  clinical follow-up.
- The feature does not estimate relapse probability or promise relapse
  prevention.
- A clinician reviews the wording for worsening symptoms, sleep changes,
  avoidance, rumination, and return-to-care prompts.

### Sleep Diary

Release only when:

- Fields remain self-report and accept "not sure" or blank where applicable.
- Medicine, caffeine, alcohol, naps, and exercise are optional and neutrally
  worded. Entries do not trigger diagnosis, stigma, or treatment advice.
- Any duration calculation is deterministic and tested across midnight, noon,
  daylight-saving transitions, time-zone changes, missing times, and impossible
  or conflicting input. The original values remain visible.
- Charts distinguish time in bed, estimated sleep, awakenings, morning
  alertness, and daytime sleepiness. They do not collapse them into an
  unvalidated "sleep score."
- No claim says the diary detects insomnia, sleep apnea, substance misuse,
  medication effects, or improvement.
- Export clearly labels dates, user estimates, missing data, and the fact that
  the diary is not a diagnosis.

### Partner Support Preferences

Release only when:

- The user can complete the feature without inviting or naming anyone.
- Preferences distinguish "helpful," "not helpful," "ask first," and "do not
  involve" without requiring an explanation.
- Data access is granted separately from support instructions. A supporter may
  receive instructions without receiving health records.
- Each share names the person, data categories, purpose, duration, and current
  status. Expiry and revocation are available from the same surface.
- A separate explicit choice is required for crisis-plan involvement. Partner
  status never makes that person a crisis responder or clinician.
- Safety Plan, journal, medication, alcohol, sleep, privacy, and Visit Brief data
  default to not shared.
- Blocking, revocation, account deletion, expired invitations, changed email or
  phone, and reused links are tested end to end.
- An abuse/coercion-informed reviewer approves copy, notification previews,
  shared-device behavior, and safe exit. The app does not recommend confronting
  a potentially unsafe partner or reveal hidden preferences to that person.
- Copy does not claim couples therapy, relationship safety, caregiver authority,
  accountability monitoring, or guaranteed support.

### Privacy Activity

Release only when:

- The view is generated from authoritative privacy and sharing events, not only
  client analytics or best-effort UI logs.
- Each event shows action, affected data category, purpose, recipient where
  applicable, status, timestamp with time zone, and a management/help route.
- Pending, failed, completed, revoked, expired, and deleted states are distinct.
- Consent and notice versions are retained so the user can see what choice was
  made under which explanation.
- Corrections append or otherwise preserve an auditable relationship to the
  original event; the UI does not silently rewrite history.
- The privacy officer verifies collection, use, disclosure, retention,
  withdrawal, deletion, backup, and third-party limitations against production.
- The title and copy do not claim "complete history," "proof of deletion," or
  legal compliance unless those exact claims are independently demonstrated.

### Deterministic Visit Brief

Release only when:

- The brief is assembled from a user-confirmed input snapshot and a versioned,
  deterministic template.
- The fixed section order is documented. Within a section, user priority then a
  documented chronological or lexical tie-breaker determines order.
- Every included item has a visible source and date or date range. The user can
  exclude an item without deleting its source record.
- Medicines and supplements appear only as entered and explicitly confirmed by
  the user. The brief does not perform medication reconciliation.
- Symptoms, mood, sleep, activity, and safety content are not interpreted,
  diagnosed, ranked, or causally linked.
- Safety Plan content is excluded by default and requires a separate explicit
  inclusion and share confirmation.
- Empty sections are omitted or marked "not provided." They are never completed
  from profile defaults or inference without clear user confirmation.
- Preview shows the exact final export. The user can edit source text, change
  selection, cancel, and regenerate before sharing.
- Golden fixtures cover empty, partial, stale, duplicate, conflicting, unicode,
  multiline, very long, and deleted inputs; time zones; unit preservation;
  pagination; and repeat generation.
- Tests prove the release path makes no network call to an AI/model endpoint and
  adds no generated clinical prose.
- Copy says the brief may be incomplete and must be reviewed. It does not claim
  clinician approval, medical-record completeness, accuracy, triage, or
  decision support.

## Prohibited Claims

The following claims, close paraphrases, and reasonable implications are
prohibited unless a new evidence and regulatory review explicitly clears them:

- "Clinically validated," "clinically proven," or "evidence-based feature."
- "Treats depression," "behavioural activation therapy," or "improves mood."
- "Prevents relapse," "keeps you well," or "certifies recovery."
- "Prevents suicide," "detects suicide risk," "keeps you safe," or "your
  clinician will be alerted."
- "Diagnoses insomnia," "detects sleep apnea," "improves sleep," or "sleep
  score."
- "Safe partner," "couples therapy," "monitors accountability," or "guaranteed
  support."
- "PIPEDA compliant," "HIPAA compliant," "complete privacy history," or
  "permanently deleted" without claim-specific legal and technical evidence.
- "AI-free" for the product as a whole when only the Visit Brief path is
  deterministic.
- "Error-free," "hallucination-free," "clinically accurate," or "complete"
  because output is deterministic.
- "Approved," "recommended," "certified," or "endorsed" by SAMHSA, VA, NICE,
  WHO, AHRQ, NHLBI, W3C, OPC, or a clinician who reviewed only safety copy.

## Required Release Evidence

The release owner must attach all of the following to the release decision:

- Exact feature version, commit, build, platform, device, OS, locale, and test
  date.
- Evidence-register source versions and link-check date.
- Named clinical reviewer, credentials, scope, findings, required changes, and
  signed content/version identifier.
- Privacy and legal review covering launch markets, data flows, claims, source
  rights, consent, sharing, export, retention, and deletion.
- Accessibility review and assistive-technology results on the exact release.
- Lived-experience review summary with coercion and crisis-language findings.
- End-to-end test evidence for create, partial save, resume, edit, skip, delete,
  export, share, revoke, expiry, offline/error, and account deletion as
  applicable.
- Production or production-equivalent evidence that visible privacy, deletion,
  partner, and crisis behaviors match the copy.
- Deterministic Visit Brief input fixtures, expected outputs, template version,
  and proof that no model/network generation path was called.
- Current crisis-resource verification for every enabled locale.
- All permissions, licences, attribution text, and non-endorsement notices.

Review sign-off expires when a source, claim, field, default, algorithm, data
flow, crisis destination, locale, dependency, or user-visible copy changes.

## Stop-Ship Conditions

Stop release if any of the following is true:

- Under-18 access is enabled without the separate minor-safety programme.
- A feature is described as validated, diagnostic, therapeutic, preventive, or
  clinician-approved without claim-specific evidence.
- The Safety Plan lacks clinician sign-off, current local urgent-help routing,
  clear non-monitoring copy, or adaptation permission.
- Safety, consent, privacy, save, or exit controls disappear in low-energy mode.
- A planning flow penalizes skipping or pushes unsafe activity escalation.
- Partner sharing defaults on, permissions are bundled, or revocation does not
  stop verified future access.
- Privacy activity is based on incomplete UI analytics but appears authoritative.
- A deletion, sharing, crisis-alert, or retention statement is stronger than the
  observed backend behavior.
- The Visit Brief invents, infers, rewrites, prioritizes clinically, or calls an
  AI/model endpoint.
- A share or export can occur without exact preview and confirmation.
- Missing, stale, or conflicting clinical data is hidden or silently resolved.
- Source licensing, commercial-use, translation, attribution, or third-party
  rights remain unresolved.
- Required reviewers approved a different content or build version.

Passing these gates permits a release decision; it does not prove clinical
benefit, eliminate risk, or authorize claims outside this document.
