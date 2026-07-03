const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const noteValidationRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be 200 characters or fewer'),
  body('content')
    .optional()
    .isString().withMessage('Content must be a string')
    .isLength({ max: 5000 }).withMessage('Content must be 5000 characters or fewer')
];

const idValidationRule = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID must be a positive integer')
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => e.msg) });
  }
  next();
}

app.get('/notes', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notes ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/notes/:id', idValidationRule, handleValidationErrors, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/notes', noteValidationRules, handleValidationErrors, async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await db.query(
      'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
      [title, content || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/notes/:id', idValidationRule, noteValidationRules, handleValidationErrors, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

    const { title, content } = req.body;
    const note = existing.rows[0];

    const result = await db.query(
      `UPDATE notes SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [
        title !== undefined ? title : note.title,
        content !== undefined ? content : note.content,
        req.params.id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/notes/:id', idValidationRule, handleValidationErrors, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Note not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
