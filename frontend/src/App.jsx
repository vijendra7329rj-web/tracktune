import React from 'react';
import { Router, Route, Switch } from 'wouter';
import HomeScreen from './pages/HomeScreen.jsx';
import ResultScreen from './pages/ResultScreen.jsx';
import MovieResultScreen from './pages/MovieResultScreen.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsOfService from './pages/TermsOfService.jsx';
import FaqPage from './pages/FaqPage.jsx';
import BottomNav from './components/BottomNav.jsx';

// Dummy components for now
const HistoryScreen = () => <div className="p-6 pt-12 text-center text-white"><h1 className="text-2xl font-bold mb-4 text-[#13dfbf]">History</h1><p className="text-gray-400">Coming soon</p></div>;
const TrendingScreen = () => <div className="p-6 pt-12 text-center text-white"><h1 className="text-2xl font-bold mb-4 text-[#13dfbf]">Trending</h1><p className="text-gray-400">Coming soon</p></div>;
const ProfileScreen = () => <div className="p-6 pt-12 text-center text-white"><h1 className="text-2xl font-bold mb-4 text-[#13dfbf]">Profile</h1><p className="text-gray-400">Coming soon</p></div>;

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] text-[#f0f0f0] overflow-x-hidden font-sans pb-10 relative select-none transition-colors duration-700">
      {/* Liquid Gooey Morphic Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 liquid-container opacity-40">
          <div className="absolute top-[10%] left-[10%] w-[250px] h-[250px] rounded-full bg-[var(--theme-primary)] blur-[15px] animate-blob transition-colors duration-700"></div>
          <div className="absolute top-[40%] right-[5%] w-[280px] h-[280px] rounded-full bg-[var(--theme-primary-dark)] blur-[15px] animate-blob animation-delay-2000 transition-colors duration-700"></div>
          <div className="absolute bottom-[15%] left-[20%] w-[320px] h-[320px] rounded-full bg-[var(--theme-deep)] blur-[15px] animate-blob animation-delay-4000 transition-colors duration-700"></div>
        </div>
      </div>
      
      {/* Hidden SVG Gooey Filter for Liquid Morphism */}
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" className="hidden">
        <defs>
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  
                      0 1 0 0 0  
                      0 0 1 0 0  
                      0 0 0 30 -12" 
              result="goo" 
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      
      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-screen flex flex-col">
        <Router>
          <Switch>
            <Route path="/" component={HomeScreen} />
            <Route path="/result/:id" component={ResultScreen} />
            <Route path="/movie-result/:id" component={MovieResultScreen} />
            <Route path="/privacy" component={PrivacyPolicy} />
            <Route path="/faq" component={FaqPage} />
            <Route path="/terms" component={TermsOfService} />
            <Route path="/history" component={HomeScreen} />
            <Route path="/trending" component={HomeScreen} />
            <Route path="/profile" component={HomeScreen} />
            <Route>
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
                <h1 className="text-4xl font-black mb-2 text-[#13dfbf]">404</h1>
                <p className="text-gray-400 mb-6">Page not found</p>
                <a href="/" className="px-6 py-3 bg-[#13dfbf]/10 border border-[#13dfbf]/20 rounded-full font-bold text-[#13dfbf]">Go Home</a>
              </div>
            </Route>
          </Switch>
        </Router>
      </div>
    </div>
  );
}
