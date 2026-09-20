import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory · S&S POS" },
      {
        name: "description",
        content: "Stock levels, stock-in and low-stock alerts — arriving in a later phase.",
      },
      { property: "og:title", content: "Inventory · S&S POS" },
      {
        property: "og:description",
        content: "Stock levels, stock-in and low-stock alerts — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Inventory"
      description="Track stock in and out, with alerts when an item is running low."
      phase="a later phase"
    />
  ),
});
