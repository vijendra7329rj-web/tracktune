import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Play, Share2, Copy, ArrowLeft, Disc, Award } from 'lucide-react';

export default function ResultScreen({ params }) {
  const [song, setSong] = useState(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const data = sessionStorage.getItem('current_song');
    if (data) {
      setSong(JSON.parse(data));
    }
  }, [params.id]);

  const shareSong = async () => {
    if (navigator.share && song) {
      try {
        await navigator.share({
          title: `TrackTune - ${song.title}`,
          text: `Check out ${song.title} by ${song.artist}!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    }
  };

  const copyToClipboard = () => {
    if (song) {
      navigator.clipboard.writeText(`${song.title} by ${song.artist}`);
      // Simple fallback alert or feedback is handled by button scale/active styling
    }
  };

  if (!song) {
    return (
      <div className="min-h-screen bg-[#021110] flex flex-col items-center justify-center p-6">
        <Disc className="animate-spin text-[#13dfbf] mb-4" size={48} />
        <p className="text-gray-400 font-semibold tracking-wide">Loading Song Details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between pb-8">
      {/* Header */}
      <div className="w-full flex items-center p-6">
        <button 
          onClick={() => setLocation('/')} 
          className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 text-center font-bold text-gray-300 uppercase tracking-widest text-xs">
          Track Identified
        </div>
        <div className="w-11"></div>
      </div>

      {/* Main Track Info */}
      <div className="w-full px-6 flex flex-col items-center flex-1 justify-center mt-2">
        {/* Animated Disc Frame */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-[#13dfbf]/15 rounded-full blur-3xl group-hover:blur-4xl transition-all duration-700 animate-pulse-ring"></div>
          <div className="relative w-60 h-60 bg-gradient-to-br from-[#042826] to-[#010e0d] border-2 border-[#13dfbf]/30 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden transition-transform duration-500 hover:rotate-6">
            <Disc className="animate-[spin_8s_linear_infinite] text-[#13dfbf]" size={110} strokeWidth={1} />
            <div className="absolute w-16 h-16 bg-black border-4 border-[#021110] rounded-full flex items-center justify-center shadow-inner">
              <div className="w-4 h-4 bg-[#13dfbf] rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Text Details */}
        <div className="text-center px-4 max-w-sm">
          <div className="inline-flex items-center gap-1 bg-[#13dfbf]/10 border border-[#13dfbf]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#13dfbf] uppercase tracking-widest mb-4">
            <Award size={12} /> {song.confidence ? `${song.confidence}% Match` : 'High Confidence'}
          </div>
          <h1 className="text-2xl font-black text-white leading-tight mb-2 tracking-tight">
            {song.title}
          </h1>
          <p className="text-base text-gray-400 font-medium mb-8">
            {song.artist}
          </p>
        </div>

        {/* Media Player Connections */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <a 
            href={song.spotifyUrl} 
            target="_blank" 
            rel="noreferrer" 
            className="w-full bg-[#1db954] hover:bg-[#1ed760] hover:scale-[1.02] text-black font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(29,185,84,0.25)] transition-all duration-300 text-sm tracking-wide"
          >
            <Play fill="currentColor" size={16} /> Play on Spotify
          </a>
          <a 
            href={song.youtubeUrl} 
            target="_blank" 
            rel="noreferrer" 
            className="w-full bg-[#ff0033] hover:bg-[#ff2244] hover:scale-[1.02] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,0,51,0.25)] transition-all duration-300 text-sm tracking-wide"
          >
            <Play fill="currentColor" size={16} /> Play on YouTube
          </a>
        </div>
      </div>

      {/* Share / Copy Options */}
      <div className="flex gap-4 mt-8 w-full max-w-sm px-6">
        <button 
          onClick={shareSong} 
          className="flex-1 glass-pill py-4 flex items-center justify-center gap-2 text-xs font-bold text-[#13dfbf] uppercase tracking-wider cursor-pointer"
        >
          <Share2 size={14} /> Share
        </button>
        <button 
          onClick={copyToClipboard} 
          className="flex-1 glass-pill py-4 flex items-center justify-center gap-2 text-xs font-bold text-[#13dfbf] uppercase tracking-wider cursor-pointer"
        >
          <Copy size={14} /> Copy Info
        </button>
      </div>
    </div>
  );
}
