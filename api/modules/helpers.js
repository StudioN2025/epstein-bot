import config from './config.js';

// Кэш для данных
let dataCache = null;
let cacheTime = 0;
const CACHE_TTL = 5000;
let warmupInterval = null;

// Загрузка данных с кэшем
export async function loadData() {
  const now = Date.now();
  if (dataCache && (now - cacheTime) < CACHE_TTL) {
    return dataCache;
  }
  
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY }
    });
    const data = await res.json();
    dataCache = data.record;
    cacheTime = now;
    return data.record;
  } catch (e) {
    return dataCache || { users: {} };
  }
}

// Сохранение данных
export async function saveData(data) {
  dataCache = data;
  cacheTime = Date.now();
  
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'X-Master-Key': process.env.JSONBIN_API_KEY 
      },
      body: JSON.stringify(data)
    });
  } catch (e) {}
}

// Отправка сообщения
export async function sendMessage(token, chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Редактирование сообщения
export async function editMessage(token, chatId, messageId, text, keyboard = null) {
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Удаление сообщения
export async function deleteMessage(token, chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

// Ответ на callback
export async function answerCallback(callbackId, text = null) {
  const body = { callback_query_id: callbackId };
  if (text) body.text = text;
  
  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Очистка команды
export function cleanCommand(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/@\w+/, '').trim();
}

// Проверка админа в личке
export function isAdminPrivate(userId, chatType) {
  return (userId === config.ADMIN_USER_ID && chatType === 'private');
}

// Self-ping для поддержания активности
export function startWarmup(botToken) {
  if (warmupInterval) return;
  
  warmupInterval = setInterval(async () => {
    try {
      await fetch(`https://${process.env.VERCEL_URL || 'epstein-bot.vercel.app'}/api/webhook`, {
        method: 'GET'
      });
    } catch(e) {}
  }, 4 * 60 * 1000);
}

// Функции для захваченных подвалов
export function addCapturedBasement(user, ownerId, ownerName) {
  if (!user.capturedBasementsDetails) user.capturedBasementsDetails = [];
  
  const existing = user.capturedBasementsDetails.find(c => c.ownerId === ownerId);
  if (existing) {
    existing.count++;
  } else {
    user.capturedBasementsDetails.push({ ownerId, owner: ownerName, count: 1 });
  }
  user.capturedBasements = (user.capturedBasements || 0) + 1;
}

export function removeCapturedBasement(user, ownerId, amount = 1) {
  if (!user.capturedBasementsDetails) return 0;
  
  const existing = user.capturedBasementsDetails.find(c => c.ownerId === ownerId);
  if (existing) {
    const removed = Math.min(existing.count, amount);
    existing.count -= removed;
    user.capturedBasements = (user.capturedBasements || 0) - removed;
    
    if (existing.count <= 0) {
      user.capturedBasementsDetails = user.capturedBasementsDetails.filter(c => c.ownerId !== ownerId);
    }
    return removed;
  }
  return 0;
}

// Экранирование Markdown
export function escapeMarkdown(text) {
  if (!text) return 'Unknown';
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
