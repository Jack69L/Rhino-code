const crypto = require('crypto');

function generateReferralCode(telegramId) {
  return 'EC' + crypto.createHash('md5').update(telegramId.toString()).digest('hex').substring(0, 6).toUpperCase();
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getUserLevel(totalEarned) {
  if (totalEarned >= 50) return 5;
  if (totalEarned >= 20) return 4;
  if (totalEarned >= 10) return 3;
  if (totalEarned >= 3) return 2;
  return 1;
}

function validateTelegramWebAppData(initData, botToken) {
  try {
    if (!initData) return false;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const checkHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return checkHash === hash;
  } catch {
    return false;
  }
}

function checkWithdrawalRequirements(user, reqRow) {
  return {
    has_invited_5: (user.total_referrals || 0) >= 5,
    has_30day_streak: (user.longest_streak || 0) >= 30,
    has_watched_100_ads: (user.ads_watched_total || 0) >= 100,
    has_completed_5_tasks: (user.tasks_completed || 0) >= 5,
    has_verified_account: reqRow ? reqRow.has_verified_account === 1 : false,
  };
}

module.exports = { generateReferralCode, getTodayDate, getCurrentMonth, getUserLevel, validateTelegramWebAppData, checkWithdrawalRequirements };
