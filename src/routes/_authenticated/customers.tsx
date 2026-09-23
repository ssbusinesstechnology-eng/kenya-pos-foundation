import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { CustomerDetailDialog } from "@/components/customers/CustomerDetailDialog";
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog";
import { customerKeys, fetchCustomersPage, setCustomerActive } from "@/lib/api/customers";
import { saleKeys } from "@/lib/api/sales";
import { useAccount } from "@/lib/api/useAccount";
import type { Customer, CustomerStatusFilter } from "@/lib/api/types";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers · S&S POS" },
      {
        name: "description",
        content: "Keep customer details in one place and see what each one has bought from you.",
      },
      { property: "og:title", content: "Customers · S&S POS" },
      {
        property: "og:description",
        content: "Keep customer details in one place and see what each one has bought from you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

const PAGE_SIZE = 20;

function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const currency = account?.business?.currency ?? "KES";
  const canManage = account?.profile.role === "owner" || account?.profile.role === "manager";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatusFilter>("ALL");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const query = useMemo(
    () => ({ search: search.trim(), status, page, pageSize: PAGE_SIZE }),
    [search, status, page],
  );

  const customers = useQuery({
    queryKey: customerKeys.list(query),
    queryFn: () => fetchCustomersPage(query),
    placeholderData: keepPreviousData,
  });

  const rows = customers.data?.rows ?? [];
  const total = customers.data?.total ?? 0;
  const filtersActive = search.trim() !== "" || status !== "ALL";

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: customerKeys.all });
  }

  async function toggleActive(customer: Customer) {
    setActionError(null);
    setTogglingId(customer.id);
    try {
      await setCustomerActive(customer.id, !customer.is_active);
      await refresh();
      setNotice(
        customer.is_active
          ? `${customer.name} is now inactive and won't show up in new sales.`
          : `${customer.name} is active again.`,
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "We couldn't change that customer.",
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Record the people who buy from you — a name is enough. Customers are always optional at the till."
        action={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add customer
            </Button>
          ) : undefined
        }
      />

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-sm"
        >
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          {actionError}
        </p>
      ) : null}

      <div className="surface-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Search</span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Name, phone or email"
              aria-label="Search customers"
              autoComplete="off"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as CustomerStatusFilter);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All customers</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {customers.isPending ? (
        <LoadingState label="Loading your customers…" />
      ) : customers.isError ? (
        <ErrorState
          title="We couldn't load your customers"
          message={customers.error instanceof Error ? customers.error.message : undefined}
          onRetry={() => void customers.refetch()}
        />
      ) : rows.length === 0 ? (
        filtersActive ? (
          <EmptyState
            title="No customers found."
            message="Nothing matches that search. Clear it to see everyone."
            icon={<Search className="size-5 text-primary" aria-hidden />}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setPage(0);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No customers yet."
            message="Add a customer to keep their details and purchase history together."
            icon={<Users className="size-5 text-primary" aria-hidden />}
            action={
              canManage ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Add customer
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="surface-panel overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(row.id)}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {row.phone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-muted-foreground md:table-cell">
                      {row.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "secondary" : "outline"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {new Date(row.created_at).toLocaleDateString("en-KE")}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className="flex justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {canManage ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditing(row);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" aria-hidden />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={togglingId === row.id}
                              onClick={() => void toggleActive(row)}
                            >
                              <Power className="size-4" aria-hidden />
                              {row.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(row.id)}>
                            View
                          </Button>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <CustomerFormDialog
        open={formOpen}
        customer={editing}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
        onSaved={(saved, created) => {
          void refresh();
          setNotice(
            created ? `${saved.name} was added to your customers.` : `${saved.name} was updated.`,
          );
          if (!created && detailId) setDetailId(saved.id);
        }}
      />

      <CustomerDetailDialog
        customerId={detailId}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onEdit={(customer) => {
          setEditing(customer);
          setFormOpen(true);
        }}
        onOpenSale={(saleId) => setOpenSaleId(saleId)}
      />

      <SaleDetailDialog
        saleId={openSaleId}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) {
            setOpenSaleId(null);
            void queryClient.invalidateQueries({ queryKey: saleKeys.all });
          }
        }}
      />
    </div>
  );
}
