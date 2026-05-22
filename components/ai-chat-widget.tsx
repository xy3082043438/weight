"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
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
  const [streaming, setStreaming] = useState(false);
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

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "AI 请求失败。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let started = false;
      let streamError = "";

      const pushDelta = (delta: string) => {
        acc += delta;
        if (!started) {
          started = true;
          setStreaming(true);
          setMessages((current) => [...current, { role: "assistant", content: acc }]);
        } else {
          setMessages((current) => {
            const next = [...current];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const data = trimmed.slice(5).trim();
          if (!data) {
            continue;
          }
          try {
            const event = JSON.parse(data) as {
              delta?: string;
              error?: string;
            };
            if (event.delta) {
              pushDelta(event.delta);
            } else if (event.error) {
              streamError = event.error;
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }

      if (streamError) {
        // 已出的部分内容保留在气泡里，错误另行提示
        setError(streamError);
      } else if (!started) {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: "（小羊暂时没有想法）" },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 请求失败。");
    } finally {
      setLoading(false);
      setStreaming(false);
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
                {message.role === "user" ? (
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {message.content}
                  </div>
                ) : (
                  <div className="max-w-[80%] space-y-2 rounded-lg bg-muted px-3 py-2 text-sm leading-6 [&_a]:underline [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown
                      components={{
                        a: ({ node: _node, ...props }) => (
                          <a {...props} target="_blank" rel="noreferrer" />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading && !streaming ? (
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
