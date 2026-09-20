import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports · S&S POS" },
      {
        name: "description",
        content: "Daily takings, best sellers and profit summaries — arriving in a later phase.",
      },
      { property: "og:title", content: "Reports · S&S POS" },
      {
        property: "og:description",
        content: "Daily takings, best sellers and profit summaries — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Reports"
      description="Clear summaries of takings, best sellers and profit over any period."
      phase="a later phase"
    />
  ),
});
