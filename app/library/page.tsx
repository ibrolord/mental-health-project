'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';

interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  takeaways: string[];
  quote: string | null;
  action_step: string | null;
  tags: string[];
  read_time_minutes: number;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    filterBooks();
  }, [searchQuery, selectedTag, books]);

  const loadBooks = async () => {
    try {
      const { data } = await supabase
        .from('books')
        .select('*')
        .order('title', { ascending: true });

      if (data) {
        setBooks(data);
        setFilteredBooks(data);
      }
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBooks = () => {
    let filtered = books;

    if (searchQuery) {
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          book.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTag) {
      filtered = filtered.filter((book) => book.tags.includes(selectedTag));
    }

    setFilteredBooks(filtered);
  };

  const getAllTags = () => {
    const tagSet = new Set<string>();
    books.forEach((book) => {
      book.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  const allTags = getAllTags();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (selectedBook) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" onClick={() => setSelectedBook(null)} className="mb-6">
            ← Back to Library
          </Button>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <CardTitle className="text-3xl mb-2">{selectedBook.title}</CardTitle>
                  <CardDescription className="text-lg">by {selectedBook.author}</CardDescription>
                </div>
                <div className="text-sm text-slate-600">
                  {selectedBook.read_time_minutes} min read
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedBook.tags.map((tag) => (
                  <span key={tag} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Summary</h3>
                <p className="text-slate-700">{selectedBook.summary}</p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Key Takeaways</h3>
                <ul className="space-y-2">
                  {selectedBook.takeaways.map((takeaway, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      <span className="text-slate-700">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedBook.quote && (
                <div className="bg-slate-100 border-l-4 border-primary p-4 rounded">
                  <p className="italic text-slate-800">"{selectedBook.quote}"</p>
                </div>
              )}

              {selectedBook.action_step && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                  <h3 className="font-semibold text-lg mb-2">Action Step</h3>
                  <p className="text-slate-700">{selectedBook.action_step}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Book Library</h1>
          <p className="text-slate-600">Quick summaries of essential mental health books</p>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Input
              placeholder="Search books by title, author, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-4"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedTag === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag(null)}
              >
                All
              </Button>
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Book Grid */}
        {filteredBooks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">No books found matching your search.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredBooks.map((book) => (
              <Card
                key={book.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedBook(book)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">{book.title}</CardTitle>
                      <CardDescription>by {book.author}</CardDescription>
                    </div>
                    <div className="text-sm text-slate-500">{book.read_time_minutes} min</div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {book.tags.map((tag) => (
                      <span key={tag} className="bg-slate-200 px-2 py-1 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 text-sm line-clamp-3">{book.summary}</p>
                  <Button variant="link" className="mt-2 p-0">
                    Read Summary →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

