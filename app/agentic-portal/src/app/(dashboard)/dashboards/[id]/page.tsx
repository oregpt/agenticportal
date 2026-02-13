'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Settings, Share, ArrowLeft, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, TrendingUp, Hash, Table2 } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#0066cc', '#e63946', '#2a9d8f', '#f4a261', '#9b5de5'];

// Dashboard widget type for this page
interface DashboardWidget {
  id: string;
  dashboardId: string;
  type: 'metric' | 'chart' | 'table';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: {
    chartType?: 'bar' | 'line' | 'area' | 'pie';
    xField?: string;
    yFields?: { field: string; label: string; color?: string }[];
  };
}

// Mock dashboard data - replace with API
const MOCK_DASHBOARDS: Record<string, { name: string; description: string; widgets: DashboardWidget[] }> = {
  '1': {
    name: 'Sales Overview',
    description: 'Q4 2025 sales metrics',
    widgets: [
      {
        id: 'w1',
        dashboardId: '1',
        type: 'metric',
        title: 'Total Revenue',
        position: { x: 0, y: 0, width: 1, height: 1 },
        config: {},
      },
      {
        id: 'w2',
        dashboardId: '1',
        type: 'chart',
        title: 'Monthly Sales',
        position: { x: 1, y: 0, width: 2, height: 2 },
        config: {
          chartType: 'bar',
          xField: 'month',
          yFields: [{ field: 'sales', label: 'Sales', color: '#0066cc' }],
        },
      },
      {
        id: 'w3',
        dashboardId: '1',
        type: 'chart',
        title: 'Revenue Trend',
        position: { x: 0, y: 1, width: 2, height: 2 },
        config: {
          chartType: 'line',
          xField: 'month',
          yFields: [{ field: 'revenue', label: 'Revenue', color: '#2a9d8f' }],
        },
      },
      {
        id: 'w4',
        dashboardId: '1',
        type: 'chart',
        title: 'Sales by Category',
        position: { x: 2, y: 1, width: 1, height: 2 },
        config: {
          chartType: 'pie',
          xField: 'category',
          yFields: [{ field: 'value', label: 'Value' }],
        },
      },
      {
        id: 'w6',
        dashboardId: '1',
        type: 'table',
        title: 'Top Products',
        position: { x: 0, y: 2, width: 3, height: 2 },
        config: {},
      },
    ],
  },
  '2': {
    name: 'Customer Analytics',
    description: 'Customer segmentation and retention',
    widgets: [
      {
        id: 'w5',
        dashboardId: '2',
        type: 'chart',
        title: 'Customer Growth',
        position: { x: 0, y: 0, width: 2, height: 2 },
        config: {
          chartType: 'area',
          xField: 'month',
          yFields: [{ field: 'customers', label: 'Customers', color: '#9b5de5' }],
        },
      },
    ],
  },
};

// Mock chart data
const MOCK_CHART_DATA = {
  w2: [
    { month: 'Jan', sales: 4000 },
    { month: 'Feb', sales: 3000 },
    { month: 'Mar', sales: 5000 },
    { month: 'Apr', sales: 4500 },
    { month: 'May', sales: 6000 },
    { month: 'Jun', sales: 5500 },
  ],
  w3: [
    { month: 'Jan', revenue: 12000 },
    { month: 'Feb', revenue: 15000 },
    { month: 'Mar', revenue: 18000 },
    { month: 'Apr', revenue: 16000 },
    { month: 'May', revenue: 21000 },
    { month: 'Jun', revenue: 24000 },
  ],
  w4: [
    { category: 'Electronics', value: 35 },
    { category: 'Clothing', value: 25 },
    { category: 'Food', value: 20 },
    { category: 'Other', value: 20 },
  ],
  w5: [
    { month: 'Jan', customers: 100 },
    { month: 'Feb', customers: 150 },
    { month: 'Mar', customers: 200 },
    { month: 'Apr', customers: 280 },
    { month: 'May', customers: 350 },
    { month: 'Jun', customers: 450 },
  ],
  w6: [
    { product: 'Widget Pro', category: 'Electronics', sales: 1250, revenue: '$62,500', trend: '+12%' },
    { product: 'Gadget Plus', category: 'Electronics', sales: 980, revenue: '$49,000', trend: '+8%' },
    { product: 'Smart Device', category: 'Electronics', sales: 756, revenue: '$37,800', trend: '+15%' },
    { product: 'Basic Widget', category: 'Accessories', sales: 620, revenue: '$18,600', trend: '-3%' },
    { product: 'Premium Pack', category: 'Bundles', sales: 450, revenue: '$45,000', trend: '+22%' },
  ],
};

