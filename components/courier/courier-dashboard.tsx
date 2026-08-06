"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, Package, RefreshCw, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ORDER_STATUS_BADGE_CLASS,
  ORDER_STATUS_LABELS,
  type CourierOrder,
  type CourierProfile,
} from "@/lib/courier";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 18_000;

const ORDER_SELECT =
  "id, order_number, customer_name, customer_phone, pickup_location, tracking_number, proof_text, dropoff_address, dropoff_city, house_number, entrance_number, entry_code, note, distance_km, price, status, courier_id, created_at, claimed_at, picked_up_at, delivered_at";

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

function formatPrice(order: CourierOrder) {
  if (order.price != null && order.price !== "") {
    return `₪${order.price}`;
  }
  return "יחושב ידנית";
}

function StatusBadge({ status }: { status: string }) {
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

function MetaCell({
  label,
  children,
  dir,
}: {
  label: string;
  children: ReactNode;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-brand-muted">{label}</dt>
      <dd
        className="truncate text-sm font-semibold leading-snug text-brand-dark"
        dir={dir}
      >
        {children}
      </dd>
    </div>
  );
}

function CollapsibleProof({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 80 || text.split("\n").length > 2;

  return (
    <div>
      <p className="text-[11px] leading-tight text-brand-muted">הודעת המשלוח</p>
      <div
        className={cn(
          "mt-1 whitespace-pre-wrap rounded-lg border border-black/5 bg-brand-bgLight px-2.5 py-2 text-xs leading-snug text-brand-dark",
          !expanded && isLong && "line-clamp-2"
        )}
      >
        {text}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold text-brand-muted underline-offset-2 hover:text-brand-dark hover:underline"
        >
          {expanded ? "הסתר הודעה ▴" : "הצג הודעה מלאה ▾"}
        </button>
      )}
    </div>
  );
}

function OrderMeta({ order }: { order: CourierOrder }) {
  const proofText = order.proof_text?.trim();
  const tracking = order.tracking_number?.trim();
  const distancePrice =
    order.distance_km != null
      ? `${order.distance_km} ק״מ · ${formatPrice(order)}`
      : formatPrice(order);

  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <MetaCell label="לקוח">{order.customer_name}</MetaCell>
        <MetaCell label="טלפון" dir="ltr">
          <a
            href={`tel:${order.customer_phone}`}
            className="underline-offset-2 hover:underline"
          >
            {order.customer_phone}
          </a>
        </MetaCell>
        <MetaCell label="מספר מעקב" dir="ltr">
          {tracking || "—"}
        </MetaCell>
        <MetaCell label="מרחק / מחיר">{distancePrice}</MetaCell>
      </dl>

      <dl className="space-y-1.5">
        <div>
          <dt className="text-[11px] leading-tight text-brand-muted">איסוף</dt>
          <dd className="text-xs leading-snug text-brand-dark">
            {order.pickup_location}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] leading-tight text-brand-muted">מסירה</dt>
          <dd className="text-xs leading-snug text-brand-dark">
            {formatDropoff(order)}
          </dd>
        </div>
      </dl>

      {proofText && <CollapsibleProof text={proofText} />}

      {order.note?.trim() && (
        <div>
          <p className="text-[11px] leading-tight text-brand-muted">הערה</p>
          <p className="text-xs leading-snug text-brand-dark">{order.note}</p>
        </div>
      )}
    </div>
  );
}

type OrderCardProps = {
  order: CourierOrder;
  actionLabel?: string;
  actionLoadingLabel?: string;
  onAction?: () => void;
  actionBusy?: boolean;
  muted?: boolean;
};

