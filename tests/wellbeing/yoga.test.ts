import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  YOGA_POSES,
  YOGA_PRACTICES,
  yogaPracticeDurationSeconds,
} from '../../lib/wellbeing/yoga';
import {
  YOGA_POSES as MOBILE_POSES,
  YOGA_PRACTICES as MOBILE_PRACTICES,
} from '../../mobile/lib/wellbeing/yoga';
import { EVIDENCE_SOURCES } from '../../lib/wellbeing/evidence';

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), file), 'utf8');

describe('guided yoga catalog', () => {
  it('keeps web and Expo practices and pose descriptions aligned', () => {
    expect(MOBILE_PRACTICES).toEqual(YOGA_PRACTICES);
    expect(
      Object.values(MOBILE_POSES).map(({ id, name, imageAlt }) => ({ id, name, imageAlt }))
    ).toEqual(
      Object.values(YOGA_POSES).map(({ id, name, imageAlt }) => ({ id, name, imageAlt }))
    );
  });

  it('has unique, bounded practices with valid illustrated steps', () => {
    expect(new Set(YOGA_PRACTICES.map(({ id }) => id)).size).toBe(YOGA_PRACTICES.length);
    expect(YOGA_PRACTICES.some(({ setting }) => setting === 'chair')).toBe(true);
    expect(YOGA_PRACTICES.some(({ setting }) => setting === 'floor')).toBe(true);

    for (const practice of YOGA_PRACTICES) {
      expect(practice.steps.length).toBeGreaterThanOrEqual(3);
      expect(yogaPracticeDurationSeconds(practice)).toBeGreaterThanOrEqual(180);
      expect(yogaPracticeDurationSeconds(practice)).toBeLessThanOrEqual(600);
      expect(practice.safetyNote.length).toBeGreaterThan(20);
      for (const step of practice.steps) {
        expect(YOGA_POSES[step.poseId]).toBeDefined();
        expect(step.seconds).toBeGreaterThan(0);
      }
    }
  });

  it('avoids advanced postures, breath holds, and treatment promises', () => {
    const catalogText = JSON.stringify(YOGA_PRACTICES).toLowerCase();
    expect(catalogText).not.toMatch(
      /headstand|shoulder stand|lotus|forceful breath|hold your breath|cure|treats depression/
    );
  });

  it('uses direction-specific side-reach visuals and descriptions', () => {
    const chairSteps = YOGA_PRACTICES.find(({ id }) => id === 'chair-reset')!.steps;
    const left = chairSteps.find(({ label }) => label === 'Reach left')!;
    const right = chairSteps.find(({ label }) => label === 'Reach right')!;

    expect(left.poseId).toBe(right.poseId);
    expect(left.mirrorImage).not.toBe(true);
    expect(right.mirrorImage).toBe(true);
    expect(left.imageAlt).toContain('left');
    expect(right.imageAlt).toContain('right');
  });

  it('ships optimized original pose art in both clients', () => {
    for (const pose of Object.values(YOGA_POSES)) {
      const fileName = pose.imagePath.split('/').at(-1);
      expect(fileName).toBeTruthy();
      const digests: string[] = [];
      for (const root of ['public/images/yoga', 'mobile/assets/yoga']) {
        const file = resolve(process.cwd(), root, fileName!);
        expect(statSync(file).size).toBeGreaterThan(20_000);
        expect(statSync(file).size).toBeLessThan(500_000);
        digests.push(createHash('sha256').update(readFileSync(file)).digest('hex'));
      }
      expect(digests[0]).toBe(digests[1]);
    }
  });

  it('connects every catalog citation to the reviewed evidence registry', () => {
    const sourceIds = new Set(EVIDENCE_SOURCES.map(({ id }) => id));
    for (const practice of YOGA_PRACTICES) {
      for (const evidenceId of practice.evidenceIds) {
        expect(sourceIds.has(evidenceId)).toBe(true);
      }
    }
  });
});

describe('guided yoga integration boundaries', () => {
  it('renders the active pose, guided controls, safety exit, and evidence link on web', () => {
    const page = source('app/yoga/page.tsx');
    expect(page).toContain('src={currentPose.imagePath}');
    expect(page).toContain("role=\"status\"");
    expect(page).toContain("document.addEventListener('visibilitychange'");
    expect(page).toContain('Optional wellbeing support, not treatment or individualized advice.');
    expect(page).toContain('<OptionalSoundscape');
    expect(page).toContain('href="/research#movement"');
  });

  it('uses static bundled images and accessible guided visuals on Expo', () => {
    const page = source('mobile/app/yoga.tsx');
    expect(page).toContain("require('@/assets/yoga/seated-arrival.jpg')");
    expect(page).toContain("require('@/assets/yoga/tabletop-neutral.jpg')");
    expect(page).toContain('accessibilityLabel={step.imageAlt ?? pose.imageAlt}');
    expect(page).toContain('renderStepVisual');
    expect(page).toContain('Stop for pain, dizziness, numbness, or breathing difficulty.');
    expect(page).toContain("options={['off', 'rain', 'ocean']}");
    const guidedPractice = source('mobile/components/GuidedPractice.tsx');
    expect(guidedPractice).toContain('AccessibilityInfo.announceForAccessibility');
    expect(guidedPractice).toContain('!timer.running ||');
    expect(guidedPractice).not.toContain('[activeStep, steps, timer.complete, timer.running]');
    expect(guidedPractice).toContain('accessibilityLabel={`Go to step');
    expect(guidedPractice).toContain("AppState.addEventListener('change'");
    expect(guidedPractice).toContain('accessibilityLabel="Practice progress"');
    expect(guidedPractice).toContain('Paused while the app was in the background.');
  });

  it('has dedicated iOS release gates for yoga behavior and accessibility', () => {
    const checklist = source('mobile/qa/ios-release-checklist.json');
    for (const id of [
      'wellbeing.yoga-directional-art',
      'wellbeing.yoga-timer-lifecycle',
      'wellbeing.yoga-voiceover',
      'wellbeing.yoga-targets',
      'wellbeing.yoga-audio-cleanup',
      'wellbeing.yoga-restart',
      'wellbeing.yoga-progress',
    ]) {
      expect(checklist).toContain(`\"id\": \"${id}\"`);
    }
  });

  it('adds yoga to navigation and optional go-to actions without making it a default', () => {
    expect(source('lib/navigation.ts')).toContain("href: '/yoga'");
    expect(source('mobile/app/(tabs)/more.tsx')).toContain("route: '/yoga'");
    expect(source('mobile/app/_layout.tsx')).toContain('name="yoga"');
    expect(source('lib/wellbeing/go-to-actions.ts')).toContain("{ id: 'yoga', label: 'Yoga'");
    expect(source('lib/wellbeing/go-to-actions.ts')).not.toContain("{ toolId: 'yoga', cue: '' }");
  });
});
