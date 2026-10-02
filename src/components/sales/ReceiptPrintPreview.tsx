/**
 * Full-screen preview of the receipt exactly as it will print (narrow paper
 * width, black on white), so it can be reviewed before printing or saving as PDF.
 */
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaleReceipt } from "@/components/sales/SaleReceipt";
import type { Business, SaleDetail } from "@/lib/api/types";

export function ReceiptPrintPreview({
  sale,
  business,
  cashierName,
  onClose,
}: {
  sale: SaleDetail;
  business: Business | null;
  cashierName: string | null;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print preview"
      className="no-print pointer-events-auto fixed inset-0 z-[100] flex flex-col bg-muted"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3">
        <div>
          <p className="font-semibold">Print preview</p>
          <p className="text-xs text-muted-foreground">
            This is how your receipt will print. Choose "Save as PDF" in the print window to keep a copy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="size-4" aria-hidden />
            Close
          </Button>
          <Button onClick={() => window.print()} autoFocus>
            <Printer className="size-4" aria-hidden />
            Print / Save PDF
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="receipt-paper mx-auto w-[80mm] max-w-full bg-card p-3 shadow-lg">
          <SaleReceipt sale={sale} business={business} cashierName={cashierName} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
