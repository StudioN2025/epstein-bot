import { sendMessage, escapeMarkdown, saveData } from './helpers.js';

export async function updateActivityStats(userId, username, data) {
  if (!data.activity) data.activity = {};
  if (!data.activity[userId]) {
    data.activity[userId] = { username, total: 0, hourly: {}, daily: {}, weekly: {} };
  }
  
  const now = Date.now();
  const hourKey = Math.floor(now / 3600000);
  const dayKey = Math.floor(now / 86400000);
  const weekKey = Math.floor(now / 604800000);
  
  const ua = data.activity[userId];
  ua.username = username;
  ua.total = (ua.total || 0) + 1;
  ua.hourly[hourKey] = (ua.hourly[hourKey] || 0) + 1;
  ua.daily[dayKey] = (ua.daily[dayKey] || 0) + 1;
  ua.weekly[weekKey] = (ua.weekly[weekKey] || 0) + 1;
  
  // Очистка старых данных
  for (const key in ua.hourly) if (parseInt(key) < hourKey - 24) delete ua.hourly[key];
  for (const key in ua.daily) if (parseInt(key) < dayKey - 7) delete ua.daily[key];
  for (const key in ua.weekly) if (parseInt(key) < weekKey - 4) delete ua.weekly[key];
  
  return data;
}

export async function handleActivityCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/activity') return false;
  
  const ua = data.activity?.[userId];
  if (!ua || ua.total === 0) {
    await sendMessage(BOT_TOKEN, chatId, `📊 У вас пока нет сообщений!`);
    return true;
  }
  
  const now = Date.now();
  const currentHour = Math.floor(now / 3600000);
  const currentDay = Math.floor(now / 86400000);
  const currentWeek = Math.floor(now / 604800000);
  
  const getPeriod = (period, key) => ua[period]?.[key] || 0;
  
  await sendMessage(BOT_TOKEN, chatId,
    `📊 *СТАТИСТИКА АКТИВНОСТИ* 📊\n\n👤 ${escapeMarkdown(username)}\n\n` +
    `📈 Всего: ${ua.total}\n\n` +
    `⏰ За час: ${getPeriod('hourly', currentHour)}\n📅 За день: ${getPeriod('daily', currentDay)}\n📆 За неделю: ${getPeriod('weekly', currentWeek)}`);
  return true;
}

export async function handleTopActivityCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/topactivity')) return false;
  
  const parts = rawText.split(' ');
  let period = 'total';
  if (parts[1] === 'hour') period = 'hourly';
  else if (parts[1] === 'day') period = 'daily';
  else if (parts[1] === 'week') period = 'weekly';
  
  const now = Date.now();
  const currentKey = period === 'hourly' ? Math.floor(now / 3600000) :
                     period === 'daily' ? Math.floor(now / 86400000) :
                     Math.floor(now / 604800000);
  
  if (!data.activity) {
    await sendMessage(BOT_TOKEN, chatId, '📊 Топ активности пуст!');
    return true;
  }
  
  const users = [];
  for (const [uid, act] of Object.entries(data.activity)) {
    let score = period === 'total' ? (act.total || 0) : (act[period]?.[currentKey] || 0);
    if (score > 0) users.push({ username: act.username || 'Unknown', score });
  }
  
  users.sort((a, b) => b.score - a.score);
  const top = users.slice(0, 10);
  
  if (!top.length) {
    await sendMessage(BOT_TOKEN, chatId, '📊 Топ активности пуст!');
    return true;
  }
  
  const periodNames = { total: 'ЗА ВСЕ ВРЕМЯ', hourly: 'ЗА ЭТОТ ЧАС', daily: 'ЗА СЕГОДНЯ', weekly: 'ЗА ЭТУ НЕДЕЛЮ' };
  let reply = `🏆 *ТОП АКТИВНОСТИ* 🏆\n📊 ${periodNames[period]}\n\n`;
  for (let i = 0; i < top.length; i++) {
    reply += `${i+1}. ${escapeMarkdown(top[i].username)} — ${top[i].score} 💬\n`;
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}
