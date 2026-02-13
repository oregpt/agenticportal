'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Bot, MoreHorizontal, Zap, Settings, Trash2, Copy, Plug, Key, Brain, FileText, Sparkles } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  defaultModel: string;
  systemInstructions?: string;
  createdAt: string;
}

interface MCPServer {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

// Mock MCP servers for now
const mockMCPServers: MCPServer[] = [
  { id: '1', name: 'bigquery-public', status: 'active' },
  { id: '2', name: 'web-tools', status: 'active' },
  { id: '3', name: 'slack-mcp', status: 'inactive' },
];

const llmModels = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
];

export default function OrgAgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', instructions: '' });
  const [isCreating, setIsCreating] = useState(false);
  
  // Config panel state
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState('settings');
  const [agentConfig, setAgentConfig] = useState({
    model: 'claude-sonnet-4-20250514',
    systemInstructions: '',
    mcpServers: [] as string[],
    apiKeys: {
      anthropic: '',
      openai: '',
    }
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch('/api/org/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createAgent() {
    if (!newAgent.name.trim()) return;
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/org/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      
      if (res.ok) {
        setNewAgent({ name: '', description: '', instructions: '' });
        setShowCreateDialog(false);
        fetchAgents();
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setIsCreating(false);
    }
  }

  function openConfig(agent: Agent) {
    setSelectedAgent(agent);
    setAgentConfig({
      model: agent.defaultModel || 'claude-sonnet-4-20250514',
      systemInstructions: agent.systemInstructions || '',
      mcpServers: [],
      apiKeys: { anthropic: '', openai: '' }
    });
    setConfigOpen(true);
  }

  async function deleteAgent(agent: Agent) {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    
    try {
      const res = await fetch(`/api/org/agents/${agent.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAgents();
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  }

  function duplicateAgent(agent: Agent) {
    setNewAgent({
      name: `${agent.name} (Copy)`,
      description: agent.description || '',
      instructions: agent.systemInstructions || ''
    });
    setShowCreateDialog(true);
  }

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Agents</h1>
        <p className="text-muted-foreground mt-1">Configure AI agents for your organization</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create AI Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent for your team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  placeholder="Data Analyst"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-description">Description</Label>
                <Input
                  id="agent-description"
                  placeholder="Helps analyze data and create reports"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-instructions">Instructions</Label>
                <Textarea
                  id="agent-instructions"
                  placeholder="You are a helpful data analyst..."
                  rows={4}
                  value={newAgent.instructions}
                  onChange={(e) => setNewAgent({ ...newAgent, instructions: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createAgent} disabled={isCreating || !newAgent.name.trim()}>
                {isCreating ? 'Creating...' : 'Create Agent'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first AI agent to help your team work with data
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <div 
              key={agent.id} 
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md hover:border-primary/20 transition-all"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Teal icon - ccview.io style */}
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{agent.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-xs font-normal">
                      {agent.slug}
                    </Badge>
                  </div>
                </div>
                
                {/* Dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openConfig(agent)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateAgent(agent)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => deleteAgent(agent)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {agent.description || 'No description'}
              </p>

              {/* Model badge */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-mono">{agent.defaultModel}</span>
              </div>

              {/* Configure button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-border hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                onClick={() => openConfig(agent)}
              >
                <Settings className="h-3.5 w-3.5 mr-2" />
                Configure
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Agent Configuration Sheet */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              {selectedAgent?.name}
            </SheetTitle>
            <SheetDescription>
              Configure agent settings, MCP connections, and API keys
            </SheetDescription>
          </SheetHeader>

          <Tabs value={configTab} onValueChange={setConfigTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="settings" className="text-xs">
                <Settings className="h-3.5 w-3.5 mr-1" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="mcp" className="text-xs">
                <Plug className="h-3.5 w-3.5 mr-1" />
                MCP
              </TabsTrigger>
              <TabsTrigger value="keys" className="text-xs">
                <Key className="h-3.5 w-3.5 mr-1" />
                Keys
              </TabsTrigger>
              <TabsTrigger value="soul" className="text-xs">
                <Brain className="h-3.5 w-3.5 mr-1" />
                Soul
              </TabsTrigger>
            </TabsList>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Select 
                  value={agentConfig.model} 
                  onValueChange={(v) => setAgentConfig({ ...agentConfig, model: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {llmModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>System Instructions</Label>
                <Textarea 
                  placeholder="You are a helpful assistant..."
                  rows={6}
                  value={agentConfig.systemInstructions}
                  onChange={(e) => setAgentConfig({ ...agentConfig, systemInstructions: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Enable Chat History</Label>
                  <p className="text-sm text-muted-foreground">Save conversation history</p>
                </div>
                <Switch defaultChecked />
              </div>
            </TabsContent>

            {/* MCP Tab */}
            <TabsContent value="mcp" className="mt-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Connect MCP servers to give this agent access to tools and capabilities.
                </p>
              </div>

              <Label className="mb-3 block">Connected MCP Servers</Label>
              <div className="space-y-3">
                {mockMCPServers.map((server) => (
                  <div 
                    key={server.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{server.name}</span>
                      <Badge variant={server.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {server.status}
                      </Badge>
                    </div>
                    <Switch 
                      checked={agentConfig.mcpServers.includes(server.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAgentConfig({ 
                            ...agentConfig, 
                            mcpServers: [...agentConfig.mcpServers, server.id] 
                          });
                        } else {
                          setAgentConfig({ 
                            ...agentConfig, 
                            mcpServers: agentConfig.mcpServers.filter(id => id !== server.id) 
                          });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Keys Tab */}
            <TabsContent value="keys" className="space-y-4 mt-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  API keys are encrypted and stored securely. Leave blank to use organization defaults.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Anthropic API Key</Label>
                <Input 
                  type="password" 
                  placeholder="sk-ant-..."
                  value={agentConfig.apiKeys.anthropic}
                  onChange={(e) => setAgentConfig({ 
                    ...agentConfig, 
                    apiKeys: { ...agentConfig.apiKeys, anthropic: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <Input 
                  type="password" 
                  placeholder="sk-..."
                  value={agentConfig.apiKeys.openai}
                  onChange={(e) => setAgentConfig({ 
                    ...agentConfig, 
                    apiKeys: { ...agentConfig.apiKeys, openai: e.target.value }
                  })}
                />
              </div>
            </TabsContent>

            {/* Soul Tab */}
            <TabsContent value="soul" className="space-y-4 mt-4">
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Define the agent's personality, tone, and behavioral guidelines.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Personality</Label>
                <Textarea 
                  placeholder="Friendly and professional, with a focus on clarity..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Tone Guidelines</Label>
                <Textarea 
                  placeholder="Use simple language, avoid jargon..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Response Style</Label>
                <Select defaultValue="balanced">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={() => {
                // Save logic here
                setConfigOpen(false);
              }}
            >
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Force rebuild: 2026-02-12 18:12:00
