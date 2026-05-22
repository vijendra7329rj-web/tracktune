import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import HookScreen from "@/pages/HookScreen";
import OnboardingScreen from "@/pages/OnboardingScreen";
import HomeScreen from "@/pages/HomeScreen";
import ResultScreen from "@/pages/ResultScreen";
import HistoryScreen from "@/pages/HistoryScreen";
import TrendingScreen from "@/pages/TrendingScreen";
import ProfileScreen from "@/pages/ProfileScreen";

const queryClient = new QueryClient();

function RootRoute() {
  const [, navigate] = useLocation();
  const onboarded = typeof window !== "undefined" && !!localStorage.getItem('soundtrace_onboarded');

  React.useEffect(() => {
    if (onboarded) {
      navigate('/home');
    }
  }, [onboarded, navigate]);

  if (onboarded) return null;
  return <HookScreen />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRoute} />
      <Route path="/onboarding" component={OnboardingScreen} />
      <Route path="/home" component={HomeScreen} />
      <Route path="/result/:id" component={ResultScreen} />
      <Route path="/history" component={HistoryScreen} />
      <Route path="/trending" component={TrendingScreen} />
      <Route path="/profile" component={ProfileScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
