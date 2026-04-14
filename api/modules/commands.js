const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

// Функция экранирования Markdown-спецсимволов
function escapeMarkdown(text) {
  if (!text) return 'Unknown';
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function handleBalanceCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/balance') return false;
  
  const hourlyIncome = (user.children || 0) * config.CHILD_INCOME;
  const capturedIncome = (user.capturedBasements || 0) * config.BASEMENT_CAPTURE_REWARD;
  const userBasements = user.basements || 0;
  const maxChildrenPossible = userBasements * config.CHILDREN_PER_BASEMENT;
  
  let nukeInfo = '';
  if (Date.now() >= config.NUKE_ACTIVATE_DATE && (user.nukes || 0) > 0) {
    nukeInfo = `\n\n💣 Ядерных бомб: ${user.nukes}\n/mynukes — подробнее`;
  }
  
  await sendMessage(BOT_TOKEN, chatId,
    `📊 *${escapeMarkdown(username)}*\n\n` +
    `🧼 Мыла: ${user.balance}\n` +
    `🏚️ Своих подвалов: ${userBasements}\n` +
    `🏚️ Захваченных подвалов: ${user.capturedBasements || 0}\n` +
    `👶 Обычных детей: ${user.children || 0}\n` +
    `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
    `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
    `📈 Доход от обычных детей: ${hourlyIncome} 🧼/час\n` +
    `📈 Доход от захваченных подвалов: ${capturedIncome} 🧼/час${nukeInfo}\n\n` +
    `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
    `/buychild [количество] — купить детей (${config.CHILD_COST} 🧼/шт)\n` +
    `/mobilize [количество] — мобилизовать детей (${config.MOBILIZATION_COST} 🧼/шт)`);
  return true;
}

async function handleTopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/top') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 10);
  
  if (sorted.length === 0 || sorted[0].balance === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏆 Топ пуст! Нафарми мыло первым 🧼');
  } else {
    let reply = '🏆 *ТОП МЫЛА НА ОСТРОВЕ* 🏆\n\n';
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i];
      const childIncome = (u.children || 0) * config.CHILD_INCOME;
      const balance = u.balance || 0;
      const children = u.children || 0;
      const mobilized = u.mobilized || 0;
      const basements = u.basements || 0;
      const name = escapeMarkdown(u.username || 'Unknown');
      
      reply += `${i+1}. ${name} — ${balance} 🧼 (👶 ${children}, ⚔️ ${mobilized}, 🏚️ ${basements}, +${childIncome}/ч)\n`;
    }
    await sendMessage(BOT_TOKEN, chatId, reply);
  }
  return true;
}

async function handleTopChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topchildren') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
  
  if (sorted.length === 0 || sorted[0].children === 0) {
    await sendMessage(BOT_TOKEN, chatId, '👶 Топ обычных детей пуст! Купи ребенка через /buychild');
  } else {
    let reply = '👶 *ТОП ОБЫЧНЫХ ДЕТЕЙ* 👶\n\n';
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i];
      if (u.children > 0) {
        const name = escapeMarkdown(u.username || 'Unknown');
        reply += `${i+1}. ${name} — ${u.children} 👶 (⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0})\n`;
      }
    }
    await sendMessage(BOT_TOKEN, chatId, reply);
  }
  return true;
}

async function handleTopBasementsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topbasements') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.basements || 0) - (a.basements || 0)).slice(0, 10);
  
  if (sorted.length === 0 || sorted[0].basements === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏚️ Топ подвалов пуст! Купи подвал через /buybasement');
  } else {
    let reply = '🏚️ *ТОП ПОДВАЛОВ* 🏚️\n\n';
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i];
      if (u.basements > 0) {
        const name = escapeMarkdown(u.username || 'Unknown');
        reply += `${i+1}. ${name} — ${u.basements} 🏚️ (👶 ${u.children || 0}, ⚔️ ${u.mobilized || 0})\n`;
      }
    }
    await sendMessage(BOT_TOKEN, chatId, reply);
  }
  return true;
}

async function handleTopMobilizedCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topmobilized') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.mobilized || 0) - (a.mobilized || 0)).slice(0, 10);
  
  if (sorted.length === 0 || sorted[0].mobilized === 0) {
    await sendMessage(BOT_TOKEN, chatId, '⚔️ Топ мобилизованных пуст! Мобилизуй детей через /mobilize');
  } else {
    let reply = '⚔️ *ТОП МОБИЛИЗОВАННЫХ* ⚔️\n\n';
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i];
      if (u.mobilized > 0) {
        const name = escapeMarkdown(u.username || 'Unknown');
        reply += `${i+1}. ${name} — ⚔️ ${u.mobilized} (👶 ${u.children || 0}, 🏚️ ${u.basements || 0})\n`;
      }
    }
    await sendMessage(BOT_TOKEN, chatId, reply);
  }
  return true;
}

// ========== КОМАНДЫ ПЕРЕВОДА ==========

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
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
    return true;
  }
  
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить мыло самому себе!`);
    return true;
  }
  
  let targetUser = data.users[targetId];
  if (!targetUser) {
    targetUser = { balance: 0, children: 0, basements: 0, username: targetName };
  }
  
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
    `💰 *ПЕРЕВОД МЫЛА* 💰\n\n` +
    `От: ${escapeMarkdown(username)}\n` +
    `Кому: @${escapeMarkdown(targetName)}\n` +
    `Сумма: ${amount} 🧼\n\n` +
    `📊 У ${escapeMarkdown(username)} осталось: ${user.balance} 🧼\n` +
    `📊 У @${escapeMarkdown(targetName)} теперь: ${targetUser.balance} 🧼`);
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
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
    return true;
  }
  
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить детей самому себе!`);
    return true;
  }
  
  let targetUser = data.users[targetId];
  if (!targetUser) {
    targetUser = { balance: 0, children: 0, basements: 0, username: targetName };
  }
  
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
    `👶 *ПЕРЕВОД ДЕТЕЙ* 👶\n\n` +
    `От: ${escapeMarkdown(username)}\n` +
    `Кому: @${escapeMarkdown(targetName)}\n` +
    `Количество: ${amount} 👶\n\n` +
    `📊 У ${escapeMarkdown(username)} осталось: ${user.children} 👶\n` +
    `📊 У @${escapeMarkdown(targetName)} теперь: ${targetUser.children} 👶`);
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
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
    return true;
  }
  
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить подвалы самому себе!`);
    return true;
  }
  
  let targetUser = data.users[targetId];
  if (!targetUser) {
    targetUser = { balance: 0, children: 0, basements: 0, username: targetName };
  }
  
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
    `🏚️ *ПЕРЕВОД ПОДВАЛОВ* 🏚️\n\n` +
    `От: ${escapeMarkdown(username)}\n` +
    `Кому: @${escapeMarkdown(targetName)}\n` +
    `Количество: ${amount} 🏚️\n\n` +
    `📊 У ${escapeMarkdown(username)} осталось: ${user.basements} 🏚️\n` +
    `📊 У @${escapeMarkdown(targetName)} теперь: ${targetUser.basements} 🏚️`);
  return true;
}

