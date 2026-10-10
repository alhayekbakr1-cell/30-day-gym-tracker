# Publish Gym Tracker through GitHub

The four-day tracker changes are published to the repository on a pull request branch. The existing production host is the ChatGPT Sites URL below. GitHub Actions currently verifies the source; there is no GitHub deployment workflow, and these changes have not been published to the live host.

## What GitHub can host

GitHub can store the source and run automated verification and deployment workflows. GitHub Pages serves static files. The existing ChatGPT Sites host runs the Cloudflare Worker, supplies the D1 binding, and provides authenticated identity through its trusted proxy. Uploading this source to Pages will not provide that server, database, or sign-in service.

The closest alternative hosting architecture is a GitHub repository connected to Cloudflare Workers and D1. That migration also requires replacing the Sites sign-in integration with a trusted authentication provider and provisioning a real production database. It is not implemented by this package. The repository does not have access to the existing Sites publishing controls.

## Put the source in a repository

Use a private repository unless you intend to publish the source publicly. Place the contents of the `gym-tracker` folder at the repository root, including the dot-prefixed configuration folders. Do not upload the ZIP as a single repository file: GitHub Actions needs the extracted files.

For an existing repository, clone it and apply these changes on a branch after comparing with the current contents. Preserve its history and any newer changes. Do not replace a repository you have not inspected.

For a new repository, the following commands can be run from the extracted folder on a computer with Git and GitHub CLI installed and signed in. Use an unused repository name if `gym-tracker` already exists:

```bash
git init -b main
git add .
git commit -m "Add four-day gym tracker and verification workflow"
gh repo create gym-tracker --private --source=. --remote=origin --push
```

The supplied `.gitignore` excludes dependency installations, generated output, local runtime state, and environment files. The source archive contains no live workout database or browser-local records.

## Automated verification

`.github/workflows/ci.yml` runs on pushes to `main`, pull requests, and manual dispatch. It uses Node.js 24 and the supplied lockfile, then runs TypeScript, ESLint, the regression suite, the production build, artifact validation, and Worker HTML checks. It has read-only repository permissions and needs no hosting credentials.

The workflow runs TypeScript, lint, regression tests, the production build, artifact validation, and a Worker HTML smoke check. Require its latest run to pass before publishing a production release. Then verify authenticated sign-in and workout persistence on the live host; public unauthenticated probes cannot establish that D1 reads and writes work.

## Requirements before deploying to another host

1. Export your progress as JSON from the current live tracker. The source archive does not migrate D1 records. The app on a different domain also has separate browser storage. Preserve the old site until import and synchronization are verified.
2. Select a host and account for the server. For Cloudflare, provision a Worker and D1 database, apply the checked-in SQL migrations, and replace the development-only placeholder binding with the real database binding. `.openai/hosting.json` identifies the original Sites project; it does not grant access to its hosted resources.
3. Replace `app/chatgpt-auth.ts` and its Sites-specific sign-in/sign-out links with server-verified identity for the chosen host. Never accept arbitrary client-supplied `oai-authenticated-user-email` headers as identity on an independently deployed Worker.
4. Add a deployment workflow for the selected host only after that integration is complete. Cloudflare supports GitHub Actions using repository or environment secrets named `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Store credentials in GitHub settings, never in source files or chat.
5. Run the checks, deploy the client and server together, verify sign-in and cross-device saving, then import the exported JSON through the app's validation and restoration flow. Existing schema-5 backups remain supported. Never send a schema-6 plan to a server that still runs the older validator.

After schema-6 four-day records have been saved, do not roll back to a server that only accepts the older schema. See `docs/four-day-upgrade.md` for the transition and rollback details.

## Official references

- [GitHub Pages capabilities](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Deploy Cloudflare Workers with GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [GitHub checkout action](https://github.com/actions/checkout)
- [GitHub setup-node action](https://github.com/actions/setup-node)
