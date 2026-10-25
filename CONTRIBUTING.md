# Contributing

Use Node 24+, run `npm ci`, and run `npm run check` before submitting a focused pull request. Keep shared request validation in `shared/types.ts` and server-side ownership checks on all private data.

For cameras, start with the camera suggestion issue template. Provide the original operator page, approximate coordinates, IANA timezone, and the applicable rights policy. Only set `imageUrl` after confirming redistribution permission or a clear public-domain basis. Otherwise use a source link. Cite the operator visibly. Do not submit device IPs, credentials, private cameras, or feed URLs obtained by bypassing access controls.

For alert work, test stale data, repeated matches, state transitions, downtime, and owner isolation. Do not represent a location-weather signal as camera observation. New visual models need the evaluation and permission process in `docs/ROADMAP.md`.
