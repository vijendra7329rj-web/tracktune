import React from "react";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-[#F7F7F5]">
      <div 
        className="absolute rounded-full w-[500px] h-[500px] bg-[rgba(200,200,195,0.25)] -top-20 -left-20"
        style={{ filter: "blur(80px)", animation: "blob1 30s ease-in-out infinite alternate" }}
      />
      <div 
        className="absolute rounded-full w-[500px] h-[500px] bg-[rgba(200,200,195,0.25)] top-40 -right-40"
        style={{ filter: "blur(80px)", animation: "blob2 25s ease-in-out infinite alternate" }}
      />
      <div 
        className="absolute rounded-full w-[500px] h-[500px] bg-[rgba(200,200,195,0.25)] -bottom-40 left-10"
        style={{ filter: "blur(80px)", animation: "blob3 35s ease-in-out infinite alternate" }}
      />
      <div 
        className="absolute rounded-full w-[500px] h-[500px] bg-[rgba(200,200,195,0.25)] bottom-20 right-20"
        style={{ filter: "blur(80px)", animation: "blob4 28s ease-in-out infinite alternate" }}
      />

      <span className="absolute top-[15%] left-[20%] text-[#1A1A1A] opacity-[0.03] text-lg" style={{ animation: "float1 6s ease-in-out infinite alternate", animationDelay: "0s" }}>{'\u266A'}</span>
      <span className="absolute top-[35%] right-[15%] text-[#1A1A1A] opacity-[0.03] text-lg" style={{ animation: "float1 8s ease-in-out infinite alternate", animationDelay: "1s" }}>{'\u266B'}</span>
      <span className="absolute top-[65%] left-[10%] text-[#1A1A1A] opacity-[0.03] text-lg" style={{ animation: "float1 7s ease-in-out infinite alternate", animationDelay: "2s" }}>{'\u266C'}</span>
      <span className="absolute bottom-[20%] right-[25%] text-[#1A1A1A] opacity-[0.03] text-lg" style={{ animation: "float1 9s ease-in-out infinite alternate", animationDelay: "3s" }}>{'\u266D'}</span>

      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "repeating-conic-gradient(#000 0.0001%, transparent 0.0005%, transparent 0.0005%, transparent 0.005%)" }}
      />
    </div>
  );
}
