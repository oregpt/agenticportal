import { AppLayout } from '@/components/layout/AppLayout';
import { headers } from 'next/headers';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const initialEmbedded = requestHeaders.get('sec-fetch-dest') === 'iframe';
  return <AppLayout initialEmbedded={initialEmbedded}>{children}</AppLayout>;
}
