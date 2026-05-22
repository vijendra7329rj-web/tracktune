import React from "react";
import { cn } from "@/lib/utils";

interface WaveArtProps {
  size?: 'sm' | 'md' | 'lg';
  isPlaying?: boolean;
  className?: string;
}

export function WaveArt({ size = 'md', isPlaying = false, className }: WaveArtProps) {
  const sizeClasses = {
    'sm': 'w-10 h-10',
    'md': 'w-20 h-20',
    'lg': 'w-48 h-48'
  };

  const barWidth = size === 'lg' ? 'w-[4px]' : 'w-[3px]';

  const delays = ['0ms', '150ms', '300ms', '150ms', '0ms'];
  const durations = ['800ms', '1100ms', '900ms', '1200ms', '1000ms'];

  return (
    <div className={cn(`flex items-end justify-center gap-[3px]`, sizeClasses[size], className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div 
          key={i}
          className={cn(
            "bg-[#1A1A1A]/60 rounded-full",
            barWidth,
            isPlaying ? "animate-wavebar" : "h-1/4"
          )}
          style={isPlaying ? { 
            animationDelay: delays[i], 
            animationDuration: durations[i] 
          } : undefined}
        />
      ))}
    </div>
  );
}
