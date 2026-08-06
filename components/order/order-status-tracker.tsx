"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderStatus = "pending" | "claimed" | "picked_up" | "delivered";

const STATUS_STEPS: {
  key: OrderStatus;
  label: string;
}[] = [
  {
    key: "pending",
    label: "ממתינה לאיסוף",
  },
  {
    key: "claimed",
    label: "שליח בדרך לאיסוף",
  },
  {
    key: "picked_up",
    label: "נאספה, בדרך אליך",
  },
  {
    key: "delivered",
    label: "נמסרה",
  },
];

const STATUS_BADGE: Record<
  OrderStatus,
  { className: string; label: string }
> = {
  pending: {
    label: "ממתינה לאיסוף",
    className: "bg-neutral-100 text-brand-muted ring-neutral-200",
  },
  claimed: {
    label: "שליח בדרך לאיסוף",
    className: "bg-brand-yellow/20 text-brand-dark ring-brand-yellow/40",
  },
  picked_up: {
    label: "נאספה, בדרך אליך",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  delivered: {
    label: "נמסרה",
    className: "bg-brand-success/10 text-brand-success ring-brand-success/30",
  },
};

function normalizeStatus(status: string): OrderStatus {
  if (
    status === "claimed" ||
    status === "picked_up" ||
    status === "delivered"
  ) {
    return status;
  }
  return "pending";
}

function statusIndex(status: OrderStatus): number {
  return STATUS_STEPS.findIndex((step) => step.key === status);
}

function formatDeliveredAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type OrderStatusTrackerProps = {
  orderNumber: string;
  initialStatus: string;
  initialDeliveredAt?: string | null;
};

export function OrderStatusTracker({
  orderNumber,
  initialStatus,
  initialDeliveredAt = null,
}: OrderStatusTrackerProps) {
  const [status, setStatus] = useState<OrderStatus>(() =>
    normalizeStatus(initialStatus)
  );
  const [deliveredAt, setDeliveredAt] = useState<string | null>(
    initialDeliveredAt
  );
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        status?: string;
        delivered_at?: string | null;
      };
      if (data.status) {
        setStatus(normalizeStatus(data.status));
      }
      if (data.delivered_at !== undefined) {
        setDeliveredAt(data.delivered_at);
      }
    } catch {
      // Keep last known status on network errors
    } finally {
      setRefreshing(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (status === "delivered") return;

    const intervalId = window.setInterval(() => {
      void fetchStatus();
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [status, fetchStatus]);

  const currentIndex = statusIndex(status);
  const badge = STATUS_BADGE[status];

  return (
    <section
      className="rounded-xl bg-brand-bgLight p-4 ring-1 ring-black/5"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-brand-muted">סטטוס המשלוח</p>
          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1",
              badge.className
            )}
          >
            {status === "delivered" && <Check className="size-4" aria-hidden />}
            {badge.label}
          </p>
          {status === "delivered" && deliveredAt && (
            <p className="mt-2 text-sm text-brand-muted">
              נמסרה ב־{formatDeliveredAt(deliveredAt)}
            </p>
          )}
        </div>

        {status !== "delivered" && (
          <p
            className={cn(
              "flex items-center gap-1.5 text-xs text-brand-muted transition-opacity",
              refreshing ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={!refreshing}
          >
            <Loader2 className="size-3 animate-spin" />
            מתעדכן...
          </p>
        )}
      </div>

      <ol className="mt-5 space-y-0">
        {STATUS_STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const upcoming = index > currentIndex;

          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex w-6 flex-col items-center">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    completed && "bg-brand-success text-white",
                    current &&
                      status === "delivered" &&
                      "bg-brand-success text-white",
                    current &&
                      status === "claimed" &&
                      "bg-brand-yellow text-brand-dark",
                    current &&
                      status === "picked_up" &&
                      "bg-blue-600 text-white",
                    current &&
                      status === "pending" &&
                      "bg-neutral-300 text-brand-dark",
                    upcoming && "bg-neutral-200 text-brand-muted"
                  )}
                >
                  {completed || (current && status === "delivered") ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                {index < STATUS_STEPS.length - 1 && (
                  <span
                    className={cn(
                      "my-1 w-0.5 flex-1 min-h-4",
                      completed ? "bg-brand-success/50" : "bg-neutral-200"
                    )}
                  />
                )}
              </div>

              <div
                className={cn(
                  "pb-4 pt-0.5",
                  index === STATUS_STEPS.length - 1 && "pb-0"
                )}
              >
                <p
                  className={cn(
                    "text-sm leading-snug",
                    current && "font-bold text-brand-dark",
                    completed && "font-medium text-brand-dark",
                    upcoming && "text-brand-muted"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
