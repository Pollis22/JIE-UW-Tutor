import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Mic, Brain, ArrowRight, GraduationCap, FlaskConical } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import uwLogo from "@/assets/uw-madison-logo.png";

// Campus & Bucky photos
import buckyGraduation from "@/assets/campus/bucky-graduation.png";
import bascomHall from "@/assets/campus/bascom-hall.png";
import buckyTeaching from "@/assets/campus/bucky-teaching.png";
import buckyBasketball from "@/assets/campus/bucky-basketball.png";
import buckyLecture from "@/assets/campus/bucky-lecture.png";
import buckyFootball from "@/assets/campus/bucky-football.png";
import buckyClassroom from "@/assets/campus/bucky-classroom.png";

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

/* ─── Photo Collage — responsive grid, no absolute positioning ─── */
function PhotoCollage() {
  return (
    <section className="py-12 md:py-16 px-4 md:px-12 max-w-7xl mx-auto" style={{ background: "#FFFFFF" }}>
      <div className="text-center mb-8 md:mb-12">
        <h2 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, color: "#282728", lineHeight: 1.15, marginBottom: 8 }}>
          Where Bucky studies hard & plays harder
        </h2>
        <p style={{ fontSize: 16, color: "#646569", maxWidth: 520, margin: "0 auto", lineHeight: 1.6, padding: "0 8px" }}>
          From lecture halls to game days — Badgers bring that energy everywhere. Now your AI tutor keeps up too.
        </p>
      </div>

      {/* Grid layout — works on all screen sizes */}
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {/* Bascom Hall — spans 2 cols on mobile, 2 on desktop */}
        <div className="col-span-2 rounded-xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-[1.01]"
          style={{ border: "3px solid white", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transform: "rotate(-1deg)" }}>
          <img src={bascomHall} alt="Bascom Hall, UW-Madison" className="w-full h-48 md:h-64 object-cover" />
          <div style={{ height: 4, background: "#C5050C" }} />
        </div>

        {/* Bucky classroom */}
        <div className="rounded-xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-[1.03]"
          style={{ border: "3px solid white", boxShadow: "0 8px 25px rgba(0,0,0,0.1)", transform: "rotate(2deg)" }}>
          <img src={buckyClassroom} alt="Bucky with students in classroom" className="w-full h-48 md:h-64 object-cover" />
        </div>

        {/* Bucky basketball */}
        <div className="rounded-xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-[1.03]"
          style={{ border: "3px solid white", boxShadow: "0 8px 25px rgba(0,0,0,0.1)", transform: "rotate(-1.5deg)" }}>
          <img src={buckyBasketball} alt="Bucky dunking at Kohl Center" className="w-full h-36 md:h-48 object-cover" />
        </div>

        {/* Bucky football */}
        <div className="rounded-xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-[1.03]"
          style={{ border: "3px solid white", boxShadow: "0 8px 25px rgba(0,0,0,0.1)", transform: "rotate(1.5deg)" }}>
          <img src={buckyFootball} alt="Bucky scoring a touchdown" className="w-full h-36 md:h-48 object-cover" />
        </div>

        {/* Bucky lecture */}
        <div className="rounded-xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-[1.03]"
          style={{ border: "3px solid white", boxShadow: "0 8px 25px rgba(0,0,0,0.1)", transform: "rotate(-2deg)" }}>
          <img src={buckyLecture} alt="Bucky in lecture hall" className="w-full h-36 md:h-48 object-cover" />
        </div>
      </div>

      {/* Floating quote — below grid on mobile, overlaid on desktop */}
      <div className="max-w-4xl mx-auto mt-6 md:mt-8">
        <div className="mx-auto px-5 py-3.5 rounded-xl shadow-md inline-block"
          style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(197,5,12,0.12)", transform: "rotate(-0.5deg)", borderLeft: "3px solid #C5050C" }}>
          <p style={{ fontFamily: "'Red Hat Text', sans-serif", fontSize: 14, fontStyle: "italic", color: "#282728", lineHeight: 1.5, fontWeight: 500 }}>
            "Like having a tutor available 24/7 — right from my dorm room."
          </p>
          <p style={{ fontSize: 12, color: "#646569", marginTop: 4, fontWeight: 600 }}>— UW Junior, Biology</p>
        </div>
      </div>
    </section>
  );
}

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
    <div className="min-h-screen" style={{ background: "#FFFFFF", fontFamily: "'Red Hat Text', 'Source Sans 3', sans-serif" }}>
      {/* Red top bar */}
      <div className="fixed top-0 left-0 right-0 z-[60]" style={{ height: 4, background: "#C5050C" }} />

      {/* Nav — mobile responsive */}
      <nav className="fixed top-1 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
          padding: "8px 16px",
        }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <img src={uwLogo} alt="University of Wisconsin-Madison" className="h-12 md:h-20 object-contain flex-shrink-0" />
            <div className="hidden sm:block" style={{ borderLeft: "1px solid #DAD7CB", paddingLeft: 12 }}>
              <div style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 700, fontSize: 16, color: "#282728", lineHeight: 1.1 }}>AI Tutor</div>
              <div style={{ fontSize: 10, color: "#646569", fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>Powered by JIE Mastery</div>
            </div>
          </div>
          <Button onClick={() => { setActiveTab("login"); document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" }); }}
            className="text-white font-semibold px-4 md:px-6 py-2 rounded-lg text-sm flex-shrink-0" style={{ background: "#C5050C" }}>Sign In</Button>
        </div>
      </nav>

      {/* Hero — graduation photo visible on ALL screens */}
      <section className="relative" style={{ paddingTop: 100, paddingBottom: 40, background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          {/* Mobile: stacked. Desktop: side by side */}
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div style={{ animation: "fadeInUp 0.8s ease" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: "rgba(197,5,12,0.08)", border: "1px solid rgba(197,5,12,0.15)" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#28A745" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#C5050C" }}>Available 24/7 for UW Students</span>
              </div>
              <h1 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.08, color: "#282728", marginBottom: 20, letterSpacing: -1.5 }}>
                Your Personal<br /><span style={{ color: "#C5050C" }}>AI Tutor</span>
              </h1>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: "#646569", marginBottom: 32, maxWidth: 480 }}>
                Voice-powered tutoring that adapts to how you learn. Get instant help with coursework across every subject — explained the way you need to hear it.
              </p>
              <Button onClick={() => { setActiveTab("register"); document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" }); }}
                className="text-white font-semibold px-8 py-3 rounded-lg text-base flex items-center gap-2"
                style={{ background: "#C5050C", boxShadow: "0 4px 20px rgba(197,5,12,0.3)" }}>
                Start Tutoring <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Graduation photo — ALWAYS visible, responsive sizing */}
            <div className="flex justify-center items-center">
              <div className="relative w-full max-w-md">
                <div className="rounded-2xl overflow-hidden shadow-2xl"
                  style={{ transform: "rotate(1.5deg)", border: "4px solid white", boxShadow: "0 20px 50px rgba(0,0,0,0.14)" }}>
                  <img src={buckyGraduation} alt="Bucky Badger celebrating with graduates at UW-Madison" className="w-full h-auto" />
                </div>
                {/* Small accent photo — desktop only */}
                <div className="absolute rounded-lg overflow-hidden shadow-xl hidden md:block"
                  style={{ width: 120, bottom: -16, left: -20, transform: "rotate(-4deg)", border: "3px solid white", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
                  <img src={buckyTeaching} alt="Bucky teaching physics" className="w-full h-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Cover — 4-card grid */}
      <section className="py-12 md:py-20 px-4 md:px-12 max-w-7xl mx-auto" style={{ background: "#FFFFFF" }}>
        <div className="text-center mb-8 md:mb-12">
          <h2 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, color: "#282728", lineHeight: 1.15, marginBottom: 8 }}>
            Every subject. Every level.
          </h2>
          <p style={{ fontSize: 16, color: "#646569", maxWidth: 560, margin: "0 auto", lineHeight: 1.6, padding: "0 8px" }}>
            From freshman coursework to postgrad exam prep — your tutor adapts to wherever you are in your academic journey.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {[
            { icon: <Mic className="w-6 h-6" style={{ color: "#C5050C" }} />, title: "Voice-First Learning", desc: "Speak naturally and get clear, conversational explanations. Like office hours that never close." },
            { icon: <Brain className="w-6 h-6" style={{ color: "#C5050C" }} />, title: "Remembers Your Progress", desc: "Picks up where you left off. Knows your strengths and adapts to your gaps." },
            { icon: <FlaskConical className="w-6 h-6" style={{ color: "#C5050C" }} />, title: "All Core Subjects", desc: "Chemistry, Calculus, Physics, Biology, History, Economics, CS, Writing — and more." },
            { icon: <GraduationCap className="w-6 h-6" style={{ color: "#C5050C" }} />, title: "Postgrad Test Prep", desc: "GRE, GMAT, LSAT, MCAT, DAT, PCAT — targeted practice with instant feedback." },
          ].map((f, i) => (
            <div key={i} className="rounded-xl md:rounded-2xl p-5 md:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default" style={{ background: "#FFFFFF", border: "1px solid #E8E8E8" }}>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4" style={{ background: "rgba(197,5,12,0.06)" }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: "clamp(14px, 2vw, 18px)", fontWeight: 700, marginBottom: 6, color: "#282728" }}>{f.title}</h3>
              <p className="hidden md:block" style={{ fontSize: 14, lineHeight: 1.6, color: "#646569" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Photo Collage */}
      <PhotoCollage />

      {/* Auth */}
      <section id="auth-section" className="py-12 md:py-20 px-4 md:px-12 max-w-7xl mx-auto" style={{ background: "#FFFFFF" }}>
        <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="relative p-8 md:p-16 flex flex-col justify-center" style={{ background: "#C5050C" }}>
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 40px, white 40px, white 41px)" }} />
            <div className="relative z-10">
              <div className="mb-6 md:mb-10" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800, fontSize: 20, color: "white", letterSpacing: 1 }}>UW–MADISON</div>
              <h2 style={{ fontFamily: "'Red Hat Display', sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, color: "white", lineHeight: 1.15, marginBottom: 16 }}>Welcome,<br />Badger.</h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 360 }}>Your AI tutor is ready. Sign in to start a voice session, review past conversations, or track your learning progress.</p>
            </div>
          </div>
          <div className="p-6 md:p-14 flex flex-col justify-center" style={{ background: "white" }}>
            {verificationStatus === "success" && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: "#E8F5E9", border: "1px solid #28A745" }}>
                <p className="text-sm font-semibold" style={{ color: "#1B5E20" }}>Email verified! You can now sign in.</p>
              </div>
            )}
            <div className="flex mb-6 md:mb-8 rounded-lg p-1" style={{ background: "#F3F3F3" }}>
              {(["login", "register"] as const).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); loginForm.reset(); registerForm.reset(); }} className="flex-1 py-2.5 rounded-md text-sm font-semibold transition-all"
                  style={{ background: activeTab === tab ? "white" : "transparent", color: activeTab === tab ? "#282728" : "#646569", boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {tab === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
            {activeTab === "login" ? (
              <Form {...loginForm} key="login-form">
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 md:space-y-5">
                  <FormField control={loginForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>Email</FormLabel>
                      <FormControl><Input placeholder="student@wisc.edu" {...field} className="h-11 md:h-12 rounded-lg" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={loginForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ fontSize: 13, fontWeight: 600, color: "#3E3D3F" }}>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showLoginPassword ? "text" : "password"} placeholder="Enter your password" {...field} className="h-11 md:h-12 rounded-lg pr-10" />
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
                  <Button type="submit" disabled={loginMutation.isPending} className="w-full h-11 md:h-12 text-white font-semibold rounded-lg text-base" style={{ background: "#C5050C" }}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                  {loginMutation.isError && <p className="text-sm text-center" style={{ color: "#DC3545" }}>{(loginMutation.error as any)?.message || "Invalid credentials"}</p>}
                  <a href="/forgot-password" className="block text-center text-sm hover:underline" style={{ color: "#646569" }}>Forgot password?</a>
                </form>
              </Form>
            ) : (
              <Form {...registerForm} key="register-form">
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3 md:space-y-4">
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
                  <Button type="submit" disabled={registerMutation.isPending} className="w-full h-11 md:h-12 text-white font-semibold rounded-lg text-base" style={{ background: "#C5050C" }}
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
      <footer className="py-8 md:py-10 px-4 md:px-12 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4" style={{ borderTop: "1px solid #E8E8E8", background: "#FFFFFF" }}>
        <div className="flex items-center gap-3">
          <img src={uwLogo} alt="UW" className="h-8 object-contain" />
          <span style={{ fontSize: 12, color: "#646569" }}>University of Wisconsin–Madison · AI Tutor Program</span>
        </div>
        <span style={{ fontSize: 11, color: "#DAD7CB" }}>Powered by JIE Mastery</span>
      </footer>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
