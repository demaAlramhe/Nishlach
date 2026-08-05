"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { courierAuthEmail } from "@/lib/courier";
import { createClient } from "@/lib/supabase/client";

export function CourierLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed || !password) {
      setError("שם משתמש או סיסמה שגויים");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const email = courierAuthEmail(trimmed);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("שם משתמש או סיסמה שגויים");
        return;
      }

      router.replace("/courier");
      router.refresh();
    });
  };

  return (
    <Card className="w-full border-0 bg-white shadow-sm ring-1 ring-black/5">
      <CardHeader className="gap-1.5 text-center">
        <CardTitle className="text-2xl font-bold text-brand-dark">
          כניסת שליחים
        </CardTitle>
        <CardDescription className="text-base text-brand-muted">
          התחברו כדי לראות ולקחת הזמנות
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-base text-brand-dark">
              שם משתמש
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-12 text-base"
              suppressHydrationWarning
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base text-brand-dark">
              סיסמה
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-12 text-base"
              suppressHydrationWarning
              disabled={isPending}
            />
          </div>

          {error && (
            <Alert
              variant="destructive"
              className="border-brand-error/40 bg-brand-error/5"
            >
              <AlertDescription className="text-brand-error">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="h-14 w-full bg-brand-yellow text-base font-bold text-brand-dark hover:bg-brand-yellowHover"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                מתחברים...
              </>
            ) : (
              "כניסה"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
