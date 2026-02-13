import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Hexagon, Database, MessageSquare, BarChart3, ArrowRight, Sparkles, Zap, Shield, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Hexagon className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-lg tracking-tight">
              Agentic<span className="text-primary">Portal</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
              <Link href="/login?tab=register">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="container mx-auto px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Data Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-foreground">
            Talk to your data.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Connect any data source. Ask questions in plain English.
            Build intelligent dashboards in minutes.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="h-12 px-6 bg-primary hover:bg-primary/90" asChild>
              <Link href="/login?tab=register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6" asChild>
              <Link href="/demo">Try Demo</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-y border-border bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">10M+</div>
              <div className="text-sm text-muted-foreground mt-1">Queries Processed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">50+</div>
              <div className="text-sm text-muted-foreground mt-1">Data Sources</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">99.9%</div>
              <div className="text-sm text-muted-foreground mt-1">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">How it works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three simple steps to unlock insights from your data
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Connect */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Connect</h3>
            <p className="text-muted-foreground">
              PostgreSQL, BigQuery, Google Sheets, and more.
              Your data stays secure where it is.
            </p>
          </div>

          {/* Ask */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Ask</h3>
            <p className="text-muted-foreground">
              "Show me top customers by revenue last quarter" — 
              AI turns your question into insights.
            </p>
          </div>

          {/* Visualize */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Visualize</h3>
            <p className="text-muted-foreground">
              Tables, charts, metrics. Save as dashboards.
              Share with your team instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Why Choose Us */}
      <div className="bg-card border-y border-border py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why AgenticPortal?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built for modern data teams who want results, not complexity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="text-center p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Lightning Fast</h4>
              <p className="text-sm text-muted-foreground">Responses in seconds, not minutes</p>
            </div>

            <div className="text-center p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Enterprise Secure</h4>
              <p className="text-sm text-muted-foreground">SOC 2 compliant, encrypted data</p>
            </div>

            <div className="text-center p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">Team Collaboration</h4>
              <p className="text-sm text-muted-foreground">Share insights across your org</p>
            </div>

            <div className="text-center p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold mb-1">AI Powered</h4>
              <p className="text-sm text-muted-foreground">Claude, GPT-4, Gemini built-in</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-6 py-24">
        <div className="bg-primary rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to get started?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            Join hundreds of teams using AgenticPortal to make better decisions with their data.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" className="h-12 px-6" asChild>
              <Link href="/login?tab=register">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link href="/demo">View Demo</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Hexagon className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-sm">
                Agentic<span className="text-primary">Portal</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 AgenticPortal. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
