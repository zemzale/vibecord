# VibeCord MVP Foundation

VibeCord is a Discord-like chat MVP built with TypeScript, Bun, Vite, TanStack Start ecosystem packages, Tailwind CSS, and Convex.

## Quick start

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env.local
   ```

3. Add your Convex deployment URL to `.env.local`.

4. Start the app:

   ```bash
   bun run dev
   ```

## Validation commands

```bash
bun run typecheck
bun run test
bun run build
```

## Convex notes

- Frontend uses a `ConvexProvider` and `ConvexReactClient` initialized from `VITE_CONVEX_URL`.
- Initialize your Convex project/deployment as needed with Bun:

  ```bash
  bunx convex dev
  ```
