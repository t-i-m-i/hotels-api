# Setting up and deploy to Render

## on Render each of those is its own service, created separately (or all declared together in a `render.yaml` blueprint). Mapping:

| Piece            | Render service type                           | Notes                                                                                                                                            |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| NestJS backend   | **Web Service**                               | Build `bun run build`, start `node dist/main`. Needs `DATABASE_URL` + `REDIS_URL` env vars.                                                      |
| Next.js frontend | **Web Service**                               | (Only a **Static Site** if you're doing a full static export — with SSR/API routes it's a Web Service.)                                          |
| Postgres         | **Render Postgres** (managed database)        | Not a "web service" — its own first-class type. You already use **Neon**, so you can just keep Neon and skip this; point `DATABASE_URL` at Neon. |
| Redis            | **Key Value** (Render's managed Redis/Valkey) | Separate service, same as you guessed. Gives you an internal connection URL.                                                                     |

### Wiring

- **Redis connection**: Render Key Value exposes an *internal* URL (only reachable from services in the same region/account) and optionally an external one. Put the internal URL in the backend's `REDIS_URL`. Your `queue.module.ts` already reads `config.get('REDIS_URL')`, so nothing to change in code.
- **Same region**: put the backend Web Service, Key Value, and (if used) Render Postgres in the **same region**, otherwise internal networking / latency bites you.
- **Eviction policy matters for Bull**: set the Key Value instance's maxmemory policy to **`noeviction`**. Bull stores job state as Redis keys; an LRU eviction policy will silently drop jobs and corrupt queue state. Render lets you pick this in the instance settings.
- **Free tier caveats**: Render's free Key Value has no persistence and tiny memory, and free Web Services spin down when idle (cold starts, and a spun-down backend means no queue processing). Fine for a demo, but know that jobs in flight during a restart can be lost without persistence.

### Optional: separate worker

Right now `EmailQueueProcessor` runs *in-process* in the backend Web Service, so one service does both API and job processing. If you later want them scaled independently, Render has a **Background Worker** service type — you'd deploy the same repo with a start command that boots a Nest app context without the HTTP listener, and only that service registers the processor. Not needed for this project's size.

Here are the two files. `src/main.ts` already reads `process.env.PORT` (which Render sets automatically), so no port config is needed.

# IaC - intro

IaC = Infrastructure as Code. The practice of defining your servers, databases, networking, etc. in version-controlled text files instead of clicking around in a web console. Benefits: the setup is reproducible, reviewable in PRs, and diffable in git history. render.yaml is a lightweight example. Bigger/general-purpose tools in the same category: Terraform, Pulumi, AWS CloudFormation, Kubernetes manifests. Docker Compose is the same idea scoped to local containers.

### `hotels-api/render.yaml`

```yaml
services:
  - type: web
    name: hotels-api
    runtime: node
    region: frankfurt                     # pick one region, use it for every service
    plan: free
    branch: main
    buildCommand: bun install && bun run build
    preDeployCommand: bun run migrate:up  # apply pending SQL migrations before each deploy
    startCommand: node dist/main
    healthCheckPath: /api                 # Swagger UI returns 200; cheap liveness signal
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: BUN_VERSION
        value: "1.1.38"
      - key: DATABASE_URL
        sync: false                       # paste the Neon connection string in the dashboard (If you use Render Postgres instead of Neon, add a `databases:` block and reference it with `fromDatabase`.)
      - key: REDIS_URL
        fromService:
          type: keyvalue
          name: hotels-redis
          property: connectionString

  - type: keyvalue
    name: hotels-redis
    plan: free
    region: frankfurt
    maxmemoryPolicy: noeviction           # Bull requires this; LRU eviction corrupts queue state
    ipAllowList: []                       # internal-only, no public endpoint
```

### `hotels-web-next/render.yaml`

```yaml
services:
  - type: web
    name: hotels-web
    runtime: node
    region: frankfurt
    plan: free
    branch: main
    buildCommand: bun install && bun run build
    startCommand: bun run start
    healthCheckPath: /
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: BUN_VERSION
        value: "1.1.38"
      - key: NEXT_PUBLIC_API_URL
        value: https://hotels-api.onrender.com   # set to the api service's real URL after first deploy
```

### Notes

- **`fromService` only resolves inside the same Blueprint** — that's why `hotels-redis` sits in the api file. The web file can't `fromService`-reference `hotels-api` across repos, so `NEXT_PUBLIC_API_URL` is a plain hardcoded value. You'll know the real `onrender.com` hostname after the api's first deploy (or set a custom domain and use that from the start).
- **`NEXT_PUBLIC_*` is inlined at build time**, so it must exist during `buildCommand`. As a static `value` in `envVars` it does — good. If you ever make it `sync: false`, set it before the first build.
- **`preDeployCommand`** runs once per deploy after build, before traffic shifts — the right place for `migrate:up`. Remove it if you'd rather run migrations by hand.
- **Free plan reality**: both web services sleep after ~15 min idle (cold starts), and free Key Value has no persistence — a Redis restart drops any queued jobs. Fine for a demo; bump to paid plans if you need the queue to be durable.
- **`BUN_VERSION`** pins Bun (Render honors it); drop it to float, or bump both version pins as you like.
The trade-off is the usual pinned-vs-floating dependency choice:
- Pinned (BUN_VERSION: "1.1.38"): every build uses that exact version. Reproducible — a build that worked last month works identically today. Downside: you're stuck on it until you manually bump, missing fixes.
- Floating (no line): you automatically get newer Bun releases. Downside: a build can break with no change on your side, just because the platform's default moved.
For a demo, floating is fine. For anything you care about, pin it and bump deliberately.

### How Render Blueprints work

1. You commit `render.yaml` to the repo root.
2. In the Render dashboard: **New → Blueprint**, pick the repo. This is the one click you can't avoid — Render needs you to authorize the GitHub repo and confirm the initial plan/region/env-var values.
3. Render parses `render.yaml`, shows you a preview of every service it's about to create, prompts for any `sync: false` secrets (like your Neon `DATABASE_URL`), and on approval creates them all at once — Web Services, Key Value, Postgres, their linkage, everything.
4. After that first setup, it's automatic: on every push to the tracked branch, Render re-reads `render.yaml` and **applies the diff** — adds new services you've declared, updates changed settings, and deploys. You don't touch the GUI to add a service anymore; you edit the YAML and push.

Caveats:
- Deleting a service from `render.yaml` does **not** auto-delete it on Render (safety) — it just stops managing it. You remove it manually.
- Secrets (`sync: false`) are never in the file; Render asks for them at apply time and stores them.
- One Blueprint = one `render.yaml` = one connected repo. For your two-repo setup (hotels-api + hotels frontend) you'd either keep a `render.yaml` in each repo as separate Blueprints, or put one `render.yaml` in whichever repo and point each service's `repo:` field at the right GitHub URL.
- It's the same IaC idea as Fly's `fly.toml` or a Compose file — declarative, diffed on push.
