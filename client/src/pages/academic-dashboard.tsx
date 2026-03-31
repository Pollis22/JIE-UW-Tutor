import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AcademicSummary {
  upcomingEvents: CalendarEvent[];
  pendingTasks: StudentTask[];
  undeliveredReminders: Reminder[];
  coursesCount: number;
}

interface StudentCourse {
  id: string;
  userId: string;
  courseName: string;
  courseCode?: string;
  instructor?: string;
  semester?: string;
  color?: string;
  syllabusText?: string;
  syllabusUploadedAt?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface CalendarEvent {
  id: string;
  userId: string;
  courseId?: string;
  title: string;
  eventType: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  isAllDay?: boolean;
  isFromSyllabus?: boolean;
  priority?: string;
  description?: string;
  status?: string;
  notes?: string;
  courseName?: string;
  courseColor?: string;
}

interface StudentTask {
  id: string;
  userId: string;
  courseId?: string;
  eventId?: string;
  title: string;
  taskType?: string;
  dueDate?: string;
  priority?: string;
  status: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  notes?: string;
  completedAt?: string;
  courseName?: string;
  courseColor?: string;
}

interface EngagementData {
  currentScore: number;
  riskLevel: string;
  streak: number;
  history: { weekStart?: string; engagementScore?: string; trend?: string; riskLevel?: string }[];
  thisWeek: {
    sessions: number;
    tasksCompleted: number;
    activeDays: number;
  };
}

interface Reminder {
  id: string;
  userId: string;
  eventId?: string;
  taskId?: string;
  reminderType?: string;
  reminderDate?: string;
  message?: string;
  delivered: boolean;
  deliveryMethod?: string;
  createdAt?: string;
}

interface ParentShare {
  id: string;
  userId: string;
  parentEmail: string;
  parentName?: string;
  shareFrequency?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface SyllabusResult {
  courseName: string;
  instructor: string;
  eventsCreated: number;
  events: { title: string; date: string; type: string }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSE_COLORS = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  exam: "bg-red-100 text-red-800",
  quiz: "bg-orange-100 text-orange-800",
  assignment: "bg-blue-100 text-blue-800",
  lecture: "bg-purple-100 text-purple-800",
  lab: "bg-green-100 text-green-800",
  office_hours: "bg-teal-100 text-teal-800",
  other: "bg-gray-100 text-gray-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function isPast(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AcademicDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState("courses");

  // ---- Summary query ----
  const { data: summary, isLoading: summaryLoading } =
    useQuery<AcademicSummary>({
      queryKey: ["/api/academic/summary"],
      enabled: !!user,
    });

  // ========================================================================
  // COURSES TAB STATE & QUERIES
  // ========================================================================
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<StudentCourse | null>(
    null,
  );
  const [syllabusTarget, setSyllabusTarget] = useState<StudentCourse | null>(
    null,
  );
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusResult, setSyllabusResult] = useState<SyllabusResult | null>(
    null,
  );

  // Course form
  const [courseForm, setCourseForm] = useState({
    courseName: "",
    courseCode: "",
    instructor: "",
    semester: "",
    color: COURSE_COLORS[0],
  });

  const resetCourseForm = () =>
    setCourseForm({
      courseName: "",
      courseCode: "",
      instructor: "",
      semester: "",
      color: COURSE_COLORS[0],
    });

