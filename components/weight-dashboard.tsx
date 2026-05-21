"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  Download,
  Dumbbell,
  FileUp,
  LineChartIcon,
  Loader2,
  LogOut,
  Plus,
  Scale,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
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
import { SheepMark } from "@/components/sheep-mark";
import { AiChatWidget } from "@/components/ai-chat-widget";
import { useToast } from "@/components/toast";
import { InfoPopover } from "@/components/info-popover";
import { cn } from "@/lib/utils";
import type { WeightEntry } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";
import type { WeightStats } from "@/lib/weight";
import { maxWeightKg, minWeightKg } from "@/lib/weight-validation";

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

const offlineQueueKey = "weight.offlineQueue";

function displayNumber(value: number | null, suffix = "") {
  return value === null ? "--" : `${value.toFixed(1)}${suffix}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

type OfflineEntry = {
  measuredAt: string;
  weightKg: string;
  note: string;
};

function readOfflineQueue(): OfflineEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(offlineQueueKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(entries: OfflineEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(offlineQueueKey, JSON.stringify(entries));
  } catch {
    // 忽略存储配额或隐私模式异常
  }
}

function saveOfflineEntry(entry: OfflineEntry) {
  writeOfflineQueue([...readOfflineQueue(), entry]);
}

export function WeightDashboard({ entries, stats, user, error }: Props) {
  const [data, setData] = useState<DashboardData>({
    entries,
    stats: stats ?? emptyStats,
  });
  const [profile, setProfile] = useState(user);
  const [profileForm, setProfileForm] = useState({
    heightCm: user.heightCm?.toString() ?? "",
    targetWeightKg: user.targetWeightKg?.toString() ?? "",
    password: "",
  });
  const [form, setForm] = useState({
    measuredAt: today(),
    weightKg: "",
    note: "",
  });
  const [naturalText, setNaturalText] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const weightInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error, toast]);

  function focusWeightInput() {
    weightInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    weightInputRef.current?.focus();
  }

  const chartData = useMemo(
    () => addMovingAverage(data.entries),
    [data.entries],
  );

  const yAxis = useMemo(() => {
    const values = chartData
      .flatMap((point) => [point.weightKg, point.movingAverage7])
      .filter((value): value is number => Number.isFinite(value));
    if (values.length === 0) {
      return { domain: [0, 1] as [number, number], ticks: [0, 1] };
    }
    const min = Math.floor(Math.min(...values) - 1);
    const max = Math.ceil(Math.max(...values) + 1);
    const step = Math.max(1, Math.ceil((max - min) / 6));
    const ticks: number[] = [];
    for (let tick = min; tick <= max; tick += step) {
      ticks.push(tick);
    }
    if (ticks[ticks.length - 1] !== max) {
      ticks.push(max);
    }
    return { domain: [min, max] as [number, number], ticks };
  }, [chartData]);

  const recentEntries = [...data.entries].reverse();
  const bmi = calculateBmi(data.stats.latest, profile.heightCm);
  const targetDelta = calculateTargetDelta(data.stats.latest, profile.targetWeightKg);

  useEffect(() => {
    flushOfflineQueue();
    window.addEventListener("online", flushOfflineQueue);
    return () => window.removeEventListener("online", flushOfflineQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshFromResponse(response: Response) {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message ?? "请求失败");
    }
    setData({ entries: payload.entries, stats: payload.stats });
  }

  async function submitWeightPayload(
    payload: typeof form & { confirmAbnormal?: boolean },
  ) {
    const response = await fetch("/api/weights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 409) {
      const warningPayload = await response.json();
      const confirmed = window.confirm(
        `${warningPayload.message ?? "本次体重波动较大。"}\n\n确认输入无误吗？`,
      );
      if (!confirmed) {
        throw new Error("已取消保存，请检查体重数值。");
      }

      return submitWeightPayload({ ...payload, confirmAbnormal: true });
    }

    await refreshFromResponse(response);
  }

  function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const payload = { ...form };
      if (!navigator.onLine) {
        saveOfflineEntry(payload);
        toast.info("网络不可用，已离线保存。恢复在线后会自动同步。");
        setForm((current) => ({
          measuredAt: current.measuredAt,
          weightKg: "",
          note: "",
        }));
        return;
      }

      try {
        await submitWeightPayload(payload);
        setForm((current) => ({
          measuredAt: current.measuredAt,
          weightKg: "",
          note: "",
        }));
        toast.success("已保存记录。");
      } catch (err) {
        if (!navigator.onLine) {
          saveOfflineEntry(payload);
          toast.info("网络中断，已离线保存。恢复在线后会自动同步。");
          return;
        }
        toast.error(err instanceof Error ? err.message : "保存失败");
      }
    });
  }

  function submitNaturalEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        const response = await fetch("/api/weights/natural", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: naturalText }),
        });
        if (response.status === 409) {
          const warningPayload = await response.json();
          const confirmed = window.confirm(
            `${warningPayload.message ?? "本次体重波动较大。"}\n\n确认输入无误吗？`,
          );
          if (!confirmed) {
            throw new Error("已取消保存，请检查输入内容。");
          }
          const confirmedResponse = await fetch("/api/weights/natural", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: naturalText, confirmAbnormal: true }),
          });
          await refreshFromResponse(confirmedResponse);
          setNaturalText("");
          toast.success("已记录。");
          return;
        }
        await refreshFromResponse(response);
        setNaturalText("");
        toast.success("已记录。");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "口语录入失败");
      }
    });
  }

  function flushOfflineQueue() {
    const queuedEntries = readOfflineQueue();
    if (queuedEntries.length === 0 || !navigator.onLine) {
      return;
    }

    startTransition(async () => {
      const remaining = [...queuedEntries];
      const synced: typeof queuedEntries = [];

      for (const entry of queuedEntries) {
        try {
          const response = await fetch("/api/weights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
          });

          if (response.status === 409) {
            break;
          }

          await refreshFromResponse(response);
          synced.push(entry);
          remaining.shift();
        } catch {
          break;
        }
      }

      writeOfflineQueue(remaining);
      if (synced.length > 0) {
        toast.success(`已自动同步 ${synced.length} 条离线记录。`);
      }
      if (remaining.length > 0) {
        toast.info("仍有离线记录未同步，请检查网络或异常体重提醒。");
      }
    });
  }

  function removeEntry(id: number) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/weights?id=${id}`, {
          method: "DELETE",
        });
        await refreshFromResponse(response);
        toast.success("已删除记录。");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      }
    });
  }

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.reload();
    });
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        const response = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileForm),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "资料保存失败");
        }
        setProfile(payload.user);
        setProfileForm((current) => ({ ...current, password: "" }));
        toast.success("资料已保存。");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "资料保存失败");
      }
    });
  }

  function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/weights/import", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "CSV 导入失败");
        }
        setData({ entries: payload.entries, stats: payload.stats });
        toast.success(`已导入 ${payload.imported} 条记录。`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "CSV 导入失败");
      }
    });
  }

  function generateAiReport(days: 7 | 30) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "AI 复盘生成失败");
        }
        setAiReport(payload.report);
        toast.success("AI 复盘已生成。");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI 复盘生成失败");
      }
    });
  }

  return (
    <main className="min-h-screen pb-10">
      <section className="border-b bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <SheepMark className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  体重记录
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  记录每日体重，查看趋势、波动区间和近期变化。
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 sm:min-w-[320px]">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </span>
                <span className="truncate font-medium">{profile.account}</span>
                {profile.heightCm ? (
                  <span className="shrink-0 text-muted-foreground">
                    {profile.heightCm.toFixed(1)}cm
                  </span>
                ) : null}
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
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCell icon={Scale} label="当前体重" value={displayNumber(data.stats.latest, " kg")} accent />
            <MetricCell icon={Target} label="目标差" value={displayTargetDelta(targetDelta)} />
            <MetricCell
              icon={Activity}
              label="BMI"
              value={displayBmi(bmi)}
              info={<BmiInfo bmi={bmi} />}
            />
            <MetricCell icon={CalendarDays} label="记录数" value={`${data.stats.count}`} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="border-primary/30 ring-1 ring-primary/10 card-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </span>
                新增记录
              </CardTitle>
              <CardDescription>
                同一天重复提交会更新原记录。建议每天早晨空腹测量并记录。
              </CardDescription>
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
                  ref={weightInputRef}
                  inputMode="decimal"
                  placeholder="72.4"
                  type="number"
                  min={minWeightKg}
                  max={maxWeightKg}
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
                <Button className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  保存记录
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="card-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                口语录入
              </CardTitle>
              <CardDescription>
                直接输入一句话，AI 会识别日期、体重和备注。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitNaturalEntry}>
                <Textarea
                  value={naturalText}
                  onChange={(event) => setNaturalText(event.target.value)}
                  placeholder="例如：今天早上 72.4，跑步后测的"
                  required
                />
                <Button className="w-full" disabled={isPending || !naturalText.trim()}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  识别并保存
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

        <div className="space-y-5">
          {data.entries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                <SheepMark className="h-16 w-16 text-primary" />
                <div className="space-y-1">
                  <p className="text-lg font-semibold">万物皆有起始</p>
                  <p className="text-sm text-muted-foreground">
                    记录下你今天的第一笔数据吧，小羊会陪你一起看趋势。
                  </p>
                </div>
                <Button type="button" onClick={focusWeightInput}>
                  <Plus className="h-4 w-4" />
                  记录第一笔
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="card-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                目标进度
              </CardTitle>
              <CardDescription>
                设置目标体重后，这里会显示当前体重与目标之间的差距。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">距离目标</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {displayTargetDelta(targetDelta)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>当前 {displayNumber(data.stats.latest, " kg")}</div>
                    <div>目标 {displayNumber(profile.targetWeightKg, " kg")}</div>
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all"
                    style={{ width: `${targetProgressPercent(data.stats.latest, profile.targetWeightKg)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                趋势图
              </CardTitle>
              <CardDescription>浅色面积显示每日体重，深色线条显示 7 天移动平均趋势。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] sm:h-[360px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: 4, right: 10, top: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        domain={yAxis.domain}
                        ticks={yAxis.ticks}
                        allowDecimals={false}
                        width={40}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          `${Number(value).toFixed(1)} kg`,
                          name === "movingAverage7" ? "7天均线" : "体重",
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
                      <Line
                        type="monotone"
                        dataKey="movingAverage7"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        name="movingAverage7"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed text-sm text-muted-foreground">
                    <SheepMark />
                    <span>添加第一条记录后显示趋势图</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                记录明细
              </CardTitle>
              <CardDescription>移动端按卡片展示，桌面端保持紧凑列表。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentEntries.length > 0 ? (
                  recentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-center"
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
                  <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <SheepMark />
                    <span>暂无记录</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-expanded={settingsOpen}
          className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            设置与数据
            <span className="font-normal text-muted-foreground">用户资料 · CSV 导入导出 · AI 复盘</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {settingsOpen ? (
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            <Card className="card-elevate">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  用户资料
                </CardTitle>
                <CardDescription>修改身高、目标体重或登录密码。</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitProfile}>
                  <div className="grid gap-2">
                    <Label htmlFor="profileHeightCm">身高 cm</Label>
                    <Input
                      id="profileHeightCm"
                      inputMode="decimal"
                      type="number"
                      min="50"
                      max="260"
                      step="0.1"
                      placeholder="例如 175"
                      value={profileForm.heightCm}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          heightCm: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profileTargetWeightKg">目标体重 kg</Label>
                    <Input
                      id="profileTargetWeightKg"
                      inputMode="decimal"
                      type="number"
                      min="1"
                      max="500"
                      step="0.1"
                      placeholder="例如 68"
                      value={profileForm.targetWeightKg}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          targetWeightKg: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profilePassword">新密码</Label>
                    <Input
                      id="profilePassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="不修改可留空"
                      value={profileForm.password}
                      onChange={(event) =>
                        setProfileForm({ ...profileForm, password: event.target.value })
                      }
                    />
                  </div>
                  <Button className="w-full" disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                    保存资料
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="card-elevate">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  数据主权
                </CardTitle>
                <CardDescription>导出或导入标准 CSV，数据随时握在自己手里。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  date,weight_kg,note
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <a href="/api/weights/export">
                      <Download className="h-4 w-4" />
                      导出 CSV
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <label htmlFor="csvImport" className="cursor-pointer">
                      <FileUp className="h-4 w-4" />
                      导入 CSV
                    </label>
                  </Button>
                  <input
                    id="csvImport"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={importCsv}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevate">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  AI 复盘
                </CardTitle>
                <CardDescription>
                  基于近期体重和备注生成周报或月报。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => generateAiReport(7)}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    生成周报
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => generateAiReport(30)}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    生成月报
                  </Button>
                </div>
                {aiReport ? (
                  <div className="whitespace-pre-wrap rounded-md border bg-muted px-3 py-3 text-sm leading-6">
                    {aiReport}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    生成后会在这里显示趋势总结、备注解释和下一步建议。
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <AiChatWidget />
    </main>
  );
}

function calculateBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) {
    return null;
  }

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

function displayBmi(value: number | null) {
  return value === null ? "--" : value.toFixed(1);
}

function calculateTargetDelta(weightKg: number | null, targetWeightKg: number | null) {
  if (!weightKg || !targetWeightKg) {
    return null;
  }

  return Number((weightKg - targetWeightKg).toFixed(1));
}

function displayTargetDelta(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (Math.abs(value) < 0.05) {
    return "已达成";
  }

  return value > 0 ? `还差 ${value.toFixed(1)} kg` : `低于目标 ${Math.abs(value).toFixed(1)} kg`;
}

function targetProgressPercent(weightKg: number | null, targetWeightKg: number | null) {
  if (!weightKg || !targetWeightKg) {
    return 0;
  }

  const delta = Math.abs(weightKg - targetWeightKg);
  const range = Math.max(targetWeightKg * 0.15, 5);
  return Math.max(5, Math.min(100, 100 - (delta / range) * 100));
}

function addMovingAverage(entries: WeightEntry[]) {
  return entries.map((entry, index) => {
    const start = Math.max(0, index - 6);
    const windowEntries = entries.slice(start, index + 1);
    const sum = windowEntries.reduce((total, item) => total + item.weightKg, 0);

    return {
      ...entry,
      dateLabel: format(parseISO(entry.measuredAt), "MM/dd"),
      movingAverage7: Number((sum / windowEntries.length).toFixed(2)),
    };
  });
}

function MetricCell({
  icon: Icon,
  label,
  value,
  accent = false,
  info,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  info?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 transition-colors ${
        accent ? "border-primary/30 bg-primary/5" : "bg-background"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : ""}`} />
        {label}
        {info ? <InfoPopover srLabel={`${label} 说明`}>{info}</InfoPopover> : null}
      </div>
      <div className="mt-1.5 truncate text-lg font-semibold sm:text-xl">{value}</div>
    </div>
  );
}

