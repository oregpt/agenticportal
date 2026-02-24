import { redirect } from 'next/navigation';

export default function LegacyDashboardsPage() {
  redirect('/dashboard');
}
