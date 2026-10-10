# Moving Gym Tracker to another host

This archive contains the complete tracked source and assets from deployed version 9.
Source commit: 2f1aa602c1d55b9aa4d99bc1cf5ba27340fc6b67

## Contents
React/TypeScript application, exercise images and icons, database schema and SQL migrations, package-lock.json, build configuration, and original README.
No Git credentials, node_modules, live database records, or browser-local workout records are included.

## Runtime and migration requirements
- Node.js >=22.13.0. See README.md and package.json for development commands.
- Current runtime: Vinext/Vite on Cloudflare Workers; this is not a static HTML-only site.
- Cloudflare D1 binding DB is used by db/index.ts and lib/progress-store.ts. Create a new database, apply the SQL migrations under drizzle/, and configure its real binding and database ID. The Vite configuration currently uses a placeholder database ID.
- ChatGPT Sites supplies the authenticated user headers and sign-in/sign-out endpoints used by app/chatgpt-auth.ts. Another host needs a replacement authentication integration. Do not trust client-supplied identity headers directly.
- Review vite.config.ts, build/sites-vite-plugin.ts, worker/index.ts, .openai/hosting.json, and scripts/ for hosting-specific configuration. The original project ID is retained only as source metadata; a new host needs its own configuration.
- Other runtimes (for example conventional Next.js hosting) require adapting the Cloudflare imports, database access, and build setup.
- The current build script uses Bash and GNU timeout; Windows needs WSL or an adjusted script.

## Keep your workout data
Before moving, use the current app's JSON/CSV export controls to download your progress. This source ZIP does not transfer the live D1 database or browser storage. A new domain also has separate browser-local storage.

This is a source export, not a deployment tested on a different host.
