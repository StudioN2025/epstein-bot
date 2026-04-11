const { sendMessage } = require('./helpers');
const config = require('./config');

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
    `📊 *${username}*\n\n` +
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
  const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
  
  if (sorted.length === 0 || sorted[0].balance === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏆 Топ пуст! Нафарми мыло первым 🧼');
  } else {
    let reply = '🏆 *ТОП МЫЛА НА ОСТРОВЕ* 🏆\n\n';
    sorted.forEach((u, i) => {
      const childIncome = (u.children || 0) * config.CHILD_INCOME;
      reply += `${i+1}. ${u.username} — ${u.balance} 🧼 (👶 ${u.children || 0}, ⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0}, +${childIncome}/ч)\n`;
    });
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
    sorted.forEach((u, i) => {
      if (u.children > 0) {
        reply += `${i+1}. ${u.username} — ${u.children} 👶 (⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0})\n`;
      }
    });
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
    sorted.forEach((u, i) => {
      if (u.basements > 0) {
        reply += `${i+1}. ${u.username} — ${u.basements} 🏚️ (👶 ${u.children || 0}, ⚔️ ${u.mobilized || 0})\n`;
      }
    });
    await sendMessage(BOT_TOKEN, chatId, reply);
  }
  return true;
}

async function handleTopMobilizedCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
  if (cleanText !== '/topmobilized') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.mobilized || 0) - (a.mobilized || 0)).slice(0, 10);
  
  if (sorted.length === 0 || sorted[0].mobilized === 0) {
    await sendMessage(BOT_TOKEN, chatId, '⚔️ Топ мобилизованных пуст! Мобилизуй детей через /mobilize');
  } else {
    let reply = '⚔️ *ТОП МОБИЛИЗОВАННЫХ* ⚔️\n\n';
    sorted.forEach((u, i) => {
      if (u.mobilized > 0) {
        reply += `${i+1}. ${u.username} — ⚔️ ${u.mobilized} (👶 ${u.children || 0}, 🏚️ ${u.basements || 0})\n`;
      }
    });
    await sendMessage(BOT_TOKEN, chatId, reply);
  }
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
      `/promolist\n`;
  }
  
  let nukeCommands = '';
  if (Date.now() >= config.NUKE_ACTIVATE_DATE) {
    nukeCommands = `\n\n💣 *СЕКРЕТНОЕ ОРУЖИЕ:*\n` +
      `/buynuke — купить бомбу (${config.NUKE_PRICE} 🧼)\n` +
      `/launchnuke @user — запустить бомбу\n` +
      `/mynukes — мои бомбы\n`;
  }
  
  await sendMessage(BOT_TOKEN, chatId,
    `🧼 *ОСТРОВ ЭПШТЕЙНА* 🏝️\n\nПривет, ${username}!\n\n` +
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
    `/promo — ввести промокод\n\n` +
    `⚔️ *ИВЕНТ СВО (до 18.04.2026):*\n` +
    `/svo — информация об ивенте\n` +
    `/mobilize [количество] — мобилизовать детей (${config.MOBILIZATION_COST} 🧼/шт)\n` +
    `/attack @user [количество] — атаковать\n` +
    `/free @user [количество] — освободить свои подвалы (${config.FREE_COST} 🧼/шт)\n` +
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
  handleStartCommand
};
