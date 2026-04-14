const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

// Глобальная переменная для промокодов (будет загружаться из базы)
let PROMOCODES = {};

// Функция для загрузки промокодов из базы
async function loadPromoCodes(data) {
  if (data.promocodes) {
    PROMOCODES = data.promocodes;
  } else {
    // Если в базе нет промокодов, создаем начальный
    PROMOCODES = JSON.parse(JSON.stringify(config.INITIAL_PROMOCODES));
  }
  return PROMOCODES;
}

// Функция для сохранения промокодов в базу
async function savePromoCodes(data) {
  data.promocodes = PROMOCODES;
  await saveData(data);
}

async function handlePromoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  // Загружаем актуальные промокоды из базы перед каждым использованием
  await loadPromoCodes(data);
  
  if (cleanText === '/promo') {
    await sendMessage(BOT_TOKEN, chatId, `🎫 ВВЕДИ ПРОМОКОД\n\nОтправь: /promo КОД\n\nПример: /promo SUPEREPSTAIN67\n\nℹ️ Следи за новостями в канале!`);
    return true;
  }
  
  if (cleanText.startsWith('/promo ')) {
    const parts = rawText.split(' ');
    const promoCode = parts[1].toLowerCase();
    const promo = PROMOCODES[promoCode];
    
    if (!promo) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" не найден!`);
      return true;
    }
    
    // Проверяем, активировал ли пользователь этот промокод
    if (promo.usedBy && promo.usedBy.includes(userId)) {
      await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже активировал этот промокод!`);
      return true;
    }
    
    // Проверяем остаток активаций
    if (promo.usedCount >= promo.maxUses) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" больше не активен! Все ${promo.maxUses} активаций использованы.`);
      return true;
    }
    
    // Активируем промокод
    promo.usedCount++;
    if (!promo.usedBy) promo.usedBy = [];
    promo.usedBy.push(userId);
    
    // Начисляем награду
    user.balance += promo.reward;
    data.users[userId] = user;
    
    // Сохраняем промокоды в базу
    await savePromoCodes(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `🎉 *ПРОМОКОД АКТИВИРОВАН!* 🎉\n\n` +
      `Код: ${parts[1].toUpperCase()}\n` +
      `Награда: +${promo.reward} 🧼\n\n` +
      `📊 Твой баланс: ${user.balance} 🧼\n` +
      `👶 Детей: ${user.children || 0}`);
    return true;
  }
  
  return false;
}

// Функция для админ-команды создания промокода (только для админов)
async function handleCreatePromo(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
  if (!isAdmin) return false;
  if (!cleanText.startsWith('/createpromo')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 4) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /createpromo КОД 100 10`);
    return true;
  }
  
  const code = parts[1].toLowerCase();
  const reward = parseInt(parts[2]);
  const maxUses = parseInt(parts[3]);
  
  if (isNaN(reward) || reward <= 0 || isNaN(maxUses) || maxUses <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Награда и количество должны быть положительными числами!`);
    return true;
  }
  
  // Загружаем актуальные промокоды
  await loadPromoCodes(data);
  
  PROMOCODES[code] = {
    reward: reward,
    maxUses: maxUses,
    usedCount: 0,
    usedBy: []
  };
  
  // Сохраняем в базу
  await savePromoCodes(data);
  
  await sendMessage(BOT_TOKEN, chatId,
    `✅ *ПРОМОКОД СОЗДАН!* ✅\n\n` +
    `Код: ${code.toUpperCase()}\n` +
    `Награда: ${reward} 🧼\n` +
    `Макс активаций: ${maxUses}\n\n` +
    `Использовать: /promo ${code.toUpperCase()}`);
  return true;
}

// Функция для админ-команды списка промокодов
async function handlePromoList(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
  if (!isAdmin) return false;
  if (cleanText !== '/promolist') return false;
  
  await loadPromoCodes(data);
  
  let reply = `📋 *СПИСОК ПРОМОКОДОВ* 📋\n\n`;
  if (Object.keys(PROMOCODES).length === 0) {
    reply += `Нет активных промокодов.\nСоздай: /createpromo КОД 100 10`;
  } else {
    for (const [code, d] of Object.entries(PROMOCODES)) {
      reply += `🔸 ${code.toUpperCase()}\n   Награда: ${d.reward} 🧼\n   Активаций: ${d.usedCount}/${d.maxUses}\n   Активировали: ${d.usedBy?.length || 0} чел.\n\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

// Функция для админ-команды удаления промокода
async function handleDeletePromo(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
  if (!isAdmin) return false;
  if (!cleanText.startsWith('/deletepromo')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 2) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /deletepromo КОД`);
    return true;
  }
  
  const code = parts[1].toLowerCase();
  
  await loadPromoCodes(data);
  
  if (!PROMOCODES[code]) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Промокод ${code.toUpperCase()} не найден!`);
    return true;
  }
  
  delete PROMOCODES[code];
  await savePromoCodes(data);
  
  await sendMessage(BOT_TOKEN, chatId, `✅ Промокод ${code.toUpperCase()} удален!`);
  return true;
}

module.exports = { 
  handlePromoCommand, 
  handleCreatePromo, 
  handlePromoList, 
  handleDeletePromo,
  loadPromoCodes,
  savePromoCodes
};
