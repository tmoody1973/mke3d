# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Working assumption authorized by the user's approval to proceed with the design round: locals and visitors exploring Milwaukee and its landmarks.

## Product Purpose

An interactive 3D miniature of Milwaukee. Visitors explore the city, fly to landmarks, and follow a guided camera tour. The user wants recognizable architecture, geographically accurate streets and highways, natural camera motion, and convincing daylight, sunset, and night scenes.

## Capabilities and Constraints

Existing Vite/TypeScript/Three.js web application. Preserve direct map manipulation, landmark selection and descriptions, guided tour with pause/resume/stop, daylight/sunset/night controls, 1×/2×/4× height controls, reset, loading and retry states, and source attribution. Keep the actual 3D city as the main experience. The interface must work on desktop and mobile.

Geometry derives from OpenStreetMap footprints, public terrain, and hand-built interpretive landmark models. The experience is not a measured architectural survey. It must distinguish sourced dimensions from approximated geometry.

## Brand Commitments

Milwaukee in Miniature. The user requested an interface with a distinct identity using Impeccable. The user approved combining the dark destination board and amber tour control from the rail concept with the white concept’s compact lighting, height, and reset controls. Those two supplied mockups are the visual references; their generated geographic imagery is illustrative, not approved geometry.

## Evidence on Hand

The live city rendering, web/src/landmarks.ts descriptions, public data under web/public/data, and local architecture reference photos under milwaukee_threejs_photo_references. Reference photographs are not licensed production assets by default.

## Product Principles

- Make the city easy to explore while keeping architecture visible.
- Let geographic and architectural evidence guide the models.
- Keep controls understandable and usable with keyboard and touch.
- State uncertainty about interpretive geometry honestly.

## Open Decisions

Specific audience priorities remain a working assumption. No persistent comp-first or code-first workflow preference was confirmed; this design round uses the skill's comp-first default.
