# Weight

一个基于 Next.js、shadcn/ui 风格组件和 PostgreSQL 的体重记录可视化网站，内置账号密码登录注册，按用户隔离体重数据。

## 本地运行

```bash
npm install
npm run dev
```

访问 http://127.0.0.1:3000。

## 数据库环境变量

项目默认连接数据库名 `weight`，会自动创建 `users`、`user_sessions`、`weight_entries` 数据表，但数据库本身需要先存在。

```bash
PGHOST=your-postgres-host
PG_PASSWORD=your-postgres-password
PGDATABASE=weight
PGUSER=postgres
PGPORT=5432
```

如果部署到 Vercel 并使用需要 SSL 的 PostgreSQL 服务，添加：

```bash
PGSSLMODE=require
```

## 部署到 Vercel

1. 将代码推送到 GitHub。
2. 在 Vercel 导入仓库。
3. 在 Vercel Project Settings 的 Environment Variables 中配置 `PGHOST`、`PG_PASSWORD`，以及需要时的 `PGUSER`、`PGDATABASE`、`PGPORT`、`PGSSLMODE`。
4. 使用默认构建命令 `npm run build`。
