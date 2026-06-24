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
  <svg viewBox="0 0 16 18" className="w-12 h-12" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#brave_clip)">
      <path d="M15.309 5.80664L14.7528 4.30565L15.1355 3.44452C15.1834 3.3309 15.1595 3.20532 15.0757 3.11561L14.0292 2.05714C13.5688 1.59668 12.887 1.43522 12.2711 1.6505L11.9781 1.75216L10.3754 0.0179402L7.66645 0H7.64851L4.92159 0.0239203L3.32492 1.7701L3.03787 1.66844C2.41595 1.44718 1.72824 1.60864 1.26777 2.08106L0.203322 3.15747C0.131561 3.22924 0.113621 3.3309 0.149502 3.4206L0.550166 4.31761L0 5.8186L0.358804 7.17608L1.98538 13.3535C2.17076 14.0651 2.60133 14.687 3.20532 15.1176C3.20532 15.1176 5.17874 16.511 7.12226 17.7728C7.29568 17.8864 7.47508 17.9641 7.66645 17.9641C7.85781 17.9641 8.03721 17.8864 8.21063 17.7728C10.3993 16.3375 12.1276 15.1116 12.1276 15.1116C12.7256 14.6811 13.1561 14.0591 13.3415 13.3475L14.9561 7.1701L15.309 5.80664Z" fill="#F15A22"/>
      <path opacity="0.15" d="M2.06312 13.6166L0 5.95015L0.603987 4.44916L0.185382 3.33686L1.18405 2.32025C1.51296 2.02723 2.1588 1.92557 2.45781 2.09899L4.0186 2.996L6.05183 3.46843L7.63654 2.81062L7.76811 16.4272C7.74419 18.3887 7.86977 18.1794 6.42857 17.2525L2.87043 14.8664C2.48771 14.5016 2.19468 14.089 2.06312 13.6166Z" fill="url(#brave_paint0_linear)"/>
      <path opacity="0.4" d="M12.0909 15.0845L9.06499 17.1536C8.2218 17.6141 7.81516 18.0686 7.74937 17.8473C7.69555 17.6739 7.73741 17.1656 7.71947 16.3762L7.68359 3.05863C7.68957 2.92706 7.77927 2.7058 7.93476 2.72972L9.47761 3.19617L11.7022 2.84932L13.1733 1.76693C13.3288 1.64733 13.556 1.65929 13.6995 1.79683L15.0152 3.05265C15.1348 3.17823 15.1407 3.42341 15.069 3.57889L14.7042 4.25464L15.3082 5.81544L13.2271 13.5536C12.9042 14.5164 12.4497 14.7676 12.0909 15.0845Z" fill="url(#brave_paint1_linear)"/>
      <path d="M8.01564 11.0511C7.94388 11.0212 7.86614 10.9973 7.84222 10.9973H7.65085C7.62693 10.9973 7.54919 11.0212 7.47743 11.0511L6.70002 11.3741C6.62826 11.404 6.50866 11.4578 6.4369 11.4937L5.26481 12.1036C5.19305 12.1395 5.18707 12.2053 5.25285 12.2531L6.2874 12.9827C6.35318 13.0305 6.45484 13.1083 6.51464 13.1621L6.97511 13.5568C7.03491 13.6106 7.13059 13.6943 7.19039 13.7481L7.63291 14.1428C7.69272 14.1967 7.7884 14.1967 7.8482 14.1428L8.30268 13.7481C8.36248 13.6943 8.45816 13.6106 8.51796 13.5568L8.97843 13.1561C9.03823 13.1023 9.13989 13.0246 9.20567 12.9767L10.2402 12.2412C10.306 12.1933 10.3 12.1275 10.2283 12.0917L9.05617 11.4937C8.98441 11.4578 8.86481 11.404 8.79305 11.3741L8.01564 11.0511Z" fill="white"/>
      <path d="M13.6234 6.07316C13.6473 5.99542 13.6473 5.96552 13.6473 5.96552C13.6473 5.88778 13.6413 5.75622 13.6294 5.67848L13.5696 5.50506C13.5337 5.4333 13.4739 5.31968 13.426 5.2539L12.7503 4.25522C12.7084 4.18944 12.6307 4.08778 12.5769 4.022L11.7038 2.92765C11.6559 2.86785 11.6081 2.81403 11.6021 2.82001H11.5901C11.5901 2.82001 11.5244 2.83197 11.4466 2.84393L10.1131 3.10705C10.0353 3.12499 9.90975 3.14891 9.83201 3.16087L9.80809 3.16685C9.73035 3.17881 9.60477 3.17283 9.52703 3.14891L8.40875 2.79011C8.33101 2.76619 8.20543 2.73031 8.13367 2.71237C8.13367 2.71237 7.90643 2.65855 7.72105 2.66453C7.53567 2.66453 7.30842 2.71237 7.30842 2.71237C7.23068 2.73031 7.1051 2.76619 7.03334 2.79011L5.91507 3.14891C5.83733 3.17283 5.71174 3.17881 5.634 3.16685L5.61008 3.16087C5.53234 3.14891 5.40676 3.11901 5.32902 3.10705L3.98351 2.85589C3.90576 2.83795 3.83998 2.83197 3.83998 2.83197H3.82802C3.82204 2.83197 3.7742 2.87981 3.72636 2.93961L2.85327 4.03396C2.80543 4.09376 2.72769 4.2014 2.67985 4.26718L2.0041 5.26586C1.96224 5.33164 1.89646 5.44526 1.86058 5.51702L1.80078 5.69044C1.78882 5.76818 1.77686 5.89974 1.78284 5.97748C1.78284 5.97748 1.78284 6.0014 1.80676 6.08512C1.84862 6.22865 1.95028 6.36021 1.95028 6.36021C1.99812 6.42001 2.08782 6.52167 2.14164 6.57549L4.12105 8.68047C4.17487 8.74027 4.19281 8.84792 4.16291 8.91968L3.75028 9.89443C3.72038 9.96619 3.7144 10.0858 3.7443 10.1635L3.85792 10.4685C3.9536 10.7257 4.11507 10.9529 4.33035 11.1263L4.73101 11.4492C4.79081 11.4971 4.89846 11.515 4.97022 11.4791L6.23799 10.8752C6.30975 10.8393 6.41739 10.7675 6.47719 10.7137L7.38616 9.89443C7.51772 9.77483 7.5237 9.5715 7.4041 9.43994L5.49646 8.15423C5.43068 8.11237 5.40676 8.01669 5.44264 7.94493L6.27985 6.36619C6.31573 6.29443 6.32171 6.18081 6.29181 6.10904L6.19015 5.87582C6.16025 5.80406 6.07055 5.72034 5.99879 5.69044L3.54098 4.76951C3.46922 4.73961 3.46922 4.70971 3.54696 4.70373L5.13168 4.55423C5.20942 4.54825 5.335 4.56021 5.41274 4.57815L6.82404 4.97283C6.90178 4.99675 6.94962 5.07449 6.93766 5.15223L6.44729 7.83728C6.43533 7.91503 6.43533 8.02267 6.45327 8.08247C6.47121 8.14227 6.54895 8.19609 6.62669 8.21403L7.60743 8.42333C7.68517 8.44127 7.81075 8.44127 7.88849 8.42333L8.80344 8.21403C8.88118 8.19609 8.95892 8.13629 8.97686 8.08247C8.9948 8.02865 9.00078 7.91503 8.98284 7.83728L8.49846 5.15223C8.4865 5.07449 8.53434 4.99077 8.61208 4.97283L10.0234 4.57815C10.1011 4.55423 10.2267 4.54825 10.3044 4.55423L11.8892 4.70373C11.9669 4.70971 11.9729 4.73961 11.8951 4.76951L9.43733 5.7024C9.36556 5.7323 9.27586 5.81004 9.24596 5.88778L9.1443 6.121C9.1144 6.19277 9.1144 6.31237 9.15626 6.37815L9.99945 7.95689C10.0353 8.02865 10.0114 8.11835 9.94563 8.16619L8.03799 9.45788C7.91241 9.58346 7.92437 9.79277 8.05593 9.91237L8.9649 10.7316C9.0247 10.7855 9.13234 10.8572 9.2041 10.8871L10.4779 11.4911C10.5496 11.527 10.6573 11.509 10.7171 11.4612L11.1177 11.1323C11.333 10.9589 11.4945 10.7316 11.5842 10.4745L11.6978 10.1695C11.7277 10.0977 11.7217 9.97217 11.6918 9.90041L11.2792 8.92566C11.2493 8.8539 11.2672 8.74625 11.321 8.68645L13.3004 6.58147C13.3543 6.52167 13.438 6.42599 13.4918 6.36619C13.4799 6.34825 13.5875 6.21669 13.6234 6.07316Z" fill="white"/>
    </g>
    <defs>
      <linearGradient id="brave_paint0_linear" x1="0" y1="9.97772" x2="7.77564" y2="9.97772" gradientUnits="userSpaceOnUse">
        <stop stopColor="white"/>
        <stop offset="0.1413" stopColor="white" stopOpacity="0.958"/>
        <stop offset="1" stopColor="white" stopOpacity="0.7"/>
      </linearGradient>
      <linearGradient id="brave_paint1_linear" x1="7.68062" y1="9.79201" x2="15.3082" y2="9.79201" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F1F1F2"/>
        <stop offset="0.09191" stopColor="#E4E5E6"/>
        <stop offset="0.2357" stopColor="#D9DADB"/>
        <stop offset="0.438" stopColor="#D2D4D5"/>
        <stop offset="1" stopColor="#D0D2D3"/>
      </linearGradient>
      <clipPath id="brave_clip">
        <rect width="15.31" height="18" fill="white"/>
      </clipPath>
    </defs>
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
