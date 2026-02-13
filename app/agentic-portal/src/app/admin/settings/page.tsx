'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Settings, Shield, Key, Cpu } from 'lucide-react';

export default function PlatformSettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // General settings
  const [platformName, setPlatformName] = useState('Agentic Portal');
  const [allowSignups, setAllowSignups] = useState(true);
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);

  // AI settings
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-20250514');
  const [maxTokens, setMaxTokens] = useState('4096');

  async function saveSettings() {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    toast({
      title: 'Settings saved',
      description: 'Platform settings have been updated.',
    });
    setIsSaving(false);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground">Configure global platform settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="ai">AI Models</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>General Settings</CardTitle>
              </div>
              <CardDescription>Basic platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="platform-name">Platform Name</Label>
                <Input
                  id="platform-name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed in the header and emails
                </p>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow public signups</Label>
                  <p className="text-sm text-muted-foreground">
                    Anyone can create an account
                  </p>
                </div>
                <Switch
                  checked={allowSignups}
                  onCheckedChange={setAllowSignups}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Security Settings</CardTitle>
              </div>
              <CardDescription>Authentication and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require email verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Users must verify email before accessing the platform
                  </p>
                </div>
                <Switch
                  checked={requireEmailVerification}
                  onCheckedChange={setRequireEmailVerification}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Session timeout (hours)</Label>
                <Input type="number" defaultValue="168" className="w-32" />
                <p className="text-xs text-muted-foreground">
                  How long before users need to log in again
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                <CardTitle>AI Model Configuration</CardTitle>
              </div>
              <CardDescription>Configure AI models used for chat and queries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="default-model">Default Model</Label>
                <Input
                  id="default-model"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max-tokens">Max Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-32"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <CardTitle>API Keys</CardTitle>
              </div>
              <CardDescription>Manage external service API keys</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  defaultValue="••••••••••••••••"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  defaultValue="••••••••••••••••"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="brave-key">Brave Search API Key</Label>
                <Input
                  id="brave-key"
                  type="password"
                  placeholder="BSA..."
                  defaultValue="••••••••••••••••"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end mt-6">
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
