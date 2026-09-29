import React, { useState, useEffect } from "react";
import { CheckCircle, Envelope, Spinner, WarningCircle } from "@phosphor-icons/react";
import { Halftone, smoothstep } from "./site/Halftone";
import { BrowserButtons, HalftoneEdge, SiteFooter, SiteHeader } from "./site/SiteChrome";

const RESEND_INVITE_ENDPOINT = "/api/send-invite";

const NAV = [{ label: "Home", href: "/" }];

const heroField = (x: number, y: number) => 0.9 * (1 - smoothstep(0.05, 0.9, Math.hypot(1 - x, 1 - y)));

const InvitePage: React.FC = () => {
  const [refUsername, setRefUsername] = useState("");
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setRefUsername(ref.replace(/^@/, ""));
    }
  }, []);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const recipientList = emails
      .split(/[;,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      setSendStatus({
        type: "error",
        message: "Enter at least one email address.",
      });
      return;
    }

    const invalid = recipientList.filter((e) => !isValidEmail(e));
    if (invalid.length > 0) {
      setSendStatus({
        type: "error",
        message: `Invalid email(s): ${invalid.join(", ")}`,
      });
      return;
    }

    if (recipientList.length > 10) {
      setSendStatus({
        type: "error",
        message: "Please enter at most 10 email addresses at a time.",
      });
      return;
    }

    setSending(true);
    setSendStatus(null);

    try {
      const response = await fetch(RESEND_INVITE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: recipientList, ref: refUsername }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invites");
      }

      setSendStatus({
        type: "success",
        message: `Invite${recipientList.length > 1 ? "s" : ""} sent successfully!`,
      });
      setEmails("");
    } catch (error) {
      setSendStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="site min-h-screen">
      <section className="relative overflow-hidden bg-brand text-white">
        <Halftone field={heroField} color="#2F278D" cell={16} />
        <SiteHeader links={NAV} />
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-8 md:px-8 md:pb-14 md:pt-14">
          <h1 className="max-w-3xl text-[clamp(2.4rem,5.4vw,4.25rem)] font-extrabold leading-[1.03] tracking-[-0.035em]">
            {refUsername ? (
              <>
                <span className="inline-block rounded-2xl bg-brand-deep px-3 pb-1 md:px-4">@{refUsername}</span> invited you to LinkPaddy.
              </>
            ) : (
              <>Share links with your inner circle.</>
            )}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white md:text-xl">
            {refUsername
              ? "Add the extension to your browser, then add them as a friend to start sharing."
              : "Add the extension to your browser and start sharing links with friends in one click."}
          </p>
          <div className="mt-8">
            <BrowserButtons />
          </div>
        </div>
      </section>
      <HalftoneEdge color="#6C5CE7" ground="#FAF9FF" />

      <main className="bg-brand-mist pb-20 pt-6 md:pb-28">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <div>
              <h2 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-tight tracking-[-0.02em]">
                Invite your friends by email.
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-brand-muted">
                Your friends receive an email with the extension link and
                {refUsername ? (
                  <>
                    {" "}
                    your username, <strong className="font-bold text-brand-ink">@{refUsername}</strong>.
                  </>
                ) : (
                  " your invite link."
                )}
              </p>
            </div>

            <form onSubmit={handleSendInvites} className="rounded-[28px] bg-brand-lilac p-5 sm:p-8">
              <label htmlFor="invite-emails" className="text-[15px] font-bold text-brand-ink">
                Email addresses
              </label>
              <textarea
                id="invite-emails"
                value={emails}
                onChange={(e) => {
                  setEmails(e.target.value);
                  if (sendStatus) setSendStatus(null);
                }}
                placeholder="friend1@email.com, friend2@email.com"
                rows={3}
                className="mt-2 w-full resize-none rounded-2xl border border-brand-deep/15 bg-white p-4 text-base text-brand-ink placeholder:text-brand-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                disabled={sending}
              />
              <p className="mt-2 text-sm text-brand-muted">Separate addresses with commas. Up to 10 at a time.</p>

              {sendStatus && (
                <div
                  role="status"
                  className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm font-medium ${
                    sendStatus.type === "success" ? "bg-[#DBFFCC] text-[#2a6a1c]" : "bg-red-50 text-red-700"
                  }`}
                >
                  {sendStatus.type === "success" ? (
                    <CheckCircle weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <WarningCircle weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{sendStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={sending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-base font-bold text-white hover:bg-[#5b4bd6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <Spinner className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Envelope className="h-5 w-5" weight="bold" />
                    Send invites
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default InvitePage;
