import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasExplicitUrgentSafetyLanguage,
  LOCAL_SAFETY_MESSAGE,
} from '../../mobile/lib/local-safety';
import { CRISIS_LINES } from '../../mobile/lib/resources';

describe('local urgent-safety path', () => {
  it.each([
    'I am suicidal',
    'I want to die',
    "I can't keep myself safe",
    'I am going to end my life',
    'I made a suicide plan',
    'I have a plan to kill myself',
    'I will kill myself',
    'I want to commit suicide',
    'I just took too many pills',
    'I plan to overdose',
    'I will overdose',
    'I am about to overdose',
    'I already overdosed',
    'I am going to shoot myself',
    'I am going to kill you',
    'I will kill you',
    'I am not suicidal, I just took too many pills',
    'I am not suicidal and I want to die',
    'I plan to hurt someone',
  ])('detects an explicit first-person statement: %s', (text) => {
    expect(hasExplicitUrgentSafetyLanguage(text)).toBe(true);
  });

  it.each([
    'I am not suicidal',
    "I don't want to die",
    "I don't want to overdose",
    'I am not going to shoot myself',
    'I have no plan to hurt myself',
    'My friend said they feel hopeless',
    'I feel anxious and overwhelmed',
    'The article discusses suicide prevention',
    "I plan to hurt someone's feelings",
    'I might hurt someone emotionally',
  ])('does not promote ambiguous or negated language: %s', (text) => {
    expect(hasExplicitUrgentSafetyLanguage(text)).toBe(false);
  });

  it('keeps the first response static and non-diagnostic', () => {
    expect(LOCAL_SAFETY_MESSAGE).toContain('reach a person now');
    expect(LOCAL_SAFETY_MESSAGE.toLowerCase()).not.toContain('diagnos');
  });

  it('does not depend on the chat or safety API before showing local actions', () => {
    const chat = readFileSync(
      resolve(process.cwd(), 'mobile/app/(tabs)/chat.tsx'),
      'utf8'
    );
    const localCheck = chat.indexOf('hasExplicitUrgentSafetyLanguage(trimmed)');
    const consentCheck = chat.indexOf('ensureAiDataSharingConsent(ownerKey)', localCheck);

    expect(localCheck).toBeGreaterThan(-1);
    expect(consentCheck).toBeGreaterThan(localCheck);
    expect(chat).toContain('<LocalSafetyActions');
    expect(chat).toContain('if (!trimmed) return;');
    expect(chat).not.toContain('if (!trimmed || saveRef.current) return;');
    expect(chat).toContain(
      'const sendDisabled = !input.trim() || (!urgentInput && interactionDisabled)'
    );
    expect(chat).toContain('messageGenerationRef.current += 1;');
    expect(chat).toContain('messageGenerationRef.current === requestGeneration');
    expect(chat).toContain('activeRequestGenerationRef.current !== requestGeneration');
  });

  it('speaks the voice safety handoff on device without calling an AI voice API', () => {
    const voice = readFileSync(
      resolve(process.cwd(), 'mobile/app/voice.tsx'),
      'utf8'
    );
    const helperStart = voice.indexOf('async function speakLocalSafetyMessage()');
    const helperEnd = voice.indexOf('async function approveRealtimeTurn', helperStart);
    const helper = voice.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(-1);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helper).toContain('Speech.speak(LOCAL_SAFETY_MESSAGE');
    expect(helper).not.toContain('/api/voice');
    expect(voice.match(/await speakLocalSafetyMessage\(\)/g)).toHaveLength(3);
  });

  it('keeps urgent-support actions clear of voice recording controls', () => {
    const voice = readFileSync(
      resolve(process.cwd(), 'mobile/app/voice.tsx'),
      'utf8'
    );

    expect(voice).toContain(
      'const sessionControlsVisible = sessionControlsPinned && !localSafetyOpen'
    );
    expect(voice).toContain('{sessionControlsVisible ? (');
    expect(voice).toContain('onPress={() => void openLocalSafetySupport()}');
    expect(voice).toContain('recording.stopAndUnloadAsync()');
    const supportHelperStart = voice.indexOf('async function openLocalSafetySupport()');
    const recordingGuard = voice.indexOf('if (!recording)', supportHelperStart);
    const supportHelper = voice.slice(supportHelperStart, recordingGuard);
    expect(supportHelper).toContain('disposeRealtimeSession();');
    expect(supportHelper).toContain('fallbackTurnAbortRef.current?.abort();');
    expect(voice).toContain('Talk with MHtoolkit AI. Pause or stop at any time.');
    expect(voice).not.toContain('You’re talking with MHtoolkit AI.');
  });

  it('uses the shared safety actions for PHQ-9 and opens country support directly', () => {
    const assessment = readFileSync(
      resolve(process.cwd(), 'mobile/app/assessments/[type].tsx'),
      'utf8'
    );
    const actions = readFileSync(
      resolve(process.cwd(), 'mobile/components/LocalSafetyActions.tsx'),
      'utf8'
    );
    const resources = readFileSync(
      resolve(process.cwd(), 'mobile/app/resources.tsx'),
      'utf8'
    );

    expect(assessment).toContain('<LocalSafetyActions />');
    expect(assessment).not.toContain("Linking.openURL('tel:988')");
    expect(assessment).not.toContain("Linking.openURL('sms:988')");
    expect(actions).toContain("params: { category: 'country' }");
    expect(resources).toContain('useLocalSearchParams');
    expect(resources).toContain('setCategory(requestedCategory as Category)');
  });
});

describe('verified crisis actions', () => {
  it('uses explicit URIs rather than parsing display numbers', () => {
    const resourcesScreen = readFileSync(
      resolve(process.cwd(), 'mobile/app/resources.tsx'),
      'utf8'
    );

    expect(resourcesScreen).toContain('line.callUri!');
    expect(resourcesScreen).not.toContain("replace(/[^\\d+]/g, '')");
  });

  it('keeps Canada, US, and Veterans actions distinct and safe', () => {
    const canada = CRISIS_LINES.find(({ region }) => region === 'Canada');
    const us = CRISIS_LINES.find(
      ({ name }) => name === '988 Suicide & Crisis Lifeline'
    );
    const veterans = CRISIS_LINES.find(
      ({ name }) => name === 'Veterans Crisis Line'
    );

    expect(canada).toMatchObject({ callUri: 'tel:988', textUri: 'sms:988' });
    expect(us).toMatchObject({ callUri: 'tel:988', textUri: 'sms:988' });
    expect(veterans).toMatchObject({
      phone: '988, then 1',
      callUri: 'tel:988',
      textUri: 'sms:838255',
    });
    expect(veterans?.callUri).not.toBe('tel:9881');
  });
});
