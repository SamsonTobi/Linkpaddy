import React from "react";
import { halftoneImg, halftoneWelcomeImg } from "../assets/image";
import { Halftone, smoothstep, useHalftoneMask } from "./site/Halftone";
import { BrowserButtons, HalftoneEdge, SiteFooter, SiteHeader } from "./site/SiteChrome";
import { BROWSER_NAMES, BrowserIcon, STORE_URLS, detectBrowser, type BrowserId } from "./site/browsers";
import { EntryPointsDemo, FeedScreen, FriendsDemo, NetworkScreen, SeenDemo, SettingsScreen, ShareDemo } from "./site/Demos";

const PURPLE = "#6C5CE7";
const DEEP = "#2F278D";
const MIST = "#FAF9FF";

const NAV = [
  { label: "Benefits", href: "#benefits" },
  { label: "Inside", href: "#inside" },
  { label: "Who it's for", href: "#who" },
  { label: "How it works", href: "#how" },
];

const BENEFITS: {
  title: string;
  body: string;
  demo: React.ReactNode;
}[] = [
  {
    title: "Share without leaving the page.",
    body: "Click the toolbar icon, press a shortcut, or right-click. Pick who gets it and you are back to what you were reading in seconds.",
    demo: <EntryPointsDemo />,
  },
  {
    title: "Know it landed.",
    body: "See who has seen each link and who has opened it. No more asking whether anyone got your message.",
    demo: <SeenDemo />,
  },
  {
    title: "Keep it in your circle.",
    body: "Add people by username. Every share goes only to the friends you select, and nowhere else.",
    demo: <FriendsDemo />,
  },
];

const SCREENS = [
  {
    title: "Your feed",
    body: "Everything you sent and received, with previews and who has seen it.",
    node: <FeedScreen />,
  },
  {
    title: "Your network",
    body: "Add friends by username, and invite the ones who are not here yet.",
    node: <NetworkScreen />,
  },
  {
    title: "Your settings",
    body: "Switch previews and reminders on or off, and keep an eye on your stats.",
    node: <SettingsScreen />,
  },
];

const AND_MORE = [
  "Short text notes, up to 1,000 characters",
  "Sent, Received and Saved views",
  "Private bookmarks",
  "Likes, with a notification",
  "Link previews",
  "Optional nudges to share",
  "Browser notifications",
];

const AUDIENCES = [
  {
    name: "Creative teams",
    line: "Send the reference, the specimen, the case study. It waits in a feed your team can scroll when they are ready.",
  },
  {
    name: "Technical teams",
    line: "Docs, write-ups and issues worth reading go to the two people who need them, not the whole channel.",
  },
  {
    name: "Builder circles",
    line: "Trade the tools, teardowns and launches you find with the people building alongside you.",
  },
  {
    name: "Remote squads",
    line: "Links wait in each person's feed until they have time. Nobody has to be online at the same moment.",
  },
  {
    name: "Friend groups",
    line: "The video, the recipe, the thing you cannot explain. Send it straight to the one who will laugh.",
  },
  {
    name: "Study and work buddies",
    line: "Readings, sources and tutorials in one place, with Sent, Received and Saved to find them again.",
  },
  {
    name: "Curious readers",
    line: "Pass the piece you cannot stop thinking about to the one person who would want it.",
  },
];

const STEPS = [
  { title: "Add LinkPaddy", body: "Install it from your browser's store. It works in Chrome, Edge and Brave." },
  { title: "Add your people", body: "Sign in with Google, then add friends by username. They accept and they are in." },
  { title: "Share from any page", body: "Use the toolbar icon, the shortcut, or the right-click menu. Choose friends and send." },
];

/** Photo edge dissolves into dots; dots shrink toward every edge. */
const photoField = (x: number, y: number) => {
  const d = Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)) * 2;
  return 1 - smoothstep(0.72, 1.0, d);
};

/** Hero backdrop: a few dots gather in the lower left corner. */
const heroField = (x: number, y: number) => 0.5 * (1 - smoothstep(0.0, 0.55, Math.hypot(x, 1 - y)));

/** Panel backdrop: faint dots gather in the top right corner. */
const panelField = (x: number, y: number) => 0.5 * smoothstep(0.3, 1, x) * smoothstep(0.2, 1, 1 - y);

/** Closing section: dots swell toward the bottom. */
const ctaField = (x: number, y: number) => 0.55 * smoothstep(0.15, 1, y) * (0.6 + 0.4 * x);

