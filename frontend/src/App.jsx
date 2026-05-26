import React, { useEffect, useState } from 'react';
import { Router, Route, Switch } from 'wouter';
import HomeScreen from './pages/HomeScreen.jsx';
import ResultScreen from './pages/ResultScreen.jsx';
import BottomNav from './components/BottomNav.jsx';

// Dummy components for now
const HistoryScreen = () => <div className="p-6 pt-12 text-center text-white"><h1 className="text-2xl font-bold mb-4">History</h1><p className="text-gray-400">Coming soon</p></div>;
const TrendingScreen = () => <div className="p-6 pt-12 text-center text-white"><h1 className="text-2xl font-bold mb-4">Trending</h1><p className="text-gray-400">Coming soon</p></div>;
const ProfileScreen = () => <div className="p-6 pt-12 text-center text-white"><h1 className="text-2xl font-bold mb-4">Profile</h1><p className="text-gray-400">Coming soon</p></div>;

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0f0f0] overflow-x-hidden font-sans pb-24">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-900/20 blur-[100px] mix-blend-screen animate-blob"></div>
        <div className="absolute top-[40%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-pink-900/20 blur-[100px] mix-blend-screen animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-blue-900/20 blur-[100px] mix-blend-screen animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-screen flex flex-col">
        <Router>
          <Switch>
            <Route path="/" component={HomeScreen} />
            <Route path="/result/:id" component={ResultScreen} />
            <Route path="/history" component={HistoryScreen} />
            <Route path="/trending" component={TrendingScreen} />
            <Route path="/profile" component={ProfileScreen} />
            <Route>
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
                <h1 className="text-4xl font-black mb-2 text-white">404</h1>
                <p className="text-gray-400 mb-6">Page not found</p>
                <a href="/" className="px-6 py-3 bg-white/10 rounded-full font-bold">Go Home</a>
              </div>
            </Route>
          </Switch>
          <BottomNav />
        </Router>
      </div>
    </div>
  );
}
