# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI (via Replit AI Integrations) — chat, vision, image generation

## Applications

### PinAuto (`artifacts/pin-auto`)

A Pinterest pin asset generator tool. Users paste a product URL and the AI automatically:
- Scrapes product data (title, price, description, image) from the URL with a browser-like user agent
- Falls back to AI inference if scraping is blocked (anti-bot protection)
- Analyzes the product image with AI vision to generate a detailed technical description
- Generates a lifestyle image using gpt-image-1
- Creates a complete SEO pack: 3 Pinterest titles, pin description, alt text, urgency overlays, hashtags
- Saves everything to the database for history access

Frontend: React + Vite at `/` (preview path)
- Home page: URL input + feature badges + history list
- Results page: 4 sections (product, AI analysis, lifestyle image, SEO pack) with copy buttons

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── pin-auto/           # PinAuto React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── integrations-openai-ai-server/  # OpenAI server-side client
│   └── integrations-openai-ai-react/   # OpenAI React hooks
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/pin-auto` (`@workspace/pin-auto`)

React + Vite frontend. Uses React Query hooks from `@workspace/api-client-react` for API calls.

- Pages: `src/pages/Home.tsx`, `src/pages/Results.tsx`
- Components: `src/components/Header.tsx`, `src/components/CopyableText.tsx`
- Routing: wouter with base URL from `import.meta.env.BASE_URL`

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes:
  - `src/routes/health.ts` — `GET /api/healthz`
  - `src/routes/generate.ts` — `POST /api/generate` (scrape + AI + image + SEO)
  - `src/routes/history.ts` — `GET /api/history`, `GET /api/history/:id`
- Dependencies: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-openai-ai-server`, `axios`, `cheerio`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. 

- `src/schema/generations.ts` — generations table (id, url, product data, vision analysis, lifestyle image, seo pack, created_at)
- Run migration: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec at `openapi.yaml` with endpoints:
- `POST /generate`
- `GET /history`
- `GET /history/{id}`

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas: `GeneratePinAssetsBody`, `GeneratePinAssetsResponse`, `GetHistoryResponse`, `GetGenerationByIdResponse`

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks: `useGeneratePinAssets`, `useGetHistory`, `useGetGenerationById`

### `lib/integrations-openai-ai-server` (`@workspace/integrations-openai-ai-server`)

OpenAI server-side client using Replit AI Integrations (no API key needed from user).
- Uses `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` env vars

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`.
