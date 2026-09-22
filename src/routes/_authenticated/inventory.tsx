import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, History, Package, PackageX, Search, SlidersHorizontal, TriangleAlert } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { formatChange, formatWhen, MovementBadge } from "@/components/inventory/MovementBadge";
import { ProductHistoryDialog } from "@/components/inventory/ProductHistoryDialog";
import { StockAdjustDialog } from "@/components/inventory/StockAdjustDialog";
import { adjustStock, fetchMovements, fetchTeamNames, inventoryKeys } from "@/lib/api/inventory";
import { fetchProducts, productKeys } from "@/lib/api/products";
import { useAccount } from "@/lib/api/useAccount";
import type { Product, StockAdjustmentInput } from "@/lib/api/types";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory · S&S POS" },
      {
        name: "description",
        content: "Manage stock levels, restocks and inventory adjustments with a full stock history.",
      },
      { property: "og:title", content: "Inventory · S&S POS" },
      {
        property: "og:description",
        content: "Manage stock levels, restocks and inventory adjustments with a full stock history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

type StockStatus = "in" | "low" | "out";
type StatusFilter = StockStatus | "all";

function stockStatus(product: Product): StockStatus {
  const stock = Number(product.stock_quantity) || 0;
  const threshold = Number(product.low_stock_threshold) || 0;
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "in";
}

const STATUS_LABEL: Record<StockStatus, string> = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

function InventoryPage() {
  const queryClient = useQueryClient();
  const { data: account } = useAccount();
  const canManage = account?.profile.role === "owner" || account?.profile.role === "manager";

  const products = useQuery({ queryKey: productKeys.list, queryFn: fetchProducts });
  const movements = useQuery({ queryKey: inventoryKeys.movements, queryFn: () => fetchMovements() });
  const team = useQuery({ queryKey: ["team", "names"], queryFn: fetchTeamNames });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | undefined>(undefined);
  const [historyProduct, setHistoryProduct] = useState<Product | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);

  const rows = useMemo(
    () => (products.data ?? []).filter((product) => product.is_active),
    [products.data],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(rows.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c))),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const summary = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let out = 0;
    for (const product of rows) {
      const state = stockStatus(product);
      if (state === "in") inStock += 1;
      else if (state === "low") low += 1;
      else out += 1;
    }
    return { total: rows.length, inStock, low, out };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((product) => {
      if (status !== "all" && stockStatus(product) !== status) return false;
      if (category !== "all" && (product.category?.trim() ?? "") !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) || (product.sku ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, search, category, status]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products.data ?? []) map.set(product.id, product);
    return map;
  }, [products.data]);

  const nameByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of team.data ?? []) map.set(member.id, member.full_name ?? "Team member");
    return map;
  }, [team.data]);

  const adjustMutation = useMutation({
    mutationFn: (input: StockAdjustmentInput) => adjustStock(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
      ]);
      setAdjustOpen(false);
      setAdjustProduct(undefined);
    },
  });

  function openAdjust(product?: Product) {
    adjustMutation.reset();
    setAdjustProduct(product);
    setAdjustOpen(true);
  }

  function openHistory(product: Product) {
    setHistoryProduct(product);
    setHistoryOpen(true);
  }

  const noProducts = !products.isPending && !products.isError && rows.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage stock levels, restocks and inventory adjustments. Every change is kept as a permanent record."
        action={
          canManage ? (
            <Button size="lg" disabled={noProducts} onClick={() => openAdjust()}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Adjust stock
            </Button>
          ) : undefined
        }
      />

      {products.isPending ? (
        <LoadingState label="Loading your stock summary…" />
      ) : products.isError ? (
        <ErrorState
          title="We couldn't load your inventory"
          message={products.error instanceof Error ? products.error.message : undefined}
          onRetry={() => void products.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total products"
              value={summary.total}
              icon={<Package className="size-4" aria-hidden />}
            />
            <SummaryCard
              label="In stock"
              value={summary.inStock}
              icon={<Boxes className="size-4" aria-hidden />}
            />
            <SummaryCard
              label="Low stock"
              value={summary.low}
              icon={<TriangleAlert className="size-4" aria-hidden />}
              tone={summary.low > 0 ? "warn" : undefined}
            />
            <SummaryCard
              label="Out of stock"
              value={summary.out}
              icon={<PackageX className="size-4" aria-hidden />}
              tone={summary.out > 0 ? "danger" : undefined}
            />
          </div>

          {noProducts ? (
            <EmptyState
              title="Add products before managing stock"
              message="Inventory works from your product list. Create your first product and its stock will show up here."
              icon={<Package className="size-5 text-primary" aria-hidden />}
              action={
                <Button asChild>
                  <Link to="/products">Go to Products</Link>
                </Button>
              }
            />
          ) : (
            <Tabs defaultValue="levels" className="space-y-4">
              <TabsList>
                <TabsTrigger value="levels">Stock levels</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="levels" className="space-y-4">
                <div className="surface-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      className="pl-9"
                      placeholder="Search by product name or SKU"
                      aria-label="Search inventory"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
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
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as StatusFilter)}
                  >
                    <SelectTrigger className="sm:w-44" aria-label="Filter by stock status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stock levels</SelectItem>
                      <SelectItem value="in">In stock</SelectItem>
                      <SelectItem value="low">Low stock</SelectItem>
                      <SelectItem value="out">Out of stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {adjustMutation.isError ? (
                  <ErrorState
                    title="We couldn't save that stock change"
                    message={
                      adjustMutation.error instanceof Error
                        ? adjustMutation.error.message
                        : undefined
                    }
                  />
                ) : null}

                {filtered.length === 0 ? (
                  <EmptyState
                    title="No matching products found"
                    message="Nothing matches your search or filters. Try a different name, SKU, category or stock level."
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
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Low-stock at</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((product) => {
                          const state = stockStatus(product);
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {product.sku ?? "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {product.category ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {product.stock_quantity} {product.unit}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {product.low_stock_threshold} {product.unit}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    state === "in"
                                      ? "secondary"
                                      : state === "low"
                                        ? "outline"
                                        : "destructive"
                                  }
                                >
                                  {STATUS_LABEL[state]}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {formatWhen(product.updated_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {canManage ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openAdjust(product)}
                                      aria-label={`Adjust stock for ${product.name}`}
                                    >
                                      <SlidersHorizontal className="size-3.5" aria-hidden />
                                      Adjust
                                    </Button>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openHistory(product)}
                                    aria-label={`Stock history for ${product.name}`}
                                  >
                                    <History className="size-3.5" aria-hidden />
                                    History
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {movements.isPending ? (
                  <LoadingState label="Loading stock activity…" />
                ) : movements.isError ? (
                  <ErrorState
                    title="We couldn't load your stock history"
                    message={movements.error instanceof Error ? movements.error.message : undefined}
                    onRetry={() => void movements.refetch()}
                  />
                ) : (movements.data ?? []).length === 0 ? (
                  <EmptyState
                    title="No stock activity yet"
                    message="Stock activity will appear here once stock is added or adjusted."
                    icon={<History className="size-5 text-primary" aria-hidden />}
                  />
                ) : (
                  <div className="surface-panel overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                          <TableHead className="text-right">Before</TableHead>
                          <TableHead className="text-right">After</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(movements.data ?? []).map((movement) => {
                          const product = productById.get(movement.product_id);
                          return (
                            <TableRow key={movement.id}>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {formatWhen(movement.created_at)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {product?.name ?? "Product"}
                              </TableCell>
                              <TableCell>
                                <MovementBadge type={movement.movement_type} />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatChange(movement.quantity_change, product?.unit ?? "")}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {movement.previous_stock}
                              </TableCell>
                              <TableCell className="text-right">{movement.new_stock}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {movement.reason ?? "—"}
                                {movement.notes ? (
                                  <span className="block text-xs">{movement.notes}</span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {movement.created_by
                                  ? movement.created_by === account?.userId
                                    ? "You"
                                    : (nameByUser.get(movement.created_by) ?? "Team member")
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      <StockAdjustDialog
        open={adjustOpen}
        onOpenChange={(open) => {
          setAdjustOpen(open);
          if (!open) setAdjustProduct(undefined);
        }}
        products={rows}
        product={adjustProduct}
        isSaving={adjustMutation.isPending}
        submitError={adjustMutation.error instanceof Error ? adjustMutation.error.message : null}
        onSubmit={(input) => adjustMutation.mutate(input)}
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

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "warn" | "danger" | undefined;
}) {
  const toneClass =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-accent-foreground" : "";
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
