import React, { useState } from "react";
import { useLocation } from "wouter";
import { useGetHistory, useClearHistory, useDeleteHistoryEntry, getGetHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, Music2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { WaveArt } from "@/components/WaveArt";
import { BottomNav } from "@/components/BottomNav";

export default function HistoryScreen() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  
  const qc = useQueryClient();
  const { data, isLoading } = useGetHistory();
  const clearAll = useClearHistory();
  const deleteEntry = useDeleteHistoryEntry();

  const handleClear = () => {
    if (window.confirm('Clear all search history?')) {
      clearAll.mutate(undefined, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        }
      });
    }
  };

  const filtered = (data || []).filter(e => 
    searchTerm === '' || 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    if (isThisWeek(d)) return "This Week";
    return "Older";
  };

  const grouped = filtered.reduce((acc, entry) => {
    const label = getGroupLabel(entry.searchedAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(entry);
    return acc;
  }, {} as Record<string, typeof filtered>);

  const groupKeys = ["Today", "Yesterday", "This Week", "Older"].filter(k => grouped[k] && grouped[k].length > 0);

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5] flex flex-col">
      <AnimatedBackground />

      <div className="pt-10 px-4 relative z-10">
        <div className="flex flex-row justify-between items-center">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">My History</h1>
          <button 
            onClick={handleClear} 
            className="text-sm text-[#8A8A88] cursor-pointer"
            data-testid="clear-all"
          >
            Clear All
          </button>
        </div>
        
        <div className="mt-4 glass-pill flex items-center gap-2 px-4 py-3">
          <Search size={16} className="text-[#8A8A88]" />
          <input
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#8A8A88] text-[#1A1A1A]"
            placeholder="Search history..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="history-search"
          />
        </div>
        <p className="text-xs text-center text-[#8A8A88] mt-2 px-4">
          Only song names saved. No audio or video stored.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 mt-3 relative z-10 no-scrollbar">
        {isLoading ? (
          <div className="space-y-3 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse h-20 rounded-2xl bg-[#EFEFED]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Music2 className="w-12 h-12 text-[#DDDDD9]" />
            <p className="text-[#8A8A88] text-sm">No songs yet</p>
          </div>
        ) : (
          groupKeys.map(label => (
            <div key={label}>
              <h2 className="text-xs uppercase tracking-wider text-[#8A8A88] font-medium mt-6 mb-2 ml-2">
                {label}
              </h2>
              {grouped[label].map(entry => (
                <motion.div
                  key={entry.id}
                  drag="x"
                  dragConstraints={{ left: -100, right: 0 }}
                  onDragEnd={(e, info) => {
                    if (info.offset.x < -80) {
                      deleteEntry.mutate(
                        { id: entry.id },
                        {
                          onSuccess: () => qc.invalidateQueries({ queryKey: getGetHistoryQueryKey() })
                        }
                      );
                    }
                  }}
                  className="mb-2 relative"
                  data-testid={'history-entry-' + entry.id}
                >
                  <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 bg-red-500 rounded-r-2xl w-full justify-end z-0">
                    <Trash2 className="text-white" />
                  </div>
                  
                  <div 
                    className="glass-card p-3 flex items-center gap-3 cursor-pointer relative z-10"
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
                  >
                    <WaveArt size="sm" isPlaying={false} />
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium text-sm text-[#1A1A1A] truncate">{entry.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[#8A8A88] truncate">{entry.artist}</p>
                        {entry.genre && (
                          <span className="glass-pill px-2 py-0.5 text-[10px] text-[#8A8A88]">
                            {entry.genre}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-right text-xs text-[#8A8A88] whitespace-nowrap pl-2">
                      {formatDistanceToNow(new Date(entry.searchedAt))}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
