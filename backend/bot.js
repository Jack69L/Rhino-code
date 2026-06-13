// Telegram Bot (python-telegram-bot equivalent in Node.js using node-telegram-bot-api)
// Run this separately: node bot.js
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://your-domain.com';
const API_URL = process.env.API_URL || 'http://localhost:3000';

const bot = new TelegramBot(TOKEN, { polling: true });

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function callAPI(endpoint, method='GET', body=null) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${endpoint}`, opts);
  return res.json();
}

// /start command
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const referralCode = match[1]?.trim() || null;

  // Register user via API
  await callAPI('/api/user/login', 'POST', {
    telegram_id: userId,
    username: msg.from.username || '',
    first_name: msg.from.first_name || '',
    last_name: msg.from.last_name || '',
    referral_code: referralCode,
  });

  const welcomeMsg = `
🪙 *Welcome to EarnCoin!*

Earn real money by watching ads, completing tasks, and inviting friends!

💰 *How to Earn:*
• 📺 Watch Ads → $0.25 each (12/day)
• ✅ Complete Tasks → $1.00 each  
• 👥 Invite Friends → $0.75 per invite
• 📋 Take Surveys → $0.50 each
• 🎡 Weekly Spin → Win up to $2.00
• 🎟️ Monthly Scratch → Win up to $10.00

🏆 *Withdraw at $40.00*

Open your dashboard below 👇
`;

  bot.sendMessage(chatId, welcomeMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🚀 Open EarnCoin App', web_app: { url: `${MINI_APP_URL}?user=${userId}` } }
      ],[
        { text: '📊 My Stats', callback_data: 'stats' },
        { text: '👥 Invite Friends', callback_data: 'invite' }
      ]]
    }
  });
});

// /stats command
bot.onText(/\/stats/, async (msg) => {
  const userId = String(msg.from.id);
  const data = await callAPI(`/api/user/${userId}`);
  if (data.error) return bot.sendMessage(msg.chat.id, '❌ Please use /start first');
  const u = data.user;
  bot.sendMessage(msg.chat.id, `
📊 *Your EarnCoin Stats*

💰 Balance: *$${u.balance.toFixed(2)}*
📈 Total Earned: *$${u.total_earned.toFixed(2)}*
🔥 Streak: *${u.streak} days*
👥 Referrals: *${data.referral_count}*
📺 Ads Today: *${u.ads_watched_today}/12*
⭐ Level: *${u.level}*
`, {parse_mode:'Markdown'});
});

// /invite command
bot.onText(/\/invite/, async (msg) => {
  const userId = String(msg.from.id);
  const data = await callAPI(`/api/user/${userId}`);
  if (data.error) return bot.sendMessage(msg.chat.id, '❌ Please use /start first');
  const code = data.user.referral_code;
  const link = `https://t.me/${(await bot.getMe()).username}?start=${code}`;
  bot.sendMessage(msg.chat.id, `
👥 *Invite Friends & Earn!*

Share your link and earn *$0.75* per friend who joins!
Plus earn *10%* of their ad earnings forever!

🔗 Your link:
\`${link}\`

Code: \`${code}\`
`, {parse_mode:'Markdown'});
});

// /withdraw command
bot.onText(/\/withdraw/, async (msg) => {
  const userId = String(msg.from.id);
  const data = await callAPI(`/api/withdraw/eligibility/${userId}`);
  
  if (!data.eligible_balance) {
    return bot.sendMessage(msg.chat.id, `
❌ *Not eligible yet*

Your balance: $${data.balance?.toFixed(2) || '0.00'}
Minimum required: $${data.min_required}

Keep earning! 💪
`, {parse_mode:'Markdown'});
  }

  const req = data.requirements;
  const allMet = data.all_requirements_met;

  let reqText = `
✅ Balance: $${data.balance.toFixed(2)} (Requirement met!)

📋 *Withdrawal Requirements:*
${req.invites_ok ? '✅' : '❌'} Invite 5 Friends: ${req.invites_done}/${req.invites_need}
${req.streak_ok ? '✅' : '❌'} 30-Day Streak: ${req.streak_done}/${req.streak_need} days
${req.tasks_ok ? '✅' : '❌'} Complete 20 Tasks: ${req.tasks_done}/${req.tasks_need}
${req.ads_ok ? '✅' : '❌'} Watch 200 Ads/Month: ${req.ads_done}/${req.ads_need}
`;

  if (allMet) {
    reqText += '\n🎉 *All requirements met! Open the app to withdraw.*';
    bot.sendMessage(msg.chat.id, reqText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '💸 Withdraw Now', web_app: { url: `${MINI_APP_URL}?user=${userId}&page=withdraw` } }
        ]]
      }
    });
  } else {
    reqText += '\n⚠️ Complete all requirements to unlock withdrawal.';
    bot.sendMessage(msg.chat.id, reqText, {parse_mode:'Markdown'});
  }
});

// Callback queries
bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const chatId = query.message.chat.id;
  bot.answerCallbackQuery(query.id);

  if (query.data === 'stats') {
    const data = await callAPI(`/api/user/${userId}`);
    const u = data.user;
    bot.sendMessage(chatId, `📊 Balance: $${u.balance.toFixed(2)} | Streak: ${u.streak}d | Refs: ${data.referral_count}`, {parse_mode:'Markdown'});
  }
  if (query.data === 'invite') {
    const data = await callAPI(`/api/user/${userId}`);
    const me = await bot.getMe();
    const link = `https://t.me/${me.username}?start=${data.user.referral_code}`;
    bot.sendMessage(chatId, `👥 Your invite link:\n${link}`);
  }
});

bot.on('polling_error', err => console.error('Bot error:', err.message));
console.log('EarnCoin Bot started!');
