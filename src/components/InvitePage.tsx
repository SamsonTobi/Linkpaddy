import React, { useState, useEffect } from "react";
import {
  ArrowSquareOut,
  Shield,
  Envelope,
  CheckCircle,
  Spinner,
} from "@phosphor-icons/react";

const RESEND_INVITE_ENDPOINT = "/api/send-invite";

const STORE_URLS = {
  chrome:
    "https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn",
  edge:
    "https://microsoftedge.microsoft.com/addons/detail/linkpaddy/bmmebjoghmfijpdfgdmljffaanflbhdo?hl=en-US",
  brave:
    "https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn",
};

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
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">LinkPaddy</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="/"
              className="text-gray-600 hover:text-[#6C5CE7] transition-colors"
            >
              Home
            </a>
            <a
              href="mailto:support@linkpaddy.com"
              className="text-gray-600 hover:text-[#6C5CE7] transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {refUsername ? (
                <>
                  You're invited to join{" "}
                  <span className="text-[#6C5CE7]">LinkPaddy</span>
                  <br />
                  by <span className="text-[#6C5CE7]">@{refUsername}</span>
                </>
              ) : (
                <>
                  Share links effortlessly
                  <br />
                  with your inner circle
                </>
              )}
            </h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              Get the extension for your browser and start sharing links with
              friends in one click.
            </p>
          </div>

          {/* Browser cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              {
                name: "Google Chrome",
                icon: "https://www.google.com/chrome/static/images/chrome-logo.svg",
                url: STORE_URLS.chrome,
                color: "hover:border-blue-300",
              },
              {
                name: "Microsoft Edge",
                icon: "https://edge.microsoft.com/favicon.ico",
                url: STORE_URLS.edge,
                color: "hover:border-blue-400",
              },
              {
                name: "Brave",
                icon: "https://brave.com/static-assets/images/brave-logo.svg",
                url: STORE_URLS.brave,
                color: "hover:border-orange-300",
              },
            ].map((browser) => (
              <a
                key={browser.name}
                href={browser.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm ${browser.color} transition-all hover:shadow-md hover:-translate-y-0.5`}
              >
                <img
                  src={browser.icon}
                  alt={browser.name}
                  className="w-12 h-12"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='%236C5CE7'><circle cx='12' cy='12' r='10'/></svg>";
                  }}
                />
                <span className="font-semibold text-gray-800">
                  {browser.name}
                </span>
                <span className="flex items-center gap-1 text-sm text-[#6C5CE7] font-medium">
                  <ArrowSquareOut className="w-4 h-4" />
                  Add to {browser.name.split(" ")[0]}
                </span>
              </a>
            ))}
          </div>

          {/* Email invite section */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Envelope className="w-6 h-6 text-[#6C5CE7]" />
              <h3 className="text-xl font-bold text-gray-900">
                Send invites via email
              </h3>
            </div>
            <p className="text-gray-600 mb-5">
              Your friends will receive an email with the extension link and
              {refUsername ? (
                <>
                  {" "}
                  your inviter's username{" "}
                  <strong className="text-[#6C5CE7]">@{refUsername}</strong>.
                </>
              ) : (
                " your unique invite link."
              )}
            </p>

            <form onSubmit={handleSendInvites} className="space-y-4">
              <textarea
                value={emails}
                onChange={(e) => {
                  setEmails(e.target.value);
                  if (sendStatus) setSendStatus(null);
                }}
                placeholder="friend1@email.com, friend2@email.com"
                rows={3}
                className="w-full resize-none border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
                disabled={sending}
              />

              {sendStatus && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    sendStatus.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {sendStatus.type === "success" ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 mt-0.5 shrink-0 text-center">!</span>
                  )}
                  <span>{sendStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3 bg-[#6C5CE7] text-white rounded-xl font-semibold hover:bg-opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Spinner className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Envelope className="w-5 h-5" />
                    Send invites
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <span className="text-lg font-bold">LinkPaddy</span>
          <p className="text-gray-400 text-sm mt-1">
            &copy; {new Date().getFullYear()} LinkPaddy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InvitePage;
