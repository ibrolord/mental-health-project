'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ASSESSMENTS } from '@/lib/assessments/definitions';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';

export default function AssessmentTakePage() {
  const router = useRouter();
  const params = useParams();
  const { context } = useDataContext();
  
  const type = (params.type as string).toUpperCase() as keyof typeof ASSESSMENTS;
  const assessment = ASSESSMENTS[type];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const showCrisisSupport = assessment?.type === 'PHQ9' && (responses.q9 ?? 0) > 0;

  if (!assessment) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Assessment not found</h1>
          <Button onClick={() => router.push('/assessments')}>
            Back to Assessments
          </Button>
        </div>
      </main>
    );
  }

  const handleAnswer = (value: number) => {
    const activeQuestion = assessment.questions[currentQuestion];
    const newResponses = {
      ...responses,
      [activeQuestion.id]: value,
    };
    setResponses(newResponses);

    if (assessment.type === 'PHQ9' && activeQuestion.id === 'q9' && value > 0) {
      window.alert(
        'Immediate Support Available\n\nIf you might hurt yourself or are in immediate danger, call emergency services now. You can call or text 988 in the U.S. or Canada, or text HOME to 741741 for Crisis Text Line.'
      );
    }

    if (currentQuestion < assessment.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate result
      const score = Object.values(newResponses).reduce((sum, val) => sum + val, 0);
      const interpretation = assessment.interpret(score);
      setResult({ score, ...interpretation });
    }
  };

  const handleSaveResult = async () => {
    if (!result) return;

    try {
      setSaving(true);
      await supabase.from('assessments').insert({
        ...context,
        type: assessment.type,
        score: result.score,
        max_score: assessment.maxScore,
        responses,
      } as any);

      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving assessment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  if (result) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Your Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="text-6xl font-bold text-primary mb-2">
                  {result.score}/{assessment.maxScore}
                </div>
                <div className="text-2xl font-semibold mb-4">{result.level}</div>
                <p className="text-slate-700 mb-6">{result.message}</p>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg">
                <h3 className="font-semibold mb-2 text-orange-950">Medical disclaimer</h3>
                <p className="text-sm text-orange-950">
                  This screener is for self-reflection only. It does not diagnose, treat, or
                  replace professional evaluation. Seek advice from a doctor or licensed mental
                  health professional in addition to using this app and before making medical
                  decisions.
                </p>
              </div>

              {showCrisisSupport && (
                <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6 rounded-r-lg">
                  <h3 className="font-semibold mb-2 text-red-900">Immediate Support Available</h3>
                  <p className="text-sm text-red-900">
                    Because you endorsed thoughts of self-harm, please reach out now if you feel unsafe.
                    Call or text 988 in the U.S. or Canada, text HOME to 741741 for Crisis Text Line,
                    or contact local emergency services.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <h3 className="font-semibold mb-2">What to do next:</h3>
                <ul className="space-y-2">
                  {result.suggestions.map((suggestion: string, i: number) => (
                    <li key={i} className="text-sm text-slate-700">
                      • {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-2">Clinical source</h3>
                <p className="text-sm text-slate-700 mb-2">{assessment.source}</p>
                <a
                  href={assessment.citationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline break-words"
                >
                  {assessment.citationUrl}
                </a>
              </div>

              <div className="space-y-3">
                <Button className="w-full" onClick={handleSaveResult} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Result'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const question = assessment.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / assessment.questions.length) * 100;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600">
              Question {currentQuestion + 1} of {assessment.questions.length}
            </span>
            <span className="text-sm text-slate-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{assessment.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg">
              <h3 className="font-semibold mb-2 text-orange-950">Before you begin</h3>
              <p className="text-sm text-orange-950">
                This is a screening tool, not a diagnosis or treatment. Seek advice from a doctor
                or licensed mental health professional in addition to using this app and before
                making medical decisions.
              </p>
            </div>
            <a
              href={assessment.citationUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-6 block text-sm leading-relaxed text-primary hover:underline"
            >
              Source: {assessment.source}
            </a>
            <p className="text-lg mb-6 font-medium">{question.text}</p>

            <div className="space-y-3">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className="w-full p-4 text-left border-2 border-slate-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                >
                  {option.label}
                </button>
              ))}
            </div>

            {currentQuestion > 0 && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={handleBack}
              >
                Back
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
