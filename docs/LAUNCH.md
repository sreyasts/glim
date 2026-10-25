# The product bet

**Name:** Glim — a glimpse of somewhere else.
**Promise:** Find a public window into a place you care about, then know when the conditions change.

## Challenge the original assumption

“All publicly accessible CCTV, in one place” is a poor initial product boundary. Accessibility does not establish the owner's intention, redistribution permission, stream reliability, or a useful reason to return. An impressive camera count can conceal a weak experience.

The strongest case for a broad globe is discovery: instant exploration, memorable visual identity, and naturally shareable places. The strongest case against it is utility: most visitors explore once and leave, while operators and existing webcam directories already own distribution. Glim needs a returning-use case, not just a prettier directory.

**Initial wedge:** travelers, outdoor photographers, and people who repeatedly check a favorite destination. Help them answer “what does it look like there?” and “tell me when the light or weather changes.” This is a hypothesis; the repo does not contain market validation or real user metrics.

## First audience and offer

1. Curate 30 genuinely useful mountain, coast, and destination views with stable sources, operator attribution, and explicit rights. The seed catalog demonstrates the format; it is not that network yet.
2. Recruit 10 photographers, trip planners, and destination residents for observed sessions. Ask what they check today and what would make them return. Do not pitch “AI CCTV.”
3. Offer a shareable place page and a useful sunrise/weather watch. The current app implements both; camera-based visibility scoring would require further work.
4. Watch whether users save a place and come back independently within seven days. A star, a sign-up, or a launch-day visit is not proof of recurring value.

## Distribution worth doing

| Channel | Specific action | Success signal |
| --- | --- | --- |
| Operator partnerships | Invite tourism boards and webcam owners to suggest their public pages. Offer credit, source traffic, and an opt-in embed agreement. | Permissioned sources with reliable updates |
| Search | Build useful place pages, clear timestamps, local conditions, original descriptions, and structured source information. Initial metadata and sitemap are included. | Qualified visits that save a place |
| Photography communities | Share a genuinely useful destination watch in relevant communities where permitted; disclose that you built it. | Repeat use and actionable feedback |
| Product demos | Publish a short screen recording: spin → choose → save → create a weather alert. State snapshot and alert limitations. | Visitors reaching a useful place |
| Open source | Use camera contribution issues and small, scoped engineering issues. Credit contributions. | Accepted sources and external contributors |
| Sharing | Let each saved destination become a clean, direct link. Native sharing is already implemented. | New visitors who themselves save a place |

No automated unsolicited messages, harvested contact lists, fake usage numbers, misleading emergency claims, or bought GitHub stars. “Aggressive” should mean faster experiments and better distribution, not spam.

## Four-week validation plan

- **Week 1:** Test the current build with 10 target users. Fix failures to find and save an actual destination. Obtain rights for 5 additional sources outside the US.
- **Week 2:** Publish only verified camera pages. Partner with 3 operators. Have 20 people try the specific weather/sunrise workflow.
- **Week 3:** Review return behavior and notification usefulness. Interview people who stopped using it. Prune unreliable sources instead of inflating the count.
- **Week 4:** Decide whether to deepen this audience, change the returning-use case, or stop investing. Do not start paid acquisition solely because the globe looks good.

Suggested decision gates, **not established benchmarks**: at least 20% of qualified first-time visitors save a place or create a watch; at least 25% of activated testers return in seven days; fewer than 10% of delivered alerts are rated irrelevant by testers. Small samples are noisy: inspect behavior and interviews, not just percentages. These figures would need measurement; this release intentionally includes no third-party analytics.

## Business model after evidence

Keep public exploration free. Test paid multi-place watches, reliable historical conditions, and operator-managed camera pages only after people repeatedly ask for them. Monetization requires commercial weather terms, appropriate source agreements, an actual user account system, and an operating budget.

Open questions that could change the plan: whether operators grant usable embed rights; whether users want environmental notifications enough to grant browser permission; whether alert precision produces repeated visits; and whether source availability outside US government cameras supports a reliable global promise.
