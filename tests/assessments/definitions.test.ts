import { describe, expect, it } from 'vitest';
import {
  ASSESSMENTS,
  CBI,
  GAD7,
  hasPositivePhq9SafetyResponse,
  PHQ9,
} from '../../lib/assessments/definitions';
import {
  ASSESSMENTS as MOBILE_ASSESSMENTS,
  CBI as MOBILE_CBI,
} from '../../mobile/lib/assessments/definitions';

function responses(count: number, value: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`q${index + 1}`, value])
  );
}

describe('published assessment administration', () => {
  it('exposes only tools with documented reproduction permission', () => {
    expect(Object.keys(ASSESSMENTS)).toEqual(['GAD7', 'PHQ9', 'CBI']);
    expect(Object.keys(MOBILE_ASSESSMENTS)).toEqual(['GAD7', 'PHQ9', 'CBI']);
  });

  it('uses the published two-week administration prompt for GAD-7 and PHQ-9', () => {
    for (const assessment of [GAD7, PHQ9]) {
      expect(assessment.timeframe).toBe('Past 2 weeks');
      expect(assessment.instructions).toBe(
        'Over the last 2 weeks, how often have you been bothered by the following problems?'
      );
      expect(assessment.questions[0].options.map((option) => option.value)).toEqual([
        0, 1, 2, 3,
      ]);
      expect(assessment.functioningQuestion?.text).toBe(
        'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?'
      );
      expect(assessment.functioningQuestion?.options.map((option) => option.label)).toEqual([
        'Not difficult at all',
        'Somewhat difficult',
        'Very difficult',
        'Extremely difficult',
      ]);
    }
  });

  it('scores GAD-7 and applies the published symptom ranges', () => {
    expect(GAD7.calculateScore(responses(7, 3))).toBe(21);
    expect(GAD7.calculateScore({ ...responses(7, 3), functioning: 0 })).toBe(21);
    expect(GAD7.interpret(4).level).toBe('Minimal anxiety symptom range');
    expect(GAD7.interpret(5).level).toBe('Mild anxiety symptom range');
    expect(GAD7.interpret(10).level).toBe('Moderate anxiety symptom range');
    expect(GAD7.interpret(15).level).toBe('Severe anxiety symptom range');
    expect(GAD7.interpret(21).suggestions.join(' ')).not.toContain('988');
  });

  it('scores PHQ-9 and applies the published symptom ranges', () => {
    expect(PHQ9.calculateScore(responses(9, 3))).toBe(27);
    expect(PHQ9.calculateScore({ ...responses(9, 3), functioning: 3 })).toBe(27);
    expect(PHQ9.interpret(4).level).toBe('Minimal depression symptom range');
    expect(PHQ9.interpret(5).level).toBe('Mild depression symptom range');
    expect(PHQ9.interpret(10).level).toBe('Moderate depression symptom range');
    expect(PHQ9.interpret(15).level).toBe('Moderately severe depression symptom range');
    expect(PHQ9.interpret(20).level).toBe('Severe depression symptom range');
  });

  it('flags any positive PHQ-9 item 9 response independently of the total score', () => {
    expect(hasPositivePhq9SafetyResponse(PHQ9, { q9: 0 })).toBe(false);
    expect(hasPositivePhq9SafetyResponse(PHQ9, { q9: 1 })).toBe(true);
    expect(hasPositivePhq9SafetyResponse(GAD7, { q9: 3 })).toBe(false);
  });

  it('uses all five published CBI response options and a rounded 0-100 average', () => {
    expect(CBI.maxScore).toBe(100);
    expect(CBI.questions[0].options.map((option) => option.value)).toEqual([
      0, 25, 50, 75, 100,
    ]);
    expect(CBI.calculateScore(responses(6, 0))).toBe(0);
    expect(CBI.calculateScore(responses(6, 100))).toBe(100);
    expect(
      CBI.calculateScore({ q1: 0, q2: 25, q3: 50, q4: 75, q5: 100, q6: 100 })
    ).toBe(58);
    expect(CBI.interpret(100).message).toContain('does not define a universal individual cutoff');
  });

  it('rejects incomplete or invalid response sets', () => {
    expect(() => GAD7.calculateScore({ q1: 0 })).toThrow(
      'Assessment responses are incomplete or invalid'
    );
    expect(() => CBI.calculateScore(responses(6, 4))).toThrow(
      'Assessment responses are incomplete or invalid'
    );
  });

  it('keeps mobile scoring aligned with web scoring', () => {
    const sample = { q1: 0, q2: 25, q3: 50, q4: 75, q5: 100, q6: 100 };
    expect(MOBILE_CBI.calculateScore(sample)).toBe(CBI.calculateScore(sample));
    expect(MOBILE_CBI.scoreMeaning).toBe(CBI.scoreMeaning);
  });
});
