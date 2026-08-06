"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AdminOrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  price: number | string | null;
  created_at: string;
  courier_id: string | null;
  couriers: { full_name: string } | { full_name: string }[] | null;
};

type CourierOption = { id: string; full_name: string };

function courierName(row: AdminOrderRow): string {
  const c = row.couriers;
  if (!c) return "—";
  if (Array.isArray(c)) return c[0]?.full_name ?? "—";
  return c.full_name || "—";
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const STATUSES = [
  { value: "", label: "כל הסטטוסים" },
  { value: "pending", label: "ממתינה" },
  { value: "claimed", label: "נתפסה" },
  { value: "picked_up", label: "נאספה" },
  { value: "delivered", label: "נמסרה" },
];

export function AdminOrdersClient() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [courierFilter, setCourierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    const supabase = createClient();

    const [ordersRes, couriersRes] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, status, price, created_at, courier_id, couriers(full_name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("couriers")
        .select("id, full_name")
        .order("full_name", { ascending: true }),
    ]);

    if (ordersRes.error) {
      console.error(ordersRes.error);
      setError("לא הצלחנו לטעון הזמנות.");
    } else {
      setOrders((ordersRes.data as AdminOrderRow[]) ?? []);
    }

    if (!couriersRes.error) {
      setCouriers((couriersRes.data as CourierOption[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (courierFilter && o.courier_id !== courierFilter) return false;
      return true;
    });
  }, [orders, statusFilter, courierFilter]);

  const savePrice = (orderId: string) => {
    const value = Number(priceDraft);
    if (!Number.isFinite(value) || value < 0) {
      setError("נא להזין מחיר תקין");
      return;
    }

    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("orders")
        .update({ price: value })
        .eq("id", orderId);

      if (updateError) {
        console.error(updateError);
        setError("עדכון המחיר נכשל.");
        return;
      }

      setEditingId(null);
      setPriceDraft("");
      await load();
    });
  };

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">כל ההזמנות</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {filtered.length} מתוך {orders.length} הזמנות
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="status-filter">סטטוס</Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s.value || "all"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="courier-filter">שליח</Label>
          <select
            id="courier-filter"
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            <option value="">כל השליחים</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-brand-error">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-brand-muted">
          <Loader2 className="size-5 animate-spin" />
          טוען...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 bg-white ring-1 ring-black/5">
          <CardContent className="py-8 text-center text-brand-muted">
            אין הזמנות להצגה
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card
              key={order.id}
              className="border-0 bg-white shadow-sm ring-1 ring-black/5"
            >
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base font-bold text-brand-dark">
                    {order.order_number}
                  </CardTitle>
                  <p className="mt-0.5 text-sm text-brand-muted">
                    {order.customer_name}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-brand-muted">שליח</p>
                    <p className="font-medium text-brand-dark">
                      {courierName(order)}
                    </p>
                  </div>
                  <div>
                    <p className="text-brand-muted">נוצרה</p>
                    <p className="font-medium text-brand-dark">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-brand-muted">מחיר</p>
                    {order.price != null && order.price !== "" ? (
                      <p className="font-bold text-brand-dark">₪{order.price}</p>
                    ) : editingId === order.id ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value)}
                          className="h-10 w-28"
                          placeholder="₪"
                          dir="ltr"
                        />
                        <Button
                          type="button"
                          disabled={isPending}
                          onClick={() => savePrice(order.id)}
                          className="h-10 bg-brand-yellow font-bold text-brand-dark hover:bg-brand-yellowHover"
                        >
                          שמור
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => {
                            setEditingId(null);
                            setPriceDraft("");
                          }}
                          className="h-10"
                        >
                          ביטול
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-brand-muted">
                          יחושב ידנית
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn("h-9 text-xs font-semibold")}
                          onClick={() => {
                            setEditingId(order.id);
                            setPriceDraft("");
                          }}
                        >
                          הזן מחיר
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
