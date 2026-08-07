import { MessageCircle } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/972543054488?text=" +
  encodeURIComponent("שלום, יש לי שאלה לגבי משלוח באתר נשלח");

export function WhatsAppFloatingButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="צור קשר בוואטסאפ"
      className="fixed bottom-6 left-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-[#20BD5A] active:scale-95"
    >
      <MessageCircle className="size-7" strokeWidth={2.25} aria-hidden />
    </a>
  );
}
