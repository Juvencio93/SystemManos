# Companion Connect

Full-stack application built with TanStack Start and Supabase.

## Development workflow

- Source of truth: GitHub
- Preview and production hosting: Vercel
- Database and authentication: Supabase
- Secrets: Vercel Environment Variables

## Local development

Requirements: Node.js 22 and npm.

```sh
git clone <repository-url>
cd SystemManos
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and fill in local values. Never commit
`.env`, `.env.local`, service keys, API keys, or webhook secrets.

## Quality checks

```sh
npm run typecheck
npm run lint
npm run build
```

Run all checks with:

```sh
npm run check
```

## Deploying to Vercel

1. Import this GitHub repository into Vercel.
2. Keep the detected build command as `npm run build`.
3. Add the variables listed in `.env.example` under Project Settings →
   Environment Variables.
4. Configure sensitive server values for Preview and Production separately.
5. Deploy the pull-request branch as a Preview before merging to `main`.

Vercel sets `VERCEL=1` during builds. The Vite configuration detects it and
selects Nitro's Vercel preset.

Only variables prefixed with `VITE_` may be exposed to browser code. Administrative
Supabase keys, payment keys, AI keys, and internal secrets must remain unprefixed.

## Running on another Node.js host

The project also retains portable Nitro output:

```sh
npm ci
npm run build
npm start
```