// ========== ШУТОЧНАЯ КОМАНДА ==========
async function handleRapeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/rape')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 2) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /rape @username`);
    return true;
  }
  
  let targetUsername = parts[1].replace('@', '');
  let targetId = null;
  let targetName = targetUsername;
  
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      targetId = parseInt(id);
      targetName = u.username;
      break;
    }
  }
  
  if (!targetId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
    return true;
  }
  
  if (targetId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `${username} не насилуй себя ☝️`);
    return true;
  }
  
  const roasts = [
    `${username} изнасиловал @${targetName}!`,
  ];
  
  const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
  await sendMessage(BOT_TOKEN, chatId, randomRoast);
  return true;
}

async function handleStartCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin) {
  if (cleanText !== '/start') return false;
  
  let adminCommands = '';
  if (isAdmin) {
    adminCommands = `\n\n👑 *АДМИН-КОМАНДЫ:*\n` +
      `/addsoap @user 50\n` +
      `/removesoap @user 50\n` +
      `/addchild @user 2\n` +
      `/removechild @user 2\n` +
      `/addbasement @user 2\n` +
      `/removebasement @user 2\n` +
      `/addmobilized @user 2\n` +
      `/removemobilized @user 2\n` +
      `/createpromo КОД 100 10\n` +
      `/deletepromo КОД\n` +
      `/promolist\n` +
      `/removenuke @user\n` +
      `/activity — моя статистика активности\n` +
      `/topactivity [hour/day/week/total] — топ активности\n`;
  }
  
  let nukeCommands = '';
  if (Date.now() >= config.NUKE_ACTIVATE_DATE) {
    nukeCommands = `\n\n💣 *СЕКРЕТНОЕ ОРУЖИЕ:*\n` +
      `/buynuke — купить бомбу (${config.NUKE_PRICE} 🧼)\n` +
      `/launchnuke @user — запустить бомбу\n` +
      `/mynukes — мои бомбы\n`;
  }
  
  await sendMessage(BOT_TOKEN, chatId,
    `🧼 *ОСТРОВ ЭПШТЕЙНА* 🏝️\n\nПривет, ${escapeMarkdown(username)}!\n\n` +
    `🎯 *КОМАНДЫ:*\n` +
    `/farm — фарм мыла (1-30, раз в час)\n` +
    `/balance — баланс\n` +
    `/top — топ по мылу\n` +
    `/topchildren — топ по обычным детям\n` +
    `/topbasements — топ по подвалам\n` +
    `/topmobilized — топ по мобилизованным\n` +
    `/children — мои обычные дети\n` +
    `/basements — мои подвалы\n` +
    `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
    `/buychild [количество] — купить обычных детей (${config.CHILD_COST} 🧼/шт)\n` +
    `/sendsoap @user 50 — перевести мыло\n` +
    `/sendchild @user 2 — перевести обычных детей\n` +
    `/sendbasement @user 2 — перевести подвалы\n` +
    `/duel @user [ставка] — дуэль\n` +
    `/casino [ставка] [число] — казино (x2 при победе)\n` +
    `/rape @user — изнасиловать человека\n` +
    `/promo — ввести промокод\n\n` +
    `⚔️ *ИВЕНТ СВО (до 18.04.2026):*\n` +
    `/svo — информация об ивенте\n` +
    `/mobilize [количество] — мобилизовать детей (${config.MOBILIZATION_COST} 🧼/шт)\n` +
    `/attack @user [количество] — атаковать\n` +
    `/free @user [количество] — освободить свои захваченные подвалы\n` +
    `/myarmy — моя армия\n` +
    `/mycaptured — мои захваченные подвалы` +
    nukeCommands +
    adminCommands +
    `\n\n📈 Обычные дети приносят ${config.CHILD_INCOME} 🧼 в час!\n` +
    `⚠️ Пидиди крадет мыло (5%)\n` +
    `👶 1 обычный ребенок = ${config.CHILD_COST} мыла\n` +
    `🏚️ 1 подвал = ${config.BASEMENT_COST} мыла\n` +
    `🔑 1 подвал = ${config.CHILDREN_PER_BASEMENT} обычных детей\n` +
    `🔑 Без подвалов нельзя купить обычных детей!\n` +
    `⚔️ Мобилизованные дети участвуют в СВО (атакуют и защищают)`);
  return true;
}

module.exports = {
  handleBalanceCommand,
  handleTopCommand,
  handleTopChildrenCommand,
  handleTopBasementsCommand,
  handleTopMobilizedCommand,
  handleSendSoap,
  handleSendChild,
  handleSendBasement,
  handleRapeCommand,
  handleStartCommand
};
