"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Package, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ORDER_STATUS_LABELS,
  type CourierOrder,
  type CourierProfile,
} from "@/lib/courier";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 18_000;

const ORDER_SELECT =
  "id, order_number, customer_name, customer_phone, pickup_location, dropoff_address, dropoff_city, house_number, entrance_number, entry_code, note, distance_km, price, status, courier_id, created_at, claimed_at, picked_up_at, delivered_at";

type Props = {
  courier: CourierProfile;
};

function formatDropoff(order: CourierOrder) {
  const parts = [
    order.dropoff_address,
    order.dropoff_city,
    order.house_number ? `בית ${order.house_number}` : null,
    order.entrance_number ? `כניסה ${order.entrance_number}` : null,
    order.entry_code ? `קוד ${order.entry_code}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function OrderMeta({ order }: { order: CourierOrder }) {
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-brand-muted">איסוף</dt>
        <dd className="font-medium text-brand-dark">{order.pickup_location}</dd>
      </div>
      <div>
        <dt className="text-brand-muted">מסירה</dt>
        <dd className="font-medium text-brand-dark">{formatDropoff(order)}</dd>
      </div>
      <div className="flex flex-wrap gap-4 pt-1">
        {order.distance_km != null && (
          <div>
            <dt className="text-brand-muted">מרחק</dt>
            <dd className="font-semibold text-brand-dark">
              {order.distance_km} ק״מ
            </dd>
          </div>
        )}
        <div>
          <dt className="text-brand-muted">מחיר</dt>
          <dd className="font-semibold text-brand-dark">
            {order.price != null && order.price !== ""
              ? `₪${order.price}`
              : "יחושב ידנית"}
          </dd>
        </div>
      </div>
      {order.note && (
        <div>
          <dt className="text-brand-muted">הערה</dt>
          <dd className="text-brand-dark">{order.note}</dd>
        </div>
      )}
    </dl>
  );
}

export function CourierDashboard({ courier }: Props) {
  const router = useRouter();
  const [openOrders, setOpenOrders] = useState<CourierOrder[]>([]);
  const [myOrders, setMyOrders] = useState<CourierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadOrders = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("[courier:client] authenticated user id:", user?.id ?? null);
    console.log("[courier:client] courier prop:", courier);

    // Server route logs to the Next.js terminal (session cookies forwarded)
    try {
      const debugRes = await fetch("/api/courier/orders", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const debugJson = await debugRes.json();
      console.log("[courier:client] /api/courier/orders status:", debugRes.status);
      console.log("[courier:client] /api/courier/orders body:", debugJson);
    } catch (err) {
      console.error("[courier:client] /api/courier/orders fetch failed:", err);
    }

    const [pendingRes, mineRes] = await Promise.all([
      supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("courier_id", courier.id)
        .neq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    console.log("[courier:client] pending orders raw:", {
      data: pendingRes.data,
      error: pendingRes.error,
    });
    console.log("[courier:client] my orders raw:", {
      data: mineRes.data,
      error: mineRes.error,
    });

    if (pendingRes.error) {
      console.error("[courier:client] pending orders error:", pendingRes.error);
    }
    if (mineRes.error) {
      console.error("[courier:client] my orders error:", mineRes.error);
    }

    setOpenOrders((pendingRes.data as CourierOrder[]) ?? []);
    setMyOrders((mineRes.data as CourierOrder[]) ?? []);
    setLoading(false);
  }, [courier]);

  useEffect(() => {
    void loadOrders();
    const id = window.setInterval(() => {
      void loadOrders();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadOrders]);

  const logout = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/courier/login");
      router.refresh();
    });
  };

  const claimOrder = (orderId: string) => {
    setActionError(null);
    setActionId(orderId);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .update({
          courier_id: courier.id,
          status: "claimed",
          claimed_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      setActionId(null);

      if (error) {
        console.error(error);
        setActionError("לא הצלחנו לקחת את ההזמנה. נסו שוב.");
        await loadOrders();
        return;
      }

      if (!data) {
        setActionError("מישהו כבר לקח את ההזמנה");
        await loadOrders();
        return;
      }

      await loadOrders();
    });
  };

  const advanceStatus = (
    order: CourierOrder,
    next: "picked_up" | "delivered"
  ) => {
    setActionError(null);
    setActionId(order.id);
    startTransition(async () => {
      const supabase = createClient();
      const patch: Record<string, string> = { status: next };
      if (next === "picked_up") {
        patch.picked_up_at = new Date().toISOString();
      }
      if (next === "delivered") {
        patch.delivered_at = new Date().toISOString();
      }

      const expectedStatus = next === "picked_up" ? "claimed" : "picked_up";

      const { data, error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", order.id)
        .eq("courier_id", courier.id)
        .eq("status", expectedStatus)
        .select("id")
        .maybeSingle();

      setActionId(null);

      if (error || !data) {
        console.error(error);
        setActionError("עדכון הסטטוס נכשל. רעננו את הרשימה ונסו שוב.");
        await loadOrders();
        return;
      }

      await loadOrders();
    });
  };

  const claimed = myOrders.filter((o) => o.status === "claimed");
  const pickedUp = myOrders.filter((o) => o.status === "picked_up");
  const delivered = myOrders.filter((o) => o.status === "delivered");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/nishlach-logo-primary.svg"
            alt="נשלח"
            width={120}
            height={36}
            className="h-9 w-auto"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-sm text-brand-muted">שלום,</p>
            <p className="truncate font-bold text-brand-dark">
              {courier.full_name}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={logout}
          disabled={isPending}
          className="h-11 shrink-0 gap-2"
        >
          <LogOut className="size-4" />
          התנתק
        </Button>
      </header>

      {actionError && (
        <Alert
          variant="destructive"
          className="border-brand-error/40 bg-brand-error/5"
        >
          <AlertDescription className="text-brand-error">
            {actionError}
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-dark">הזמנות פתוחות</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadOrders()}
            className="gap-1.5 text-brand-muted"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            רענון
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-brand-muted">
            <Loader2 className="size-5 animate-spin" />
            טוען הזמנות...
          </div>
        ) : openOrders.length === 0 ? (
          <Card className="border-0 bg-white ring-1 ring-black/5">
            <CardContent className="py-8 text-center text-brand-muted">
              אין הזמנות פתוחות כרגע
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {openOrders.map((order) => (
              <Card
                key={order.id}
                className="border-0 bg-white shadow-sm ring-1 ring-black/5"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg text-brand-dark">
                    <Package className="size-5 text-brand-yellow" />
                    {order.order_number}
                  </CardTitle>
                  <CardDescription className="text-base text-brand-dark">
                    {order.customer_name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <OrderMeta order={order} />
                  <Button
                    type="button"
                    disabled={isPending && actionId === order.id}
                    onClick={() => claimOrder(order.id)}
                    className="h-12 w-full bg-brand-yellow text-base font-bold text-brand-dark hover:bg-brand-yellowHover"
                  >
                    {isPending && actionId === order.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        לוקחים...
                      </>
                    ) : (
                      "קח הזמנה"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 pb-8">
        <h2 className="text-lg font-bold text-brand-dark">ההזמנות שלי</h2>

        <OrderGroup
          title="נלקחו — לחצו אחרי איסוף"
          orders={claimed}
          actionLabel="נאספה"
          onAction={(o) => advanceStatus(o, "picked_up")}
          actionId={actionId}
          isPending={isPending}
        />

        <OrderGroup
          title="נאספו — בדרך למסירה"
          orders={pickedUp}
          actionLabel="נמסרה"
          onAction={(o) => advanceStatus(o, "delivered")}
          actionId={actionId}
          isPending={isPending}
        />

        <OrderGroup
          title="נמסרו"
          orders={delivered}
          actionId={actionId}
          isPending={isPending}
        />
      </section>
    </div>
  );
}

function OrderGroup({
  title,
  orders,
  actionLabel,
  onAction,
  actionId,
  isPending,
}: {
  title: string;
  orders: CourierOrder[];
  actionLabel?: string;
  onAction?: (order: CourierOrder) => void;
  actionId: string | null;
  isPending: boolean;
}) {
  if (orders.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-brand-muted">{title}</h3>
      <div className="space-y-3">
        {orders.map((order) => (
          <Card
            key={order.id}
            className="border-0 bg-white shadow-sm ring-1 ring-black/5"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-brand-dark">
                {order.order_number}
              </CardTitle>
              <CardDescription>
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <OrderMeta order={order} />
              {actionLabel && onAction && (
                <Button
                  type="button"
                  disabled={isPending && actionId === order.id}
                  onClick={() => onAction(order)}
                  className="h-12 w-full bg-brand-dark text-base font-bold text-white hover:bg-brand-dark/90"
                >
                  {isPending && actionId === order.id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      מעדכנים...
                    </>
                  ) : (
                    actionLabel
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
