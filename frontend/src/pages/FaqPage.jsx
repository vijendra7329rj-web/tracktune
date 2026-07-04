import React, { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ArrowLeft, Sparkles, Music, Link, Upload, Mic } from 'lucide-react';

const faqData = [
  {
    question: "What is this song? How do I find background music from video links?",
    answer: "TrackTune is a free background music finder by video link. To find out 'what is this song' in any Instagram Reel, YouTube Short, or TikTok, copy the link, paste it in the search box, and run the song finder by video link. TrackTune extracts the audio, identifies the song in under 3 seconds, and provides direct links to open it.",
    icon: Link
  },
  {
    question: "Can I use TrackTune as a music finder by sound or voice?",
    answer: "Yes! TrackTune is a full-featured music finder by sound and music finder by voice. Tap the central 'Tap to Listen' microphone button and allow access. The app will capture an 8-second audio sample, identify the melody playing nearby, and act as a web-based music finder by click.",
    icon: Mic
  },
  {
    question: "How does the TrackTune AI music finder work?",
    answer: "Our music finder AI uses advanced acoustic fingerprinting algorithms to decode audio waves from links or microphone recordings. By comparing sound patterns with a massive song database, this AI music finder matches the track with extreme accuracy, even with low quality or background noise.",
    icon: Sparkles
  },
  {
    question: "Is there a TrackTune music finder extension or music finder app?",
    answer: "TrackTune is fully optimized as an online music finder that works on any browser without downloads. You don't need a heavy music finder app. We are also building a browser music finder extension for Chrome and Firefox to identify background music with a single click.",
    icon: Upload
  },
  {
    question: "How can I use the music finder google or search for songs by lyrics?",
    answer: "While Google music finder requires typing lyrics, TrackTune is a link-based music finder online. If you only know a few words, you can use our links to search for the identified track's lyrics directly on YouTube and Spotify. TrackTune also helps search for the song on Google Music Finder dynamically.",
    icon: Music
  },
  {
    question: "Does TrackTune include a music extend bpm finder?",
    answer: "Yes, our music finder by link identifies key audio details. Once a track is recognized, we provide you with metadata about the song, and we are adding support for a music extend bpm finder to identify the beats-per-minute (BPM) and tempo of any track.",
    icon: Sparkles
  }
];

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    document.title = "TrackTune FAQ - How to Find Songs from Video Links";
  }, []);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="p-6 pt-12 text-[#f0f0f0]">
      
      {/* Header and Back navigation */}
      <div className="flex items-center gap-3 mb-8">
        <a 
          href="/" 
          className="p-2 bg-[#13dfbf]/10 border border-[#13dfbf]/20 rounded-full text-[#13dfbf] hover:bg-[#13dfbf]/20 transition-all cursor-pointer"
          aria-label="Go Back"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </a>
        <h1 className="text-xl font-black text-[#13dfbf] tracking-tight uppercase flex items-center gap-2">
          <HelpCircle size={22} /> FAQ & Help
        </h1>
      </div>

      <p className="text-gray-400 text-xs mb-6 px-1 leading-relaxed">
        Welcome to the TrackTune Help Center. Learn how to identify music, troubleshoot audio capture, and search songs using social media links.
      </p>

      {/* Accordion FAQ List */}
      <div className="space-y-4 relative z-20">
        {faqData.map((faq, index) => {
          const IconComponent = faq.icon;
          const isOpen = openIndex === index;
          return (
            <div 
              key={index}
              className="bg-[#0c1e1c]/40 border border-[#13dfbf]/10 rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full p-5 flex items-center justify-between text-left gap-4 hover:bg-[#13dfbf]/5 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#13dfbf]/10 rounded-xl text-[#13dfbf]">
                    <IconComponent size={16} />
                  </div>
                  <h2 className="text-xs font-bold text-white tracking-wide leading-snug">
                    {faq.question}
                  </h2>
                </div>
                <div className="text-gray-500">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isOpen ? 'max-h-40 border-t border-[#13dfbf]/5' : 'max-h-0'
                }`}
              >
                <div className="p-5 text-xs text-gray-300 leading-relaxed bg-black/20">
                  {faq.answer}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
