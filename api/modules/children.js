import { sendMessage, saveData } from './helpers.js';
import config from './config.js';

export async function handleChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
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
      `👶 *ДЕТИ ${username}* 👶\n\n🧼 Мыла: ${user.balance}\n` +
      `🏚️ Подвалов: ${userBasements}\n👶 Детей: ${userChildren}\n⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
      `📌 Максимум детей: ${maxChildren}\n📌 Свободно мест: ${maxChildren - userChildren}\n` +
      `📈 Доход: ${hourlyIncome} 🧼/час\n\n` +
      `${canBuy ? '✅ /buychild [количество]' : '❌ Нужны подвалы! /buybasement'}`);
    return true;
  }
  
  return false;
}

export async function handleBasementCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
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
      `🏚️ *ПОДВАЛЫ ${username}* 🏚️\n\n🧼 Цена: ${config.BASEMENT_COST} мыла\n` +
      `🏚️ Твои подвалы: ${userBasements}\n👶 Твои дети: ${userChildren}\n` +
      `📌 Максимум детей: ${maxChildren}\n📌 Свободно мест: ${maxChildren - userChildren}\n\n` +
      `${canBuy ? '✅ /buychild [количество]' : '❌ Нужны подвалы! /buybasement [количество]'}`);
    return true;
  }
  
  return false;
}
