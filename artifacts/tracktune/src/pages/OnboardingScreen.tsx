import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, History, Flame, Star } from "lucide-react";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const slides = [
  {
    headline: "Find any song.",
    description: "Paste a reel from Instagram or a short from YouTube. We'll identify the track.",
    icon: Search
  },
  {
    headline: "Keep your history.",
    description: "Never lose a great track again. Your discoveries are saved automatically.",
    icon: History
  },
  {
    headline: "See what's viral.",
    description: "Access the Trending Dashboard to see top tracks before they blow up everywhere.",
    icon: Flame
  },
  {
    headline: "Unlock Premium.",
    description: "Unlimited searches, zero ads, and full access to the Trending Dashboard.",
    icon: Star
  }
];

export default function OnboardingScreen() {
  const [, navigate] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPremium, setShowPremium] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (currentSlide === 3 && !isDismissed) {
      const timeout = setTimeout(() => {
        setShowPremium(true);
      }, 600);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [currentSlide, isDismissed]);

  const handleComplete = () => {
    localStorage.setItem('soundtrace_onboarded', 'true');
    navigate('/home');
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      handleComplete();
    }
  };

  const CurrentIcon = slides[currentSlide].icon;

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5] flex flex-col">
      <AnimatedBackground />

      <button
        onClick={handleComplete}
        className="absolute top-4 right-4 text-sm text-[#8A8A88] cursor-pointer z-20"
        data-testid="skip-onboarding"
      >
        Skip
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative z-10">
        <h1 className="font-black text-4xl tracking-[-0.05em] uppercase mb-8 text-[#1A1A1A]">
          SOUNDTRACE
        </h1>
        
        <CurrentIcon className="w-20 h-20 text-[#1A1A1A] opacity-20 mb-6" />
        
        <h2 className="font-bold text-2xl text-[#1A1A1A]">
          {slides[currentSlide].headline}
        </h2>
        
        <p className="text-base text-[#8A8A88] leading-relaxed mt-3 max-w-[280px] mx-auto h-20">
          {slides[currentSlide].description}
        </p>
      </div>

      <div className="pb-8 px-8 relative z-10">
        <div className="flex gap-2 justify-center mb-6">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full ${idx === currentSlide ? 'bg-[#1A1A1A]' : 'bg-[#DDDDD9]'}`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="glass-card py-4 px-10 rounded-full font-bold text-sm text-center cursor-pointer bg-[#1A1A1A] text-white w-full"
          data-testid="onboarding-next"
        >
          {currentSlide === slides.length - 1 ? "LET'S GO" : "NEXT"}
        </button>
      </div>

      <AnimatePresence>
        {showPremium && !isDismissed && (
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 300 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100) {
                setIsDismissed(true);
              }
            }}
            className="absolute bottom-0 left-0 right-0 z-50"
          >
            <div className="glass-card rounded-t-3xl rounded-b-none p-6 pointer-events-auto shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
              <div className="w-12 h-1 bg-gray-300 rounded mx-auto mb-5" />
              
              <h3 className="font-bold text-xl text-[#1A1A1A] text-center">
                Go Premium. No Ads. No Limits.
              </h3>
              <p className="text-sm text-[#8A8A88] mt-2 text-center">
                Unlimited searches + Trending Dashboard + Ad-free
              </p>
              <p className="text-sm font-semibold mt-2 text-center text-[#1A1A1A]">
                ₹99 / month · or ₹799 / year (save ₹389)
              </p>
              
              <button
                className="bg-[#1A1A1A] text-white py-4 rounded-full w-full font-bold mt-5 text-sm cursor-pointer"
                data-testid="premium-trial"
                onClick={handleComplete}
              >
                START FREE 7-DAY TRIAL
              </button>
              
              <p
                className="text-sm text-[#8A8A88] text-center mt-4 cursor-pointer"
                onClick={() => setIsDismissed(true)}
              >
                Continue with free version →
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
