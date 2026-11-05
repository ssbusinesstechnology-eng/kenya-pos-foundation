import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/common/StateViews";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "S&S Business Hub · Your workspace" },
      {
        name: "description",
        content: "Sales, customers, inventory and reports for your Kenyan business.",
      },
      { property: "og:title", content: "S&S Business Hub · Your workspace" },
      {
        property: "og:description",
        content: "Sales, customers, inventory and reports for your Kenyan business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
