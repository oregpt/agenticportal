'use client';

import { useState } from 'react';
import { 
  Plus, 
  FileOutput, 
  FileText,
  Download,
  Calendar,
  Clock,
  Mail,
  MoreHorizontal,
  Play,
  Pause,
  Search,
  Webhook
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Output {
  id: string;
  name: string;
  type: 'report' | 'csv' | 'email' | 'webhook';
  schedule?: string;
  lastRun?: string;
  status: 'active' | 'paused' | 'error';
  dashboardName: string;
}

const mockOutputs: Output[] = [
  {
    id: 'out-1',
    name: 'Weekly Ops Report',
    type: 'report',
    schedule: 'Every Monday 9am',
    lastRun: '2 days ago',
    status: 'active',
    dashboardName: 'Ops Dashboard'
  },
  {
    id: 'out-2', 
    name: 'Daily Metrics Export',
    type: 'csv',
    schedule: 'Daily 6am',
    lastRun: '12 hours ago',
    status: 'active',
    dashboardName: 'KPI Dashboard'
  },
  {
    id: 'out-3',
    name: 'Error Alert',
    type: 'email',
    schedule: 'On trigger',
    lastRun: '1 week ago',
    status: 'paused',
    dashboardName: 'Error Monitor'
  }
];

const outputTypeConfig = {
  report: { icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'PDF Report' },
  csv: { icon: Download, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'CSV Export' },
  email: { icon: Mail, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Email' },
  webhook: { icon: Webhook, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Webhook' }
};

export default function OutputsPage() {
  const [outputs] = useState<Output[]>(mockOutputs);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOutputs = outputs.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.dashboardName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Outputs
          </h1>
          <p className="text-muted-foreground">
            Scheduled reports, exports, and automated notifications
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Output
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search outputs..."
          className="w-full bg-background border border-input rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Outputs List */}
      <div className="grid gap-4">
        {filteredOutputs.map((output) => {
          const config = outputTypeConfig[output.type];
          const Icon = config.icon;
          
          return (
            <div
              key={output.id}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${config.bg} ${config.border} border`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium">{output.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      {output.status === 'paused' && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      From: {output.dashboardName}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {output.schedule}
                      </div>
                      {output.lastRun && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Last run: {output.lastRun}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {output.status === 'paused' ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredOutputs.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <FileOutput className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No outputs found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            {searchQuery 
              ? "Try adjusting your search"
              : "Outputs let you export dashboards as reports, CSVs, or automated emails."
            }
          </p>
          {!searchQuery && (
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Output
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
