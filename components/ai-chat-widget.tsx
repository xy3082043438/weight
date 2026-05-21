"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SheepMark } from "@/components/sheep-mark";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const greeting: ChatMessage = {
  role: "assistant",
  content:
    "我是陪你看数据的小羊 🐑。体重起起伏伏很正常，想聊聊最近的趋势、平台期还是目标，都可以问我。",
};

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) {
      return;
    }

    setInput("");
    setError("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "AI 请求失败。");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.reply || "（小羊暂时没有想法）" },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 请求失败。");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="打开 AI 小羊助手"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
        >
          <SheepMark className="h-9 w-9 text-primary-foreground" />
        </button>
      ) : (
        <div className="fixed bottom-5 right-5 z-50 flex h-[70vh] max-h-[560px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <SheepMark className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold">小羊助手</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="关闭"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[80%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm leading-6"
                  }
                >
                  {message.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            ) : null}
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="问问小羊，如：这个月趋势怎么样？"
                className="min-h-[40px] resize-none"
              />
              <Button
                type="button"
                size="icon"
                aria-label="发送"
                disabled={loading || !input.trim()}
                onClick={() => void send()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
