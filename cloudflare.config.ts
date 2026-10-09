import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// Account: set CLOUDFLARE_ACCOUNT_ID, or log in with `cf auth login`.
export default defineConfig({
	worker: {
		name: "pet-translator",
		compatibilityDate: "2026-10-01",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint,
		observability: { enabled: true },
		// The frontend (index.html + web/) is built by Vite and served as static assets.
		// Only /api/* hits the Worker first.
		assets: { runWorkerFirst: ["/api/*"] },
		env: {
			// Workers AI has no local simulator, so always proxy to the real model in dev.
			AI: bindings.ai({ dev: { remote: true } }),
			ASSETS: bindings.assets(),
			// Per-IP rate limit so a viral spike doesn't drain the account.
			RATE_LIMITER: bindings.rateLimit({
				namespace: "4201",
				simple: { limit: 10, period: 60 },
			}),
		},
	},
});
