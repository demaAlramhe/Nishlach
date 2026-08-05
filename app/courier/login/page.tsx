import Image from "next/image";
import { CourierLoginForm } from "@/components/courier/login-form";

export default function CourierLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/brand/nishlach-logo-primary.svg"
          alt="נשלח"
          width={160}
          height={48}
          className="h-12 w-auto"
          priority
        />
        <p className="text-sm text-brand-muted">פאנל שליחים</p>
      </div>
      <CourierLoginForm />
    </main>
  );
}
