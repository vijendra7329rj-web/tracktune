import React from 'react';

export default function TermsOfService() {
  return (
    <div className="p-6 pt-12 text-[#f0f0f0]">
      <div className="flex items-center gap-3 mb-8">
        <a href="/" className="p-2 bg-[#13dfbf]/10 border border-[#13dfbf]/20 rounded-full text-[#13dfbf] hover:bg-[#13dfbf]/20 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </a>
        <h1 className="text-2xl font-black text-[#13dfbf] tracking-tight uppercase">Terms of Service</h1>
      </div>

      <div className="space-y-6 text-sm text-gray-300 leading-relaxed bg-[#0c1e1c]/40 border border-[#13dfbf]/10 rounded-2xl p-6 backdrop-blur-xl">
        <p className="text-xs text-[#13dfbf] font-bold uppercase tracking-wider">Last Updated: May 2026</p>
        
        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">1. Agreement to Terms</h2>
          <p>
            By accessing or using TrackTune, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">2. Description of Service</h2>
          <p>
            TrackTune is a free utility tool that allows content creators to identify music from public video links (Instagram, YouTube, etc.) or surrounding audio captures and provides quick access links to Spotify and YouTube.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">3. Acceptable Use Policy</h2>
          <p>
            You agree to use TrackTune only for lawful, personal, and non-commercial purposes. You are solely responsible for any URLs you submit.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You must not use our service to download copyright-restricted media for unauthorized distribution.</li>
            <li>You must not attempt to scrape or disrupt the performance of our application servers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">4. Disclaimer of Warranties</h2>
          <p>
            TrackTune is provided "as is" and "as available". We do not warrant that the song identification will be 100% accurate, error-free, or uninterrupted. Song recognition is powered by the ACRCloud catalog.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">5. Limitation of Liability</h2>
          <p>
            In no event shall TrackTune, its developers, or its suppliers be liable for any damages arising out of the use or inability to use the service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-[#13dfbf] mb-2">6. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms of Service at any time. Your continued use of the app after modifications constitutes acceptance of the new terms.
          </p>
        </section>
      </div>
    </div>
  );
}
