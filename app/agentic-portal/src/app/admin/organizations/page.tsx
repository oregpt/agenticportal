'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, MoreHorizontal, Users, Database } from 'lucide-react';
import Link from 'next/link';

type McpProviderId = 'tres_finance' | 'hubspot' | 'ccview' | 'lighthouse';

const MCP_PROVIDER_OPTIONS: Array<{ id: McpProviderId; label: string }> = [
  { id: 'tres_finance', label: 'Tres Finance' },
  { id: 'hubspot', label: 'HubSpot' },
  { id: 'ccview', label: 'CCView' },
  { id: 'lighthouse', label: 'Lighthouse' },
];

interface Organization {
  id: string;
  name: string;
  slug: string;
  userCount?: number;
  dataSourceCount?: number;
  mcpSettings?: {
    enableMcpDataSources: boolean;
    enabledMcpProviders: McpProviderId[];
  };
  createdAt: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [mcpEditOrg, setMcpEditOrg] = useState<Organization | null>(null);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpProviders, setMcpProviders] = useState<McpProviderId[]>([]);
  const [savingMcp, setSavingMcp] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    try {
      const res = await fetch('/api/admin/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createOrganization() {
    if (!newOrgName.trim()) return;
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName }),
      });
      
      if (res.ok) {
        setNewOrgName('');
        setShowCreateDialog(false);
        fetchOrganizations();
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setIsCreating(false);
    }
  }

  function openMcpDialog(org: Organization) {
    setMcpEditOrg(org);
    setMcpEnabled(Boolean(org.mcpSettings?.enableMcpDataSources));
    setMcpProviders((org.mcpSettings?.enabledMcpProviders || []) as McpProviderId[]);
  }

  async function saveMcpSettings() {
    if (!mcpEditOrg) return;
    setSavingMcp(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: mcpEditOrg.id,
          enableMcpDataSources: mcpEnabled,
          enabledMcpProviders: mcpProviders,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save MCP settings');
      }
      setMcpEditOrg(null);
      fetchOrganizations();
    } catch (error) {
      console.error('Failed to save MCP settings:', error);
    } finally {
      setSavingMcp(false);
    }
  }

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground">Manage all tenant organizations on the platform</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Add a new tenant organization to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Corp"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createOrganization} disabled={isCreating || !newOrgName.trim()}>
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredOrgs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No organizations match your search' : 'No organizations yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Data Sources</TableHead>
                  <TableHead>MCP</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/organizations/${org.id}`} className="hover:underline">
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{org.slug}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {org.userCount || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        {org.dataSourceCount || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.mcpSettings?.enableMcpDataSources ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="default">Enabled</Badge>
                          <span className="text-xs text-muted-foreground">
                            {(org.mcpSettings.enabledMcpProviders || []).join(', ') || 'No providers'}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openMcpDialog(org)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(mcpEditOrg)} onOpenChange={(open) => !open && setMcpEditOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>MCP Data Source Settings</DialogTitle>
            <DialogDescription>
              {mcpEditOrg ? `Configure MCP availability for ${mcpEditOrg.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mcp-enabled">Enable MCP Server Data Sources</Label>
              <input
                id="mcp-enabled"
                type="checkbox"
                checked={mcpEnabled}
                onChange={(e) => setMcpEnabled(e.target.checked)}
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed MCP Providers</Label>
              {MCP_PROVIDER_OPTIONS.map((provider) => (
                <label key={provider.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mcpProviders.includes(provider.id)}
                    onChange={(e) =>
                      setMcpProviders((prev) =>
                        e.target.checked ? Array.from(new Set([...prev, provider.id])) : prev.filter((id) => id !== provider.id)
                      )
                    }
                  />
                  {provider.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMcpEditOrg(null)} disabled={savingMcp}>
              Cancel
            </Button>
            <Button onClick={saveMcpSettings} disabled={savingMcp}>
              {savingMcp ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
