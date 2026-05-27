import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { identifySong } from '../api';
import { Search, Share2, Video, Sparkles } from 'lucide-react';

const searchMessages = [
  "Got it! Opening our ears... 🎧",
  "Listening to your music... 🎵",
  "Looking for the exact song... 🔍",
  "Analyzing audio frequencies... ⚡",
  "Matching with millions of tracks... 🌐",
  "Almost there! Pulling details... ✨"
];

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check for shared URL from Web Share Target API
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('shared_url') || params.get('url');
    const sharedText = params.get('text') || '';
    
    // Extract URL if it's within text
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = sharedText.match(urlRegex);
    const candidateUrl = sharedUrl || (matches ? matches[0] : null);
    
    if (candidateUrl) {
      setUrl(candidateUrl);
      handleSearch(candidateUrl);
    }
  }, []);

  // Cycle messages sequentially during search
  useEffect(() => {
    if (!loading) {
      setMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % searchMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSearch = async (searchUrl) => {
    const targetUrl = searchUrl || url;
    if (!targetUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await identifySong(targetUrl);
      sessionStorage.setItem('current_song', JSON.stringify(data));
      setLocation(`/result/${data.id}`);
    } catch (err) {
      setError(err.message || "We couldn't identify a song in this video. Please try another one.");
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen flex flex-col items-center justify-between relative overflow-hidden">
      {/* Dynamic Search Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#021110]/95 z-50 flex flex-col items-center justify-center p-6 transition-all duration-500">
          <div className="relative mb-12 flex items-center justify-center">
            {/* Glowing outer scanning rings */}
            <div className="absolute w-44 h-44 rounded-full border border-[#13dfbf]/20 animate-ping duration-1000"></div>
            <div className="absolute w-36 h-36 rounded-full border border-[#13dfbf]/40 animate-pulse-ring"></div>
            
            {/* Main Glowing Logo Frame */}
            <div className="relative w-28 h-28 bg-[#042322] border-2 border-[#13dfbf] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(19,223,191,0.4)] flex items-center justify-center p-1 animate-float">
              <img src="/logo.jpg" alt="TrackTune Logo" className="w-full h-full object-cover rounded-2xl" />
            </div>
            
            {/* Liquid scanner line overlay */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#13dfbf] to-transparent w-full animate-bounce mt-14"></div>
          </div>

          <div className="text-center max-w-sm px-4">
            <h2 className="text-[#13dfbf] text-xl font-bold flex items-center justify-center gap-2 mb-3 tracking-wide">
              <Sparkles size={18} className="animate-spin duration-3000" /> TrackTune Active
            </h2>
            <div className="h-10 flex items-center justify-center">
              <p className="text-white text-base font-semibold animate-pulse tracking-wide transition-all duration-300">
                {searchMessages[messageIndex]}
              </p>
            </div>
            <div className="w-48 bg-white/5 h-1 rounded-full overflow-hidden mx-auto mt-6 border border-white/10">
              <div className="h-full bg-gradient-to-r from-[#00c0a9] to-[#13dfbf] rounded-full animate-[shimmer_2s_infinite]" style={{ width: '80%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Main Contents */}
      <div className="w-full flex-1 flex flex-col items-center justify-center">
        {/* Header with Custom Logo */}
        <div className="mb-10 mt-6 flex flex-col items-center">
          <div className="relative group mb-6">
            <div className="absolute inset-0 bg-[#13dfbf]/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
            <div className="relative w-28 h-28 bg-[#042322]/80 border-2 border-[#13dfbf]/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(19,223,191,0.15)] flex items-center justify-center p-1 transition-transform duration-500 hover:scale-105">
              <img src="/logo.jpg" alt="TrackTune Logo" className="w-full h-full object-cover rounded-2xl" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-center mb-2 tracking-tight text-white">
            Share to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#13dfbf] to-[#00c0a9]">TrackTune</span>
          </h1>
          <p className="text-gray-400 text-center text-sm px-4">
            Open Instagram, YouTube, or TikTok • Tap Share • Choose TrackTune
          </p>
        </div>

        {/* Input Card */}
        <div className="w-full glass-card p-6 mb-8 relative z-20">
          <div className="flex items-center gap-3 mb-4 text-xs font-bold text-[#13dfbf] uppercase tracking-widest">
            <Share2 size={14} /> Direct Share Feature
          </div>
          <div className="bg-[#031d1c]/40 rounded-xl p-4 text-xs text-gray-400 mb-6 border border-[#13dfbf]/10 leading-relaxed">
            The best way to use TrackTune is directly from your social apps. Just tap the share button inside Instagram or YouTube and pick our app.
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Video size={18} className="text-gray-500" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Or paste a video link manually..."
              className="w-full bg-black/30 border border-[#13dfbf]/20 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#13dfbf] focus:ring-2 focus:ring-[#13dfbf]/10 transition-all text-sm"
            />
          </div>
          
          <button
            onClick={() => handleSearch()}
            disabled={!url || loading}
            className="w-full mt-4 bg-gradient-to-r from-[#00c0a9] to-[#13dfbf] hover:from-[#13dfbf] hover:to-[#00c0a9] text-black font-extrabold py-4 rounded-2xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-wide"
          >
            <Search size={18} /> Identify Song
          </button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
