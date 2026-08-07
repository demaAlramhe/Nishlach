import Image from "next/image";
import Link from "next/link";
import { WhatsAppFloatingButton } from "@/components/public/whatsapp-floating-button";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-brand-bgLight/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <Link href="/" className="inline-flex items-center" aria-label="נשלח">
            <Image
              src="/brand/nishlach-logo-primary.svg"
              alt="נשלח"
              width={160}
              height={48}
              priority
              className="h-10 w-auto max-h-12 sm:h-12"
            />
          </Link>
          <p className="text-sm text-brand-muted">איסוף ומשלוח</p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 pb-24 sm:py-10 sm:pb-24">
        {children}
      </div>
      <WhatsAppFloatingButton />
    </div>
  );
}
