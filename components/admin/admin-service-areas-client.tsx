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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AreaRow = {
  id: string;
  city_name: string;
  is_active: boolean;
};

export function AdminServiceAreasClient() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("service_areas")
      .select("id, city_name, is_active")
      .order("city_name", { ascending: true });

    if (loadError) {
      console.error(loadError);
      setError("לא הצלחנו לטעון אזורי שירות.");
    } else {
      setAreas((data as AreaRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = (area: AreaRow) => {
    setTogglingId(area.id);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("service_areas")
        .update({ is_active: !area.is_active })
        .eq("id", area.id);

      setTogglingId(null);

      if (updateError) {
        console.error(updateError);
        setError("עדכון האזור נכשל.");
        return;
      }
      await load();
    });
  };

  const addCity = (e: React.FormEvent) => {
    e.preventDefault();
    const name = cityName.trim();
    if (!name) return;

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from("service_areas")
        .insert({ city_name: name, is_active: true });

      if (insertError) {
        console.error(insertError);
        setError(
          insertError.code === "23505"
            ? "העיר כבר קיימת ברשימה."
            : "הוספת העיר נכשלה."
        );
        return;
      }

      setCityName("");
      await load();
    });
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">אזורי שירות</h1>
        <p className="mt-1 text-sm text-brand-muted">
          ערים פעילות לאיסוף ולמסירה
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

      <Card className="border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardHeader>
          <CardTitle className="text-base font-bold text-brand-dark">
            הוסף עיר
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addCity} className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="city_name">שם העיר</Label>
              <Input
                id="city_name"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                required
                placeholder="למשל: תל אביב-יפו"
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 shrink-0 self-end bg-brand-yellow font-bold text-brand-dark hover:bg-brand-yellowHover sm:px-6"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "הוסף עיר"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-brand-muted">
          <Loader2 className="size-5 animate-spin" />
          טוען...
        </div>
      ) : areas.length === 0 ? (
        <Card className="border-0 bg-white ring-1 ring-black/5">
          <CardContent className="py-8 text-center text-brand-muted">
            אין אזורי שירות עדיין
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {areas.map((area) => (
            <Card
              key={area.id}
              className={cn(
                "border-0 bg-white shadow-sm ring-1 ring-black/5",
                !area.is_active && "opacity-70"
              )}
            >
              <CardContent className="flex items-center justify-between gap-3 py-3.5">
                <div>
                  <p className="font-semibold text-brand-dark">{area.city_name}</p>
                  <p className="text-xs text-brand-muted">
                    {area.is_active ? "פעיל" : "לא פעיל"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending && togglingId === area.id}
                  onClick={() => toggleActive(area)}
                  className="h-10 font-semibold"
                >
                  {area.is_active ? "השבת" : "הפעל"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
