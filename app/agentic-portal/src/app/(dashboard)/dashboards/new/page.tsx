'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function NewDashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setIsCreating(true);
    
    // TODO: Replace with real API call
    // For now, simulate creation and redirect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In real implementation: POST /api/dashboards
    // const response = await fetch('/api/dashboards', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ name, description }),
    // });
    // const dashboard = await response.json();
    // router.push(`/dashboards/${dashboard.id}`);
    
    // For now, redirect to dashboards list
    router.push('/dashboards');
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboards">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Dashboard</h1>
          <p className="text-muted-foreground">Build a new dashboard with widgets</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard Details
          </CardTitle>
          <CardDescription>
            Give your dashboard a name and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Dashboard Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Sales Overview, Customer Analytics"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What does this dashboard show?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/dashboards">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button 
              onClick={handleCreate} 
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Dashboard'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info section */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">After creating your dashboard:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Add widgets by clicking "Add Widget"</li>
            <li>• Connect widgets to Views for live data</li>
            <li>• Drag and resize widgets to customize layout</li>
            <li>• Share your dashboard with team members</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
