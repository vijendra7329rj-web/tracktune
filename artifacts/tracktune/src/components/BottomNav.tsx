import React from "react";
import { useLocation } from "wouter";
import { Home, Flame, Clock, User } from "lucide-react";

export function BottomNav() {
  const [location, navigate] = useLocation();

  const tabs = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/trending', icon: Flame, label: 'Trending' },
    { path: '/history', icon: Clock, label: 'History' },
    { path: '/profile', icon: User, label: 'Me' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-[430px] mx-auto px-4 pb-6 pt-2 pointer-events-auto">
        <div className="glass-pill flex flex-row justify-between items-center px-2 py-2">
          {tabs.map((tab) => {
            const isActive = location.startsWith(tab.path);
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-1 font-medium text-[10px] w-16 cursor-pointer ${isActive ? '' : 'text-[#8A8A88]'}`}
                data-testid={`nav-${tab.label.toLowerCase()}`}
              >
                {isActive ? (
                  <div className="relative bg-[#1A1A1A] rounded-full px-4 py-2 text-white flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                ) : (
                  <div className="px-4 py-2 flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
