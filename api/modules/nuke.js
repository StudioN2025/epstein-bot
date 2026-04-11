const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

async function handleNukeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
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
    
    user.nukes -= 1;
    
    const destroyedBalance = targetUser.balance || 0;
    const destroyedBasements = targetUser.basements || 0;
    const destroyedChildren = targetUser.children || 0;
    const destroyedMobilized = targetUser.mobilized || 0;
    const destroyedCaptured = targetUser.capturedBasements || 0;
    
    targetUser.balance = 0;
    targetUser.basements = 0;
    targetUser.children = 0;
    targetUser.mobilized = 0;
    targetUser.capturedBasements = 0;
    targetUser.capturedBasementsDetails = [];
    
    data.users[userId] = user;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `💥 *ЯДЕРНАЯ АТАКА!* 💥\n\n` +
      `🎯 Цель: @${targetName}\n` +
      `💣 Полное уничтожение:\n` +
      `💰 Мыло: ${destroyedBalance} 🧼 → 0\n` +
      `🏚️ Подвалы: ${destroyedBasements} → 0\n` +
      `👶 Обычные дети: ${destroyedChildren} → 0\n` +
      `⚔️ Мобилизованные: ${destroyedMobilized} → 0\n` +
      `🏚️ Захваченные подвалы: ${destroyedCaptured} → 0\n\n` +
      `💣 Осталось бомб: ${user.nukes}\n\n` +
      `🔒 Эта информация останется между нами...`);
    return true;
  }
  
  return false;
}

module.exports = { handleNukeCommand };
