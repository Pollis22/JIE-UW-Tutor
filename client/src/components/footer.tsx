import { useLocation } from "wouter";
import uwLogo from "@/assets/uw-madison-logo.png";

export function Footer() {
  const [, setLocation] = useLocation();

  return (
    <footer style={{ background: "#FFFFFF", borderTop: "1px solid #E8E8E8", padding: "32px 0", marginTop: "auto" }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <div className="flex flex-wrap justify-center md:justify-start gap-6">
            <button onClick={() => setLocation("/terms")} className="text-sm hover:underline" style={{ color: "#646569", background: "none", border: "none", cursor: "pointer" }}>
              Terms & Conditions
            </button>
            <button onClick={() => setLocation("/privacy")} className="text-sm hover:underline" style={{ color: "#646569", background: "none", border: "none", cursor: "pointer" }}>
              Privacy Policy
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-4" style={{ borderTop: "1px solid #E8E8E8" }}>
          <div className="flex items-center gap-3">
            <img src={uwLogo} alt="UW" style={{ height: 32 }} />
            <span style={{ fontSize: 13, color: "#646569" }}>University of Wisconsin–Madison · AI Tutor Program</span>
          </div>
          <span style={{ fontSize: 12, color: "#DAD7CB" }}>Powered by JIE Mastery</span>
        </div>
      </div>
    </footer>
  );
}
