import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  FunnelSimple,
  Gear,
  LinkSimple,
  MagnifyingGlass,
  PaperPlaneTilt,
  ShareNetwork,
  TextT,
  UserPlus,
  Users,
} from "@phosphor-icons/react";
import { inviteIllus } from "../../assets/image";
import { Halftone, smoothstep } from "./Halftone";
import { shareShortcut } from "./browsers";

/* Small, honest reproductions of the extension's own UI. The people and pages
   are illustrative; the components mirror what the popup actually does. */

const PEOPLE = [
  { name: "maya", bg: "#F5DD90" },
  { name: "dev", bg: "#D6DCFF" },
  { name: "jo", bg: "#F0E2FF" },
  { name: "sam", bg: "#DBFFCC" },
  { name: "ada", bg: "#FFD9D2" },
];

const Avatar: React.FC<{ name: string; bg: string; className?: string }> = ({ name, bg, className = "h-11 w-11" }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-full font-display text-base font-bold uppercase text-brand-ink ${className}`}
    style={{ background: bg }}
    aria-hidden
  >
    {name[0]}
  </span>
);

const PageTile: React.FC = () => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-deep font-display text-lg font-extrabold text-white" aria-hidden>
    F
  </span>
);

const SHARE_FRIENDS = [
  { name: "Maya Okafor", user: "maya", bg: "#F5DD90" },
  { name: "Dev Patel", user: "dev", bg: "#D6DCFF" },
  { name: "Jo Lin", user: "jo", bg: "#F0E2FF" },
];

/** Hero demo: the browser toolbar and the "Share something" popup, working. */
export const ShareDemo: React.FC = () => {
  const [selected, setSelected] = useState<string[]>(["maya", "dev"]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), 2400);
    return () => clearTimeout(timer);
  }, [sent]);

  const toggle = (user: string) => {
    setSent(false);
    setSelected((current) => (current.includes(user) ? current.filter((u) => u !== user) : [...current, user]));
  };

  return (
    <div className="w-full max-w-[400px] font-body">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(30,22,56,0.55)]">
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2.5 w-2.5 rounded-full bg-[#E4E1F2]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#E4E1F2]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#E4E1F2]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-brand-mist px-4 py-1.5 text-[13px] text-brand-muted">
          example.com/variable-fonts
        </span>
        <img src="/icons/icon48.png" alt="" className="h-7 w-7 rounded-md ring-2 ring-brand ring-offset-2" />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_28px_60px_-20px_rgba(30,22,56,0.6)]">
        <div className="flex items-center justify-between gap-3 border-b border-brand-deep/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <ArrowLeft className="h-5 w-5 text-brand-ink" />
            <p className="font-display text-xl font-bold text-brand-ink">Share something</p>
          </div>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => setSent(true)}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              sent ? "bg-brand-green" : "bg-brand hover:bg-[#5b4bd6]"
            }`}
          >
            {sent ? (
              <>
                <Check weight="bold" className="sent-check-icon h-4 w-4" /> Sent
              </>
            ) : (
              <>
                {selected.length === 0 ? "Pick a friend" : `Share to ${selected.length === SHARE_FRIENDS.length ? "all " : ""}${selected.length}`}
                {selected.length > 0 && <PaperPlaneTilt className="h-4 w-4" />}
              </>
            )}
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F0EFF4] p-1 text-sm font-medium" aria-hidden>
            <span className="flex items-center justify-center gap-2 rounded-lg bg-white py-2 text-brand-ink shadow-sm">
              <LinkSimple className="h-4 w-4" /> Link
            </span>
            <span className="flex items-center justify-center gap-2 py-2 text-brand-muted">
              <TextT className="h-4 w-4" /> Text
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-brand-deep/10 px-4 py-3" aria-hidden>
            <LinkSimple className="h-4 w-4 shrink-0 text-brand-muted" />
            <span className="truncate text-sm text-brand-ink">https://example.com/variable-fonts</span>
          </div>

          <p className="pt-1 text-sm font-bold text-brand-ink">Select friends:</p>
          <div className="grid grid-cols-3 gap-2.5">
            {SHARE_FRIENDS.map((friend) => {
              const on = selected.includes(friend.user);
              return (
                <button
                  key={friend.user}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(friend.user)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center ${
                    on ? "border-brand bg-[#F3F1FF]" : "border-brand-deep/10 bg-white hover:border-brand/40"
                  }`}
                >
                  <span className="relative">
                    <Avatar name={friend.user} bg={friend.bg} className="h-11 w-11" />
                    {on && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white ring-2 ring-white">
                        <Check weight="bold" className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-[13px] font-bold text-brand-ink">{friend.name.split(" ")[0]}</span>
                  <span className="w-full truncate text-xs text-brand-muted">@{friend.user}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ContextMenuRow: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active }) => (
  <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? "bg-brand text-white" : "text-brand-ink/70"}`}>
    {children}
  </div>
);

/** Row 1: the three ways to start a share. */
export const EntryPointsDemo: React.FC = () => (
  <div className="grid gap-4 font-body sm:grid-cols-2">
    <div className="rounded-2xl bg-white p-3 shadow-[0_12px_30px_-16px_rgba(30,22,56,0.35)] sm:row-span-2">
      <p className="px-3 pb-2 pt-1 text-xs font-medium text-brand-muted">Right-click any page</p>
      <ContextMenuRow>Back</ContextMenuRow>
      <ContextMenuRow>Reload</ContextMenuRow>
      <ContextMenuRow>Save as…</ContextMenuRow>
      <ContextMenuRow active>
        <ShareNetwork className="h-4 w-4 shrink-0" weight="bold" />
        Share this site with LinkPaddy
      </ContextMenuRow>
      <ContextMenuRow>View page source</ContextMenuRow>
    </div>

    <div className="flex flex-col justify-center rounded-2xl bg-white p-5 shadow-[0_12px_30px_-16px_rgba(30,22,56,0.35)]">
      <p className="text-xs font-medium text-brand-muted">Press</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {shareShortcut()
          .split("+")
          .map((key, index) => (
            <React.Fragment key={key}>
              {index > 0 && <span className="text-brand-muted">+</span>}
              <kbd className="rounded-lg border border-brand-deep/15 border-b-[3px] bg-brand-mist px-3 py-1.5 font-body text-sm font-bold text-brand-ink">
                {key}
              </kbd>
            </React.Fragment>
          ))}
      </div>
    </div>

    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_12px_30px_-16px_rgba(30,22,56,0.35)]">
      <img src="/icons/icon48.png" alt="" className="h-9 w-9 rounded-lg ring-2 ring-brand ring-offset-2" />
      <p className="text-sm text-brand-ink">
        <span className="font-bold">Or click the icon</span>
        <span className="block text-brand-muted">in your toolbar</span>
      </p>
    </div>
  </div>
);

const eyeProps = {
  xmlns: "http://www.w3.org/2000/svg",
  className: "h-5 w-5 shrink-0",
  width: 28,
  height: 28,
  viewBox: "0 0 28 28",
  fill: "none",
  "aria-hidden": true,
} as const;
const stroke = { strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const NotSeenIcon: React.FC = () => (
  <svg {...eyeProps}>
    <path {...stroke} stroke="#9CA3AF" d="M4.667 4.667L23.333 23.333M11.847 11.907C11.294 12.478 10.962 13.219 10.962 14.039C10.962 15.743 12.336 17.117 14.039 17.117C14.859 17.117 15.6 16.785 16.171 16.232M7.583 7.82C5.425 9.393 3.85 11.52 3.5 14C4.667 18.667 8.75 22.167 14 22.167C16.275 22.167 18.375 21.467 20.125 20.3M12.25 5.95C12.817 5.867 13.4 5.833 14 5.833C19.25 5.833 23.333 9.333 24.5 14C24.183 15.167 23.683 16.233 23.042 17.183" />
  </svg>
);

const SeenIcon: React.FC = () => (
  <svg {...eyeProps}>
    <path {...stroke} stroke="#6C5CE7" d="M11.667 14C11.667 14.6188 11.9128 15.2123 12.3504 15.6499C12.788 16.0875 13.3815 16.3333 14.0003 16.3333C14.6192 16.3333 15.2127 16.0875 15.6502 15.6499C16.0878 15.2123 16.3337 14.6188 16.3337 14C16.3337 13.3812 16.0878 12.7877 15.6502 12.3501C15.2127 11.9125 14.6192 11.6667 14.0003 11.6667C13.3815 11.6667 12.788 11.9125 12.3504 12.3501C11.9128 12.7877 11.667 13.3812 11.667 14Z" />
    <path {...stroke} stroke="#6C5CE7" d="M3.5 14C6.3 9.33333 9.8 7 14 7C18.2 7 21.7 9.33333 24.5 14C21.7 18.6667 18.2 21 14 21C9.8 21 6.3 18.6667 3.5 14Z" />
  </svg>
);

const OpenedIcon: React.FC = () => (
  <svg {...eyeProps}>
    <path {...stroke} stroke="#45A134" d="M11.667 14C11.667 14.6188 11.9128 15.2123 12.3504 15.6499C12.788 16.0875 13.3815 16.3333 14.0003 16.3333C14.6192 16.3333 15.2127 16.0875 15.6502 15.6499C16.0878 15.2123 16.3337 14.6188 16.3337 14C16.3337 13.3812 16.0878 12.7877 15.6502 12.3501C15.2127 11.9125 14.6192 11.6667 14.0003 11.6667C13.3815 11.6667 12.788 11.9125 12.3504 12.3501C11.9128 12.7877 11.667 13.3812 11.667 14Z" />
    <path {...stroke} stroke="#45A134" d="M12.9523 20.9498C9.21511 20.5905 6.06433 18.2739 3.5 14C6.3 9.33333 9.8 7 14 7C18.2 7 21.7 9.33333 24.5 14C24.2545 14.4091 23.9966 14.8107 23.7265 15.204M17.5 22.1667L19.8333 24.5L24.5 19.8333" />
  </svg>
);

/** Row 2: the sender's view of who has seen a share. */
export const SeenDemo: React.FC = () => {
  const rows = [
    { person: PEOPLE[0], icon: <OpenedIcon />, label: "Opened", tone: "text-[#2f7d20]" },
    { person: PEOPLE[1], icon: <SeenIcon />, label: "Seen", tone: "text-brand" },
    { person: PEOPLE[2], icon: <NotSeenIcon />, label: "Not seen yet", tone: "text-brand-muted" },
  ];
  return (
    <div className="rounded-2xl bg-white p-5 font-body shadow-[0_12px_30px_-16px_rgba(30,22,56,0.35)]">
      <div className="flex items-center gap-3 rounded-xl bg-[#F5F4F8] p-3">
        <PageTile />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-brand-ink">Ten years of one poster a week</p>
          <p className="truncate text-xs text-brand-muted">You shared with 3 friends</p>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-brand-deep/10">
        {rows.map(({ person, icon, label, tone }) => (
          <li key={person.name} className="flex items-center gap-3 py-3">
            <Avatar name={person.name} bg={person.bg} className="h-9 w-9 text-sm" />
            <span className="flex-1 text-[15px] font-medium text-brand-ink">@{person.name}</span>
            <span className={`flex items-center gap-1.5 text-sm font-medium ${tone}`}>
              {icon}
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Row 3: adding people by username. */
export const FriendsDemo: React.FC = () => (
  <div className="rounded-2xl bg-white p-5 font-body shadow-[0_12px_30px_-16px_rgba(30,22,56,0.35)]">
    <div className="flex items-center gap-2 rounded-full bg-[#F5F4F8] px-4 py-3">
      <MagnifyingGlass className="h-4 w-4 text-brand-muted" />
      <span className="text-[15px] text-brand-ink">@ma</span>
      <span className="h-4 w-px animate-pulse bg-brand" aria-hidden />
    </div>
    <ul className="mt-3 divide-y divide-brand-deep/10">
      {[
        { person: PEOPLE[0], action: "Add friend", primary: true },
        { person: { name: "marco", bg: "#D6DCFF" }, action: "Friends", primary: false },
      ].map(({ person, action, primary }) => (
        <li key={person.name} className="flex items-center gap-3 py-3">
          <Avatar name={person.name} bg={person.bg} className="h-10 w-10" />
          <span className="flex-1 text-[15px] font-medium text-brand-ink">@{person.name}</span>
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              primary ? "bg-brand text-white" : "bg-[#F0EEF6] text-brand-muted"
            }`}
          >
            {action}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

/* ---- "Inside the popup": three real screens, rebuilt with made-up people ---- */

const PopupFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-[22px] bg-white font-body shadow-[0_24px_50px_-24px_rgba(30,22,56,0.5)] ring-1 ring-brand-deep/10">
    {children}
  </div>
);

const PopupHeader: React.FC = () => (
  <div className="flex items-center justify-between gap-2 border-b border-brand-deep/10 px-4 py-3.5">
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name="you" bg="#F5DD90" className="h-10 w-10" />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-display text-[17px] font-bold text-brand-ink">Hi, Alex</p>
        <p className="truncate text-xs text-brand-muted">@alex</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3.5 py-2 text-[13px] font-bold text-white">
        Share anything <ShareNetwork className="h-3.5 w-3.5" />
      </span>
      <Gear className="h-5 w-5 text-brand-ink" />
    </div>
  </div>
);

const TabPills: React.FC<{ active: "links" | "network" }> = ({ active }) => (
  <div className="flex items-center justify-between px-4 py-3">
    <div className="flex gap-2 text-[13px] font-medium">
      <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 ${active === "links" ? "bg-[#111827] text-white" : "bg-[#F0EFF4] text-brand-ink"}`}>
        <LinkSimple className="h-3.5 w-3.5" /> My Links
      </span>
      <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 ${active === "network" ? "bg-[#111827] text-white" : "bg-[#F0EFF4] text-brand-ink"}`}>
        <Users className="h-3.5 w-3.5" /> My Network
      </span>
    </div>
    {active === "links" && <FunnelSimple className="h-5 w-5 text-brand-muted" />}
  </div>
);

/** Halftone stand-in for a link's preview image. */
const PreviewBanner: React.FC = () => {
  const field = React.useCallback((x: number, y: number) => 0.15 + 0.85 * smoothstep(0.1, 1, x * 0.7 + (1 - y) * 0.5), []);
  return (
    <div className="relative h-24 overflow-hidden bg-brand-deep" aria-hidden>
      <Halftone field={field} color="#A99BFF" cell={9} />
    </div>
  );
};

export const FeedScreen: React.FC = () => (
  <PopupFrame>
    <PopupHeader />
    <div className="flex justify-between px-4 pt-3.5" aria-hidden>
      {[
        { user: "maya", bg: "#F5DD90" },
        { user: "dev", bg: "#D6DCFF" },
        { user: "jo", bg: "#F0E2FF" },
        { user: "sam", bg: "#DBFFCC" },
      ].map((p) => (
        <span key={p.user} className="flex w-14 flex-col items-center gap-1">
          <Avatar name={p.user} bg={p.bg} className="h-11 w-11" />
          <span className="text-[11px] text-brand-muted">@{p.user}</span>
        </span>
      ))}
    </div>
    <TabPills active="links" />
    <div className="space-y-3 px-4 pb-4">
      <div className="overflow-hidden rounded-xl bg-[#F5F4F8]">
        <PreviewBanner />
        <div className="flex gap-3 p-3.5">
          <PageTile />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-snug text-brand-ink">Ten years of one poster a week</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-brand-muted">
              A designer on making one thing every week, and what a decade of it teaches you.
            </p>
            <p className="mt-1.5 text-xs text-brand-muted">
              example.com • <span className="underline">Sent to Maya</span>
            </p>
          </div>
          <div className="flex flex-col items-end justify-between text-xs text-brand-muted">
            <NotSeenIcon />
            23 hrs
          </div>
        </div>
      </div>
      <div className="relative flex items-center gap-3 rounded-xl bg-[#F5F4F8] p-3.5">
        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-brand" />
        <PageTile />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-brand-ink">How we cut our build times in half</p>
          <p className="text-xs text-brand-muted">Shared by dev</p>
        </div>
      </div>
    </div>
  </PopupFrame>
);

const InviteCard: React.FC = () => (
  <div className="relative overflow-hidden rounded-2xl bg-[#F5DD90] p-4">
    <p className="max-w-[10rem] font-display text-xl font-bold leading-tight text-brand-ink">Bring your friends aboard</p>
    <p className="mt-1 max-w-[9rem] text-[13px] leading-snug text-brand-ink/80">Turn everyday links into shared discoveries with friends</p>
    <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-brand-deep">
      Invite some friends <UserPlus className="h-4 w-4" />
    </span>
    <img src={inviteIllus} alt="" className="absolute -bottom-2 -right-8 w-36 max-w-none" draggable={false} />
  </div>
);

export const NetworkScreen: React.FC = () => (
  <PopupFrame>
    <PopupHeader />
    <TabPills active="network" />
    <div className="space-y-3 px-4 pb-4">
      <InviteCard />
      <div className="flex items-center justify-between rounded-xl border border-brand px-4 py-3 text-[15px] font-bold text-brand">
        Add/Invite a New Friend <UserPlus className="h-4 w-4" />
      </div>
      <p className="pt-1 text-xs font-medium text-brand-muted">Added Friends (3)</p>
      {[
        { name: "Maya Okafor", user: "maya", bg: "#F5DD90" },
        { name: "Dev Patel", user: "dev", bg: "#D6DCFF" },
      ].map((f) => (
        <div key={f.user} className="flex items-center gap-3 rounded-xl bg-[#F5F4F8] p-3">
          <Avatar name={f.user} bg={f.bg} className="h-10 w-10" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-bold text-brand-ink">{f.name}</p>
            <p className="truncate text-xs text-brand-muted">@{f.user}</p>
          </div>
          <span className="rounded-full bg-[#FDE8E8] px-3.5 py-1.5 text-xs font-bold text-[#E5484D]">Remove</span>
        </div>
      ))}
    </div>
  </PopupFrame>
);

const Toggle: React.FC = () => (
  <span className="flex h-6 w-11 shrink-0 items-center justify-end rounded-full bg-brand p-0.5" aria-hidden>
    <span className="h-5 w-5 rounded-full bg-white" />
  </span>
);

export const SettingsScreen: React.FC = () => (
  <PopupFrame>
    <div className="flex items-center gap-3 border-b border-brand-deep/10 px-4 py-3.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0EFF4]">
        <ArrowLeft className="h-5 w-5 text-brand-ink" />
      </span>
      <p className="font-display text-xl font-bold text-brand-ink">Settings</p>
    </div>
    <div className="flex items-center gap-3 border-b border-brand-deep/10 px-4 py-4">
      <Avatar name="you" bg="#F5DD90" className="h-14 w-14" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-display text-lg font-bold text-brand-ink">Alex Rivera</p>
        <p className="text-xs text-brand-muted">@alex</p>
      </div>
      <span className="rounded-full bg-[#FDE8E8] px-3.5 py-2 text-xs font-bold text-[#E5484D]">Logout</span>
    </div>
    <div className="border-b border-brand-deep/10 px-4 py-4">
      <p className="text-[13px] font-bold text-brand">Your Link Stats</p>
      <div className="mt-3 flex gap-2.5 text-sm text-brand-ink">
        <span className="rounded-xl border border-brand-deep/15 px-3.5 py-2">
          <b className="font-bold">24</b> Sent <span className="text-brand-muted">↑</span>
        </span>
        <span className="rounded-xl border border-brand-deep/15 px-3.5 py-2">
          <b className="font-bold">31</b> Received <span className="text-brand-muted">↓</span>
        </span>
      </div>
    </div>
    <div className="divide-y divide-brand-deep/10 px-4">
      {[
        { title: "Show Link Previews", note: "Display website previews in link cards" },
        { title: "Sharing reminders", note: "Occasional prompts, at most once every 3 days" },
      ].map((row) => (
        <div key={row.title} className="flex items-center justify-between gap-4 py-4">
          <div className="leading-snug">
            <p className="text-[15px] font-bold text-brand-ink">{row.title}</p>
            <p className="text-xs text-brand-muted">{row.note}</p>
          </div>
          <Toggle />
        </div>
      ))}
    </div>
    <div className="p-4">
      <InviteCard />
    </div>
  </PopupFrame>
);