function OrderCard({
  order,
  actionLabel,
  actionLoadingLabel = "מעדכנים...",
  onAction,
  actionBusy,
  muted,
}: OrderCardProps) {
  return (
    <Card
      className={cn(
        "border-0 bg-white shadow-sm ring-1 ring-black/5",
        muted && "opacity-70"
      )}
    >
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base text-brand-dark">
            <Package className="size-4 shrink-0 text-brand-yellow" />
            <span className="truncate">{order.order_number}</span>
          </CardTitle>
          <StatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <OrderMeta order={order} />
        {actionLabel && onAction && (
          <Button
            type="button"
            disabled={actionBusy}
            onClick={onAction}
            className="h-12 w-full bg-brand-yellow text-base font-bold text-brand-dark hover:bg-brand-yellowHover disabled:opacity-60"
          >
            {actionBusy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {actionLoadingLabel}
              </>
            ) : (
              actionLabel
            )}
          </Button>
        )}
      </CardContent>
    </Card>
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

  const sectionTabs = useMemo(() => {
    const tabs: { id: string; label: string; count: number }[] = [];
    if (openOrders.length > 0) {
      tabs.push({
        id: "open-orders",
        label: "פתוחות",
        count: openOrders.length,
      });
    }
    if (claimed.length > 0) {
      tabs.push({ id: "my-claimed", label: "נתפסו", count: claimed.length });
    }
    if (pickedUp.length > 0) {
      tabs.push({
        id: "my-picked-up",
        label: "נאספו",
        count: pickedUp.length,
      });
    }
    if (delivered.length > 0) {
      tabs.push({
        id: "my-delivered",
        label: "נמסרו",
        count: delivered.length,
      });
    }
    return tabs;
  }, [openOrders.length, claimed.length, pickedUp.length, delivered.length]);

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const scrollingToRef = useRef<string | null>(null);

  useEffect(() => {
    if (sectionTabs.length === 0) {
      setActiveSection(null);
      return;
    }

    setActiveSection((current) =>
      current && sectionTabs.some((t) => t.id === current)
        ? current
        : sectionTabs[0].id
    );

    const elements = sectionTabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToRef.current) return;

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop
          );

        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        // Account for sticky tabs ~56px + a bit of breathing room
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0, 0.1, 0.25],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionTabs]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    scrollingToRef.current = id;
    setActiveSection(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      if (scrollingToRef.current === id) {
        scrollingToRef.current = null;
      }
    }, 800);
  };

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
        <div className="flex shrink-0 items-center gap-2">
          {courier.is_admin && (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-sm font-semibold text-brand-dark hover:bg-brand-bgLight"
            >
              <Settings className="size-4" />
              ניהול
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            disabled={isPending}
            className="h-11 gap-2"
          >
            <LogOut className="size-4" />
            התנתק
          </Button>
        </div>
      </header>

      {sectionTabs.length > 0 && (
        <nav
          aria-label="ניווט בין סטטוסים"
          className="sticky top-0 z-20 -mx-4 border-b border-black/5 bg-brand-bgLight px-4 py-2"
        >
          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-0.5">
            {sectionTabs.map((tab) => {
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => scrollToSection(tab.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-brand-yellow text-brand-dark"
                      : "bg-white text-brand-muted ring-1 ring-black/5 hover:text-brand-dark"
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>
        </nav>
      )}

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

      <section
        id="open-orders"
        className="scroll-mt-16 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-dark">
            הזמנות פתוחות
            {!loading && openOrders.length > 0 && (
              <span className="ms-2 text-sm font-semibold text-brand-muted">
                ({openOrders.length})
              </span>
            )}
          </h2>
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
              <OrderCard
                key={order.id}
                order={order}
                actionLabel="קח הזמנה"
                actionLoadingLabel="לוקחים..."
                actionBusy={isPending && actionId === order.id}
                onAction={() => claimOrder(order.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5 pb-8">
        <h2 className="text-lg font-bold text-brand-dark">ההזמנות שלי</h2>

        {!loading &&
          claimed.length === 0 &&
          pickedUp.length === 0 &&
          delivered.length === 0 && (
            <Card className="border-0 bg-white ring-1 ring-black/5">
              <CardContent className="py-8 text-center text-brand-muted">
                עדיין אין הזמנות שלך
              </CardContent>
            </Card>
          )}

        <OrderGroup
          id="my-claimed"
          title="נתפסו"
          hint="לחצו אחרי האיסוף"
          orders={claimed}
          actionLabel="נאספה"
          onAction={(o) => advanceStatus(o, "picked_up")}
          actionId={actionId}
          isPending={isPending}
        />

        <OrderGroup
          id="my-picked-up"
          title="נאספו"
          hint="בדרך למסירה"
          orders={pickedUp}
          actionLabel="נמסרה"
          onAction={(o) => advanceStatus(o, "delivered")}
          actionId={actionId}
          isPending={isPending}
        />

        <OrderGroup
          id="my-delivered"
          title="נמסרו"
          orders={delivered}
          actionId={actionId}
          isPending={isPending}
          muted
        />
      </section>
    </div>
  );
}

function OrderGroup({
  id,
  title,
  hint,
  orders,
  actionLabel,
  onAction,
  actionId,
  isPending,
  muted,
}: {
  id: string;
  title: string;
  hint?: string;
  orders: CourierOrder[];
  actionLabel?: string;
  onAction?: (order: CourierOrder) => void;
  actionId: string | null;
  isPending: boolean;
  muted?: boolean;
}) {
  if (orders.length === 0) return null;

  return (
    <div id={id} className="scroll-mt-16 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-brand-dark">
          {title}
          <span className="ms-2 text-sm font-semibold text-brand-muted">
            ({orders.length})
          </span>
        </h3>
        {hint && <p className="text-xs text-brand-muted">{hint}</p>}
      </div>
      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            muted={muted}
            actionLabel={actionLabel}
            actionBusy={isPending && actionId === order.id}
            onAction={onAction ? () => onAction(order) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
