import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="p-6 pt-12 text-[#f0f0f0]">
      <div className="flex items-center gap-3 mb-8">
        <a href="/" className="p-2 bg-[#13dfbf]/10 border border-[#13dfbf]/20 rounded-full text-[#13dfbf] hover:bg-[#13dfbf]/20 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </a>
        <h1 className="text-2xl font-black text-[#13dfbf] tracking-tight uppercase">Privacy Policy</h1>
      </div>

      <div className="space-y-6 text-sm text-gray-300 leading-relaxed bg-[#0c1e1c]/40 border border-[#13dfbf]/10 rounded-2xl p-6 backdrop-blur-xl">
        <p className="text-xs text-[#13dfbf] font-bold uppercase tracking-wider">Last Updated: May 2026</p>
        
        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">1. Information We Collect</h2>
          <p>
            TrackTune is a music utility tool. We do not require you to create an account or provide personal information such as your name, email address, or phone number.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>URLs Shared:</strong> We process public video URLs that you share to download audio samples for song identification.</li>
            <li><strong>Audio Recordings:</strong> When using "Listen Mode," we capture 8 seconds of audio via your microphone to create song fingerprints. These are immediately processed and never stored permanently on our servers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">2. How We Use Information</h2>
          <p>
            The shared data is solely used to identify the melody using ACRCloud fingerprinting technology and provide you with corresponding Spotify and YouTube links.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">3. Google AdSense & Cookies</h2>
          <p>
            We use Google AdSense to serve advertisements. Google, as a third-party vendor, uses cookies to serve ads on our site. Google's use of advertising cookies enables it and its partners to serve ads based on your visit to this site and/or other sites on the Internet.
          </p>
          <p className="mt-2">
            You may opt out of personalized advertising by visiting Google's Ads Settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">4. Third-Party Services</h2>
          <p>
            Our service utilizes third-party tools such as ACRCloud (music identification) and links to Spotify and YouTube. We are not responsible for the privacy practices of these third-party platforms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">5. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, you can reach out to us at: <span className="text-[#13dfbf] font-medium">support@tracktune.site</span>
          </p>
        </section>
      </div>
    </div>
  );
}
