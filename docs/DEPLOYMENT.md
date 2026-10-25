# Deployment and operations

## One persistent server

Run Node 24+ on one server with a persistent disk. Build with `npm ci && npm run build`, then run `npm start`. Put an HTTPS reverse proxy in front. Required production environment:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
APP_ORIGIN=https://your-domain.example
DATABASE_PATH=/app/data/glim.sqlite
POLL_INTERVAL_MS=300000
```

Set `APP_ORIGIN` to the exact public origin, without a path. The app denies cross-origin and missing-origin mutation requests. It requires secure cookies in production. Bind the Node port only to your reverse proxy or private network; do not expose it publicly alongside the HTTPS proxy.

## Docker

```sh
docker build -t glim .
docker volume create glim-data
docker run --name glim --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  --env-file .env.production \
  -v glim-data:/app/data glim
```

Create `.env.production` from the environment block above. It is gitignored. Terminate TLS at your proxy and forward to port 3001. A fresh named Docker volume inherits the directory's node-user ownership; host bind mounts must be writable by UID 1000.

## Optional browser push

Generate keys once: `npm run push:keys`. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and a real `VAPID_SUBJECT=mailto:you@your-domain`. Keep the private key secret and stable across deploys; changing it requires users to resubscribe. The UI explicitly reports when background push is unconfigured. It never silently claims notification delivery.

Chrome (FCM), Firefox (Mozilla), and Safari (Apple) push endpoints are allowlisted to prevent arbitrary-URL fetches. Other services need a reviewed allowlist change. Expired subscriptions are deleted after 404/410 responses. Other push failures keep the event in the inbox but are not retried; add a durable outbox if delivery reliability becomes a product requirement.

## Weather subscription

Local, non-commercial use defaults to `api.open-meteo.com`. Revenue-generating use needs appropriate commercial terms and `OPEN_METEO_API_KEY`; the app then uses `customer-api.open-meteo.com`. Requests are cached for five minutes and coalesced per place. A provider failure backs off for a minute and preserves rule state.

The seed directory is intentionally small. Extending it to thousands of watched places requires provider quota planning, batch requests, queueing, and cost accounting. Do not assume the free endpoint will support a commercial global network.

## State, reliability, and privacy

- One process owns the alert loop. **Do not run multiple replicas against the same database**: they can duplicate evaluations. A distributed scheduler and database locks are future work.
- Polling defaults to five minutes and cannot be configured below one minute. Conditions already present at first evaluation can generate an initial alert. Subsequent notifications require a condition transition and a one-hour cooldown.
- Active rules are capped at 25 per session and 5,000 total records to bound work. They are not a substitute for authentication and anti-abuse controls at substantial scale.
- The default rate limit is 120 requests/minute per socket IP. Proxy forwarding headers are not trusted. Behind one proxy this is an aggregate limit; configure a trusted-proxy policy and appropriate limits before a substantial launch. Never blindly trust arbitrary forwarded headers.
- Sessions expire 30 days after creation. Worker cleanup deletes expired sessions and cascades their data; it retains at most 30 days of alert history. The inbox returns the newest 50 events. User deletion removes all session data immediately.
- SQLite WAL persists sessions, favorites, rules, evaluation state, inbox events, and push subscriptions. Back up through SQLite's online backup facilities or stop the server before copying the database and its WAL files. Treat backups as private data and set retention limits.
- No image or video recording, analytics, advertising identifiers, geolocation, person tracking, or email collection is implemented.
- Existing rules resume on restart. Missed events during downtime are not reconstructed. Weather models, polar solar events, camera failures, and browser push restrictions limit reliability.

## Operational checks

`GET /api/health` checks process availability, not end-to-end camera freshness or alert delivery. Verify HTTPS, source-image rendering, creating and removing a rule, persistence after restart, and browser push on a real device before a public launch. Run source checks manually because providers may rate limit automation.

The included CI verifies tests, types, build, and high-severity production dependency advisories. It cannot prove third-party availability, embedding rights, or that notifications will reach every device.
