'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, MessageSquare, Play, PlusCircle, Save, Trash2, Webhook } from 'lucide-react';
import { WorkstreamFilterBar } from '@/components/filters/WorkstreamFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type WorkstreamOption = { id: string; name: string };
type ArtifactOption = { id: string; name: string; type: string; projectId: string };
type ChannelType = 'email' | 'slack' | 'teams';
type DeliveryMode = 'on_demand' | 'scheduled';
type Frequency = 'daily' | 'weekly' | 'monthly';
type McpDeliveryMode = 'snapshot' | 'regenerate';

type DeliveryChannel = {
  id: string;
  projectId: string;
  artifactId: string;
  name: string;
  channelType: ChannelType;
  deliveryMode: DeliveryMode;
  scheduleFrequency: Frequency | null;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  scheduleTime: string | null;
  scheduleTimezone: string | null;
  isEnabled: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  configJson: {
    email?: {
      recipients?: string[];
      subject?: string;
      includeCsvAttachment?: boolean;
    };
    slack?: {
      webhookUrl?: string;
      botToken?: string;
      channel?: string;
    };
    teams?: {
      webhookUrl?: string;
    };
    mcp?: {
      mode?: McpDeliveryMode;
      fallbackToSnapshotOnFailure?: boolean;
    };
    messageTemplate?: string;
  } | null;
};

type FormState = {
  id?: string;
  name: string;
  channelType: ChannelType;
  artifactId: string;
  deliveryMode: DeliveryMode;
  scheduleFrequency: Frequency;
  scheduleDayOfWeek: string;
  scheduleDayOfMonth: string;
  scheduleTime: string;
  scheduleTimezone: string;
  isEnabled: boolean;
  emailRecipients: string;
  emailSubject: string;
  emailIncludeCsvAttachment: boolean;
  slackWebhookUrl: string;
  slackBotToken: string;
  slackChannel: string;
  teamsWebhookUrl: string;
  messageTemplate: string;
  mcpMode: McpDeliveryMode;
  mcpFallbackToSnapshotOnFailure: boolean;
};

