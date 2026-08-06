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

type CourierRow = {
  id: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

export function AdminCouriersClient() {
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("couriers")
      .select("id, full_name, is_active, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      console.error(loadError);
      setError("לא הצלחנו לטעון שליחים.");
    } else {
      setCouriers((data as CourierRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = (courier: CourierRow) => {
    setTogglingId(courier.id);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("couriers")
        .update({ is_active: !courier.is_active })
        .eq("id", courier.id);

      setTogglingId(null);

      if (updateError) {
        console.error(updateError);
        setError("עדכון הסטטוס נכשל.");
        return;
      }
      await load();
    });
  };

  const addCourier = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/couriers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName,
            username,
            password,
          }),
        });
        const data = (await res.json()) as { error?: string; ok?: boolean };

        if (!res.ok) {
          setError(data.error || "יצירת השליח נכשלה.");
          return;
        }

        setFullName("");
        setUsername("");
        setPassword("");
        setSuccess("השליח נוסף בהצלחה.");
        await load();
      } catch {
        setError("שגיאת רשת. נסו שוב.");
      }
    });
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-dark">שליחים</h1>
        <p className="mt-1 text-sm text-brand-muted">
          ניהול חשבונות שליחים והרשאות
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

      <Card className="border-0 bg-white shadow-sm ring-1 ring-black/5">
        <CardHeader>
          <CardTitle className="text-base font-bold text-brand-dark">
            הוסף שליח
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addCourier} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="full_name">שם מלא</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">שם משתמש</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                dir="ltr"
                className="h-11 text-left"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                className="h-11 text-left"
                autoComplete="new-password"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={isPending}
                className="h-12 w-full bg-brand-yellow font-bold text-brand-dark hover:bg-brand-yellowHover sm:w-auto sm:px-8"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    יוצרים...
                  </>
                ) : (
                  "הוסף שליח"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-brand-muted">
          <Loader2 className="size-5 animate-spin" />
          טוען...
        </div>
      ) : (
        <div className="space-y-3">
          {couriers.map((courier) => (
            <Card
              key={courier.id}
              className={cn(
                "border-0 bg-white shadow-sm ring-1 ring-black/5",
                !courier.is_active && "opacity-70"
              )}
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-brand-dark">{courier.full_name}</p>
                  <div className="flex flex-wrap gap-2">
                    {courier.is_admin && (
                      <span className="rounded-full bg-brand-yellow/25 px-2.5 py-0.5 text-xs font-semibold text-brand-dark ring-1 ring-brand-yellow/40">
                        מנהל
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                        courier.is_active
                          ? "bg-brand-success/10 text-brand-success ring-brand-success/30"
                          : "bg-neutral-100 text-brand-muted ring-neutral-200"
                      )}
                    >
                      {courier.is_active ? "פעיל" : "לא פעיל"}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending && togglingId === courier.id}
                  onClick={() => toggleActive(courier)}
                  className="h-10 shrink-0 font-semibold"
                >
                  {courier.is_active ? "השבת" : "הפעל"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
