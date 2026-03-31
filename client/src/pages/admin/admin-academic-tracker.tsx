import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Download,
  Send,
  AlertTriangle,
  Clock,
  BookOpen,
  Users,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  GraduationCap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ───────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  username: string;
  email: string;
  student_name: string;
  courses_loaded: number;
  engagement_score: number;
  risk_level: "on_track" | "needs_attention" | "at_risk" | "critical";
  trend: "improving" | "stable" | "declining";
  last_session_at: string | null;
  upcoming_deadlines: number;
  task_completion_rate: number;
}

interface StudentsResponse {
  students: Student[];
  total: number;
  page: number;
  totalPages: number;
}

interface StudentDetail {
  user: { id: string; username: string; email: string; studentName: string };
  courses: Array<{
    id: string;
    courseName: string;
    courseCode: string;
    instructor: string;
    semester: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    eventType: string;
    startDate: string;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    taskType: string;
    dueDate: string;
    status: string;
    priority: string;
  }>;
  engagementHistory: Array<{
    weekStart: string;
    engagementScore: string;
    trend: "improving" | "stable" | "declining";
    riskLevel: string;
  }>;
}

interface Alerts {
  noActivity: Array<{ id: string; student_name: string; email: string; last_session: string | null }>;
  lowEngagement: Array<{ id: string; student_name: string; email: string; engagement_score: number; risk_level: string }>;
  missedDeadlines: Array<{ id: string; student_name: string; email: string; missed_count: number }>;
  examUnprepared: Array<{ id: string; student_name: string; email: string; exam_title: string; start_date: string }>;
}

interface Reports {
  avgEngagementScore: string;
  activeUsersThisWeek: number;
  totalStudyHoursThisWeek: string;
  riskDistribution: Array<{ risk_level: string; count: number }>;
  courseEngagement: Array<{
    course_name: string;
    course_code: string;
    avg_engagement: number;
    student_count: number;
  }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  on_track: "bg-green-500/10 text-green-700 border-green-500/30",
  needs_attention: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  at_risk: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  critical: "bg-red-500/10 text-red-700 border-red-500/30",
};

const RISK_LABELS: Record<string, string> = {
  on_track: "On Track",
  needs_attention: "Needs Attention",
  at_risk: "At Risk",
  critical: "Critical",
};

const RISK_BAR_COLORS: Record<string, string> = {
  on_track: "bg-green-500",
  needs_attention: "bg-yellow-500",
  at_risk: "bg-orange-500",
  critical: "bg-red-500",
};

function RiskBadge({ level }: { level: string }) {
  return (
    <Badge
      variant="outline"
      className={`${RISK_COLORS[level] || ""} text-xs font-medium`}
    >
      {RISK_LABELS[level] || level}
    </Badge>
  );
}

