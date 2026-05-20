"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToCompressedBase64 } from "@/lib/image";

const ocrPrompt =
  "只识别图片中的体重数字（单位 kg），只输出一个数字，例如 72.4；无法识别输出 none。";

type Props = {
  onRecognized: (weightKg: number) => void;
  disabled?: boolean;
};

export function WeightOcrButton({ onRecognized, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const { base64, mimeType } = await fileToCompressedBase64(file);
      const response = await fetch("/api/ai/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, prompt: ocrPrompt }),
      });
      const payload = await response.json();
      if (response.status === 429) {
        throw new Error(payload.message ?? "今日 OCR 次数已用完，请明天再试。");
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "OCR 识别失败。");
      }

      const match = String(payload.text ?? "").match(/\d{1,3}(?:\.\d{1,2})?/);
      const weight = match ? Number(match[0]) : NaN;
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error("未识别到体重，请手动输入。");
      }

      onRecognized(weight);
      setMessage(`识别成功：${weight.toFixed(1)} kg`);
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "OCR 识别失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        拍照识别体重
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {message ? (
        <p
          className={
            isError
              ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
