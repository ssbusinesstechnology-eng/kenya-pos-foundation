import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales · S&S POS" },
      {
        name: "description",
        content: "Ring up sales, take payments and print receipts — arriving in a later phase.",
      },
      { property: "og:title", content: "Sales · S&S POS" },
      {
        property: "og:description",
        content: "Ring up sales, take payments and print receipts — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Sales"
      description="The till: ring up items, take cash or mobile money, and issue receipts."
      phase="a later phase"
    />
  ),
});
