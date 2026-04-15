import { sendMessage, editMessage, deleteMessage, answerCallback, loadData, saveData } from './helpers.js';

export async function handleDuelCallback(update, BOT_TOKEN, duels) {
  const callback = update.callback_query;
  const cbData = callback.data;
  const userId = callback.from.id;
  const username = callback.from.username || callback.from.first_name;
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  
  // Принятие дуэли
  if (cbData.startsWith('accept_')) {
    const duelId = cbData.split('_')[1];
    const duel = duels[duelId];
    
    if (duel && duel.status === 'waiting' && duel.player2Id === userId) {
      duel.status = 'active';
      duel.turn = duel.player1Id;
      duel.aim1 = 0;
      duel.aim2 = 0;
      const currentPlayer = duel.turn === duel.player1Id ? duel.player1Name : duel.player2Name;
      const currentAim = duel.turn === duel.player1Id ? duel.aim1 : duel.aim2;
      const currentChance = Math.min(20 + currentAim, 50);
      const bet = duel.bet || 3;
      const keyboard = {
        inline_keyboard: [[
          { text: `🎯 ПРИЦЕЛ (+10%) [${currentAim}/30]`, callback_data: `aim_${duelId}` },
          { text: `🔫 СБИТЬ`, callback_data: `break_${duelId}` }
        ], [
          { text: `💥 ВЫСТРЕЛ (${currentChance}%)`, callback_data: `shoot_${duelId}` }
        ]]
      };
      await editMessage(BOT_TOKEN, chatId, messageId,
        `⚔️ ДУЭЛЬ!\n${duel.player1Name} VS ${duel.player2Name}\n💰 СТАВКА: ${bet} 🧼\n🎯 Точность: ${currentChance}%\nХОД: ${currentPlayer}`,
        keyboard
      );
      await answerCallback(callback.id);
    } else {
      await answerCallback(callback.id, '❌ Дуэль недоступна');
    }
    return true;
  }
  
  // Отмена дуэли
  if (cbData === 'cancel') {
    for (const [id, duel] of Object.entries(duels)) {
      if (duel.player1Id === userId || duel.player2Id === userId) {
        await sendMessage(BOT_TOKEN, chatId, `❌ ${username} отменил дуэль.`);
        await deleteMessage(BOT_TOKEN, chatId, messageId);
        delete duels[id];
        break;
      }
    }
    await answerCallback(callback.id);
    return true;
  }
  
  // Действия в дуэли
  if (cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
    const [action, duelId] = cbData.split('_');
    const duel = duels[duelId];
    
    if (!duel || duel.status !== 'active') {
      await answerCallback(callback.id, '❌ Дуэль не найдена');
      await deleteMessage(BOT_TOKEN, chatId, messageId);
      return true;
    }
    
    if (duel.turn !== userId) {
      const waitingName = duel.turn === duel.player1Id ? duel.player1Name : duel.player2Name;
      await answerCallback(callback.id, `⏳ Сейчас ход ${waitingName}!`);
      return true;
    }
    
    const isPlayer1 = userId === duel.player1Id;
    let resultText = '';
    let duelEnded = false;
    let hit = false;
    
    if (action === 'aim') {
      let aimBonus = isPlayer1 ? duel.aim1 : duel.aim2;
      if (aimBonus >= 30) {
        await answerCallback(callback.id, '🎯 Максимум!');
        return true;
      }
      aimBonus += 10;
      if (aimBonus > 30) aimBonus = 30;
      if (isPlayer1) duel.aim1 = aimBonus;
      else duel.aim2 = aimBonus;
      resultText = `🎯 ${username} прицелился! Точность: ${Math.min(20 + aimBonus, 50)}%`;
      duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
    } else if (action === 'break') {
      if (isPlayer1) {
        duel.aim2 = 0;
        resultText = `🔫 ${username} сбил прицел у ${duel.player2Name}!`;
      } else {
        duel.aim1 = 0;
        resultText = `🔫 ${username} сбил прицел у ${duel.player1Name}!`;
      }
      duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
    } else if (action === 'shoot') {
      const aimBonus = isPlayer1 ? duel.aim1 : duel.aim2;
      const hitChance = Math.min(20 + aimBonus, 50);
      const hitRoll = Math.random() * 100;
      hit = hitRoll < hitChance;
      const targetId = isPlayer1 ? duel.player2Id : duel.player1Id;
      const targetName = isPlayer1 ? duel.player2Name : duel.player1Name;
      const bet = duel.bet || 3;
      let data = await loadData();
      if (!data.users) data.users = {};
      let targetData = data.users[targetId] || { balance: 0, children: 0 };
      let shooterData = data.users[userId] || { balance: 0, children: 0 };
      
      resultText = `🎲 ${username} стреляет! Точность: ${hitChance}%, выпало: ${hitRoll.toFixed(1)}%\n\n`;
      if (hit) {
        resultText += `💥 ПОПАДАНИЕ!\n${username} попал в ${targetName}!\n`;
        if (targetData.balance < bet) {
          const oldBalance = targetData.balance;
          targetData.mutedUntil = Math.floor(Date.now() / 1000) + 60;
          targetData.balance = 0;
          resultText += `😵 У ${targetName} было ${oldBalance} мыла!\n🔇 МУТ на 1 минуту!`;
          shooterData.balance += oldBalance;
        } else {
          targetData.balance -= bet;
          shooterData.balance += bet;
          resultText += `🧼 ${username} забрал ${bet} мыла!\n📊 ${username}: ${shooterData.balance} 🧼\n📊 ${targetName}: ${targetData.balance} 🧼`;
        }
        resultText += `\n\n🏆 ПОБЕДИТЕЛЬ: ${username}`;
        data.users[targetId] = targetData;
        data.users[userId] = shooterData;
        await saveData(data);
        duelEnded = true;
        delete duels[duelId];
      } else {
        resultText += `💨 ПРОМАХ!\n${username} промахнулся!`;
        if (isPlayer1) duel.aim1 = 0;
        else duel.aim2 = 0;
        duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
      }
    }
    
    if (duelEnded) {
      await editMessage(BOT_TOKEN, chatId, messageId, resultText, null);
      await answerCallback(callback.id, hit ? 'Победа!' : 'Поражение');
    } else {
      const nextId = duel.turn;
      const nextName = nextId === duel.player1Id ? duel.player1Name : duel.player2Name;
      const nextAim = nextId === duel.player1Id ? duel.aim1 : duel.aim2;
      const nextChance = Math.min(20 + nextAim, 50);
      const keyboard = {
        inline_keyboard: [[
          { text: `🎯 ПРИЦЕЛ (+10%) [${nextAim}/30]`, callback_data: `aim_${duelId}` },
          { text: `🔫 СБИТЬ`, callback_data: `break_${duelId}` }
        ], [
          { text: `💥 ВЫСТРЕЛ (${nextChance}%)`, callback_data: `shoot_${duelId}` }
        ]]
      };
      await editMessage(BOT_TOKEN, chatId, messageId,
        `⚔️ ДУЭЛЬ!\n${duel.player1Name} VS ${duel.player2Name}\n${resultText}\n💰 СТАВКА: ${duel.bet || 3} 🧼\n🎯 Точность ${nextName}: ${nextChance}%\nХОД: ${nextName}`,
        keyboard
      );
      await answerCallback(callback.id, 'Ход передан');
    }
    return true;
  }
  
  return false;
}

