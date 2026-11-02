# Coverage and practical limits

Glim can combine authorized public broadcasts worldwide. It cannot expose every CCTV camera: most security cameras are private, and public operators differ in licensing, uptime, player restrictions, and API access. An indexed entry is source metadata, not proof of current video playback. Different providers can list the same physical camera.

The integration loads the twelve official Caltrans district catalogs, TfL JamCams, reviewed operator broadcasts, and Windy Webcams. Windy startup discovery samples 48 countries, up to 200 China entries, and up to 1,000 popular worldwide entries. Two requests run at a time. Moving and zooming discovers more. Its cache holds 5,000 entries; this is partial worldwide coverage.

## Regional checks

Checked on 1–2 November 2026. Provider counts can include inactive entries and change over time.

| Region | Finding | Playback implication |
| --- | --- | --- |
| India | Windy returned 11 entries and one advertised live player. A separate owner-published Kannur street broadcast was added. | Kannur visibly played at 854×480. Bengaluru's advertised live endpoint did not load. |
| China | Windy returned 195 entries; five advertised live players were around Hong Kong. | Sheung Shui decoded video at 704×576. This does not establish mainland-wide live coverage. |
| Ukraine | Windy returned no entries. | No Ukraine feed is invented or claimed. Other authorized sources need separate verification. |
| Africa | Country samples include South Africa, Tanzania, Kenya, Egypt, Morocco, Nigeria, Ghana, Namibia, and Botswana. | One Muizenberg embed failed. Africam's public Tembe broadcast is separately included; a wildlife broadcast may switch views or show labeled highlights. |
| Americas | Thousands of Caltrans entries, plus discovery in Canada, Mexico, Brazil, Argentina, Chile, Colombia, and Peru. | Several Caltrans feeds visibly played; some advertised HLS URLs return 404. |
| London | Hundreds of TfL traffic entries and EarthCam's current Abbey Road broadcast. | TfL videos are updated clips. Abbey Road visibly played as a live YouTube broadcast. |

Operator partnerships and additional licensed regional APIs matter more than adding markers. Production worldwide coverage needs a suitable provider plan, a refresh budget, regional source owners, playback checks, and provisioned map and stream infrastructure. No acquisition or retention outcome has been established.

Sources: [Windy API](https://api.windy.com/webcams/docs), [Caltrans CWWP](https://dot.ca.gov/programs/traffic-operations/traveler-information/cwwp), [TfL open data](https://tfl.gov.uk/info-for/open-data-users/), and the credited source links on individual entries.
