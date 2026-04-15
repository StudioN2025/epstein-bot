import { sendMessage, saveData, escapeMarkdown } from './helpers.js';

export async function handleSendSoap(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
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

export async function handleSendChild(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
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

export async function handleSendBasement(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
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
