const { sendMessage, saveData, loadData } = require('./helpers');
const config = require('./config');

// Функция для обновления статистики активности
async function updateActivityStats(userId, username, data) {
  if (!data.activity) data.activity = {};
  if (!data.activity[userId]) {
    data.activity[userId] = {
      username: username,
      total: 0,
      hourly: {},
      daily: {},
      weekly: {}
    };
  }
  
  const now = Date.now();
  const hourKey = Math.floor(now / 3600000); // час
  const dayKey = Math.floor(now / 86400000); // день
  const weekKey = Math.floor(now / 604800000); // неделя
  
  const userActivity = data.activity[userId];
  userActivity.username = username;
  userActivity.total = (userActivity.total || 0) + 1;
  
  // Почасовая статистика
  if (!userActivity.hourly) userActivity.hourly = {};
  userActivity.hourly[hourKey] = (userActivity.hourly[hourKey] || 0) + 1;
  
  // Ежедневная статистика
  if (!userActivity.daily) userActivity.daily = {};
  userActivity.daily[dayKey] = (userActivity.daily[dayKey] || 0) + 1;
  
  // Еженедельная статистика
  if (!userActivity.weekly) userActivity.weekly = {};
  userActivity.weekly[weekKey] = (userActivity.weekly[weekKey] || 0) + 1;
  
  // Очищаем старые данные (старше недели)
  const oneWeekAgo = weekKey - 1;
  for (const key in userActivity.hourly) {
    if (parseInt(key) < hourKey - 24) delete userActivity.hourly[key];
  }
  for (const key in userActivity.daily) {
    if (parseInt(key) < dayKey - 7) delete userActivity.daily[key];
  }
  for (const key in userActivity.weekly) {
    if (parseInt(key) < weekKey - 4) delete userActivity.weekly[key];
  }
  
  return data;
}

// Получить статистику за период
function getPeriodStats(userActivity, period, key) {
  if (!userActivity || !userActivity[period]) return 0;
  return userActivity[period][key] || 0;
}

// Получить сумму за последние N периодов
function getLastPeriodsSum(userActivity, period, count) {
  if (!userActivity || !userActivity[period]) return 0;
  const now = Date.now();
  let currentKey;
  if (period === 'hourly') currentKey = Math.floor(now / 3600000);
  else if (period === 'daily') currentKey = Math.floor(now / 86400000);
  else currentKey = Math.floor(now / 604800000);
  
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += userActivity[period][currentKey - i] || 0;
  }
  return sum;
}

// Команда /activity
async function handleActivityCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/activity') return false;
  
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000);
  const currentDay = Math.floor(now / 86400000);
  const currentWeek = Math.floor(now / 604800000);
  
  const userActivity = data.activity ? data.activity[userId] : null;
  
  if (!userActivity || userActivity.total === 0) {
    await sendMessage(BOT_TOKEN, chatId,
      `📊 *СТАТИСТИКА АКТИВНОСТИ ${escapeMarkdown(username)}* 📊\n\n` +
      `📝 У вас пока нет сообщений!\n` +
      `Напишите что-нибудь в чат, чтобы начать统计.`);
    return true;
  }
  
  const hourStats = getPeriodStats(userActivity, 'hourly', currentHour);
  const dayStats = getPeriodStats(userActivity, 'daily', currentDay);
  const weekStats = getPeriodStats(userActivity, 'weekly', currentWeek);
  
  const last24h = getLastPeriodsSum(userActivity, 'hourly', 24);
  const last7days = getLastPeriodsSum(userActivity, 'daily', 7);
  const last4weeks = getLastPeriodsSum(userActivity, 'weekly', 4);
  
  await sendMessage(BOT_TOKEN, chatId,
    `📊 *СТАТИСТИКА АКТИВНОСТИ* 📊\n\n` +
    `👤 *${escapeMarkdown(username)}*\n\n` +
    `📈 *Общая статистика:*\n` +
    `• Всего сообщений: ${userActivity.total}\n\n` +
    `⏰ *За час:* ${hourStats} сообщений\n` +
    `📅 *За день:* ${dayStats} сообщений\n` +
    `📆 *За неделю:* ${weekStats} сообщений\n\n` +
    `📊 *За последние:*\n` +
    `• 24 часа: ${last24h} сообщений\n` +
    `• 7 дней: ${last7days} сообщений\n` +
    `• 4 недели: ${last4weeks} сообщений`);
  return true;
}

// Команда /topactivity
async function handleTopActivityCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/topactivity')) return false;
  
  const parts = rawText.split(' ');
  let period = 'total'; // total, hour, day, week
  if (parts.length >= 2) {
    const p = parts[1].toLowerCase();
    if (p === 'hour' || p === 'hourly') period = 'hour';
    else if (p === 'day' || p === 'daily') period = 'day';
    else if (p === 'week' || p === 'weekly') period = 'week';
  }
  
  if (!data.activity) {
    await sendMessage(BOT_TOKEN, chatId, `📊 Топ активности пуст! Напишите сообщения, чтобы появиться в топе.`);
    return true;
  }
  
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000);
  const currentDay = Math.floor(now / 86400000);
  const currentWeek = Math.floor(now / 604800000);
  
  let users = [];
  
  for (const [uid, act] of Object.entries(data.activity)) {
    let score = 0;
    if (period === 'total') {
      score = act.total || 0;
    } else if (period === 'hour') {
      score = act.hourly ? (act.hourly[currentHour] || 0) : 0;
    } else if (period === 'day') {
      score = act.daily ? (act.daily[currentDay] || 0) : 0;
    } else if (period === 'week') {
      score = act.weekly ? (act.weekly[currentWeek] || 0) : 0;
    }
    
    if (score > 0) {
      users.push({
        username: act.username || 'Unknown',
        score: score
      });
    }
  }
  
  users.sort((a, b) => b.score - a.score);
  const topUsers = users.slice(0, 10);
  
  if (topUsers.length === 0) {
    let periodText = '';
    if (period === 'total') periodText = 'за все время';
    else if (period === 'hour') periodText = 'за этот час';
    else if (period === 'day') periodText = 'за сегодня';
    else periodText = 'за эту неделю';
    
    await sendMessage(BOT_TOKEN, chatId, `📊 Топ активности ${periodText} пуст!`);
    return true;
  }
  
  let periodTitle = '';
  if (period === 'total') periodTitle = 'ЗА ВСЕ ВРЕМЯ';
  else if (period === 'hour') periodTitle = 'ЗА ЭТОТ ЧАС';
  else if (period === 'day') periodTitle = 'ЗА СЕГОДНЯ';
  else periodTitle = 'ЗА ЭТУ НЕДЕЛЮ';
  
  let reply = `🏆 *ТОП АКТИВНОСТИ* 🏆\n`;
  reply += `📊 ${periodTitle}\n\n`;
  
  for (let i = 0; i < topUsers.length; i++) {
    const u = topUsers[i];
    reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.score} 💬\n`;
  }
  
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

// Экранирование Markdown
function escapeMarkdown(text) {
  if (!text) return 'Unknown';
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = { 
  handleActivityCommand, 
  handleTopActivityCommand,
  updateActivityStats 
};
