import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ orderNumber: string }>;
};

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "order_number, customer_name, customer_phone, pickup_location, tracking_number, dropoff_address, dropoff_city, house_number, entrance_number, entry_code, note, price, distance_km, status, payment_status, created_at"
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const rows: { label: string; value: string }[] = [
    { label: "שם", value: order.customer_name },
    { label: "טלפון", value: order.customer_phone },
    { label: "איסוף מ", value: order.pickup_location },
    ...(order.tracking_number
      ? [{ label: "מספר מעקב", value: order.tracking_number as string }]
      : []),
    {
      label: "כתובת למשלוח",
      value: [
        order.dropoff_address,
        order.house_number ? `בית ${order.house_number}` : null,
        order.entrance_number ? `כניסה ${order.entrance_number}` : null,
      ]
        .filter(Boolean)
        .join(", "),
    },
    { label: "עיר", value: order.dropoff_city },
    ...(order.note
      ? [{ label: "הערה", value: order.note as string }]
      : []),
  ];

  return (
    <main className="flex flex-1 flex-col">
      <Card className="border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardHeader className="items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-success/10 text-brand-success">
            <CheckCircle2 className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold text-brand-dark">
            ההזמנה התקבלה
          </CardTitle>
          <CardDescription className="text-base text-brand-muted">
            נציג יחזור אליך בהקדם
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-xl bg-brand-yellow/15 p-4 text-center ring-1 ring-brand-yellow/30">
            <p className="text-sm text-brand-muted">מספר הזמנה</p>
            <p className="mt-1 text-2xl font-bold tracking-wide text-brand-dark">
              {order.order_number}
            </p>
          </div>

          <div className="rounded-xl bg-brand-bgLight p-4 text-center ring-1 ring-black/5">
            <p className="text-sm text-brand-muted">מחיר</p>
            <p className="mt-1 text-3xl font-bold text-brand-dark">
              {order.price != null ? `₪${order.price}` : "יחושב ידנית"}
            </p>
            {order.distance_km != null && (
              <p className="mt-1 text-sm text-brand-muted">
                מרחק משוער: {order.distance_km} ק״מ
              </p>
            )}
          </div>

          <dl className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-0.5 border-b border-black/5 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-sm text-brand-muted">{row.label}</dt>
                <dd className="text-base font-medium text-brand-dark">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/"
            className={cn(
              buttonVariants(),
              "h-12 w-full bg-brand-yellow font-bold text-brand-dark hover:bg-brand-yellowHover"
            )}
          >
            הזמנה חדשה
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
