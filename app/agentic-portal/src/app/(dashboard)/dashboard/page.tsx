import { redirect } from 'next/navigation';

export default function DashboardEntryPage() {
  redirect('/artifacts?type=dashboard');
}
