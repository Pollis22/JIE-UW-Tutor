import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Mic, Brain, Clock, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import uwLogo from "@/assets/uw-madison-logo.png";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  accountName: z.string().min(1, "Your name is required"),
  studentName: z.string().min(1, "Student name is required"),
  studentAge: z.coerce.number().min(16, "Must be at least 16").max(99, "Please enter a valid age"),
  gradeLevel: z.literal("college-adult"),
  primarySubject: z.literal("general"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  plan: z.literal("elite"),
  marketingOptIn: z.boolean().default(false),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const searchParams = new URLSearchParams(searchString);
  const verificationStatus = searchParams.get("verified");
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (actionParam === "register") setActiveTab("register");
  }, [actionParam]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email });
      return res.json();
    },
    onSuccess: () => {
      setResendCooldown(60);
      toast({ title: "Verification email sent", description: "Check your inbox." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not resend.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (user) setLocation("/tutor");
  }, [user, setLocation]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountName: "", studentName: "", studentAge: 20,
      gradeLevel: "college-adult", primarySubject: "general",
      email: "", password: "", plan: "elite", marketingOptIn: false,
    },
  });

  const handleLogin = async (data: LoginForm) => {
    try {
      setUnverifiedEmail(null);
      await loginMutation.mutateAsync(data);
    } catch (error: any) {
      if (error.requiresVerification && error.email) {
        setUnverifiedEmail(error.email);
      } else if (error.message?.includes("verify")) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailPattern.test(data.email)) setUnverifiedEmail(data.email);
      }
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    try {
      await registerMutation.mutateAsync(data);
    } catch (error: any) {
      // handled by mutation
    }
  };

  if (user) return null;

  return (
    <div className="min-h-screen" style={{ background: "#F7F3EE", fontFamily: "'Red Hat Text', 'Source Sans 3', sans-serif" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(247,243,238,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(218,215,203,0.4)" : "none",
          padding: "16px 48px",
        }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={uwLogo} alt="University of Wisconsin-Madison" className="h-12 object-contain" />
            <div className="hidden sm:block" style={{ borderLeft: "1px solid #DAD7CB", paddingLeft: 16, marginLeft: 4 }}>
              <div style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 700, fontSize: 17, color: "#282728", lineHeight: 1.1 }}>AI Tutor</div>
              <div style={{ fontSize: 11, color: "#646569", fontWeight: 500, letterSpacing: 1.2, textTransform: "uppercase" }}>Powered by JIE Mastery</div>
            </div>
          </div>
          <Button onClick={() => { setActiveTab("login"); document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" }); }}
            className="text-white font-semibold px-6 py-2 rounded-lg" style={{ background: "#C5050C" }}>Sign In</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 40px, #C5050C 40px, #C5050C 41px)" }} />
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-16 items-center">
          <div style={{ animation: "fadeInUp 0.8s ease" }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ background: "rgba(197,5,12,0.08)", border: "1px solid rgba(197,5,12,0.15)" }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#28A745" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#C5050C" }}>Available 24/7 for UW Students</span>
            </div>
            <h1 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.08, color: "#282728", marginBottom: 24, letterSpacing: -1.5 }}>
              Your Personal<br /><span style={{ color: "#C5050C" }}>AI Tutor</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.65, color: "#646569", marginBottom: 40, maxWidth: 480 }}>
              Voice-powered tutoring that adapts to how you learn. Get instant help with coursework across every subject — explained the way you need to hear it.
            </p>
            <div className="flex flex-wrap gap-4 items-center">
              <Button onClick={() => { setActiveTab("register"); document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" }); }}
                className="text-white font-semibold px-8 py-3 rounded-lg text-base flex items-center gap-2"
                style={{ background: "#C5050C", boxShadow: "0 4px 20px rgba(197,5,12,0.3)" }}>
                Start Tutoring <ArrowRight className="w-4 h-4" />
              </Button>
              <span style={{ fontSize: 14, color: "#646569" }}>Free for all UW students</span>
            </div>
          </div>
          <div className="hidden md:flex justify-center items-center">
            <div className="relative" style={{ width: 340, height: 340 }}>
              {[280, 320, 340].map((sz, i) => (
                <div key={i} className="absolute top-1/2 left-1/2 rounded-full" style={{ width: sz, height: sz, border: `1px solid rgba(197,5,12,${i === 0 ? 0.12 : 0.06})`, transform: "translate(-50%, -50%)", animation: `pulseRing 3s ease-in-out ${i * 0.5}s infinite` }} />
              ))}
              <div className="absolute top-1/2 left-1/2 rounded-full flex items-center justify-center" style={{ width: 180, height: 180, transform: "translate(-50%, -50%)", background: "radial-gradient(circle at 40% 40%, #E23D28, #C5050C, #9B0000)", boxShadow: "0 20px 60px rgba(197,5,12,0.35)", animation: "breathe 4s ease-in-out infinite" }}>
                <div className="flex gap-1 items-center" style={{ height: 40 }}>
                  {[0,1,2,3,4,5,6].map(i => <div key={i} className="rounded-full" style={{ width: 3, background: "rgba(255,255,255,0.8)", animation: `waveform 1.2s ease-in-out ${i * 0.12}s infinite` }} />)}
                </div>
              </div>
              {[{ label: "Chemistry", top: "8%", left: "-5%", delay: 0 }, { label: "Calculus", top: "15%", right: "-8%", delay: 0.8 }, { label: "Physics", bottom: "18%", left: "-10%", delay: 1.6 }, { label: "History", bottom: "5%", right: "-3%", delay: 2.4 }].map((item, i) => {
                const { label, delay, ...pos } = item;
                return <div key={i} className="absolute px-3.5 py-1.5 rounded-full text-sm font-semibold shadow-md" style={{ ...pos as any, background: "#FFFFFF", color: "#3E3D3F", animation: `float 3s ease-in-out ${delay}s infinite`, fontSize: 13 }}>{label}</div>;
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Mic className="w-7 h-7" style={{ color: "#C5050C" }} />, title: "Voice-First Learning", desc: "Speak naturally and get clear, conversational explanations. Like office hours that never close." },
            { icon: <Brain className="w-7 h-7" style={{ color: "#C5050C" }} />, title: "Remembers Your Progress", desc: "Picks up where you left off. Knows your strengths, adapts to your gaps." },
            { icon: <Clock className="w-7 h-7" style={{ color: "#C5050C" }} />, title: "Track Your Growth", desc: "See your session history, mastery scores, and learning trajectory over time." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl p-9 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default" style={{ background: "#FFFFFF", border: "1px solid rgba(218,215,203,0.5)" }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(197,5,12,0.06)" }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10, color: "#282728" }}>{f.title}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#646569" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Auth */}
      <section id="auth-section" className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="relative p-12 md:p-16 flex flex-col justify-center" style={{ background: "#C5050C" }}>
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 40px, white 40px, white 41px)" }} />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-10" style={{ background: "rgba(255,255,255,0.15)", fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800, fontSize: 36, color: "white" }}>W</div>
              <h2 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: 40, fontWeight: 700, color: "white", lineHeight: 1.15, marginBottom: 20 }}>Welcome,<br />Badger.</h2>
              <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 360 }}>Your AI tutor is ready. Sign in to start a voice session, review past conversations, or track your learning progress.</p>
            </div>
          </div>
          <div className="p-10 md:p-14 flex flex-col justify-center" style={{ background: "white" }}>
            {verificationStatus === "success" && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: "#E8F5E9", border: "1px solid #28A745" }}>
                <p className="text-sm font-semibold" style={{ color: "#1B5E20" }}>Email verified! You can now sign in.</p>
              </div>
            )}
            <div className="flex mb-8 rounded-lg p-1" style={{ background: "#F7F3EE" }}>
              {(["login", "register"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 py-2.5 rounded-md text-sm font-semibold transition-all"
                  style={{ background: activeTab === tab ? "white" : "transparent", color: activeTab === tab ? "#282728" : "#646569", boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {tab === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            {activeTab === "login" ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                  <FormField control={loginForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>Email</FormLabel>
                      <FormControl><Input placeholder="student@wisc.edu" {...field} className="h-12 rounded-lg" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={loginForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showLoginPassword ? "text" : "password"} placeholder="Enter your password" {...field} className="h-12 rounded-lg pr-10" />
                          <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {unverifiedEmail && (
                    <div className="p-4 rounded-lg" style={{ background: "#FFF8E1", border: "1px solid #F5A623" }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: "#E65100" }}>Please verify your email first.</p>
                      <Button type="button" variant="outline" size="sm" disabled={resendCooldown > 0} onClick={() => resendVerificationMutation.mutate(unverifiedEmail)}>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Verification"}
                      </Button>
                    </div>
                  )}
                  <Button type="submit" disabled={loginMutation.isPending} className="w-full h-12 text-white font-semibold rounded-lg text-base" style={{ background: "#C5050C" }}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                  {loginMutation.isError && <p className="text-sm text-center" style={{ color: "#DC3545" }}>{(loginMutation.error as any)?.message || "Invalid credentials"}</p>}
                  <a href="/forgot-password" className="block text-center text-sm hover:underline" style={{ color: "#646569" }}>Forgot password?</a>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <FormField control={registerForm.control} name="accountName" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>Full Name</FormLabel>
                      <FormControl><Input placeholder="e.g. Sarah Chen" {...field} className="h-11 rounded-lg" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <input type="hidden" {...registerForm.register("studentName")} />
                  <input type="hidden" {...registerForm.register("studentAge")} />
                  <input type="hidden" {...registerForm.register("gradeLevel")} />
                  <input type="hidden" {...registerForm.register("primarySubject")} />
                  <input type="hidden" {...registerForm.register("plan")} />
                  <FormField control={registerForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>UW Email</FormLabel>
                      <FormControl><Input placeholder="student@wisc.edu" {...field} className="h-11 rounded-lg" onChange={(e) => { field.onChange(e); registerForm.setValue("studentName", registerForm.getValues("accountName") || "Student"); }} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showRegisterPassword ? "text" : "password"} placeholder="8+ characters" {...field} className="h-11 rounded-lg pr-10" />
                          <button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={registerMutation.isPending} className="w-full h-12 text-white font-semibold rounded-lg text-base" style={{ background: "#C5050C" }}
                    onClick={() => registerForm.setValue("studentName", registerForm.getValues("accountName") || "Student")}>
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                  {registerMutation.isError && <p className="text-sm text-center" style={{ color: "#DC3545" }}>{(registerMutation.error as any)?.message || "Registration failed"}</p>}
                </form>
              </Form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 md:px-12 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4" style={{ borderTop: "1px solid rgba(218,215,203,0.4)" }}>
        <div className="flex items-center gap-3">
          <img src={uwLogo} alt="UW" className="h-8 object-contain" />
          <span style={{ fontSize: 13, color: "#646569" }}>University of Wisconsin–Madison · AI Tutor Program</span>
        </div>
        <span style={{ fontSize: 12, color: "#DAD7CB" }}>Powered by JIE Mastery</span>
      </footer>

      <style>{`
        @keyframes pulseRing { 0% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; } 50% { transform: translate(-50%,-50%) scale(1.15); opacity: 0.2; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; } }
        @keyframes waveform { 0%, 100% { height: 8px; } 50% { height: 28px; } }
        @keyframes breathe { 0%, 100% { transform: translate(-50%,-50%) scale(1); box-shadow: 0 0 0 0 rgba(197,5,12,0.3); } 50% { transform: translate(-50%,-50%) scale(1.05); box-shadow: 0 0 0 16px rgba(197,5,12,0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
