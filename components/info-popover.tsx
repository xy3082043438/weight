"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoPopoverProps = {
  children: React.ReactNode;
  srLabel?: string;
  className?: string;
};

/**
 * 不占版面的说明气泡：默认只显示一个 ⓘ 小图标，点击后在下方弹出内容。
 * 点击外部或按 Esc 关闭。
 */
export function InfoPopover({ children, srLabel = "查看说明", className }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: Event) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={srLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="-m-1.5 inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="dialog"
          className="absolute left-0 top-6 z-50 w-60 max-w-[calc(100vw-2rem)] rounded-lg border bg-background p-3 text-left text-xs font-normal leading-5 text-foreground shadow-lg animate-in fade-in zoom-in-95"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
