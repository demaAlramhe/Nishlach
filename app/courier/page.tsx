import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CourierDashboard } from "@/components/courier/courier-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function CourierPage() {
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  const hasAuthCookie = cookieNames.some(
    (n) => n.includes("auth-token") || n.startsWith("sb-")
  );

  console.log("[courier:page] === profile fetch debug ===");
  console.log(
    "[courier:page] client: SERVER (@/lib/supabase/server via cookies())"
  );
  console.log("[courier:page] cookie names:", cookieNames);
  console.log("[courier:page] has supabase auth cookie:", hasAuthCookie);

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("[courier:page] getUser error:", userError);
  console.log("[courier:page] authenticated user id:", user?.id ?? null);
  console.log("[courier:page] authenticated user email:", user?.email ?? null);

  if (!user) {
    redirect("/courier/login");
  }

  const selectCols = "id, full_name, phone, is_active, is_admin";
  console.log(
    "[courier:page] query: from('couriers').select(%s).eq('auth_user_id', %s).maybeSingle()",
    selectCols,
    user.id
  );

  const { data: courier, error } = await supabase
    .from("couriers")
    .select(selectCols)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  console.log(
    "[courier:page] courier result data:",
    JSON.stringify(courier, null, 2)
  );
  console.log(
    "[courier:page] courier result error:",
    error
      ? JSON.stringify(
          {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
          null,
          2
        )
      : null
  );

  // Extra probe: same filter without maybeSingle (array) to see RLS row visibility
  const listProbe = await supabase
    .from("couriers")
    .select(selectCols)
    .eq("auth_user_id", user.id);
  console.log(
    "[courier:page] list probe count:",
    listProbe.data?.length ?? null,
    "error:",
    listProbe.error
      ? {
          message: listProbe.error.message,
          code: listProbe.error.code,
          details: listProbe.error.details,
          hint: listProbe.error.hint,
        }
      : null
  );

  // Debug: same pending query the dashboard uses (logs appear in terminal)
  const pendingDebug = await supabase
    .from("orders")
    .select(
      "id, order_number, status, courier_id, created_at, claimed_at, picked_up_at, delivered_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  console.log(
    "[courier:page] pending orders count:",
    pendingDebug.data?.length ?? null
  );
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
