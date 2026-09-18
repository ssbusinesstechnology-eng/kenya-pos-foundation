import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { useAccount } from "@/lib/api/useAccount";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { data: account, isPending, isError, error, refetch } = useAccount();
  const needsSetup = Boolean(account && !account.business);

  useEffect(() => {
    if (needsSetup) navigate({ to: "/onboarding" });
  }, [needsSetup, navigate]);

  if (isPending || needsSetup) {
    return (
      <div className="brand-canvas min-h-screen p-6">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="brand-canvas min-h-screen p-6">
        <ErrorState message={error?.message} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <AppShell account={account}>
      <Outlet />
    </AppShell>
  );
}
