'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DeliveryPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Delivery is separate from artifact production. This module will manage cron jobs and channel destinations for artifacts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Next</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Schedule artifact delivery by email, webhook, and chat destinations.
        </CardContent>
      </Card>
    </div>
  );
}
