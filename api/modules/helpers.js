const config = require('./config');

async function loadData() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY }
    });
    const data = await res.json();
    return data.record;
  } catch (e) {
    return { users: {} };
  }
}

async function saveData(data) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': process.env.JSONBIN_API_KEY },
      body: JSON.stringify(data)
    });
  } catch (e) {}
}

async function sendMessage(token, chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function editMessage(token, chatId, messageId, text, keyboard = null) {
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function deleteMessage(token, chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

async function answerCallback(callbackId, text = null) {
  const body = { callback_query_id: callbackId };
  if (text) body.text = text;
  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

function cleanCommand(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/@\w+/, '').trim();
}

function isAdminPrivate(userId, chatType) {
  return (userId === config.ADMIN_USER_ID && chatType === 'private');
}

// Функции для захваченных подвалов
function addCapturedBasement(user, ownerId, ownerName) {
  if (!user.capturedBasementsDetails) user.capturedBasementsDetails = [];
  
  const existing = user.capturedBasementsDetails.find(c => c.ownerId === ownerId);
  if (existing) {
    existing.count++;
  } else {
    user.capturedBasementsDetails.push({
      ownerId: ownerId,
      owner: ownerName,
      count: 1
    });
  }
  user.capturedBasements = (user.capturedBasements || 0) + 1;
}

function removeCapturedBasement(user, ownerId, amount = 1) {
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

// Пассивный доход от детей
async function collectChildIncome(user, now) {
  if (!user.children || user.children === 0) return 0;
  if (!user.lastChildIncome) {
    user.lastChildIncome = now;
    return 0;
  }
  const hoursPassed = Math.floor((now - user.lastChildIncome) / 3600000);
  if (hoursPassed > 0) {
    const income = user.children * config.CHILD_INCOME * hoursPassed;
    user.balance += income;
    user.lastChildIncome = now;
    return income;
  }
  return 0;
}

// Пассивный доход от захваченных подвалов
async function collectCapturedBasementsIncome(user, now) {
  if (!user.capturedBasements || user.capturedBasements === 0) return 0;
  if (!user.lastCapturedIncome) {
    user.lastCapturedIncome = now;
    return 0;
  }
  const hoursPassed = Math.floor((now - user.lastCapturedIncome) / 3600000);
  if (hoursPassed > 0) {
    const income = user.capturedBasements * config.BASEMENT_CAPTURE_REWARD * hoursPassed;
    user.balance += income;
    user.lastCapturedIncome = now;
    return income;
  }
  return 0;
}

module.exports = {
  loadData,
  saveData,
  sendMessage,
  editMessage,
  deleteMessage,
  answerCallback,
  cleanCommand,
  isAdminPrivate,
  addCapturedBasement,
  removeCapturedBasement,
  collectChildIncome,
  collectCapturedBasementsIncome
};
