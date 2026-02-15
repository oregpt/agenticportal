import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">
          Agentic Portal stores account and usage data needed to operate the platform, including email, profile details, and
          workspace activity.
        </p>
        <p className="text-muted-foreground">
          Data is used only for authentication, product functionality, and support. We do not sell personal information.
        </p>
        <p className="text-sm text-muted-foreground">Last updated: February 15, 2026</p>
        <Link href="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}
