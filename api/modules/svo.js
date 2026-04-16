import { sendMessage, saveData, addCapturedBasement, removeCapturedBasement } from './helpers.js';
import config from './config.js';

export async function handleSvoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  const nowTime = Date.now();
  
  // /svo - информация об ивенте
  if (cleanText === '/svo') {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `⚔️ *СВО ЗАВЕРШЕНО!* ⚔️\n\nИвент закончился 18 апреля 2026.`);
      return true;
    }
    
    const timeLeft = config.EVENT_END - nowTime;
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    await sendMessage(BOT_TOKEN, chatId,
      `⚔️ *СВО НА ОСТРОВЕ!* ⚔️\n\n📅 До 18.04.2026\n⏰ Осталось: ${daysLeft} д ${hoursLeft} ч\n\n` +
      `• Мобилизуй детей за ${config.MOBILIZATION_COST} 🧼\n• 1 мобилизованный = 1 подвал\n• Захваченный подвал даёт ${config.BASEMENT_CAPTURE_REWARD} 🧼/час\n` +
      `/mobilize [количество]\n/attack @user [количество]\n/free @user\n/myarmy\n/mycaptured`);
    return true;
  }
  
  // /mobilize - мобилизация
  if (cleanText.startsWith('/mobilize')) {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ивент завершен!`);
      return true;
    }
    
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
    
    const availableChildren = user.children || 0;
    if (availableChildren < amount) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Нет ${amount} обычных детей! Есть: ${availableChildren}`);
      return true;
    }
    
    const totalCost = config.MOBILIZATION_COST * amount;
    if (user.balance < totalCost) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно: ${totalCost} 🧼`);
      return true;
    }
    
    user.balance -= totalCost;
    user.children -= amount;
    user.mobilized = (user.mobilized || 0) + amount;
    data.users[userId] = user;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `⚔️ *МОБИЛИЗАЦИЯ!* ⚔️\n\n👶 ${username} мобилизовал ${amount} детей!\n🧼 -${totalCost} мыла\n⚔️ Мобилизовано: ${user.mobilized}\n👶 Осталось детей: ${user.children}`);
    return true;
  }
  
  // /attack - атака
  if (cleanText.startsWith('/attack')) {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ивент завершен!`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 3) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /attack @username 5`);
      return true;
    }
    
    let targetUsername = parts[1].replace('@', '');
    let amount = parseInt(parts[2]);
    if (isNaN(amount) || amount <= 0) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
      return true;
    }
    if ((user.mobilized || 0) < amount) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Мобилизовано только ${user.mobilized || 0}!`);
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
    if (!targetId || targetId === userId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
      return true;
    }
    
    let targetUser = data.users[targetId] || { basements: 0, mobilized: 0, capturedBasementsDetails: [] };
    
    let attackers = amount;
    let defenders = targetUser.mobilized || 0;
    let killedAttackers = 0;
    let killedDefenders = 0;
    let capturedBasements = 0;
    let message = `⚔️ *АТАКА!* ⚔️\n\n${username} атакует @${targetName} с ${attackers} детьми!\n🛡️ Защитников: ${defenders}\n`;
    
    // Отбиваем свои подвалы
    if (targetUser.capturedBasementsDetails?.length) {
      const myCaptured = targetUser.capturedBasementsDetails.find(c => c.ownerId === userId);
      if (myCaptured?.count) {
        const canRecapture = Math.min(myCaptured.count, attackers);
        if (canRecapture > 0) {
          const removed = removeCapturedBasement(targetUser, userId, canRecapture);
          if (removed > 0) {
            attackers -= removed;
            user.basements = (user.basements || 0) + removed;
            message += `🔄 Возвращено подвалов: ${removed}\n\n`;
          }
        }
      }
    }
    
    // Битва
    if (attackers > defenders) {
      const survivors = attackers - defenders;
      killedAttackers = defenders;
      killedDefenders = defenders;
      message += `🗡️ Убито защитников: ${killedDefenders}\n💀 Потери: ${killedAttackers}\n\n`;
      
      if (survivors > 0) {
        const targetBasements = targetUser.basements || 0;
        capturedBasements = Math.min(survivors, targetBasements);
        
        if (capturedBasements > 0) {
          targetUser.basements = targetBasements - capturedBasements;
          for (let i = 0; i < capturedBasements; i++) {
            addCapturedBasement(user, targetId, targetName);
          }
          message += `💥 *ЗАХВАЧЕНО ПОДВАЛОВ:* ${capturedBasements}\n💰 +${capturedBasements * config.BASEMENT_CAPTURE_REWARD} 🧼/час\n`;
          const remaining = survivors - capturedBasements;
          if (remaining > 0) message += `\n⚔️ Осталось атакующих: ${remaining}`;
        } else {
          message += `❌ У ${targetName} нет подвалов!\n⚔️ Осталось атакующих: ${survivors}`;
        }
      }
    } else {
      killedAttackers = attackers;
      killedDefenders = attackers;
      message += `🛡️ *АТАКА ОТБИТА!*\n🗡️ Убито защитников: ${killedDefenders}\n💀 Потери: ${killedAttackers}`;
    }
    
    user.mobilized = (user.mobilized || 0) - killedAttackers;
    targetUser.mobilized = (targetUser.mobilized || 0) - killedDefenders;
    if (user.mobilized < 0) user.mobilized = 0;
    if (targetUser.mobilized < 0) targetUser.mobilized = 0;
    
    data.users[userId] = user;
    data.users[targetId] = targetUser;
    await saveData(data);
    await sendMessage(BOT_TOKEN, chatId, message);
    return true;
  }
  
  // /free - освобождение подвалов
  if (cleanText.startsWith('/free')) {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ивент завершен!`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 2) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /free @username`);
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
    
    if (!user.capturedBasementsDetails?.length) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет захваченных подвалов!`);
      return true;
    }
    
    const myCaptured = user.capturedBasementsDetails.find(c => c.ownerId === targetId);
    if (!myCaptured?.count) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет захваченных подвалов у @${targetUsername}!`);
      return true;
    }
    
    let targetUser = data.users[targetId];
    const removed = removeCapturedBasement(user, targetId, myCaptured.count);
    targetUser.basements = (targetUser.basements || 0) + removed;
    
    data.users[userId] = user;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId, `🏚️ ${username} освободил ${removed} подвал(ов) и вернул @${targetUsername}`);
    return true;
  }
  
  // /myarmy
  if (cleanText === '/myarmy') {
    await sendMessage(BOT_TOKEN, chatId,
      `⚔️ *АРМИЯ ${username}* ⚔️\n\n👶 Обычных детей: ${user.children || 0}\n⚔️ Мобилизовано: ${user.mobilized || 0}\n🏚️ Подвалов: ${user.basements || 0}\n🏚️ Захвачено: ${user.capturedBasements || 0}\n📊 Баланс: ${user.balance} 🧼\n\n/mobilize [количество]\n/attack @user [количество]`);
    return true;
  }
  
  // /mycaptured
  if (cleanText === '/mycaptured') {
    if (!user.capturedBasementsDetails?.length) {
      await sendMessage(BOT_TOKEN, chatId, `🏚️ У тебя нет захваченных подвалов.\n/attack @user`);
      return true;
    }
    
    let reply = `🏚️ *ЗАХВАЧЕННЫЕ ПОДВАЛЫ* 🏚️\n\n`;
    let total = 0;
    for (const cap of user.capturedBasementsDetails) {
      reply += `🎯 У @${cap.owner}: ${cap.count} 🏚️ (${cap.count * config.BASEMENT_CAPTURE_REWARD} 🧼/час)\n`;
      total += cap.count;
    }
    reply += `\n📊 Всего: ${total} 🏚️\n💰 Доход: ${total * config.BASEMENT_CAPTURE_REWARD} 🧼/час\n\n/free @user — освободить`;
    await sendMessage(BOT_TOKEN, chatId, reply);
    return true;
  }
  
  return false;
}
