import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormError, FormSuccess } from "@/components/common/FormError";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { accountKeys, signOut, updateBusiness } from "@/lib/api/account";
import { useAccount } from "@/lib/api/useAccount";
import { ROLE_LABELS, type Business, type BusinessSettingsInput } from "@/lib/api/types";

const CURRENCIES = ["KES", "UGX", "TZS", "USD", "EUR", "GBP"];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · S&S POS" },
      {
        name: "description",
        content: "Update your business details, currency, receipt footer and low-stock alerts.",
      },
      { property: "og:title", content: "Settings · S&S POS" },
      {
        property: "og:description",
        content: "Update your business details, currency, receipt footer and low-stock alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: account, isPending, isError, error, refetch } = useAccount();

  if (isPending) return <LoadingState label="Loading settings…" />;
  if (isError || !account || !account.business) {
    return <ErrorState message={error?.message} onRetry={() => void refetch()} />;
  }

  return <SettingsContent business={account.business} account={account} />;
}

function SettingsContent({
  business,
  account,
}: {
  business: Business;
  account: NonNullable<ReturnType<typeof useAccount>["data"]>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwner = account.profile.role === "owner";

  const [form, setForm] = useState<BusinessSettingsInput>({
    name: business.name,
    contact_phone: business.contact_phone,
    contact_email: business.contact_email,
    address: business.address,
    currency: business.currency,
    receipt_footer: business.receipt_footer,
    default_low_stock_threshold: business.default_low_stock_threshold,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [form]);

  const mutation = useMutation({
    mutationFn: (input: BusinessSettingsInput) => updateBusiness(business.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.current });
      setSaved(true);
    },
  });

  function set<K extends keyof BusinessSettingsInput>(key: K, value: BusinessSettingsInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    mutation.mutate({
      ...form,
      name: form.name.trim(),
      contact_phone: form.contact_phone?.trim() || null,
      contact_email: form.contact_email?.trim() || null,
      address: form.address?.trim() || null,
      receipt_footer: form.receipt_footer?.trim() || null,
      default_low_stock_threshold: Number.isFinite(form.default_low_stock_threshold)
        ? form.default_low_stock_threshold
        : 5,
    });
  }

  async function onSignOut() {
    await signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your business details power receipts, stock alerts and every report to come."
      />

      <form onSubmit={onSubmit} className="surface-panel space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold">Business</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOwner
              ? "Only owners can change these details."
              : "Ask the business owner to change these details."}
          </p>
        </div>

        <FormError message={mutation.error instanceof Error ? mutation.error.message : null} />
        {saved ? <FormSuccess message="Your business details are saved." /> : null}

        <div className="space-y-2">
          <Label htmlFor="set-name">Business name</Label>
          <Input
            id="set-name"
            required
            disabled={!isOwner}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-phone">Phone</Label>
            <Input
              id="set-phone"
              type="tel"
              disabled={!isOwner}
              value={form.contact_phone ?? ""}
              onChange={(e) => set("contact_phone", e.target.value)}
              placeholder="+254 7xx xxx xxx"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-email">Business email</Label>
            <Input
              id="set-email"
              type="email"
              disabled={!isOwner}
              value={form.contact_email ?? ""}
              onChange={(e) => set("contact_email", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-currency">Currency</Label>
            <Select
              value={form.currency}
              disabled={!isOwner}
              onValueChange={(value) => set("currency", value)}
            >
              <SelectTrigger id="set-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-threshold">Default low-stock alert</Label>
            <Input
              id="set-threshold"
              type="number"
              min={0}
              disabled={!isOwner}
              value={form.default_low_stock_threshold}
              onChange={(e) => set("default_low_stock_threshold", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Used for new products once stock tracking arrives.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="set-address">Address</Label>
          <Textarea
            id="set-address"
            rows={2}
            disabled={!isOwner}
            value={form.address ?? ""}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="set-footer">Receipt footer</Label>
          <Textarea
            id="set-footer"
            rows={2}
            disabled={!isOwner}
            value={form.receipt_footer ?? ""}
            onChange={(e) => set("receipt_footer", e.target.value)}
            placeholder="Thank you for shopping with us!"
          />
        </div>

        {isOwner ? (
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Save changes
          </Button>
        ) : null}
      </form>

      <div className="surface-panel space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold">Your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal details for the person signed in right now.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Full name</dt>
            <dd className="mt-1 text-sm">{account.profile.full_name ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-1 text-sm">{account.email ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="mt-1">
              <Badge variant="secondary">{ROLE_LABELS[account.profile.role]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge variant="outline">
                {account.profile.is_active ? "Active" : "Inactive"}
              </Badge>
            </dd>
          </div>
        </dl>
        <Button variant="outline" onClick={() => void onSignOut()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </div>
  );
}
