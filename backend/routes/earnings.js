const express = require('express');
const router = express.Router();
const { run, getOne } = require('../database');
const { getTodayDate } = require('../helpers');

const AD_REWARD = 0.25, MAX_ADS = 12;

router.post('/watch-ad', (req, res) => {
  try {
    const { telegram_id } = req.body;
    if (!telegram_id) return res.status(400).json({ error:'telegram_id required' });
    const tid = String(telegram_id);
    const user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    if (!user) return res.status(404).json({ error:'User not found' });
    if (user.is_banned) return res.status(403).json({ error:'Account suspended' });
    if ((user.ads_watched_today||0) >= MAX_ADS) return res.status(429).json({ error:'Daily ad limit reached', limit:MAX_ADS });

    run(`UPDATE users SET balance=balance+?, total_earned=total_earned+?, ads_watched_today=ads_watched_today+1, ads_watched_total=ads_watched_total+1, ads_this_month=ads_this_month+1, updated_at=datetime('now') WHERE telegram_id=?`, [AD_REWARD, AD_REWARD, tid]);
    run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'ad',AD_REWARD,'Ad watched']);

    const updated = getOne('SELECT balance, ads_watched_today, ads_watched_total, ads_this_month, scratch_cards_available FROM users WHERE telegram_id=?', [tid]);
    if ((updated.ads_this_month||0) >= 30 && (updated.scratch_cards_available||0) === 0) {
      run('UPDATE users SET scratch_cards_available=scratch_cards_available+1 WHERE telegram_id=?', [tid]);
    }
    res.json({ success:true, reward:AD_REWARD, balance:updated.balance, ads_today:updated.ads_watched_today, ads_remaining:MAX_ADS-updated.ads_watched_today });
  } catch(err) { res.status(500).json({ error:err.message }); }
});

router.post('/spin', (req, res) => {
  try {
    const { telegram_id } = req.body;
    if (!telegram_id) return res.status(400).json({ error:'telegram_id required' });
    const tid = String(telegram_id);
    const user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    if (!user) return res.status(404).json({ error:'User not found' });

    if (user.last_spin_date) {
      const lastSpin = new Date(user.last_spin_date);
      const daysSince = (Date.now()-lastSpin)/(1000*60*60*24);
      if (daysSince < 7) return res.status(429).json({ error:'Spin available weekly', next_spin:new Date(lastSpin.getTime()+7*24*60*60*1000).toISOString() });
    }

    const prizes = [
      {amount:0,label:'Try Again',weight:30},{amount:.1,label:'$0.10',weight:25},
      {amount:.25,label:'$0.25',weight:20},{amount:.5,label:'$0.50',weight:13},
      {amount:1,label:'$1.00',weight:8},{amount:1.5,label:'$1.50',weight:3},{amount:2,label:'$2.00',weight:1}
    ];
    const total = prizes.reduce((s,p)=>s+p.weight,0);
    let rand = Math.random()*total, prize = prizes[0];
    for(const p of prizes){if(rand<p.weight){prize=p;break;}rand-=p.weight;}

    const today = getTodayDate();
    run(`UPDATE users SET last_spin_date=?, balance=balance+?, total_earned=total_earned+?, updated_at=datetime('now') WHERE telegram_id=?`, [today, prize.amount, prize.amount, tid]);
    if (prize.amount>0) run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'spin',prize.amount,`Weekly spin: ${prize.label}`]);

    const updated = getOne('SELECT balance FROM users WHERE telegram_id=?', [tid]);
    res.json({ success:true, prize:prize.label, amount:prize.amount, balance:updated.balance });
  } catch(err) { res.status(500).json({ error:err.message }); }
});

router.post('/scratch', (req, res) => {
  try {
    const { telegram_id } = req.body;
    if (!telegram_id) return res.status(400).json({ error:'telegram_id required' });
    const tid = String(telegram_id);
    const user = getOne('SELECT * FROM users WHERE telegram_id=?', [tid]);
    if (!user) return res.status(404).json({ error:'User not found' });
    if ((user.scratch_cards_available||0)<1) return res.status(400).json({ error:'No scratch cards available' });

    const prizes = [{amount:1,weight:40},{amount:2,weight:25},{amount:3,weight:15},{amount:5,weight:12},{amount:7.5,weight:5},{amount:10,weight:3}];
    const total = prizes.reduce((s,p)=>s+p.weight,0);
    let rand = Math.random()*total, prize = prizes[0];
    for(const p of prizes){if(rand<p.weight){prize=p;break;}rand-=p.weight;}

    run(`UPDATE users SET scratch_cards_available=scratch_cards_available-1, balance=balance+?, total_earned=total_earned+?, updated_at=datetime('now') WHERE telegram_id=?`, [prize.amount, prize.amount, tid]);
    run('INSERT INTO transactions (telegram_id, type, amount, description) VALUES (?,?,?,?)', [tid,'scratch',prize.amount,`Monthly scratch card: $${prize.amount.toFixed(2)}`]);

    const updated = getOne('SELECT balance, scratch_cards_available FROM users WHERE telegram_id=?', [tid]);
    res.json({ success:true, amount:prize.amount, balance:updated.balance, scratch_cards_remaining:updated.scratch_cards_available });
  } catch(err) { res.status(500).json({ error:err.message }); }
});

module.exports = router;
