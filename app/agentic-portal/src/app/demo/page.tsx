'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, Database, Loader2, ArrowLeft, Table2, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  results?: { columns: string[]; rows: any[] };
}

// Demo data source info
const DEMO_DATASOURCE = {
  id: 'demo-datasource',
  name: 'Demo Database',
  description: 'Sample e-commerce data',
};

// Sample queries for the demo
const SAMPLE_QUERIES = [
  'How many orders are there?',
  'Show me the top 5 products by sales',
  'What is the total revenue?',
  'List all customers from New York',
];

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Welcome to the Agentic Portal demo! 👋\n\nI'm connected to a sample e-commerce database. Try asking questions like:\n• "How many orders are there?"\n• "Show me the top products by sales"\n• "What's the total revenue this month?"\n\nType a question below to get started!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (query?: string) => {
    const userQuery = query || input.trim();
    if (!userQuery || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userQuery,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the demo chat API
      const response = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery }),
      });

      const data = await response.json();

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'Here are the results:',
        sql: data.sql,
        results: data.results,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="font-bold">Agentic Portal Demo</h1>
              <p className="text-xs text-muted-foreground">Try the AI-powered data chat</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
              <Database className="w-4 h-4" />
              {DEMO_DATASOURCE.name}
            </div>
            <Button asChild>
              <Link href="/login?tab=register">Sign Up Free</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Sample queries */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Try these sample questions:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map((query) => (
              <Button
                key={query}
                variant="outline"
                size="sm"
                onClick={() => handleSubmit(query)}
                disabled={isLoading}
              >
                {query}
              </Button>
            ))}
          </div>
        </div>

        {/* Chat messages */}
        <div className="space-y-4 mb-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-white dark:bg-zinc-800 border shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {message.sql && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Generated SQL:</p>
                    <pre className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-xs overflow-x-auto">
                      {message.sql}
                    </pre>
                  </div>
                )}
                
                {message.results && message.results.rows.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Table2 className="w-3 h-3" />
                      {message.results.rows.length} rows
                    </div>
                    <div className="border rounded-lg overflow-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0">
                          <tr>
                            {message.results.columns.map((col) => (
                              <th key={col} className="px-3 py-2 text-left font-medium border-b">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {message.results.rows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-b last:border-0">
                              {message.results!.columns.map((col) => (
                                <td key={col} className="px-3 py-2">
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {message.results.rows.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing 10 of {message.results.rows.length} rows
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-zinc-800 border shadow-sm rounded-lg p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="sticky bottom-4 bg-white dark:bg-zinc-800 border rounded-lg shadow-lg p-2">
          <div className="flex gap-2">
            <Input
              placeholder="Ask a question about the data..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={() => handleSubmit()} disabled={!input.trim() || isLoading}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* CTA */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Ready to connect your own data?</h3>
              <p className="text-muted-foreground mb-4">
                Sign up for free and connect PostgreSQL, BigQuery, Google Sheets, and more.
              </p>
              <Button asChild size="lg">
                <Link href="/login?tab=register">Get Started Free</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