const WIDGET_TYPES = [
  { id: 'metric', name: 'Metric Card', icon: Hash, description: 'Display a single KPI value' },
  { id: 'table', name: 'Data Table', icon: Table2, description: 'Show data in rows and columns' },
  { id: 'bar', name: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { id: 'line', name: 'Line Chart', icon: LineChartIcon, description: 'Show trends over time' },
  { id: 'area', name: 'Area Chart', icon: TrendingUp, description: 'Visualize cumulative values' },
  { id: 'pie', name: 'Pie Chart', icon: PieChartIcon, description: 'Show proportions of a whole' },
];

export default function DashboardDetailPage() {
  const params = useParams();
  const dashboardId = params.id as string;
  const [dashboard, setDashboard] = useState<typeof MOCK_DASHBOARDS['1'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add Widget Dialog
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetType, setNewWidgetType] = useState('bar');
  const [isAddingWidget, setIsAddingWidget] = useState(false);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setDashboard(MOCK_DASHBOARDS[dashboardId] || null);
      setIsLoading(false);
    }, 500);
  }, [dashboardId]);

  const handleAddWidget = async () => {
    if (!newWidgetTitle.trim()) return;
    
    setIsAddingWidget(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create new widget
    const widgetType = newWidgetType === 'metric' ? 'metric' : newWidgetType === 'table' ? 'table' : 'chart';
    const widgetWidth = newWidgetType === 'metric' ? 1 : newWidgetType === 'table' ? 3 : 2;
    
    const newWidget: DashboardWidget = {
      id: `w${Date.now()}`,
      dashboardId,
      type: widgetType,
      title: newWidgetTitle,
      position: { x: 0, y: 0, width: widgetWidth, height: 2 },
      config: widgetType === 'chart' ? {
        chartType: newWidgetType as any,
        xField: 'month',
        yFields: [{ field: 'value', label: 'Value', color: CHART_COLORS[0] }],
      } : {},
    };
    
    // Add to dashboard (in real app, would POST to API)
    if (dashboard) {
      setDashboard({
        ...dashboard,
        widgets: [...dashboard.widgets, newWidget],
      });
    }
    
    setShowAddWidget(false);
    setNewWidgetTitle('');
    setNewWidgetType('bar');
    setIsAddingWidget(false);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-zinc-200 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-64 bg-zinc-200 rounded"></div>
            <div className="h-64 bg-zinc-200 rounded col-span-2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Dashboard not found</h2>
          <p className="text-muted-foreground mb-4">This dashboard doesn't exist or has been deleted.</p>
          <Link href="/dashboards">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboards
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboards">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{dashboard.name}</h1>
            <p className="text-muted-foreground">{dashboard.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setShowAddWidget(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Widget
          </Button>
        </div>
      </div>

      {/* Add Widget Dialog */}
      <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Create a new widget for your dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Widget Title</Label>
              <Input
                placeholder="e.g., Monthly Revenue"
                value={newWidgetTitle}
                onChange={(e) => setNewWidgetTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Widget Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {WIDGET_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setNewWidgetType(type.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      newWidgetType === type.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <type.icon className={`w-5 h-5 ${newWidgetType === type.id ? 'text-orange-500' : 'text-zinc-500'}`} />
                    <div>
                      <div className="font-medium text-sm">{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWidget(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddWidget} disabled={!newWidgetTitle.trim() || isAddingWidget}>
              {isAddingWidget ? 'Adding...' : 'Add Widget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Widgets Grid */}
      <div className="grid grid-cols-3 gap-6">
        {dashboard.widgets.map((widget) => {
          const data = (MOCK_CHART_DATA as any)[widget.id] || [];
          const chartType = widget.config.chartType;
          
          return (
            <div
              key={widget.id}
              className={`${widget.position.width === 3 ? 'col-span-3' : widget.position.width === 2 ? 'col-span-2' : ''}`}
            >
              {widget.type === 'metric' ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {widget.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">$124,500</div>
                    <p className="text-xs text-green-600">+12.5% from last month</p>
                  </CardContent>
                </Card>
              ) : widget.type === 'chart' ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' ? (
                          <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={widget.config.xField} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {widget.config.yFields?.map((yf, i) => (
                              <Bar key={yf.field} dataKey={yf.field} fill={yf.color || CHART_COLORS[i]} name={yf.label} />
                            ))}
                          </BarChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={widget.config.xField} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {widget.config.yFields?.map((yf, i) => (
                              <Line key={yf.field} type="monotone" dataKey={yf.field} stroke={yf.color || CHART_COLORS[i]} name={yf.label} />
                            ))}
                          </LineChart>
                        ) : chartType === 'area' ? (
                          <AreaChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey={widget.config.xField} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {widget.config.yFields?.map((yf, i) => (
                              <Area key={yf.field} type="monotone" dataKey={yf.field} fill={yf.color || CHART_COLORS[i]} stroke={yf.color || CHART_COLORS[i]} name={yf.label} />
                            ))}
                          </AreaChart>
                        ) : chartType === 'pie' ? (
                          <PieChart>
                            <Pie
                              data={data}
                              dataKey={widget.config.yFields?.[0]?.field || 'value'}
                              nameKey={widget.config.xField}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                            >
                              {data.map((_: any, i: number) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            Unknown chart type
                          </div>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ) : widget.type === 'table' ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50">
                          <tr>
                            {data.length > 0 && Object.keys(data[0]).map((key) => (
                              <th key={key} className="px-4 py-3 text-left font-medium text-zinc-600 border-b">
                                {key.charAt(0).toUpperCase() + key.slice(1)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((row: any, i: number) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-zinc-50">
                              {Object.values(row).map((value: any, j: number) => (
                                <td key={j} className="px-4 py-3">
                                  {typeof value === 'string' && value.startsWith('+') ? (
                                    <span className="text-green-600 font-medium">{value}</span>
                                  ) : typeof value === 'string' && value.startsWith('-') ? (
                                    <span className="text-red-600 font-medium">{value}</span>
                                  ) : (
                                    value
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-muted-foreground">Unknown widget type</p>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
