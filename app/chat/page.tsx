'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const quickPrompts = [
  'I feel anxious',
  'Help me reframe a negative thought',
  'Ground me',
  'I need to talk',
];

export default function ChatPage() {
  const { context } = useDataContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const newMessage: Message = { role: 'user', content };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await response.json();

      if (data.response) {
        setMessages([...updatedMessages, { role: 'assistant', content: data.response }]);
        setShowSave(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const saveConversation = async () => {
    try {
      await supabase.from('chat_history').insert({
        ...context,
        messages,
        saved: true,
      } as any);
      alert('Conversation saved!');
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">AI Support</h1>
            <p className="text-slate-600">Talk through what's on your mind</p>
          </div>
          {showSave && (
            <Button variant="outline" onClick={saveConversation}>
              Save Conversation
            </Button>
          )}
        </div>

        <Card className="mb-4 h-[60vh] flex flex-col">
          <CardContent className="flex-1 overflow-y-auto pt-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-2xl font-semibold mb-2">How can I help?</h2>
                <p className="text-slate-600 mb-6">
                  I'm here to listen and support you. Choose a prompt below or start typing.
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                  {quickPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      onClick={() => handleQuickPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-slate-200 text-slate-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-200 rounded-lg p-4">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What's on your mind?"
                className="flex-1"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button type="submit" disabled={!input.trim() || loading}>
                Send
              </Button>
            </form>
            <p className="text-xs text-slate-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </CardContent>
        </Card>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-slate-700">
            ⚠️ This AI is not a replacement for professional therapy. If you're in crisis, call{' '}
            <strong>988</strong> or text <strong>HELLO</strong> to <strong>741741</strong>.
          </p>
        </div>
      </div>
    </main>
  );
}