const bmiCategories = [
  { key: "underweight", label: "偏瘦", range: "< 18.5", max: 18.5 },
  { key: "normal", label: "正常", range: "18.5 – 23.9", max: 24 },
  { key: "overweight", label: "超重", range: "24.0 – 27.9", max: 28 },
  { key: "obese", label: "肥胖", range: "≥ 28.0", max: Infinity },
] as const;

function bmiCategoryKey(bmi: number | null) {
  if (bmi === null) return null;
  return bmiCategories.find((category) => bmi < category.max)?.key ?? "obese";
}

function BmiInfo({ bmi }: { bmi: number | null }) {
  const current = bmiCategoryKey(bmi);
  return (
    <div className="space-y-2">
      <p className="font-medium">BMI（身体质量指数）</p>
      <p className="text-muted-foreground">
        体重(kg) ÷ 身高(m)²，用于粗略评估胖瘦。
      </p>
      <ul className="space-y-0.5">
        {bmiCategories.map((category) => (
          <li
            key={category.key}
            className={cn(
              "flex items-center justify-between rounded px-1.5 py-0.5",
              category.key === current && "bg-primary/10 font-medium text-primary",
            )}
          >
            <span>{category.label}</span>
            <span className="tabular-nums text-muted-foreground">{category.range}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        参考中国成人标准，孕期、运动员等情况不适用。
      </p>
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
    <Card className="card-elevate">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4 text-primary/70" />
          {label}
        </div>
        <div className="mt-2 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
