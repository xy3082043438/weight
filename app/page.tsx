import { WeightDashboard } from "@/components/weight-dashboard";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { getWeightStats, listWeightEntries } from "@/lib/weight";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return <AuthForm />;
    }

    const entries = await listWeightEntries(user.id);

    return (
      <WeightDashboard
        entries={entries}
        stats={getWeightStats(entries)}
        user={user}
      />
    );
  } catch (error) {
    console.error(error);
    return <AuthForm error="数据库暂不可用。请确认已创建名为 weight 的 PostgreSQL 数据库，并配置 PGHOST 与 PG_PASSWORD。" />;
  }
}
