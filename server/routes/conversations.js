import { Router } from 'express';
import pool from '../db/connection.js';
import { loadResults, loadSubScores } from './match.js';

const router = Router();

function titleFor(conversation, firstUserMessage) {
  const fields = conversation.fields ? JSON.parse(conversation.fields) : {};
  if (fields.business_name) return fields.business_name;
  if (firstUserMessage) return firstUserMessage.length > 60 ? `${firstUserMessage.slice(0, 60)}…` : firstUserMessage;
  return 'New conversation';
}

// List the current user's conversations, newest first, for the history
// sidebar. Every query here is scoped to req.userId — never trust anything
// else to decide whose data this is.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.status, c.application_id, c.created_at, c.fields,
            (SELECT content FROM conversation_messages m WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.id ASC LIMIT 1) AS first_message
     FROM conversations c
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [req.userId]
  );

  res.json(
    rows.map((row) => ({
      id: row.id,
      status: row.status,
      applicationId: row.application_id,
      createdAt: row.created_at,
      title: titleFor(row, row.first_message),
    }))
  );
});

// Full detail for resuming a conversation: its message thread, plus the
// match results if it reached completion.
router.get('/:id', async (req, res) => {
  const { rows: convoRows } = await pool.query('SELECT * FROM conversations WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  const conversation = convoRows[0];
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const { rows: messages } = await pool.query(
    'SELECT role, content, reasoning, created_at FROM conversation_messages WHERE conversation_id = $1 ORDER BY id ASC',
    [conversation.id]
  );

  let results = null;
  if (conversation.application_id) {
    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [
      conversation.application_id,
      req.userId,
    ]);
    const application = appRows[0];
    if (application) {
      const matches = await loadResults(application.id);
      if (matches.length > 0) {
        results = {
          applicationId: application.id,
          readinessScore: matches[0].readiness_score,
          subScores: await loadSubScores(application.id),
          aiSummary: matches[0].ai_summary,
          matches,
        };
      }
    }
  }

  res.json({
    id: conversation.id,
    status: conversation.status,
    title: titleFor(conversation, messages.find((m) => m.role === 'user')?.content),
    messages,
    results,
  });
});

export default router;
