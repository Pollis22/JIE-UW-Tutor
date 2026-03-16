import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const feedbackSchema = z.object({
  sessionId: z.string().nullable().optional(),
  rating:    z.number().int().min(1).max(5),
  comment:   z.string().max(500).optional().default(''),
});

// Ensure table exists (safe to run multiple times)
async function ensureFeedbackTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS session_feedback (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER,
      session_id   TEXT,
      rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment      TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureFeedbackTable().catch(console.error);

router.post('/api/session-feedback', async (req: any, res) => {
  try {
    const user = req.user;
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid feedback data' });
    }
    const { sessionId, rating, comment } = parsed.data;

    await db.execute(sql`
      INSERT INTO session_feedback (user_id, session_id, rating, comment)
      VALUES (${user?.id ?? null}, ${sessionId ?? null}, ${rating}, ${comment})
    `);

    console.log(`[Feedback] user=${user?.id ?? 'anon'} rating=${rating} session=${sessionId ?? 'none'}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Feedback] Error:', err.message);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;
