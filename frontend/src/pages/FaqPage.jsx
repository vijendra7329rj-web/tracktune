import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ArrowLeft, Sparkles, Music, Link, Upload, Mic } from 'lucide-react';

const faqData = [
  {
    question: "How to find a song from an Instagram Reel link?",
    answer: "To identify a song from an Instagram Reel, open the Instagram app, tap the Share icon, and click 'Copy Link'. Open tracktune.online, paste the copied link into the search box, and click 'Search Video Link'. TrackTune will extract the audio and find the song in under 3 seconds!",
    icon: Link
  },
  {
    question: "How to identify music from a YouTube Shorts URL?",
    answer: "Just copy the link of any YouTube Short or standard YouTube video. Paste the link into the search input on TrackTune and click search. We will analyze the video's audio track and return the name, artist, and direct redirect links for Spotify and YouTube.",
    icon: Music
  },
  {
    question: "How does the 'Tap to Listen' microphone song finder work?",
    answer: "If you hear a song playing around you (on a TV, radio, or in a public space), simply tap the central 'Tap to Listen' microphone button. Make sure to allow browser microphone access. TrackTune will capture an 8-second sample, decode the soundwaves, and identify the song instantly, similar to Shazam.",
    icon: Mic
  },
  {
    question: "Can I identify a song by uploading a video or audio file?",
    answer: "Yes, absolutely! If you have a video clip (MP4, MOV, AVI) or an audio file (MP3, WAV, AAC) saved on your device, use our 'Identify from Media File' section. Drag or select the file, and our backend will process and identify the song hiding inside the file.",
    icon: Upload
  },
  {
    question: "Is TrackTune free to use?",
    answer: "Yes, TrackTune is completely free to use. You can search by pasting social media URLs, recording audio with your microphone, or uploading local media files. There are no hidden fees or charges.",
    icon: Sparkles
  }
];

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState(null);

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

      {/* SEO Compliance Footer Note */}
      <div className="mt-8 p-5 bg-[#13dfbf]/5 border border-[#13dfbf]/10 rounded-2xl text-center backdrop-blur-md">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Still have questions? Feel free to contact our support team at <span className="text-[#13dfbf] font-bold">support@tracktune.site</span>. We are continuously improving our song identification features to provide you with the fastest music discovery.
        </p>
      </div>

    </div>
  );
}
