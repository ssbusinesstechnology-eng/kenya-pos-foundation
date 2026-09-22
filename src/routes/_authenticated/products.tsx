import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Package, Pencil, Plus, Power, Search } from "lucide-react";
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
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { ProductHistoryDialog } from "@/components/inventory/ProductHistoryDialog";
import { useAccount } from "@/lib/api/useAccount";
import {
  createProduct,
  fetchProducts,
  productKeys,
  setProductActive,
  updateProduct,
} from "@/lib/api/products";
import type { Product, ProductInput } from "@/lib/api/types";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products · S&S POS" },
      {
        name: "description",
        content: "Add, edit and manage everything your business sells — prices, stock and categories.",
      },
      { property: "og:title", content: "Products · S&S POS" },
      {
        property: "og:description",
        content: "Add, edit and manage everything your business sells — prices, stock and categories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

type StatusFilter = "active" | "inactive" | "all";

function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const currency = account?.business?.currency ?? "KES";
  const defaultThreshold = account?.business?.default_low_stock_threshold ?? 5;
  const canManage =
    account?.profile.role === "owner" || account?.profile.role === "manager";

  const products = useQuery({ queryKey: productKeys.list, queryFn: fetchProducts });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [historyProduct, setHistoryProduct] = useState<Product | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);

  const rows = products.data ?? [];

  const categories = useMemo(
    () =>
      Array.from(
        new Set(rows.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c))),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((product) => {
      if (status === "active" && !product.is_active) return false;
      if (status === "inactive" && product.is_active) return false;
      if (category !== "all" && (product.category?.trim() ?? "") !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        (product.sku ?? "").toLowerCase().includes(term) ||
        (product.category ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, search, category, status]);

  const saveMutation = useMutation({
    mutationFn: (input: ProductInput) =>
      editing ? updateProduct(editing.id, input) : createProduct(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      setDialogOpen(false);
      setEditing(undefined);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (product: Product) => setProductActive(product.id, !product.is_active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  function openAdd() {
    setEditing(undefined);
    saveMutation.reset();
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    saveMutation.reset();
    setDialogOpen(true);
  }

  const money = (value: number) =>
    `${currency} ${value.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Everything you sell lives here — add new products, update prices and stock, and switch items on or off without losing their history."
        action={
          canManage ? (
            <Button size="lg" onClick={openAdd}>
              <Plus className="size-4" aria-hidden />
              Add product
            </Button>
          ) : undefined
        }
      />

      <div className="surface-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Search by name, SKU or category"
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {products.isPending ? (
        <LoadingState label="Loading your products…" />
      ) : products.isError ? (
        <ErrorState
          message={products.error instanceof Error ? products.error.message : undefined}
          onRetry={() => void products.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No products yet"
          message={
            canManage
              ? "Add your first product to start building your catalogue."
              : "Once an owner or manager adds products, they'll appear here."
          }
          icon={<Package className="size-5 text-primary" aria-hidden />}
          action={
            canManage ? (
              <Button onClick={openAdd}>
                <Plus className="size-4" aria-hidden />
                Add product
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No products match those filters"
          message="Try a different search term, category or status."
          icon={<Search className="size-5 text-primary" aria-hidden />}
        />
      ) : (
        <div className="surface-panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Selling price</TableHead>
                <TableHead className="text-right">Cost price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const lowStock = product.stock_quantity <= product.low_stock_threshold;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{money(product.selling_price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {money(product.cost_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={lowStock ? "font-medium text-destructive" : undefined}>
                        {product.stock_quantity} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "secondary" : "outline"}>
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canManage ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            Edit
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHistoryProduct(product);
                            setHistoryOpen(true);
                          }}
                          aria-label={`Stock history for ${product.name}`}
                        >
                          <History className="size-3.5" aria-hidden />
                          Stock history
                        </Button>
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(product)}
                            aria-label={`${product.is_active ? "Deactivate" : "Activate"} ${product.name}`}
                          >
                            <Power className="size-3.5" aria-hidden />
                            {product.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {toggleMutation.isError ? (
        <ErrorState
          title="We couldn't change that product"
          message={
            toggleMutation.error instanceof Error ? toggleMutation.error.message : undefined
          }
        />
      ) : null}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(undefined);
        }}
        product={editing}
        categories={categories}
        defaultThreshold={defaultThreshold}
        currency={currency}
        existingSkus={rows.map((p) => p.sku ?? "").filter(Boolean)}
        isSaving={saveMutation.isPending}
        submitError={saveMutation.error instanceof Error ? saveMutation.error.message : null}
        onSubmit={(input) => saveMutation.mutate(input)}
      />

      <ProductHistoryDialog
        open={historyOpen}
        onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) setHistoryProduct(undefined);
        }}
        product={historyProduct}
      />
    </div>
  );
}
