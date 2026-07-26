import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Share2, Copy, ArrowLeft, Film, Award, MapPin } from 'lucide-react';

const getSourceStyles = (name) => {
  const normalized = name.toLowerCase();
  if (normalized.includes('netflix')) {
    return { bg: 'bg-[#e50914] hover:bg-[#ff1e2d] text-white', icon: '🎬' };
  }
  if (normalized.includes('prime')) {
    return { bg: 'bg-[#00a8e1] hover:bg-[#1bbdff] text-white', icon: '🍿' };
  }
  if (normalized.includes('disney') || normalized.includes('hotstar')) {
    return { bg: 'bg-[#0063e5] hover:bg-[#1a7cff] text-white', icon: '✨' };
  }
  if (normalized.includes('apple')) {
    return { bg: 'bg-[#000000] hover:bg-[#222] border border-white/20 text-white', icon: '🍎' };
  }
  if (normalized.includes('jio')) {
    return { bg: 'bg-[#d11a7c] hover:bg-[#e22f8d] text-white', icon: '📺' };
  }
  if (normalized.includes('zee')) {
    return { bg: 'bg-[#8230c6] hover:bg-[#9745db] text-white', icon: '⚡' };
  }
  if (normalized.includes('sony')) {
    return { bg: 'bg-[#1e293b] hover:bg-[#334155] border border-yellow-500/30 text-yellow-500', icon: '🏆' };
  }
  return { bg: 'bg-white/10 hover:bg-white/20 text-white', icon: '🔗' };
};

export default function MovieResultScreen({ params }) {
  const [movie, setMovie] = useState(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const data = sessionStorage.getItem('current_movie');
    if (data) {
      const parsedMovie = JSON.parse(data);
      setMovie(parsedMovie);
      document.title = `Movie Identified: ${parsedMovie.title} (${parsedMovie.year}) | TrackTune`;
    }
  }, [params.id]);

  const shareMovie = async () => {
    if (navigator.share && movie) {
      try {
        await navigator.share({
          title: `TrackTune - ${movie.title}`,
          text: `Check out ${movie.title} (${movie.year}) identified on TrackTune!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    }
  };

  const copyToClipboard = () => {
    if (movie) {
      navigator.clipboard.writeText(`${movie.title} (${movie.year})`);
    }
  };

  if (!movie) {
    return (
      <div className="min-h-screen bg-[#021110] flex flex-col items-center justify-center p-6">
        <Film className="animate-pulse text-[#13dfbf] mb-4" size={48} />
        <p className="text-gray-400 font-semibold tracking-wide">Loading Movie Details...</p>
      </div>
    );
  }

  const streamingLinks = movie.watchLinks || [];

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
          Movie Scene Identified
        </div>
        <div className="w-11"></div>
      </div>

      {/* Main Movie Info */}
      <div className="w-full px-6 flex flex-col items-center flex-1 justify-center mt-2 max-w-md">
        {/* Poster Frame */}
        <div className="relative mb-6 group">
          <div className="absolute inset-0 bg-[#13dfbf]/10 rounded-2xl blur-2xl group-hover:blur-3xl transition-all duration-700"></div>
          <div className="relative w-48 h-72 bg-gradient-to-br from-[#042826] to-[#010e0d] border border-[#13dfbf]/20 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-500 hover:scale-[1.02] flex items-center justify-center">
            {movie.posterUrl ? (
              <img 
                src={movie.posterUrl} 
                alt={movie.title} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Film size={48} strokeWidth={1} />
                <span className="text-[10px] uppercase font-bold tracking-widest">No Poster Available</span>
              </div>
            )}
          </div>
        </div>

        {/* Text Details */}
        <div className="text-center px-4 mb-6">
          <div className="inline-flex items-center gap-1 bg-[#13dfbf]/10 border border-[#13dfbf]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#13dfbf] uppercase tracking-widest mb-3">
            <Award size={12} /> AI Scene Match
          </div>
          <h1 className="text-2xl font-black text-white leading-tight mb-1.5 tracking-tight">
            {movie.title}
          </h1>
          <p className="text-xs text-gray-400 font-bold mb-3">
            Year: {movie.year} • {movie.genre}
          </p>
          <p className="text-xs text-gray-300 leading-relaxed max-w-sm bg-white/5 border border-white/10 rounded-xl p-3 text-left">
            {movie.overview}
          </p>
        </div>

        {/* Streaming Platforms Title */}
        <div className="w-full text-left mb-3 flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          <MapPin size={12} className="text-[#13dfbf]" /> Available to Watch In India
        </div>

        {/* Streaming Platform Connections */}
        <div className="w-full flex flex-col gap-2.5">
          {streamingLinks.length > 0 ? (
            streamingLinks.map((source, i) => {
              const styles = getSourceStyles(source.name);
              return (
                <a 
                  key={i}
                  href={source.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-extrabold shadow-md transition-all duration-300 text-xs tracking-wider uppercase ${styles.bg}`}
                >
                  <span className="text-base">{styles.icon}</span> Play on {source.name} ({source.type === 'sub' ? 'Subscription' : 'Rent/Buy'})
                </a>
              );
            })
          ) : (
            <div className="w-full p-4 rounded-2xl border border-dashed border-[#13dfbf]/20 bg-[#0c1e1c]/20 text-center text-xs text-gray-400">
              Not currently streaming on popular subscription platforms. Try searching on YouTube or Renting from Apple TV.
            </div>
          )}
        </div>
      </div>

      {/* Share / Copy Options */}
      <div className="flex gap-4 mt-6 w-full max-w-md px-6">
        <button 
          onClick={shareMovie} 
          className="flex-1 glass-pill py-3.5 flex items-center justify-center gap-2 text-[10px] font-bold text-[#13dfbf] uppercase tracking-wider cursor-pointer"
        >
          <Share2 size={12} /> Share
        </button>
        <button 
          onClick={copyToClipboard} 
          className="flex-1 glass-pill py-3.5 flex items-center justify-center gap-2 text-[10px] font-bold text-[#13dfbf] uppercase tracking-wider cursor-pointer"
        >
          <Copy size={12} /> Copy Info
        </button>
      </div>
    </div>
  );
}
