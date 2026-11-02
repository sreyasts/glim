---
name: Glim
description: A compact public camera atlas with explicit source and playback states.
colors:
  blue: "#245dd9"
  blue-hover: "#1e50bb"
  selected: "#edf3ff"
  ink: "#1c2832"
  muted: "#53616e"
  line: "#dfe5e9"
  paper: "#fff"
  surface: "#f4f6f8"
  canvas: "#edf1f4"
  map-ocean: "#dae8ef"
  map-land: "#f0efe7"
  map-still: "#526774"
  player-shell: "#12212c"
  player-visual: "#0d171f"
  player-text: "#d9e3ea"
  signal-idle: "#9aacba"
  signal-live: "#83ce9c"
  focus: "#326be0"
typography:
  brand:
    fontFamily: "'DM Sans Variable', sans-serif"
    fontSize: "27px"
    fontWeight: 750
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'DM Sans Variable', sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'DM Sans Variable', sans-serif"
    fontSize: "21px"
    fontWeight: 650
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'DM Sans Variable', sans-serif"
    fontSize: "12px"
    lineHeight: 1.65
  label:
    fontFamily: "'DM Sans Variable', sans-serif"
    fontSize: "11px"
    fontWeight: 550
rounded:
  compact: "4px"
  control: "5px"
  action: "6px"
  field: "7px"
  toast: "8px"
  hint: "9px"
spacing:
  tight: "4px"
  compact: "8px"
  control: "12px"
  inset: "16px"
  section: "20px"
  roomy: "24px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.action}"
    padding: "10px 12px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.action}"
    typography: "{typography.label}"
    padding: "10px 12px"
  button-icon:
    rounded: "{rounded.control}"
    padding: "8px"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "4px 5px 4px 11px"
  camera-row-selected:
    backgroundColor: "{colors.selected}"
    rounded: "{rounded.action}"
    padding: "11px 10px"
  format-tag:
    rounded: "{rounded.compact}"
    padding: "5px 7px"
  mobile-navigation:
    backgroundColor: "{colors.paper}"
    height: "59px"
  player-status:
    backgroundColor: "{colors.player-shell}"
    textColor: "{colors.player-text}"
    padding: "6px 11px 6px 15px"
---

# Design System: Glim

## Overview

**Creative North Star: "The Contemporary Street Atlas"**

Glim is an operating workspace for finding public cameras geographically and watching their available visuals. Paper panels, slate cartography, compact geographic indexes, and restrained blue selection keep the map and camera legible together.

The visual signature is continuity: a selected camera row corresponds to a precise map point and its inline viewer. Camera names, operator credits, feed formats, and playback states carry the meaning.

**Key Characteristics:**
- Compact paper-and-slate workspace.
- Geographic selection expressed consistently in blue.
- One self-hosted sans family.
- Explicit source, format, and playback labels.

## Colors

Blue identifies interaction and geographic selection; neutral surfaces support cartography and media.

### Primary
- **Atlas Blue** (`blue`): selected points, clusters, primary actions, active navigation, and links.
- **Pressed Blue** (`blue-hover`): primary button hover.
- **Selection Wash** (`selected`): selected camera rows, saved controls, and active workspace navigation.
- **Focus Blue** (`focus`): visible keyboard outlines.

### Neutral
- **Ink / Muted Slate** (`ink`, `muted`): primary copy and supporting information.
- **Paper / Surface / Canvas** (`paper`, `surface`, `canvas`): panels and subdued workspace surfaces.
- **Divider** (`line`): panel seams, section boundaries, and control dividers.
- **Ocean / Land / Still Point** (`map-ocean`, `map-land`, `map-still`): globe geography and non-live markers.
- **Player Slate / Media Black / Player Text** (`player-shell`, `player-visual`, `player-text`): media containment and controls.
- **Idle / Playing Signal** (`signal-idle`, `signal-live`): playback indicators accompanied by text.

**The State Truth Rule.** A blue stream-source marker describes the catalog format; only the player's actual playback state can say “Playing live.” Color never replaces its label.

## Typography

**Display and Body Font:** self-hosted DM Sans Variable, with sans-serif fallback. The import is supplied by `@fontsource-variable/dm-sans`; map cluster counts use MapLibre's Noto Sans Regular glyphs.

The hierarchy is compact and functional. Camera titles are prominent; source and weather explanations stay subordinate. Coordinates, counts, and local times use tabular numerals where implemented.

### Hierarchy
- **Brand:** the compact wordmark; use the `brand` role.
- **Headline:** camera title; use `headline`. It becomes 23px below the desktop compression breakpoint and 27px on mobile and wide desktop.
- **Title:** camera-browser heading; use `title`. Mobile headings become 24px.
- **Body:** browser explanation; use `body`. Other explanatory copy uses 11–12px with generous line spacing.
- **Label:** desktop actions; use `label`. Mobile viewer actions increase to 12px; camera-row titles increase to 13px.

