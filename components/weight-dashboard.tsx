"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  LineChartIcon,
  Loader2,
  LogOut,
  Plus,
  Scale,
  Trash2,
  User,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { WeightEntry } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";
import type { WeightStats } from "@/lib/weight";

type DashboardData = {
  entries: WeightEntry[];
  stats: WeightStats;
};

type Props = DashboardData & {
  user: AuthUser;
  error?: string;
};

const emptyStats: WeightStats = {
  latest: null,
  latestDate: null,
  change: null,
  min: null,
  max: null,
  average: null,
  count: 0,
};

function displayNumber(value: number | null, suffix = "") {
  return value === null ? "--" : `${value.toFixed(1)}${suffix}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function WeightDashboard({ entries, stats, user, error }: Props) {
  const [data, setData] = useState<DashboardData>({
    entries,
    stats: stats ?? emptyStats,
  });
  const [form, setForm] = useState({
    measuredAt: today(),
    weightKg: "",
    note: "",
  });
  const [message, setMessage] = useState(error ?? "");
  const [isPending, startTransition] = useTransition();

  const chartData = useMemo(
    () =>
      data.entries.map((entry) => ({
        ...entry,
        dateLabel: format(parseISO(entry.measuredAt), "MM/dd"),
      })),
    [data.entries],
  );

  const recentEntries = [...data.entries].reverse();

  async function refreshFromResponse(response: Response) {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "请求失败");
    }
    setData({ entries: payload.entries, stats: payload.stats });
  }

  function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/weights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        await refreshFromResponse(response);
        setForm((current) => ({
          measuredAt: current.measuredAt,
          weightKg: "",
          note: "",
        }));
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "保存失败");
      }
    });
  }

  function removeEntry(id: number) {
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/weights?id=${id}`, {
          method: "DELETE",
        });
        await refreshFromResponse(response);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "删除失败");
      }
    });
  }

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    });
  }

  return (
    <main className="min-h-screen">
      <section className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                体重记录
              </Badge>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                  体重记录
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  记录每日体重，查看趋势、波动区间和近期变化。
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:min-w-[360px]">
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{user.account}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  disabled={isPending}
                >
                  <LogOut className="h-4 w-4" />
                  退出
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-background p-2 text-center">
                <MetricCell label="当前" value={displayNumber(data.stats.latest, " kg")} />
                <MetricCell label="变化" value={displayNumber(data.stats.change, " kg")} />
                <MetricCell label="记录" value={`${data.stats.count}`} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新增记录
              </CardTitle>
              <CardDescription>同一天重复提交会更新原记录。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitEntry}>
                <div className="grid gap-2">
                  <Label htmlFor="measuredAt">日期</Label>
                  <Input
                    id="measuredAt"
                    type="date"
                    value={form.measuredAt}
                    onChange={(event) =>
                      setForm({ ...form, measuredAt: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="weightKg">体重 kg</Label>
                  <Input
                    id="weightKg"
                    inputMode="decimal"
                    placeholder="72.4"
                    type="number"
                    min="1"
                    max="500"
                    step="0.1"
                    value={form.weightKg}
                    onChange={(event) =>
                      setForm({ ...form, weightKg: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">备注</Label>
                  <Textarea
                    id="note"
                    placeholder="训练、饮食、睡眠等影响因素"
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                  />
                </div>
                {message ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {message}
                  </p>
                ) : null}
                <Button className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  保存记录
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Activity} label="平均" value={displayNumber(data.stats.average, " kg")} />
            <StatCard icon={Dumbbell} label="最低" value={displayNumber(data.stats.min, " kg")} />
            <StatCard icon={LineChartIcon} label="最高" value={displayNumber(data.stats.max, " kg")} />
            <StatCard
              icon={CalendarDays}
              label="最近日期"
              value={data.stats.latestDate ? data.stats.latestDate.slice(5) : "--"}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>趋势图</CardTitle>
              <CardDescription>体重趋势会随记录自动更新。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] sm:h-[360px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: -18, right: 10, top: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        domain={["dataMin - 1", "dataMax + 1"]}
                        width={48}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${Number(value).toFixed(1)} kg`,
                          "体重",
                        ]}
                        labelFormatter={(label) => `日期 ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="weightKg"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.18)"
                        strokeWidth={3}
                        name="weightKg"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    添加第一条记录后显示趋势图
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>记录明细</CardTitle>
              <CardDescription>移动端按卡片展示，桌面端保持紧凑列表。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentEntries.length > 0 ? (
                  recentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid gap-3 rounded-md border p-3 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-center"
                    >
                      <div className="text-sm font-medium">{entry.measuredAt}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold">{entry.weightKg.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">kg</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.note || "无备注"}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="删除记录"
                        onClick={() => removeEntry(entry.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    暂无记录
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-2 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-semibold sm:text-lg">{value}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-2 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
