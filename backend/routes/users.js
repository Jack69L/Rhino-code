const express = require('express');
const router = express.Router();
const { run, getOne, getAll } = require('../database');
const { generateReferralCode, getTodayDate, getCurrentMonth, getUserLevel, checkWithdrawalRequirements } = require('../helpers');

router.post('/init', (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, referral_code: refCode } = req.body;
    if (!telegram_id) return res.status(400).json({ error: 'telegram_id required' });
    const tid = String(telegram_id);
    const today = getTodayDate();
    const currentMonth = getCurrentMonth();
    let user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);

    if (!user) {
      const myCode = generateReferralCode(tid);
      let referredBy = null;
      if (refCode && refCode !== myCode) {
        const referrer = getOne('SELECT telegram_id FROM users WHERE referral_code=?', [refCode]);
        if (referrer) referredBy = referrer.telegram_id;
      }
      run(`INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by, login_streak, last_login_date, ads_this_month, current_month) VALUES (?,?,?,?,?,?,1,?,0,?)`,
        [tid, username||null, first_name||null, last_name||null, myCode, referredBy, today, currentMonth]);
      if (referredBy) {
        run('UPDATE users SET balance=balance+0.75, total_earned=total_earned+0.75, total_referrals=total_referrals+1 WHERE telegram_id=?', [referredBy]);
        run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [referredBy,'referral',0.75,'Referral bonus']);
      }
      run('UPDATE users SET balance=balance+0.10, total_earned=total_earned+0.10 WHERE telegram_id=?', [tid]);
      run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'bonus',0.10,'Welcome bonus']);
      run('INSERT OR IGNORE INTO withdrawal_requirements (telegram_id) VALUES (?)', [tid]);
      user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    } else {
      const lastLogin = user.last_login_date;
      let newStreak = user.login_streak || 0;
      let streakBonus = 0;
      if (lastLogin !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        newStreak = (lastLogin === yesterdayStr) ? newStreak+1 : 1;
        const longestStreak = Math.max(user.longest_streak||0, newStreak);
        if (newStreak===7) streakBonus=0.25;
        else if (newStreak===14) streakBonus=0.50;
        else if (newStreak%30===0) streakBonus=1.00;
        else streakBonus=0.05;
        const resetMonth = user.current_month !== currentMonth ? 1 : 0;
        run(`UPDATE users SET login_streak=?, longest_streak=?, last_login_date=?, balance=balance+?, total_earned=total_earned+?, username=?, first_name=?, last_name=?, ads_watched_today=0, ads_this_month=CASE WHEN ? THEN 0 ELSE ads_this_month END, current_month=?, updated_at=datetime('now') WHERE telegram_id=?`,
          [newStreak, longestStreak, today, streakBonus, streakBonus, username||user.username, first_name||user.first_name, last_name||user.last_name, resetMonth, currentMonth, tid]);
        if (streakBonus>0) run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'streak',streakBonus,`Day ${newStreak} streak bonus`]);
      }
      run('INSERT OR IGNORE INTO withdrawal_requirements (telegram_id) VALUES (?)', [tid]);
      user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    }

    const level = getUserLevel(user.total_earned);
    if (level !== user.level) { run('UPDATE users SET level=? WHERE telegram_id=?', [level, tid]); user.level = level; }

    const reqRow = getOne('SELECT * FROM withdrawal_requirements WHERE telegram_id=?', [tid]);
    const requirements = checkWithdrawalRequirements(user, reqRow);
    const allRequirementsMet = Object.values(requirements).every(Boolean);
    const isWithdrawalEligible = user.balance >= 40 && allRequirementsMet;
    res.json({ success:true, user:{...user, level}, requirements, isWithdrawalEligible, allRequirementsMet });
  } catch(err) {
    console.error('Init error:', err);
    res.status(500).json({ error:'Server error', details:err.message });
  }
});

router.get('/leaderboard/top', (req, res) => {
  const top = getAll('SELECT telegram_id, first_name, username, total_earned, level, login_streak FROM users ORDER BY total_earned DESC LIMIT 10');
  res.json({ leaderboard: top });
});

router.get('/:telegram_id', (req, res) => {
  const user = getOne('SELECT * FROM users WHERE telegram_id=?', [req.params.telegram_id]);
  if (!user) return res.status(404).json({ error:'User not found' });
  const reqRow = getOne('SELECT * FROM withdrawal_requirements WHERE telegram_id=?', [req.params.telegram_id]);
  const requirements = checkWithdrawalRequirements(user, reqRow);
  const allMet = Object.values(requirements).every(Boolean);
  const transactions = getAll('SELECT * FROM transactions WHERE telegram_id=? ORDER BY created_at DESC LIMIT 20', [req.params.telegram_id]);
  res.json({ user, requirements, isWithdrawalEligible: user.balance>=40&&allMet, allRequirementsMet:allMet, transactions });
});

module.exports = router;
