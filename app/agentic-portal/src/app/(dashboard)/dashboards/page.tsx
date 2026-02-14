import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard, Clock, Layers } from 'lucide-react';
import Link from 'next/link';

export default function DashboardsPage() {
  // TODO: Fetch dashboards from API
  const dashboards: { id: string; name: string; description: string; widgetCount: number; updatedAt: string }[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboards</h1>
          <p className="text-muted-foreground mt-1">Create and manage your data dashboards</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" asChild>
          <Link href="/dashboards/new">
            <Plus className="w-4 h-4 mr-2" />
            New Dashboard
          </Link>
        </Button>
      </div>

      {/* Dashboard Grid */}
      {dashboards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dashboards.map((dashboard) => (
            <Link key={dashboard.id} href={`/dashboards/${dashboard.id}`}>
              <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all cursor-pointer h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{dashboard.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{dashboard.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {dashboard.widgetCount} widgets
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {dashboard.updatedAt}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border rounded-xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <LayoutDashboard className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No dashboards yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Create your first dashboard to visualize your data</p>
            <Button className="bg-primary hover:bg-primary/90" asChild>
              <Link href="/dashboards/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Dashboard
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
