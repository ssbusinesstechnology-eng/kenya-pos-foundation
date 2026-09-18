import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/common/StateViews";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    throw redirect({ to: "/dashboard" });
  },
  component: () => (
    <div className="brand-canvas min-h-screen p-6">
      <LoadingState label="Opening S&S POS…" />
    </div>
  ),
});
