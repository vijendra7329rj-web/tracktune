import React, { useState } from "react";
import { useLocation } from "wouter";
import { useGetTrending } from "@workspace/api-client-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { WaveArt } from "@/components/WaveArt";
import { BottomNav } from "@/components/BottomNav";

const genres = ['All', 'Bollywood', 'Punjabi', 'South', 'Pop', 'EDM'];
const regions = ['All India', 'North', 'South', 'West', 'East'];

export default function TrendingScreen() {
  const [, navigate] = useLocation();
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');

  const { data, isLoading } = useGetTrending({
    genre: selectedGenre === 'all' ? undefined : selectedGenre as any,
    region: selectedRegion === 'all' ? undefined : selectedRegion as any
  });

  const formatCount = (n: number) => {
    return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
  };

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5] flex flex-col">
      <AnimatedBackground />

      <div className="pt-10 px-0 relative z-10">
        <div className="flex flex-row items-center justify-between px-4">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">Trending In India</h1>
          <span className="glass-pill px-3 py-1 text-xs font-bold bg-[#1A1A1A] text-white">PRO</span>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 px-4 no-scrollbar">
          {genres.map(g => {
            const val = g.toLowerCase();
            const isActive = selectedGenre === val;
            return (
              <button
                key={g}
                onClick={() => setSelectedGenre(val)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isActive ? 'bg-[#1A1A1A] text-white' : 'glass-pill text-[#8A8A88]'
                }`}
                data-testid={`genre-${val}`}
              >
                {g}
              </button>
            );
          })}
        </div>
        
        <div className="mt-1 flex gap-2 overflow-x-auto pb-2 px-4 no-scrollbar">
          {regions.map(r => {
            const val = r.toLowerCase().replace(' ', '-');
            const isActive = selectedRegion === val;
            return (
              <button
                key={r}
                onClick={() => setSelectedRegion(val)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isActive ? 'bg-[#1A1A1A] text-white' : 'glass-pill text-[#8A8A88]'
                }`}
                data-testid={`region-${val}`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 mt-2 relative z-10 no-scrollbar">
        {isLoading ? (
          <div className="space-y-3 mt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse h-20 rounded-2xl bg-[#EFEFED]" />
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {data?.songs.map((entry, index) => {
              if (!data.isPremium && index >= 3) {
                if (index === 3) {
                  return (
                    <div key="upgrade" className="glass-card p-6 text-center mt-2 mb-3">
                      <h3 className="font-semibold text-[#1A1A1A] text-lg">
                        Upgrade to PRO to unlock all 50 songs
                      </h3>
                      <p className="text-sm text-[#8A8A88] mt-2">
                        ₹99/month · No Ads · Trending Dashboard
                      </p>
                      <button className="bg-[#1A1A1A] text-white rounded-full px-6 py-3 text-sm font-bold mt-5 cursor-pointer">
                        Upgrade Now
                      </button>
                    </div>
                  );
                }
                return null;
              }

              return (
                <div
                  key={entry.id}
                  className="glass-card p-4 flex items-center gap-3 cursor-pointer"
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
                      spotifyId: '',
                      youtubeId: '',
                      previewUrl: null
                    }));
                    navigate('/result/' + entry.id);
                  }}
                  data-testid={'trending-' + entry.id}
                >
                  <span className="text-2xl font-black text-[#DDDDD9] w-8 text-center">
                    {entry.rank}
                  </span>
                  <WaveArt size="sm" isPlaying={false} />
                  
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className="font-semibold text-sm text-[#1A1A1A] truncate">{entry.title}</p>
                    <p className="text-xs text-[#8A8A88] truncate">{entry.artist}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-sm text-[#1A1A1A]">#{formatCount(entry.searchCount)}</p>
                    <p className="text-xs text-green-600 font-medium mt-0.5">
                      ↑ +{entry.growthPercent}%
                    </p>
                    {entry.isViral && (
                      <span className="bg-[#FF6B35] text-white text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-1">
                        VIRAL
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {data && data.songs.length > 0 && (
          <p className="text-xs text-[#8A8A88] text-center py-6">
            Tap any song → Spotify + YouTube links
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
