const { sendMessage } = require('./helpers');
const config = require('./config');

async function handleBasementCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
  if (cleanText === '/basements') {
    const userBasements = user.basements || 0;
    const userChildren = user.children || 0;
    const maxChildrenPossible = userBasements * config.CHILDREN_PER_BASEMENT;
    const canBuyNewChild = userChildren < maxChildrenPossible;
    const remainingSlots = maxChildrenPossible - userChildren;
    
    let statusEmoji = canBuyNewChild ? '✅' : '❌';
    let statusText = canBuyNewChild ? `Можно купить еще ${remainingSlots} детей` : 'Нет свободных мест!';
    
    await sendMessage(BOT_TOKEN, chatId,
      `🏚️ *ПОДВАЛЫ СТИВЕНА ХОКИНГА* 🏚️\n\n` +
      `🧼 Цена одного подвала: ${config.BASEMENT_COST} мыла\n` +
      `📊 Твои подвалы: ${userBasements}\n` +
      `👶 Твои обычные дети: ${userChildren}\n` +
      `🏚️ 1 подвал = ${config.CHILDREN_PER_BASEMENT} детей\n` +
      `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
      `📌 Свободных мест: ${remainingSlots}\n` +
      `📌 Статус: ${statusEmoji} ${statusText}\n\n` +
      `${canBuyNewChild ? '✅ Ты можешь купить ребенка! /buychild' : '❌ Тебе нужно больше подвалов! /buybasement'}\n\n` +
      `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)`);
    return true;
  }
  
  if (cleanText.startsWith('/buybasement')) {
    let amount = 1;
    const parts = rawText.split(' ');
    if (parts.length >= 2) {
      const parsedAmount = parseInt(parts[1]);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
      } else {
        await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /buybasement 5`);
        return true;
      }
    }
    
    const totalCost = config.BASEMENT_COST * amount;
    
    if (user.balance >= totalCost) {
      user.balance -= totalCost;
      user.basements = (user.basements || 0) + amount;
      data.users[userId] = user;
      await saveData(data);
      
      const maxChildrenPossible = (user.basements || 0) * config.CHILDREN_PER_BASEMENT;
      const remainingSlots = maxChildrenPossible - (user.children || 0);
      
      let message = `🏚️ ${username} купил ${amount} подвал(ов) у Стивена Хокинга!\n\n` +
        `🧼 -${totalCost} мыла\n` +
        `🏚️ Всего подвалов: ${user.basements}\n` +
        `👶 Обычных детей: ${user.children || 0}\n` +
        `📌 Теперь можно иметь до ${maxChildrenPossible} обычных детей\n` +
        `📌 Свободных мест: ${remainingSlots}\n\n`;
      
      if (remainingSlots > 0) {
        message += `✅ Ты можешь купить ребенка! /buychild [количество]`;
      } else {
        message += `⚠️ Нужно больше подвалов для новых детей`;
      }
      
      await sendMessage(BOT_TOKEN, chatId, message);
    } else {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! ${amount} подвал(ов) стоят ${totalCost} 🧼\nУ тебя: ${user.balance} 🧼`);
    }
    return true;
  }
  
  return false;
}

module.exports = { handleBasementCommand };
