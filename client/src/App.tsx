import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TutorInterface from "@/pages/tutor-interface";
import FeaturesAndBenefits from "@/pages/features-benefits";
import BestPractices from "@/pages/best-practices";
import LiveSupport from "@/pages/live-support";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={AuthPage} />
      <Route path="/signup" component={AuthPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tutor" component={TutorInterface} />
      <Route path="/features" component={FeaturesAndBenefits} />
      <Route path="/best-practices" component={BestPractices} />
      <Route path="/support" component={LiveSupport} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
