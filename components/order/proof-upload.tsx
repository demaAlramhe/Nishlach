"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type ProofUploadProps = {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function ProofUpload({ value, onChange, disabled }: ProofUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("נא להעלות קובץ תמונה בלבד.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("הקובץ גדול מדי (מקסימום 8MB).");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error(uploadError);
        setError("העלאה נכשלה. נסו שוב.");
        return;
      }

      const { data } = supabase.storage.from("proofs").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      console.error(err);
      setError("העלאה נכשלה. נסו שוב.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-base text-brand-dark">
        צילום ההודעה/תעודה{" "}
        <span className="font-normal text-brand-muted">(אופציונלי)</span>
      </Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />

      {value ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="צילום הוכחה"
            className="h-20 w-20 rounded-lg object-cover"
          />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm text-brand-muted">התמונה הועלתה בהצלחה</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onChange("")}
              className="w-fit gap-1"
            >
              <X className="size-3.5" />
              הסר
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="h-12 w-full gap-2 border-dashed text-base"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? "מעלה..." : "העלאת תמונה"}
        </Button>
      )}

      {error && <p className="text-sm text-brand-error">{error}</p>}
    </div>
  );
}
