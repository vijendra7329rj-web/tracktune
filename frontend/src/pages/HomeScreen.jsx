import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { identifySong, identifySongFromAudio, getAuthConfig, loginWithGoogle } from '../api';
import { Search, Share2, Video, Sparkles, Mic, MicOff, Music, Volume2, Upload, LogOut, User } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [error, setError] = useState(null);
  const [, setLocation] = useLocation();

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

  // URL-based song identification
  const handleUrlSearch = async (searchUrl) => {
    const targetUrl = searchUrl || url;
    if (!targetUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await identifySong(targetUrl);
      sessionStorage.setItem('current_song', JSON.stringify(data));
      setLocation(`/result/${data.id}`);
    } catch (err) {
      setError(err.message || "We couldn't identify a song in this video. Please try another one.");
      setLoading(false);
    }
  };

  // Microphone-based song identification (Shazam mode)
  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        
        // Stop all audio tracks from stream to release mic icon on device
        stream.getTracks().forEach(track => track.stop());

        setLoading(true);
        try {
          const data = await identifySongFromAudio(audioBlob);
          sessionStorage.setItem('current_song', JSON.stringify(data));
          setLocation(`/result/${data.id}`);
        } catch (err) {
          setError(err.message || "We couldn't identify the song playing near you.");
        } finally {
          setLoading(false);
          setIsRecording(false);
        }
      };

      recorder.start();
      setIsRecording(true);

      // 8-second capture window
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
      console.error("Microphone access blocked", err);
      setError("Microphone access denied. Please check your browser permissions.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between pb-8 relative overflow-hidden">
      {/* Background blur circles */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[50%] bg-[#13dfbf]/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Top Navbar */}
      <header className="w-full max-w-5xl px-6 py-6 flex justify-between items-center z-10">
        <a href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-tr from-[#13dfbf] to-emerald-400 rounded-2xl flex items-center justify-center shadow-[0_4px_15px_rgba(19,223,191,0.25)] transition-transform group-hover:scale-105">
            <Music className="text-black" size={20} strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-lg font-black tracking-tighter text-white uppercase">TrackTune</span>
            <span className="block text-[9px] text-[#13dfbf] font-bold tracking-widest uppercase mt-[-3px]">Song Finder</span>
          </div>
        </a>

        <div className="flex items-center gap-3">
          <a href="/faq" className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider transition-colors mr-2">FAQ</a>
          {user ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pl-3 pr-2 py-1.5">
              {user.picture ? (
                <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full border border-white/20" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#13dfbf]/20 text-[#13dfbf] flex items-center justify-center text-[10px] font-bold">
                  {user.name ? user.name[0] : <User size={12} />}
                </div>
              )}
              <span className="text-xs font-bold text-gray-300 max-w-[80px] truncate hidden sm:inline">{user.name}</span>
              <button 
                onClick={handleSignOut}
                className="p-1.5 hover:bg-white/10 rounded-full text-red-400 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-extrabold px-5 py-2.5 rounded-full tracking-wider transition-all hover:scale-105 cursor-pointer uppercase"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Search Panel */}
      <main className="w-full max-w-xl px-6 flex flex-col items-center flex-1 justify-center z-10 relative mt-4">
        {loading ? (
          /* Loading Animation state */
          <div className="w-full flex flex-col items-center justify-center py-12 text-center">
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-[#13dfbf]/20 border-t-[#13dfbf] rounded-full animate-spin"></div>
              <Music className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#13dfbf] animate-bounce" size={24} />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-wider mb-2">Analyzing Audio</h2>
            <p className="text-sm text-gray-400 animate-pulse font-medium">{searchMessages[activeMessageIndex]}</p>
          </div>
        ) : isRecording ? (
          /* Recording Microphone UI */
          <div className="w-full flex flex-col items-center justify-center py-12 text-center">
            <div className="relative mb-8 cursor-pointer" onClick={stopRecording}>
              <div className="absolute inset-0 bg-[#13dfbf]/20 rounded-full animate-ping"></div>
              <div className="absolute inset-[-15px] bg-[#13dfbf]/10 rounded-full animate-pulse-ring"></div>
              <div className="relative w-28 h-28 bg-gradient-to-tr from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.45)]">
                <MicOff className="text-white animate-pulse" size={40} />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Listening...</h2>
            <p className="text-sm text-[#13dfbf] font-bold tracking-widest mb-4">0:0{recordingSeconds} / 0:08</p>
            <p className="text-xs text-gray-400 italic max-w-xs mx-auto leading-relaxed">{micMessages[activeMessageIndex]}</p>
          </div>
        ) : (
          /* Default UI (Search Box or Microphone trigger) */
          <div className="w-full flex flex-col items-center">
            <div className="text-center mb-8 px-4">
              <span className="inline-flex items-center gap-1 bg-[#13dfbf]/10 border border-[#13dfbf]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#13dfbf] uppercase tracking-widest mb-3">
                <Sparkles size={10} /> AI Song Identifier
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight mb-3">
                Find the Song Inside <br className="hidden sm:inline" />
                Any Video Link.
              </h1>
              <p className="text-sm text-gray-400 max-w-sm mx-auto font-medium">
                Paste an Instagram Reel, YouTube Short, or TikTok link to identify the music.
              </p>
            </div>

            {/* Input Form */}
            <div className="w-full glass-card p-2 rounded-2xl flex items-center gap-2 border border-white/10 shadow-2xl focus-within:border-[#13dfbf]/40 transition-all duration-300 mb-4">
              <div className="pl-3 text-gray-500">
                <Video size={18} />
              </div>
              <input
                type="url"
                placeholder="Paste Instagram, YouTube, or TikTok URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSearch()}
                className="flex-1 bg-transparent border-none outline-none py-3 text-sm text-white placeholder-gray-500 min-w-0"
              />
              <button
                onClick={() => handleUrlSearch()}
                disabled={!url.trim()}
                className="bg-[#13dfbf] disabled:opacity-40 disabled:cursor-not-allowed text-black font-extrabold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-[0_4px_15px_rgba(19,223,191,0.2)] hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(19,223,191,0.35)] transition-all cursor-pointer uppercase tracking-wider"
              >
                <Search size={14} strokeWidth={2.5} /> Search
              </button>
            </div>

            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest my-4">OR</div>

            {/* Tap to Listen Microphone Box */}
            <button 
              onClick={startRecording}
              className="group relative w-36 h-36 bg-gradient-to-tr from-[#13dfbf] to-emerald-400 rounded-full flex flex-col items-center justify-center shadow-[0_8px_30px_rgba(19,223,191,0.25)] hover:scale-105 transition-all duration-300 border-4 border-white/5 cursor-pointer"
            >
              <div className="absolute inset-0 bg-[#13dfbf]/20 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Mic className="text-black group-hover:scale-110 transition-transform duration-300 mb-1" size={32} strokeWidth={2} />
              <span className="text-[10px] text-black font-extrabold uppercase tracking-widest">Tap to Listen</span>
            </button>

            {/* File Upload Selector */}
            <div className="mt-8 text-center">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="audio/*,video/*" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current.click()}
                className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Upload size={14} /> Or Upload Audio/Video File
              </button>
            </div>
          </div>
        )}

        {/* Global Error Display */}
        {error && (
          <div className="w-full mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center text-xs text-red-400 font-medium leading-relaxed animate-shake">
            {error}
          </div>
        )}
      </main>

      {/* Sticky Bottom Footer */}
      <footer className="w-full max-w-xl text-center px-6 mt-6 z-10">
        <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
          Free searches are unlimited. By using TrackTune you agree to our <br />
          <a href="/terms" className="text-gray-400 hover:text-[#13dfbf] transition-colors">Terms of Service</a> and <a href="/privacy" className="text-gray-400 hover:text-[#13dfbf] transition-colors">Privacy Policy</a>.
        </p>
      </footer>

      {/* Google Login / Auth Modal Popup */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-[#0f0f15] border border-white/10 w-full max-w-md p-8 rounded-3xl shadow-2xl relative text-center">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
            <div className="w-12 h-12 bg-[#13dfbf]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="text-[#13dfbf]" size={24} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Sign In with Google</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              TrackTune is completely free! We use Google Sign-in to protect our servers and save your search history securely.
            </p>
            <div className="flex justify-center mb-2">
              <div id="google-signin-button"></div>
            </div>
            <p className="text-[10px] text-gray-500 font-medium">We never post anything or share your personal data.</p>
          </div>
        </div>
      )}
    </div>
  );
}
