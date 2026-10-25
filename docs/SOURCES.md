# Camera and data register

The machine-readable register is [`shared/cameras.ts`](../shared/cameras.ts). Each entry includes the source page, operator, coordinates, timezone, viewing mode, rights-policy link, and manual review date. Coordinates represent camera areas and may not be survey-accurate.

## Viewing policy

| Source | In-app use | Basis and limits |
| --- | --- | --- |
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
- Fonts: local Fontsource packages for DM Sans and Manrope, SIL OFL; no runtime Google Fonts requests.

## Maintenance

Run `npx tsx scripts/check-sources.ts` for a bounded manual check of listed pages and image MIME types. It contacts only the curated register, never scans the internet, and does not establish stream freshness or legal permission. A source may block automated requests while remaining accessible in a browser; investigate before removing it.

Source images are fetched by the viewer's browser directly from the credited operator. Glim does not proxy, store, or record them. This avoids server-side arbitrary-URL fetching but discloses the viewer's IP address to the image operator. A loaded image may still be a cached or stale source frame.

For source removals or rights corrections, open a repository issue containing the relevant public source URL. Do not include private information. An operator's withdrawal of permission takes priority over directory coverage.
