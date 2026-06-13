const express = require('express');
const router = express.Router();
const { run, getOne, getAll } = require('../database');

router.get('/', (req, res) => {
  const tasks = getAll('SELECT * FROM tasks WHERE is_active=1');
  if (req.query.telegram_id) {
    const completed = getAll('SELECT task_id FROM user_tasks WHERE telegram_id=?', [String(req.query.telegram_id)]).map(r=>r.task_id);
    return res.json({ tasks: tasks.map(t=>({...t, completed:completed.includes(t.id)})) });
  }
  res.json({ tasks });
});

router.post('/complete', (req, res) => {
  try {
    const { telegram_id, task_id } = req.body;
    if (!telegram_id||!task_id) return res.status(400).json({ error:'telegram_id and task_id required' });
    const tid = String(telegram_id);
    const user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    if (!user) return res.status(404).json({ error:'User not found' });
    const task = getOne('SELECT * FROM tasks WHERE id=? AND is_active=1', [task_id]);
    if (!task) return res.status(404).json({ error:'Task not found' });
    const already = getOne('SELECT id FROM user_tasks WHERE telegram_id=? AND task_id=?', [tid, task_id]);
    if (already) return res.status(400).json({ error:'Task already completed' });

    run('INSERT INTO user_tasks (telegram_id, task_id) VALUES (?,?)', [tid, task_id]);
    run(`UPDATE users SET balance=balance+?, total_earned=total_earned+?, tasks_completed=tasks_completed+1, updated_at=datetime('now') WHERE telegram_id=?`, [task.reward, task.reward, tid]);
    run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'task',task.reward,`Task: ${task.title}`]);

    const updated = getOne('SELECT balance, tasks_completed FROM users WHERE telegram_id=?', [tid]);
    res.json({ success:true, reward:task.reward, balance:updated.balance, tasks_completed:updated.tasks_completed });
  } catch(err) { res.status(500).json({ error:err.message }); }
});

module.exports = router;