const DEFAULT_FORM: FormState = {
  name: '',
  channelType: 'email',
  artifactId: '',
  deliveryMode: 'on_demand',
  scheduleFrequency: 'daily',
  scheduleDayOfWeek: '1',
  scheduleDayOfMonth: '1',
  scheduleTime: '09:00',
  scheduleTimezone: 'UTC',
  isEnabled: true,
  emailRecipients: '',
  emailSubject: '',
  emailIncludeCsvAttachment: true,
  slackWebhookUrl: '',
  slackBotToken: '',
  slackChannel: '',
  teamsWebhookUrl: '',
  messageTemplate: '',
  mcpMode: 'snapshot',
  mcpFallbackToSnapshotOnFailure: false,
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DeliveryPage() {
  const [workstreams, setWorkstreams] = useState<WorkstreamOption[]>([]);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState('');
  const [artifacts, setArtifacts] = useState<ArtifactOption[]>([]);
  const [channels, setChannels] = useState<DeliveryChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningId, setIsRunningId] = useState('');
  const [isDeletingId, setIsDeletingId] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [showSlackAdvanced, setShowSlackAdvanced] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/workstreams');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load projects');
        const items = (data.workstreams || []).map((row: any) => ({ id: String(row.id), name: String(row.name) }));
        setWorkstreams(items);
        if (items.length === 1) setSelectedWorkstreamId(items[0].id);
      } catch (e: any) {
        setError(e?.message || 'Failed to load projects');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError('');

        const artifactParams = new URLSearchParams();
        if (selectedWorkstreamId) artifactParams.set('projectId', selectedWorkstreamId);
        const artifactRes = await fetch(`/api/artifacts?${artifactParams.toString()}`);
        const artifactData = await artifactRes.json().catch(() => ({}));
        if (!artifactRes.ok) throw new Error(artifactData?.error || 'Failed to load artifacts');

        const artifactRows: ArtifactOption[] = (artifactData.artifacts || [])
          .filter((artifact: any) => ['table', 'chart', 'kpi', 'dashboard'].includes(String(artifact.type)))
          .map((artifact: any) => ({
            id: String(artifact.id),
            name: String(artifact.name || artifact.id),
            type: String(artifact.type || 'artifact'),
            projectId: String(artifact.projectId),
          }));
        setArtifacts(artifactRows);

        const channelParams = new URLSearchParams();
        if (selectedWorkstreamId) channelParams.set('projectId', selectedWorkstreamId);
        const channelRes = await fetch(`/api/delivery/channels?${channelParams.toString()}`);
        const channelData = await channelRes.json().catch(() => ({}));
        if (!channelRes.ok) throw new Error(channelData?.error || 'Failed to load deliveries');
        setChannels(channelData.channels || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load delivery data');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedWorkstreamId]);

  const artifactsById = useMemo(() => {
    const map: Record<string, ArtifactOption> = {};
    for (const artifact of artifacts) map[artifact.id] = artifact;
    return map;
  }, [artifacts]);

  function openCreateDialog() {
    const firstArtifactId = artifacts[0]?.id || '';
    setForm({ ...DEFAULT_FORM, artifactId: firstArtifactId });
    setShowSlackAdvanced(false);
    setIsDialogOpen(true);
  }

  function openEditDialog(channel: DeliveryChannel) {
    setForm({
      id: channel.id,
      name: channel.name,
      channelType: channel.channelType,
      artifactId: channel.artifactId,
      deliveryMode: channel.deliveryMode,
      scheduleFrequency: (channel.scheduleFrequency || 'daily') as Frequency,
      scheduleDayOfWeek: String(channel.scheduleDayOfWeek ?? 1),
      scheduleDayOfMonth: String(channel.scheduleDayOfMonth ?? 1),
      scheduleTime: channel.scheduleTime || '09:00',
      scheduleTimezone: channel.scheduleTimezone || 'UTC',
      isEnabled: channel.isEnabled === 1,
      emailRecipients: (channel.configJson?.email?.recipients || []).join(', '),
      emailSubject: channel.configJson?.email?.subject || '',
      emailIncludeCsvAttachment: Boolean(channel.configJson?.email?.includeCsvAttachment),
      slackWebhookUrl: channel.configJson?.slack?.webhookUrl || '',
      slackBotToken: channel.configJson?.slack?.botToken || '',
      slackChannel: channel.configJson?.slack?.channel || '',
      teamsWebhookUrl: channel.configJson?.teams?.webhookUrl || '',
      messageTemplate: channel.configJson?.messageTemplate || '',
      mcpMode: channel.configJson?.mcp?.mode === 'regenerate' ? 'regenerate' : 'snapshot',
      mcpFallbackToSnapshotOnFailure: Boolean(channel.configJson?.mcp?.fallbackToSnapshotOnFailure),
    });
    setShowSlackAdvanced(Boolean(channel.configJson?.slack?.webhookUrl));
    setIsDialogOpen(true);
  }

  function buildFormPayload() {
    const configJson = {
      email: {
        recipients: form.emailRecipients
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        subject: form.emailSubject.trim() || undefined,
        includeCsvAttachment: form.emailIncludeCsvAttachment,
      },
      slack: {
        webhookUrl: form.slackWebhookUrl.trim() || undefined,
        botToken: form.slackBotToken.trim() || undefined,
        channel: form.slackChannel.trim() || undefined,
      },
      teams: {
        webhookUrl: form.teamsWebhookUrl.trim() || undefined,
      },
      mcp: {
        mode: form.mcpMode,
        fallbackToSnapshotOnFailure: form.mcpFallbackToSnapshotOnFailure,
      },
      messageTemplate: form.messageTemplate.trim() || undefined,
    };

    return {
      projectId: selectedWorkstreamId,
      artifactId: form.artifactId,
      name: form.name.trim(),
      channelType: form.channelType,
      deliveryMode: form.deliveryMode,
      scheduleFrequency: form.deliveryMode === 'scheduled' ? form.scheduleFrequency : null,
      scheduleDayOfWeek: form.deliveryMode === 'scheduled' ? Number(form.scheduleDayOfWeek) : null,
      scheduleDayOfMonth: form.deliveryMode === 'scheduled' ? Number(form.scheduleDayOfMonth) : null,
      scheduleTime: form.deliveryMode === 'scheduled' ? form.scheduleTime : null,
      scheduleTimezone: form.deliveryMode === 'scheduled' ? form.scheduleTimezone : 'UTC',
      isEnabled: form.isEnabled,
      configJson,
    };
  }

  async function submitChannel() {
    if (!selectedWorkstreamId) {
      setError('Select a project first.');
      return;
    }
    if (!form.name.trim() || !form.artifactId) {
      setError('Delivery name and artifact are required.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      const payload = buildFormPayload();
      const method = form.id ? 'PATCH' : 'POST';
      const url = form.id ? `/api/delivery/channels/${form.id}` : '/api/delivery/channels';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save delivery');

      setIsDialogOpen(false);
      const reloadRes = await fetch(`/api/delivery/channels?projectId=${encodeURIComponent(selectedWorkstreamId)}`);
      const reloadData = await reloadRes.json().catch(() => ({}));
      if (reloadRes.ok) setChannels(reloadData.channels || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to save delivery');
    } finally {
      setIsSaving(false);
    }
  }

  async function runChannelNow(channelId: string) {
    try {
      setIsRunningId(channelId);
      setError('');
      const res = await fetch(`/api/delivery/channels/${channelId}/run`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to run delivery');
      const reloadRes = await fetch(`/api/delivery/channels?projectId=${encodeURIComponent(selectedWorkstreamId)}`);
      const reloadData = await reloadRes.json().catch(() => ({}));
      if (reloadRes.ok) setChannels(reloadData.channels || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to run delivery');
    } finally {
      setIsRunningId('');
    }
  }

  async function deleteChannel(channelId: string) {
    const confirmed = window.confirm('Delete this delivery?');
    if (!confirmed) return;

    try {
      setIsDeletingId(channelId);
      setError('');
      const res = await fetch(`/api/delivery/channels/${channelId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete delivery');
      setChannels((prev) => prev.filter((row) => row.id !== channelId));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete delivery');
    } finally {
      setIsDeletingId('');
    }
  }

  async function toggleEnabled(channel: DeliveryChannel, enabled: boolean) {
    try {
      setError('');
      const res = await fetch(`/api/delivery/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update delivery status');
      setChannels((prev) => prev.map((row) => (row.id === channel.id ? data.channel : row)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update delivery status');
    }
  }

  function renderChannelIcon(type: ChannelType) {
    if (type === 'email') return <Mail className="h-4 w-4" />;
    if (type === 'slack') return <MessageSquare className="h-4 w-4" />;
    return <Webhook className="h-4 w-4" />;
  }

  return (
    <div className="p-8 space-y-6">
      <WorkstreamFilterBar
        workstreams={workstreams}
        selectedWorkstreamId={selectedWorkstreamId}
        onWorkstreamChange={(projectId) => setSelectedWorkstreamId(projectId || '')}
        pageLabel="Delivery"
        pageDescription="Configure artifact deliveries for each project."
        rightSlot={
          <Button onClick={openCreateDialog} disabled={!selectedWorkstreamId || artifacts.length === 0}>
            <PlusCircle className="h-4 w-4 mr-2" /> Create Delivery
          </Button>
        }
      />

      {error ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deliveries...
        </div>
      ) : selectedWorkstreamId && artifacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            This project has no artifacts yet. Create artifacts first, then configure delivery.
          </CardContent>
        </Card>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {selectedWorkstreamId
              ? 'No deliveries configured for this project.'
              : 'No deliveries configured yet.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Artifact</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => {
                  const artifact = artifactsById[channel.artifactId];
                  return (
                    <TableRow key={channel.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {renderChannelIcon(channel.channelType)}
                          <div>
                            <p className="font-medium">{channel.name}</p>
                            <p className="text-xs text-muted-foreground uppercase">{channel.channelType}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{artifact?.name || channel.artifactId}</p>
                        <p className="text-xs text-muted-foreground uppercase">{artifact?.type || 'artifact'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{channel.deliveryMode === 'scheduled' ? 'Scheduled' : 'On demand'}</Badge>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          MCP: {channel.configJson?.mcp?.mode === 'regenerate' ? 'regenerate before deliver' : 'deliver last snapshot'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {channel.deliveryMode === 'scheduled'
                          ? `${channel.scheduleFrequency || 'daily'} at ${channel.scheduleTime || '09:00'} UTC`
                          : 'Manual run'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={channel.isEnabled === 1}
                            onCheckedChange={(enabled) => void toggleEnabled(channel, enabled)}
                          />
                          <Badge variant={channel.lastStatus === 'failed' ? 'destructive' : 'secondary'}>
                            {channel.lastStatus || 'idle'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {channel.lastRunAt ? new Date(channel.lastRunAt).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runChannelNow(channel.id)}
                            disabled={isRunningId === channel.id}
                          >
                            {isRunningId === channel.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(channel)}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void deleteChannel(channel.id)}
                            disabled={isDeletingId === channel.id}
                            className="text-red-600 hover:text-red-700"
                          >
                            {isDeletingId === channel.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Delivery' : 'Create Delivery'}</DialogTitle>
            <DialogDescription>
              Configure destination, target artifact, and schedule policy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="delivery-name">Delivery Name</Label>
              <Input
                id="delivery-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Morning Metric Email"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Destination</Label>
                <Select
                  value={form.channelType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, channelType: value as ChannelType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="teams">Teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Target Artifact</Label>
                <select
                  value={form.artifactId}
                  onChange={(event) => setForm((prev) => ({ ...prev, artifactId: event.target.value }))}
                  className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {artifacts.map((artifact) => (
                    <option key={artifact.id} value={artifact.id} title={`${artifact.name} (${artifact.type})`}>
                      {artifact.name.length > 72 ? `${artifact.name.slice(0, 69)}...` : artifact.name} ({artifact.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 p-3 border rounded-lg">
              <div className="grid gap-2">
                <Label>MCP Artifact Data Behavior</Label>
                <Select
                  value={form.mcpMode}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, mcpMode: value as McpDeliveryMode }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snapshot">Deliver stored snapshot (deterministic)</SelectItem>
                    <SelectItem value="regenerate">Regenerate then deliver (fresh external data)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This setting is used for MCP-backed artifacts. Non-MCP artifacts always run deterministically before delivery.
                </p>
              </div>
              {form.mcpMode === 'regenerate' ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.mcpFallbackToSnapshotOnFailure}
                    onCheckedChange={(value) => setForm((prev) => ({ ...prev, mcpFallbackToSnapshotOnFailure: value }))}
                  />
                  <span className="text-sm text-muted-foreground">If regenerate fails, deliver latest successful snapshot</span>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Delivery Mode</Label>
                <Select
                  value={form.deliveryMode}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, deliveryMode: value as DeliveryMode }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_demand">On demand</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 py-2">
                <Switch
                  checked={form.isEnabled}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, isEnabled: value }))}
                />
                <span className="text-sm text-muted-foreground">Channel enabled</span>
              </div>
            </div>

            {form.deliveryMode === 'scheduled' ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg">
                <div className="grid gap-2">
                  <Label>Frequency</Label>
                  <Select
                    value={form.scheduleFrequency}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, scheduleFrequency: value as Frequency }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.scheduleFrequency === 'weekly' ? (
                  <div className="grid gap-2">
                    <Label>Day</Label>
                    <Select
                      value={form.scheduleDayOfWeek}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, scheduleDayOfWeek: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_LABELS.map((label, index) => (
                          <SelectItem key={label} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {form.scheduleFrequency === 'monthly' ? (
                  <div className="grid gap-2">
                    <Label>Day of month</Label>
                    <Input
                      value={form.scheduleDayOfMonth}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          scheduleDayOfMonth: event.target.value.replace(/[^\d]/g, '').slice(0, 2),
                        }))
                      }
                    />
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label>Time (UTC)</Label>
                  <Input
                    value={form.scheduleTime}
                    onChange={(event) => setForm((prev) => ({ ...prev, scheduleTime: event.target.value }))}
                    placeholder="09:00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Timezone</Label>
                  <Input
                    value={form.scheduleTimezone}
                    onChange={(event) => setForm((prev) => ({ ...prev, scheduleTimezone: event.target.value }))}
                    placeholder="UTC"
                  />
                </div>
              </div>
            ) : null}

            {form.channelType === 'email' ? (
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="grid gap-2">
                  <Label>Recipients</Label>
                  <Input
                    value={form.emailRecipients}
                    onChange={(event) => setForm((prev) => ({ ...prev, emailRecipients: event.target.value }))}
                    placeholder="finance@company.com, ops@company.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <Input
                    value={form.emailSubject}
                    onChange={(event) => setForm((prev) => ({ ...prev, emailSubject: event.target.value }))}
                    placeholder="Daily finance snapshot"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.emailIncludeCsvAttachment}
                    onCheckedChange={(value) => setForm((prev) => ({ ...prev, emailIncludeCsvAttachment: value }))}
                  />
                  <span className="text-sm text-muted-foreground">Attach CSV export</span>
                </div>
              </div>
            ) : null}

            {form.channelType === 'slack' ? (
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="grid gap-2">
                  <Label>Bot Token</Label>
                  <Input
                    value={form.slackBotToken}
                    onChange={(event) => setForm((prev) => ({ ...prev, slackBotToken: event.target.value }))}
                    placeholder="xoxb-..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Channel</Label>
                  <Input
                    value={form.slackChannel}
                    onChange={(event) => setForm((prev) => ({ ...prev, slackChannel: event.target.value }))}
                    placeholder="#finance-delivery"
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-4"
                  onClick={() => setShowSlackAdvanced((prev) => !prev)}
                >
                  {showSlackAdvanced ? 'Hide advanced options' : 'Show advanced options'}
                </button>
                {showSlackAdvanced ? (
                  <div className="grid gap-2">
                    <Label>Fallback Incoming Webhook URL (optional)</Label>
                    <Input
                      value={form.slackWebhookUrl}
                      onChange={(event) => setForm((prev) => ({ ...prev, slackWebhookUrl: event.target.value }))}
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {form.channelType === 'teams' ? (
              <div className="space-y-3 p-3 border rounded-lg">
                <div className="grid gap-2">
                  <Label>Teams Channel URL</Label>
                  <Input
                    value={form.teamsWebhookUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, teamsWebhookUrl: event.target.value }))}
                    placeholder="https://...office.com/..."
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Message Template (optional)</Label>
              <Textarea
                value={form.messageTemplate}
                onChange={(event) => setForm((prev) => ({ ...prev, messageTemplate: event.target.value }))}
                placeholder="Custom summary to include with delivery."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitChannel()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {form.id ? 'Save Changes' : 'Create Delivery'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
