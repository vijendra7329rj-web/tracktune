import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, TrendingUp, History, User } from 'lucide-react';

export default function BottomNav() {
  const [location] = useLocation();
  
  const navItems = [
    { path: '/', icon: <Home size={24} />, label: 'Home' },
    { path: '/trending', icon: <TrendingUp size={24} />, label: 'Trending' },
    { path: '/history', icon: <History size={24} />, label: 'History' },
    { path: '/profile', icon: <User size={24} />, label: 'Me' },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
      <div className="glass-pill flex items-center justify-around w-full max-w-[380px] h-[72px] px-2 shadow-2xl shadow-black/50">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div className="relative flex flex-col items-center justify-center w-16 h-16 cursor-pointer">
                {isActive && (
                  <div className="absolute inset-0 bg-white/10 rounded-full scale-90 transition-transform duration-300"></div>
                )}
                <div className={elative z-10 transition-colors duration-300 }>
                  {item.icon}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
