# Design: LinkPaddy website

Scope: the marketing site (`/`, `/invite`, `privacy.html`). The extension popup keeps its own styling.

## Idea
Halftone is the brand. Dots shrink and grow to make edges, dividers and photography, the way the welcome screen's photo does. Everything else stays quiet.

## Tokens (`tailwind.config.js`, `brand.*`)
- `brand` #6C5CE7: primary field (hero, closing section), buttons.
- `brand-deep` #2F278D: halftone dots on purple, highlighted word, button text on white.
- `brand-ink` #1E1638: text. `brand-muted` #5B5675: secondary text.
- `brand-mist` #FAF9FF and `brand-lilac` #EFEBFF: light surfaces.
- `brand-green` #45A134: only for the "opened" state.
- White text on `brand` is 4.9:1, so use full white, not a tint.

## Type
- Display: Gabarito 700/800, tracking -0.02em to -0.035em (`font-display`, applied to headings under `.site`).
- Body: Hanken Grotesk 400/500/700 (`font-body`).
- Fonts load through `@fontsource` in `src/components/site/site.css`. `privacy.html` points at the emitted files in `/assets/fonts/`.

## Halftone toolkit (`src/components/site/Halftone.tsx`)
- `<Halftone field color cell />`: canvas dot screen at 45 degrees. `field(x, y)` returns 0..1 coverage; radius scales with the square root so area tracks coverage.
- `<HalftoneEdge />`: dots dissolve between two sections.
- `useHalftoneMask`: renders a screen to a PNG for CSS masks, used to dissolve the hero photo.
- `.dot-rule` (`site.css`): dotted divider.
- Mono photo: `halftone-img.png` with `mix-blend-screen` on `brand-deep`, tinted by a `brand-lilac` multiply layer.

## Rules
- Halftone edges and dividers carry the brand. No gradients, no icon-card grids, no eyebrows.
- Product demos (`Demos.tsx`) mirror the extension UI. Names and pages in them are illustrative.
- One interaction: hero dots swell near the pointer, and the hero share demo works. Both respect reduced motion where relevant.
