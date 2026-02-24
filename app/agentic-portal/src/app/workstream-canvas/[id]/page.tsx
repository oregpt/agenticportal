import { redirect } from 'next/navigation';

export default async function LegacyWorkstreamCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/workstreams/${encodeURIComponent(id)}`);
}
