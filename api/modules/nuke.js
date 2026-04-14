const { sendMessage, saveData, editMessage } = require('./helpers');
const config = require('./config');

async function handleNukeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  const nowTime = Date.now();
  
  if (cleanText === '/buynuke') {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      return true;
    }
    
    if (user.balance < config.NUKE_PRICE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${config.NUKE_PRICE} 🧼, есть ${user.balance} 🧼`);
      return true;
    }
    
    user.balance -= config.NUKE_PRICE;
    user.nukes = (user.nukes || 0) + 1;
    data.users[userId] = user;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `💣 *СЕКРЕТНОЕ ОРУЖИЕ ПРИОБРЕТЕНО* 💣\n\n` +
      `🧼 -${config.NUKE_PRICE} мыла\n` +
      `💣 Ядерных бомб: ${user.nukes}\n\n` +
      `Использовать: /launchnuke @username\n\n` +
      `🔒 Никому не говори!`);
    return true;
  }
  
  if (cleanText === '/mynukes') {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      return true;
    }
    
    await sendMessage(BOT_TOKEN, chatId,
      `💣 *ТВОЕ СЕКРЕТНОЕ ОРУЖИЕ* 💣\n\n` +
      `💣 Ядерных бомб: ${user.nukes || 0}\n\n` +
      `/buynuke — купить бомбу (${config.NUKE_PRICE} 🧼)\n` +
      `/launchnuke @user — запустить бомбу\n\n` +
      `🔒 Это секрет! Никому не рассказывай.`);
    return true;
  }
  
  if (cleanText.startsWith('/launchnuke')) {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /launchnuke @username`);
      return true;
    }
    
    if ((user.nukes || 0) < 1) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ядерных бомб! Купи: /buynuke`);
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
    
    if (!targetId || targetId === userId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername} или это ты сам!`);
      return true;
    }
    
    let targetUser = data.users[targetId];
    if (!targetUser) {
      return true;
    }
    
    // Функция для задержки
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Отправляем начальное сообщение
    const startMsg = await sendMessageWithReturn(BOT_TOKEN, chatId,
      `💣 *ЗАПУСК ЯДЕРНОЙ БОМБЫ!* 💣\n\n` +
      `🎯 Цель: @${targetName}\n\n` +
      `⏳ Обратный отсчет: 10 секунд...\n\n` +
      `🔒 Отменить невозможно!`);
    
    if (!startMsg || !startMsg.message_id) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ошибка при запуске бомбы!`);
      return true;
    }
    
    const messageId = startMsg.message_id;
    
    // Обратный отсчет с 9 до 1
    for (let i = 9; i >= 1; i--) {
      await delay(1000);
      await editMessage(BOT_TOKEN, chatId, messageId,
        `💣 *ЗАПУСК ЯДЕРНОЙ БОМБЫ!* 💣\n\n` +
        `🎯 Цель: @${targetName}\n\n` +
        `⏳ Осталось: ${i} секунд...\n\n` +
        `🔒 Отменить невозможно!`);
    }
    
    // Последняя секунда
    await delay(1000);
    await editMessage(BOT_TOKEN, chatId, messageId,
      `💣 *ЗАПУСК ЯДЕРНОЙ БОМБЫ!* 💣\n\n` +
      `🎯 Цель: @${targetName}\n\n` +
      `⏳ Осталось: 1 секунда...\n\n` +
      `🔒 Отменить невозможно!`);
    
    // Ракета
    await delay(1000);
    await editMessage(BOT_TOKEN, chatId, messageId,
      `🚀 *ПУСК!* 🚀\n\n` +
      `Ракета с ядерной бомбой запущена!\n` +
      `🎯 Цель: @${targetName}\n\n` +
      `Ожидайте последствия...`);
    
    // Задержка перед взрывом
    await delay(2000);
    
    // Тратим бомбу
    user.nukes -= 1;
    
    // Сохраняем статистику уничтоженного
    const destroyedBalance = targetUser.balance || 0;
    const destroyedBasements = targetUser.basements || 0;
    const destroyedChildren = targetUser.children || 0;
    const destroyedMobilized = targetUser.mobilized || 0;
    const destroyedCaptured = targetUser.capturedBasements || 0;
    
    // ПОЛНОСТЬЮ УНИЧТОЖАЕМ ВСЁ У ЦЕЛИ
    targetUser.balance = 0;
    targetUser.basements = 0;
    targetUser.children = 0;
    targetUser.mobilized = 0;
    targetUser.capturedBasements = 0;
    targetUser.capturedBasementsDetails = [];
    
    data.users[userId] = user;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await editMessage(BOT_TOKEN, chatId, messageId,
      `💥 *ЯДЕРНЫЙ ВЗРЫВ!* 💥\n\n` +
      `🎯 Цель: @${targetName}\n` +
      `💣 Полное уничтожение:\n` +
      `💰 Мыло: ${destroyedBalance} 🧼 → 0\n` +
      `🏚️ Подвалы: ${destroyedBasements} → 0\n` +
      `👶 Обычные дети: ${destroyedChildren} → 0\n` +
      `⚔️ Мобилизованные: ${destroyedMobilized} → 0\n` +
      `🏚️ Захваченные подвалы: ${destroyedCaptured} → 0\n\n` +
      `💣 Осталось бомб: ${user.nukes}\n\n` +
      `💀 *${targetName} был уничтожен!* 💀\n\n` +
      `🔒 Эта информация останется между нами...`);
    
    return true;
  }
  
  return false;
}

// Вспомогательная функция для отправки сообщения и получения ответа
async function sendMessageWithReturn(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  const data = await response.json();
  return data.result;
}

module.exports = { handleNukeCommand };
