import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Info, Package, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/StateViews";
import { CartPanel } from "@/components/pos/CartPanel";
import { PosSearchInput, ProductTile } from "@/components/pos/ProductPicker";
import { useCart } from "@/components/pos/useCart";
import { fetchProducts, productKeys } from "@/lib/api/products";
import { useAccount } from "@/lib/api/useAccount";
import { formatMoneyCents, formatQuantity } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Point of sale · S&S POS" },
      {
        name: "description",
        content: "Ring up a sale: search your products, build the cart and see the total instantly.",
      },
      { property: "og:title", content: "Point of sale · S&S POS" },
      {
        property: "og:description",
        content: "Ring up a sale: search your products, build the cart and see the total instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PosPage,
});

function PosPage() {
  const { data: account } = useAccount();
  const currency = account?.business?.currency ?? "KES";
  const products = useQuery({ queryKey: productKeys.list, queryFn: fetchProducts });
  const cart = useCart();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const sellable = useMemo(
    () => (products.data ?? []).filter((product) => product.is_active),
    [products.data],
  );

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sellable;
    return sellable.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.sku ?? "").toLowerCase().includes(term),
    );
  }, [sellable, search]);

  const productById = (id: string) => (products.data ?? []).find((p) => p.id === id);

  function addFirstResult() {
    const candidate = results.find((product) => product.stock_quantity > 0);
    if (candidate) {
      cart.addProduct(candidate);
      setSearch("");
      searchRef.current?.focus();
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        title="Point of sale"
        description="Search, tap to add, adjust quantities — the running total updates as you go. Nothing is recorded until checkout, which arrives in the next phase."
        action={
          <Button
            variant="outline"
            onClick={() => void products.refetch()}
            disabled={products.isFetching}
          >
            <RefreshCw
              className={`size-4 ${products.isFetching ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh stock
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-4">
          <div className="surface-panel p-4">
            <PosSearchInput value={search} onChange={setSearch} onEnter={addFirstResult} />
            <p className="mt-2 text-xs text-muted-foreground">
              Press Enter to add the first matching product. Barcode scanners that type work here
              too.
            </p>
          </div>

          {cart.notice ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span className="flex-1">{cart.notice}</span>
              <Button variant="ghost" size="sm" onClick={cart.clearNotice}>
                Dismiss
              </Button>
            </div>
          ) : null}

          {products.isPending ? (
            <LoadingState label="Loading your products…" />
          ) : products.isError ? (
            <ErrorState
              title="We couldn't load your products"
              message={products.error instanceof Error ? products.error.message : undefined}
              onRetry={() => void products.refetch()}
            />
          ) : sellable.length === 0 ? (
            <EmptyState
              title="No products ready to sell"
              message="Add a product — with its price and stock — before starting a sale."
              icon={<Package className="size-5 text-primary" aria-hidden />}
              action={
                <Button asChild>
                  <Link to="/products">Go to Products</Link>
                </Button>
              }
            />
          ) : results.length === 0 ? (
            <EmptyState
              title="No products match that search"
              message="Try part of the product name or its SKU."
              icon={<Search className="size-5 text-primary" aria-hidden />}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((product) => {
                const line = cart.lines.find((item) => item.productId === product.id);
                return (
                  <ProductTile
                    key={product.id}
                    product={product}
                    currency={currency}
                    inCartQuantity={line ? formatQuantity(line.quantityMilli) : null}
                    onSelect={() => cart.addProduct(product)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div id="cart" className="lg:sticky lg:top-6">
          <CartPanel
            lines={cart.lines}
            totals={cart.totals}
            currency={currency}
            productById={productById}
            discountMode={cart.discountMode}
            discountInput={cart.discountInput}
            onDiscountModeChange={cart.setDiscountMode}
            onDiscountInputChange={cart.setDiscountInput}
            onQuantityChange={cart.setQuantity}
            onRemove={cart.removeLine}
            onClear={cart.clearCart}
          />
        </div>
      </div>

      {cart.lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {cart.lines.length} item{cart.lines.length === 1 ? "" : "s"} in cart
              </p>
              <p className="text-base font-semibold">
                {formatMoneyCents(cart.totals.totalCents, currency)}
              </p>
            </div>
            <Button asChild variant="outline">
              <a href="#cart">View cart</a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
