/**
 * UW AI Tutor — University of Wisconsin–Madison
 * Powered by JIE Mastery AI, Inc.
 */

import { lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute, PublicOrAuthRoute, LazyRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";

const NotFound = lazy(() => import("@/pages/not-found"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const AdminPageEnhanced = lazy(() => import("@/pages/admin-page-enhanced"));
const TutorPage = lazy(() => import("@/pages/tutor-page"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminDocuments = lazy(() => import("@/pages/admin-documents"));
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const AdminLogs = lazy(() => import("@/pages/admin-logs"));
const AdminUserDetail = lazy(() => import("@/pages/admin-user-detail"));
const AdminContacts = lazy(() => import("@/pages/admin/admin-contacts-page"));
const AdminAgents = lazy(() => import("@/pages/admin/admin-agents-page"));
const TermsPage = lazy(() => import("@/pages/terms-page"));
const PrivacyPage = lazy(() => import("@/pages/privacy-page"));
const AdminSetupPage = lazy(() => import("@/pages/admin-setup-page"));
const SessionDetailsPage = lazy(() => import("@/pages/session-details"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email-page"));
const RegistrationSuccessPage = lazy(() => import("@/pages/registration-success-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const PracticeLessonsPage = lazy(() => import("@/pages/practice-lessons-page"));

function Router() {
  return (
    <Switch>
        <PublicOrAuthRoute path="/" publicComponent={AuthPage} authComponent={TutorPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/login" component={AuthPage} />
        <ProtectedRoute path="/dashboard" component={DashboardPage} />
        <ProtectedRoute path="/sessions/:id" component={SessionDetailsPage} />
        <ProtectedRoute path="/tutor" component={TutorPage} />
        <ProtectedRoute path="/practice-lessons" component={PracticeLessonsPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/admin" component={AdminPageEnhanced} />
        <ProtectedRoute path="/admin/users" component={AdminUsers} />
        <ProtectedRoute path="/admin/users/:userId" component={AdminUserDetail} />
        <ProtectedRoute path="/admin/documents" component={AdminDocuments} />
        <ProtectedRoute path="/admin/analytics" component={AdminAnalytics} />
        <ProtectedRoute path="/admin/agents" component={AdminAgents} />
        <ProtectedRoute path="/admin/contacts" component={AdminContacts} />
        <ProtectedRoute path="/admin/logs" component={AdminLogs} />
        <LazyRoute path="/auth/registration-success" component={RegistrationSuccessPage} />
        <LazyRoute path="/forgot-password" component={ForgotPasswordPage} />
        <LazyRoute path="/reset-password" component={ResetPasswordPage} />
        <LazyRoute path="/verify-email" component={VerifyEmailPage} />
        <LazyRoute path="/admin-setup" component={AdminSetupPage} />
        <LazyRoute path="/terms" component={TermsPage} />
        <LazyRoute path="/privacy" component={PrivacyPage} />
        <LazyRoute component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
