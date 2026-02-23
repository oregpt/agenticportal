'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Building2, Shield, Bell, Brain, CheckCircle2, XCircle, Edit2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// LLM API Key providers
const llmProviders = [
  { key: 'anthropic_api_key', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', description: 'Powers Claude models' },
  { key: 'openai_api_key', label: 'OpenAI (GPT)', placeholder: 'sk-...', description: 'Powers GPT-4 models' },
  { key: 'google_ai_api_key', label: 'Google AI (Gemini)', placeholder: 'AIza...', description: 'Powers Gemini models' },
  { key: 'xai_api_key', label: 'xAI (Grok)', placeholder: 'xai-...', description: 'Powers Grok models' },
];

interface OrgSettings {
  name: string;
  slug: string;
  allowMemberInvites: boolean;
  requireApproval: boolean;
  defaultUserRole: string;
  googleSheetsExecutionMode: 'bigquery_external' | 'duckdb_memory';
}

interface GcpDiagnosticsResponse {
  configured: boolean;
  error?: string;
  serviceAccountEmail?: string;
  projectId?: string;
  diagnostics?: {
    envVarPresent: boolean;
    jsonParseOk: boolean;
    missingFields: string[];
  };
}

export default function OrgSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<OrgSettings>({
    name: '',
    slug: '',
    allowMemberInvites: true,
    requireApproval: false,
    defaultUserRole: 'member',
    googleSheetsExecutionMode: 'bigquery_external',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // LLM API Keys state
  const [llmKeyStatus, setLlmKeyStatus] = useState<Record<string, boolean>>({
    anthropic_api_key: false,
    openai_api_key: false,
    google_ai_api_key: false,
    xai_api_key: false,
  });
  const [editingLlmKey, setEditingLlmKey] = useState<string | null>(null);
  const [llmKeyValue, setLlmKeyValue] = useState('');
  const [gcpDiagnostics, setGcpDiagnostics] = useState<GcpDiagnosticsResponse | null>(null);
  const [isLoadingGcpDiagnostics, setIsLoadingGcpDiagnostics] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      if (!user?.organizationId) return;
      
      try {
        const res = await fetch(`/api/org/settings?organizationId=${user.organizationId}`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch {
        console.error('Failed to fetch settings');
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, [user?.organizationId]);

  useEffect(() => {
    async function fetchGcpDiagnostics() {
      setIsLoadingGcpDiagnostics(true);
      try {
        const res = await fetch('/api/google-sheets-live/service-account');
        const payload = (await res.json()) as GcpDiagnosticsResponse;
        setGcpDiagnostics(payload);
      } catch {
        setGcpDiagnostics({
          configured: false,
          error: 'Could not check platform GCP credentials.',
        });
      } finally {
        setIsLoadingGcpDiagnostics(false);
      }
    }
    fetchGcpDiagnostics();
  }, []);

  async function saveSettings() {
    setIsSaving(true);
    try {
      const res = await fetch('/api/org/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          organizationId: user?.organizationId,
        }),
      });
      
      if (res.ok) {
        toast({
          title: 'Settings saved',
          description: 'Your organization settings have been updated.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization&apos;s configuration</p>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>General</CardTitle>
            </div>
            <CardDescription>Basic organization information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={settings.slug}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs. Contact support to change.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Security & Access</CardTitle>
            </div>
            <CardDescription>Control who can join and access your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow member invitations</Label>
                <p className="text-sm text-muted-foreground">
                  Admins can invite new members via email
                </p>
              </div>
              <Switch
                checked={settings.allowMemberInvites}
                onCheckedChange={(checked) => setSettings({ ...settings, allowMemberInvites: checked })}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require admin approval</Label>
                <p className="text-sm text-muted-foreground">
                  New members need admin approval before accessing data
                </p>
              </div>
              <Switch
                checked={settings.requireApproval}
                onCheckedChange={(checked) => setSettings({ ...settings, requireApproval: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure organization-wide notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              Notification settings coming soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Data Execution</CardTitle>
            </div>
            <CardDescription>
              Select how Google Sheets sources should execute SQL in this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="google-sheets-execution-mode">Google Sheets Execution Mode</Label>
              <select
                id="google-sheets-execution-mode"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={settings.googleSheetsExecutionMode}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    googleSheetsExecutionMode: e.target.value === 'duckdb_memory' ? 'duckdb_memory' : 'bigquery_external',
                  }))
                }
              >
                <option value="bigquery_external">BigQuery External Table (Current)</option>
                <option value="duckdb_memory">DuckDB In-Memory (Planned)</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              BigQuery External is currently active in this app. DuckDB mode can be configured now for future rollout.
            </p>
          </CardContent>
        </Card>

        {/* LLM API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>LLM API Keys</CardTitle>
            </div>
            <CardDescription>
              Organization-level API keys for AI providers. These override platform defaults and can be overridden by agent-specific keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Key Hierarchy:</strong> Platform → Organization → Agent
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Agent keys override org keys, which override platform keys.
              </p>
            </div>
            
            {llmProviders.map(provider => (
              <div key={provider.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider.label}</span>
                    <Badge variant={llmKeyStatus[provider.key] ? 'default' : 'secondary'}>
                      {llmKeyStatus[provider.key] ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Configured</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Not Set</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingLlmKey === provider.key ? (
                    <>
                      <Input 
                        type="password"
                        value={llmKeyValue}
                        onChange={(e) => setLlmKeyValue(e.target.value)}
                        placeholder={provider.placeholder}
                        className="w-48"
                      />
                      <Button 
                        size="sm"
                        onClick={() => {
                          setLlmKeyStatus(s => ({ ...s, [provider.key]: true }));
                          setEditingLlmKey(null);
                          setLlmKeyValue('');
                          toast({ title: 'API Key saved', description: `${provider.label} key has been saved.` });
                        }}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setEditingLlmKey(null);
                          setLlmKeyValue('');
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingLlmKey(provider.key)}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        {llmKeyStatus[provider.key] ? 'Update' : 'Set Key'}
                      </Button>
                      {llmKeyStatus[provider.key] && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            setLlmKeyStatus(s => ({ ...s, [provider.key]: false }));
                            toast({ title: 'API Key removed', description: `${provider.label} key has been removed.` });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Google Sheets Connector Diagnostics</CardTitle>
            </div>
            <CardDescription>
              Validates platform GCP credentials required for Google Sheets data sources.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingGcpDiagnostics ? (
              <p className="text-sm text-muted-foreground">Checking platform credentials...</p>
            ) : gcpDiagnostics?.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Platform GCP credentials are configured.
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <p><span className="font-medium">Project ID:</span> {gcpDiagnostics.projectId}</p>
                  <p><span className="font-medium">Service account:</span> {gcpDiagnostics.serviceAccountEmail}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <XCircle className="w-4 h-4" />
                  {gcpDiagnostics?.error || 'Platform GCP credentials are not configured.'}
                </div>
                {gcpDiagnostics?.diagnostics ? (
                  <div className="rounded-lg border p-3 text-sm space-y-1">
                    <p>
                      <span className="font-medium">Env var present:</span>{' '}
                      {gcpDiagnostics.diagnostics.envVarPresent ? 'Yes' : 'No'}
                    </p>
                    <p>
                      <span className="font-medium">JSON parse valid:</span>{' '}
                      {gcpDiagnostics.diagnostics.jsonParseOk ? 'Yes' : 'No'}
                    </p>
                    <p>
                      <span className="font-medium">Missing fields:</span>{' '}
                      {gcpDiagnostics.diagnostics.missingFields.length > 0
                        ? gcpDiagnostics.diagnostics.missingFields.join(', ')
                        : 'None'}
                    </p>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Supported platform env vars: <code>EDS_GCP_SERVICE_ACCOUNT_KEY_B64</code> (preferred) or <code>EDS_GCP_SERVICE_ACCOUNT_KEY</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
