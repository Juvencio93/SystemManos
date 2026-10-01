# Companion Connect

Full-stack application built with TanStack Start and Supabase.

## Development workflow

Lovable remains an optional visual editor for this repository. Changes created in
Lovable are committed to GitHub, but production hosting and secrets are managed
independently.

- Source of truth: GitHub
- Visual editing: Lovable
- Preview and production hosting: Vercel
- Database and authentication: Supabase
- Secrets: Vercel Environment Variables

This separation means the application can continue running and being deployed
without depending on Lovable. Removing Lovable later does not require an
application rewrite.

## Local development

Requirements: Node.js 22 and npm.

```sh
git clone <repository-url>
cd simple-launch-pad
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
selects Nitro's Vercel preset. Lovable sandbox builds continue using the Lovable
configuration, so both workflows remain compatible.

Only variables prefixed with `VITE_` may be exposed to browser code. Administrative
Supabase keys, payment keys, AI keys, and internal secrets must remain unprefixed.

## MikroTik Hotspot server variables

The personalized RB installer requires these server-only variables:

- `HOTSPOT_CREDENTIAL_SECRET`: at least 32 random characters; signs download links and derives a distinct heartbeat token for each router.
- `MIKROTIK_RADIUS_HOST`: the RADIUS server host/IP reachable by the RBs.
- `MIKROTIK_RADIUS_SECRET`: the shared secret configured for the MikroTik NAS clients on the FreeRADIUS host.
- `RADIUS_API_TOKEN`: authenticates the FreeRADIUS-to-Manos Tech HTTP lookup. Never put it on a router.
- `HOTSPOT_LEGACY_HEARTBEAT_TOKEN`: temporary compatibility credential for RBs that still run the old heartbeat file. Remove it after every RB has imported a newly generated heartbeat file.

The former RADIUS secret was embedded in an older activation template. Rotate it
on the FreeRADIUS server and in Vercel before using a new personalized activation
file. During heartbeat migration, set the legacy token to the old installed
heartbeat value, replace each RB's heartbeat with the newly generated file, then
remove the legacy token and rotate `RADIUS_API_TOKEN` independently on both
FreeRADIUS and Vercel. Keep all of these values out of Git and browser code.

The base RB layout keeps `ether1` and `ether5` as a transparent provider bridge,
uses `ether2`/`ether3` for the HotSpot network `192.168.88.0/24`, and assigns
`ether4` to the free/staff network `192.168.89.0/24`. Blocking applies to the
two routed RB networks and deliberately does not filter bridged `ether5` traffic.
Heartbeat TX/RX are cumulative `bytes-in`/`bytes-out` from currently active
HotSpot sessions, not WAN port throughput or a byte delta per 30-second poll.
Router reboot and firewall changes are shown as pending until a later heartbeat
confirms the RouterOS state.

## Running on another Node.js host

The project also retains portable Nitro output:

```sh
npm ci
npm run build
npm start
```

This provides an exit path from both Vercel and Lovable if hosting requirements
change later.
