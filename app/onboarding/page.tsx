'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MoodSelector } from '@/components/mood/mood-selector';
import { MoodEmoji } from '@/lib/supabase/types';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';

type Step = 'mood' | 'intention' | 'route';

const intentions = [
  { id: 'organize', label: 'Organize my thoughts', icon: '🧠' },
  { id: 'feel-better', label: 'Feel better emotionally', icon: '💚' },
  { id: 'track', label: 'Track my mental health', icon: '📊' },
  { id: 'habits', label: 'Build good habits', icon: '✅' },
  { id: 'explore', label: 'Just exploring', icon: '🔍' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, authLoading } = useDataContext();
  
  const [step, setStep] = useState<Step>('mood');
  const [mood, setMood] = useState<MoodEmoji | null>(null);
  const [note, setNote] = useState('');
  const [selectedIntentions, setSelectedIntentions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [moodSaved, setMoodSaved] = useState(false);
  const moodSaveInFlightRef = useRef(false);

  const handleMoodNext = async () => {
    if (!mood || !user?.id || moodSaveInFlightRef.current) return;
    if (moodSaved) {
      setStep('intention');
      return;
    }

    moodSaveInFlightRef.current = true;
    try {
      setLoading(true);
      setSaveError('');
      
      await saveCheckInWithAttribution(user.id, {
        emoji: mood,
        note: note || null,
        ...getLocalCheckInFields(),
      });

      setMoodSaved(true);
      setStep('intention');
    } catch (error) {
      console.error('Error saving mood:', error);
      setSaveError('Your check-in was not saved. Please try again.');
    } finally {
      setLoading(false);
      moodSaveInFlightRef.current = false;
    }
  };

  const toggleIntention = (id: string) => {
    setSelectedIntentions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleIntentionNext = () => {
    setStep('route');
  };

  const getRecommendation = () => {
    // Low mood → suggest assessment
    if (mood === '😞' || mood === '😢') {
      return {
        title: 'Take a Quick Assessment',
        description: 'It looks like you might benefit from understanding where you are. A quick assessment can help.',
        route: '/assessments',
        icon: '📋',
      };
    }

    // Overwhelmed → life organizer
    if (selectedIntentions.includes('organize')) {
      return {
        title: 'Organize Your Day',
        description: 'Let\'s bring some structure to your thoughts. Start by setting your daily priorities.',
        route: '/goals',
        icon: '✅',
      };
    }

    // Curious → AI chat
    if (selectedIntentions.includes('explore')) {
      return {
        title: 'Talk to AI',
        description: 'Not sure where to start? Have a conversation with our AI to explore what might help.',
        route: '/chat',
        icon: '💬',
      };
    }

    // Default → dashboard
    return {
      title: 'Go to Dashboard',
      description: 'Let\'s get you started! Your dashboard has everything you need.',
      route: '/dashboard',
      icon: '🏠',
    };
  };

  const recommendation = getRecommendation();

  const handleRoute = (route: string) => {
    router.push(route);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8">
      <div className="max-w-2xl w-full">
        {step === 'mood' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">How are you feeling today?</h1>
                <p className="text-muted-foreground">Choose the emoji that best represents your mood</p>
              </div>

              <div className="mb-8">
                <MoodSelector
                  selected={mood}
                  onSelect={setMood}
                  disabled={loading || moodSaved}
                />
              </div>

              <div className="mb-6">
                <Label htmlFor="note">Add a note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="What's affecting your mood? (e.g., slept 3 hrs, work stress)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={loading || moodSaved}
                  className="mt-2"
                />
              </div>

              {moodSaved && (
                <p role="status" className="mb-4 text-center text-sm text-muted-foreground">
                  Day one is saved. Continue to choose what you want support with.
                </p>
              )}

              <Button
                size="lg"
                className="w-full"
                onClick={handleMoodNext}
                disabled={!mood || !user || authLoading || loading}
              >
                {authLoading
                  ? 'Preparing your private space...'
                  : loading
                    ? 'Saving...'
                    : moodSaved
                      ? 'Continue'
                      : 'Save day one'}
              </Button>
              {saveError && (
                <p role="alert" className="mt-3 text-center text-sm text-red-700">
                  {saveError}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'intention' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">What would you like support with?</h1>
                <p className="text-muted-foreground">Select all that apply</p>
              </div>

              <div className="grid gap-3 mb-8">
                {intentions.map((intention) => (
                  <button
                    key={intention.id}
                    onClick={() => toggleIntention(intention.id)}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                      selectedIntentions.includes(intention.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border'
                    }`}
                  >
                    <span className="text-2xl">{intention.icon}</span>
                    <span className="font-medium">{intention.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setStep('mood')}
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handleIntentionNext}
                  disabled={selectedIntentions.length === 0}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'route' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">{recommendation.icon}</div>
                <h1 className="text-3xl font-bold mb-2">{recommendation.title}</h1>
                <p className="text-muted-foreground">{recommendation.description}</p>
              </div>

              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => handleRoute(recommendation.route)}
                >
                  {recommendation.title}
                </Button>

                <div className="text-center text-sm text-muted-foreground my-4">or choose another path</div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleRoute('/dashboard')}
                  >
                    🏠 Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRoute('/chat')}
                  >
                    💬 Talk to AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRoute('/goals')}
                  >
                    ✅ Set Goals
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRoute('/assessments')}
                  >
                    📋 Assessment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
