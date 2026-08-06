"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "סקירה", exact: true },
  { href: "/admin/orders", label: "הזמנות" },
  { href: "/admin/couriers", label: "שליחים" },
  { href: "/admin/service-areas", label: "אזורי שירות" },
  { href: "/admin/pricing", label: "תמחור" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-brand-yellow text-brand-dark"
                : "bg-brand-bgLight text-brand-muted hover:text-brand-dark"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
