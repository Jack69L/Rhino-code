require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, getOne } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/earnings', require('./routes/earnings'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/withdrawals', require('./routes/withdrawals'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// Boot: init DB first, then start server + bot
initDb().then(() => {
  console.log('✅ Database initialized');

  app.listen(PORT, () => console.log(`🚀 EarnCoin running on port ${PORT}`));

  // Telegram Bot
  if (process.env.BOT_TOKEN) {
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
    const APP_URL = process.env.APP_URL || 'https://your-app.railway.app';

    bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
      const chatId = msg.chat.id;
      const refCode = match[1] || null;
      const firstName = msg.from.first_name || 'friend';
      const appUrl = refCode ? `${APP_URL}?ref=${refCode}` : APP_URL;
      bot.sendMessage(chatId,
        `👋 Hey ${firstName}! Welcome to *EarnCoin* 💰\n\n` +
        `Earn real money by:\n📺 Watching Ads — $0.25/ad\n✅ Completing Tasks — up to $1.00\n👥 Inviting Friends — $0.75 each\n🎡 Weekly Spin — up to $2.00\n🎟️ Monthly Scratch — $1–$10\n\n💸 *Withdraw at $40* via PayPal or USDT`,
        { parse_mode:'Markdown', reply_markup:{ inline_keyboard:[[{ text:'💰 Open EarnCoin', web_app:{ url:appUrl } }],[{ text:'📢 Join Channel', url:'https://t.me/EarnCoinNews' }]] } }
      );
    });

    bot.onText(/\/balance/, (msg) => {
      const user = getOne('SELECT * FROM users WHERE telegram_id=?', [String(msg.from.id)]);
      if (!user) return bot.sendMessage(msg.chat.id, '❌ Open the app first to register.');
      bot.sendMessage(msg.chat.id,
        `💼 *EarnCoin Balance*\n\n💰 Balance: *$${parseFloat(user.balance).toFixed(2)}*\n📈 Total Earned: *$${parseFloat(user.total_earned).toFixed(2)}*\n🔥 Streak: *${user.login_streak} days*\n👥 Referrals: *${user.total_referrals}*\n\n${user.balance>=40?'✅ Eligible to withdraw!':'💡 Need $'+(40-user.balance).toFixed(2)+' more to unlock withdrawal'}`,
        { parse_mode:'Markdown' }
      );
    });

    bot.onText(/\/refer/, (msg) => {
      const user = getOne('SELECT referral_code FROM users WHERE telegram_id=?', [String(msg.from.id)]);
      if (!user) return bot.sendMessage(msg.chat.id, '❌ Open the app first.');
      const link = `https://t.me/${process.env.BOT_USERNAME||'EarnCoinBot'}?start=${user.referral_code}`;
      bot.sendMessage(msg.chat.id, `👥 *Your Referral Link*\n\n${link}\n\n💰 Earn *$0.75* per friend who joins!`, { parse_mode:'Markdown' });
    });

    console.log('✅ Telegram bot started');
  } else {
    console.log('⚠️  BOT_TOKEN not set — API-only mode');
  }
}).catch(err => {
  console.error('❌ Failed to init DB:', err);
  process.exit(1);
});
