import React from "react";
import {
  ExternalLink,
  Shield,
  KeyRound,
  Globe,
  Share2,
  Users,
} from "lucide-react";

const LandingPage: React.FC = () => {
  const [downloadUrl, setDownloadUrl] = React.useState("https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn");
  const [browserName, setBrowserName] = React.useState("Chrome");

  React.useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes("edg/")) {
      setDownloadUrl("https://microsoftedge.microsoft.com/addons/detail/linkpaddy/bmmebjoghmfijpdfgdmljffaanflbhdo?hl=en-US");
      setBrowserName("Edge");
    } else {
      // Default to Chrome link provided
      setDownloadUrl("https://chromewebstore.google.com/detail/linkpaddy/kggogkkejjihfogcbjmpfpbagiglflnn");
      setBrowserName("Chrome");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header/Nav */}
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Share2 className="w-8 h-8 text-[#6C5CE7]" />
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
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#6C5CE7] transition-colors"
            >
              Store
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
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-[#6C5CE7] text-white rounded-full font-semibold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <ExternalLink className="w-5 h-5" />
              Add to {browserName}
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

        {/* Features Grid */}
        <section id="features" className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 bg-gray-50 rounded-2xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-[#6C5CE7] bg-opacity-10 rounded-xl flex items-center justify-center mb-4 text-[#6C5CE7]">
                  <Share2 className="w-6 h-6" />
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
                  <KeyRound className="w-6 h-6" />
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
