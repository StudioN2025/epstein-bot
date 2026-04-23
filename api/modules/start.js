const { sendMessage, saveData, escapeMarkdown } = require('./helpers');
const config = require('./config');

// ========== АДМИН-КОМАНДЫ ==========

async function handleAddSoap(parts, user, data, BOT_TOKEN, chatId, username) {
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ /addsoap @username 50`);
    return true;
  }
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  let targetId = null;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      break;
    }
  }
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
  targetUser.balance = (targetUser.balance || 0) + amount;
  targetUser.username = targetUsername;
  data.users[targetId] = targetUser;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 🧼 @${targetUsername}\n📊 Теперь: ${targetUser.balance} 🧼`);
  return true;
}

async function handleRemoveSoap(parts, user, data, BOT_TOKEN, chatId, username) {
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ /removesoap @username 50`);
    return true;
  }
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  let targetId = null;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      break;
    }
  }
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
  targetUser.balance = Math.max(0, (targetUser.balance || 0) - amount);
  targetUser.username = targetUsername;
  data.users[targetId] = targetUser;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 🧼 у @${targetUsername}\n📊 Теперь: ${targetUser.balance} 🧼`);
  return true;
}

async function handleAddChild(parts, user, data, BOT_TOKEN, chatId, username) {
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ /addchild @username 2`);
    return true;
  }
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  let targetId = null;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      break;
    }
  }
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
  targetUser.children = (targetUser.children || 0) + amount;
  targetUser.username = targetUsername;
  data.users[targetId] = targetUser;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 👶 @${targetUsername}\n📊 Теперь: ${targetUser.children} 👶`);
  return true;
}

async function handleRemoveChild(parts, user, data, BOT_TOKEN, chatId, username) {
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ /removechild @username 2`);
    return true;
  }
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  let targetId = null;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      break;
    }
  }
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
  targetUser.children = Math.max(0, (targetUser.children || 0) - amount);
  targetUser.username = targetUsername;
  data.users[targetId] = targetUser;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 👶 у @${targetUsername}\n📊 Теперь: ${targetUser.children} 👶`);
  return true;
}

async function handleAddBasement(parts, user, data, BOT_TOKEN, chatId, username) {
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ /addbasement @username 2`);
    return true;
  }
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  let targetId = null;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      break;
    }
  }
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
  targetUser.basements = (targetUser.basements || 0) + amount;
  targetUser.username = targetUsername;
  data.users[targetId] = targetUser;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 🏚️ @${targetUsername}\n📊 Теперь: ${targetUser.basements} 🏚️`);
  return true;
}

async function handleRemoveBasement(parts, user, data, BOT_TOKEN, chatId, username) {
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ /removebasement @username 2`);
    return true;
  }
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  let targetId = null;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      break;
    }
  }
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
  targetUser.basements = Math.max(0, (targetUser.basements || 0) - amount);
  targetUser.username = targetUsername;
  data.users[targetId] = targetUser;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 🏚️ у @${targetUsername}\n📊 Теперь: ${targetUser.basements} 🏚️`);
  return true;
}

// ========== ТОПЫ ==========

async function handleTopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/top') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].balance === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏆 Топ пуст! Нафарми мыло первым 🧼');
    return true;
  }
  
  let reply = '🏆 *ТОП МЫЛА НА ОСТРОВЕ* 🏆\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.balance || 0} 🧼 (👶 ${u.children || 0}, 🏚️ ${u.basements || 0})\n`;
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

async function handleTopChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topchildren') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].children === 0) {
    await sendMessage(BOT_TOKEN, chatId, '👶 Топ детей пуст!');
    return true;
  }
  
  let reply = '👶 *ТОП ДЕТОВОДОВ* 👶\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    if (u.children > 0) {
      reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.children} 👶 (🏚️ ${u.basements || 0})\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

