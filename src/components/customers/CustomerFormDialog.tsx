/**
 * Add / edit a customer. Only the name is required; everything else is optional
 * so a customer can be recorded by name alone. The database re-checks the same
 * rules, so browser validation is a convenience, not the guard.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/common/FormError";
import {
  createCustomer,
  findCustomersByPhone,
  updateCustomer,
} from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export function CustomerFormDialog({
  open,
  customer,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = add a new customer. */
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (customer: Customer, created: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
    setAddress(customer?.address ?? "");
    setNotes(customer?.notes ?? "");
    setError(null);
    setDuplicateWarning(null);
    setSaving(false);
  }, [open, customer]);

  async function save() {
    if (saving) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (trimmedName === "") {
      setError("Please enter the customer's name.");
      return;
    }
    if (trimmedName.length > 120) {
      setError("That name is too long — please shorten it.");
      return;
    }
    if (trimmedEmail !== "" && !EMAIL.test(trimmedEmail)) {
      setError("That email address doesn't look right.");
      return;
    }
    if (trimmedPhone !== "" && trimmedPhone.replace(/\D/g, "").length < 6) {
      setError("That phone number doesn't look right. Leave it blank if you don't have it.");
      return;
    }

    setSaving(true);
    try {
      // Warn once about a same-phone customer in this business, then allow it.
      if (trimmedPhone !== "" && duplicateWarning === null) {
        const matches = await findCustomersByPhone(trimmedPhone, customer?.id);
        if (matches.length > 0) {
          setDuplicateWarning(
            `${matches[0].name} already uses ${trimmedPhone}. Save anyway to keep both records.`,
          );
          setSaving(false);
          return;
        }
      }

      const input = {
        name: trimmedName,
        phone: trimmedPhone || null,
        email: trimmedEmail || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };
      const saved = customer
        ? await updateCustomer(customer.id, input)
        : await createCustomer(input);
      onSaved(saved, !customer);
      onOpenChange(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "We couldn't save that customer. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            Only the name is needed. Add a phone number or anything else if you have it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Jane Wanjiku"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone (optional)</Label>
              <Input
                id="customer-phone"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setDuplicateWarning(null);
                }}
                placeholder="e.g. 0712 345 678"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email (optional)</Label>
              <Input
                id="customer-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="e.g. jane@example.com"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-address">Address (optional)</Label>
            <Input
              id="customer-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street, town or estate"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-notes">Notes (optional)</Label>
            <Textarea
              id="customer-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything useful to remember"
            />
          </div>

          {duplicateWarning ? (
            <p
              role="status"
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
            >
              {duplicateWarning}
            </p>
          ) : null}
          <FormError message={error} />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {duplicateWarning
              ? "Save anyway"
              : customer
                ? "Save changes"
                : "Add customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