function TrendIndicator({ trend }: { trend: string }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
        <ArrowUp className="h-3.5 w-3.5" />
        Up
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
        <ArrowDown className="h-3.5 w-3.5" />
        Down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-500 text-sm font-medium">
      <Minus className="h-3.5 w-3.5" />
      Stable
    </span>
  );
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return "Never";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AdminAcademicTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Student list state
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Detail modal state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("courses");

  // Nudge state
  const [nudgeTarget, setNudgeTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────

  const studentsQuery = useQuery<StudentsResponse>({
    queryKey: [
      `/api/admin/academic/students?search=${encodeURIComponent(searchQuery)}&riskLevel=${riskFilter}&sortBy=${sortBy}&page=${page}&limit=${limit}`,
    ],
  });

  const studentDetailQuery = useQuery<StudentDetail>({
    queryKey: [`/api/admin/academic/students/${selectedStudentId}`],
    enabled: selectedStudentId !== null,
  });

  const alertsQuery = useQuery<Alerts>({
    queryKey: ["/api/admin/academic/alerts"],
  });

  const reportsQuery = useQuery<Reports>({
    queryKey: ["/api/admin/academic/reports"],
  });

  // ── Mutations ───────────────────────────────────────────────────────────

  const nudgeMutation = useMutation({
    mutationFn: async (payload: { userId: number; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/academic/nudge", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Nudge sent",
        description: `Message sent to ${nudgeTarget?.name || "student"}.`,
      });
      setNudgeTarget(null);
      setNudgeMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send nudge",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    try {
      const response = await fetch("/api/admin/academic/export", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `academic-tracker-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Export complete", description: "CSV file downloaded." });
    } catch {
      toast({
        title: "Export failed",
        description: "Unable to download the CSV. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendNudge = () => {
    if (!nudgeTarget || !nudgeMessage.trim()) return;
    nudgeMutation.mutate({
      userId: nudgeTarget.userId,
      message: nudgeMessage.trim(),
    });
  };

  const openNudgeDialog = (userId: string, name: string) => {
    setNudgeTarget({ userId, name });
    setNudgeMessage("");
  };

  // ── Alert counts ────────────────────────────────────────────────────────

  const alertCounts = {
    noActivity: alertsQuery.data?.noActivity?.length ?? 0,
    lowEngagement: alertsQuery.data?.lowEngagement?.length ?? 0,
    missedDeadlines: alertsQuery.data?.missedDeadlines?.length ?? 0,
    examUnprepared: alertsQuery.data?.examUnprepared?.length ?? 0,
  };

  const totalAlerts =
    alertCounts.noActivity +
    alertCounts.lowEngagement +
    alertCounts.missedDeadlines +
    alertCounts.examUnprepared;

  // ── Pagination ──────────────────────────────────────────────────────────

  const totalPages = studentsQuery.data?.totalPages ?? 1;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Academic Tracker</h1>
        <p className="text-muted-foreground">
          Monitor student academic progress, engagement, and risk levels across
          all courses.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students" className="gap-2">
            <Users className="h-4 w-4" />
            Student Tracker
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
            {totalAlerts > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-5 min-w-[20px] px-1 text-xs"
              >
                {totalAlerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* ── Student Tracker Tab ──────────────────────────────────────── */}
        <TabsContent value="students" className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={riskFilter}
              onValueChange={(val) => {
                setRiskFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="needs_attention">Needs Attention</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="engagement">Engagement Score</SelectItem>
                <SelectItem value="risk">Risk Level</SelectItem>
                <SelectItem value="lastActive">Last Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Student Table */}
          <Card>
            <CardContent className="p-0">
              {studentsQuery.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : studentsQuery.data &&
                studentsQuery.data.students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Courses</TableHead>
                      <TableHead className="text-center">
                        Engagement
                      </TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-center">Tasks Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsQuery.data.students.map((student) => (
                      <TableRow
                        key={student.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <TableCell className="font-medium">
                          {student.student_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {student.email}
                        </TableCell>
                        <TableCell className="text-center">
                          {student.courses_loaded}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-semibold ${
                              student.engagement_score >= 70
                                ? "text-green-600"
                                : student.engagement_score >= 40
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {student.engagement_score}
                          </span>
                        </TableCell>
                        <TableCell>
                          <RiskBadge level={student.risk_level} />
                        </TableCell>
                        <TableCell>
                          <TrendIndicator trend={student.trend} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastActive(student.last_session_at)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {Math.round(student.task_completion_rate * 100)}%
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNudgeDialog(
                                student.id,
                                student.student_name,
                              );
                            }}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Nudge
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  No students found matching your filters.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {studentsQuery.data && studentsQuery.data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {page} of {totalPages} ({studentsQuery.data.total}{" "}
                students)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Alerts Tab ───────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-4">
          {alertsQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : alertsQuery.data ? (
            <div className="grid gap-4 md:grid-cols-2">
              {/* No Activity */}
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="bg-red-50 dark:bg-red-900/20 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-red-800 dark:text-red-200 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      No Activity (7+ days)
                    </CardTitle>
                    <Badge variant="destructive">{alertCounts.noActivity}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 max-h-64 overflow-y-auto">
                  {alertsQuery.data.noActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No alerts
                    </p>
                  ) : (
                    alertsQuery.data.noActivity.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between border-b pb-2 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {alert.student_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {alert.email} -- last active: {alert.last_session ? new Date(alert.last_session).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openNudgeDialog(alert.id, alert.student_name)
                          }
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Low Engagement */}
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader className="bg-orange-50 dark:bg-orange-900/20 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-orange-800 dark:text-orange-200 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Low Engagement (score &lt; 40)
                    </CardTitle>
                    <Badge className="bg-orange-500 text-white hover:bg-orange-600">
                      {alertCounts.lowEngagement}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 max-h-64 overflow-y-auto">
                  {alertsQuery.data.lowEngagement.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No alerts
                    </p>
                  ) : (
                    alertsQuery.data.lowEngagement.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between border-b pb-2 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {alert.student_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {alert.email} -- Score: {alert.engagement_score}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openNudgeDialog(alert.id, alert.student_name)
                          }
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Missed Deadlines */}
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader className="bg-amber-50 dark:bg-amber-900/20 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Missed Deadlines (3+)
                    </CardTitle>
                    <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                      {alertCounts.missedDeadlines}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 max-h-64 overflow-y-auto">
                  {alertsQuery.data.missedDeadlines.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No alerts
                    </p>
                  ) : (
                    alertsQuery.data.missedDeadlines.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between border-b pb-2 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {alert.student_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {alert.email} -- {alert.missed_count} missed
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openNudgeDialog(alert.id, alert.student_name)
                          }
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Exam Unprepared */}
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="bg-purple-50 dark:bg-purple-900/20 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-purple-800 dark:text-purple-200 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Exam Unprepared
                    </CardTitle>
                    <Badge className="bg-purple-500 text-white hover:bg-purple-600">
                      {alertCounts.examUnprepared}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 max-h-64 overflow-y-auto">
                  {alertsQuery.data.examUnprepared.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No alerts
                    </p>
                  ) : (
                    alertsQuery.data.examUnprepared.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between border-b pb-2 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {alert.student_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {alert.email} -- {alert.exam_title}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openNudgeDialog(alert.id, alert.student_name)
                          }
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Unable to load alerts.
            </p>
          )}
        </TabsContent>

        {/* ── Reports Tab ──────────────────────────────────────────────── */}
        <TabsContent value="reports" className="space-y-6">
          {reportsQuery.isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : reportsQuery.data ? (
            <>
              {/* Stat Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Avg Engagement Score
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {reportsQuery.data.avgEngagementScore}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Across all active students
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Users This Week
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {reportsQuery.data.activeUsersThisWeek}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Students with sessions in 7 days
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Study Hours This Week
                    </CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {reportsQuery.data.totalStudyHoursThisWeek}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total hours across all students
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of students by risk level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const distArr = reportsQuery.data!.riskDistribution;
                    const distMap: Record<string, number> = {};
                    for (const d of distArr) distMap[d.risk_level] = Number(d.count);
                    const total = Object.values(distMap).reduce((s, v) => s + v, 0);
                    if (total === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No student data available.
                        </p>
                      );
                    }
                    const pct = (val: number) =>
                      ((val / total) * 100).toFixed(1);
                    const levels = [
                      { key: 'on_track', label: 'On Track', color: 'bg-green-500', dotColor: 'bg-green-500' },
                      { key: 'needs_attention', label: 'Needs Attention', color: 'bg-yellow-500', dotColor: 'bg-yellow-500' },
                      { key: 'at_risk', label: 'At Risk', color: 'bg-orange-500', dotColor: 'bg-orange-500' },
                      { key: 'critical', label: 'Critical', color: 'bg-red-500', dotColor: 'bg-red-500' },
                    ];
                    return (
                      <div className="space-y-3">
                        <div className="flex h-6 w-full rounded-md overflow-hidden">
                          {levels.map(l => {
                            const val = distMap[l.key] || 0;
                            if (val === 0) return null;
                            return (
                              <div
                                key={l.key}
                                className={`${l.color} transition-all`}
                                style={{ width: `${pct(val)}%` }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          {levels.map(l => (
                            <div key={l.key} className="flex items-center gap-2">
                              <div className={`h-3 w-3 rounded-sm ${l.dotColor}`} />
                              <span>
                                {l.label}: {distMap[l.key] || 0} ({pct(distMap[l.key] || 0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Course Engagement */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Course Engagement
                    </CardTitle>
                    <CardDescription>
                      Engagement scores by course
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {reportsQuery.data.courseEngagement.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No course data available.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-center">
                            Students
                          </TableHead>
                          <TableHead className="text-center">
                            Engagement Score
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportsQuery.data.courseEngagement.map((course) => (
                          <TableRow key={course.course_code}>
                            <TableCell className="font-medium">
                              {course.course_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {course.course_code}
                            </TableCell>
                            <TableCell className="text-center">
                              {course.student_count}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`font-semibold ${
                                  Number(course.avg_engagement) >= 70
                                    ? "text-green-600"
                                    : Number(course.avg_engagement) >= 40
                                      ? "text-yellow-600"
                                      : "text-red-600"
                                }`}
                              >
                                {Number(course.avg_engagement).toFixed(1)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Unable to load reports.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Student Detail Dialog ────────────────────────────────────────── */}
      <Dialog
        open={selectedStudentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudentId(null);
            setDetailTab("courses");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {studentDetailQuery.data?.user.studentName || studentDetailQuery.data?.user.username || "Student Details"}
            </DialogTitle>
            <DialogDescription>
              {studentDetailQuery.data?.user.email || "Loading student information..."}
            </DialogDescription>
          </DialogHeader>

          {studentDetailQuery.isLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : studentDetailQuery.data ? (
            <div className="space-y-4">
              {/* Student Summary — use list row data for aggregate stats */}
              {(() => {
                const listStudent = studentsQuery.data?.students.find(s => s.id === selectedStudentId);
                const latestEngagement = studentDetailQuery.data.engagementHistory[0];
                return (
                  <div className="flex flex-wrap gap-3">
                    <RiskBadge level={latestEngagement?.riskLevel || listStudent?.risk_level || 'on_track'} />
                    <TrendIndicator trend={(latestEngagement?.trend || listStudent?.trend || 'stable') as any} />
                    <Badge variant="outline">
                      Engagement: {latestEngagement?.engagementScore || listStudent?.engagement_score || 0}
                    </Badge>
                    <Badge variant="outline">
                      Tasks: {listStudent?.task_completion_rate ?? 0}%
                    </Badge>
                  </div>
                );
              })()}

              {/* Detail Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="courses" className="flex-1">
                    Courses
                  </TabsTrigger>
                  <TabsTrigger value="events" className="flex-1">
                    Events
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="flex-1">
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger value="engagement" className="flex-1">
                    Engagement
                  </TabsTrigger>
                </TabsList>

                {/* Courses */}
                <TabsContent value="courses">
                  {studentDetailQuery.data.courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No courses loaded.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {studentDetailQuery.data.courses.map((course) => (
                        <div
                          key={course.id}
                          className="flex items-center justify-between border rounded-lg p-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {course.courseName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {course.courseCode} -- {course.instructor}{course.semester ? ` (${course.semester})` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Events */}
                <TabsContent value="events">
                  {studentDetailQuery.data.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No calendar events.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentDetailQuery.data.events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium text-sm">
                              {event.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {event.eventType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(event.startDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  event.status === "completed"
                                    ? "text-green-600 border-green-300"
                                    : event.status === "upcoming"
                                      ? "text-blue-600 border-blue-300"
                                      : "text-gray-600 border-gray-300"
                                }`}
                              >
                                {event.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Tasks */}
                <TabsContent value="tasks">
                  {studentDetailQuery.data.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No tasks found.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentDetailQuery.data.tasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell className="font-medium text-sm">
                              {task.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {task.taskType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  task.status === "completed"
                                    ? "text-green-600 border-green-300"
                                    : task.status === "overdue"
                                      ? "text-red-600 border-red-300"
                                      : task.status === "in_progress"
                                        ? "text-blue-600 border-blue-300"
                                        : "text-gray-600 border-gray-300"
                                }`}
                              >
                                {task.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  task.priority === "high"
                                    ? "text-red-600 border-red-300"
                                    : task.priority === "medium"
                                      ? "text-yellow-600 border-yellow-300"
                                      : "text-gray-600 border-gray-300"
                                }`}
                              >
                                {task.priority}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Engagement History */}
                <TabsContent value="engagement">
                  {studentDetailQuery.data.engagementHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No engagement history available.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {studentDetailQuery.data.engagementHistory.map(
                        (entry, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between border rounded-lg p-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">
                                {entry.weekStart}
                              </span>
                              <TrendIndicator trend={entry.trend} />
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                Number(entry.engagementScore) >= 70
                                  ? "text-green-600"
                                  : Number(entry.engagementScore) >= 40
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {entry.engagementScore}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Send Nudge from Detail */}
              <div className="pt-2 border-t">
                <Button
                  variant="default"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() =>
                    openNudgeDialog(
                      studentDetailQuery.data!.user.id,
                      studentDetailQuery.data!.user.studentName || studentDetailQuery.data!.user.username,
                    )
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Nudge
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Unable to load student details.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Nudge Dialog ─────────────────────────────────────────────────── */}
      <Dialog
        open={nudgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNudgeTarget(null);
            setNudgeMessage("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Nudge</DialogTitle>
            <DialogDescription>
              Send a message to {nudgeTarget?.name || "this student"} to encourage engagement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Write a personalized message to the student..."
              value={nudgeMessage}
              onChange={(e) => setNudgeMessage(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNudgeTarget(null);
                  setNudgeMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={
                  !nudgeMessage.trim() || nudgeMutation.isPending
                }
                onClick={handleSendNudge}
              >
                {nudgeMutation.isPending ? "Sending..." : "Send Nudge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
