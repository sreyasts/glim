# Scope and roadmap

## Implemented in 0.1

Globe and accessible directory; original source links; authorized public-domain snapshots; saved places; direct share links; local times; location weather; durable condition rules; private per-session inbox; optional Web Push; deletion; CI; deployable single-instance server.

## Next: earn the “global” promise

- Secure written embed agreements and supported APIs from tourism operators, wildlife broadcasters, and transportation authorities.
- Keep a source register including operator, terms, attribution, image timestamp availability, update frequency, health history, and removal contact.
- Add HLS/YouTube players only when the operator supports embedding. Handle offline and recorded-highlight states explicitly.
- Add provider-reported capture timestamps and content-change checks. Never label image retrieval time as capture time.
- Add first-party account recovery, explicit retention controls, and cross-device favorites if users request them.
- Measure activation and return behavior with an opt-in, first-party measurement design before investing in paid acquisition.

## Then: environmental visual alerts

Supported, bounded questions could include “is the mountain visible?”, “has snow covered this view?”, or “is this beach view unusually rough?” Do not start with arbitrary natural-language surveillance rules.

Before shipping a detector:

1. Obtain rights for automated processing and any required frame retention, not merely human viewing.
2. Run only against an allowlisted operator integration. Never accept arbitrary remote image URLs into a fetch worker.
3. Define the event, baseline, minimum duration, confidence threshold, cooldown, and failure behavior.
4. Evaluate on labeled examples from that camera in daylight, darkness, bad weather, overlays, frozen frames, and camera movement.
5. Show the supporting event evidence and uncertainty to users; let them rate usefulness.
6. Establish the per-camera processing cost and a sustainable budget. Sampling one image per minute on 1,000 cameras means 1.44 million evaluations per day before retries.

The current weather-rule model is not a substitute for that work. “Rain at this location” cannot establish that rain is visible in a camera frame.

## Explicit non-goals

Private-device discovery; credential collection; access-control bypass; facial recognition; person identity or cross-camera tracking; license-plate lookup; private-home cameras; law-enforcement identification; emergency dispatch; guaranteed safety-critical alerts.
