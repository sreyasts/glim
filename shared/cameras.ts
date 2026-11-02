import type { Camera } from './types';

const verifiedOn = '2026-10-25';
const npsPermission = 'https://www.nps.gov/aboutus/disclaimer.htm';
const air = (id: string, name: string, place: string, lat: number, lng: number, timezone: string, description: string): Camera => ({
  id, name, place, lat, lng, timezone, description, country: 'United States', flag: '🇺🇸',
  category: 'Nature', provider: 'National Park Service',
  sourceUrl: `https://www.nps.gov/subjects/air/webcams.htm?site=${id}`,
  imageUrl: `https://www.nps.gov/featurecontent/ard/webcams/images/${id}.jpg`,
  permission: 'public-domain', permissionUrl: npsPermission, refreshSeconds: 900, verifiedOn, accent: '#88a991',
});
const link = (camera: Omit<Camera, 'permission' | 'permissionUrl' | 'verifiedOn'>): Camera => ({
  ...camera, permission: 'source-link', permissionUrl: camera.sourceUrl, verifiedOn,
});

/** Curated sources only. Network accessibility never establishes redistribution rights. */
export const cameras: Camera[] = [
  {
    id: 'tembe-elephants', name: 'Tembe Elephant Park waterhole', place: 'Tembe Elephant Park', country: 'South Africa', countryCode: 'ZA', flag: '🇿🇦',
    lat: -27.035, lng: 32.423, coordinateAccuracy: 'approximate', timezone: 'Africa/Johannesburg', category: 'Nature', provider: 'Africam · YouTube',
    sourceUrl: 'https://www.youtube.com/watch?v=gdrNUUf-cQw', permission: 'platform-embed',
    permissionUrl: 'https://www.youtube.com/t/terms', media: { kind: 'youtube', url: 'https://www.youtube-nocookie.com/embed/gdrNUUf-cQw', live: true },
    posterUrl: 'https://i.ytimg.com/vi/gdrNUUf-cQw/hqdefault.jpg', description: 'Africam’s intentionally public wildlife broadcast. The map point represents the park approximately; precise camera coordinates are not supplied. The operator may use alternate views or recorded highlights, which are identified in its broadcast.', verifiedOn: '2026-11-02', accent: '#245dd9',
  },
  {
    id: 'london-abbey-road', name: 'Abbey Road crossing', place: 'London', country: 'United Kingdom', countryCode: 'GB', flag: '🇬🇧',
    lat: 51.53202, lng: -0.1774, timezone: 'Europe/London', category: 'City', provider: 'EarthCam · YouTube',
    sourceUrl: 'https://www.youtube.com/watch?v=zMCea32gpmg', permission: 'platform-embed',
    permissionUrl: 'https://www.youtube.com/t/terms', media: { kind: 'youtube', url: 'https://www.youtube-nocookie.com/embed/zMCea32gpmg', live: true },
    posterUrl: 'https://i.ytimg.com/vi/zMCea32gpmg/hqdefault.jpg', description: 'EarthCam’s intentionally public Abbey Road crossing broadcast. Played through the official YouTube embed; operator availability and broadcast delays apply.', verifiedOn: '2026-11-02', accent: '#245dd9',
  },
  {
    id: 'kannur-live', name: 'Kannur public street view', place: 'Kannur, Kerala', country: 'India', countryCode: 'IN', flag: '🇮🇳',
    lat: 11.90056, lng: 75.36028, timezone: 'Asia/Kolkata', category: 'City', provider: 'Live Cam Kerala India · YouTube',
    sourceUrl: 'https://www.youtube.com/watch?v=d-NrCm9vMz8', permission: 'platform-embed',
    permissionUrl: 'https://www.youtube.com/t/terms', media: { kind: 'youtube', url: 'https://www.youtube-nocookie.com/embed/d-NrCm9vMz8', live: true },
    posterUrl: 'https://i.ytimg.com/vi/d-NrCm9vMz8/hqdefault.jpg', description: 'The camera owner’s intentionally public Kannur street broadcast, shown through YouTube’s official embedded player. The broadcaster controls availability.', verifiedOn: '2026-11-02', accent: '#245dd9',
  },
  {
    id: 'venice-grand-canal', name: 'Grand Canal · Ca’ Angeli', place: 'Venice', country: 'Italy', flag: '🇮🇹',
    lat: 45.4368, lng: 12.3295, timezone: 'Europe/Rome', category: 'City', provider: 'I Love You Venice · YouTube',
    sourceUrl: 'https://www.youtube.com/watch?v=zKGzYuT5tg0', permission: 'platform-embed',
    permissionUrl: 'https://www.youtube.com/t/terms', media: { kind: 'youtube', url: 'https://www.youtube-nocookie.com/embed/zKGzYuT5tg0', live: true },
    posterUrl: 'https://i.ytimg.com/vi/zKGzYuT5tg0/hqdefault.jpg', description: 'The operator’s Grand Canal broadcast, played through the official YouTube embedded player. Availability is controlled by the broadcaster.', verifiedOn, accent: '#245dd9',
  },
  air('grca', 'A canyon, a million colors.', 'Grand Canyon, Arizona', 36.058, -112.109, 'America/Phoenix', 'Watch the light move across one of the deepest stories on Earth. NPS air-quality camera, usually refreshed every 15 minutes.'),
  {
    id: 'kilauea', name: 'The Earth, still becoming.', place: 'Kīlauea, Hawaiʻi', country: 'United States', flag: '🇺🇸',
    lat: 19.421, lng: -155.287, timezone: 'Pacific/Honolulu', category: 'Volcano', provider: 'USGS Hawaiian Volcano Observatory',
    sourceUrl: 'https://www.usgs.gov/volcanoes/kilauea/kwcam-live-panorama-halemaumau-west-rim-kilauea-summit-caldera-looking-southeast',
    imageUrl: 'https://volcanoes.usgs.gov/observatories/hvo/cams/KWcam/images/M.jpg',
    permission: 'public-domain', permissionUrl: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
    refreshSeconds: 300, verifiedOn, description: 'A USGS panorama looking into Halemaʻumaʻu. Visibility, activity, and camera availability vary; this is not an eruption warning system.', accent: '#db9672',
  },
  link({ id: 'sydney', name: 'Take the scenic route.', place: 'Sydney Harbour', country: 'Australia', flag: '🇦🇺', lat: -33.852, lng: 151.211, timezone: 'Australia/Sydney', category: 'Coast', provider: 'Webcam Sydney', sourceUrl: 'https://www.webcamsydney.com/', description: 'A window onto Sydney Harbour. Watch on the operator’s website; Glim does not redistribute this stream.', accent: '#8baeb7' }),
  link({ id: 'venice', name: 'A slower kind of rush hour.', place: 'Venice, San Marco', country: 'Italy', flag: '🇮🇹', lat: 45.434, lng: 12.338, timezone: 'Europe/Rome', category: 'City', provider: 'SkylineWebcams', sourceUrl: 'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html', description: 'Bell towers, the basilica, and a square full of stories. The operator hosts the live view; open their player to watch.', accent: '#c8b88c' }),
  link({ id: 'times-square', name: 'The city’s always awake.', place: 'Times Square, New York', country: 'United States', flag: '🇺🇸', lat: 40.758, lng: -73.985, timezone: 'America/New_York', category: 'City', provider: 'EarthCam', sourceUrl: 'https://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1', description: 'One small corner of a very big city. View the authorized public broadcast on EarthCam.', accent: '#c5a2ad' }),
  air('mora', 'Some mountains make you pause.', 'Mount Rainier, Washington', 46.786, -121.736, 'America/Los_Angeles', 'The view from the foothills toward Mount Rainier. Cloud cover can hide the peak; that is part of the story.'),
  air('grte', 'Room to breathe.', 'Grand Teton, Wyoming', 43.724, -110.729, 'America/Denver', 'Watch changing light and weather across the Teton Range from the NPS air-quality camera.'),
  air('acad', 'Meet the Atlantic.', 'Acadia, Maine', 44.352, -68.226, 'America/New_York', 'Coastal Maine, in its own time. Images come from the NPS air-quality camera network.'),
  air('dena', 'A little closer to the wild.', 'Denali, Alaska', 63.73, -148.915, 'America/Anchorage', 'Alaska’s big skies and mountain weather. The camera may be dark, clouded, or seasonally unavailable.'),
  link({ id: 'brooks-falls', name: 'The locals are fishing.', place: 'Brooks Falls, Alaska', country: 'United States', flag: '🇺🇸', lat: 58.556, lng: -155.776, timezone: 'America/Anchorage', category: 'Wildlife', provider: 'explore.org / Katmai', sourceUrl: 'https://explore.org/livecams/brown-bears/brown-bear-salmon-cam-brooks-falls', description: 'The beloved public bear cam at Brooks Falls. Wildlife and live coverage are seasonal; the operator may show highlights.', accent: '#9ba782' }),
  link({ id: 'dublin', name: 'Pull up a chair.', place: 'Temple Bar, Dublin', country: 'Ireland', flag: '🇮🇪', lat: 53.345, lng: -6.264, timezone: 'Europe/Dublin', category: 'City', provider: 'EarthCam', sourceUrl: 'https://www.earthcam.com/world/ireland/dublin/?cam=templebar', description: 'A lively little patch of Dublin. Open the public camera on EarthCam to see what is happening.', accent: '#b3b38d' }),
  link({ id: 'davis', name: 'At the edge of everywhere.', place: 'Davis Station, Antarctica', country: 'Antarctica', flag: '🇦🇶', lat: -68.577, lng: 77.969, timezone: 'Antarctica/Davis', category: 'Nature', provider: 'Australian Antarctic Program', sourceUrl: 'https://www.antarctica.gov.au/antarctic-operations/webcams/davis/', description: 'An official Australian Antarctic Program station camera. See the latest images and timestamps on the operator’s site.', accent: '#a5b9c2' }),
  link({ id: 'cape-town', name: 'A mountain with an ocean view.', place: 'Table Mountain, Cape Town', country: 'South Africa', flag: '🇿🇦', lat: -33.925, lng: 18.424, timezone: 'Africa/Johannesburg', category: 'Coast', provider: 'SkylineWebcams', sourceUrl: 'https://www.skylinewebcams.com/en/webcam/south-africa/western-cape/cape-town/table-mountain.html', description: 'Cape Town beneath Table Mountain. Watch the operator’s public player for current conditions.', accent: '#caab8a' }),
  link({ id: 'fuji', name: 'A postcard that keeps changing.', place: 'Mount Fuji, Japan', country: 'Japan', flag: '🇯🇵', lat: 35.486, lng: 138.758, timezone: 'Asia/Tokyo', category: 'Nature', provider: 'Yamanashi Tourism / Fujisan Watcher', sourceUrl: 'https://www.yamanashi-kankou.jp/fujisanwatcher/live/index.html', description: 'See Mount Fuji through public cameras in the region. Yamanashi Tourism hosts links and current views on Fujisan Watcher.', accent: '#b5a5bd' }),
  link({ id: 'zermatt', name: 'Somewhere above the ordinary.', place: 'Zermatt, Switzerland', country: 'Switzerland', flag: '🇨🇭', lat: 46.021, lng: 7.749, timezone: 'Europe/Zurich', category: 'Nature', provider: 'Zermatt Tourism', sourceUrl: 'https://zermatt.swiss/en/info/webcams', description: 'The Matterhorn, the village, and a little Alpine perspective. See the official tourism webcam collection; village cameras operate during daytime.', accent: '#b2beca' }),
  air('pore', 'The coast takes a breath.', 'Point Reyes, California', 38.04, -122.80, 'America/Los_Angeles', 'Fog, headlands, and Pacific light from the NPS air-quality camera.'),
];

export const cameraById = new Map(cameras.map(camera => [camera.id, camera]));
