import { redirect } from "next/navigation";
import { CourierDashboard } from "@/components/courier/courier-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function CourierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/courier/login");
  }

  console.log("[courier:page] authenticated user id:", user.id);

  const { data: courier, error } = await supabase
    .from("couriers")
    .select("id, full_name, phone, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log("[courier:page] courier record:", courier);
  console.log("[courier:page] courier query error:", error);

  // Debug: same pending query the dashboard uses (logs appear in terminal)
  const pendingDebug = await supabase
    .from("orders")
    .select(
      "id, order_number, status, courier_id, created_at, claimed_at, picked_up_at, delivered_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  console.log("[courier:page] pending orders data:", pendingDebug.data);
  console.log("[courier:page] pending orders error:", pendingDebug.error);

  if (error || !courier) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">אין פרופיל שליח</h1>
        <p className="text-brand-muted">
          ההתחברות הצליחה, אבל לא נמצא רשומת שליח מקושרת למשתמש הזה. פנו למנהל
          המערכת.
        </p>
      </main>
    );
  }

  if (!courier.is_active) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">חשבון לא פעיל</h1>
        <p className="text-brand-muted">פנו למנהל המערכת להפעלת החשבון.</p>
      </main>
    );
  }

  return <CourierDashboard courier={courier} />;
}
