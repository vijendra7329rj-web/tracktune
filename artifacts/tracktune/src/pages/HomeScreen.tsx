import React, { useState } from "react";
import { useLocation } from "wouter";
import { useIdentifySong, useGetHistory } from "@workspace/api-client-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { WaveArt } from "@/components/WaveArt";
import { BottomNav } from "@/components/BottomNav";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function HomeScreen() {
  const [, navigate] = useLocation();
  const [url, setUrl] = useState("");
  const identifySong = useIdentifySong();
  const { data: historyData, isLoading: historyLoading } = useGetHistory();

  const handleIdentify = () => {
    if (!url.trim()) return;
    identifySong.mutate(
      { data: { url: url.trim() } },
      {
        onSuccess: (song) => {
          sessionStorage.setItem('current_song', JSON.stringify(song));
          navigate('/result/' + song.id);
          setUrl('');
        },
        onError: () => {
          alert('Failed to identify song. Please try again.');
        }
      }
    );
  };

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5] flex flex-col">
      <AnimatedBackground />

      <div className="pt-12 pb-4 px-6 text-center relative z-10">
        <h1 className="font-black text-4xl tracking-[-0.05em] uppercase text-[#1A1A1A]">
          SOUNDTRACE
        </h1>
        <p className="text-sm text-[#8A8A88] mt-1">Hey Creator!</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 relative z-10 no-scrollbar">
        <div className="glass-card mt-4 p-6 text-center">
          <WaveArt size="lg" isPlaying={true} className="mx-auto mb-4" />
          <h2 className="font-bold text-lg text-[#1A1A1A]">
            Share a Reel to Identify Music
          </h2>
          <p className="text-xs text-[#8A8A88] uppercase tracking-wider mt-2">
            Instagram • YouTube • Facebook • Any App
          </p>
        </div>

        <div className="glass-pill mt-4 flex items-center gap-2 pl-4 pr-2 py-2">
          <input
            className="flex-1 bg-transparent outline-none text-sm text-[#1A1A1A] placeholder:text-[#8A8A88]"
            placeholder="Or paste video link here..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleIdentify();
            }}
            data-testid="paste-url-input"
          />
          {identifySong.isPending ? (
            <Loader2 className="animate-spin text-[#1A1A1A] w-5 h-5 mr-2" />
          ) : (
            <button
              onClick={handleIdentify}
              className="bg-[#1A1A1A] text-white text-xs font-bold px-4 py-2 rounded-full cursor-pointer"
              data-testid="go-button"
            >
              GO
            </button>
          )}
        </div>

        <div className="mt-6">
          <div className="flex flex-row justify-between items-center">
            <h3 className="font-semibold text-sm text-[#1A1A1A]">Recent</h3>
            <span
              className="cursor-pointer text-xs text-[#8A8A88]"
              onClick={() => navigate('/history')}
            >
              See All →
            </span>
          </div>

          {historyLoading ? (
            <div className="mt-2 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-16 rounded-2xl bg-[#EFEFED]" />
              ))}
            </div>
          ) : (
            <div className="mt-2">
              {(historyData || []).slice(0, 3).map(entry => (
                <div
                  key={entry.id}
                  className="glass-card mb-2 p-3 flex items-center gap-3 cursor-pointer"
                  onClick={() => {
                    sessionStorage.setItem('current_song', JSON.stringify({
                      id: entry.id,
                      title: entry.title,
                      artist: entry.artist,
                      genre: entry.genre,
                      spotifyUrl: entry.spotifyUrl,
                      youtubeUrl: entry.youtubeUrl,
                      album: '',
                      year: 2024,
                      spotifyId: entry.spotifyId || '',
                      youtubeId: entry.youtubeId || '',
                      previewUrl: null
                    }));
                    navigate('/result/' + entry.id);
                  }}
                  data-testid={'recent-song-' + entry.id}
                >
                  <WaveArt size="sm" isPlaying={false} />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-[#1A1A1A] truncate">{entry.title}</p>
                    <p className="text-xs text-[#8A8A88] truncate">{entry.artist}</p>
                  </div>
                  <span className="text-xs text-[#8A8A88] whitespace-nowrap">
                    {formatDistanceToNow(new Date(entry.searchedAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
