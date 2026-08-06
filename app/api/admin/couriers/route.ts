import { NextResponse } from "next/server";
import { z } from "zod";
import { courierAuthEmail } from "@/lib/courier";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  full_name: z.string().trim().min(2, "שם מלא קצר מדי"),
  username: z
    .string()
    .trim()
    .min(2, "שם משתמש קצר מדי")
    .regex(/^[a-zA-Z0-9._-]+$/, "שם משתמש באנגלית בלבד"),
  password: z.string().min(6, "סיסמה חייבת לפחות 6 תווים"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "לא מחוברים" }, { status: 401 });
    }

    const { data: adminRow } = await supabase
      .from("couriers")
      .select("id, is_admin, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!adminRow?.is_admin || !adminRow.is_active) {
      return NextResponse.json({ error: "אין הרשאת מנהל" }, { status: 403 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
        },
        { status: 400 }
      );
    }

    const { full_name, username, password } = parsed.data;
    const email = courierAuthEmail(username);
    const admin = createServiceClient();

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, username: username.toLowerCase() },
      });

    if (createError || !created.user) {
      console.error("[admin] createUser failed", createError);
      const msg = createError?.message?.includes("already")
        ? "שם המשתמש כבר קיים"
        : "יצירת משתמש האימות נכשלה";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const authUserId = created.user.id;

    const { error: insertError } = await admin.from("couriers").insert({
      full_name,
      phone: null,
      auth_user_id: authUserId,
      is_active: true,
      is_admin: false,
    });

    if (insertError) {
      console.error("[admin] courier insert failed", insertError);
      await admin.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        { error: "יצירת רשומת השליח נכשלה" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/couriers", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
