# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who want to explore intentionally public cameras geographically and see the camera's visual feed without leaving the app. The user has explicitly rejected the previous marketing-led presentation and the sixteen-location limit.

## Product Purpose

Open a world globe or map, choose a place, zoom to it, select an exact camera, and watch the available feed in the same interface. Preserve saved places and weather alerts.

## Operating Context

Desktop and mobile browsers. A camera atlas is the primary workspace. Users navigate spatially, search places, inspect camera coverage, and compare actual source formats and availability.

## Capabilities and Constraints

- React/TypeScript frontend and Fastify/SQLite backend already exist.
- Source access is limited to deliberate public broadcasts and authorized operator interfaces. Network reachability alone does not grant reuse rights.
- Official Caltrans and TfL catalogs are accessible without a user-provided key. Source availability and format vary.
- The user's Windy key is configured and verified locally in the ignored .env file. It remains server-side. Worldwide discovery depends on provider coverage and the key's actual plan limits.
- True live streams, short updated clips, snapshots, and external-only views must remain distinct.
- Arbitrary visual-event detection is not implemented; existing alerts use location weather.
- There is no evidence of complete worldwide coverage, guaranteed camera uptime, or real user growth.

## Brand Commitments

Keep the short name Glim and the existing public repository sreyasts/glim. Replace the previous ornamental layout, poetic camera names, and marketing copy. The user's confirmed interaction is place → zoom → camera → inline visuals.

## Evidence on Hand

Existing source and API tests; prior working public-domain images; current public operator catalog responses; verified TfL MP4 response; source permission references. A sampled Caltrans stream returned 404, so a catalog entry cannot imply confirmed playback.

## Product Principles

1. Make the map and camera feed the product.
2. Show actual coverage, format, and connection state.
3. Keep source credit and permissions attached to every view.
4. Make failure recoverable without inventing visuals.
