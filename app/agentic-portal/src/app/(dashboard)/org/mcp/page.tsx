'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Server, Plus, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

export default function MCPHubPage() {
  // TODO: Fetch from API - for now show coming soon state
  const mcpServers: {
    id: string;
    name: string;
    description: string;
    url: string;
    status: 'connected' | 'disconnected';
    tools: number;
  }[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tool Integrations</h1>
          <p className="text-muted-foreground mt-1">Advanced: connect external tools for AI assistants</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add MCP Server
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search integration servers..."
          className="pl-10 max-w-md border-border bg-card"
        />
      </div>

      {/* MCP Servers List */}
      {mcpServers.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Server className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No MCP servers connected</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Connect MCP servers to give your AI agents access to external tools, databases, and APIs.
            </p>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add MCP Server
            </Button>
            <div className="mt-8 p-4 bg-muted/30 rounded-lg text-left max-w-md">
              <p className="text-sm font-medium mb-2">What is MCP?</p>
              <p className="text-sm text-muted-foreground">
                Model Context Protocol (MCP) is an open standard for connecting AI assistants to external data sources and tools. 
                It enables secure, standardized integrations.
              </p>
              <a 
                href="https://modelcontextprotocol.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline mt-2 inline-flex items-center"
              >
                Learn more about MCP
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {mcpServers.map((server) => (
            <div key={server.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Server className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{server.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{server.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="font-mono">{server.url}</span>
                      <span>{server.tools} tools</span>
                    </div>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={server.status === 'connected' 
                    ? 'text-green-600 border-green-200 bg-green-50' 
                    : 'text-red-600 border-red-200 bg-red-50'
                  }
                >
                  {server.status === 'connected' ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" /> Disconnected</>
                  )}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
