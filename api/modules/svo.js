const { sendMessage, saveData, addCapturedBasement, removeCapturedBasement } = require('./helpers');
const config = require('./config');

async function handleSvoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
  const nowTime = Date.now();
  
  if (cleanText === '/svo') {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `⚔️ *СВО ЗАВЕРШЕНО!* ⚔️\n\nИвент закончился 18 апреля 2026.\nСледующий ивент будет позже!`);
      return true;
    }
    
    const timeLeft = config.EVENT_END - nowTime;
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    await sendMessage(BOT_TOKEN, chatId,
      `⚔️ *СВО НА ОСТРОВЕ!* ⚔️\n\n` +
      `📅 Ивент до: 18 апреля 2026, 00:00\n` +
      `⏰ Осталось: ${daysLeft} д ${hoursLeft} ч\n\n` +
      `🎯 *Механика:*\n` +
      `• Обычные дети сидят в подвалах и приносят доход (${config.CHILD_INCOME} 🧼/час)\n` +
      `• Мобилизуй детей за ${config.MOBILIZATION_COST} 🧼 — они пойдут в армию\n` +
      `• Мобилизованные дети могут АТАКОВАТЬ и ЗАЩИЩАТЬ\n` +
      `• 10 мобилизованных детей = захват 1 подвала\n` +
      `• Захваченный подвал приносит ${config.BASEMENT_CAPTURE_REWARD} 🧼/час\n` +
      `• Освободить свой подвал: /free @user [количество] (${config.FREE_COST} 🧼/шт)\n` +
      `• При атаке можно перехватить захваченные подвалы\n\n` +
      `/mobilize [количество] — мобилизовать детей\n` +
      `/attack @user [количество] — атаковать\n` +
      `/free @user [количество] — освободить свои подвалы\n` +
      `/myarmy — моя армия\n` +
      `/mycaptured — мои захваченные подвалы`);
    return true;
  }
  
  if (cleanText.startsWith('/mobilize')) {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ивент СВО завершен! Мобилизация больше недоступна.`);
      return true;
    }
    
    let amount = 1;
    const parts = rawText.split(' ');
    if (parts.length >= 2) {
      const parsedAmount = parseInt(parts[1]);
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
      } else {
        await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /mobilize 5`);
        return true;
      }
    }
    
    const availableChildren = user.children || 0;
    if (availableChildren < amount) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ${amount} обычных детей для мобилизации! У тебя: ${availableChildren} 👶\n\nМобилизовать можно только обычных детей, которые не в армии.`);
      return true;
    }
    
    const totalCost = config.MOBILIZATION_COST * amount;
    if (user.balance < totalCost) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла для мобилизации! Нужно: ${totalCost} 🧼, есть: ${user.balance} 🧼`);
      return true;
    }
    
    user.balance -= totalCost;
    user.children -= amount;
    user.mobilized = (user.mobilized || 0) + amount;
    data.users[userId] = user;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `⚔️ *МОБИЛИЗАЦИЯ!* ⚔️\n\n` +
      `👶 ${username} мобилизовал ${amount} детей!\n` +
      `🧼 -${totalCost} мыла\n` +
      `📊 Баланс: ${user.balance} 🧼\n` +
      `👶 Обычных детей: ${user.children}\n` +
      `⚔️ Мобилизовано: ${user.mobilized}\n\n` +
      `🎯 Атаковать: /attack @user [количество]\n` +
      `🛡️ Защищать мобилизованные дети будут автоматически при атаке`);
    return true;
  }
  
  if (cleanText.startsWith('/attack')) {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ивент СВО завершен! Атаки больше недоступны.`);
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
      await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /attack @username 5`);
      return true;
    }
    
    if ((user.mobilized || 0) < amount) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У тебя мобилизовано только ${user.mobilized || 0} детей! Нужно: ${amount}`);
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
    
    if (!targetId || targetId === userId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername} или это ты сам!`);
      return true;
    }
    
    let targetUser = data.users[targetId] || { balance: 0, basements: 0, children: 0, mobilized: 0, username: targetName, capturedBasementsDetails: [] };
    
    let attackers = amount;
    let defenders = targetUser.mobilized || 0;
    
    let killedAttackers = 0;
    let killedDefenders = 0;
    let capturedBasements = 0;
    let recapturedBasements = 0;
    
    let message = `⚔️ *АТАКА!* ⚔️\n\n` +
      `${username} атакует @${targetName} с ${attackers} мобилизованными детьми!\n` +
      `🛡️ У @${targetName} мобилизовано защитников: ${defenders}\n`;
    
    // Отбиваем свои подвалы
    if (targetUser.capturedBasementsDetails && targetUser.capturedBasementsDetails.length > 0) {
      const myCapturedFromTarget = targetUser.capturedBasementsDetails.find(c => c.ownerId === userId);
      if (myCapturedFromTarget && myCapturedFromTarget.count > 0) {
        const canRecapture = Math.min(myCapturedFromTarget.count, Math.floor(attackers / config.CHILDREN_PER_BASEMENT));
        if (canRecapture > 0) {
          recapturedBasements = canRecapture;
          const removed = removeCapturedBasement(targetUser, userId, canRecapture);
          if (removed > 0) {
            attackers -= removed * config.CHILDREN_PER_BASEMENT;
            user.basements = (user.basements || 0) + removed;
            message += `🔄 *ВОЗВРАЩЕНЫ СВОИ ПОДВАЛЫ!* 🔄\n` +
              `🏚️ Возвращено подвалов: ${removed}\n\n`;
          }
        }
      }
    }
    
    // Битва
    if (attackers > defenders) {
      const survivors = attackers - defenders;
      killedAttackers = defenders;
      killedDefenders = defenders;
      
      message += `🗡️ Убито защитников: ${killedDefenders}\n` +
        `💀 Потери атакующих: ${killedAttackers}\n\n`;
      
      if (survivors > 0) {
        const targetOwnBasements = targetUser.basements || 0;
        const targetCapturedBasements = targetUser.capturedBasements || 0;
        const totalBasements = targetOwnBasements + targetCapturedBasements;
        
        if (totalBasements > 0) {
          const canCapture = Math.min(Math.floor(survivors / config.CHILDREN_PER_BASEMENT), totalBasements);
          
          if (canCapture > 0) {
            capturedBasements = canCapture;
            let remainingToCapture = canCapture;
            
            // Захватываем собственные подвалы
            const ownToCapture = Math.min(remainingToCapture, targetOwnBasements);
            if (ownToCapture > 0) {
              targetUser.basements = targetOwnBasements - ownToCapture;
              remainingToCapture -= ownToCapture;
            }
            
            // Захватываем подвалы, захваченные целью
            if (remainingToCapture > 0 && targetUser.capturedBasementsDetails && targetUser.capturedBasementsDetails.length > 0) {
              let toCapture = remainingToCapture;
              for (let i = 0; i < targetUser.capturedBasementsDetails.length && toCapture > 0; i++) {
                const cap = targetUser.capturedBasementsDetails[i];
                const takeFromThis = Math.min(cap.count, toCapture);
                if (takeFromThis > 0) {
                  cap.count -= takeFromThis;
                  toCapture -= takeFromThis;
                }
              }
              targetUser.capturedBasementsDetails = targetUser.capturedBasementsDetails.filter(c => c.count > 0);
              targetUser.capturedBasements = targetUser.capturedBasementsDetails.reduce((sum, c) => sum + c.count, 0);
            }
            
            // Добавляем захваченные подвалы атакующему
            for (let i = 0; i < capturedBasements; i++) {
              addCapturedBasement(user, targetId, targetName);
            }
            
            const remainingAttackers = survivors % config.CHILDREN_PER_BASEMENT;
            message += `💥 *ЗАХВАТ ПОДВАЛОВ!* 💥\n` +
              `🏚️ Захвачено подвалов: ${capturedBasements}\n` +
              `💰 Каждый захваченный подвал приносит ${config.BASEMENT_CAPTURE_REWARD} 🧼/час!\n`;
            
            if (remainingAttackers > 0) {
              message += `\n⚔️ Осталось атакующих: ${remainingAttackers} (возвращаются домой)`;
            }
          } else {
            message += `❌ Недостаточно атакующих для захвата хотя бы одного подвала (нужно 10 на подвал)!\n` +
              `\n⚔️ Осталось атакующих: ${survivors} (возвращаются домой)`;
          }
        } else {
          message += `❌ У ${targetName} нет подвалов (ни своих, ни захваченных)!\n` +
            `\n⚔️ Осталось атакующих: ${survivors} (возвращаются домой)`;
        }
      }
    } else {
      killedAttackers = attackers;
      killedDefenders = attackers;
      
      message += `🛡️ *АТАКА ОТБИТА!* 🛡️\n` +
        `🗡️ Убито защитников: ${killedDefenders}\n` +
        `💀 Потери атакующих: ${killedAttackers}\n` +
        `❌ Не удалось захватить ни одного подвала!\n\n` +
        `🏚️ У ${targetName} осталось подвалов: ${targetUser.basements || 0}\n` +
        `🏚️ Захваченных подвалов у ${targetName}: ${targetUser.capturedBasements || 0}`;
    }
    
    user.mobilized = (user.mobilized || 0) - killedAttackers;
    if (user.mobilized < 0) user.mobilized = 0;
    
    targetUser.mobilized = (targetUser.mobilized || 0) - killedDefenders;
    if (targetUser.mobilized < 0) targetUser.mobilized = 0;
    
    data.users[userId] = user;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId, message);
    return true;
  }
  
  if (cleanText.startsWith('/free')) {
    if (nowTime > config.EVENT_END) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ивент СВО завершен! Освобождение больше недоступно.`);
      return true;
    }
    
    const parts = rawText.split(' ');
    if (parts.length < 3) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /free @username 2\nОсвободить свои подвалы, захваченные этим пользователем`);
      return true;
    }
    
    let targetUsername = parts[1].replace('@', '');
    let amount = parseInt(parts[2]);
    
    if (isNaN(amount) || amount <= 0) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /free @username 2`);
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
      await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
      return true;
    }
    
    let targetUser = data.users[targetId];
    if (!targetUser || !targetUser.capturedBasementsDetails) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У @${targetName} нет твоих захваченных подвалов!`);
      return true;
    }
    
    const myCaptured = targetUser.capturedBasementsDetails.find(c => c.ownerId === userId);
    if (!myCaptured || myCaptured.count === 0) {
      await sendMessage(BOT_TOKEN, chatId, `❌ У @${targetName} нет твоих захваченных подвалов!`);
      return true;
    }
    
    const canFree = Math.min(amount, myCaptured.count);
    const totalCost = config.FREE_COST * canFree;
    
    if (user.balance < totalCost) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла для освобождения! Нужно: ${totalCost} 🧼, есть: ${user.balance} 🧼`);
      return true;
    }
    
    user.balance -= totalCost;
    
    const removed = removeCapturedBasement(targetUser, userId, canFree);
    user.basements = (user.basements || 0) + removed;
    
    data.users[userId] = user;
    data.users[targetId] = targetUser;
    await saveData(data);
    
    await sendMessage(BOT_TOKEN, chatId,
      `🏚️ *ОСВОБОЖДЕНИЕ ПОДВАЛОВ* 🏚️\n\n` +
      `👤 ${username} освободил ${removed} подвал(ов) у @${targetName}\n` +
      `🧼 -${totalCost} мыла\n` +
      `🏚️ Теперь у тебя подвалов: ${user.basements}\n` +
      `📊 Баланс: ${user.balance} 🧼`);
    return true;
  }
  
  if (cleanText === '/myarmy') {
    const hourlyIncome = (user.children || 0) * config.CHILD_INCOME;
    
    await sendMessage(BOT_TOKEN, chatId,
      `⚔️ *АРМИЯ ${username}* ⚔️\n\n` +
      `👶 Обычных детей: ${user.children || 0} (дают доход ${hourlyIncome} 🧼/час)\n` +
      `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
      `🏚️ Своих подвалов: ${user.basements || 0}\n` +
      `📊 Баланс: ${user.balance} 🧼\n\n` +
      `/mobilize [количество] — мобилизовать детей (${config.MOBILIZATION_COST} 🧼/шт)\n` +
      `/attack @user [количество] — атаковать`);
    return true;
  }
  
  if (cleanText === '/mycaptured') {
    if (!user.capturedBasementsDetails || user.capturedBasementsDetails.length === 0) {
      await sendMessage(BOT_TOKEN, chatId, `🏚️ У тебя нет захваченных подвалов.\n\nЗахватить подвал можно атакой: /attack @user`);
      return true;
    }
    
    let reply = `🏚️ *ЗАХВАЧЕННЫЕ ПОДВАЛЫ ${username}* 🏚️\n\n`;
    let total = 0;
    for (const cap of user.capturedBasementsDetails) {
      reply += `🎯 У @${cap.owner}: ${cap.count} 🏚️ (дает ${cap.count * config.BASEMENT_CAPTURE_REWARD} 🧼/час)\n`;
      total += cap.count;
    }
    reply += `\n📊 Всего захвачено: ${total} 🏚️\n` +
      `💰 Общий доход: ${total * config.BASEMENT_CAPTURE_REWARD} 🧼/час\n\n` +
      `/free @user [количество] — освободить свои подвалы`;
    
    await sendMessage(BOT_TOKEN, chatId, reply);
    return true;
  }
  
  return false;
}

module.exports = { handleSvoCommand };
