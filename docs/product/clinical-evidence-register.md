# MHtoolkit Clinical Evidence Register

Status: pre-implementation product-safety specification

Last evidence and link review: 2026-08-05

This register covers the planned low-energy mode, small-step activity
planning, structured Safety Plan, Staying Well/recovery plan, sleep diary,
partner support preferences, privacy activity, and deterministic Visit Brief.
It does not establish that any feature is implemented, clinically validated,
safe for release, or reviewed by a clinician.

## Scope and Evidence Classes

- **Adults only:** the initial product scope is people age 18 and over. The
  evidence and safeguards in this register do not support a child or adolescent
  release.
- **Source-backed (`SB`):** the source directly supports the named field,
  content category, or workflow principle.
- **Validated instrument (`VI`):** an instrument used exactly within its
  validated population, administration, scoring, interpretation, and licensing
  conditions.
- **Product inference (`PI`):** an MHtoolkit design choice inferred from one or
  more sources. It must not be described as validated or source-mandated.
- **Operational guardrail (`OG`):** a safety, privacy, quality, or release
  control. It is not clinical evidence.

**Validated-instrument determination:** none of the eight planned features is a
validated instrument. The Safety Planning Intervention is an evidence-based
clinical intervention, not a scored risk assessment. WHO Step-by-Step is a
manualized psychological intervention; a partial MHtoolkit activity planner is
not Step-by-Step. The NHLBI Sleep Diary is a patient worksheet, not a diagnostic
test. AHRQ QuestionBuilder is a visit-preparation tool, not a clinical record or
decision aid. Any future scored instrument requires a separate evidence,
population, fidelity, scoring, licensing, and clinician review.

## Primary Source Register

### S1. SAMHSA Safety Plan

