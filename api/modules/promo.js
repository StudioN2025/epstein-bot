import { sendMessage, saveData } from './helpers.js';
import config from './config.js';

// Глобальная переменная для промокодов
export let PROMOCODES = {};

// Загрузка промокодов из базы
export async function loadPromoCodes(data) {
  if (data.promocodes) {
    PROMOCODES = data.promocodes;
  } else {
    PROMOCODES = JSON.parse(JSON.stringify(config.INITIAL_PROMOCODES));
  }
  return PROMOCODES;
}

// Сохранение промокодов в базу
export async function savePromoCodes(data) {
  data.promocodes = PROMOCODES;
  await saveData(data);
}

// Обычная команда /promo
export async function handlePromoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  await loadPromoCodes(data);
  
  if (cleanText === '/promo') {
    await sendMessage(BOT_TOKEN, chatId, `🎫 ВВЕДИ ПРОМОКОД\n\nОтправь: /promo КОД\n\nПример: /promo SUPEREPSTAIN67`);
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
    
    if (promo.usedBy?.includes(userId)) {
      await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже активировал этот промокод!`);
      return true;
    }
    
    if (promo.usedCount >= promo.maxUses) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" больше не активен!`);
      return true;
    }
    
    promo.usedCount++;
    if (!promo.usedBy) promo.usedBy = [];
    promo.usedBy.push(userId);
    
    user.balance += promo.reward;
    data.users[userId] = user;
    await savePromoCodes(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `🎉 *ПРОМОКОД АКТИВИРОВАН!* 🎉\n\nКод: ${parts[1].toUpperCase()}\n+${promo.reward} 🧼\n📊 Баланс: ${user.balance} 🧼`);
    return true;
  }
  
  return false;
}

// Админ-команда создания промокода
export async function handleCreatePromo(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
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
    await sendMessage(BOT_TOKEN, chatId, `❌ Награда и количество должны быть положительными!`);
    return true;
  }
  
  await loadPromoCodes(data);
  PROMOCODES[code] = { reward, maxUses, usedCount: 0, usedBy: [] };
  await savePromoCodes(data);
  
  await sendMessage(BOT_TOKEN, chatId, `✅ Промокод ${code.toUpperCase()} создан! Награда: ${reward} 🧼, максимум: ${maxUses} активаций`);
  return true;
}

// Админ-команда списка промокодов
export async function handlePromoList(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
  if (!isAdmin) return false;
  if (cleanText !== '/promolist') return false;
  
  await loadPromoCodes(data);
  
  let reply = `📋 *СПИСОК ПРОМОКОДОВ* 📋\n\n`;
  if (Object.keys(PROMOCODES).length === 0) {
    reply += `Нет активных промокодов.`;
  } else {
    for (const [code, d] of Object.entries(PROMOCODES)) {
      reply += `🔸 ${code.toUpperCase()}\n   Награда: ${d.reward} 🧼\n   Активаций: ${d.usedCount}/${d.maxUses}\n   Активировали: ${d.usedBy?.length || 0} чел.\n\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

// Админ-команда удаления промокода
export async function handleDeletePromo(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin) {
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
