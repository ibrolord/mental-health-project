'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ASSESSMENTS,
  hasPositivePhq9SafetyResponse,
} from '@/lib/assessments/definitions';
import type { Assessment } from '@/lib/assessments/types';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';

type AssessmentResult = ReturnType<Assessment['interpret']> & {
  score: number;
};

function SafetySupport() {
  return (
    <section
      className="rounded-2xl border-2 border-red-700 bg-red-50 p-5 text-red-950"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">Please pause and check your safety</h2>
          <p className="mt-2 text-sm leading-6">
            You reported thoughts of being better off dead or hurting yourself. This answer does
            not show whether you intend to act, so it should be followed up directly with a
            qualified professional.
          </p>
          <p className="mt-2 text-sm font-medium leading-6">
            If you may act on these thoughts or cannot stay safe, call your local emergency number
            now or go to the nearest emergency department. In the U.S. or Canada, call or text 988.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="tel:988"
              className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Call 988
            </a>
            <a
              href="sms:988"
              className="rounded-lg border border-red-800 px-4 py-2 text-sm font-semibold text-red-900"
            >
              Text 988
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AssessmentTakePage() {
  const router = useRouter();
  const params = useParams();
  const { context } = useDataContext();
  const type = (params.type as string).toUpperCase() as keyof typeof ASSESSMENTS;
  const assessment = ASSESSMENTS[type];

  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!assessment) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f1e8] px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Assessment not found</h1>
          <Button className="mt-5" onClick={() => router.push('/assessments')}>
            Back to assessments
          </Button>
        </div>
      </main>
    );
  }

  const functioningQuestion = assessment.functioningQuestion;
  const questions = functioningQuestion
    ? [...assessment.questions, functioningQuestion]
    : assessment.questions;
  const question = questions[currentQuestion];
  const selectedValue = question ? responses[question.id] : undefined;
  const showSafetySupport = hasPositivePhq9SafetyResponse(assessment, responses);
  const functioningResponse = functioningQuestion
    ? functioningQuestion.options.find(
        (option) => option.value === responses[functioningQuestion.id]
      )?.label
    : undefined;

  const handleNext = () => {
    if (!question || selectedValue === undefined) return;

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((current) => current + 1);
      return;
    }

    const score = assessment.calculateScore(responses);
    setResult({ score, ...assessment.interpret(score) });
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((current) => current - 1);
    } else {
      setStarted(false);
    }
  };

  const handleSaveResult = async () => {
    if (!result) return;

    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('assessments').insert({
      ...context,
      type: assessment.type,
      score: result.score,
      max_score: assessment.maxScore,
      responses,
    } as never);

    if (error) {
      console.error('Error saving assessment:', error);
      setSaveError('Your result was not saved. You can try again or continue without saving.');
      setSaving(false);
      return;
    }

    router.push('/dashboard');
  };

  const handleRetake = () => {
    setResponses({});
    setCurrentQuestion(0);
    setResult(null);
    setSaveError(null);
    setStarted(false);
  };

  if (!started) {
    return (
      <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => router.push('/assessments')}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All assessments
          </button>

          <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-card shadow-[0_24px_70px_rgba(23,63,56,0.12)]">
            <div className="bg-[#173f38] px-6 py-8 text-white md:px-10">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
                {assessment.measureType}
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl md:text-5xl">
                {assessment.name}
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-emerald-50/85">
                {assessment.description}
              </p>
            </div>

            <div className="space-y-7 p-6 md:p-10">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-secondary/50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recall period
                  </dt>
                  <dd className="mt-1 font-semibold text-foreground">{assessment.timeframe}</dd>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Length
                  </dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {assessment.functioningQuestion
                      ? `${assessment.questions.length} scored + 1 impact`
                      : `${assessment.questions.length} questions`}
                  </dd>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Reviewed
                  </dt>
                  <dd className="mt-1 font-semibold text-foreground">{assessment.reviewedAt}</dd>
                </div>
              </dl>

              <div>
                <h2 className="font-semibold text-foreground">Use the same frame for every answer</h2>
                <p className="mt-2 text-lg leading-7 text-foreground">{assessment.instructions}</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-amber-950">Before you begin</h2>
                    <p className="mt-1 text-sm leading-6 text-amber-950/85">
                      This tool cannot diagnose a condition, identify the cause of symptoms, or
                      recommend treatment. A qualified professional considers your history,
                      functioning, physical health, medications, and context. You choose whether
                      to save the result after you finish. Seek a doctor&apos;s advice in addition
                      to using this app and before making medical decisions.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm leading-6 text-muted-foreground">{assessment.scoreMeaning}</p>
                <a
                  href={assessment.citationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4"
                >
                  Read the published source
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <Button
                className="h-12 w-full bg-emerald-950 text-base hover:bg-emerald-900"
                onClick={() => setStarted(true)}
              >
                Begin
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
        <div className="mx-auto max-w-3xl space-y-5">
          <section className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-card shadow-[0_24px_70px_rgba(23,63,56,0.12)]">
            <div className="bg-[#173f38] px-6 py-8 text-white md:px-10">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
                Your result
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="font-[family-name:var(--font-display)] text-6xl">
                    {result.score}
                    <span className="text-2xl text-emerald-100">/{assessment.maxScore}</span>
                  </div>
                  <h1 className="mt-2 text-xl font-semibold">{result.level}</h1>
                </div>
                <p className="max-w-xs text-sm leading-6 text-emerald-50/80">
                  Based on {assessment.timeframe.toLowerCase()}
                </p>
              </div>
            </div>

            <div className="space-y-7 p-6 md:p-10">
              <div>
                <h2 className="font-semibold text-foreground">What this score means</h2>
                <p className="mt-2 leading-7 text-foreground">{result.message}</p>
              </div>

              {showSafetySupport && <SafetySupport />}

              {functioningResponse && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <h2 className="font-semibold text-emerald-950">Daily-life impact</h2>
                  <p className="mt-2 text-lg text-emerald-950">{functioningResponse}</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-950/75">
                    This context answer is part of the published form but is not included in the
                    total score.
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-sky-50 p-5">
                <h2 className="font-semibold text-sky-950">Reasonable next steps</h2>
                <ul className="mt-3 space-y-3">
                  {result.suggestions.map((suggestion) => (
                    <li key={suggestion} className="flex gap-3 text-sm leading-6 text-sky-950/85">
                      <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border p-5">
                <h2 className="font-semibold text-foreground">Important limitation</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Screening scores are one piece of information. They do not diagnose, rule out
                  other causes, or replace an assessment by a doctor or licensed mental health
                  professional.
                </p>
                <a
                  href={assessment.citationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"
                >
                  Published source
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              {saveError && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  {saveError}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-12 bg-emerald-950 hover:bg-emerald-900"
                  onClick={handleSaveResult}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save result'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => router.push('/dashboard')}
                >
                  Continue without saving
                </Button>
              </div>
              <button
                type="button"
                onClick={handleRetake}
                className="w-full text-sm font-semibold text-muted-foreground underline underline-offset-4"
              >
                Start over
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-emerald-950/10"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={questions.length}
            aria-valuenow={currentQuestion + 1}
          >
            <div
              className="h-full rounded-full bg-emerald-800 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <section className="rounded-[2rem] border border-emerald-950/10 bg-card p-6 shadow-[0_24px_70px_rgba(23,63,56,0.1)] md:p-10">
          <p className="text-sm font-semibold text-emerald-800">
            {question.contextLabel ?? assessment.instructions}
          </p>
          <h1 className="mt-4 text-2xl font-semibold leading-9 text-foreground">{question.text}</h1>

          <div className="mt-7 grid gap-3">
            {question.options.map((option) => {
              const isSelected = selectedValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setResponses((current) => ({
                      ...current,
                      [question.id]: option.value,
                    }))
                  }
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-emerald-900 bg-emerald-50 text-emerald-950'
                      : 'border-border text-foreground hover:border-emerald-700'
                  }`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border ${
                      isSelected ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-border'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>

          {showSafetySupport && (
            <div className="mt-6">
              <SafetySupport />
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" className="h-11 sm:min-w-28" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button
              className="h-11 bg-emerald-950 hover:bg-emerald-900 sm:min-w-32"
              onClick={handleNext}
              disabled={selectedValue === undefined}
            >
              {currentQuestion === questions.length - 1 ? 'See result' : 'Next'}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
