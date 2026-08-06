"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type ConfigRow = {
  id: string;
  base_price: number | string;
  free_km: number | string;
  price_per_km: number | string;
};

export function AdminPricingClient() {
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [basePrice, setBasePrice] = useState("50");
  const [freeKm, setFreeKm] = useState("5");
  const [pricePerKm, setPricePerKm] = useState("5");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("pricing_config")
      .select("id, base_price, free_km, price_per_km")
      .limit(1)
      .maybeSingle();

    if (loadError) {
      console.error(loadError);
      setError("לא הצלחנו לטעון את הגדרות התמחור.");
    } else if (data) {
      setConfig(data as ConfigRow);
      setBasePrice(String(data.base_price));
      setFreeKm(String(data.free_km));
      setPricePerKm(String(data.price_per_km));
    } else {
      setError("לא נמצאה שורת תמחור. הריצו את ה-SQL של pricing_config.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const base = Number(basePrice);
    const free = Number(freeKm);
    const perKm = Number(pricePerKm);

    if (
      !Number.isFinite(base) ||
      !Number.isFinite(free) ||
      !Number.isFinite(perKm) ||
      base < 0 ||
      free < 0 ||
      perKm < 0
    ) {
      setError("נא להזין ערכים מספריים תקינים (לא שליליים).");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("pricing_config")
        .update({
          base_price: base,
          free_km: free,
          price_per_km: perKm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      if (updateError) {
        console.error(updateError);
        setError("שמירת התמחור נכשלה.");
        return;
      }

      setSuccess("התמחור עודכן.");
      await load();
    });
  };

  const exampleExtra = Math.ceil(Math.max(0, 6.3 - Number(freeKm || 5)));
  const examplePrice =
    Number(basePrice || 50) + exampleExtra * Number(pricePerKm || 5);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">תמחור</h1>
        <p className="mt-1 text-sm text-brand-muted">
          נוסחה: מחיר בסיס + ₪ לכל ק״מ מעבר לסף (עיגול למעלה)
        </p>
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="border-brand-error/40 bg-brand-error/5"
        >
          <AlertDescription className="text-brand-error">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-brand-success/30 bg-brand-success/5">
          <AlertDescription className="text-brand-success">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-brand-muted">
          <Loader2 className="size-5 animate-spin" />
          טוען...
        </div>
      ) : (
        <Card className="border-0 bg-white shadow-sm ring-1 ring-black/5">
          <CardHeader>
            <CardTitle className="text-base font-bold text-brand-dark">
              קבועי נוסחה
            </CardTitle>
            <CardDescription>
              דוגמה: 6.3 ק״מ → ₪{Number.isFinite(examplePrice) ? examplePrice : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="base_price">מחיר בסיס (₪)</Label>
                <Input
                  id="base_price"
                  type="number"
                  min={0}
                  step={1}
                  dir="ltr"
                  className="h-11 text-left"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="free_km">ק״מ כלולים במחיר הבסיס</Label>
                <Input
                  id="free_km"
                  type="number"
                  min={0}
                  step={0.1}
                  dir="ltr"
                  className="h-11 text-left"
                  value={freeKm}
                  onChange={(e) => setFreeKm(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price_per_km">₪ לכל ק״מ נוסף</Label>
                <Input
                  id="price_per_km"
                  type="number"
                  min={0}
                  step={1}
                  dir="ltr"
                  className="h-11 text-left"
                  value={pricePerKm}
                  onChange={(e) => setPricePerKm(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <Button
                  type="submit"
                  disabled={isPending || !config}
                  className="h-12 w-full bg-brand-yellow font-bold text-brand-dark hover:bg-brand-yellowHover sm:w-auto sm:px-8"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      שומרים...
                    </>
                  ) : (
                    "שמור תמחור"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