const HeroPhoto: React.FC = () => {
  const mask = useHalftoneMask(photoField, 1338, 894, 26);
  return (
    <img
      src={halftoneWelcomeImg}
      alt="Friends gathered around a laptop, one pointing at the screen"
      className="w-full select-none"
      style={{ WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}
      draggable={false}
    />
  );
};

const OtherBrowsers: React.FC<{ current: BrowserId }> = ({ current }) => {
  const others = (Object.keys(BROWSER_NAMES) as BrowserId[]).filter((id) => id !== current);
  return (
    <p className="text-[15px] text-white">
      Also for{" "}
      {others.map((id, index) => (
        <React.Fragment key={id}>
          {index > 0 && " and "}
          <a href={STORE_URLS[id]} target="_blank" rel="noopener noreferrer" className="font-bold underline decoration-white/50 underline-offset-4 hover:decoration-white">
            {BROWSER_NAMES[id]}
          </a>
        </React.Fragment>
      ))}
    </p>
  );
};

const LandingPage: React.FC = () => {
  const browser = detectBrowser();

  return (
    <div className="site min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand text-white">
        <Halftone field={heroField} color={DEEP} cell={16} interactive />
        <SiteHeader links={NAV} />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-10 pt-6 md:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-4 lg:pb-16 lg:pt-10">
          <div className="site-rise">
            <h1 className="text-[clamp(2.6rem,5.4vw,4.25rem)] font-extrabold leading-[1.03] tracking-[-0.035em]">
              Found something good? Send it to your{" "}
              <span className="inline-block rounded-2xl bg-brand-deep px-3 pb-1 md:px-4">circle.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-white md:text-xl">
              LinkPaddy adds a share button to your browser. Pick the people who would love it, send it, and it lands in
              their private feed. No switching tabs, no digging through a group chat.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4">
              <a
                href={STORE_URLS[browser]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-lg font-bold text-brand-deep shadow-[0_14px_30px_-14px_rgba(30,22,56,0.7)] hover:bg-brand-lilac"
              >
                <BrowserIcon browser={browser} className="h-6 w-6" />
                Add to {BROWSER_NAMES[browser]}
              </a>
              <OtherBrowsers current={browser} />
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[680px] flex-col lg:-mr-10 lg:max-w-none xl:-mr-24">
            <div className="lg:ml-auto lg:w-[112%]">
              <HeroPhoto />
            </div>
            <div className="site-rise relative z-10 -mt-16 flex justify-center lg:-mt-40 lg:justify-start lg:pl-[2%]" style={{ animationDelay: "180ms" }}>
              <ShareDemo />
            </div>
          </div>
        </div>
        <div className="h-6 lg:h-12" aria-hidden />
      </section>
      <HalftoneEdge color={PURPLE} ground={MIST} />

      {/* Benefits */}
      <section id="benefits" className="scroll-mt-6 bg-brand-mist pb-20 pt-8 md:pb-28">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <h2 className="max-w-3xl text-[clamp(2rem,4.4vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            Sharing that stays out of your way.
          </h2>

          <div className="mt-14 space-y-16 md:space-y-24">
            {BENEFITS.map((benefit, index) => (
              <div key={benefit.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
                <div className={index % 2 === 1 ? "md:order-2" : ""}>
                  <h3 className="text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.02em]">
                    {benefit.title}
                  </h3>
                  <p className="mt-4 max-w-[30rem] text-lg leading-relaxed text-brand-muted">{benefit.body}</p>
                </div>
                <div className="relative overflow-hidden rounded-[28px] bg-brand-lilac p-5 sm:p-8">
                  <Halftone field={panelField} color="#D9D2FF" cell={14} />
                  <div className="relative">{benefit.demo}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 md:mt-28">
            <div className="dot-rule text-brand/40" aria-hidden />
            <p className="mt-6 font-display text-xl font-bold">And the small things.</p>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-[17px] text-brand-ink">
              {AND_MORE.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Inside the popup */}
      <section id="inside" className="scroll-mt-6 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <h2 className="max-w-3xl text-[clamp(2rem,4.4vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            Everything you need, in one small popup.
          </h2>
          <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
            {SCREENS.map((screen) => (
              <figure key={screen.title} className="flex flex-col">
                <div className="flex-1 [&>div]:h-full">{screen.node}</div>
                <figcaption className="mt-5">
                  <h3 className="text-2xl font-bold tracking-[-0.02em]">{screen.title}</h3>
                  <p className="mt-1.5 max-w-[22rem] text-[17px] leading-relaxed text-brand-muted">{screen.body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section id="who" className="scroll-mt-6 bg-brand-lilac py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <h2 className="text-[clamp(2rem,4.4vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
              Made for people who share what they find.
            </h2>
            {/* Mono halftone: screen turns the black dots deep purple, multiply tints the white lilac. */}
            <div className="relative mt-10 hidden overflow-hidden rounded-[28px] bg-brand-deep lg:block" style={{ isolation: "isolate" }}>
              <img src={halftoneImg} alt="" className="w-full mix-blend-screen" draggable={false} />
              <div className="absolute inset-0 bg-brand-lilac mix-blend-multiply" aria-hidden />
            </div>
          </div>
          <ul>
            {AUDIENCES.map((audience) => (
              <li key={audience.name} className="group">
                <div className="dot-rule text-brand/40" aria-hidden />
                <div className="flex gap-5 py-6 md:gap-6 md:py-7">
                  <span className="mt-3 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-brand transition-all duration-300 ease-out group-hover:h-5 group-hover:w-5" />
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold tracking-[-0.02em] md:text-[1.75rem]">{audience.name}</h3>
                    <p className="mt-1.5 max-w-[34rem] text-[17px] leading-relaxed text-brand-muted">{audience.line}</p>
                  </div>
                </div>
              </li>
            ))}
            <li>
              <div className="dot-rule text-brand/40" aria-hidden />
            </li>
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-6 bg-brand-mist py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <h2 className="text-[clamp(2rem,4.4vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">How it works</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand font-display text-xl font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-2xl font-bold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 max-w-[22rem] text-[17px] leading-relaxed text-brand-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <HalftoneEdge color={PURPLE} ground={MIST} rising />
      <section className="relative overflow-hidden bg-brand pb-20 pt-4 text-white md:pb-28">
        <Halftone field={ctaField} color={DEEP} cell={16} />
        <div className="relative mx-auto max-w-6xl px-5 md:px-8">
          <h2 className="max-w-3xl text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
            Bring your circle.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white md:text-xl">
            Add LinkPaddy to your browser, then invite the people you share with most.
          </p>
          <div className="mt-8">
            <BrowserButtons />
          </div>
          <p className="mt-6 text-[15px] text-white">
            Already using it?{" "}
            <a href="/invite" className="font-bold underline decoration-white/50 underline-offset-4 hover:decoration-white">
              Invite friends by email
            </a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default LandingPage;
