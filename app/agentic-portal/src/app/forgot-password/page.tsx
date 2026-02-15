import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-md mx-auto space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">Reset Password</h1>
        <p className="text-muted-foreground">
          Password reset is not enabled for this deployment yet. Contact your platform administrator for access recovery.
        </p>
        <Link href="/login" className="text-primary hover:underline">
          Return to login
        </Link>
      </div>
    </main>
  );
}