## Layout

The app occupies `100dvh` with a 460px minimum height. The header is 65px; the remaining workspace holds independently scrolling panels around a map that fills available space. The map stays mounted while changing mobile panes.

| Width | Index / map / viewer |
| --- | --- |
| Default desktop | 310px / flexible; with viewer: 300px / flexible / 420px |
| At least 1550px | 340px / flexible; with viewer: 330px / flexible / 490px |
| 851–1190px | 285px / flexible; with viewer: 265px / flexible / 350px |
| At most 850px | One pane at a time; 58px header and 59px bottom navigation |

Mobile navigation exposes Map, Cameras, and Viewer; Viewer is disabled until a camera is selected. Inactive camera panels are hidden. The inactive map and its descendants are invisible and unavailable to pointer interaction, including map attribution controls. This prevents hidden map links from remaining exposed over the active pane.

Use compact gaps inside controls and larger insets at section boundaries. Region shortcuts scroll horizontally inside their own bar. Long camera titles wrap; secondary row locations truncate. The media viewport is 16:10, contains the actual feed without cropping, and caps at 390px high on mobile.

## Elevation & Depth

Panel structure comes from paper surfaces and one-pixel seams. Small soft shadows lift map overlays, the selected format filter, and notifications; the map and viewer remain the dominant surfaces. Exact shadow and motion values are in the sidecar.

**The Attached Selection Rule.** Keep index selection, geographic position, and camera viewer linked to the same stable camera ID.

## Shapes

Controls use modest rounded corners: compact tags and states, slightly softer actions and fields, and a softer onboarding hint. Thumbnails clip within gently rounded rectangles. Geographic markers are circles with white separation; the selected camera is a white center with a blue ring. Player media has square edges within its panel.

## Components

### Buttons
Primary actions use Atlas Blue and white text; ordinary actions use paper, a fine border, and slate text. Saved actions use blue text, a pale selection fill, and an emphasized border. Destructive confirmation uses a red treatment. Icon controls retain accessible names when visible text is absent. Disabled controls reduce opacity to 0.45 and use the not-allowed cursor.

Interactive controls use a three-pixel Focus Blue outline with a three-pixel offset. The search field instead highlights its enclosing border and ring. Button color changes take 150ms.

### Inputs / Fields
Search combines a search icon, a flexible borderless input, and a compact submit button in one outlined field. Submit is disabled while searching or when fewer than two trimmed characters are entered. Place results form a bounded scrolling list. Weather-watch fields use visible labels and standard select/number controls; errors appear as text alerts.

### Navigation and Filters
Desktop workspace navigation shows Explore, Saved, and Watches. On mobile, header icons retain accessible labels while the bottom navigation names each pane. Active navigation and format filters expose `aria-pressed`. Formats are All, Live sources, Video, and Images.

### Camera Rows / Containers
A camera row is a full-width button with thumbnail, real camera/place name, location, format, and chevron. Hover and selection tint the row. Failed thumbnails become camera icons; they are not replaced with invented camera imagery. Source-provider rows show textual provider status, message, and indexed count.

### Map
A globe transitions into desaturated street tiles. Clusters expand into individual camera points; selecting a camera focuses it at street scale and opens its viewer. The point ring remains visible at the selected coordinate. Labeled zoom, whole-world, and rotation controls supplement direct map interaction. Map failures retain the camera-list route.

### Inline Player
Streams, updated clips, recorded video, timelapses, operator players, updating images, and source websites keep distinct labels. Native media controls and operator frames remain standard controls. The status strip reports connection, buffering, playback, image receipt, or failure; an opened operator frame does not confirm live footage.

Failures provide Retry, a source-image fallback when available, and a nearby camera when available. Image receipt is distinct from capture freshness. Clips explicitly disclose looping and refresh behavior. Source credit, original-camera links, terms, and weather-model attribution stay attached to the viewer. Weather watches describe weather conditions rather than image analysis.

### Feedback
Catalog errors use an inline status notice with Retry. Player failure uses an alert. Temporary notifications use a bottom-centered status toast, raised above mobile navigation. CSS transitions are effectively removed for reduced-motion preference; camera/place focus also removes its map animation.

## Do's and Don'ts

### Do:
- **Do** preserve the selected camera's identity across row, map point, title, and feed.
- **Do** keep source format, playback state, and capture freshness distinct.
- **Do** retain readable labels, keyboard focus, and reachable pane navigation.
- **Do** show operator credit and recovery actions beside the relevant feed.

### Don't:
- **Don't** infer working playback from a catalog entry, marker color, or loaded operator frame.
- **Don't** crop camera media to fill decorative cards.
- **Don't** invent camera visuals or substitute unrelated imagery after a source failure.
- **Don't** add a marketing hero or decorative motion to the atlas workspace.
