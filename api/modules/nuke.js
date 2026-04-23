import { sendMessage, saveData } from './helpers.js';
import config from './config.js';

export async function handleNukeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin) {
  const nowTime = Date.now();
  
  // Покупка бомбы
  if (cleanText === '/buynuke') {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ядерное оружие станет доступно после ${new Date(config.NUKE_ACTIVATE_DATE).toLocaleDateString()}!`);
      return true;
    }
    
    if (user.balance < config.NUKE_PRICE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${config.NUKE_PRICE} 🧼`);
      return true;
    }
    
    user.balance -= config.NUKE_PRICE;
    user.nukes = (user.nukes || 0) + 1;
    data.users[userId] = user;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `💣 *СЕКРЕТНОЕ ОРУЖИЕ ПРИОБРЕТЕНО* 💣\n\n🧼 -${config.NUKE_PRICE} мыла\n💣 Ядерных бомб: ${user.nukes}\n\n/launchnuke @user — запустить`);
    return true;
  }
  
  // Информация о бомбах
  if (cleanText === '/mynukes') {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ядерное оружие еще не активировано!`);
      return true;
    }
    
    await sendMessage(BOT_TOKEN, chatId,
      `💣 *ТВОЕ СЕКРЕТНОЕ ОРУЖИЕ* 💣\n\n💣 Ядерных бомб: ${user.nukes || 0}\n\n/buynuke — купить (${config.NUKE_PRICE} 🧼)\n/launchnuke @user — запустить`);
    return true;
  }
  
  // Админ-команда удаления бомб
  if (cleanText.startsWith('/removenuke')) {
    if (!isAdmin) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Только для админов!`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /removenuke @username`);
      return true;
    }
    
    let targetUsername = parts[1].replace('@', '');
    let targetId = null;
    for (const [id, u] of Object.entries(data.users)) {
      if (u.username?.toLowerCase() === targetUsername.toLowerCase()) {
        targetId = parseInt(id);
        break;
      }
    }
    
    if (!targetId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
      return true;
    }
    
    let targetUser = data.users[targetId];
    const removedNukes = targetUser.nukes || 0;
    targetUser.nukes = 0;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId, `✅ Админ удалил ${removedNukes} бомб у @${targetUsername}`);
    return true;
  }
  
  // Запуск бомбы
  if (cleanText.startsWith('/launchnuke')) {
    if (nowTime < config.NUKE_ACTIVATE_DATE) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ядерное оружие еще не активировано!`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /launchnuke @username`);
      return true;
    }
    
    if ((user.nukes || 0) < 1) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Нет бомб! Купи: /buynuke`);
      return true;
    }
    
    let targetUsername = parts[1].replace('@', '');
    if (targetUsername.toLowerCase() === 'epstain_bot' || targetUsername.toLowerCase() === 'epstein_bot') {
      await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя атаковать бота!`);
      return true;
    }
    
    let targetId = null;
    let targetName = targetUsername;
    for (const [id, u] of Object.entries(data.users)) {
      if (u.username?.toLowerCase() === targetUsername.toLowerCase()) {
        targetId = parseInt(id);
        targetName = u.username;
        break;
      }
    }
    
    if (!targetId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
      return true;
    }
    if (targetId === userId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя атаковать себя!`);
      return true;
    }
    
    let targetUser = data.users[targetId];
    if (!targetUser) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Игрок не найден в базе!`);
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
      `💥 *ЯДЕРНАЯ АТАКА!* 💥\n\n🎯 Цель: @${targetName}\n💣 Полное уничтожение:\n` +
      `💰 Мыло: ${destroyedBalance} → 0\n🏚️ Подвалы: ${destroyedBasements} → 0\n` +
      `👶 Дети: ${destroyedChildren} → 0\n⚔️ Мобилизованные: ${destroyedMobilized} → 0\n` +
      `🏚️ Захваченные подвалы: ${destroyedCaptured} → 0\n\n💣 Осталось бомб: ${user.nukes}`);
    return true;
  }
  
  return false;
}
