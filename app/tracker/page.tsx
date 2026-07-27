'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MoodSelector } from '@/components/mood/mood-selector';
import { MoodEmoji } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';

interface MoodEntry {
  id: string;
  emoji: MoodEmoji;
  note: string | null;
  tags: string[];
  created_at: string;
}

const moodToValue: Record<MoodEmoji, number> = {
  '😄': 5,
  '🙂': 4,
  '😐': 3,
  '😞': 2,
  '😢': 1,
};

export default function TrackerPage() {
  const { query, user } = useDataContext();
  
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddMood, setShowAddMood] = useState(false);
  const [newMood, setNewMood] = useState<MoodEmoji | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newTags, setNewTags] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!query) return;
    let active = true;

    const loadMoods = async () => {
      try {
        setLoading(true);
        const monthStart = startOfMonth(selectedDate).toISOString();
        const monthEnd = endOfMonth(selectedDate).toISOString();

        let queryBuilder = supabase
          .from('moods')
          .select('*')
          .eq(query.column, query.value)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)
          .order('created_at', { ascending: false });

        if (filterTag) {
          queryBuilder = queryBuilder.contains('tags', [filterTag]);
        }

        const { data } = await queryBuilder;

        if (active && data) {
          setMoods(data);
        }
      } catch (error) {
        console.error('Error loading moods:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadMoods();

    return () => {
      active = false;
    };
  }, [query, selectedDate, filterTag, refreshKey]);

  const handleAddMood = async () => {
    if (!newMood || !user?.id || saving) return;

    try {
      setSaving(true);
      const tags = newTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);

      await saveCheckInWithAttribution({
        emoji: newMood,
        note: newNote || null,
        tags,
        ...getLocalCheckInFields(),
      });

      setNewMood(null);
      setNewNote('');
      setNewTags('');
      setShowAddMood(false);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      console.error('Error adding mood:', error);
    } finally {
      setSaving(false);
    }
  };

  const getChartData = () => {
    const last30Days = eachDayOfInterval({
      start: subMonths(new Date(), 1),
      end: new Date(),
    });

    return last30Days.map((day) => {
      const dayMoods = moods.filter(
        (m) => format(new Date(m.created_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );

      const avgValue = dayMoods.length > 0
        ? dayMoods.reduce((sum, m) => sum + moodToValue[m.emoji], 0) / dayMoods.length
        : null;

      return {
        date: format(day, 'MMM dd'),
        mood: avgValue,
      };
    });
  };

  const getAllTags = () => {
    const tagSet = new Set<string>();
    moods.forEach((mood) => {
      mood.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet);
  };

  const exportMoods = () => {
    const csv = [
      ['Date', 'Mood', 'Note', 'Tags'],
      ...moods.map((m) => [
        format(new Date(m.created_at), 'yyyy-MM-dd HH:mm'),
        m.emoji,
        m.note || '',
        m.tags.join('; '),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mood-journal-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const chartData = getChartData();
  const allTags = getAllTags();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Mood Tracker</h1>
            <p className="text-muted-foreground">Your emotional journey over time</p>
          </div>
          <Button onClick={() => setShowAddMood(true)}>Add Mood</Button>
        </div>

        {showAddMood && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Add Mood Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>How are you feeling?</Label>
                  <div className="mt-2">
                    <MoodSelector selected={newMood} onSelect={setNewMood} size="sm" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="note">Note (optional)</Label>
                  <Textarea
                    id="note"
                    placeholder="What's affecting your mood?"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., sleep, work, exercise"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddMood} disabled={!newMood || saving}>
                    {saving ? 'Saving...' : 'Save Mood'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddMood(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mood Trend Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>30-Day Mood Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filter Tags */}
        {allTags.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filter by Tag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterTag === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterTag(null)}
                >
                  All
                </Button>
                {allTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={filterTag === tag ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mood History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mood History</CardTitle>
            <Button variant="outline" size="sm" onClick={exportMoods}>
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : moods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No mood entries for this period
              </div>
            ) : (
              <div className="space-y-4">
                {moods.map((mood) => (
                  <div key={mood.id} className="flex gap-4 p-4 border rounded-lg">
                    <div className="text-4xl">{mood.emoji}</div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground mb-1">
                        {format(new Date(mood.created_at), 'MMMM dd, yyyy - h:mm a')}
                      </div>
                      {mood.note && (
                        <p className="text-foreground mb-2">{mood.note}</p>
                      )}
                      {mood.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {mood.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-xs bg-secondary px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
