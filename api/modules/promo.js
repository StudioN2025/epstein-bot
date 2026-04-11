const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

let PROMOCODES = { ...config.INITIAL_PROMOCODES };

async function handlePromoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
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
    if (promo.usedBy.includes(userId)) {
      await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже активировал этот промокод!`);
      return true;
    }
    if (promo.usedCount >= promo.maxUses) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" больше не активен!`);
      return true;
    }
    promo.usedCount++;
    promo.usedBy.push(userId);
    user.balance += promo.reward;
    data.users[userId] = user;
    data.promocodes = PROMOCODES;
    await saveData(data);
    await sendMessage(BOT_TOKEN, chatId, `🎉 ПРОМОКОД АКТИВИРОВАН!\nКод: ${parts[1].toUpperCase()}\n+${promo.reward} 🧼\n📊 Баланс: ${user.balance} 🧼`);
    return true;
  }
  
  return false;
}

module.exports = { handlePromoCommand, PROMOCODES };
