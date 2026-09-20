import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers · S&S POS" },
      {
        name: "description",
        content: "Customer records and purchase history — arriving in a later phase.",
      },
      { property: "og:title", content: "Customers · S&S POS" },
      {
        property: "og:description",
        content: "Customer records and purchase history — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Customers"
      description="Keep customer details and see what each one has bought from you."
      phase="a later phase"
    />
  ),
});
