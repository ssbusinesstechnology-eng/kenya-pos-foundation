import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users · S&S POS" },
      {
        name: "description",
        content: "Invite staff and set what each person can do — arriving in a later phase.",
      },
      { property: "og:title", content: "Users · S&S POS" },
      {
        property: "og:description",
        content: "Invite staff and set what each person can do — arriving in a later phase.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Users"
      description="Invite managers and cashiers, and decide what each of them can do."
      phase="a later phase"
    />
  ),
});
