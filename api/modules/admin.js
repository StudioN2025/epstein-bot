const { sendMessage, saveData } = require('./helpers');
const { PROMOCODES } = require('./promo');

async function handleAdminCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
  if (!isAdmin) return false;
  
  // /addsoap
  if (cleanText.startsWith('/addsoap')) {
    const parts = rawText.split(' ');
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
  
  // /removesoap
  if (cleanText.startsWith('/removesoap')) {
    const parts = rawText.split(' ');
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
  
  // /addchild
  if (cleanText.startsWith('/addchild')) {
    const parts = rawText.split(' ');
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
  
  // /removechild
  if (cleanText.startsWith('/removechild')) {
    const parts = rawText.split(' ');
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
  
  // /addbasement
  if (cleanText.startsWith('/addbasement')) {
    const parts = rawText.split(' ');
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
  
  // /removebasement
  if (cleanText.startsWith('/removebasement')) {
    const parts = rawText.split(' ');
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
  
  // /addmobilized
  if (cleanText.startsWith('/addmobilized')) {
    const parts = rawText.split(' ');
    if (parts.length < 3) {
      await sendMessage(BOT_TOKEN, chatId, `❌ /addmobilized @username 2`);
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
    let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, mobilized: 0 };
    targetUser.mobilized = (targetUser.mobilized || 0) + amount;
    targetUser.username = targetUsername;
    data.users[targetId] = targetUser;
    await saveData(data);
    await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} ⚔️ мобилизованных @${targetUsername}\n📊 Теперь: ${targetUser.mobilized} ⚔️`);
    return true;
  }
  
  // /removemobilized
  if (cleanText.startsWith('/removemobilized')) {
    const parts = rawText.split(' ');
    if (parts.length < 3) {
      await sendMessage(BOT_TOKEN, chatId, `❌ /removemobilized @username 2`);
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
    let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, mobilized: 0 };
    targetUser.mobilized = Math.max(0, (targetUser.mobilized || 0) - amount);
    targetUser.username = targetUsername;
    data.users[targetId] = targetUser;
    await saveData(data);
    await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} ⚔️ мобилизованных у @${targetUsername}\n📊 Теперь: ${targetUser.mobilized} ⚔️`);
    return true;
  }
  
  // /createpromo
  if (cleanText.startsWith('/createpromo')) {
    const parts = rawText.split(' ');
    if (parts.length < 4) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /createpromo КОД 100 10`);
      return true;
    }
    const code = parts[1].toLowerCase();
    const reward = parseInt(parts[2]);
    const maxUses = parseInt(parts[3]);
    if (isNaN(reward) || reward <= 0 || isNaN(maxUses) || maxUses <= 0) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Награда и количество должны быть положительными!`);
      return true;
    }
    PROMOCODES[code] = { reward: reward, maxUses: maxUses, usedCount: 0, usedBy: [] };
    data.promocodes = PROMOCODES;
    await saveData(data);
    await sendMessage(BOT_TOKEN, chatId, `✅ Промокод ${code.toUpperCase()} создан! Награда: ${reward} 🧼, максимум: ${maxUses} активаций`);
    return true;
  }
  
  // /promolist
  if (cleanText === '/promolist') {
    let reply = `📋 СПИСОК ПРОМОКОДОВ 📋\n\n`;
    if (Object.keys(PROMOCODES).length === 0) reply += `Нет промокодов.`;
    else {
      for (const [code, d] of Object.entries(PROMOCODES)) {
        reply += `🔸 ${code.toUpperCase()}\n   Награда: ${d.reward} 🧼\n   Активаций: ${d.usedCount}/${d.maxUses}\n\n`;
      }
    }
    await sendMessage(BOT_TOKEN, chatId, reply);
    return true;
  }
  
  // /deletepromo
  if (cleanText.startsWith('/deletepromo')) {
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /deletepromo КОД`);
      return true;
    }
    const code = parts[1].toLowerCase();
    if (!PROMOCODES[code]) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Промокод ${code.toUpperCase()} не найден!`);
      return true;
    }
    delete PROMOCODES[code];
    data.promocodes = PROMOCODES;
    await saveData(data);
    await sendMessage(BOT_TOKEN, chatId, `✅ Промокод ${code.toUpperCase()} удален!`);
    return true;
  }
  
  return false;
}

module.exports = { handleAdminCommand };
