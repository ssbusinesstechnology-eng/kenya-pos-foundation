import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { useAccount } from "@/lib/api/useAccount";
import { ROLE_LABELS } from "@/lib/api/types";
import { NAV_ITEMS } from "@/components/layout/navItems";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · S&S POS" },
      {
        name: "description",
        content: "Your S&S POS home: business status, your role and quick access to settings.",
      },
      { property: "og:title", content: "Dashboard · S&S POS" },
      {
        property: "og:description",
        content: "Your S&S POS home: business status, your role and quick access to settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const UPCOMING = NAV_ITEMS.filter(
  (item) => item.to !== "/dashboard" && item.to !== "/settings",
);

function DashboardPage() {
  const { data: account, isPending, isError, error, refetch } = useAccount();

  if (isPending) return <LoadingState label="Loading your dashboard…" />;
  if (isError || !account) {
    return <ErrorState message={error?.message} onRetry={() => void refetch()} />;
  }

  const business = account.business;
  const firstName = account.profile.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${business?.name ?? "your business"}`}
        description={
          firstName
            ? `Good to see you, ${firstName}. Here's where things stand today.`
            : "Here's where things stand today."
        }
        action={
          <Button asChild variant="outline">
            <Link to="/settings">
              Business settings
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="surface-panel space-y-2 p-5">
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
            <Building2 className="size-4 text-primary" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">Business</h2>
          <p className="text-sm text-muted-foreground">{business?.name}</p>
          <p className="text-xs text-muted-foreground">
            Currency {business?.currency} · low-stock alert at{" "}
            {business?.default_low_stock_threshold}
          </p>
        </div>

        <div className="surface-panel space-y-2 p-5">
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">Signed in as</h2>
          <p className="text-sm text-muted-foreground">
            {account.profile.full_name ?? account.email}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">{ROLE_LABELS[account.profile.role]}</Badge>
            <Badge variant="outline">
              {account.profile.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <div className="surface-panel space-y-2 p-5">
          <span className="flex size-9 items-center justify-center rounded-full bg-success/12">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">Setup status</h2>
          <p className="text-sm text-muted-foreground">
            Account, business profile and private data rules are all in place.
          </p>
          <p className="text-xs text-muted-foreground">
            Next up: products and sales, arriving in the coming phases.
          </p>
        </div>
      </div>

      <EmptyState
        title="No sales yet"
        message="Once the sales and products modules land, today's takings, top sellers and low-stock warnings will appear here — with real numbers, never guesses."
        icon={<Sparkles className="size-5 text-primary" aria-hidden />}
        action={
          <Button asChild variant="outline">
            <Link to="/settings">Review business details</Link>
          </Button>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          On the S&S POS roadmap
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {UPCOMING.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="surface-panel flex items-center gap-3 p-4 transition-colors hover:bg-secondary/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="size-4 text-primary" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">Coming soon</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
