import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MOVEMENT_LABELS, type MovementType } from "@/lib/api/types";

export function MovementBadge({ type }: { type: MovementType }) {
  const isOut = type === "ADJUSTMENT_OUT";
  return (
    <Badge variant={isOut ? "outline" : "secondary"} className="gap-1 whitespace-nowrap">
      {isOut ? (
        <ArrowDownRight className="size-3.5" aria-hidden />
      ) : (
        <ArrowUpRight className="size-3.5" aria-hidden />
      )}
      {MOVEMENT_LABELS[type]}
    </Badge>
  );
}

export function formatChange(change: number, unit: string) {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${Math.abs(change)} ${unit}`;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
