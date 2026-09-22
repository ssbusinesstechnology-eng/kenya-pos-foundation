import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { formatChange, formatWhen, MovementBadge } from "@/components/inventory/MovementBadge";
import { fetchProductMovements, inventoryKeys } from "@/lib/api/inventory";
import type { Product } from "@/lib/api/types";

export function ProductHistoryDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | undefined;
}) {
  const productId = product?.id ?? "";
  const movements = useQuery({
    queryKey: inventoryKeys.product(productId),
    queryFn: () => fetchProductMovements(productId),
    enabled: open && Boolean(productId),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Stock history{product ? ` · ${product.name}` : ""}</DialogTitle>
          <DialogDescription>
            {product
              ? `Currently in stock: ${product.stock_quantity} ${product.unit}.`
              : "Every stock change for this product."}
          </DialogDescription>
        </DialogHeader>

        {movements.isPending ? (
          <LoadingState label="Loading stock history…" />
        ) : movements.isError ? (
          <ErrorState
            title="We couldn't load this history"
            message={movements.error instanceof Error ? movements.error.message : undefined}
            onRetry={() => void movements.refetch()}
          />
        ) : (movements.data ?? []).length === 0 ? (
          <EmptyState
            title="No stock activity yet"
            message="Stock changes for this product will appear here once you record one."
            icon={<History className="size-5 text-primary" aria-hidden />}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements.data ?? []).map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatWhen(movement.created_at)}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
