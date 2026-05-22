import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetSong, useIdentifySong } from "@workspace/api-client-react";
import { SiSpotify, SiYoutube } from "react-icons/si";
import { ArrowRight, Share2, Heart, Loader2 } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { WaveArt } from "@/components/WaveArt";
import { BottomNav } from "@/components/BottomNav";

export default function ResultScreen() {
  const [, params] = useRoute('/result/:id');
  const [, navigate] = useLocation();
  const id = Number(params?.id);

  const [storedSong, setStoredSong] = useState<any>(null);
  
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('current_song');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id === id) {
          setStoredSong(parsed);
        }
      }
    } catch(e) {}
  }, [id]);

  const { data: songData, isLoading } = useGetSong(id, { 
    query: { 
      enabled: !!id && !storedSong,
      queryKey: ["/api/songs", id] as const
    } 
  });

  const song = storedSong || songData;

  const [newUrl, setNewUrl] = useState("");
  const identifySong = useIdentifySong();

  const handleNewSearch = () => {
    if (!newUrl.trim()) return;
    identifySong.mutate(
      { data: { url: newUrl.trim() } },
      {
        onSuccess: (s) => {
          sessionStorage.setItem('current_song', JSON.stringify(s));
          navigate('/result/' + s.id);
          setNewUrl('');
        },
        onError: () => {
          alert('Failed to identify song.');
        }
      }
    );
  };

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5] flex flex-col">
      <AnimatedBackground />

      <div className="pt-10 px-4 text-center relative z-10">
        <div className="inline-flex glass-pill px-3 py-1 text-xs font-medium text-[#8A8A88] uppercase tracking-wider">
          MUSIC IDENTIFIED ✓
        </div>
        <h1 className="font-black text-4xl tracking-[-0.05em] uppercase text-[#1A1A1A] mt-2">
          SOUNDTRACE
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col items-center gap-4 relative z-10 no-scrollbar mt-4">
        {!song && isLoading ? (
          <div className="w-full flex flex-col items-center justify-center space-y-4 pt-10">
            <Loader2 className="animate-spin text-[#1A1A1A] w-10 h-10" />
            <p className="text-[#8A8A88] text-sm">Loading details...</p>
          </div>
        ) : !song ? (
          <div className="w-full text-center pt-20 text-[#8A8A88]">Song not found</div>
        ) : (
          <>
            <WaveArt size="lg" isPlaying={true} className="glass-card p-6" />
            
            <div className="w-full px-2">
              <h2 className="font-bold text-2xl text-center text-[#1A1A1A] truncate">{song.title}</h2>
              <p className="text-base text-[#8A8A88] text-center truncate mt-1">{song.artist}</p>
              
              <div className="flex gap-2 items-center flex-wrap justify-center mt-3">
                {song.album && <span className="text-xs text-[#8A8A88]">{song.album}</span>}
                {song.album && song.year && <span className="text-xs text-[#8A8A88]">·</span>}
                {song.year && <span className="text-xs text-[#8A8A88]">{song.year}</span>}
                {song.genre && (
                  <span className="glass-pill px-2 py-0.5 text-xs text-[#8A8A88] ml-1">
                    {song.genre}
                  </span>
                )}
              </div>
            </div>

            <button 
              className="glass-card w-full flex items-center gap-3 p-4 border-l-4 border-[#1DB954] cursor-pointer mt-2"
              onClick={() => window.open(song.spotifyUrl, '_blank')}
              data-testid="open-spotify"
            >
              <SiSpotify size={24} color="#1DB954" />
              <span className="font-semibold text-sm text-[#1A1A1A]">Open on Spotify</span>
            </button>

            <button 
              className="glass-card w-full flex items-center gap-3 p-4 border-l-4 border-[#FF0000] cursor-pointer"
              onClick={() => window.open(song.youtubeUrl, '_blank')}
              data-testid="open-youtube"
            >
              <SiYoutube size={24} color="#FF0000" />
              <span className="font-semibold text-sm text-[#1A1A1A]">Open on YouTube</span>
            </button>

            <div className="glass-pill w-full flex items-center pl-4 pr-2 py-2 gap-2 mt-2">
              <input
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#8A8A88] text-[#1A1A1A]"
                placeholder="Search another song or paste link..."
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleNewSearch(); }}
              />
              <button 
                className="bg-[#1A1A1A] text-white rounded-full p-2 cursor-pointer flex items-center justify-center"
                onClick={handleNewSearch}
                disabled={identifySong.isPending}
              >
                {identifySong.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight size={16} />}
              </button>
            </div>

            <div className="flex gap-2 w-full mt-2">
              <button 
                className="glass-card flex-1 flex items-center justify-center gap-2 py-3 px-4 cursor-pointer text-[#1A1A1A]"
                data-testid="share-button"
              >
                <Share2 size={16} />
                <span className="text-sm font-medium">Share</span>
              </button>
              <button 
                className="glass-card flex-1 flex items-center justify-center gap-2 py-3 px-4 cursor-pointer text-[#1A1A1A]"
                data-testid="save-button"
              >
                <Heart size={16} />
                <span className="text-sm font-medium">Save</span>
              </button>
            </div>

            <span 
              className="cursor-pointer text-sm text-[#8A8A88] text-center mt-2 pb-6 inline-block"
              onClick={() => navigate('/home')}
              data-testid="search-another"
            >
              ← Search Another
            </span>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
