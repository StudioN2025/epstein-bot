const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

async function handleChildCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
  if (cleanText.startsWith('/buychild')) {
    let amount = 1;
    const parts = rawText.split(' ');
    if (parts.length >= 2) {
      const parsedAmount = parseInt(parts[1]);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
      } else {
        await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /buychild 3`);
        return true;
      }
    }
    
    const userBasements = user.basements || 0;
    const userChildren = user.children || 0;
    const maxChildrenPossible = userBasements * config.CHILDREN_PER_BASEMENT;
    const availableSlots = maxChildrenPossible - userChildren;
    
    if (availableSlots < amount) {
      await sendMessage(BOT_TOKEN, chatId,
        `❌ ${username}, у тебя не хватает подвалов для ${amount} детей!\n\n` +
        `🏚️ Твои подвалы: ${userBasements}\n` +
        `👶 Твои дети: ${userChildren}\n` +
        `📌 1 подвал = ${config.CHILDREN_PER_BASEMENT} детей\n` +
        `📌 Максимум детей: ${maxChildrenPossible}\n` +
        `📌 Свободных мест: ${availableSlots}\n` +
        `⚠️ Нужно еще подвалов: ${Math.ceil((userChildren + amount) / config.CHILDREN_PER_BASEMENT) - userBasements}\n\n` +
        `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)`);
      return true;
    }
    
    const totalCost = config.CHILD_COST * amount;
    
    if (user.balance >= totalCost) {
      user.balance -= totalCost;
      user.children += amount;
      data.users[userId] = user;
      await saveData(data);
      
      const remainingSlots = (user.basements || 0) * config.CHILDREN_PER_BASEMENT - user.children;
      
      await sendMessage(BOT_TOKEN, chatId,
        `👶 ${username} купил ${amount} ребенка(ей)!\n` +
        `🧼 -${totalCost} мыла\n` +
        `🧼 Баланс: ${user.balance} мыла\n` +
        `👶 Обычных детей: ${user.children}\n` +
        `🏚️ Подвалов: ${user.basements || 0}\n` +
        `📌 Осталось мест для детей: ${remainingSlots}\n` +
        `📈 Каждый ребенок приносит ${config.CHILD_INCOME} мыло в час!`);
    } else {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! ${amount} ребенок(ей) стоят ${totalCost} 🧼\nУ тебя: ${user.balance} 🧼`);
    }
    return true;
  }
  
  if (cleanText === '/children') {
    const hourlyIncome = (user.children || 0) * config.CHILD_INCOME;
    const userBasements = user.basements || 0;
    const userChildren = user.children || 0;
    const maxChildrenPossible = userBasements * config.CHILDREN_PER_BASEMENT;
    const canBuyNew = userChildren < maxChildrenPossible;
    const remainingSlots = maxChildrenPossible - userChildren;
    
    await sendMessage(BOT_TOKEN, chatId,
      `👶 *ОБЫЧНЫЕ ДЕТИ ${username}* 👶\n\n` +
      `🧼 Мыла: ${user.balance}\n` +
      `🏚️ Подвалов: ${userBasements}\n` +
      `👶 Обычных детей: ${userChildren}\n` +
      `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
      `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
      `📌 Свободных мест: ${remainingSlots}\n` +
      `📈 Пассивный доход: ${hourlyIncome} 🧼/час\n\n` +
      `${canBuyNew ? '✅ Ты можешь купить ребенка! /buychild [количество]' : '❌ Нужно больше подвалов! /buybasement [количество]'}\n\n` +
      `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
      `/basements — информация о подвалах\n` +
      `/mobilize [количество] — мобилизовать детей в армию`);
    return true;
  }
  
  return false;
}

module.exports = { handleChildCommand };
