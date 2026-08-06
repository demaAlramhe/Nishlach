import { Check } from "lucide-react";
import {
  ORDER_STATUS_BADGE_CLASS,
  ORDER_STATUS_LABELS,
} from "@/lib/courier";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: string }) {
  const label = ORDER_STATUS_LABELS[status] ?? status;
  const className =
    ORDER_STATUS_BADGE_CLASS[status] ?? ORDER_STATUS_BADGE_CLASS.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        className
      )}
    >
      {status === "delivered" && <Check className="size-3" aria-hidden />}
      {label}
    </span>
  );
}
