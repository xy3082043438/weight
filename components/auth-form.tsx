"use client";

import { useState, useTransition } from "react";
import { Activity, Loader2, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function AuthForm({ error }: { error?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    account: "",
    password: "",
    heightCm: "",
    targetWeightKg: "",
  });
  const [message, setMessage] = useState(error ?? "");
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/auth/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "请求失败");
        }
        window.location.reload();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "请求失败");
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-3 text-center">
          <Badge variant="secondary" className="mx-auto gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            体重记录
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">体重记录</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              登录后记录个人体重和体脂，数据按账号独立保存。
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "登录" : "注册"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "使用你的账号进入体重记录面板。"
                : "创建账号后会自动登录。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted p-1">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("login")}
              >
                <LogIn className="h-4 w-4" />
                登录
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("register")}
              >
                <UserPlus className="h-4 w-4" />
                注册
              </Button>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor="account">账号</Label>
                <Input
                  id="account"
                  autoComplete="username"
                  placeholder="例如 zhangsan"
                  value={form.account}
                  onChange={(event) =>
                    setForm({ ...form, account: event.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 6 : 1}
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  required
                />
              </div>
              {mode === "register" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="heightCm">身高 cm</Label>
                    <Input
                      id="heightCm"
                      inputMode="decimal"
                      type="number"
                      min="50"
                      max="260"
                      step="0.1"
                      placeholder="例如 175"
                      value={form.heightCm}
                      onChange={(event) =>
                        setForm({ ...form, heightCm: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="targetWeightKg">目标体重 kg</Label>
                    <Input
                      id="targetWeightKg"
                      inputMode="decimal"
                      type="number"
                      min="1"
                      max="500"
                      step="0.1"
                      placeholder="例如 68"
                      value={form.targetWeightKg}
                      onChange={(event) =>
                        setForm({ ...form, targetWeightKg: event.target.value })
                      }
                    />
                  </div>
                </>
              ) : null}
              {message ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {message}
                </p>
              ) : null}
              <Button className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {mode === "login" ? "登录" : "注册并登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
