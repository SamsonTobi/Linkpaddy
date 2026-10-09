import React, { useCallback } from "react";
import { linkpaddyLogo } from "../../assets/image";
import { Halftone, smoothstep } from "./Halftone";
import { BROWSER_NAMES, BrowserIcon, STORE_URLS, WEB_APP_URL, detectBrowser, isMobileDevice } from "./browsers";
import "./site.css";

interface NavLink {
  label: string;
  href: string;
}

/** Header that sits on the brand-purple hero. */
export const SiteHeader: React.FC<{ links: NavLink[] }> = ({ links }) => {
  const browser = detectBrowser();
  const mobile = isMobileDevice();
  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8 md:py-6">
        <a href="/" aria-label="LinkPaddy home" className="-ml-2 block">
          <img src={linkpaddyLogo} alt="LinkPaddy" className="h-9 w-auto brightness-0 invert md:h-10" />
        </a>
        <nav className="flex items-center gap-1 md:gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden rounded-full px-4 py-2 text-[15px] font-medium text-white hover:bg-white/15 md:inline-block"
            >
              {link.label}
            </a>
          ))}
          {mobile ? (
            <a
              href={WEB_APP_URL}
              className="ml-1 rounded-full bg-white px-5 py-2.5 text-[15px] font-bold text-brand-deep hover:bg-brand-lilac"
            >
              Open app
            </a>
          ) : (
            <>
              <a
                href={WEB_APP_URL}
                className="hidden rounded-full border-2 border-white px-5 py-2 text-[15px] font-bold text-white hover:bg-white/15 md:inline-block"
              >
                Open web app
              </a>
              <a
                href={STORE_URLS[browser]}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 rounded-full bg-white px-5 py-2.5 text-[15px] font-bold text-brand-deep hover:bg-brand-lilac"
              >
                Add to {BROWSER_NAMES[browser]}
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

/**
 * The halftone dissolve between two sections: dots that are solid where the
 * hero ends and shrink away into the next surface.
 */
export const HalftoneEdge: React.FC<{
  /** Colour of the dots, i.e. the colour of the section they leave. */
  color: string;
  /** Colour of the section the dots dissolve into. */
  ground: string;
  /** Dots grow downward instead, leading into a coloured section below. */
  rising?: boolean;
  className?: string;
}> = ({ color, ground, rising = false, className = "" }) => {
  const field = useCallback(
    (x: number, y: number) => {
      const wave = 0.08 * Math.sin(x * Math.PI * 3);
      const t = smoothstep(0.02, 0.98, (rising ? 1 - y : y) + wave);
      return 1 - t;
    },
    [rising],
  );
  return (
    <div className={`relative h-20 md:h-28 ${className}`} style={{ background: ground }}>
      <Halftone field={field} color={color} cell={12} />
    </div>
  );
};

export const SiteFooter: React.FC = () => (
  <footer className="border-t border-brand-deep/10 bg-brand-mist">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
      <div>
        <img src={linkpaddyLogo} alt="LinkPaddy" className="-ml-2 h-9 w-auto" />
        <p className="mt-1 text-sm text-brand-muted">The easiest way to share links with your inner circle.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
        <a href="/invite" className="font-medium text-brand-ink hover:text-brand">Invite friends</a>
        <a href="/privacy.html" className="font-medium text-brand-ink hover:text-brand">Privacy</a>
        <a href="mailto:support@linkpaddy.com" className="font-medium text-brand-ink hover:text-brand">Contact</a>
        <span className="text-brand-muted">© {new Date().getFullYear()} LinkPaddy</span>
      </div>
    </div>
  </footer>
);

/** Opens the web app; outlined so it reads as a peer of the filled store buttons on purple. */
export const WebAppButton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <a
    href={WEB_APP_URL}
    className={`inline-flex items-center justify-center rounded-full border-2 border-white px-7 py-3.5 text-lg font-bold text-white hover:bg-white/15 ${className}`}
  >
    Open web app
  </a>
);

/** Store buttons for every supported browser. */
export const BrowserButtons: React.FC<{ tone?: "light" | "dark" }> = ({ tone = "light" }) => (
  <div className="flex flex-col gap-3 sm:flex-row">
    {(Object.keys(STORE_URLS) as (keyof typeof STORE_URLS)[]).map((id) => (
      <a
        key={id}
        href={STORE_URLS[id]}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-3 rounded-full px-6 py-3.5 text-base font-bold ${
          tone === "light"
            ? "bg-white text-brand-deep hover:bg-brand-lilac"
            : "bg-brand text-white hover:bg-[#5b4bd6]"
        }`}
      >
        <BrowserIcon browser={id} className="h-6 w-6" />
        Add to {BROWSER_NAMES[id]}
      </a>
    ))}
  </div>
);
