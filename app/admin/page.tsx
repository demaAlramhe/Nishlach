import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { createClient } from "@/lib/supabase/server";

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekSunday(d = new Date()) {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const todayIso = startOfLocalDay().toISOString();
  const weekIso = startOfWeekSunday().toISOString();

  const [todayRes, weekRes, weekPriceRes, statusRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayIso),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekIso),
    supabase.from("orders").select("price").gte("created_at", weekIso),
    supabase.from("orders").select("status"),
  ]);

  const ordersToday = todayRes.count ?? 0;
  const ordersWeek = weekRes.count ?? 0;
  const revenueWeek = (weekPriceRes.data ?? []).reduce((sum, row) => {
    const p = row.price != null ? Number(row.price) : 0;
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);

  const byStatus = { pending: 0, claimed: 0, picked_up: 0, delivered: 0 };
  for (const row of statusRes.data ?? []) {
    const s = row.status as keyof typeof byStatus;
    if (s in byStatus) byStatus[s] += 1;
  }

  const statCards = [
    { label: "הזמנות היום", value: String(ordersToday) },
    { label: "הזמנות השבוע", value: String(ordersWeek) },
    {
      label: "הכנסות השבוע",
      value: `₪${Math.round(revenueWeek)}`,
      hint: "סכום מחירים שמולאו",
    },
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">סקירה</h1>
        <p className="mt-1 text-sm text-brand-muted">
          תמונת מצב מהירה של ההזמנות וההכנסות
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="border-0 bg-white shadow-sm ring-1 ring-black/5"
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-brand-muted">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight text-brand-dark">
                {card.value}
              </p>
              {"hint" in card && card.hint && (
                <p className="mt-1 text-xs text-brand-muted">{card.hint}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardHeader>
          <CardTitle className="text-base font-bold text-brand-dark">
            הזמנות לפי סטטוס
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(
              [
                "pending",
                "claimed",
                "picked_up",
                "delivered",
              ] as const
            ).map((status) => (
              <li
                key={status}
                className="flex items-center justify-between gap-3 rounded-xl bg-brand-bgLight px-3 py-3"
              >
                <OrderStatusBadge status={status} />
                <span className="text-xl font-bold text-brand-dark">
                  {byStatus[status]}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
