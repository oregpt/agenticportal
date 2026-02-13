'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, MoreHorizontal, Users, Mail, Calendar } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (user?.organizationId) {
      fetchMembers();
    }
  }, [user?.organizationId]);

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/org/members?organizationId=${user?.organizationId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    
    setIsInviting(true);
    try {
      const res = await fetch('/api/org/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole,
          organizationId: user?.organizationId 
        }),
      });
      
      if (res.ok) {
        setInviteEmail('');
        setInviteRole('member');
        setShowInviteDialog(false);
        fetchMembers();
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
    } finally {
      setIsInviting(false);
    }
  }

  const filteredMembers = members.filter(member =>
    member.email.toLowerCase().includes(search.toLowerCase()) ||
    member.name?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    org_admin: 'bg-primary/10 text-primary border-primary/20',
    admin: 'bg-blue-50 text-blue-700 border-blue-200',
    member: 'bg-green-50 text-green-700 border-green-200',
    viewer: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team Members</h1>
        <p className="text-muted-foreground mt-1">Manage your organization's team</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={inviteMember} disabled={isInviting || !inviteEmail.trim()} className="bg-primary hover:bg-primary/90">
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No team members</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Invite your first team member to collaborate</p>
            <Button onClick={() => setShowInviteDialog(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Member</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Role</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-muted-foreground">Joined</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary">
                        {(member.name || member.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{member.name || 'No name'}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className={roleColors[member.role] || roleColors.member}>
                      {member.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(member.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