async function handleTopBasementsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topbasements') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.basements || 0) - (a.basements || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].basements === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏚️ Топ подвалов пуст!');
    return true;
  }
  
  let reply = '🏚️ *ТОП ПОДВАЛОВ* 🏚️\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    if (u.basements > 0) {
      reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.basements} 🏚️ (👶 ${u.children || 0})\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

// ========== СТАРТОВАЯ КОМАНДА ==========

async function handleStartCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin) {
  if (cleanText !== '/start') return false;
  
  let adminCommands = '';
  if (isAdmin) {
    adminCommands = `\n\n👑 *АДМИН-КОМАНДЫ:*\n` +
      `/addsoap @user 50\n/removesoap @user 50\n/addchild @user 2\n/removechild @user 2\n` +
      `/addbasement @user 2\n/removebasement @user 2\n` +
      `/createpromo КОД 100 10\n/deletepromo КОД\n/promolist\n`;
  }
  
  await sendMessage(BOT_TOKEN, chatId,
    `🧼 *ОСТРОВ ЭПШТЕЙНА* 🏝️\n\nПривет, ${escapeMarkdown(username)}!\n\n` +
    `🎯 *КОМАНДЫ:*\n` +
    `/farm — фарм мыла (1-30, раз в час)\n` +
    `/balance — баланс\n` +
    `/top — топ по мылу\n` +
    `/topchildren — топ по детям\n` +
    `/topbasements — топ по подвалам\n` +
    `/children — мои дети\n` +
    `/basements — мои подвалы\n` +
    `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
    `/buychild [количество] — купить детей (${config.CHILD_COST} 🧼/шт)\n` +
    `/sellbasement [количество] — продать подвалы\n` +
    `/sellchild [количество] — продать детей\n` +
    `/sendsoap @user 50 — перевести мыло\n` +
    `/sendchild @user 2 — перевести детей\n` +
    `/sendbasement @user 2 — перевести подвалы\n` +
    `/duel @user [ставка] — дуэль\n` +
    `/casino [ставка] [число] — казино (x2 при победе)\n` +
    `/promo — ввести промокод\n` +
    `/activity — моя статистика\n` +
    `/topactivity [hour/day/week] — топ активности\n` +
    `/events — история ивентов\n\n` +
    `🛒 *МАГАЗИН:*\n` +
    `/shop — посмотреть магазин\n` +
    `/sell [тип] [кол-во] [цена] — выставить товар\n` +
    `/buy [ID] — купить товар\n` +
    `/remove [ID] — снять объявление\n` +
    adminCommands +
    `\n\n📈 Дети приносят ${config.CHILD_INCOME} 🧼 в час!\n` +
    `⚠️ Пидиди крадет мыло (5%)\n` +
    `👶 1 ребенок = ${config.CHILD_COST} мыла\n` +
    `🏚️ 1 подвал = ${config.BASEMENT_COST} мыла\n` +
    `🔑 1 подвал = ${config.CHILDREN_PER_BASEMENT} детей`);
  return true;
}

// ========== ГЛАВНАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ АДМИН-КОМАНД ==========

async function handleAdminCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
  if (!isAdmin) return false;
  
  const parts = rawText.split(' ');
  const cmd = cleanText;
  
  if (cmd === '/addsoap') return await handleAddSoap(parts, user, data, BOT_TOKEN, chatId, username);
  if (cmd === '/removesoap') return await handleRemoveSoap(parts, user, data, BOT_TOKEN, chatId, username);
  if (cmd === '/addchild') return await handleAddChild(parts, user, data, BOT_TOKEN, chatId, username);
  if (cmd === '/removechild') return await handleRemoveChild(parts, user, data, BOT_TOKEN, chatId, username);
  if (cmd === '/addbasement') return await handleAddBasement(parts, user, data, BOT_TOKEN, chatId, username);
  if (cmd === '/removebasement') return await handleRemoveBasement(parts, user, data, BOT_TOKEN, chatId, username);
  
  return false;
}

module.exports = { 
  handleStartCommand,
  handleAdminCommand,
  handleTopCommand,
  handleTopChildrenCommand,
  handleTopBasementsCommand
};
