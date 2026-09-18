import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BusinessSetupWizard } from "@/components/onboarding/BusinessSetupWizard";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { useAccount } from "@/lib/api/useAccount";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Set up your business · S&S POS" },
      {
        name: "description",
        content: "A one-minute setup for your business details, currency and contacts.",
      },
      { property: "og:title", content: "Set up your business · S&S POS" },
      {
        property: "og:description",
        content: "A one-minute setup for your business details, currency and contacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { data: account, isPending, isError, error, refetch } = useAccount();

  if (isPending) {
    return (
      <div className="brand-canvas min-h-screen p-6">
        <LoadingState label="Getting your account ready…" />
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

  return <BusinessSetupWizard account={account} />;
}
