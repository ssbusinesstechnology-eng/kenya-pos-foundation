import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
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
import { FormError } from "@/components/common/FormError";
import { BrandMark } from "@/components/layout/BrandMark";
import { accountKeys, createBusinessForOwner } from "@/lib/api/account";
import type { Account } from "@/lib/api/types";

const CURRENCIES = ["KES", "UGX", "TZS", "USD", "EUR", "GBP"];

export function BusinessSetupWizard({ account }: { account: Account }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState(account.profile.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(account.email ?? "");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdName, setCreatedName] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your business name.");
      return;
    }
    setLoading(true);
    try {
      const business = await createBusinessForOwner({
        name: name.trim(),
        ownerFullName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        currency,
      });
      await queryClient.invalidateQueries({ queryKey: accountKeys.current });
      setCreatedName(business.name);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="brand-canvas flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandMark tone="dark" />
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Step {step} of 2
          </p>
        </div>

        <div className="surface-panel px-6 py-7 sm:px-8">
          {step === 1 ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Tell us about your business
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  This takes about a minute. You can change any of it later in Settings.
                </p>
              </div>

              <FormError message={error} />

              <div className="space-y-2">
                <Label htmlFor="biz-name">Business name</Label>
                <Input
                  id="biz-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mwangi General Store"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Owner full name</Label>
                  <Input
                    id="owner-name"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz-phone">Phone</Label>
                  <Input
                    id="biz-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7xx xxx xxx"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="biz-email">Business email</Label>
                  <Input
                    id="biz-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz-currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="biz-currency">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="biz-address">Address</Label>
                <Textarea
                  id="biz-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Shop 4, Kimathi Street, Nairobi"
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Continue
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success/12">
                <CheckCircle2 className="size-7 text-success" aria-hidden />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  You're all set
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {createdName || name} is ready. You're the owner, and everything you add
                  from here stays private to your business.
                </p>
              </div>
              <Button size="lg" className="w-full" onClick={() => navigate({ to: "/dashboard" })}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
