import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/UserAvatar";
import uwLogo from "@/assets/uw-madison-logo.png";

export function NavigationHeader() {
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: dashboard } = useQuery<{
    user?: { name?: string; firstName?: string; initials?: string };
  }>({
    queryKey: ["/api/dashboard"],
    enabled: !!user,
  });
  
  const displayName = dashboard?.user?.name || 
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 
    user?.username || 
    'Student';

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => location === path;

  return (
    <nav style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8E8", position: "sticky", top: 0, zIndex: 50 }}>
      {/* Red top bar */}
      <div style={{ height: 4, background: "#C5050C" }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setLocation("/tutor")}>
            <img src={uwLogo} alt="University of Wisconsin-Madison" style={{ height: 48 }} />
            <div style={{ borderLeft: "1px solid #DAD7CB", paddingLeft: 12 }}>
              <div style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 700, fontSize: 16, color: "#282728", lineHeight: 1.1 }}>AI Tutor</div>
              <div style={{ fontSize: 10, color: "#646569", fontWeight: 500, letterSpacing: 1, textTransform: "uppercase" }}>University of Wisconsin</div>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "Tutor", path: "/tutor" },
              { label: "Dashboard", path: "/dashboard" },
              { label: "Settings", path: "/settings" },
              ...(user?.role === "admin" ? [{ label: "Admin", path: "/admin" }] : []),
            ].map(item => (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: isActive(item.path) ? 600 : 500,
                  color: isActive(item.path) ? "#C5050C" : "#646569",
                  background: isActive(item.path) ? "rgba(197,5,12,0.06)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Red Hat Text', sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <UserAvatar name={displayName} size="sm" />
                  <span className="hidden sm:inline text-sm font-medium" style={{ color: "#282728" }}>{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/profile")}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  Settings
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem onClick={() => setLocation("/admin")}>
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