export async function handleDuelCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, duels) {
  if (!cleanText.startsWith('/duel')) return false;
  
  const parts = rawText.split(' ');
  let targetUsername = parts[1];
  let bet = 3;
  
  if (!targetUsername) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /duel @username или /duel @username 10`);
    return true;
  }
  if (parts.length >= 3) {
    const parsedBet = parseInt(parts[2]);
    if (!isNaN(parsedBet) && parsedBet > 0) bet = parsedBet;
    else {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ставка должна быть положительным числом!`);
      return true;
    }
  }
  
  targetUsername = targetUsername.replace('@', '');
  let opponentId = null;
  let opponentName = targetUsername;
  for (const [id, u] of Object.entries(data.users)) {
    if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
      opponentId = parseInt(id);
      opponentName = u.username;
      break;
    }
  }
  
  if (!opponentId || opponentId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
    return true;
  }
  if (user.balance < bet) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Есть: ${user.balance}, нужно: ${bet}`);
    return true;
  }
  
  const opponent = data.users[opponentId] || { balance: 0 };
  if (opponent.balance < bet) {
    await sendMessage(BOT_TOKEN, chatId, `❌ У @${opponentName} не хватает мыла!`);
    return true;
  }
  
  for (const duel of Object.values(duels)) {
    if (duel.player1Id === userId || duel.player2Id === userId) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Ты уже в дуэли!`);
      return true;
    }
  }
  
  const duelId = Date.now().toString();
  duels[duelId] = {
    id: duelId, player1Id: userId, player1Name: username,
    player2Id: opponentId, player2Name: opponentName,
    bet, status: 'waiting', turn: null, aim1: 0, aim2: 0
  };
  
  const keyboard = {
    inline_keyboard: [[
      { text: `⚔️ ПРИНЯТЬ ДУЭЛЬ (ставка ${bet} 🧼)`, callback_data: `accept_${duelId}` },
      { text: '❌ ОТМЕНА', callback_data: 'cancel' }
    ]]
  };
  
  await sendMessage(BOT_TOKEN, chatId,
    `⚔️ ДУЭЛЬ!\n${username} вызывает @${opponentName}!\n💰 СТАВКА: ${bet} 🧼\n⏳ 60 секунд на принятие!`,
    keyboard
  );
  
  setTimeout(() => {
    if (duels[duelId] && duels[duelId].status === 'waiting') {
      delete duels[duelId];
      sendMessage(BOT_TOKEN, chatId, `⏰ Дуэль отменена`);
    }
  }, 60000);
  
  return true;
}
