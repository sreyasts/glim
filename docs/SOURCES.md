# Camera and data register

The machine-readable register is [`shared/cameras.ts`](../shared/cameras.ts). Each entry includes the source page, operator, coordinates, timezone, viewing mode, rights-policy link, and manual review date. Coordinates represent camera areas and may not be survey-accurate.

## Viewing policy

| Source | In-app use | Basis and limits |
| --- | --- | --- |
| Caltrans CWWP2 | Official district metadata, source images, and HLS streams when available | [Wholesale portal](https://dot.ca.gov/programs/traffic-operations/traveler-information/cwwp) is intended for distributing public travel information. Glim relays allowlisted stream playlists and segments without recording. A catalog entry is not proof of a working stream. |
| TfL JamCams | Official location metadata, images, and periodically updated short MP4 clips | [Open data](https://tfl.gov.uk/info-for/open-data-users/) and [terms](https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service). Credit: Powered by TfL Open Data. Clips loop in the player and are explicitly not described as uninterrupted live video. |
| Windy Webcams API v3 | Viewport discovery, expiring images, and operator-provided live or timelapse players | [Official documentation](https://api.windy.com/webcams/docs). Requires a server-side key and the applicable plan. Image tokens expire; details refresh after four minutes. Up to 50 cameras are requested per area; this is not an all-world export. |
| I Love You Venice, Live Cam Kerala India, EarthCam, and Africam on YouTube | Operator-published broadcasts through the official embedded player | Current broadcast metadata was checked for live status and embedding support. An ended Prague video was removed. Source owners control schedules, highlights, and availability. No stream extraction or recording. |
| NPS Air Resources Division | Selected current JPG snapshots, normally updated about every 15 minutes | [Air quality webcam network](https://www.nps.gov/subjects/air/webcams.htm), [NPS disclaimer and copyright policy](https://www.nps.gov/aboutus/disclaimer.htm). These selected government-produced views are treated as public-domain content; copyrighted third-party material remains excluded. Source is credited. |
| USGS Hawaiian Volcano Observatory, KWcam | Current panorama snapshot, refreshed in the app every five minutes | [Original camera page](https://www.usgs.gov/volcanoes/kilauea/kwcam-live-panorama-halemaumau-west-rim-kilauea-summit-caldera-looking-southeast), [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits). USGS-produced material is public domain unless otherwise marked. Camera availability and scene visibility vary. |
| EarthCam | Link to original public page only | Times Square and Dublin pages. No feed redistribution or implied embedding permission. |
| SkylineWebcams | Link to original public page only | Venice and Cape Town. Operator retains content rights. |
| Webcam Sydney | Link to operator's public webcam page only | No redistribution or embedding agreement asserted. |
| explore.org / Katmai | Link to original public bear-cam page only | Seasonal live coverage and recorded highlights are controlled by the operator. |
| Australian Antarctic Program | Link to original Davis Station webcam page only | Official public source; no reuse permission is inferred. |
| Yamanashi Tourism / Fujisan Watcher | Link to official public Mount Fuji camera collection only | Camera locations and availability are determined by the operator. |
| Zermatt Tourism | Link to the official webcam collection only | Village cameras operate during daytime. No redistribution permission is inferred. |

NPS hosting by itself does **not** establish public-domain status for every camera. In particular, the popular Yosemite Conservancy cameras require a usage agreement according to the [Yosemite webcam page](https://www.nps.gov/yose/learn/photosmultimedia/webcams.htm). They are intentionally absent from the inline seed catalog.

## Weather and geography

- Weather: [Open-Meteo documentation](https://open-meteo.com/en/docs) and [terms](https://open-meteo.com/en/terms). Attribute Open-Meteo; data is CC BY 4.0. The free API is non-commercial and rate limited. Commercial deployments must configure their subscription API key. Coordinates sent to Open-Meteo are selected camera locations, not the viewer's location.
- Globe: [world-atlas](https://github.com/topojson/world-atlas), derived from [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) public-domain cartography. Geography is bundled locally. No user location is requested.
- Street tiles: [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Standard visible-map requests only; no bulk downloading or offline prefetch. HTTP referrers are preserved. Replace this public service with a properly provisioned tile provider before substantial traffic.
- Place search: a bundled [GeoNames cities15000 gazetteer](https://download.geonames.org/export/dump/readme.txt) and country records, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Lookups stay on the Glim server and do not call an external geocoding service. Country overview bounds use the largest Natural Earth polygon, which can exclude detached territories. Smaller settlements outside the gazetteer are not guaranteed. Update with `python scripts/update-places.py`.
- Fonts: local Fontsource DM Sans, SIL OFL; no runtime Google Fonts requests. Map cluster labels use the MapLibre demo glyph service; production deployments should provision their own glyph service.

## Maintenance

Run `npx tsx scripts/check-sources.ts` for a bounded manual check of listed pages and image MIME types. It contacts only the curated register, never scans the internet, and does not establish stream freshness or legal permission. A source may block automated requests while remaining accessible in a browser; investigate before removing it.

Source images, MP4 clips, and embedded players are fetched by the viewer's browser from the credited operator; that discloses the viewer's IP address to that operator. Caltrans HLS is relayed through a fixed, catalog-bound endpoint to support browsers when the operator does not supply CORS headers. Only HTTPS Caltrans hosts are permitted, redirects are refused, playlist references are rewritten and validated, and unsupported response types are rejected. Nothing is recorded. A loaded image may still be a cached or stale frame.

For source removals or rights corrections, open a repository issue containing the relevant public source URL. Do not include private information. An operator's withdrawal of permission takes priority over directory coverage.

Reviewed continuous broadcasts include [Kannur street view](https://www.youtube.com/watch?v=d-NrCm9vMz8), [Abbey Road / EarthCam](https://www.youtube.com/watch?v=zMCea32gpmg), [Venice / I Love You Venice](https://www.youtube.com/watch?v=zKGzYuT5tg0), and [Tembe / Africam](https://www.youtube.com/watch?v=gdrNUUf-cQw). These use official YouTube embeds and remain under each operator’s control. Broadcasts may end or switch to labeled highlights. Tembe’s map position is explicitly approximate. Windy live entries use its public operator-stream wrapper, retaining the source player and credited source links.
