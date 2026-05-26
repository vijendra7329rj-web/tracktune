import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Play, Share2, Copy, ArrowLeft } from 'lucide-react';

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
          title: TrackTune - \,
          text: Check out \ by \!,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    }
  };

  if (!song) return <div className="p-6 pt-24 text-center">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col items-center">
      <div className="w-full flex items-center p-6">
        <button onClick={() => setLocation('/')} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 text-center font-bold text-gray-300">Result</div>
        <div className="w-9"></div>
      </div>

      <div className="w-full px-6 flex flex-col items-center mt-4">
        <div className="w-64 h-64 bg-gradient-to-br from-gray-800 to-black rounded-3xl mb-8 shadow-2xl border border-white/10 flex items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614113489855-66422ad300a4?w=500&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
          <MusicIcon />
        </div>

        <h1 className="text-3xl font-black text-center mb-1 leading-tight">{song.title}</h1>
        <p className="text-lg text-gray-400 mb-8">{song.artist}</p>

        <div className="w-full flex flex-col gap-3">
          <a href={song.spotifyUrl} target="_blank" rel="noreferrer" className="w-full bg-[#1db954] hover:bg-[#1ed760] text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(29,185,84,0.3)] transition-all">
            <Play fill="currentColor" size={20} /> Play on Spotify
          </a>
          <a href={song.youtubeUrl} target="_blank" rel="noreferrer" className="w-full bg-[#ff0033] hover:bg-[#ff3355] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,0,51,0.3)] transition-all">
            <Play fill="currentColor" size={20} /> Play on YouTube
          </a>
        </div>

        <div className="flex gap-4 mt-8">
          <button onClick={shareSong} className="glass-pill px-6 py-3 flex items-center gap-2 text-sm font-semibold">
            <Share2 size={16} /> Share
          </button>
          <button onClick={() => {navigator.clipboard.writeText(\ by \)}} className="glass-pill px-6 py-3 flex items-center gap-2 text-sm font-semibold">
            <Copy size={16} /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}

function MusicIcon() {
  return <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>;
}
