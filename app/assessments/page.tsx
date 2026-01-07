'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ASSESSMENTS } from '@/lib/assessments/definitions';

export default function AssessmentsPage() {
  const router = useRouter();

  const assessments = [
    {
      ...ASSESSMENTS.GAD7,
      icon: '😰',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      ...ASSESSMENTS.PHQ9,
      icon: '😔',
      color: 'bg-purple-50 border-purple-200',
    },
    {
      ...ASSESSMENTS.CBI,
      icon: '😓',
      color: 'bg-orange-50 border-orange-200',
    },
    {
      ...ASSESSMENTS.PSS4,
      icon: '😬',
      color: 'bg-green-50 border-green-200',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Self-Assessments</h1>
          <p className="text-slate-600">
            Quick, clinically-backed assessments to help you understand where you are
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {assessments.map((assessment) => (
            <Card
              key={assessment.type}
              className={`${assessment.color} cursor-pointer hover:shadow-lg transition-shadow`}
              onClick={() => router.push(`/assessments/${assessment.type.toLowerCase()}`)}
            >
              <CardHeader>
                <div className="text-4xl mb-2">{assessment.icon}</div>
                <CardTitle>{assessment.name}</CardTitle>
                <CardDescription>{assessment.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">
                  {assessment.questions.length} questions • {Math.ceil(assessment.questions.length * 0.5)} min
                </p>
                <Button className="w-full">
                  Take Assessment
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="text-3xl">ℹ️</div>
              <div>
                <h3 className="font-semibold mb-2">About These Assessments</h3>
                <p className="text-sm text-slate-700">
                  These assessments are screening tools, not diagnostic instruments. They can help
                  you understand your symptoms, but they don't replace professional evaluation. If
                  you're concerned about your mental health, please consult a healthcare provider.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


