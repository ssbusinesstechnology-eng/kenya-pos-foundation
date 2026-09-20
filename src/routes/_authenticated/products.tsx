import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products · S&S POS" },
      {
        name: "description",
        content: "Your product list, categories and prices — arriving in a later phase.",
      },
      { property: "og:title", content: "Products · S&S POS" },
      {
        property: "og:description",
        content: "Your product list, categories and prices — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Products"
      description="Everything you sell, with categories, prices and price history."
      phase="a later phase"
    />
  ),
});
