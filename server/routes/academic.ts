/**
 * JIE Mastery AI Tutor Platform
 * Copyright (c) 2025 JIE Mastery AI, Inc.
 * All Rights Reserved.
 *
 * Academic Command Center — Student & Admin API routes
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and, desc, asc, sql, gte, lte, or, inArray, isNull } from 'drizzle-orm';
import {
  studentCourses,
  studentCalendarEvents,
  studentTasks,
  studentReminders,
  studentEngagementScores,
  studentParentShares,
  users,
  realtimeSessions,
} from '@shared/schema';
import { requireAdmin } from '../middleware/admin-auth';
import { EmailService } from '../services/email-service';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const adminRouter = Router();
const emailService = new EmailService();

// ─── Helper: get authenticated user ID ───
function getUserId(req: any): string | null {
  if (!req.isAuthenticated || !req.isAuthenticated()) return null;
  return (req.user as any)?.id || null;
}

// ─── Helper: generate auto study tasks for a calendar event ───
function generateStudyTasks(event: {
  id: string;
  userId: string;
  courseId: string | null;
  title: string;
  eventType: string | null;
  startDate: string;
}) {
  const tasks: Array<{
    userId: string;
    courseId: string | null;
    eventId: string;
    title: string;
    taskType: string;
    dueDate: string;
    priority: string;
    status: string;
    estimatedMinutes: number;
  }> = [];

  const eventDate = new Date(event.startDate);
  const now = new Date();

  function addDays(d: Date, days: number): string {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r.toISOString().split('T')[0];
  }

  function isFuture(dateStr: string): boolean {
    return new Date(dateStr) >= now;
  }

  const type = event.eventType || 'assignment';

  if (type === 'exam') {
    const t7 = addDays(eventDate, -7);
    const t5 = addDays(eventDate, -5);
    const t3 = addDays(eventDate, -3);
    const t1 = addDays(eventDate, -1);
    if (isFuture(t7)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Begin reviewing for ${event.title}`, taskType: 'review', dueDate: t7, priority: 'medium', status: 'pending', estimatedMinutes: 45 });
    if (isFuture(t5)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Continue review: ${event.title}`, taskType: 'review', dueDate: t5, priority: 'medium', status: 'pending', estimatedMinutes: 60 });
    if (isFuture(t3)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Intensive review for ${event.title}`, taskType: 'study', dueDate: t3, priority: 'high', status: 'pending', estimatedMinutes: 90 });
    if (isFuture(t1)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Final review: ${event.title} tomorrow`, taskType: 'study', dueDate: t1, priority: 'high', status: 'pending', estimatedMinutes: 60 });
  } else if (type === 'assignment' || type === 'project') {
    const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const t5 = addDays(eventDate, -5);
    const t3 = addDays(eventDate, -3);
    const t1 = addDays(eventDate, -1);
    if (daysUntil > 7 && isFuture(t5)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Start working on ${event.title}`, taskType: 'homework', dueDate: t5, priority: 'medium', status: 'pending', estimatedMinutes: 60 });
    if (isFuture(t3)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Continue ${event.title} — due in 3 days`, taskType: 'homework', dueDate: t3, priority: 'high', status: 'pending', estimatedMinutes: 90 });
    if (isFuture(t1)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Finish ${event.title} — due tomorrow`, taskType: 'homework', dueDate: t1, priority: 'high', status: 'pending', estimatedMinutes: 60 });
  } else if (type === 'quiz') {
    const t3 = addDays(eventDate, -3);
    const t1 = addDays(eventDate, -1);
    if (isFuture(t3)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Review for ${event.title}`, taskType: 'review', dueDate: t3, priority: 'medium', status: 'pending', estimatedMinutes: 30 });
    if (isFuture(t1)) tasks.push({ userId: event.userId, courseId: event.courseId, eventId: event.id, title: `Quick review: ${event.title} tomorrow`, taskType: 'review', dueDate: t1, priority: 'high', status: 'pending', estimatedMinutes: 20 });
  }

  return tasks;
}

// ─── Helper: generate reminders for a calendar event ───
function generateReminders(event: {
  id: string;
  userId: string;
  eventType: string | null;
  title: string;
  startDate: string;
}) {
  const reminders: Array<{
    userId: string;
    eventId: string;
    reminderType: string;
    reminderDate: string;
    message: string;
    deliveryMethod: string;
  }> = [];

  const eventDate = new Date(event.startDate);
  const now = new Date();

  function addDays(d: Date, days: number): string {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r.toISOString().split('T')[0];
  }

  function isFuture(dateStr: string): boolean {
    return new Date(dateStr) >= now;
  }

  const type = event.eventType || 'assignment';

  if (type === 'exam') {
    const d7 = addDays(eventDate, -7);
    const d3 = addDays(eventDate, -3);
    const d1 = addDays(eventDate, -1);
    if (isFuture(d7)) reminders.push({ userId: event.userId, eventId: event.id, reminderType: 'exam_7day', reminderDate: d7, message: `${event.title} is in 7 days — start reviewing!`, deliveryMethod: 'both' });
    if (isFuture(d3)) reminders.push({ userId: event.userId, eventId: event.id, reminderType: 'exam_3day', reminderDate: d3, message: `${event.title} is in 3 days — intensive review time`, deliveryMethod: 'both' });
    if (isFuture(d1)) reminders.push({ userId: event.userId, eventId: event.id, reminderType: 'exam_1day', reminderDate: d1, message: `${event.title} is TOMORROW — final review`, deliveryMethod: 'both' });
  } else if (type === 'assignment' || type === 'project') {
    const d3 = addDays(eventDate, -3);
    const d1 = addDays(eventDate, -1);
    if (isFuture(d3)) reminders.push({ userId: event.userId, eventId: event.id, reminderType: 'assignment_3day', reminderDate: d3, message: `${event.title} due in 3 days`, deliveryMethod: 'both' });
    if (isFuture(d1)) reminders.push({ userId: event.userId, eventId: event.id, reminderType: 'assignment_1day', reminderDate: d1, message: `${event.title} due TOMORROW`, deliveryMethod: 'both' });
  }

  return reminders;
}

// ─── Helper: engagement score calculation ───
function calculateEngagementScore(data: {
  sessionsCompleted: number;
  coursesCount: number;
  tasksCompleted: number;
  totalTasks: number;
  totalStudyMinutes: number;
  activeDays: number;
}): { score: number; riskLevel: string } {
  // Sessions completed vs target (40 points): target = 3 sessions/week per course
  const sessionTarget = Math.max(data.coursesCount * 3, 3);
  const sessionScore = Math.min((data.sessionsCompleted / sessionTarget) * 40, 40);

  // Tasks completed vs total (30 points)
  const taskScore = data.totalTasks > 0
    ? (data.tasksCompleted / data.totalTasks) * 30
    : 30;

  // Study minutes vs recommended (20 points): 120 min/week baseline
  const minuteTarget = 120;
  const minuteScore = Math.min((data.totalStudyMinutes / minuteTarget) * 20, 20);

  // Consistency bonus (10 points): activity on 4+ different days
  const consistencyScore = Math.min((data.activeDays / 4) * 10, 10);

  const score = Math.round(sessionScore + taskScore + minuteScore + consistencyScore);

  let riskLevel = 'on_track';
  if (score < 30) riskLevel = 'critical';
  else if (score < 50) riskLevel = 'at_risk';
  else if (score < 70) riskLevel = 'needs_attention';

  return { score, riskLevel };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STUDENT-FACING ROUTES (/api/academic/*)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── COURSES ──

// GET /courses — list student's courses
router.get('/courses', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const courses = await db.select().from(studentCourses)
      .where(and(eq(studentCourses.userId, userId), eq(studentCourses.isActive, true)))
      .orderBy(desc(studentCourses.createdAt));
    res.json(courses);
  } catch (error: any) {
    console.error('[Academic] Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// POST /courses — create a course
router.post('/courses', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { courseName, courseCode, instructor, semester, color } = req.body;
    if (!courseName) return res.status(400).json({ error: 'courseName is required' });

    const [course] = await db.insert(studentCourses).values({
      userId,
      courseName,
      courseCode: courseCode || null,
      instructor: instructor || null,
      semester: semester || null,
      color: color || null,
    }).returning();

    res.status(201).json(course);
  } catch (error: any) {
    console.error('[Academic] Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PATCH /courses/:id — update a course
router.patch('/courses/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const updates: any = {};
    const allowedFields = ['courseName', 'courseCode', 'instructor', 'semester', 'color', 'syllabusText', 'isActive'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(studentCourses)
      .set(updates)
      .where(and(eq(studentCourses.id, id), eq(studentCourses.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Course not found' });
    res.json(updated);
  } catch (error: any) {
    console.error('[Academic] Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /courses/:id — soft delete (set isActive=false)
router.delete('/courses/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const [updated] = await db.update(studentCourses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(studentCourses.id, id), eq(studentCourses.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Course not found' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Academic] Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ── SYLLABUS PROCESSING (Claude API) ──

router.post('/courses/:id/process-syllabus', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const { syllabusText } = req.body;
    if (!syllabusText) return res.status(400).json({ error: 'syllabusText is required' });

    // Verify course ownership
    const [course] = await db.select().from(studentCourses)
      .where(and(eq(studentCourses.id, id), eq(studentCourses.userId, userId)));
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Use Claude to extract dates and events
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AI processing not available' });

    const client = new Anthropic({ apiKey });

    const extraction = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Extract all academic events from this syllabus. Return ONLY valid JSON (no markdown fences).

Format:
{
  "courseName": "string",
  "instructor": "string",
  "events": [
    {
      "title": "string",
      "eventType": "exam|assignment|quiz|project|lab|presentation|office_hours",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD or null",
      "startTime": "HH:MM or null",
      "endTime": "HH:MM or null",
      "description": "string or null",
      "priority": "high|medium|low",
      "location": "string or null"
    }
  ]
}

Syllabus text:
${syllabusText}`
      }],
    });

    const responseText = extraction.content[0].type === 'text' ? extraction.content[0].text : '';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try extracting JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(422).json({ error: 'Could not parse AI response', raw: responseText });
      }
    }

    // Save syllabus text and update course info
    await db.update(studentCourses).set({
      syllabusText,
      syllabusUploadedAt: new Date(),
      courseName: parsed.courseName || course.courseName,
      instructor: parsed.instructor || course.instructor,
      updatedAt: new Date(),
    }).where(eq(studentCourses.id, id));

    // Create calendar events + auto study tasks + reminders
    const createdEvents: any[] = [];
    for (const evt of (parsed.events || [])) {
      if (!evt.title || !evt.startDate) continue;

      const [created] = await db.insert(studentCalendarEvents).values({
        userId,
        courseId: id,
        title: evt.title,
        eventType: evt.eventType || 'custom',
        description: evt.description || null,
        startDate: evt.startDate,
        endDate: evt.endDate || null,
        startTime: evt.startTime || null,
        endTime: evt.endTime || null,
        location: evt.location || null,
        isFromSyllabus: true,
        priority: evt.priority || 'medium',
        status: 'upcoming',
      }).returning();

      // Auto-generate study tasks
      const autoTasks = generateStudyTasks({
        id: created.id,
        userId,
        courseId: id,
        title: evt.title,
        eventType: evt.eventType,
        startDate: evt.startDate,
      });
      if (autoTasks.length > 0) {
        await db.insert(studentTasks).values(autoTasks);
      }

      // Auto-generate reminders
      const autoReminders = generateReminders({
        id: created.id,
        userId,
        eventType: evt.eventType,
        title: evt.title,
        startDate: evt.startDate,
      });
      if (autoReminders.length > 0) {
        await db.insert(studentReminders).values(autoReminders);
      }

      createdEvents.push(created);
    }

    res.json({
      courseName: parsed.courseName,
      instructor: parsed.instructor,
      eventsCreated: createdEvents.length,
      events: createdEvents,
    });
  } catch (error: any) {
    console.error('[Academic] Syllabus processing error:', error);
    res.status(500).json({ error: 'Failed to process syllabus' });
  }
});

// ── CALENDAR EVENTS ──

// GET /events — list student's events with optional date range
router.get('/events', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { startDate, endDate, courseId } = req.query;
    const conditions = [eq(studentCalendarEvents.userId, userId)];

    if (startDate) conditions.push(gte(studentCalendarEvents.startDate, startDate as string));
    if (endDate) conditions.push(lte(studentCalendarEvents.startDate, endDate as string));
    if (courseId) conditions.push(eq(studentCalendarEvents.courseId, courseId as string));

    const events = await db.select({
      event: studentCalendarEvents,
      courseName: studentCourses.courseName,
      courseColor: studentCourses.color,
    })
      .from(studentCalendarEvents)
      .leftJoin(studentCourses, eq(studentCalendarEvents.courseId, studentCourses.id))
      .where(and(...conditions))
      .orderBy(asc(studentCalendarEvents.startDate));

    res.json(events.map(e => ({ ...e.event, courseName: e.courseName, courseColor: e.courseColor })));
  } catch (error: any) {
    console.error('[Academic] Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST /events — create an event manually
router.post('/events', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { title, eventType, courseId, description, startDate, endDate, startTime, endTime, location, isAllDay, priority, notes } = req.body;
    if (!title || !startDate) return res.status(400).json({ error: 'title and startDate are required' });

    const [event] = await db.insert(studentCalendarEvents).values({
      userId,
      courseId: courseId || null,
      title,
      eventType: eventType || 'custom',
      description: description || null,
      startDate,
      endDate: endDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
      location: location || null,
      isAllDay: isAllDay || false,
      isFromSyllabus: false,
      priority: priority || 'medium',
      status: 'upcoming',
      notes: notes || null,
    }).returning();

    // Auto-generate study tasks
    const autoTasks = generateStudyTasks({ id: event.id, userId, courseId: courseId || null, title, eventType, startDate });
    if (autoTasks.length > 0) {
      await db.insert(studentTasks).values(autoTasks);
    }

    // Auto-generate reminders
    const autoReminders = generateReminders({ id: event.id, userId, eventType, title, startDate });
    if (autoReminders.length > 0) {
      await db.insert(studentReminders).values(autoReminders);
    }

    res.status(201).json(event);
  } catch (error: any) {
    console.error('[Academic] Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PATCH /events/:id — update an event
router.patch('/events/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const allowedFields = ['title', 'eventType', 'courseId', 'description', 'startDate', 'endDate', 'startTime', 'endTime', 'location', 'isAllDay', 'priority', 'status', 'notes'];
    const updates: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const [updated] = await db.update(studentCalendarEvents)
      .set(updates)
      .where(and(eq(studentCalendarEvents.id, id), eq(studentCalendarEvents.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json(updated);
  } catch (error: any) {
    console.error('[Academic] Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /events/:id
router.delete('/events/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const [deleted] = await db.delete(studentCalendarEvents)
      .where(and(eq(studentCalendarEvents.id, id), eq(studentCalendarEvents.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Academic] Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ── TASKS ──

// GET /tasks — list student's tasks
router.get('/tasks', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { status, courseId, sortBy } = req.query;
    const conditions = [eq(studentTasks.userId, userId)];

    if (status && status !== 'all') conditions.push(eq(studentTasks.status, status as string));
    if (courseId) conditions.push(eq(studentTasks.courseId, courseId as string));

    const orderClause = sortBy === 'priority'
      ? [asc(studentTasks.dueDate)]
      : [asc(studentTasks.dueDate)];

    const tasks = await db.select({
      task: studentTasks,
      courseName: studentCourses.courseName,
      courseColor: studentCourses.color,
    })
      .from(studentTasks)
      .leftJoin(studentCourses, eq(studentTasks.courseId, studentCourses.id))
      .where(and(...conditions))
      .orderBy(...orderClause);

    res.json(tasks.map(t => ({ ...t.task, courseName: t.courseName, courseColor: t.courseColor })));
  } catch (error: any) {
    console.error('[Academic] Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /tasks — create a custom task
router.post('/tasks', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { title, taskType, courseId, eventId, dueDate, priority, estimatedMinutes, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const [task] = await db.insert(studentTasks).values({
      userId,
      courseId: courseId || null,
      eventId: eventId || null,
      title,
      taskType: taskType || 'custom',
      dueDate: dueDate || null,
      priority: priority || 'medium',
      estimatedMinutes: estimatedMinutes || null,
      notes: notes || null,
    }).returning();

    res.status(201).json(task);
  } catch (error: any) {
    console.error('[Academic] Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /tasks/:id — update a task (status, etc.)
router.patch('/tasks/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const allowedFields = ['title', 'taskType', 'dueDate', 'priority', 'status', 'estimatedMinutes', 'actualMinutes', 'notes'];
    const updates: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Set completedAt when marking completed
    if (updates.status === 'completed') {
      updates.completedAt = new Date();
    }

    const [updated] = await db.update(studentTasks)
      .set(updates)
      .where(and(eq(studentTasks.id, id), eq(studentTasks.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (error: any) {
    console.error('[Academic] Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /tasks/:id
router.delete('/tasks/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const [deleted] = await db.delete(studentTasks)
      .where(and(eq(studentTasks.id, id), eq(studentTasks.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Academic] Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── REMINDERS ──

// GET /reminders
router.get('/reminders', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { delivered } = req.query;
    const conditions = [eq(studentReminders.userId, userId)];
    if (delivered === 'false') conditions.push(eq(studentReminders.delivered, false));

    const reminders = await db.select().from(studentReminders)
      .where(and(...conditions))
      .orderBy(asc(studentReminders.reminderDate));
    res.json(reminders);
  } catch (error: any) {
    console.error('[Academic] Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// PATCH /reminders/:id — mark delivered
router.patch('/reminders/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const [updated] = await db.update(studentReminders)
      .set({ delivered: true, deliveredAt: new Date() })
      .where(and(eq(studentReminders.id, id), eq(studentReminders.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Reminder not found' });
    res.json(updated);
  } catch (error: any) {
    console.error('[Academic] Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// ── ENGAGEMENT ──

// GET /engagement — get current engagement data
router.get('/engagement', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Get most recent week's scores
    const scores = await db.select().from(studentEngagementScores)
      .where(eq(studentEngagementScores.userId, userId))
      .orderBy(desc(studentEngagementScores.weekStart))
      .limit(12);

    // Calculate current week's live score
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Count sessions this week
    const sessionsResult = await db.select({ count: sql<number>`count(*)` })
      .from(realtimeSessions)
      .where(and(
        eq(realtimeSessions.userId, userId),
        gte(realtimeSessions.startedAt, weekStart),
      ));

    // Count tasks this week
    const tasksCompletedResult = await db.select({ count: sql<number>`count(*)` })
      .from(studentTasks)
      .where(and(
        eq(studentTasks.userId, userId),
        eq(studentTasks.status, 'completed'),
        gte(studentTasks.completedAt, weekStart),
      ));

    const totalTasksResult = await db.select({ count: sql<number>`count(*)` })
      .from(studentTasks)
      .where(and(
        eq(studentTasks.userId, userId),
        or(
          eq(studentTasks.status, 'pending'),
          eq(studentTasks.status, 'in_progress'),
          eq(studentTasks.status, 'completed'),
        ),
        gte(studentTasks.dueDate, weekStartStr),
        lte(studentTasks.dueDate, now.toISOString().split('T')[0]),
      ));

    // Count courses
    const coursesResult = await db.select({ count: sql<number>`count(*)` })
      .from(studentCourses)
      .where(and(eq(studentCourses.userId, userId), eq(studentCourses.isActive, true)));

    // Unique active days this week
    const activeDaysResult = await db.select({
      days: sql<number>`count(distinct date(started_at))`
    })
      .from(realtimeSessions)
      .where(and(
        eq(realtimeSessions.userId, userId),
        gte(realtimeSessions.startedAt, weekStart),
      ));

    const liveScore = calculateEngagementScore({
      sessionsCompleted: Number(sessionsResult[0]?.count || 0),
      coursesCount: Number(coursesResult[0]?.count || 0),
      tasksCompleted: Number(tasksCompletedResult[0]?.count || 0),
      totalTasks: Number(totalTasksResult[0]?.count || 0),
      totalStudyMinutes: 0, // TODO: sum from sessions
      activeDays: Number(activeDaysResult[0]?.days || 0),
    });

    // Streak: count consecutive weeks with engagement >= 50
    let streak = 0;
    for (const s of scores) {
      if (Number(s.engagementScore) >= 50) streak++;
      else break;
    }

    res.json({
      currentScore: liveScore.score,
      riskLevel: liveScore.riskLevel,
      streak,
      history: scores,
      thisWeek: {
        sessions: Number(sessionsResult[0]?.count || 0),
        tasksCompleted: Number(tasksCompletedResult[0]?.count || 0),
        activeDays: Number(activeDaysResult[0]?.days || 0),
      },
    });
  } catch (error: any) {
    console.error('[Academic] Error fetching engagement:', error);
    res.status(500).json({ error: 'Failed to fetch engagement data' });
  }
});

// ── PARENT SHARING ──

// GET /parent-shares
router.get('/parent-shares', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const shares = await db.select().from(studentParentShares)
      .where(eq(studentParentShares.userId, userId))
      .orderBy(desc(studentParentShares.createdAt));
    res.json(shares);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch parent shares' });
  }
});

// POST /parent-shares
router.post('/parent-shares', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { parentEmail, parentName, shareFrequency } = req.body;
    if (!parentEmail) return res.status(400).json({ error: 'parentEmail is required' });

    // Check max 3 shares
    const existing = await db.select({ count: sql<number>`count(*)` })
      .from(studentParentShares)
      .where(and(eq(studentParentShares.userId, userId), eq(studentParentShares.isActive, true)));

    if (Number(existing[0]?.count || 0) >= 3) {
      return res.status(400).json({ error: 'Maximum 3 parent email shares allowed' });
    }

    const [share] = await db.insert(studentParentShares).values({
      userId,
      parentEmail,
      parentName: parentName || null,
      shareFrequency: shareFrequency || 'weekly',
    }).returning();

    res.status(201).json(share);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create parent share' });
  }
});

// DELETE /parent-shares/:id
router.delete('/parent-shares/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = req.params;
    const [deleted] = await db.delete(studentParentShares)
      .where(and(eq(studentParentShares.id, id), eq(studentParentShares.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Parent share not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete parent share' });
  }
});

// ── DASHBOARD SUMMARY ──

// GET /summary — single endpoint for dashboard overview
router.get('/summary', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekStr = weekFromNow.toISOString().split('T')[0];

    // Upcoming events (next 7 days)
    const upcomingEvents = await db.select({
      event: studentCalendarEvents,
      courseName: studentCourses.courseName,
      courseColor: studentCourses.color,
    })
      .from(studentCalendarEvents)
      .leftJoin(studentCourses, eq(studentCalendarEvents.courseId, studentCourses.id))
      .where(and(
        eq(studentCalendarEvents.userId, userId),
        gte(studentCalendarEvents.startDate, today),
        lte(studentCalendarEvents.startDate, weekStr),
        eq(studentCalendarEvents.status, 'upcoming'),
      ))
      .orderBy(asc(studentCalendarEvents.startDate))
      .limit(10);

    // Pending tasks
    const pendingTasks = await db.select({
      task: studentTasks,
      courseName: studentCourses.courseName,
      courseColor: studentCourses.color,
    })
      .from(studentTasks)
      .leftJoin(studentCourses, eq(studentTasks.courseId, studentCourses.id))
      .where(and(
        eq(studentTasks.userId, userId),
        or(eq(studentTasks.status, 'pending'), eq(studentTasks.status, 'in_progress')),
      ))
      .orderBy(asc(studentTasks.dueDate))
      .limit(10);

    // Undelivered reminders
    const undeliveredReminders = await db.select().from(studentReminders)
      .where(and(
        eq(studentReminders.userId, userId),
        eq(studentReminders.delivered, false),
        lte(studentReminders.reminderDate, today),
      ))
      .orderBy(asc(studentReminders.reminderDate));

    // Courses count
    const coursesResult = await db.select({ count: sql<number>`count(*)` })
      .from(studentCourses)
      .where(and(eq(studentCourses.userId, userId), eq(studentCourses.isActive, true)));

    res.json({
      upcomingEvents: upcomingEvents.map(e => ({ ...e.event, courseName: e.courseName, courseColor: e.courseColor })),
      pendingTasks: pendingTasks.map(t => ({ ...t.task, courseName: t.courseName, courseColor: t.courseColor })),
      undeliveredReminders,
      coursesCount: Number(coursesResult[0]?.count || 0),
    });
  } catch (error: any) {
    console.error('[Academic] Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN ROUTES (/api/admin/academic/*)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

adminRouter.use(requireAdmin);

// GET /students — list all students with academic data
adminRouter.get('/students', async (req, res) => {
  try {
    const { search, riskLevel, sortBy, page = '1', limit = '25' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get all users with their academic summaries
    const studentsData = await db.execute(sql`
      SELECT
        u.id,
        u.username,
        u.email,
        u.student_name,
        u.created_at,
        COALESCE(c.course_count, 0) as courses_loaded,
        COALESCE(e.latest_score, 0) as engagement_score,
        COALESCE(e.latest_risk, 'on_track') as risk_level,
        COALESCE(e.latest_trend, 'stable') as trend,
        s.last_session_at,
        COALESCE(t.upcoming_count, 0) as upcoming_deadlines,
        COALESCE(t.completed_rate, 0) as task_completion_rate
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as course_count
        FROM student_courses WHERE is_active = true
        GROUP BY user_id
      ) c ON c.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT engagement_score as latest_score, risk_level as latest_risk, trend as latest_trend
        FROM student_engagement_scores
        WHERE user_id = u.id
        ORDER BY week_start DESC LIMIT 1
      ) e ON true
      LEFT JOIN LATERAL (
        SELECT MAX(started_at) as last_session_at
        FROM realtime_sessions
        WHERE user_id = u.id
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'upcoming' OR status = 'pending') as upcoming_count,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric * 100)
            ELSE 0
          END as completed_rate
        FROM student_tasks
        WHERE user_id = u.id
      ) t ON true
      WHERE u.is_admin = false
        ${search ? sql`AND (u.student_name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'} OR u.username ILIKE ${'%' + search + '%'})` : sql``}
        ${riskLevel && riskLevel !== 'all' ? sql`AND COALESCE(e.latest_risk, 'on_track') = ${riskLevel}` : sql``}
      ORDER BY ${sortBy === 'engagement' ? sql`COALESCE(e.latest_score, 0) ASC` : sortBy === 'risk' ? sql`CASE COALESCE(e.latest_risk, 'on_track') WHEN 'critical' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'needs_attention' THEN 3 ELSE 4 END` : sortBy === 'lastActive' ? sql`s.last_session_at ASC NULLS LAST` : sql`u.student_name ASC NULLS LAST`}
      LIMIT ${limitNum} OFFSET ${offset}
    `);

    // Total count for pagination
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM users WHERE is_admin = false
        ${search ? sql`AND (student_name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'} OR username ILIKE ${'%' + search + '%'})` : sql``}
    `);

    res.json({
      students: studentsData.rows,
      total: Number((countResult.rows[0] as any)?.total || 0),
      page: pageNum,
      totalPages: Math.ceil(Number((countResult.rows[0] as any)?.total || 0) / limitNum),
    });
  } catch (error: any) {
    console.error('[Academic Admin] Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /students/:userId — get a specific student's full academic data
adminRouter.get('/students/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      studentName: users.studentName,
    }).from(users).where(eq(users.id, userId));

    if (!user) return res.status(404).json({ error: 'Student not found' });

    const courses = await db.select().from(studentCourses)
      .where(and(eq(studentCourses.userId, userId), eq(studentCourses.isActive, true)));

    const events = await db.select().from(studentCalendarEvents)
      .where(eq(studentCalendarEvents.userId, userId))
      .orderBy(asc(studentCalendarEvents.startDate));

    const tasks = await db.select().from(studentTasks)
      .where(eq(studentTasks.userId, userId))
      .orderBy(asc(studentTasks.dueDate));

    const engagementHistory = await db.select().from(studentEngagementScores)
      .where(eq(studentEngagementScores.userId, userId))
      .orderBy(desc(studentEngagementScores.weekStart))
      .limit(12);

    res.json({ user, courses, events, tasks, engagementHistory });
  } catch (error: any) {
    console.error('[Academic Admin] Error fetching student detail:', error);
    res.status(500).json({ error: 'Failed to fetch student detail' });
  }
});

// GET /alerts — intervention alerts
adminRouter.get('/alerts', async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const today = new Date().toISOString().split('T')[0];
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    // No sessions in 7+ days
    const noActivityResult = await db.execute(sql`
      SELECT u.id, u.student_name, u.email, MAX(rs.started_at) as last_session
      FROM users u
      LEFT JOIN realtime_sessions rs ON rs.user_id = u.id
      WHERE u.is_admin = false
      GROUP BY u.id
      HAVING MAX(rs.started_at) < ${sevenDaysAgo} OR MAX(rs.started_at) IS NULL
      LIMIT 50
    `);

    // Low engagement (below 40)
    const lowEngagementResult = await db.execute(sql`
      SELECT DISTINCT ON (es.user_id) es.user_id as id, u.student_name, u.email,
        es.engagement_score, es.risk_level
      FROM student_engagement_scores es
      JOIN users u ON u.id = es.user_id
      WHERE es.engagement_score::numeric < 40
      ORDER BY es.user_id, es.week_start DESC
      LIMIT 50
    `);

    // Missed tasks (3+)
    const missedTasksResult = await db.execute(sql`
      SELECT st.user_id as id, u.student_name, u.email, COUNT(*) as missed_count
      FROM student_tasks st
      JOIN users u ON u.id = st.user_id
      WHERE st.status = 'pending' AND st.due_date < ${today}
      GROUP BY st.user_id, u.student_name, u.email
      HAVING COUNT(*) >= 3
      LIMIT 50
    `);

    // Exam within 3 days with no recent study sessions
    const unpreparedResult = await db.execute(sql`
      SELECT sce.user_id as id, u.student_name, u.email, sce.title as exam_title, sce.start_date
      FROM student_calendar_events sce
      JOIN users u ON u.id = sce.user_id
      WHERE sce.event_type = 'exam'
        AND sce.start_date BETWEEN ${today} AND ${threeDaysStr}
        AND NOT EXISTS (
          SELECT 1 FROM realtime_sessions rs
          WHERE rs.user_id = sce.user_id
            AND rs.started_at > ${sevenDaysAgo}
        )
      LIMIT 50
    `);

    res.json({
      noActivity: noActivityResult.rows,
      lowEngagement: lowEngagementResult.rows,
      missedDeadlines: missedTasksResult.rows,
      examUnprepared: unpreparedResult.rows,
    });
  } catch (error: any) {
    console.error('[Academic Admin] Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /nudge — send nudge email to student
adminRouter.post('/nudge', async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: 'Student not found' });

    await emailService.sendEmail({
      to: user.email,
      subject: 'A message from your JIE Mastery team',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
            <h2 style="margin: 0;">JIE Mastery</h2>
          </div>
          <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
            <p>Hi ${user.studentName || user.username},</p>
            <p>${message}</p>
            <p style="margin-top: 24px;">
              <a href="${process.env.APP_URL || 'https://app.jiemastery.ai'}/tutor" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Start a Study Session</a>
            </p>
            <p style="color: #64748b; font-size: 14px; margin-top: 24px;">— The JIE Mastery Team</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Academic Admin] Nudge error:', error);
    res.status(500).json({ error: 'Failed to send nudge' });
  }
});

// GET /reports — aggregate reporting
adminRouter.get('/reports', async (req, res) => {
  try {
    // Platform-wide metrics
    const avgEngagement = await db.execute(sql`
      SELECT AVG(es.engagement_score::numeric) as avg_score
      FROM (
        SELECT DISTINCT ON (user_id) engagement_score
        FROM student_engagement_scores
        ORDER BY user_id, week_start DESC
      ) es
    `);

    // Active users this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const activeUsersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) as count
      FROM realtime_sessions
      WHERE started_at >= ${weekStart}
    `);

    // Total study hours (approximate from sessions)
    const studyHoursResult = await db.execute(sql`
      SELECT COALESCE(SUM(minutes_used), 0) as total_minutes
      FROM realtime_sessions
      WHERE started_at >= ${weekStart}
    `);

    // Risk distribution
    const riskDistribution = await db.execute(sql`
      SELECT
        COALESCE(risk_level, 'on_track') as risk_level,
        COUNT(*) as count
      FROM (
        SELECT DISTINCT ON (user_id) risk_level
        FROM student_engagement_scores
        ORDER BY user_id, week_start DESC
      ) sub
      GROUP BY risk_level
    `);

    // Course engagement (top/bottom)
    const courseEngagement = await db.execute(sql`
      SELECT
        sc.course_name,
        sc.course_code,
        AVG(es.engagement_score::numeric) as avg_engagement,
        COUNT(DISTINCT es.user_id) as student_count
      FROM student_engagement_scores es
      JOIN student_courses sc ON sc.id = es.course_id
      GROUP BY sc.course_name, sc.course_code
      ORDER BY avg_engagement DESC
      LIMIT 20
    `);

    res.json({
      avgEngagementScore: Number((avgEngagement.rows[0] as any)?.avg_score || 0).toFixed(1),
      activeUsersThisWeek: Number((activeUsersResult.rows[0] as any)?.count || 0),
      totalStudyHoursThisWeek: (Number((studyHoursResult.rows[0] as any)?.total_minutes || 0) / 60).toFixed(1),
      riskDistribution: riskDistribution.rows,
      courseEngagement: courseEngagement.rows,
    });
  } catch (error: any) {
    console.error('[Academic Admin] Report error:', error);
    res.status(500).json({ error: 'Failed to generate reports' });
  }
});

// GET /export — CSV export for institutional reporting
adminRouter.get('/export', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        u.student_name as "Student Name",
        u.email as "Email",
        u.username as "Username",
        COALESCE(c.course_count, 0) as "Courses",
        COALESCE(e.latest_score, 0) as "Engagement Score",
        COALESCE(e.latest_risk, 'N/A') as "Risk Level",
        COALESCE(e.latest_trend, 'N/A') as "Trend",
        s.last_session as "Last Session",
        COALESCE(t.tasks_completed, 0) as "Tasks Completed",
        COALESCE(t.tasks_total, 0) as "Total Tasks"
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as course_count FROM student_courses WHERE is_active = true GROUP BY user_id
      ) c ON c.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT engagement_score as latest_score, risk_level as latest_risk, trend as latest_trend
        FROM student_engagement_scores WHERE user_id = u.id ORDER BY week_start DESC LIMIT 1
      ) e ON true
      LEFT JOIN LATERAL (
        SELECT MAX(started_at) as last_session FROM realtime_sessions WHERE user_id = u.id
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed') as tasks_completed,
          COUNT(*) as tasks_total
        FROM student_tasks WHERE user_id = u.id
      ) t ON true
      WHERE u.is_admin = false
      ORDER BY u.student_name ASC NULLS LAST
    `);

    if (!result.rows.length) {
      return res.status(200).send('No data to export');
    }

    const headers = Object.keys(result.rows[0] as object);
    const csv = [
      headers.join(','),
      ...result.rows.map((row: any) =>
        headers.map(h => {
          const val = row[h] ?? '';
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=academic-report-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error('[Academic Admin] Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL FUNCTIONS (for reminders, parent digests, nudges)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /send-reminders — triggered by cron or manually
router.post('/send-reminders', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const today = new Date().toISOString().split('T')[0];

    // Find undelivered reminders for today
    const dueReminders = await db.select({
      reminder: studentReminders,
      eventTitle: studentCalendarEvents.title,
      eventDate: studentCalendarEvents.startDate,
      eventTime: studentCalendarEvents.startTime,
    })
      .from(studentReminders)
      .leftJoin(studentCalendarEvents, eq(studentReminders.eventId, studentCalendarEvents.id))
      .where(and(
        eq(studentReminders.userId, userId),
        eq(studentReminders.delivered, false),
        lte(studentReminders.reminderDate, today),
        or(
          eq(studentReminders.deliveryMethod, 'email'),
          eq(studentReminders.deliveryMethod, 'both'),
        ),
      ));

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    let sent = 0;
    for (const r of dueReminders) {
      try {
        const baseUrl = process.env.APP_URL || 'https://app.jiemastery.ai';
        await emailService.sendEmail({
          to: user.email,
          subject: `Reminder: ${r.reminder.message || r.eventTitle || 'Academic reminder'}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                <h2 style="margin: 0;">JIE Mastery Reminder</h2>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e293b;">${r.reminder.message || 'You have an upcoming event'}</h3>
                ${r.eventTitle ? `<p><strong>Event:</strong> ${r.eventTitle}</p>` : ''}
                ${r.eventDate ? `<p><strong>Date:</strong> ${r.eventDate}</p>` : ''}
                ${r.eventTime ? `<p><strong>Time:</strong> ${r.eventTime}</p>` : ''}
                <p style="margin-top: 24px;">
                  <a href="${baseUrl}/tutor" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Study with JIE</a>
                </p>
              </div>
            </div>
          `,
        });

        await db.update(studentReminders)
          .set({ delivered: true, deliveredAt: new Date() })
          .where(eq(studentReminders.id, r.reminder.id));
        sent++;
      } catch (emailError) {
        console.error(`[Academic] Failed to send reminder ${r.reminder.id}:`, emailError);
      }
    }

    res.json({ sent, total: dueReminders.length });
  } catch (error: any) {
    console.error('[Academic] Error sending reminders:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

// POST /send-parent-digest — send digest to parents
router.post('/send-parent-digest', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const shares = await db.select().from(studentParentShares)
      .where(and(eq(studentParentShares.userId, userId), eq(studentParentShares.isActive, true)));

    if (shares.length === 0) return res.json({ sent: 0 });

    // Gather data
    const courses = await db.select().from(studentCourses)
      .where(and(eq(studentCourses.userId, userId), eq(studentCourses.isActive, true)));

    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekStr = weekFromNow.toISOString().split('T')[0];

    const upcomingEvents = await db.select().from(studentCalendarEvents)
      .where(and(
        eq(studentCalendarEvents.userId, userId),
        gte(studentCalendarEvents.startDate, today),
        lte(studentCalendarEvents.startDate, weekStr),
      ))
      .orderBy(asc(studentCalendarEvents.startDate));

    // Get latest engagement score
    const [latestEngagement] = await db.select().from(studentEngagementScores)
      .where(eq(studentEngagementScores.userId, userId))
      .orderBy(desc(studentEngagementScores.weekStart))
      .limit(1);

    // Count completed sessions this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const sessionsResult = await db.select({ count: sql<number>`count(*)` })
      .from(realtimeSessions)
      .where(and(eq(realtimeSessions.userId, userId), gte(realtimeSessions.startedAt, weekStart)));

    let sent = 0;
    for (const share of shares) {
      try {
        const eventsList = upcomingEvents.map(e =>
          `<li><strong>${e.title}</strong> — ${e.startDate}${e.startTime ? ` at ${e.startTime}` : ''}</li>`
        ).join('');

        await emailService.sendEmail({
          to: share.parentEmail,
          subject: `${user.studentName || user.username}'s Weekly Academic Digest — JIE Mastery`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                <h2 style="margin: 0;">JIE Mastery — Weekly Digest</h2>
                <p style="margin: 4px 0 0 0; opacity: 0.9;">${user.studentName || user.username}'s Academic Progress</p>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                ${share.parentName ? `<p>Hi ${share.parentName},</p>` : '<p>Hello,</p>'}
                <p>Here's a summary of ${user.studentName || user.username}'s academic activity:</p>

                <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
                  <h4 style="margin: 0 0 8px 0; color: #6366f1;">Engagement Score</h4>
                  <p style="font-size: 32px; font-weight: bold; margin: 0; color: ${Number(latestEngagement?.engagementScore || 0) >= 70 ? '#10b981' : Number(latestEngagement?.engagementScore || 0) >= 50 ? '#f59e0b' : '#ef4444'};">
                    ${latestEngagement?.engagementScore || '—'}/100
                  </p>
                  <p style="color: #64748b; margin: 4px 0 0 0;">Trend: ${latestEngagement?.trend || 'N/A'}</p>
                </div>

                <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
                  <h4 style="margin: 0 0 8px 0;">This Week</h4>
                  <p>Courses: ${courses.length} | Sessions: ${sessionsResult[0]?.count || 0}</p>
                </div>

                ${upcomingEvents.length > 0 ? `
                <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
                  <h4 style="margin: 0 0 8px 0;">Upcoming This Week</h4>
                  <ul style="padding-left: 20px;">${eventsList}</ul>
                </div>
                ` : ''}

                <p style="color: #64748b; font-size: 14px; margin-top: 24px;">— JIE Mastery AI, Inc.</p>
              </div>
            </div>
          `,
        });
        sent++;
      } catch (emailError) {
        console.error(`[Academic] Failed to send digest to ${share.parentEmail}:`, emailError);
      }
    }

    res.json({ sent, total: shares.length });
  } catch (error: any) {
    console.error('[Academic] Error sending parent digest:', error);
    res.status(500).json({ error: 'Failed to send parent digest' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VOICE INTEGRATION HELPER (exported for custom-voice-ws.ts)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getAcademicContextForVoice(userId: string): Promise<string> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekStr = weekFromNow.toISOString().split('T')[0];

    // Upcoming exams within 7 days
    const upcomingExams = await db.select({
      title: studentCalendarEvents.title,
      startDate: studentCalendarEvents.startDate,
      courseName: studentCourses.courseName,
    })
      .from(studentCalendarEvents)
      .leftJoin(studentCourses, eq(studentCalendarEvents.courseId, studentCourses.id))
      .where(and(
        eq(studentCalendarEvents.userId, userId),
        eq(studentCalendarEvents.eventType, 'exam'),
        gte(studentCalendarEvents.startDate, today),
        lte(studentCalendarEvents.startDate, weekStr),
        eq(studentCalendarEvents.status, 'upcoming'),
      ))
      .orderBy(asc(studentCalendarEvents.startDate));

    // Overdue or due-today assignments
    const overdueAssignments = await db.select({
      title: studentCalendarEvents.title,
      startDate: studentCalendarEvents.startDate,
      courseName: studentCourses.courseName,
    })
      .from(studentCalendarEvents)
      .leftJoin(studentCourses, eq(studentCalendarEvents.courseId, studentCourses.id))
      .where(and(
        eq(studentCalendarEvents.userId, userId),
        or(
          eq(studentCalendarEvents.eventType, 'assignment'),
          eq(studentCalendarEvents.eventType, 'project'),
        ),
        lte(studentCalendarEvents.startDate, today),
        eq(studentCalendarEvents.status, 'upcoming'),
      ))
      .orderBy(asc(studentCalendarEvents.startDate));

    // Active study tasks
    const activeTasks = await db.select({
      title: studentTasks.title,
      dueDate: studentTasks.dueDate,
      courseName: studentCourses.courseName,
    })
      .from(studentTasks)
      .leftJoin(studentCourses, eq(studentTasks.courseId, studentCourses.id))
      .where(and(
        eq(studentTasks.userId, userId),
        or(eq(studentTasks.status, 'pending'), eq(studentTasks.status, 'in_progress')),
        lte(studentTasks.dueDate, weekStr),
      ))
      .orderBy(asc(studentTasks.dueDate))
      .limit(5);

    if (upcomingExams.length === 0 && overdueAssignments.length === 0 && activeTasks.length === 0) {
      return '';
    }

    let context = '\n\n━━━ STUDENT ACADEMIC CONTEXT ━━━\n';

    if (upcomingExams.length > 0) {
      context += 'UPCOMING EXAMS (within 7 days):\n';
      for (const exam of upcomingExams) {
        const daysUntil = Math.ceil((new Date(exam.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        context += `- ${exam.courseName || 'Course'}: ${exam.title} on ${exam.startDate} (${daysUntil} day${daysUntil !== 1 ? 's' : ''} away)\n`;
      }
    }

    if (overdueAssignments.length > 0) {
      context += 'OVERDUE/DUE-TODAY ASSIGNMENTS:\n';
      for (const a of overdueAssignments) {
        context += `- ${a.courseName || 'Course'}: ${a.title} (due ${a.startDate})\n`;
      }
    }

    if (activeTasks.length > 0) {
      context += 'ACTIVE STUDY TASKS:\n';
      for (const t of activeTasks) {
        context += `- ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}\n`;
      }
    }

    context += 'Use this to proactively suggest relevant study topics. For example: "I see you have an exam coming up — want to review that?"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return context;
  } catch (error) {
    console.error('[Academic] Error building voice context:', error);
    return '';
  }
}

export { router as academicRouter, adminRouter as adminAcademicRouter };
export default router;
