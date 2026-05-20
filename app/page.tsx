import { WeightDashboard } from "@/components/weight-dashboard";
import { getWeightStats, listWeightEntries } from "@/lib/weight";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const entries = await listWeightEntries();

    return <WeightDashboard entries={entries} stats={getWeightStats(entries)} />;
  } catch (error) {
    console.error(error);
    return (
      <WeightDashboard
        entries={[]}
        stats={getWeightStats([])}
        error="数据库暂不可用。请确认已创建名为 weight 的 PostgreSQL 数据库，并配置 PGHOST 与 PG_PASSWORD。"
      />
    );
  }
}
