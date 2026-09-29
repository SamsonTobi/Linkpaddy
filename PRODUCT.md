# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
People who trade links with a small, known circle and want that to feel calmer than a group chat. Confirmed audiences, user-stated: creative teams, technical teams that work together, builder circles, remote squads, friend groups, study and work buddies, and curious researchers / newsletter readers. The site must make clear LinkPaddy is not only for friend groups.

## Product Purpose
LinkPaddy is a browser extension (Chrome, Edge, Brave) for sharing links and short text with an inner circle without leaving the page. Shared content lands in a private feed. Success: a visitor understands it in seconds, installs it, and invites their circle.

## Positioning
Sharing lives inside the browser toolbar and the page you are on, not in a chat app. Recipients are chosen per share from a friends list, and senders see who has seen or opened each link. Privacy: shares go only to the friends selected.

## Operating Context
Google sign-in, username-based friend requests, a popup feed with Sent / Received / Saved views, browser notifications, an optional sharing reminder, invites by email via /invite. Marketing site is a React SPA served at `/` and `/invite`, plus a static `privacy.html`, deployed on Vercel.

## Capabilities and Constraints
Confirmed features (README): share links and text (up to 1,000 chars) from popup or current tab; pick one or many friends per share; separate sent/received feeds; per-recipient seen/opened status; likes with notifications; private bookmarks (Saved); copy with confirmation; edit/delete own text shares; friend add/accept/reject/remove and username search; optional reminders; browser notifications; pin-to-toolbar onboarding. Chrome and Brave share the Chrome Web Store listing; Edge has its own. No Firefox listing. Free pricing is not stated anywhere: do not claim it.

## Brand Commitments
Name is LinkPaddy. Brand purple #6C5CE7, deep purple #2F278D. Rounded geometric wordmark (src/assets/linkpaddylogo.png). The extension's welcome screen uses a halftone-dot photograph tinted purple; the halftone treatment is to become part of the brand system. Tagline in the extension: "The easiest way to share links with your inner circle."

## Evidence on Hand
Real extension UI screenshots are not in the repo; src/assets/linkshareIllus.png is a feed mock. Halftone photos: src/assets/halftone-welcome-img.png and halftone-img.png. No testimonials, user counts, ratings, or press. Do not invent any.

## Product Principles
1. Simple over clever: one job, said plainly.
2. Say only what the product does; no invented proof.
3. Private by default: shares reach only the people you pick.
4. Sharing should cost one click, not a context switch.

## Accessibility & Inclusion
Not specified. Default to WCAG AA contrast, visible focus, reduced-motion respect.
