import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { identifySong } from '../api';
import { Music, Search, Share2, Loader2, Video } from 'lucide-react';

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const handleSearch = async (searchUrl) => {
    const targetUrl = searchUrl || url;
    if (!targetUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await identifySong(targetUrl);
      sessionStorage.setItem('current_song', JSON.stringify(data));
      setLocation(/result/ + data.id);
    } catch (err) {
      setError("We couldn't identify a song in this video. Please try another one.");
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pt-12 min-h-screen flex flex-col items-center">
      <div className="mb-12 mt-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
          <Music size={32} color="white" />
        </div>
        <h1 className="text-3xl font-black text-center mb-2 tracking-tight">Share any video to TrackTune</h1>
        <p className="text-gray-400 text-center text-sm px-4">
          Open Instagram, YouTube, or TikTok ? Tap Share ? Choose TrackTune
        </p>
      </div>

      <div className="w-full glass-card p-6 mb-8 relative z-20">
        <div className="flex items-center gap-3 mb-4 text-sm font-semibold text-gray-300 uppercase tracking-wider">
          <Share2 size={16} /> Native Share
        </div>
        <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-400 mb-6 border border-white/10">
          The best way to use TrackTune is directly from your social media apps. Just use the native share button and pick our app.
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
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        
        <button
          onClick={() => handleSearch()}
          disabled={!url || loading}
          className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
             <><Loader2 className="animate-spin" size={20} /> Analyzing Audio...</>
          ) : (
            <><Search size={20} /> Identify Song</>
          )}
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
