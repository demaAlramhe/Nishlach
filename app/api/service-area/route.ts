import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  city_name: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "עיר חסרה" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_areas")
      .select("id, city_name")
      .eq("city_name", parsed.data.city_name)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("service area check failed", error);
      return NextResponse.json({ error: "שגיאה בבדיקת אזור" }, { status: 500 });
    }

    return NextResponse.json({
      available: Boolean(data),
      city_name: parsed.data.city_name,
    });
  } catch (error) {
    console.error("POST /api/service-area", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
