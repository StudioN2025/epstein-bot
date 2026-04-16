const { sendMessage, saveData, escapeMarkdown } = require('./helpers');
const config = require('./config');

// ========== ДЕТИ ==========

async function handleChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  // Покупка детей
  if (cleanText.startsWith('/buychild')) {
    let amount = 1;
    const parts = rawText.split(' ');
    if (parts.length >= 2) {
      const parsed = parseInt(parts[1]);
      if (!isNaN(parsed) && parsed > 0) amount = parsed;
      else {
        await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
        return true;
      }
    }
    
    const userBasements = user.basements || 0;
    const userChildren = user.children || 0;
    const maxChildren = userBasements * config.CHILDREN_PER_BASEMENT;
    const available = maxChildren - userChildren;
    
    if (available < amount) {
      await sendMessage(BOT_TOKEN, chatId,
        `❌ Не хватает подвалов! Нужно еще ${Math.ceil((userChildren + amount) / config.CHILDREN_PER_BASEMENT) - userBasements} подвалов\n/buybasement [количество]`);
      return true;
    }
    
    const totalCost = config.CHILD_COST * amount;
    if (user.balance >= totalCost) {
      user.balance -= totalCost;
      user.children += amount;
      data.users[userId] = user;
      await saveData(data);
      await sendMessage(BOT_TOKEN, chatId,
        `👶 ${username} купил ${amount} ребенка(ей)!\n🧼 -${totalCost} мыла\n👶 Детей: ${user.children}\n🏚️ Подвалов: ${user.basements || 0}\n📈 +${user.children * config.CHILD_INCOME} 🧼/час`);
    } else {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${totalCost} 🧼`);
    }
    return true;
  }
  
  // Показать детей
  if (cleanText === '/children') {
    const hourlyIncome = (user.children || 0) * config.CHILD_INCOME;
    const userBasements = user.basements || 0;
    const userChildren = user.children || 0;
    const maxChildren = userBasements * config.CHILDREN_PER_BASEMENT;
    const canBuy = userChildren < maxChildren;
    
    await sendMessage(BOT_TOKEN, chatId,
      `👶 *ДЕТИ ${escapeMarkdown(username)}* 👶\n\n🧼 Мыла: ${user.balance}\n` +
      `🏚️ Подвалов: ${userBasements}\n👶 Детей: ${userChildren}\n⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
      `📌 Максимум детей: ${maxChildren}\n📌 Свободно мест: ${maxChildren - userChildren}\n` +
      `📈 Доход: ${hourlyIncome} 🧼/час\n\n` +
      `${canBuy ? '✅ /buychild [количество]' : '❌ Нужны подвалы! /buybasement'}`);
    return true;
  }
  
  return false;
}

// ========== ПОДВАЛЫ ==========

