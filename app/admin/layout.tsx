import Link from "next/link";
import Image from "next/image";
import { requireAdminSession } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-brand-dark">
          אין לך הרשאת גישה
        </h1>
        <p className="text-brand-muted">
          פאנל הניהול זמין רק למשתמשים עם הרשאת מנהל.
        </p>
        <Link
          href="/courier"
          className={cn(
            buttonVariants(),
            "h-12 bg-brand-yellow font-bold text-brand-dark hover:bg-brand-yellowHover"
          )}
        >
          חזרה לפאנל שליח
        </Link>
      </main>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/nishlach-logo-primary.svg"
            alt="נשלח"
            width={110}
            height={32}
            className="h-8 w-auto"
            priority
          />
          <div className="min-w-0">
            <p className="text-xs text-brand-muted">פאנל ניהול</p>
            <p className="truncate text-sm font-bold text-brand-dark">
              {session.courier.full_name}
            </p>
          </div>
        </div>
        <Link
          href="/courier"
          className="text-sm font-medium text-brand-muted underline-offset-2 hover:text-brand-dark hover:underline"
        >
          ← פאנל שליח
        </Link>
      </header>

      <AdminNav />

      <div className="flex-1 pb-10">{children}</div>
    </div>
  );
}
