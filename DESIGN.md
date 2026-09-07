---
name: Milwaukee in Miniature
description: A destination board for exploring Milwaukee's live 3D city.
colors:
  destination-charcoal: "#1d2428"
  map-cream: "#f2f1e8"
  signal-amber: "#e6ab45"
  utility-steel: "#83939b"
  map-ink: "#202b33"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "50px"
    fontWeight: 600
    lineHeight: 0.83
    letterSpacing: "0.015em"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  control: "6px"
  surface: "12px"
spacing:
  compact: "8px"
  section: "18px"
components:
  tour-button:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.destination-charcoal}"
    rounded: "{rounded.control}"
    height: "46px"
  map-toolbar:
    backgroundColor: "{colors.map-cream}"
    textColor: "{colors.map-ink}"
    rounded: "{rounded.surface}"
    padding: "8px"
---

# Design System: Milwaukee in Miniature

## Overview

**Creative North Star: "The Milwaukee Destination Board"**

The live 3D city is the primary artifact. A compact rail-inspired destination board supports deliberate landmark selection and guided touring, while a warm map toolbar keeps environmental controls near the city without covering it. The system is dense, legible, and civic rather than ornamental.

**Key Characteristics:**

- A dark, fixed destination rail paired with light floating map controls.
- Condensed civic display type and accessible sans-serif utility text.
- Amber reserved for active destinations and the primary tour action.
- Real geographic content remains visible and directly manipulable.

## Colors

Charcoal establishes the destination-board world, cream keeps map controls calm, amber signals action and selection, and steel blue carries secondary utility information.

**The Signal Amber Rule.** Use amber for the current place, keyboard focus, and the primary tour action; its rarity makes state easy to find.

## Typography

**Display Font:** Barlow Condensed (sans-serif)

**Body Font:** Barlow (sans-serif)

The narrow display face recalls transit and destination lettering without copying period signage. The open body face keeps controls and descriptions readable at compact sizes. Both are self-hosted under the included Open Font License.

- **Display** (600, 50px, 0.83): The two-line product title in the destination board.
- **Body** (400, 15px, 1.4): Descriptions and explanatory content.
- **Label** (600, 10–13px): Compact control names, counts, and status copy.

## Layout

On desktop, a 280px destination board owns the left edge and the WebGL viewport fills the remaining width. The board contains search, a scrolling landmark list, tour status, and tour controls. A cream toolbar floats at the bottom of the map. Below 1050px it becomes two rows so Light, Height, Reset, and About remain visible with 44px targets.

On mobile, Landmarks opens the board as an accessible drawer over a full-width city. The closed drawer is inert. Escape, outside press, and the toggle close it, with focus returning to the toggle after keyboard-driven closure.

## Elevation & Depth

The board uses a soft horizontal shadow to separate it from the rendered city. Floating cream surfaces use low, downward ambient shadows. Borders define controls within the board; colored halos are not part of the depth system.

## Shapes

Controls use compact 5–8px corners. Floating information surfaces use 10–12px corners. Small landmark labels are restrained rectangles rather than large pills so the city remains the dominant shape.

## Components

### Destination board

The charcoal rail contains the brand, landmark search, destination rows, current-selection lamp, and stable tour controls. Rows sit in restrained inset dark beds; the amber lamp uses a pale inset ring rather than a decorative glow. Its list scrolls independently when destinations exceed the available height.

### Map toolbar

The cream toolbar groups Light and Height as labeled segmented controls. Reset and About remain adjacent actions. It wraps into two rows instead of using horizontal scrolling.

### Landmark detail

Selection opens a concise cream surface with landmark facts and an OpenStreetMap source link with an authored outline icon. Reset or close clears the selected state. Map labels resolve overlaps every 100ms using stable landmark priority while always preserving the selected label.

### Inputs and dialogs

Search uses a dark inset field with a steel outline and amber keyboard focus. About uses the native modal dialog for focus containment, Escape handling, and focus return.

## Do's and Don'ts

### Do:

- **Do** preserve the live Three.js city as the primary visual surface.
- **Do** keep Light and Height labels visible so the numeric height controls remain unambiguous.
- **Do** use authored SVG icons and 44px minimum interactive targets.

### Don't:

- **Don't** treat generated city imagery, texture, or geography as a production asset or accuracy reference.
- **Don't** cover the city with oversized labels or persistent detail surfaces.
- **Don't** use amber as general decoration.
