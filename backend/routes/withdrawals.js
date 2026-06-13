const express = require('express');
const router = express.Router();
const { run, getOne, getAll } = require('../database');
const { checkWithdrawalRequirements } = require('../helpers');

const THRESHOLD = 40;

router.post('/request', (req, res) => {
  try {
    const { telegram_id, method, address } = req.body;
    if (!telegram_id||!method||!address) return res.status(400).json({ error:'telegram_id, method and address required' });
    const tid = String(telegram_id);
    const user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    if (!user) return res.status(404).json({ error:'User not found' });
    if (user.balance < THRESHOLD) return res.status(400).json({ error:`Minimum withdrawal is $${THRESHOLD}`, balance:user.balance });

    const reqRow = getOne('SELECT * FROM withdrawal_requirements WHERE telegram_id=?', [tid]);
    const requirements = checkWithdrawalRequirements(user, reqRow);
    const allMet = Object.values(requirements).every(Boolean);
    if (!allMet) return res.status(403).json({ error:'Withdrawal requirements not met', requirements });

    const pending = getOne("SELECT id FROM withdrawals WHERE telegram_id=? AND status='pending'", [tid]);
    if (pending) return res.status(400).json({ error:'You already have a pending withdrawal' });

    const amount = user.balance;
    run('INSERT INTO withdrawals (telegram_id, amount, method, address) VALUES (?,?,?,?)', [tid, amount, method, address]);
    run(`UPDATE users SET balance=0, updated_at=datetime('now') WHERE telegram_id=?`, [tid]);
    run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'withdrawal',-amount,`Withdrawal via ${method}`]);

    res.json({ success:true, message:'Withdrawal submitted. Processing within 3-5 business days.', amount });
  } catch(err) { res.status(500).json({ error:err.message }); }
});

router.get('/history/:telegram_id', (req, res) => {
  const withdrawals = getAll('SELECT * FROM withdrawals WHERE telegram_id=? ORDER BY created_at DESC', [req.params.telegram_id]);
  res.json({ withdrawals });
});

router.get('/admin/pending', (req, res) => {
  if (req.query.admin_key !== process.env.ADMIN_KEY) return res.status(403).json({ error:'Forbidden' });
  const pending = getAll("SELECT * FROM withdrawals WHERE status='pending' ORDER BY created_at ASC");
  res.json({ pending });
});

router.post('/admin/approve/:id', (req, res) => {
  if (req.body.admin_key !== process.env.ADMIN_KEY) return res.status(403).json({ error:'Forbidden' });
  run(`UPDATE withdrawals SET status='approved', admin_note=?, updated_at=datetime('now') WHERE id=?`, [req.body.note||null, req.params.id]);
  res.json({ success:true });
});

module.exports = router;
