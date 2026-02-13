'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Database,
  Table2,
  BarChart3,
  Save,
  Copy,
  Loader2,
  Bot,
  User,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface QueryResult {
  rows?: Record<string, unknown>[];
  error?: string;
  columns?: { name: string; type: string }[];
  totalRows?: number;
  executionTimeMs?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: QueryResult | Record<string, unknown>[];
  error?: string;
  timestamp: Date;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
}

export default function ChatPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your data assistant. Select a data source and ask me anything about your data. I'll generate SQL queries and visualizations for you.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch data sources from API
  useEffect(() => {
    async function fetchDataSources() {
      try {
        const res = await fetch('/api/datasources');
        if (res.ok) {
          const data = await res.json();
          setDataSources(data.dataSources || []);
        }
      } catch (error) {
        console.error('Failed to fetch data sources:', error);
      } finally {
        setIsLoadingDataSources(false);
      }
    }
    fetchDataSources();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedDataSource) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = input;
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          dataSourceId: selectedDataSource,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || 'Here are your results:',
          sql: data.sql,
          data: data.data?.rows || data.data || data.results,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.error || 'Sorry, something went wrong. Please try again.',
          error: data.error,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
          <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
            <SelectTrigger className="w-[220px] border-border">
              <Database className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder={isLoadingDataSources ? "Loading..." : "Select data source"} />
            </SelectTrigger>
            <SelectContent>
              {dataSources.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No data sources. Add one first.
                </div>
              ) : (
                dataSources.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
          <Sparkles className="w-3 h-3 mr-1" />
          Claude Sonnet
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`flex-1 max-w-[80%] ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3'
                    : ''
                }`}
              >
                {message.error && (
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Error occurred</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* SQL Block */}
                {message.sql && (
                  <div className="mt-4 bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                      <span className="text-sm font-medium text-muted-foreground">Generated SQL</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(message.sql!)} className="h-7 text-xs">
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="text-sm p-4 overflow-x-auto">
                      <code className="text-foreground">{message.sql}</code>
                    </pre>
                  </div>
                )}

                {/* Query Error */}
                {message.data && 'error' in message.data && message.data.error && (
                  <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Query Error</span>
                    </div>
                    <p className="text-sm text-destructive/80 mt-2">{String(message.data.error)}</p>
                  </div>
                )}

                {/* Data Preview */}
                {message.data && Array.isArray(message.data) && message.data.length > 0 && (
                  <div className="mt-4 bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                      <span className="text-sm font-medium text-muted-foreground">
                        Results ({message.data.length} rows)
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Table2 className="w-3 h-3 mr-1" />
                          View All
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Chart
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Save className="w-3 h-3 mr-1" />
                          Save View
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            {Object.keys(message.data[0]).map((key) => (
                              <th key={key} className="text-left px-4 py-2 font-medium text-muted-foreground">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {message.data.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-border last:border-0">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-4 py-2">
                                  {String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {message.data.length > 5 && (
                      <div className="px-4 py-2 text-sm text-muted-foreground border-t border-border bg-muted/20">
                        Showing 5 of {message.data.length} rows
                      </div>
                    )}
                  </div>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="text-muted-foreground">Thinking...</div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedDataSource ? "Ask about your data..." : "Select a data source first..."}
              className="min-h-[48px] max-h-[120px] resize-none border-border"
              disabled={!selectedDataSource || isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button 
              type="submit" 
              size="icon"
              className="h-12 w-12 bg-primary hover:bg-primary/90"
              disabled={!input.trim() || !selectedDataSource || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