- **Source:** [SAMHSA Safety Plan](https://www.samhsa.gov/resource/988/safety-plan)
- **Use:** corroborates a six-part, clinician-supported safety-plan structure
  modified from Stanley and Brown.
- **Boundary:** the page says the pad is intended for counselors, therapists,
  clinicians, and others working with people who need safety plans. It does not
  support presenting a blank form as sufficient crisis care.
- **Link check:** the current official page and download were present in SAMHSA
  search results; direct automated retrieval returned HTTP 403. Do not record a
  successful direct fetch without a fresh browser check.
- **Rights note:** the resource is modified from Stanley and Brown. Do not copy
  its labels, layout, artwork, or form verbatim until rights and attribution are
  cleared.

### S2. VA Safety Planning Intervention

- **Sources:** [VA Safety Planning Intervention overview](https://www.mirecc.va.gov/MIRECC/visn19/safety-planning/index.asp)
  and [VA Safety Planning Intervention Manual](https://www.mirecc.va.gov/MIRECC/visn19/safety-planning/docs/VA-Safety-Planning-Intervention-Manual_508.pdf)
- **Use:** supports a collaborative, prioritized plan with warning signs,
  internal coping, social distraction, people who can help, professional/crisis
  contacts, and a safer environment.
- **Boundary:** the manual describes a provider-delivered clinical intervention
  that follows screening or risk assessment. It says completing a form alone is
  not the intervention.
- **Link check:** official overview and manual opened successfully.
- **Rights note:** the VA page and manual explicitly say permission to use or
  adapt the manual outside VA should be obtained from Gregory K. Brown, PhD.
  Written permission is a release prerequisite for any adaptation based on the
  manual.

### S3. NICE NG222

- **Sources:** [NICE NG222 overview](https://www.nice.org.uk/guidance/ng222)
  and [NICE NG222 recommendations](https://www.nice.org.uk/guidance/ng222/chapter/Recommendations)
- **Use:** adults-only scope; treatment choice based on needs and preferences;
  behavioural activation context; suicide-risk escalation; and relapse
  prevention fields such as warning signs, prior helpful strategies, and
  contingency plans.
- **Boundary:** NICE describes behavioural activation as a structured treatment
  delivered by a trained practitioner. A lightweight planner cannot be called
  behavioural activation treatment. The guideline does not validate MHtoolkit.
- **Link check:** official overview and recommendations opened successfully.
- **Rights note:** NICE's [reuse policy](https://www.nice.org.uk/reusing-our-content)
  requires an international licence for reuse outside the UK. Published
  recommendations must not be paraphrased as if they were NICE wording, and no
  NICE endorsement may be implied.

### S4. WHO Step-by-Step

- **Sources:** [WHO Step-by-Step web annex](https://www.who.int/publications/i/item/B09738)
  and [WHO psychological self-help implementation manual](https://www.who.int/publications/i/item/9789240120785)
- **Use:** supports adult depression self-help content that includes small
  enjoyable activities, breaking harder activities into smaller steps,
  strengthening social support, and warning-sign/coping planning.
- **Boundary:** the evidence applies to the complete intervention and studied
  delivery conditions, including versions with trained helper support. It does
  not transfer to an isolated MHtoolkit planner or low-energy interface.
- **Link check:** official pages opened and the 2026 annex PDF downloaded
  successfully.
- **Rights note:** the annex is `CC BY-NC-SA 3.0 IGO`: non-commercial adaptation
  only, attribution required, adaptations must use the same or an equivalent
  licence, WHO's logo is prohibited, endorsement must not be implied, and
  translations require the specified disclaimer. Third-party material needs
  separate clearance. Commercial use requires a WHO rights request.

### S5. AHRQ Questions Are the Answer

- **Sources:** [AHRQ QuestionBuilder](https://www.ahrq.gov/questions/question-builder/index.html),
  [AHRQ Be More Engaged in Your Healthcare](https://www.ahrq.gov/questions/be-engaged/index.html),
  and [AHRQ Talk With Your Doctor](https://www.ahrq.gov/questions/resources/diagnosis/step3.html)
- **Use:** supports selecting and organizing appointment questions, identifying
  visit goals, bringing a medicine list, describing symptoms and health history,
  and optionally involving a trusted person.
- **Boundary:** it does not support inferring diagnoses, clinical priorities, or
  a clinician-approved care plan from user data.
- **Link check:** official pages opened successfully.
- **Rights note:** AHRQ materials can contain public-domain and third-party
  elements, with different rules for commercial or non-US use. Attribute the
  source and clear the exact question wording, images, and layout before reuse.
  Do not copy AHRQ branding or imply endorsement.

### S6. NHLBI Sleep Diary

- **Sources:** [NHLBI Sleep Diary page](https://www.nhlbi.nih.gov/resources/sleep-diary)
  and [NHLBI Sleep Diary PDF](https://www.nhlbi.nih.gov/sites/default/files/publications/Sleep_Diary_508.pdf)
- **Use:** supports recording sleep timing and continuity, medicines, caffeine,
  alcohol, naps, exercise, morning alertness, and daytime sleepiness, then
  reviewing the information with a clinician.
- **Boundary:** the diary does not diagnose insomnia, sleep apnea, substance use,
  medication effects, or another condition. It does not establish a treatment
  response.
- **Link check:** official page and one-page PDF opened successfully.
- **Rights note:** confirm the exact asset's US and international reuse status
  before copying labels, response scales, examples, layout, or branding. Prefer
  an attributed, independently written field set.

### S7. W3C Help Users Focus

- **Source:** [W3C Cognitive Accessibility Objective: Help Users Focus](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o5-user-focus/)
- **Use:** supports limiting interruptions, shortening critical paths, avoiding
  excess content, maintaining context, and telling users what they need before a
  task begins.
- **Boundary:** this is supplemental cognitive-accessibility guidance, not a
  medical intervention and not a claim that low-energy mode treats fatigue or
  depression.
- **Link check:** official page opened successfully.
- **Rights note:** most WAI material uses the W3C Document License, which permits
  attributed distribution but generally not modified derivatives. Use the
  design principles in original MHtoolkit wording; do not copy the page or imply
  W3C endorsement.

### S8. OPC Meaningful Consent

- **Source:** [Office of the Privacy Commissioner of Canada: Guidelines for obtaining meaningful consent](https://www.priv.gc.ca/en/privacy-topics/business-privacy/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/)
- **Use:** supports prominent explanations of what data is collected, with whom
  it is shared, why it is used, risks or consequences, clear choices, ongoing
  access to choices, and withdrawal of consent.
- **Boundary:** following design guidance does not establish compliance with
  PIPEDA or provincial law. Applicability and legal requirements need privacy
  counsel review.
- **Link check:** the official page opened after redirect and showed a
  2025-08-11 modification date.
- **Rights note:** confirm that the page is offered under the applicable
  Government of Canada reuse terms, attribute it, exclude logos and third-party
  material, and do not imply regulator approval.

## Feature Evidence Maps

### 1. Low-Energy Mode

**Intended role:** an optional presentation preference that reduces task load.

- `SB` Limit non-critical interruptions and remove unnecessary content (S7).
- `SB` Keep critical paths short and preserve orientation/context (S7).
- `SB` Tell the user what information is needed before a task starts (S7).
- `PI` A user-controlled toggle, one-primary-action layout, optional-detail
  disclosure, pause/resume, and preservation of unfinished input.
- `OG` Crisis access, save/exit, privacy controls, and error messages must never
  be hidden by the mode.

**Not supported:** treating low energy, depression, executive dysfunction, or
fatigue; improving adherence; or reducing symptoms.

**Concise user copy:** "Make this screen simpler. You can switch back anytime."

### 2. Small-Step Activity Planning

**Intended role:** a self-directed planning aid, not therapy.

- `SB` A list of small activities the user previously enjoyed (S4).
- `SB` One specific activity that currently feels difficult (S4).
- `SB` User-authored smaller, manageable steps for that activity (S4).
- `SB` The relationship between activity, avoidance, and mood is part of formal
  behavioural activation treatment (S3); it is context, not a product claim.
- `PI` Optional reason, timing window, expected effort, likely barrier, support
  preference, and done/changed/skipped reflection.
- `OG` No streak penalty, shame copy, escalating target, or recommendation to
  ignore pain, illness, disability, unsafe conditions, or clinician advice.

**Not supported:** calling the planner behavioural activation, prescribing an
activity dose, predicting mood benefit, or treating depression.

**Concise user copy:** "Choose one small step. It is okay to change or skip it."

### 3. Structured Safety Plan

**Intended role:** a portable record of a plan developed collaboratively with a
qualified clinician, not a self-assessment or emergency service.

- `SB` Personal warning signs or triggers (S1, S2).
- `SB` Internal coping strategies (S1, S2).
- `SB` People or settings that can provide distraction (S1, S2).
- `SB` Family members or friends who can help (S1, S2).
- `SB` Professionals, crisis services, and agencies to contact (S1, S2).
- `SB` Agreed actions to make the environment safer and reduce access to lethal
  means (S2).
- `PI` Plan owner, clinician name, locale, created/reviewed dates, preferred
  order, availability status, and a user-controlled share/export record.
- `OG` The feature must distinguish "use my plan" from "get urgent help now,"
  show verified local emergency options without requiring sign-in, and state
  that MHtoolkit does not monitor the plan or contact help automatically.

**Not supported:** suicide screening, risk stratification, prediction,
prevention guarantees, or a claim that completing the form is the Safety
Planning Intervention.

**Concise user copy:** "Make this plan with a qualified clinician. If you may act
now or cannot stay safe, call local emergency services now."

### 4. Staying Well / Recovery Plan

**Intended role:** a user-owned reflection and contingency plan after improvement
or during ongoing care.

- `SB` Lessons learned and strategies that were helpful (S3).
- `SB` Concrete actions to maintain progress and continue useful practices (S3).
- `SB` Stressful circumstances, triggers, warning signs, sleep changes,
  avoidance, or rumination that preceded worsening (S3, S4).
- `SB` A specific response plan for each warning sign or challenge (S3, S4).
- `SB` Anticipated difficult events, life changes, or anniversaries (S3).
- `PI` Strengths, supportive routines, people to contact, care-team details,
  preferred review date, and links to the user's other plans.
- `OG` The plan may not recommend starting, stopping, or changing medication or
  treatment. Worsening or crisis content must route to appropriate help.

**Not supported:** predicting or preventing relapse, certifying recovery, or
replacing a clinician-led relapse-prevention plan.

**Concise user copy:** "Note what helps you stay well and what to do if things
change."

### 5. Sleep Diary

**Intended role:** a self-report log the user can review or share.

- `SB` Date; bedtime; time out of bed; estimated hours in bed (S6).
- `SB` Number of awakenings and estimated total time awake (S6).
- `SB` Estimated time to fall asleep and medicines taken (S6).
- `SB` Morning alertness (S6).
- `SB` Caffeinated and alcoholic drinks with times (S6).
- `SB` Nap and exercise times and durations (S6).
- `SB` Daytime sleepiness (S6).
- `PI` Optional free-text context, reminders, charts, and deterministic duration
  calculations clearly marked as estimates.
- `OG` Entries are optional and sensitive. Missing values stay missing. The
  system must not turn medicine, alcohol, or sleep entries into diagnoses,
  warnings, or treatment instructions without a separately reviewed rule.

**Not supported:** sleep-quality scoring, sleep-efficiency interpretation,
insomnia or sleep-apnea detection, medication advice, or improved sleep claims.

**Concise user copy:** "Track what you remember. Estimates are okay."

### 6. Partner Support Preferences

**Intended role:** user-controlled instructions for how a chosen supporter may
help and what, if anything, they may see.

- `SB` Social support can be part of activity planning, recovery planning, and a
  safety plan (S2, S4, S5).
- `SB` Sharing sensitive information requires clear purpose, recipients,
  consequences, choice, and withdrawal (S8).
- `PI` Supporter's name/relationship, helpful and unhelpful actions, contact
  preferences, topics/data categories allowed, quiet times, expiry/review date,
  and a separate opt-in crisis role.
- `OG` Every data category defaults to not shared. The user can preview, revoke,
  or change access. Revocation must stop future access and explain any copies
  already exported. Safety-plan content, journal text, and Visit Briefs are never
  shared by merely naming a partner.
- `OG` The flow must support "do not involve this person" and safe exit without
  confrontation advice. It must not assume a partner is safe or benevolent.

**Not supported:** couples therapy, partner monitoring, caregiver authority,
crisis response, guaranteed support, or relationship-safety assessment.

**Concise user copy:** "Sharing is optional. Choose what this person can see and
change it anytime."

### 7. Privacy Activity

**Intended role:** a readable record of material privacy actions and current
choices, backed by authoritative system events.

- `SB` What information is collected (S8).
- `SB` The purpose of collection, use, or disclosure (S8).
- `SB` Recipients or categories of recipients (S8).
- `SB` Meaningful risks or consequences and whether the choice is required or
  optional (S8).
- `SB` Consent choice, significant practice changes, and withdrawal (S8).
- `PI` Event time, actor, affected data category, notice/consent version,
  status, expiry, revocation result, and links to manage or learn more.
- `OG` Do not call the view complete, immutable, or a legal audit trail unless
  every relevant backend event and retention path is verified. Display time
  zone, distinguish pending from completed actions, and never invent a friendly
  summary when the authoritative event is unavailable.

**Not supported:** PIPEDA compliance, complete data lineage, proof of deletion,
or proof that a third party deleted an exported copy.

**Concise user copy:** "See recorded privacy actions and manage your choices."

### 8. Deterministic Visit Brief

**Intended role:** a user-reviewed assembly of selected information for a health
visit. It is not AI-generated and not a clinical summary.

- `SB` Visit goals and the user's questions or concerns (S5).
- `SB` A user-confirmed list of medicines, vitamins, and supplements (S5).
- `SB` User-described symptoms, relevant health history, and problems with
  medicines (S5).
- `SB` Selected sleep-diary information may be brought to a clinician (S6).
- `PI` Fixed section order; user-selected source records; explicit date range;
  top-three question ordering; source label and timestamp per item; omission of
  empty fields; and preview/edit before export.
- `OG` Use deterministic templates only. No model-generated prose, inferred
  diagnosis, severity, causal statement, medication reconciliation, risk score,
  or clinical priority. Preserve the user's words and units. Missing, stale, or
  conflicting data must be visible rather than resolved silently.

**Not supported:** medical-record completeness, clinician approval, diagnostic
accuracy, triage, decision support, or a claim that deterministic output is
necessarily correct.

**Concise user copy:** "Review this brief before you share it. It uses only the
information shown here."

## Required Review Ownership

- A licensed adult mental health clinician with suicide-prevention and safety-
  planning competence must approve Safety Plan structure, copy, crisis routing,
  and failure states before release.
- A licensed adult mental health clinician must review low-energy, activity,
  Staying Well, sleep, partner, and Visit Brief copy for unintended treatment,
  diagnosis, or risk-management claims.
- Privacy counsel or a designated privacy officer must review partner sharing,
  privacy activity, exports, deletion language, consent, and applicable Canadian
  and launch-market requirements.
- Product counsel must clear all source licences, commercial-use limits,
  attribution, adaptation, translation, trademarks, and third-party materials.
- Accessibility review must include keyboard, screen reader, zoom/reflow,
  reduced motion, cognitive load, interruption control, and low-energy-mode
  parity.
- Adults with relevant lived experience must review clarity, burden, coercion
  risks, crisis language, and whether "recovery" or "staying well" wording feels
  accurate and optional.

The release conditions for these reviews are defined in
`clinical-product-safety-release-guardrails.md`.
