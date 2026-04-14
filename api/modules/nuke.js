const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

async function handleNukeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin) {
  const nowTime = Date.now();
  
  if (cleanText === '/buynuke') {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ядерное оружие станет доступно после 16 апреля 2026!`);
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
      await sendMessage(BOT_TOKEN, chatId, `❌ Ядерное оружие станет доступно после 16 апреля 2026!`);
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
  
  // АДМИН-КОМАНДА: удалить ядерные бомбы у пользователя
  if (cleanText.startsWith('/removenuke')) {
    if (!isAdmin) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Эта команда только для админов!`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /removenuke @username`);
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
    
    let targetUser = data.users[targetId];
    if (!targetUser) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Игрок @${targetUsername} не найден в базе!`);
      return true;
    }
    
    const removedNukes = targetUser.nukes || 0;
    targetUser.nukes = 0;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `💣 *БОМБЫ УДАЛЕНЫ* 💣\n\n` +
      `👑 Админ ${username} удалил все ядерные бомбы у @${targetName}\n` +
      `💣 Удалено бомб: ${removedNukes}\n\n` +
      `🔒 Теперь у @${targetName} нет ядерного оружия.`);
    return true;
  }
  
  if (cleanText.startsWith('/launchnuke')) {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ядерное оружие станет доступно после 16 апреля 2026!`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /launchnuke @username\n\nНельзя атаковать бота! Только реальных игроков.`);
      return true;
    }
    
    if ((user.nukes || 0) < 1) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ядерных бомб! Купи: /buynuke`);
      return true;
    }
    
    let targetUsername = parts[1].replace('@', '');
    
    // Защита от атаки на бота
    if (targetUsername.toLowerCase() === 'epstain_bot' || targetUsername.toLowerCase() === 'epstein_bot') {
      await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя атаковать бота! Только реальных игроков.`);
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
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}\n\nУбедись, что игрок зарегистрирован в боте (напиши /start).`);
      return true;
    }
    
    if (targetId === userId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя запустить ядерную бомбу на самого себя!`);
      return true;
    }
    
    let targetUser = data.users[targetId];
    if (!targetUser) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Игрок @${targetUsername} не найден в базе!`);
      return true;
    }
    
    // Запуск бомбы
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
