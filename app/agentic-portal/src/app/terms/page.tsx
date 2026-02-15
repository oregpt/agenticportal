import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground">
          By using Agentic Portal, you agree to use the service lawfully and to keep your account credentials secure.
        </p>
        <p className="text-muted-foreground">
          The service is provided as-is. We may update features, pricing, and these terms as the product evolves.
        </p>
        <p className="text-sm text-muted-foreground">Effective date: February 15, 2026</p>
        <Link href="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}
