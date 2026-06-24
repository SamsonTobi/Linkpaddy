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

const EdgeIcon: React.FC = () => (
  <svg viewBox="0 0 18 18" className="w-12 h-12" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.2438 13.3946C16.0047 13.5211 15.7586 13.6336 15.5055 13.725 14.6969 14.0274 13.8461 14.1821 12.9813 14.1821 9.65547 14.1821 6.75859 11.8969 6.75859 8.95786 6.76562 8.1563 7.20859 7.41802 7.91172 7.03833 4.90234 7.16489 4.12891 10.3008 4.12891 12.136 4.12891 17.3321 8.91719 17.8594 9.95078 17.8594 10.5063 17.8594 11.343 17.6977 11.8492 17.536L11.9406 17.5079C13.8813 16.8399 15.5266 15.5321 16.6234 13.7954 16.7078 13.6618 16.6656 13.493 16.5391 13.4086 16.4477 13.3524 16.3352 13.3454 16.2438 13.3946Z" fill="#0078D4" />
    <path d="M7.43329 16.9735C6.80751 16.5868 6.2661 16.0735 5.8372 15.4759 3.98798 12.9446 4.54345 9.39385 7.0747 7.54463 7.34189 7.35479 7.6161 7.179 7.91142 7.03838 8.12939 6.93291 8.50204 6.7501 9.00126 6.75713 9.71142 6.76416 10.3794 7.10166 10.8083 7.67119 11.0895 8.05088 11.2513 8.50791 11.2583 8.98604 11.2583 8.97197 12.9809 3.38916 5.63329 3.38916 2.54657 3.38916 0.00829232 6.32119 0.00829232 8.8876 -0.00577018 10.2446 0.289542 11.5946 0.859074 12.8251 2.7997 16.9595 7.5247 18.9845 11.8559 17.5431 10.3724 18.0071 8.75517 17.8032 7.43329 16.9735Z" fill="#1B9DE2" />
    <path d="M10.7086 10.4695C10.6523 10.5398 10.4766 10.6453 10.4766 10.8703 10.4766 11.0531 10.5961 11.2289 10.807 11.3766 11.8195 12.0797 13.725 11.9883 13.732 11.9883 14.4844 11.9883 15.2156 11.7844 15.8625 11.4047 17.1844 10.6312 18 9.21797 18 7.68516 18.0211 6.11016 17.4375 5.0625 17.2055 4.59844 15.7148 1.68047 12.4945 0 9 0 4.07812 0 0.0703125 3.95156 0 8.87344 0.0351562 6.30703 2.5875 4.23281 5.625 4.23281 5.87109 4.23281 7.27734 4.25391 8.57812 4.94297 9.72422 5.54766 10.3289 6.27187 10.7438 6.99609 11.1797 7.74844 11.257 8.69062 11.257 9.07031 11.257 9.44297 11.0672 10.0055 10.7086 10.4695Z" fill="#36C752" />
  </svg>
);

const BraveIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-12 h-12" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 2 L36 10 L36 22 C36 32 30 38 24 42 C18 38 12 32 12 22 L12 10 Z" fill="#FB542B" />
    <path d="M24 12 L28 20 L34 16 L30 24 L24 34 L18 24 L14 16 L20 20 Z" fill="white" />
    <circle cx="19.5" cy="21" r="2.5" fill="#FB542B" />
    <circle cx="28.5" cy="21" r="2.5" fill="#FB542B" />
    <path d="M16 8 L14 14 L20 12 Z" fill="#FB542B" />
    <path d="M32 8 L34 14 L28 12 Z" fill="#FB542B" />
  </svg>
);

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
            {/* Chrome */}
            <a
              href={STORE_URLS.chrome}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <img
                src="https://www.google.com/chrome/static/images/chrome-logo.svg"
                alt="Google Chrome"
                className="w-12 h-12"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%234285F4'/%3E%3C/svg%3E";
                }}
              />
              <span className="font-semibold text-gray-800">Google Chrome</span>
              <span className="flex items-center gap-1 text-sm text-[#6C5CE7] font-medium">
                <ArrowSquareOut className="w-4 h-4" />
                Add to Chrome
              </span>
            </a>

            {/* Edge */}
            <a
              href={STORE_URLS.edge}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-400 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <EdgeIcon />
              <span className="font-semibold text-gray-800">Microsoft Edge</span>
              <span className="flex items-center gap-1 text-sm text-[#6C5CE7] font-medium">
                <ArrowSquareOut className="w-4 h-4" />
                Add to Edge
              </span>
            </a>

            {/* Brave */}
            <a
              href={STORE_URLS.brave}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-orange-300 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <BraveIcon />
              <span className="font-semibold text-gray-800">Brave</span>
              <span className="flex items-center gap-1 text-sm text-[#6C5CE7] font-medium">
                <ArrowSquareOut className="w-4 h-4" />
                Add to Brave
              </span>
            </a>
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
