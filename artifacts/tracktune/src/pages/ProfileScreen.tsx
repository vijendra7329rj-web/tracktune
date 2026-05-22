import React, { useState } from "react";
import { useLocation } from "wouter";
import { useClearHistory, getGetHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SiSpotify, SiYoutube } from "react-icons/si";
import { ChevronRight, Bell, BarChart2, Trash2, FileText, MessageCircle, LogOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BottomNav } from "@/components/BottomNav";

export default function ProfileScreen() {
  const [, navigate] = useLocation();
  const [notifEnabled, setNotifEnabled] = useState(true);
  
  const clearAll = useClearHistory();
  const qc = useQueryClient();

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5] flex flex-col">
      <AnimatedBackground />

      <div className="pt-10 px-4 text-center relative z-10">
        <h1 className="font-black text-4xl tracking-[-0.05em] uppercase text-[#1A1A1A]">
          SOUNDTRACE
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 relative z-10 no-scrollbar">
        <div className="mt-6 mx-auto w-20 h-20 rounded-full glass-card flex items-center justify-center">
          <span className="font-black text-2xl text-[#1A1A1A]">CR</span>
        </div>
        
        <h2 className="font-bold text-xl text-center mt-4 text-[#1A1A1A]">Creator</h2>
        <p className="text-sm text-[#8A8A88] text-center mt-1">creator@soundtrace.app</p>
        
        <div className="flex justify-center mt-2">
          <span className="glass-pill px-3 py-1 text-xs font-medium text-[#8A8A88]">FREE</span>
        </div>

        <div className="glass-card mt-6 p-5 text-center">
          <h3 className="font-bold text-lg text-[#1A1A1A]">Go Premium</h3>
          <p className="text-sm text-[#8A8A88] mt-1">₹99/month · No Ads · Unlimited Searches</p>
          <button 
            className="bg-[#1A1A1A] text-white py-3 rounded-full w-full font-bold mt-4 text-sm cursor-pointer"
            data-testid="upgrade-btn"
          >
            Start Free Trial
          </button>
        </div>

        <div className="text-xs uppercase tracking-wider text-[#8A8A88] font-medium mt-6 mb-2 ml-2">
          LINKED ACCOUNTS
        </div>
        
        <div className="glass-card mb-2 p-4 flex items-center gap-3 cursor-pointer">
          <SiSpotify size={20} color="#1DB954" />
          <span className="font-medium text-sm flex-1 text-[#1A1A1A]">Link Spotify Account</span>
          <ChevronRight size={16} className="text-[#8A8A88]" />
        </div>
        <div className="glass-card mb-2 p-4 flex items-center gap-3 cursor-pointer">
          <SiYoutube size={20} color="#FF0000" />
          <span className="font-medium text-sm flex-1 text-[#1A1A1A]">Link YouTube Account</span>
          <ChevronRight size={16} className="text-[#8A8A88]" />
        </div>

        <div className="text-xs uppercase tracking-wider text-[#8A8A88] font-medium mt-6 mb-2 ml-2">
          SETTINGS
        </div>

        <div className="glass-card mb-2 p-4 flex items-center gap-3">
          <Bell size={16} className="text-[#8A8A88]" />
          <span className="text-sm flex-1 text-[#1A1A1A]">Weekly Trend Reports</span>
          <Switch checked={notifEnabled} onCheckedChange={setNotifEnabled} />
        </div>

        <div className="glass-card mb-2 p-4 flex items-center gap-3">
          <BarChart2 size={16} className="text-[#8A8A88]" />
          <span className="text-sm flex-1 text-[#1A1A1A]">Daily Searches</span>
          <span className="text-xs text-[#8A8A88]">3 / 5</span>
        </div>

        <div className="glass-card mb-2 p-4 flex items-center gap-3">
          <Trash2 size={16} className="text-red-500" />
          <button 
            className="text-red-500 text-sm flex-1 text-left cursor-pointer"
            onClick={() => {
              if (window.confirm('Clear history?')) {
                clearAll.mutate(undefined, {
                  onSuccess: () => qc.invalidateQueries({ queryKey: getGetHistoryQueryKey() })
                });
              }
            }}
          >
            Clear History
          </button>
        </div>

        <div className="glass-card mb-2 p-4 flex items-center gap-3 cursor-pointer">
          <FileText size={16} className="text-[#8A8A88]" />
          <span className="text-sm flex-1 text-[#1A1A1A]">Privacy Policy</span>
        </div>
        
        <div className="glass-card mb-2 p-4 flex items-center gap-3 cursor-pointer">
          <FileText size={16} className="text-[#8A8A88]" />
          <span className="text-sm flex-1 text-[#1A1A1A]">Terms of Service</span>
        </div>
        
        <div className="glass-card mb-2 p-4 flex items-center gap-3 cursor-pointer">
          <MessageCircle size={16} className="text-[#8A8A88]" />
          <span className="text-sm flex-1 text-[#1A1A1A]">Contact / Feedback</span>
        </div>

        <p className="text-xs text-[#8A8A88] text-center mt-6">v1.0.0</p>

        <button 
          className="mt-4 glass-pill w-full flex items-center justify-center gap-2 py-4 cursor-pointer text-[#1A1A1A] mb-8"
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            navigate('/');
          }}
          data-testid="logout"
        >
          <LogOut size={16} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
