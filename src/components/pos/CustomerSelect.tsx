/**
 * Optional customer for the current sale. Walk-in is the default — nothing here
 * is required to complete a sale. Searching only ever asks the database for the
 * few matching active customers, never the whole list.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, UserPlus, UserRound, X } from "lucide-react";
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
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { customerKeys, searchActiveCustomers } from "@/lib/api/customers";
import type { CustomerSummary } from "@/lib/api/types";

export function CustomerSelect({
  customer,
  onChange,
  canAdd,
}: {
  customer: CustomerSummary | null;
  onChange: (customer: CustomerSummary | null) => void;
  canAdd: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="surface-panel space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Customer</span>
        <span className="text-xs text-muted-foreground">Optional</span>
      </div>

      {customer ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium">{customer.name}</span>
            {customer.phone ? (
              <span className="block text-xs text-muted-foreground">{customer.phone}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
              Change
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove the customer from this sale"
              onClick={() => onChange(null)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <UserRound className="size-4" aria-hidden />
            Walk-in — no customer
          </span>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            Select customer
          </Button>
        </div>
      )}

      <CustomerPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        canAdd={canAdd}
        onPick={(picked) => {
          onChange(picked);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function CustomerPickerDialog({
  open,
  onOpenChange,
  onPick,
  canAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (customer: CustomerSummary) => void;
  canAdd: boolean;
}) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const results = useQuery({
    queryKey: customerKeys.lookup(term.trim()),
    queryFn: () => searchActiveCustomers(term.trim()),
    enabled: open,
  });

  const rows = results.data ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a customer</DialogTitle>
            <DialogDescription>
              Search by name or phone number. Only active customers can be added to a new sale.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            placeholder="e.g. Jane or 0712"
            aria-label="Search customers by name or phone"
            autoComplete="off"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {results.isPending ? (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </p>
            ) : results.isError ? (
              <p className="py-3 text-sm text-destructive">
                {results.error instanceof Error
                  ? results.error.message
                  : "We couldn't search your customers."}
              </p>
            ) : rows.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                No active customers match that. You can continue without a customer.
              </p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onPick({ id: row.id, name: row.name, phone: row.phone })}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm transition hover:border-primary/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.phone ?? "No phone"}
                    </span>
                  </span>
                  <Plus className="size-4 shrink-0 text-primary" aria-hidden />
                </button>
              ))
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {canAdd ? (
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="size-4" aria-hidden />
                Add customer
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerFormDialog
        open={addOpen}
        customer={null}
        onOpenChange={setAddOpen}
        onSaved={(saved) => {
          void queryClient.invalidateQueries({ queryKey: customerKeys.all });
          setAddOpen(false);
          onPick({ id: saved.id, name: saved.name, phone: saved.phone });
        }}
      />
    </>
  );
}