  const { data: courses = [], isLoading: coursesLoading } = useQuery<
    StudentCourse[]
  >({
    queryKey: ["/api/academic/courses"],
    enabled: !!user,
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: typeof courseForm) => {
      const res = await apiRequest("POST", "/api/academic/courses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      toast({ description: "Course created!" });
      setShowAddCourse(false);
      resetCourseForm();
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<StudentCourse> & { id: number }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/academic/courses/${id}`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/courses"] });
      toast({ description: "Course updated!" });
      setEditingCourse(null);
      resetCourseForm();
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/academic/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      toast({ description: "Course deleted." });
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const processSyllabusMutation = useMutation({
    mutationFn: async ({
      courseId,
      syllabusText: text,
    }: {
      courseId: number;
      syllabusText: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/academic/courses/${courseId}/process-syllabus`,
        { syllabusText: text },
      );
      return res.json() as Promise<SyllabusResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      setSyllabusResult(data);
      toast({
        description: `Syllabus processed! ${data.eventsCreated} events created.`,
      });
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  // ========================================================================
  // CALENDAR TAB STATE & QUERIES
  // ========================================================================
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    eventType: "assignment",
    courseId: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const calStartDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  const calEndDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${getDaysInMonth(calYear, calMonth)}`;

  const { data: events = [], isLoading: eventsLoading } = useQuery<
    CalendarEvent[]
  >({
    queryKey: [
      "/api/academic/events",
      { startDate: calStartDate, endDate: calEndDate },
    ],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/academic/events?startDate=${calStartDate}&endDate=${calEndDate}`,
      );
      return res.json();
    },
    enabled: !!user,
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        eventType: data.eventType,
        startDate: data.startDate,
        description: data.description,
      };
      if (data.courseId) payload.courseId = Number(data.courseId);
      if (data.endDate) payload.endDate = data.endDate;
      const res = await apiRequest("POST", "/api/academic/events", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      toast({ description: "Event created!" });
      setShowAddEvent(false);
      setEventForm({
        title: "",
        eventType: "assignment",
        courseId: "",
        startDate: "",
        endDate: "",
        description: "",
      });
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/academic/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      toast({ description: "Event deleted." });
    },
  });

  // Build a map: day-of-month -> events for the calendar grid
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.startDate);
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(ev);
      }
    }
    return map;
  }, [events, calMonth, calYear]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter((ev) => isSameDay(new Date(ev.startDate), selectedDay));
  }, [events, selectedDay]);

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // ========================================================================
  // TASKS TAB STATE & QUERIES
  // ========================================================================
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskCourseFilter, setTaskCourseFilter] = useState("all");
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    taskType: "",
    courseId: "",
    dueDate: "",
    priority: "medium",
    estimatedMinutes: "",
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<StudentTask[]>({
    queryKey: ["/api/academic/tasks"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/academic/tasks?sortBy=dueDate",
      );
      return res.json();
    },
    enabled: !!user,
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter)
        return false;
      if (
        taskCourseFilter !== "all" &&
        String(t.courseId) !== taskCourseFilter
      )
        return false;
      return true;
    });
  }, [tasks, taskStatusFilter, taskCourseFilter]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        priority: data.priority,
      };
      if (data.taskType) payload.taskType = data.taskType;
      if (data.courseId) payload.courseId = Number(data.courseId);
      if (data.dueDate) payload.dueDate = data.dueDate;
      if (data.estimatedMinutes)
        payload.estimatedMinutes = Number(data.estimatedMinutes);
      const res = await apiRequest("POST", "/api/academic/tasks", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      toast({ description: "Task created!" });
      setShowAddTask(false);
      setTaskForm({
        title: "",
        taskType: "",
        courseId: "",
        dueDate: "",
        priority: "medium",
        estimatedMinutes: "",
      });
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/academic/tasks/${id}`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/engagement"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/academic/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/academic/summary"] });
      toast({ description: "Task deleted." });
    },
  });

  // ========================================================================
  // ENGAGEMENT TAB QUERIES
  // ========================================================================
  const { data: engagement, isLoading: engagementLoading } =
    useQuery<EngagementData>({
      queryKey: ["/api/academic/engagement"],
      enabled: !!user,
    });

  // ========================================================================
  // SETTINGS TAB STATE & QUERIES
  // ========================================================================
  const [showAddParent, setShowAddParent] = useState(false);
  const [parentForm, setParentForm] = useState({
    parentEmail: "",
    parentName: "",
    shareFrequency: "weekly",
  });

  const { data: parentShares = [], isLoading: sharesLoading } = useQuery<
    ParentShare[]
  >({
    queryKey: ["/api/academic/parent-shares"],
    enabled: !!user,
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery<
    Reminder[]
  >({
    queryKey: ["/api/academic/reminders"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/academic/reminders?delivered=false",
      );
      return res.json();
    },
    enabled: !!user,
  });

  const createParentShareMutation = useMutation({
    mutationFn: async (data: typeof parentForm) => {
      const res = await apiRequest(
        "POST",
        "/api/academic/parent-shares",
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/academic/parent-shares"],
      });
      toast({ description: "Parent share added!" });
      setShowAddParent(false);
      setParentForm({
        parentEmail: "",
        parentName: "",
        shareFrequency: "weekly",
      });
    },
    onError: (err: Error) => {
      toast({ description: err.message, variant: "destructive" });
    },
  });

  const deleteParentShareMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/academic/parent-shares/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/academic/parent-shares"],
      });
      toast({ description: "Parent share removed." });
    },
  });

  const dismissReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/academic/reminders/${id}`, {
        delivered: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/academic/reminders"],
      });
    },
  });

  // ========================================================================
  // RENDER
  // ========================================================================

  const displayName =
    (user as any)?.studentName ||
    (user as any)?.firstName ||
    user?.username ||
    "Student";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ---- Header ---- */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Academic Command Center
          </h1>
          <p className="mt-1 text-indigo-100">
            Welcome back, {displayName}
          </p>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-20 rounded-xl bg-white/20"
                  />
                ))}
              </>
            ) : (
              <>
                <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4">
                  <p className="text-sm text-indigo-100">Courses</p>
                  <p className="text-2xl font-bold">
                    {summary?.coursesCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4">
                  <p className="text-sm text-indigo-100">Upcoming Events</p>
                  <p className="text-2xl font-bold">
                    {summary?.upcomingEvents?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4">
                  <p className="text-sm text-indigo-100">Pending Tasks</p>
                  <p className="text-2xl font-bold">
                    {summary?.pendingTasks?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4">
                  <p className="text-sm text-indigo-100">Reminders</p>
                  <p className="text-2xl font-bold">
                    {summary?.undeliveredReminders?.length ?? 0}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- Tabs ---- */}
      <div className="container mx-auto px-4 -mt-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="bg-white shadow-md rounded-xl h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="courses" className="rounded-lg">
              Courses
            </TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-lg">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-lg">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="engagement" className="rounded-lg">
              Engagement
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg">
              Settings
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* COURSES TAB                                                   */}
          {/* ============================================================ */}
          <TabsContent value="courses" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">My Courses</h2>
              <Dialog open={showAddCourse} onOpenChange={setShowAddCourse}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetCourseForm();
                      setShowAddCourse(true);
                    }}
                  >
                    + Add Course
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Course</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="courseName">Course Name *</Label>
                      <Input
                        id="courseName"
                        value={courseForm.courseName}
                        onChange={(e) =>
                          setCourseForm((f) => ({
                            ...f,
                            courseName: e.target.value,
                          }))
                        }
                        placeholder="e.g. Introduction to Psychology"
                      />
                    </div>
                    <div>
                      <Label htmlFor="courseCode">Course Code</Label>
                      <Input
                        id="courseCode"
                        value={courseForm.courseCode}
                        onChange={(e) =>
                          setCourseForm((f) => ({
                            ...f,
                            courseCode: e.target.value,
                          }))
                        }
                        placeholder="e.g. PSY 101"
                      />
                    </div>
                    <div>
                      <Label htmlFor="instructor">Instructor</Label>
                      <Input
                        id="instructor"
                        value={courseForm.instructor}
                        onChange={(e) =>
                          setCourseForm((f) => ({
                            ...f,
                            instructor: e.target.value,
                          }))
                        }
                        placeholder="e.g. Dr. Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor="semester">Semester</Label>
                      <Input
                        id="semester"
                        value={courseForm.semester}
                        onChange={(e) =>
                          setCourseForm((f) => ({
                            ...f,
                            semester: e.target.value,
                          }))
                        }
                        placeholder="e.g. Spring 2026"
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <div className="flex gap-2 mt-1">
                        {COURSE_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              courseForm.color === c
                                ? "border-gray-900 scale-110"
                                : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                            onClick={() =>
                              setCourseForm((f) => ({ ...f, color: c }))
                            }
                            aria-label={`Select color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        !courseForm.courseName.trim() ||
                        createCourseMutation.isPending
                      }
                      onClick={() => createCourseMutation.mutate(courseForm)}
                    >
                      {createCourseMutation.isPending
                        ? "Creating..."
                        : "Create Course"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {coursesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <Card className="py-12 text-center">
                <CardContent>
                  <p className="text-muted-foreground">
                    No courses yet. Add your first course to get started!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => (
                  <Card
                    key={course.id}
                    className="overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div
                      className="h-2"
                      style={{
                        backgroundColor: course.color || COURSE_COLORS[0],
                      }}
                    />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {course.courseName}
                          </CardTitle>
                          {course.courseCode && (
                            <CardDescription>{course.courseCode}</CardDescription>
                          )}
                        </div>
                        {course.syllabusProcessed && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 text-xs"
                          >
                            Syllabus Loaded
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {course.instructor && (
                        <p className="text-sm text-muted-foreground">
                          Instructor: {course.instructor}
                        </p>
                      )}
                      {course.semester && (
                        <p className="text-sm text-muted-foreground">
                          Semester: {course.semester}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSyllabusTarget(course);
                                setSyllabusText("");
                                setSyllabusResult(null);
                              }}
                            >
                              Process Syllabus
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>
                                Process Syllabus - {course.courseName}
                              </DialogTitle>
                            </DialogHeader>
                            {syllabusResult &&
                            syllabusTarget?.id === course.id ? (
                              <div className="space-y-3 pt-2">
                                <p className="text-sm font-medium text-green-700">
                                  Syllabus processed successfully!
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {syllabusResult.eventsCreated} events created
                                  for {syllabusResult.courseName}
                                </p>
                                {syllabusResult.instructor && (
                                  <p className="text-sm text-muted-foreground">
                                    Instructor: {syllabusResult.instructor}
                                  </p>
                                )}
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {syllabusResult.events.map((ev, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                                    >
                                      <span>{ev.title}</span>
                                      <span className="text-muted-foreground text-xs">
                                        {ev.type} - {formatDate(ev.date)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4 pt-2">
                                <div>
                                  <Label>Paste Syllabus Text</Label>
                                  <Textarea
                                    rows={10}
                                    value={syllabusText}
                                    onChange={(e) =>
                                      setSyllabusText(e.target.value)
                                    }
                                    placeholder="Paste your syllabus content here..."
                                    className="mt-1"
                                  />
                                </div>
                                <Button
                                  className="w-full"
                                  disabled={
                                    !syllabusText.trim() ||
                                    processSyllabusMutation.isPending
                                  }
                                  onClick={() =>
                                    processSyllabusMutation.mutate({
                                      courseId: course.id,
                                      syllabusText,
                                    })
                                  }
                                >
                                  {processSyllabusMutation.isPending
                                    ? "Processing..."
                                    : "Process Syllabus"}
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        <Dialog
                          open={editingCourse?.id === course.id}
                          onOpenChange={(open) => {
                            if (open) {
                              setEditingCourse(course);
                              setCourseForm({
                                courseName: course.courseName,
                                courseCode: course.courseCode || "",
                                instructor: course.instructor || "",
                                semester: course.semester || "",
                                color: course.color || COURSE_COLORS[0],
                              });
                            } else {
                              setEditingCourse(null);
                              resetCourseForm();
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Course</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div>
                                <Label htmlFor="editCourseName">
                                  Course Name *
                                </Label>
                                <Input
                                  id="editCourseName"
                                  value={courseForm.courseName}
                                  onChange={(e) =>
                                    setCourseForm((f) => ({
                                      ...f,
                                      courseName: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="editCourseCode">
                                  Course Code
                                </Label>
                                <Input
                                  id="editCourseCode"
                                  value={courseForm.courseCode}
                                  onChange={(e) =>
                                    setCourseForm((f) => ({
                                      ...f,
                                      courseCode: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="editInstructor">
                                  Instructor
                                </Label>
                                <Input
                                  id="editInstructor"
                                  value={courseForm.instructor}
                                  onChange={(e) =>
                                    setCourseForm((f) => ({
                                      ...f,
                                      instructor: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="editSemester">Semester</Label>
                                <Input
                                  id="editSemester"
                                  value={courseForm.semester}
                                  onChange={(e) =>
                                    setCourseForm((f) => ({
                                      ...f,
                                      semester: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label>Color</Label>
                                <div className="flex gap-2 mt-1">
                                  {COURSE_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                                        courseForm.color === c
                                          ? "border-gray-900 scale-110"
                                          : "border-transparent"
                                      }`}
                                      style={{ backgroundColor: c }}
                                      onClick={() =>
                                        setCourseForm((f) => ({
                                          ...f,
                                          color: c,
                                        }))
                                      }
                                      aria-label={`Select color ${c}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <Button
                                className="w-full"
                                disabled={
                                  !courseForm.courseName.trim() ||
                                  updateCourseMutation.isPending
                                }
                                onClick={() =>
                                  updateCourseMutation.mutate({
                                    id: course.id,
                                    courseName: courseForm.courseName,
                                    courseCode: courseForm.courseCode || undefined,
                                    instructor:
                                      courseForm.instructor || undefined,
                                    semester: courseForm.semester || undefined,
                                    color: courseForm.color,
                                  })
                                }
                              >
                                {updateCourseMutation.isPending
                                  ? "Saving..."
                                  : "Save Changes"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${course.courseName}"? This cannot be undone.`,
                              )
                            ) {
                              deleteCourseMutation.mutate(course.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* CALENDAR TAB                                                  */}
          {/* ============================================================ */}
          <TabsContent value="calendar" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear((y) => y - 1);
                    } else {
                      setCalMonth((m) => m - 1);
                    }
                    setSelectedDay(null);
                  }}
                >
                  &larr;
                </Button>
                <h2 className="text-xl font-semibold min-w-[200px] text-center">
                  {monthLabel}
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear((y) => y + 1);
                    } else {
                      setCalMonth((m) => m + 1);
                    }
                    setSelectedDay(null);
                  }}
                >
                  &rarr;
                </Button>
              </div>
              <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
                <DialogTrigger asChild>
                  <Button onClick={() => setShowAddEvent(true)}>
                    + Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Event</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label htmlFor="eventTitle">Title *</Label>
                      <Input
                        id="eventTitle"
                        value={eventForm.title}
                        onChange={(e) =>
                          setEventForm((f) => ({
                            ...f,
                            title: e.target.value,
                          }))
                        }
                        placeholder="e.g. Midterm Exam"
                      />
                    </div>
                    <div>
                      <Label htmlFor="eventType">Type</Label>
                      <Select
                        value={eventForm.eventType}
                        onValueChange={(val) =>
                          setEventForm((f) => ({ ...f, eventType: val }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assignment">Assignment</SelectItem>
                          <SelectItem value="exam">Exam</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="lecture">Lecture</SelectItem>
                          <SelectItem value="lab">Lab</SelectItem>
                          <SelectItem value="office_hours">
                            Office Hours
                          </SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="eventCourse">Course</Label>
                      <Select
                        value={eventForm.courseId}
                        onValueChange={(val) =>
                          setEventForm((f) => ({ ...f, courseId: val }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select course (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.courseName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="eventStartDate">Start Date *</Label>
                      <Input
                        id="eventStartDate"
                        type="date"
                        value={eventForm.startDate}
                        onChange={(e) =>
                          setEventForm((f) => ({
                            ...f,
                            startDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="eventEndDate">End Date</Label>
                      <Input
                        id="eventEndDate"
                        type="date"
                        value={eventForm.endDate}
                        onChange={(e) =>
                          setEventForm((f) => ({
                            ...f,
                            endDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="eventDesc">Description</Label>
                      <Textarea
                        id="eventDesc"
                        value={eventForm.description}
                        onChange={(e) =>
                          setEventForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        !eventForm.title.trim() ||
                        !eventForm.startDate ||
                        createEventMutation.isPending
                      }
                      onClick={() => createEventMutation.mutate(eventForm)}
                    >
                      {createEventMutation.isPending
                        ? "Creating..."
                        : "Create Event"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {eventsLoading ? (
              <Skeleton className="h-96 rounded-xl" />
            ) : (
              <Card>
                <CardContent className="p-4">
                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => (
                        <div key={d} className="py-2">
                          {d}
                        </div>
                      ),
                    )}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                    {/* Leading empty cells */}
                    {Array.from({
                      length: getFirstDayOfWeek(calYear, calMonth),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="bg-gray-50 min-h-[80px] p-1"
                      />
                    ))}

                    {/* Day cells */}
                    {Array.from({
                      length: getDaysInMonth(calYear, calMonth),
                    }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(calYear, calMonth, day);
                      const dayEvents = eventsByDay.get(day) || [];
                      const todayClass = isToday(date)
                        ? "bg-indigo-50 ring-2 ring-indigo-400 ring-inset"
                        : "bg-white";
                      const isSelected =
                        selectedDay && isSameDay(date, selectedDay);
                      const selectedClass = isSelected
                        ? "ring-2 ring-indigo-600 ring-inset"
                        : "";

                      return (
                        <button
                          key={day}
                          type="button"
                          className={`min-h-[80px] p-1 text-left ${todayClass} ${selectedClass} hover:bg-indigo-50/50 transition-colors`}
                          onClick={() => setSelectedDay(date)}
                        >
                          <span
                            className={`text-sm font-medium ${
                              isToday(date)
                                ? "text-indigo-700"
                                : "text-gray-700"
                            }`}
                          >
                            {day}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <div
                                key={ev.id}
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    ev.courseColor || "#6366f1",
                                }}
                                title={ev.title}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{dayEvents.length - 3}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}

                    {/* Trailing empty cells */}
                    {(() => {
                      const totalCells =
                        getFirstDayOfWeek(calYear, calMonth) +
                        getDaysInMonth(calYear, calMonth);
                      const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                      return Array.from({ length: trailing }).map((_, i) => (
                        <div
                          key={`trail-${i}`}
                          className="bg-gray-50 min-h-[80px] p-1"
                        />
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected day events */}
            {selectedDay && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Events for{" "}
                    {selectedDay.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No events on this day.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayEvents.map((ev) => {
                        const statusColor =
                          ev.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : isPast(ev.startDate)
                              ? "bg-red-100 text-red-800"
                              : isToday(new Date(ev.startDate))
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-800";
                        const statusLabel =
                          ev.status === "completed"
                            ? "Completed"
                            : isPast(ev.startDate)
                              ? "Overdue"
                              : isToday(new Date(ev.startDate))
                                ? "Due Today"
                                : "Upcoming";

                        return (
                          <div
                            key={ev.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              ev.status === "completed"
                                ? "opacity-60"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    ev.courseColor || "#6366f1",
                                }}
                              />
                              <div>
                                <p
                                  className={`font-medium ${
                                    ev.status === "completed"
                                      ? "line-through"
                                      : ""
                                  }`}
                                >
                                  {ev.title}
                                </p>
                                {ev.courseName && (
                                  <p className="text-sm text-muted-foreground">
                                    {ev.courseName}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  EVENT_TYPE_COLORS[ev.eventType] ||
                                  EVENT_TYPE_COLORS.other
                                }
                                variant="secondary"
                              >
                                {ev.eventType}
                              </Badge>
                              <Badge className={statusColor} variant="secondary">
                                {statusLabel}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() =>
                                  deleteEventMutation.mutate(ev.id)
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* TASKS TAB                                                     */}
          {/* ============================================================ */}
          <TabsContent value="tasks" className="mt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-semibold">My Tasks</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={taskStatusFilter}
                  onValueChange={setTaskStatusFilter}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={taskCourseFilter}
                  onValueChange={setTaskCourseFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.courseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setShowAddTask(true)}>
                      + Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label htmlFor="taskTitle">Title *</Label>
                        <Input
                          id="taskTitle"
                          value={taskForm.title}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              title: e.target.value,
                            }))
                          }
                          placeholder="e.g. Read Chapter 5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="taskType">Type</Label>
                        <Select
                          value={taskForm.taskType}
                          onValueChange={(val) =>
                            setTaskForm((f) => ({ ...f, taskType: val }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homework">Homework</SelectItem>
                            <SelectItem value="reading">Reading</SelectItem>
                            <SelectItem value="study">Study</SelectItem>
                            <SelectItem value="project">Project</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="taskCourse">Course</Label>
                        <Select
                          value={taskForm.courseId}
                          onValueChange={(val) =>
                            setTaskForm((f) => ({ ...f, courseId: val }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select course (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.courseName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="taskDueDate">Due Date</Label>
                        <Input
                          id="taskDueDate"
                          type="date"
                          value={taskForm.dueDate}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              dueDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="taskPriority">Priority</Label>
                        <Select
                          value={taskForm.priority}
                          onValueChange={(val) =>
                            setTaskForm((f) => ({ ...f, priority: val }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="taskEstMin">
                          Estimated Minutes
                        </Label>
                        <Input
                          id="taskEstMin"
                          type="number"
                          value={taskForm.estimatedMinutes}
                          onChange={(e) =>
                            setTaskForm((f) => ({
                              ...f,
                              estimatedMinutes: e.target.value,
                            }))
                          }
                          placeholder="e.g. 30"
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={
                          !taskForm.title.trim() ||
                          createTaskMutation.isPending
                        }
                        onClick={() => createTaskMutation.mutate(taskForm)}
                      >
                        {createTaskMutation.isPending
                          ? "Creating..."
                          : "Create Task"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {tasksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card className="py-12 text-center">
                <CardContent>
                  <p className="text-muted-foreground">
                    {taskStatusFilter !== "all" || taskCourseFilter !== "all"
                      ? "No tasks match current filters."
                      : "No tasks yet. Add your first task!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => {
                  const isComplete = task.status === "completed";
                  const isOverdue =
                    !isComplete &&
                    task.dueDate &&
                    isPast(task.dueDate);
                  const isDueToday =
                    !isComplete &&
                    task.dueDate &&
                    isToday(new Date(task.dueDate));

                  return (
                    <Card
                      key={task.id}
                      className={`transition-all ${
                        isComplete ? "opacity-60" : ""
                      } ${isOverdue ? "border-red-300" : ""} ${
                        isDueToday ? "border-amber-300" : ""
                      }`}
                    >
                      <CardContent className="flex items-center gap-4 py-3 px-4">
                        {/* Checkbox */}
                        <button
                          type="button"
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isComplete
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-gray-300 hover:border-indigo-400"
                          }`}
                          onClick={() =>
                            toggleTaskMutation.mutate({
                              id: task.id,
                              status: isComplete ? "pending" : "completed",
                            })
                          }
                          aria-label={
                            isComplete
                              ? "Mark as pending"
                              : "Mark as completed"
                          }
                        >
                          {isComplete && (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>

                        {/* Title & due date */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-medium truncate ${
                              isComplete ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                            {task.dueDate && (
                              <span
                                className={
                                  isOverdue
                                    ? "text-red-600 font-medium"
                                    : isDueToday
                                      ? "text-amber-600 font-medium"
                                      : ""
                                }
                              >
                                {isOverdue
                                  ? "Overdue"
                                  : isDueToday
                                    ? "Due today"
                                    : `Due ${formatShortDate(task.dueDate)}`}
                              </span>
                            )}
                            {task.estimatedMinutes != null && (
                              <span>
                                Est. {task.estimatedMinutes}m
                                {task.actualMinutes != null && (
                                  <> / Actual {task.actualMinutes}m</>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.courseName && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor:
                                  (task.courseColor || "#6366f1") + "20",
                                color: task.courseColor || "#6366f1",
                              }}
                            >
                              {task.courseName}
                            </Badge>
                          )}
                          {task.priority && (
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                PRIORITY_COLORS[task.priority] ||
                                PRIORITY_COLORS.medium
                              }`}
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => setLocation("/tutor")}
                          >
                            Study with JIE
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete task "${task.title}"?`,
                                )
                              ) {
                                deleteTaskMutation.mutate(task.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* ENGAGEMENT TAB                                                */}
          {/* ============================================================ */}
          <TabsContent value="engagement" className="mt-6">
            {engagementLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : !engagement ? (
              <Card className="py-12 text-center">
                <CardContent>
                  <p className="text-muted-foreground">
                    No engagement data available yet. Start using JIE to build
                    your score!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Score + risk + streak */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Score */}
                  <Card className="text-center">
                    <CardContent className="pt-8 pb-6">
                      <div
                        className={`inline-flex items-center justify-center w-28 h-28 rounded-full text-4xl font-bold ${
                          engagement.currentScore >= 70
                            ? "bg-green-100 text-green-700"
                            : engagement.currentScore >= 50
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {engagement.currentScore}
                      </div>
                      <p className="mt-3 text-sm font-medium text-muted-foreground">
                        Engagement Score
                      </p>
                    </CardContent>
                  </Card>

                  {/* Risk Level */}
                  <Card className="text-center">
                    <CardContent className="pt-8 pb-6">
                      <Badge
                        className={`text-lg px-4 py-2 ${
                          engagement.riskLevel === "low"
                            ? "bg-green-100 text-green-800"
                            : engagement.riskLevel === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                        variant="secondary"
                      >
                        {engagement.riskLevel.charAt(0).toUpperCase() +
                          engagement.riskLevel.slice(1)}{" "}
                        Risk
                      </Badge>
                      <p className="mt-3 text-sm font-medium text-muted-foreground">
                        Risk Level
                      </p>
                    </CardContent>
                  </Card>

                  {/* Streak */}
                  <Card className="text-center">
                    <CardContent className="pt-8 pb-6">
                      <p className="text-4xl font-bold text-indigo-600">
                        {engagement.streak}
                      </p>
                      <p className="mt-3 text-sm font-medium text-muted-foreground">
                        Day Streak
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* This Week Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold text-indigo-600">
                          {engagement.thisWeek.sessions}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Sessions
                        </p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-indigo-600">
                          {engagement.thisWeek.tasksCompleted}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Tasks Completed
                        </p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-indigo-600">
                          {engagement.thisWeek.activeDays}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Active Days
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* History Bar Chart */}
                {engagement.history && engagement.history.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Score History</CardTitle>
                      <CardDescription>
                        Last {engagement.history.length} weeks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end gap-3 h-48">
                        {engagement.history.slice(-8).map((h, idx) => {
                          const score = Number(h.engagementScore || 0);
                          const height = Math.max(
                            (score / 100) * 100,
                            4,
                          );
                          const barColor =
                            score >= 70
                              ? "bg-green-500"
                              : score >= 50
                                ? "bg-yellow-500"
                                : "bg-red-500";

                          return (
                            <div
                              key={idx}
                              className="flex-1 flex flex-col items-center justify-end h-full"
                            >
                              <span className="text-xs font-medium mb-1">
                                {score}
                              </span>
                              <div
                                className={`w-full rounded-t-md ${barColor} transition-all`}
                                style={{ height: `${height}%` }}
                              />
                              <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                                {h.weekStart || ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* SETTINGS TAB                                                  */}
          {/* ============================================================ */}
          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              {/* Parent / Guardian Sharing */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Parent / Guardian Sharing</CardTitle>
                      <CardDescription>
                        Share your academic progress with parents or guardians.
                        Maximum 3 recipients.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {parentShares.length} / 3
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sharesLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                      ))}
                    </div>
                  ) : parentShares.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No parent shares configured yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {parentShares.map((ps) => (
                        <div
                          key={ps.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {ps.parentName || ps.parentEmail}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ps.parentEmail} &middot;{" "}
                              {ps.shareFrequency || "weekly"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() =>
                              deleteParentShareMutation.mutate(ps.id)
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {parentShares.length < 3 && (
                    <Dialog
                      open={showAddParent}
                      onOpenChange={setShowAddParent}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowAddParent(true)}
                        >
                          + Add Parent Email
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Parent / Guardian</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div>
                            <Label htmlFor="parentEmail">Email *</Label>
                            <Input
                              id="parentEmail"
                              type="email"
                              value={parentForm.parentEmail}
                              onChange={(e) =>
                                setParentForm((f) => ({
                                  ...f,
                                  parentEmail: e.target.value,
                                }))
                              }
                              placeholder="parent@example.com"
                            />
                          </div>
                          <div>
                            <Label htmlFor="parentName">Name</Label>
                            <Input
                              id="parentName"
                              value={parentForm.parentName}
                              onChange={(e) =>
                                setParentForm((f) => ({
                                  ...f,
                                  parentName: e.target.value,
                                }))
                              }
                              placeholder="Parent name (optional)"
                            />
                          </div>
                          <div>
                            <Label htmlFor="shareFreq">Frequency</Label>
                            <Select
                              value={parentForm.shareFrequency}
                              onValueChange={(val) =>
                                setParentForm((f) => ({
                                  ...f,
                                  shareFrequency: val,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="per_event">
                                  Per Event
                                </SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            className="w-full"
                            disabled={
                              !parentForm.parentEmail.trim() ||
                              createParentShareMutation.isPending
                            }
                            onClick={() =>
                              createParentShareMutation.mutate(parentForm)
                            }
                          >
                            {createParentShareMutation.isPending
                              ? "Adding..."
                              : "Add Parent Share"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>

              {/* Reminder Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Reminders</CardTitle>
                  <CardDescription>
                    Pending reminders that have not been delivered yet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {remindersLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                      ))}
                    </div>
                  ) : reminders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No pending reminders. You are all caught up!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {reminders.map((rem) => (
                        <div
                          key={rem.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <p className="font-medium text-sm">{rem.title}</p>
                            {rem.message && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {rem.message}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              dismissReminderMutation.mutate(rem.id)
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
