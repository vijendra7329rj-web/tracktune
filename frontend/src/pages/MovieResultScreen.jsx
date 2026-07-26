import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Share2, Copy, ArrowLeft, Film, Award, MapPin, Sparkles, Clock, Play } from 'lucide-react';

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

const getEmbedUrl = (url) => {
  if (!url) return null;
  if (url.includes('youtube.com/embed/')) return url;
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return null;
};

export default function MovieResultScreen({ params }) {
  const [movie, setMovie] = useState(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Add body class for theme transition
    document.body.classList.add('theme-movie');
    
    const data = sessionStorage.getItem('current_movie');
    if (data) {
      const parsedMovie = JSON.parse(data);
      setMovie(parsedMovie);
      document.title = `Movie Identified: ${parsedMovie.title} (${parsedMovie.year}) | TrackTune`;
    }

    return () => {
      document.body.classList.remove('theme-movie');
    };
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
      <div className="min-h-screen bg-[#090414] flex flex-col items-center justify-center p-6">
        <Film className="animate-pulse text-[#c084fc] mb-4" size={48} />
        <p className="text-gray-400 font-semibold tracking-wide">Loading Movie Details...</p>
      </div>
    );
  }

  const streamingLinks = movie.watchLinks || [];
  const embedTrailerUrl = getEmbedUrl(movie.trailerUrl);

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[#f0f0f0] overflow-x-hidden font-sans pb-10 relative select-none transition-colors duration-700">
      
      {/* Dynamic Movie Backdrop Banner */}
      {movie.backdropUrl && (
        <div className="absolute top-0 left-0 w-full h-[240px] z-0 overflow-hidden">
          <img src={movie.backdropUrl} alt="" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--theme-bg)] via-[var(--theme-bg)]/80 to-transparent"></div>
        </div>
      )}

      {/* Liquid Gooey Morphic Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 liquid-container opacity-20">
          <div className="absolute top-[15%] left-[10%] w-[250px] h-[250px] rounded-full bg-[var(--theme-primary)] blur-[25px] animate-blob transition-colors duration-700"></div>
          <div className="absolute bottom-[20%] right-[10%] w-[280px] h-[280px] rounded-full bg-[var(--theme-deep)] blur-[25px] animate-blob animation-delay-2000 transition-colors duration-700"></div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-between pb-8">
        
        {/* Header */}
        <div className="w-full flex items-center p-6 z-20">
          <button 
            onClick={() => setLocation('/')} 
            className="p-3 rounded-full bg-black/40 border border-white/10 hover:bg-black/60 text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 text-center font-bold text-gray-300 uppercase tracking-widest text-xs">
            Movie Identified
          </div>
          <div className="w-11"></div>
        </div>

        {/* Main Content Area */}
        <div className="w-full px-6 flex flex-col items-center flex-1 justify-center mt-2 max-w-md">
          
          {/* Movie Poster */}
          <div className="relative mb-5 group z-20">
            <div className="absolute inset-0 bg-[var(--theme-primary)]/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-700"></div>
            <div className="relative w-40 h-60 bg-gradient-to-br from-[#150a24] to-[#090414] border border-[var(--theme-primary)]/20 rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.6)] overflow-hidden transition-transform duration-500 hover:scale-[1.02] flex items-center justify-center">
              {movie.posterUrl ? (
                <img 
                  src={movie.posterUrl} 
                  alt={movie.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Film size={48} strokeWidth={1} />
                  <span className="text-[10px] uppercase font-bold tracking-widest">No Poster</span>
                </div>
              )}
            </div>
          </div>

          {/* Text Description & Metadata */}
          <div className="text-center px-2 mb-4 z-20">
            
            {/* dynamic match quality badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-3">
              {movie.confidence !== undefined && movie.confidence > 0 && (
                <div className="inline-flex items-center gap-1 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20 px-3 py-1 rounded-full text-[10px] font-extrabold text-[var(--theme-primary)] uppercase tracking-wider">
                  <Sparkles size={11} className="animate-pulse" /> {movie.confidence}% Match
                </div>
              )}
              {movie.sceneTimestamp && movie.sceneTimestamp !== "Unknown" && movie.sceneTimestamp !== "0" && (
                <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] font-extrabold text-gray-300 uppercase tracking-wider">
                  <Clock size={11} className="text-[var(--theme-primary)]" /> Scene: {movie.sceneTimestamp}
                </div>
              )}
            </div>

            <h1 className="text-2xl font-black text-white leading-tight mb-1 tracking-tight">
              {movie.title}
            </h1>
            <p className="text-xs text-gray-400 font-bold mb-4">
              Year: {movie.year} • {movie.genre}
            </p>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm bg-black/25 border border-white/5 rounded-2xl p-4 text-left backdrop-blur-md">
              {movie.overview}
            </p>
          </div>

          {/* Embedded YouTube Trailer */}
          {embedTrailerUrl && (
            <div className="w-full mt-4 mb-6 bg-black/30 border border-[var(--theme-primary)]/15 rounded-3xl p-1.5 backdrop-blur-xl relative z-20 text-center shadow-lg">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/5">
                <iframe
                  src={embedTrailerUrl}
                  title={`${movie.title} Trailer`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="pt-2 pb-1 text-[9px] text-gray-400 font-extrabold uppercase tracking-widest flex items-center justify-center gap-1">
                <Play size={10} className="text-[var(--theme-primary)] fill-[var(--theme-primary)]" /> Official Movie Trailer
              </div>
            </div>
          )}

          {/* Streaming OTT Platforms */}
          <div className="w-full text-left mb-3 flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest z-20">
            <MapPin size={12} className="text-[var(--theme-primary)]" /> Available to Watch In India
          </div>

          <div className="w-full flex flex-col gap-2.5 z-20">
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
              <div className="w-full p-4 rounded-2xl border border-dashed border-[var(--theme-primary)]/20 bg-black/10 text-center text-xs text-gray-400">
                Not currently streaming on popular subscription platforms. Try Renting from Apple TV or searching on YouTube.
              </div>
            )}
          </div>

        </div>

        {/* Share / Copy Options */}
        <div className="flex gap-4 mt-6 w-full max-w-md px-6 z-20">
          <button 
            onClick={shareMovie} 
            className="flex-1 glass-pill py-3.5 flex items-center justify-center gap-2 text-[10px] font-bold text-[var(--theme-primary)] uppercase tracking-wider cursor-pointer border border-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/5 transition-all"
          >
            <Share2 size={12} /> Share
          </button>
          <button 
            onClick={copyToClipboard} 
            className="flex-1 glass-pill py-3.5 flex items-center justify-center gap-2 text-[10px] font-bold text-[var(--theme-primary)] uppercase tracking-wider cursor-pointer border border-[var(--theme-primary)]/20 hover:bg-[var(--theme-primary)]/5 transition-all"
          >
            <Copy size={12} /> Copy Info
          </button>
        </div>

      </div>
    </div>
  );
}
