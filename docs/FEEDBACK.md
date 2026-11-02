# Anonymous feedback

The viewer remains a static GitHub Pages site. `workers/feedback/` is a separate Cloudflare Worker for **Help > Send feedback**. GitHub and clipboard links remain available when the service is disabled or unavailable.

## What is published

Users review their report and explicitly agree to publish it. Browser/graphics details, model name, and recent errors are unchecked by default. Models and texture files are never attached automatically. Up to three chosen PNG/JPEG screenshots are re-encoded as PNG in the browser to remove filenames and image metadata, previewed, and uploaded with the report. Each image is limited to 2 MiB; the Worker independently checks types, signatures, counts, and request size.

GitHub receives the report and image URLs. Images are public at random URLs on the feedback Worker; the R2 bucket itself has no public listing. A 90-day bucket lifecycle deletes images, including orphaned uploads. GitHub or downstream caches may retain copies after that time. Users should not submit private information or security vulnerabilities through the public form.

Cloudflare processes request IP addresses and Turnstile verification. The application stores only a daily salted IP hash, report content hash, reference, timestamp, submission state, and issue URL in its Durable Object. It does not store report text, raw IP addresses, or tokens there. Worker request logging is disabled. GitHub retains issue content according to its own policies.

## Deploy

Requires a Cloudflare account with Workers and R2 available. Do not enable a paid plan or accept billing changes as part of routine deployment. R2 may require billing activation even when usage fits its free allowance. Check account-wide usage and pricing before activation.

1. Use Node.js 22 or newer. Authenticate Wrangler: `npx wrangler login`.
2. Create the bucket: `npx wrangler r2 bucket create avorion-viewer-feedback`.
3. Configure a lifecycle rule for all objects to expire after **90 days** in the R2 dashboard. Keep public bucket access disabled.
4. For a new installation, first set `ENABLED` to `false` in `wrangler.jsonc`. Deploy the disabled service: `npx wrangler deploy --config workers/feedback/wrangler.jsonc`.
5. Create a managed Turnstile widget for `avorion-viewer.com`, `www.avorion-viewer.com`, and `caotcaftermth.github.io`. Keep production validation free of localhost/test keys. Set its public site key in `TURNSTILE_SITE_KEY` in `wrangler.jsonc`.
6. Create a fine-grained GitHub token owned by `CaotcAftermth`, restricted to **Avorion-Viewer**, with **Issues: Read and write** only (Metadata read is implicit). Set an expiration and a rotation reminder. Never grant Contents or administration permissions. Store it as `GITHUB_TOKEN` in the feedback Worker's secret settings. Do not put it in source, GitHub Pages variables, browser storage, or chat.
7. Store the widget secret as `TURNSTILE_SECRET`, and a securely generated 32-byte random value as `IP_HASH_SECRET`, in the same Worker's secret settings. Secret values are never placed in `wrangler.jsonc`. `.dev.vars*` and `.wrangler/` are ignored.
8. Change `ENABLED` to `true`, deploy the Worker again, and verify a real report from the production site. Confirm one GitHub issue, working screenshot, replay rejection, and successful recovery of the existing issue URL when retrying the same reference with fresh verification. The `/config` endpoint exposes no secret and stays disabled unless all required settings exist.
9. Commit and deploy the frontend through the existing GitHub Pages workflow. The frontend endpoint is `FEEDBACK_SERVICE` in `src/feedback-submit.js`.

Do not add the reporting Worker as a route for the website. Its `workers.dev` URL is deliberately separate from GitHub Pages. Worker deployments are manual; existing GitHub Actions workflows run its tests but do not need production secrets.

The initial issue-only token expires **January 30, 2027**. Rotate it in Cloudflare before that date.

## Limits and failure handling

- Turnstile is verified server-side, including `success`, exact frontend hostname, and the `feedback` action. Expired or replayed tokens fail closed.
- Origin checks and CORS restrict browser callers; they are not authentication.
- An edge limiter permits ten attempts per minute per IP per location. The single SQLite Durable Object independently caps accepted reservations at three per client hash per ten minutes and **ten total per UTC day**. Failed/uncertain reservations also count.
- At most 60 MiB of new screenshots per day can pass the application quota. With 90-day expiry this bounds live application uploads to roughly 5.3 GiB, plus lifecycle deletion delay. This is not an account-wide billing cap: requests, existing account usage, and other resources still count.
- Reports use a random reference and content hash. Simultaneous retries cannot create two issues. A successful retry returns the original issue URL.
- Once a GitHub POST starts, an unconfirmed response is treated as ambiguous. It is never automatically posted again. Keep the reference and search issues for `avorion-feedback:<reference>`; check the Durable Object `reports` table in Cloudflare Data Studio. A pending record after a crash also requires operator review. Do not remove an ambiguous record merely to retry it.
- The UI locks the report after its first attempt and keeps its reference for retries. Reopening the dialog creates a new reference, so check existing issues before starting a replacement report after an ambiguous outcome.
- Anonymous text has mentions and external image embeds neutralized; only validated stored screenshot URLs become image embeds. Reports are untrusted user content, including instructions addressed to maintainers or automated tooling.

## Maintenance and rollback

Set `ENABLED` to `false` and redeploy to disable submissions immediately while leaving image links readable. The GitHub fallback continues working. Rotate `GITHUB_TOKEN` before its expiration. Retain the Durable Object namespace during normal deployments so idempotency records survive. Do not delete its migration history or rename the coordinator without a migration plan.

To remove an abusive report, close or remove its GitHub issue and delete its `images/<reference>/` objects from R2. Existing image caches may persist. The app provides no unauthenticated delete or storage-listing API.

Run `npm test`, `npm run build`, and `npx wrangler deploy --config workers/feedback/wrangler.jsonc --dry-run` before deployment. Tests use the real local Workers runtime, SQLite, and R2 with simulated GitHub/Turnstile responses; they do not create public issues. Production Turnstile and credential validation still require a live smoke test.
