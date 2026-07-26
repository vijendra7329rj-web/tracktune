import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { identifySong, identifySongFromAudio, getAuthConfig, loginWithGoogle, identifyMovie } from '../api';
import { Search, Share2, Video, Sparkles, Mic, MicOff, Music, Volume2, Upload, LogOut, User, Film } from 'lucide-react';

const searchMessages = [
  "Got it! Opening our ears... 🎧",
  "Listening to your music... 🎵",
  "Looking for the exact song... 🔍",
  "Analyzing audio frequencies... ⚡",
  "Matching with millions of tracks... 🌐",
  "Almost there! Pulling details... ✨"
];

const micMessages = [
  "Listening to your environment... 🎙️",
  "Capturing audio samples... 🔊",
  "Decoding soundwaves... 🌊",
  "Identifying the melody... 🎵",
  "Comparing patterns... 🧠",
  "Got a match! Wrapping up... 🎁"
];

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [searchMode, setSearchMode] = useState('music'); // 'music' or 'movie'
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [, setLocation] = useLocation();

  const isMovieMode = searchMode === 'movie';
  const textColorClass = isMovieMode ? 'text-[#c084fc]' : 'text-[#13dfbf]';
  const borderColorClass = isMovieMode ? 'border-[#c084fc]/20' : 'border-[#13dfbf]/20';
  const borderFocusClass = isMovieMode ? 'focus:border-[#c084fc] focus:ring-[#c084fc]/20' : 'focus:border-[#13dfbf] focus:ring-[#13dfbf]/20';
  const tabBgClass = isMovieMode ? 'bg-[#150a24] border-[#c084fc]/20' : 'bg-[#042322] border-[#13dfbf]/20';
  const btnClass = isMovieMode ? 'bg-[#150a24] border-[#c084fc]/30 hover:bg-[#c084fc]/10' : 'bg-[#042322] border-[#13dfbf]/30 hover:bg-[#13dfbf]/10';
  const textAccent = isMovieMode ? 'text-[#c084fc]' : 'text-[#13dfbf]';
  const logoGlow = isMovieMode ? 'bg-[#c084fc]/20' : 'bg-[#13dfbf]/20';
  const logoBorder = isMovieMode ? 'border-[#c084fc]/30' : 'border-[#13dfbf]/30';
  const gradientBtn = isMovieMode ? 'from-[#7c3aed] to-[#c084fc]' : 'from-[#00c0a9] to-[#13dfbf]';
  const activeTabClass = isMovieMode ? 'bg-[#c084fc] text-black shadow-md' : 'bg-[#13dfbf] text-black shadow-md';

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch Google Client ID
  useEffect(() => {
    document.title = "TrackTune - Song Finder by Video Link | Free Online Music Finder AI";
    async function loadConfig() {
      try {
        const config = await getAuthConfig();
        setGoogleClientId(config.googleClientId);

        // Dynamically inject Google AdSense script if publisher ID is configured
        if (config.adsensePublisherId) {
          const existingScript = document.querySelector(`script[src*="adsbygoogle.js"]`);
          if (!existingScript) {
            console.log("Injecting Google AdSense script with client ID:", config.adsensePublisherId);
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsensePublisherId}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
          }
        }

        // Dynamically inject Google Analytics script if analytics ID is configured
        if (config.googleAnalyticsId) {
          const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag"]`);
          if (!existingScript) {
            console.log("Injecting Google Analytics with ID:", config.googleAnalyticsId);
            const script1 = document.createElement('script');
            script1.src = `https://www.googletagmanager.com/gtag/js?id=${config.googleAnalyticsId}`;
            script1.async = true;
            document.head.appendChild(script1);

            const script2 = document.createElement('script');
            script2.text = `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${config.googleAnalyticsId}');
            `;
            document.head.appendChild(script2);
          }
        }
      } catch (err) {
        console.error("Failed to load configuration:", err);
      }
    }
    loadConfig();
  }, []);

  // Popup logic
  useEffect(() => {
    if (user) return; // If already logged in, do not show popup

    const lastPopup = localStorage.getItem('last_popup_time');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in ms

    if (!lastPopup || (now - Number(lastPopup)) > oneDay) {
      // Show modal and save time
      setShowAuthModal(true);
      localStorage.setItem('last_popup_time', now.toString());
    }
  }, [user]);

  // Google Sign-In Button Rendering
  useEffect(() => {
    if (showAuthModal && googleClientId && window.google) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCallback,
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        { theme: "outline", size: "large", width: 280 }
      );
    }
  }, [showAuthModal, googleClientId]);

  const handleGoogleCallback = async (response) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await loginWithGoogle(response.credential);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setShowAuthModal(false);
    } catch (err) {
      setError(err.message || "Failed to log in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  // Dynamic Theme Color Controller
  useEffect(() => {
    const root = document.documentElement;
    if (searchMode === 'movie') {
      root.style.setProperty('--theme-bg', '#090312');
      root.style.setProperty('--theme-primary', '#c084fc');
      root.style.setProperty('--theme-primary-dark', '#7c3aed');
      root.style.setProperty('--theme-deep', '#3b0764');
    } else {
      root.style.setProperty('--theme-bg', '#021110');
      root.style.setProperty('--theme-primary', '#13dfbf');
      root.style.setProperty('--theme-primary-dark', '#00c0a9');
      root.style.setProperty('--theme-deep', '#043330');
    }
  }, [searchMode]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const data = await identifySongFromAudio(file);
      sessionStorage.setItem('current_song', JSON.stringify(data));
      setLocation(`/result/${data.id}`);
    } catch (err) {
      setError(err.message || "We couldn't identify a song in this file. Please try another one.");
      setLoading(false);
    }
  };

  // Setup sharing parameters from native OS share sheet (Web Share Target)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('shared_url') || params.get('url');
    const sharedText = params.get('text') || '';
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = sharedText.match(urlRegex);
    const candidateUrl = sharedUrl || (matches ? matches[0] : null);
    
    if (candidateUrl) {
      setUrl(candidateUrl);
      handleUrlSearch(candidateUrl);
    }
  }, []);

  // Cycle status messages sequentially during active searches
  useEffect(() => {
    if (!loading && !isRecording) {
      setActiveMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveMessageIndex((prev) => (prev + 1) % searchMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, isRecording]);

  // URL-based identification
  const handleUrlSearch = async (searchUrl) => {
    const targetUrl = searchUrl || url;
    if (!targetUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      if (searchMode === 'music') {
        const data = await identifySong(targetUrl);
        sessionStorage.setItem('current_song', JSON.stringify(data));
        setLocation(`/result/${data.id}`);
      } else {
        const data = await identifyMovie(targetUrl);
        sessionStorage.setItem('current_movie', JSON.stringify(data));
        setLocation(`/movie-result/${data.id}`);
      }
    } catch (err) {
      setError(err.message || `We couldn't identify a ${searchMode === 'music' ? 'song' : 'movie'} in this video. Please try another one.`);
      setLoading(false);
    }
  };

  // Microphone-based song identification (Shazam mode)
  const startMicRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all track inputs to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Send to backend
        setLoading(true);
        setIsRecording(false);
        try {
          const data = await identifySongFromAudio(audioBlob);
          sessionStorage.setItem('current_song', JSON.stringify(data));
          setLocation(`/result/${data.id}`);
        } catch (err) {
          setError(err.message || "Could not identify the song. Make sure the music is clearly audible.");
          setLoading(false);
        }
      };

      // Start recording and count down 8 seconds
      mediaRecorder.start();
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 8) {
            clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            return 8;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      setError("Please allow microphone access to identify music playing around you.");
      console.error("Microphone access error:", err);
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="p-6 pt-12 min-h-screen flex flex-col items-center justify-between relative overflow-hidden transition-all duration-500">
      
      {/* 1. Loader Overlay for URL processing */}
      {loading && (
        <div className="absolute inset-0 bg-[var(--theme-bg,#021110)]/95 z-50 flex flex-col items-center justify-center p-6 transition-all duration-500">
          <div className="relative mb-12 flex items-center justify-center">
            <div className="absolute w-44 h-44 rounded-full border border-[var(--theme-primary,#13dfbf)]/20 animate-ping duration-1000"></div>
            <div className="absolute w-36 h-36 rounded-full border border-[var(--theme-primary,#13dfbf)]/40 animate-pulse-ring"></div>
            <div className="relative w-28 h-28 bg-[var(--theme-deep,#042322)] border-2 border-[var(--theme-primary,#13dfbf)] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(19,223,191,0.4)] flex items-center justify-center p-1 animate-float">
              <img src="/logo.jpg" alt="TrackTune Logo" className="w-full h-full object-cover rounded-2xl" />
            </div>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--theme-primary,#13dfbf)] to-transparent w-full animate-bounce mt-14"></div>
          </div>
          <div className="text-center max-w-sm px-4">
            <h2 className="text-[var(--theme-primary,#13dfbf)] text-xl font-bold flex items-center justify-center gap-2 mb-3 tracking-wide">
              <Sparkles size={18} className="animate-spin duration-3000" /> TrackTune Active
            </h2>
            <div className="h-10 flex items-center justify-center">
              <p className="text-white text-base font-semibold animate-pulse tracking-wide transition-all duration-300">
                {searchMessages[activeMessageIndex]}
              </p>
            </div>
            <div className="w-48 bg-white/5 h-1 rounded-full overflow-hidden mx-auto mt-6 border border-white/10">
              <div className={`h-full bg-gradient-to-r ${gradientBtn} rounded-full animate-[shimmer_2s_infinite]`} style={{ width: '80%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Loader Overlay for Microphone Recording */}
      {isRecording && (
        <div className="absolute inset-0 bg-[var(--theme-bg,#021110)]/95 z-50 flex flex-col items-center justify-center p-6 transition-all duration-500">
          <div className="relative mb-12 flex items-center justify-center">
            {/* Multi-layered custom sonic ripple wave animation */}
            <div className="absolute w-56 h-56 rounded-full bg-[var(--theme-primary,#13dfbf)]/5 animate-ping duration-3000"></div>
            <div className="absolute w-44 h-44 rounded-full bg-[var(--theme-primary,#13dfbf)]/10 animate-pulse duration-1000"></div>
            <div className="absolute w-32 h-32 rounded-full border border-[var(--theme-primary,#13dfbf)]/30 animate-pulse-ring"></div>
            
            {/* Glowing active microphone core button */}
            <button 
              onClick={cancelRecording}
              className="relative w-28 h-28 bg-[var(--theme-primary,#13dfbf)] rounded-full shadow-[0_0_60px_rgba(19,223,191,0.6)] flex flex-col items-center justify-center hover:scale-95 active:scale-90 transition-all duration-300 border border-white/10"
            >
              <Volume2 size={36} className="text-black animate-bounce mb-1" />
              <span className="text-[10px] text-black font-black uppercase tracking-wider">{8 - recordingSeconds}s Left</span>
            </button>
          </div>
          
          <div className="text-center max-w-sm px-4">
            <h2 className="text-[var(--theme-primary,#13dfbf)] text-xl font-bold flex items-center justify-center gap-2 mb-3 tracking-wide">
              Listening to Song...
            </h2>
            <div className="h-10 flex items-center justify-center">
              <p className="text-white text-base font-semibold animate-pulse tracking-wide">
                {micMessages[activeMessageIndex] || "Listening carefully..."}
              </p>
            </div>
            
            {/* Visualizer micro bars */}
            <div className="flex items-center justify-center gap-1.5 mt-8 h-8">
              <div className="w-1.5 h-4 bg-[var(--theme-primary,#13dfbf)] rounded-full animate-[visualizer_0.6s_ease-in-out_infinite_alternate]"></div>
              <div className="w-1.5 h-7 bg-[var(--theme-primary,#13dfbf)] rounded-full animate-[visualizer_0.8s_ease-in-out_infinite_alternate_0.1s]"></div>
              <div className="w-1.5 h-5 bg-[var(--theme-primary,#13dfbf)] rounded-full animate-[visualizer_0.5s_ease-in-out_infinite_alternate_0.2s]"></div>
              <div className="w-1.5 h-8 bg-[var(--theme-primary,#13dfbf)] rounded-full animate-[visualizer_0.9s_ease-in-out_infinite_alternate_0.3s]"></div>
              <div className="w-1.5 h-3 bg-[var(--theme-primary,#13dfbf)] rounded-full animate-[visualizer_0.7s_ease-in-out_infinite_alternate_0.4s]"></div>
            </div>

            <button 
              onClick={cancelRecording}
              className="mt-12 text-xs font-bold text-gray-400 hover:text-red-400 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User Session Controller */}
      <div className="absolute top-4 right-4 z-40">
        {user ? (
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full pl-2 pr-3.5 py-1.5 backdrop-blur-md">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className={`w-6 h-6 rounded-full border ${borderColorClass} object-cover`} />
            ) : (
              <div className={`w-6 h-6 rounded-full bg-black/20 border ${borderColorClass} flex items-center justify-center`}>
                <User size={12} className={textColorClass} />
              </div>
            )}
            <span className="text-[10px] font-bold text-gray-300 max-w-[80px] truncate">{user.name || user.email}</span>
            <button 
              onClick={handleSignOut}
              className="text-gray-400 hover:text-red-400 transition-colors p-1"
              title="Sign Out"
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-1.5 bg-gradient-to-r ${gradientBtn} text-black font-extrabold px-4 py-2 rounded-full text-[10px] uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all duration-300 border border-white/10`}
          >
            <User size={12} /> Sign In
          </button>
        )}
      </div>

      {/* Main Contents */}
      <div className="w-full flex-1 flex flex-col items-center justify-between py-6">
        
        {/* Header and Branding */}
        <div className="flex flex-col items-center mt-2">
          <div className="relative group mb-4">
            <div className={`absolute inset-0 ${logoGlow} rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500`}></div>
            <div className={`relative w-16 h-16 bg-[#042322]/80 border ${logoBorder} rounded-2xl overflow-hidden shadow-md flex items-center justify-center p-0.5`}>
              <img src="/logo.jpg" alt="TrackTune Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center mb-1 text-white tracking-tight text-shadow">
            Track<span className={textAccent}>Tune</span>
          </h1>
          <p className="text-gray-400 text-center text-[10px] tracking-wide uppercase">
            Free Online Music Finder AI & Song Identifier
          </p>
        </div>

        {/* Tab Toggle for Music vs Movie */}
        <div className={`w-full flex ${tabBgClass} border rounded-full p-1 max-w-xs mt-2 relative z-20 transition-all duration-500`}>
          <button
            onClick={() => setSearchMode('music')}
            className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              searchMode === 'music'
                ? 'bg-[#13dfbf] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🎵 Song Finder
          </button>
          <button
            onClick={() => setSearchMode('movie')}
            className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              searchMode === 'movie'
                ? 'bg-[#c084fc] text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🎬 Movie Finder
          </button>
        </div>

        {/* Shared Error Banner */}
        {error && (
          <div className="w-full mt-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[11px] text-center font-medium leading-relaxed relative z-20">
            {error}
          </div>
        )}

        {/* 1. TOP: Input Card (Social Share / Manual Paste) */}
        <div className="w-full glass-card p-5 mt-4 relative z-20 transition-all duration-500">
          <div className={`flex items-center gap-2 mb-3 text-xs font-black ${textColorClass} uppercase tracking-widest transition-colors duration-500`}>
            {searchMode === 'music' ? <Share2 size={14} /> : <Film size={14} />} 
            {searchMode === 'music' ? "Identify from Social Media" : "Identify Movie from Video Link"}
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Video size={16} className="text-gray-500" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={searchMode === 'music' ? "Paste Instagram, YouTube, or TikTok link..." : "Paste movie edit / scene clip link..."}
              className={`w-full bg-black/30 border ${borderColorClass} rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none ${borderFocusClass} transition-all text-xs duration-500`}
            />
          </div>
          
          <button
            onClick={() => handleUrlSearch()}
            disabled={!url || loading}
            className={`w-full mt-3 ${btnClass} text-white font-extrabold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs tracking-wider uppercase`}
          >
            <Search size={14} /> {searchMode === 'music' ? "Search Video Link" : "Identify Movie Scene"}
          </button>
        </div>

        {searchMode === 'music' && (
          <>
            {/* 2. MIDDLE: Dynamic Interactive Central Listening Hub (Shazam Mode) */}
            <div className="flex flex-col items-center justify-center my-6 py-2 relative">
              <div className="absolute w-60 h-60 rounded-full border border-[#13dfbf]/5 animate-pulse duration-3000"></div>
              
              <button 
                onClick={startMicRecording}
                className="relative w-32 h-32 bg-gradient-to-tr from-[#00c0a9] to-[#13dfbf] rounded-full shadow-[0_0_50px_rgba(19,223,191,0.25)] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all duration-300 group border-4 border-[#021110]"
              >
                {/* Outer glowing ring */}
                <span className="absolute inset-0 rounded-full border-2 border-white/20 scale-100 group-hover:scale-110 transition-transform duration-500"></span>
                
                <Mic size={36} className="text-black mb-1 group-hover:rotate-12 transition-transform duration-300" />
                <span className="text-[10px] font-black text-black uppercase tracking-wider">Tap to Listen</span>
              </button>
              
              <p className="text-[#13dfbf] text-[10px] font-bold mt-4 flex items-center gap-1.5 bg-[#13dfbf]/5 px-3 py-1 rounded-full border border-[#13dfbf]/10">
                <Volume2 size={10} className="animate-pulse" /> Identify music playing nearby
              </p>
            </div>

            {/* 3. BOTTOM: Media File Upload Card */}
            <div className="w-full glass-card p-5 relative z-20">
              <div className="flex items-center gap-2 mb-3 text-xs font-black text-[#13dfbf] uppercase tracking-widest">
                <Upload size={14} /> Identify from Media File
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="video/*,audio/*" 
                className="hidden" 
              />
              
              <button
                onClick={() => fileInputRef.current.click()}
                className="w-full bg-black/30 border border-[#13dfbf]/20 hover:border-[#13dfbf]/50 hover:bg-[#13dfbf]/5 text-white font-extrabold py-4 rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-1.5 text-xs tracking-wider uppercase group"
              >
                <Upload size={20} className="text-[#13dfbf] group-hover:scale-110 transition-transform duration-300" />
                <span className="text-gray-400 group-hover:text-white transition-colors text-[11px]">Choose Video or Audio file</span>
                <span className="text-[8px] text-gray-500 lowercase normal-case tracking-normal">Supports MP4, MP3, WAV, etc.</span>
              </button>
            </div>
          </>
        )}

        {/* About / How It Works Text Section for AdSense Content Compliance */}
        {searchMode === 'movie' ? (
          <section className="w-full mt-10 p-6 bg-black/20 border border-[var(--theme-primary,#13dfbf)]/10 rounded-3xl backdrop-blur-xl relative z-20 text-left transition-all duration-500">
            <h2 className="text-[var(--theme-primary,#13dfbf)] text-xs font-black uppercase tracking-wider mb-3">
              About TrackTune — The Advanced AI Movie Finder Online
            </h2>
            <p className="text-gray-300 text-[10px] leading-relaxed mb-4">
              TrackTune Movie Finder is a free AI-powered web tool designed to identify what movie or TV show is playing in social media video clips, Instagram Reels, or YouTube Shorts. Using Google Gemini Vision AI, the application analyzes visual elements, actor appearances, settings, and dialogue to pinpoint the title in seconds.
            </p>
            <h3 className="text-white text-xs font-bold mb-2">Find Where to Watch Movies (Netflix, Prime, Hotstar)</h3>
            <p className="text-gray-400 text-[10px] leading-relaxed">
              Once TrackTune recognizes the scene, it fetches streaming platform details. You can see direct streaming availability and links to watch the movie on Netflix, Amazon Prime Video, Disney+ Hotstar, and other services in your region instantly.
            </p>
          </section>
        ) : (
          <section className="w-full mt-10 p-6 bg-black/20 border border-[var(--theme-primary,#13dfbf)]/10 rounded-3xl backdrop-blur-xl relative z-20 text-left transition-all duration-500">
            <h2 className="text-[var(--theme-primary,#13dfbf)] text-xs font-black uppercase tracking-wider mb-3">
              About TrackTune — The Advanced AI Music Finder Online
            </h2>
            <p className="text-gray-300 text-[10px] leading-relaxed mb-4">
              TrackTune is a free online music finder designed to identify what is this song playing in social media videos, microphone captures, or local media files. Using advanced music finder AI and acoustic fingerprinting algorithms, TrackTune helps you search, discover, and trace the background music of any video link in seconds.
            </p>
            <h3 className="text-white text-xs font-bold mb-2">How to Use the Video Link Song Finder</h3>
            <p className="text-gray-400 text-[10px] leading-relaxed mb-4">
              If you hear a song in an Instagram Reel, YouTube Short, or TikTok video, simply copy the URL and paste it into our search box above. TrackTune acts as a direct song finder by video link, extracting a high-quality audio sample and identifying the exact artist and track name without needing a browser music finder extension or downloading a separate music finder app.
            </p>
            <h3 className="text-white text-xs font-bold mb-2">Music Finder by Sound or File Upload</h3>
            <p className="text-gray-400 text-[10px] leading-relaxed">
              Need to identify music playing nearby? Click the central microphone button to use TrackTune as a music finder by sound or voice. You can also upload local video and audio files (like MP4, MP3, or WAV) to scan for music. TrackTune will process the sound waves and provide direct search redirection links to Spotify and YouTube.
            </p>
          </section>
        )}

        {/* Footer for AdSense Compliance */}
        <footer className="w-full mt-8 pb-4 text-center text-[10px] text-gray-500 font-medium relative z-20">
          <div className="flex justify-center gap-4 mb-2">
            <a href="/privacy" className="hover:text-[var(--theme-primary,#13dfbf)] transition-colors">Privacy Policy</a>
            <span className="text-gray-700">•</span>
            <a href="/faq" className="hover:text-[var(--theme-primary,#13dfbf)] transition-colors">FAQ & Help</a>
            <span className="text-gray-700">•</span>
            <a href="/terms" className="hover:text-[var(--theme-primary,#13dfbf)] transition-colors">Terms of Service</a>
          </div>
          <p>© {new Date().getFullYear()} TrackTune. All Rights Reserved.</p>
        </footer>

      </div>

      {/* 3. Google Sign-In Prompt Modal */}
      {showAuthModal && (
        <div className="absolute inset-0 bg-[#021110]/90 z-50 flex items-center justify-center p-6 backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 text-center border border-[var(--theme-primary,#13dfbf)]/30 relative flex flex-col items-center justify-center shadow-[0_0_80px_var(--theme-primary,#13dfbf)]/20">
            <div className="w-16 h-16 bg-[#042322] border-2 border-[var(--theme-primary,#13dfbf)] rounded-2xl flex items-center justify-center mb-4 shadow-lg animate-float">
              <Sparkles size={28} className="text-[var(--theme-primary,#13dfbf)] animate-pulse" />
            </div>
            
            <h3 className="text-white text-lg font-black tracking-tight mb-2">Unlock Unlimited Discovery</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              Create an account or sign in with Google to save your song search history, share favorites, and get unlimited identifications!
            </p>

            {/* Google Sign-in API Button Container */}
            <div className="w-full flex justify-center mb-4">
              <div id="google-signin-button" className="inline-block"></div>
            </div>

            <button
              onClick={() => setShowAuthModal(false)}
              className="text-[10px] text-gray-500 hover:text-gray-300 font-extrabold uppercase tracking-widest transition-all mt-4 px-4 py-2"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
