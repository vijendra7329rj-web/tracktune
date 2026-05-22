import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export default function HookScreen() {
  const [, navigate] = useLocation();
  const [currentText, setCurrentText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const line1 = "Hear it. Find it. ";
    const line2 = "Make it yours.";
    let currentIndex = 0;
    let timeout: NodeJS.Timeout;

    const animateLine1 = () => {
      if (currentIndex <= line1.length) {
        setCurrentText(line1.substring(0, currentIndex));
        currentIndex++;
        timeout = setTimeout(animateLine1, 25);
      } else {
        timeout = setTimeout(() => {
          currentIndex = 0;
          animateLine2();
        }, 1500);
      }
    };

    const animateLine2 = () => {
      if (currentIndex <= line2.length) {
        setCurrentText(line1 + line2.substring(0, currentIndex));
        currentIndex++;
        timeout = setTimeout(animateLine2, 25);
      } else {
        setIsComplete(true);
      }
    };

    animateLine1();

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="h-screen max-w-[430px] mx-auto relative overflow-hidden bg-[#F7F7F5]">
      <AnimatedBackground />
      
      <div className="flex flex-col items-center justify-center h-full px-8">
        <div className="text-center max-w-[320px] mx-auto w-full">
          <h1 className="font-black text-5xl tracking-[-0.05em] uppercase text-[#1A1A1A] mb-10">
            SOUNDTRACE
          </h1>
          
          <p className="text-lg font-medium text-[#1A1A1A] min-h-[80px] text-center leading-relaxed">
            {currentText}
            {!isComplete && <span className="animate-pulse">|</span>}
          </p>

          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="mt-8"
              >
                <button
                  onClick={() => navigate('/onboarding')}
                  className="glass-card px-10 py-4 font-bold text-lg bg-[#1A1A1A] text-white cursor-pointer text-center w-full"
                  data-testid="hook-lets-go"
                >
                  LET'S GO
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