async function handleBasementCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  // Покупка подвалов
  if (cleanText.startsWith('/buybasement')) {
    let amount = 1;
    const parts = rawText.split(' ');
    if (parts.length >= 2) {
      const parsed = parseInt(parts[1]);
      if (!isNaN(parsed) && parsed > 0) amount = parsed;
      else {
        await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
        return true;
      }
    }
    
    const totalCost = config.BASEMENT_COST * amount;
    if (user.balance >= totalCost) {
      user.balance -= totalCost;
      user.basements = (user.basements || 0) + amount;
      data.users[userId] = user;
      await saveData(data);
      
      const maxChildren = user.basements * config.CHILDREN_PER_BASEMENT;
      await sendMessage(BOT_TOKEN, chatId,
        `🏚️ ${username} купил ${amount} подвал(ов)!\n🧼 -${totalCost} мыла\n🏚️ Подвалов: ${user.basements}\n📌 Можно иметь ${maxChildren} детей`);
    } else {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${totalCost} 🧼`);
    }
    return true;
  }
  
  // Показать подвалы
  if (cleanText === '/basements') {
    const userBasements = user.basements || 0;
    const userChildren = user.children || 0;
    const maxChildren = userBasements * config.CHILDREN_PER_BASEMENT;
    const canBuy = userChildren < maxChildren;
    
    await sendMessage(BOT_TOKEN, chatId,
      `🏚️ *ПОДВАЛЫ ${escapeMarkdown(username)}* 🏚️\n\n🧼 Цена: ${config.BASEMENT_COST} мыла\n` +
      `🏚️ Твои подвалы: ${userBasements}\n👶 Твои дети: ${userChildren}\n` +
      `📌 Максимум детей: ${maxChildren}\n📌 Свободно мест: ${maxChildren - userChildren}\n\n` +
      `${canBuy ? '✅ /buychild [количество]' : '❌ Нужны подвалы! /buybasement [количество]'}`);
    return true;
  }
  
  return false;
}

// ========== ПЕРЕВОДЫ ==========

async function handleSendSoap(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/sendsoap')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /sendsoap @username 50`);
    return true;
  }
  
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  
  let targetId = null;
  let targetName = targetUsername;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username?.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить самому себе!`);
    return true;
  }
  
  let targetUser = data.users[targetId];
  if (!targetUser) targetUser = { balance: 0, children: 0, basements: 0, username: targetName };
  
  if (user.balance < amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Есть: ${user.balance}, нужно: ${amount}`);
    return true;
  }
  
  user.balance -= amount;
  targetUser.balance = (targetUser.balance || 0) + amount;
  
  data.users[userId] = user;
  data.users[targetId] = targetUser;
  await saveData(data);
  
  await sendMessage(BOT_TOKEN, chatId,
    `💰 *ПЕРЕВОД МЫЛА* 💰\n\nОт: ${escapeMarkdown(username)}\nКому: @${escapeMarkdown(targetName)}\nСумма: ${amount} 🧼\n\n` +
    `📊 У ${escapeMarkdown(username)}: ${user.balance} 🧼\n📊 У @${escapeMarkdown(targetName)}: ${targetUser.balance} 🧼`);
  return true;
}

async function handleSendChild(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/sendchild')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /sendchild @username 2`);
    return true;
  }
  
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  
  let targetId = null;
  let targetName = targetUsername;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username?.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить самому себе!`);
    return true;
  }
  
  let targetUser = data.users[targetId];
  if (!targetUser) targetUser = { balance: 0, children: 0, basements: 0, username: targetName };
  
  const userChildren = user.children || 0;
  if (userChildren < amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает детей! Есть: ${userChildren}, нужно: ${amount}`);
    return true;
  }
  
  user.children = userChildren - amount;
  targetUser.children = (targetUser.children || 0) + amount;
  
  data.users[userId] = user;
  data.users[targetId] = targetUser;
  await saveData(data);
  
  await sendMessage(BOT_TOKEN, chatId,
    `👶 *ПЕРЕВОД ДЕТЕЙ* 👶\n\nОт: ${escapeMarkdown(username)}\nКому: @${escapeMarkdown(targetName)}\nКоличество: ${amount} 👶\n\n` +
    `📊 У ${escapeMarkdown(username)}: ${user.children} 👶\n📊 У @${escapeMarkdown(targetName)}: ${targetUser.children} 👶`);
  return true;
}

async function handleSendBasement(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/sendbasement')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /sendbasement @username 2`);
    return true;
  }
  
  let targetUsername = parts[1].replace('@', '');
  const amount = parseInt(parts[2]);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
    return true;
  }
  
  let targetId = null;
  let targetName = targetUsername;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username?.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить самому себе!`);
    return true;
  }
  
  let targetUser = data.users[targetId];
  if (!targetUser) targetUser = { balance: 0, children: 0, basements: 0, username: targetName };
  
  const userBasements = user.basements || 0;
  if (userBasements < amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает подвалов! Есть: ${userBasements}, нужно: ${amount}`);
    return true;
  }
  
  user.basements = userBasements - amount;
  targetUser.basements = (targetUser.basements || 0) + amount;
  
  data.users[userId] = user;
  data.users[targetId] = targetUser;
  await saveData(data);
  
  await sendMessage(BOT_TOKEN, chatId,
    `🏚️ *ПЕРЕВОД ПОДВАЛОВ* 🏚️\n\nОт: ${escapeMarkdown(username)}\nКому: @${escapeMarkdown(targetName)}\nКоличество: ${amount} 🏚️\n\n` +
    `📊 У ${escapeMarkdown(username)}: ${user.basements} 🏚️\n📊 У @${escapeMarkdown(targetName)}: ${targetUser.basements} 🏚️`);
  return true;
}

module.exports = { 
  handleChildrenCommand, 
  handleBasementCommand,
  handleSendSoap,
  handleSendChild,
  handleSendBasement
};
