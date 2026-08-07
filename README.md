# LinkPaddy

LinkPaddy is a browser extension for sharing links and short messages with your inner circle. It lets you send something interesting to selected friends without leaving the page you are browsing, then keeps shared content organized in a private feed.

The extension is currently distributed for Chromium-based browsers:

- [Google Chrome](https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/linkpaddy/bmmebjoghmfijpdfgdmljffaanflbhdo?hl=en-US)
- [Brave](https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn)

## What It Does

- Share links from the extension popup or the current browser tab.
- Share text messages up to 1,000 characters.
- Choose one or more friends for each share.
- Keep sent and received content in separate feed views.
- See which recipients have seen or opened a shared item.
- Like shared links and receive activity notifications when someone likes your link.
- Bookmark links privately for later, with a Saved view.
- Copy links or text with in-app confirmation feedback.
- Edit or delete text shares as the sender.
- View recipient and sender profiles from recipient lists, including friendship state.
- Add, accept, reject, and remove friends.
- Search for users by username with debounced prefix search.
- Get optional sharing reminders when you have friends but have not shared recently.
- Receive browser notifications for new shares, friend activity, likes, and reminders.
- Pin the extension during onboarding for faster access and an easier unread-badge workflow.

## How It Works

LinkPaddy has three runtime surfaces:

- **Landing website:** The web page at `/` explains the product and links to each browser store.
- **Invite page:** The web page at `/invite` provides browser download links and lets someone send email invitations.
- **Extension popup:** The popup handles authentication, onboarding, sharing, the feed, friends, and settings.

When a user shares content, LinkPaddy stores a sender copy in `sharedLinks` and a recipient copy in each selected friend’s `receivedLinks`. Recipient profile and status data travels with the share so the sender can see delivery progress. User documents are stored under `users/{uid}` in Firestore.

## Main Technologies

- React 18 and TypeScript
- Webpack 5
- Tailwind CSS 3 and PostCSS
- Chrome Manifest V3 extension APIs
- Firebase Authentication and Cloud Firestore
- Vercel serverless endpoint for email invitations
- Resend for sending invitation emails
- Node’s built-in test runner for shared-content tests

## Project Structure

```text
src/
  background.ts              Extension service-worker entry point
  background/                Auth, friends, links, sync, reminders, notifications
  components/                Landing, invite, onboarding, sharing, dashboard, settings
  contexts/                  React authentication and user-data context
  shared/                    Shared types and pure content helpers
  index.tsx                  Web and extension React entry point
public/
  manifest.json              Manifest V3 configuration
  _locales/                  Extension localized strings
  privacy.html               Packaged privacy-policy page
api/
  send-invite.ts             Vercel/Resend invitation endpoint
tests/
  content.test.ts            Shared-content unit tests
```

## Requirements

- Node.js 18 or newer
- npm
- A Firebase project with Google sign-in enabled
- Firestore configured for the application’s user and sharing documents
- Resend credentials if email invitations are needed

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Fill in the Firebase values. `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` are needed by the invitation endpoint, not by the extension popup itself. Never commit `.env` or production secrets.

## Development Commands

Run the TypeScript check:

```bash
npm run typecheck
```

Run the unit tests:

```bash
npm test
```

Create a production extension build:

```bash
npm run build
```

The build output is written to `dist/`. To test locally, open the browser’s extension management page, enable developer mode, choose **Load unpacked**, and select `dist/`.

For an automatic development rebuild:

```bash
npm run dev
```

## Configuration

The required environment variables are listed in `.env.example`:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_ADDRESS`

The Webpack build injects Firebase configuration into the client bundle. Firebase web configuration is not a substitute for Firestore security rules. Keep backend rules restrictive and validate authenticated ownership on writes.

## Extension Permissions

The Manifest V3 extension requests permissions for:

- Google authentication and account identity
- Local storage for session, feed, and preference caching
- Clipboard reads when the user chooses to paste a link
- Tabs and active-tab access when the user shares the current page
- Context menus for browser sharing actions
- Alarms for synchronization and optional sharing reminders
- Notifications for new shares and activity

Host permissions cover Firebase services and the link-preview providers used by the extension. The extension does not include custom audio playback or an offscreen document.

## Privacy

LinkPaddy uses Google Authentication and Firebase/Firestore to provide accounts, friend relationships, and sharing. Shared content is sent only to the friends selected by the sender. Local browser storage is used to cache the signed-in user, links, and preferences. See [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) for the full policy.

## Browser Store Links

The public landing page and invite page both expose the current distribution links:

- Chrome and Brave use the Chrome Web Store listing.
- Edge uses the Microsoft Edge Add-ons listing.
- Firefox does not currently have a published LinkPaddy store listing.

## Status and Contributions

LinkPaddy is an actively developed project. Before opening a change, run `npm run typecheck`, `npm test`, and `npm run build`. Keep changes focused, avoid committing secrets, and preserve the existing CommonJS build configuration because it is required for the current Tailwind/PostCSS setup.
