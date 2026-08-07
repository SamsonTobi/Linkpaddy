import React from "react";
import {
  ArrowSquareOut,
  Shield,
  Key,
  ShareNetwork,
  Users,
} from "@phosphor-icons/react";

const STORE_URLS = {
  chrome:
    "https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn",
  edge:
    "https://microsoftedge.microsoft.com/addons/detail/linkpaddy/bmmebjoghmfijpdfgdmljffaanflbhdo?hl=en-US",
  brave:
    "https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn",
};

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header/Nav */}
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShareNetwork className="w-8 h-8 text-[#6C5CE7]" />
            <h1 className="text-2xl font-bold text-gray-900">LinkPaddy</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="#features"
              className="text-gray-600 hover:text-[#6C5CE7] transition-colors"
            >
              Features
            </a>
            <a
              href="/privacy.html"
              className="text-gray-600 hover:text-[#6C5CE7] transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#browsers"
              className="text-gray-600 hover:text-[#6C5CE7] transition-colors"
            >
              Get the extension
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-16 md:py-24 flex flex-col items-center text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#6C5CE7] to-purple-400">
            Share Links with Your Inner Circle
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mb-10">
            LinkPaddy is the easiest way to organize and share links with
            friends. Keep your favorite content accessible and shareable in one
            click.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#browsers"
              className="px-8 py-4 bg-[#6C5CE7] text-white rounded-full font-semibold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <ArrowSquareOut className="w-5 h-5" />
              Get LinkPaddy
            </a>
            <a
              href="/privacy.html"
              className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-full font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Privacy Policy
            </a>
          </div>
        </div>

        <section id="browsers" className="pb-16">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6C5CE7]">Choose your browser</p>
              <h3 className="mt-2 text-3xl font-bold text-gray-900">Install LinkPaddy where you browse</h3>
              <p className="mt-3 text-gray-600">LinkPaddy is available for Chrome, Microsoft Edge, and Brave.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { name: "Google Chrome", browser: "Chrome", url: STORE_URLS.chrome, accent: "border-blue-200 hover:border-blue-400" },
                { name: "Microsoft Edge", browser: "Edge", url: STORE_URLS.edge, accent: "border-cyan-200 hover:border-cyan-400" },
                { name: "Brave", browser: "Brave", url: STORE_URLS.brave, accent: "border-orange-200 hover:border-orange-400" },
              ].map((store) => (
                <a
                  key={store.browser}
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${store.accent}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Browser extension</p>
                      <h4 className="mt-1 text-lg font-bold text-gray-900">{store.name}</h4>
                    </div>
                    <ArrowSquareOut className="h-5 w-5 text-[#6C5CE7] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <span className="mt-6 inline-flex rounded-full bg-[#6C5CE7] px-4 py-2 text-sm font-semibold text-white">
                    Add to {store.browser}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 bg-gray-50 rounded-2xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#6C5CE7] bg-opacity-10 rounded-xl flex items-center justify-center mb-4 text-[#6C5CE7]">
                  <ShareNetwork className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Instant Sharing</h3>
                <p className="text-gray-600">
                  Share any link directly from your browser toolbar without
                  switching tabs.
                </p>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#6C5CE7] bg-opacity-10 rounded-xl flex items-center justify-center mb-4 text-[#6C5CE7]">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Friend Groups</h3>
                <p className="text-gray-600">
                  Create circles of friends to share specific content with the
                  right people.
                </p>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#6C5CE7] bg-opacity-10 rounded-xl flex items-center justify-center mb-4 text-[#6C5CE7]">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
                <p className="text-gray-600">
                  Your data is encrypted and only accessible to you and your
                  chosen friends.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-xl font-bold">LinkPaddy</span>
              <p className="text-gray-400 text-sm mt-1">
                © {new Date().getFullYear()} LinkPaddy. All rights reserved.
              </p>
            </div>
            <div className="flex gap-6">
              <a
                href="/privacy.html"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Privacy
              </a>
              <a
                href="mailto:support@linkpaddy.com"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
