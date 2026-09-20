import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Ask S&S · S&S POS" },
      {
        name: "description",
        content: "Ask questions about your business in plain language — arriving in a later phase.",
      },
      { property: "og:title", content: "Ask S&S · S&S POS" },
      {
        property: "og:description",
        content: "Ask questions about your business in plain language — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Ask S&S"
      description="Ask about your sales, stock and customers in plain language."
      phase="a later phase"
    />
  ),
});
