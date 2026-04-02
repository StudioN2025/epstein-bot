const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

const PIDIDI_STEAL_CHANCE = 5;
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

const CHILD_COST = 100;

let duels = {};

// Промокоды
let PROMOCODES = {
  'superepstain67': {
    reward: 67,
    maxUses: 5,
    usedCount: 0,
    usedBy: []
  }
};

function cleanCommand(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/@\w+/, '').trim();
}

async function isGroupAdmin(botToken, chatId, userId) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId })
    });
    const data = await response.json();
    
    if (data.ok && data.result) {
      const status = data.result.status;
      return status === 'creator' || status === 'administrator';
    }
    return false;
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼' });
  }
  
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      if (update.callback_query) {
        const callback = update.callback_query;
        const cbData = callback.data;
        const userId = callback.from.id;
        const username = callback.from.username || callback.from.first_name;
        const chatId = callback.message.chat.id;
        const messageId = callback.message.message_id;
        
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
        }
        
        else if (cbData === 'cancel') {
          for (const [id, duel] of Object.entries(duels)) {
            if (duel.player1Id === userId || duel.player2Id === userId) {
              await sendMessage(BOT_TOKEN, chatId, `❌ ${username} отменил дуэль.`);
              await deleteMessage(BOT_TOKEN, chatId, messageId);
              delete duels[id];
              break;
            }
          }
          await answerCallback(callback.id);
        }
        
        else if (cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
          const [action, duelId] = cbData.split('_');
          const duel = duels[duelId];
          
          if (!duel || duel.status !== 'active') {
            await answerCallback(callback.id, '❌ Дуэль не найдена');
            await deleteMessage(BOT_TOKEN, chatId, messageId);
            return res.status(200).json({ ok: true });
          }
          
          if (duel.turn !== userId) {
            const waitingName = duel.turn === duel.player1Id ? duel.player1Name : duel.player2Name;
            await answerCallback(callback.id, `⏳ Сейчас ход ${waitingName}!`);
            return res.status(200).json({ ok: true });
          }
          
          const isPlayer1 = (userId === duel.player1Id);
          let resultText = '';
          let duelEnded = false;
          let hit = false;
          
          if (action === 'aim') {
            let aimBonus = isPlayer1 ? duel.aim1 : duel.aim2;
            if (aimBonus >= 30) {
              await answerCallback(callback.id, '🎯 Максимум!');
              return res.status(200).json({ ok: true });
            }
            aimBonus += 10;
            if (aimBonus > 30) aimBonus = 30;
            if (isPlayer1) duel.aim1 = aimBonus;
            else duel.aim2 = aimBonus;
            resultText = `🎯 ${username} прицелился! Точность: ${Math.min(20 + aimBonus, 50)}%`;
            duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
          }
          
          else if (action === 'break') {
            if (isPlayer1) {
              duel.aim2 = 0;
              resultText = `🔫 ${username} сбил прицел у ${duel.player2Name}!`;
            } else {
              duel.aim1 = 0;
              resultText = `🔫 ${username} сбил прицел у ${duel.player1Name}!`;
            }
            duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
          }
          
          else if (action === 'shoot') {
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
                resultText += `😵 У ${targetName} было ${oldBalance} мыла! Не хватило ${bet} мыла!\n🔇 МУТ на 1 минуту!`;
                shooterData.balance += oldBalance;
                resultText += `\n🧼 ${username} забрал ${oldBalance} мыла (сколько было)`;
              } else {
                targetData.balance -= bet;
                shooterData.balance += bet;
                resultText += `🧼 ${username} забрал ${bet} мыла!\n📊 ${username}: ${shooterData.balance} 🧼, ${shooterData.children || 0} 👶\n📊 ${targetName}: ${targetData.balance} 🧼, ${targetData.children || 0} 👶`;
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
        }
        
        return res.status(200).json({ ok: true });
      }
      
      if (!update.message || !update.message.text) {
        return res.status(200).json({ ok: true });
      }
      
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const username = update.message.from.username || update.message.from.first_name;
      const rawText = update.message.text;
      const cleanText = cleanCommand(rawText);
      
      if (chatId !== ALLOWED_CHAT_ID) {
        await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${GROUP_INVITE_LINK}`);
        return res.status(200).json({ ok: true });
      }
      
      let data = await loadData();
      if (!data.users) data.users = {};
      
      let user = data.users[userId] || { balance: 0, children: 0, username: username, lastFarm: 0, mutedUntil: 0 };
      if (user.children === undefined) user.children = 0;
      
      // Загружаем промокоды из сохраненных данных
      if (data.promocodes) {
        PROMOCODES = data.promocodes;
      }
      
      if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
        const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
        await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
        return res.status(200).json({ ok: true });
      }
      
      const isAdmin = await isGroupAdmin(BOT_TOKEN, chatId, userId);
      
      // ========== АДМИН-КОМАНДЫ ==========
      if (isAdmin && cleanText.startsWith('/addsoap')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /addsoap @username 50`);
          return res.status(200).json({ ok: true });
        }
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
          return res.status(200).json({ ok: true });
        }
        let targetId = null;
        for (const [id, u] of Object.entries(data.users)) {
          if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
            targetId = parseInt(id);
            break;
          }
        }
        if (!targetId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0 };
        targetUser.balance = (targetUser.balance || 0) + amount;
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 🧼 @${targetUsername}\n📊 Теперь: ${targetUser.balance} 🧼`);
      }
      
      else if (isAdmin && cleanText.startsWith('/removesoap')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /removesoap @username 50`);
          return res.status(200).json({ ok: true });
        }
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
          return res.status(200).json({ ok: true });
        }
        let targetId = null;
        for (const [id, u] of Object.entries(data.users)) {
          if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
            targetId = parseInt(id);
            break;
          }
        }
        if (!targetId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0 };
        targetUser.balance = Math.max(0, (targetUser.balance || 0) - amount);
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 🧼 у @${targetUsername}\n📊 Теперь: ${targetUser.balance} 🧼`);
      }
      
      else if (isAdmin && cleanText.startsWith('/addchild')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /addchild @username 2`);
          return res.status(200).json({ ok: true });
        }
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
          return res.status(200).json({ ok: true });
        }
        let targetId = null;
        for (const [id, u] of Object.entries(data.users)) {
          if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
            targetId = parseInt(id);
            break;
          }
        }
        if (!targetId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0 };
        targetUser.children = (targetUser.children || 0) + amount;
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 👶 @${targetUsername}\n📊 Теперь: ${targetUser.children} 👶`);
      }
      
      else if (isAdmin && cleanText.startsWith('/removechild')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /removechild @username 2`);
          return res.status(200).json({ ok: true });
        }
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
          return res.status(200).json({ ok: true });
        }
        let targetId = null;
        for (const [id, u] of Object.entries(data.users)) {
          if (u.username && u.username.toLowerCase() === targetUsername.toLowerCase()) {
            targetId = parseInt(id);
            break;
          }
        }
        if (!targetId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0 };
        targetUser.children = Math.max(0, (targetUser.children || 0) - amount);
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 👶 у @${targetUsername}\n📊 Теперь: ${targetUser.children} 👶`);
      }
      
      // ========== АДМИН-КОМАНДЫ ДЛЯ ПРОМОКОДОВ ==========
      else if (isAdmin && cleanText.startsWith('/createpromo')) {
        const parts = rawText.split(' ');
        if (parts.length < 4) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /createpromo КОД 100 10\n(код, награда в мыле, количество активаций)`);
          return res.status(200).json({ ok: true });
        }
        
        const code = parts[1].toLowerCase();
        const reward = parseInt(parts[2]);
        const maxUses = parseInt(parts[3]);
        
        if (isNaN(reward) || reward <= 0 || isNaN(maxUses) || maxUses <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Награда и количество активаций должны быть положительными числами!`);
          return res.status(200).json({ ok: true });
        }
        
        PROMOCODES[code] = {
          reward: reward,
          maxUses: maxUses,
          usedCount: 0,
          usedBy: []
        };
        
        // Сохраняем промокоды в базу
        data.promocodes = PROMOCODES;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId,
          `✅ *ПРОМОКОД СОЗДАН!* ✅\n\n` +
          `Код: ${code.toUpperCase()}\n` +
          `Награда: ${reward} 🧼\n` +
          `Макс активаций: ${maxUses}\n\n` +
          `Использовать: /promo ${code.toUpperCase()}`
        );
      }
      
      else if (isAdmin && cleanText === '/promolist') {
        let reply = `📋 *СПИСОК ПРОМОКОДОВ* 📋\n\n`;
        if (Object.keys(PROMOCODES).length === 0) {
          reply += `Нет активных промокодов.\nСоздай: /createpromo КОД 100 10`;
        } else {
          for (const [code, data] of Object.entries(PROMOCODES)) {
            reply += `🔸 ${code.toUpperCase()}\n   Награда: ${data.reward} 🧼\n   Активаций: ${data.usedCount}/${data.maxUses}\n   Активировали: ${data.usedBy.length} чел.\n\n`;
          }
        }
        await sendMessage(BOT_TOKEN, chatId, reply);
      }
      
      else if (isAdmin && cleanText.startsWith('/deletepromo')) {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /deletepromo КОД`);
          return res.status(200).json({ ok: true });
        }
        
        const code = parts[1].toLowerCase();
        
        if (!PROMOCODES[code]) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Промокод ${code.toUpperCase()} не найден!`);
          return res.status(200).json({ ok: true });
        }
        
        delete PROMOCODES[code];
        data.promocodes = PROMOCODES;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId, `✅ Промокод ${code.toUpperCase()} удален!`);
      }
      
      // ========== ОБЫЧНЫЕ КОМАНДЫ ==========
      else if (cleanText === '/buychild') {
        if (user.balance >= CHILD_COST) {
          user.balance -= CHILD_COST;
          user.children += 1;
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId, `👶 ${username} купил ребенка!\n🧼 ${user.balance} мыла\n👶 ${user.children} детей`);
        } else {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${CHILD_COST}, есть ${user.balance}`);
        }
      }
      
      else if (cleanText === '/children') {
        await sendMessage(BOT_TOKEN, chatId, `👶 ДЕТИ ${username}:\n🧼 ${user.balance} мыла\n👶 ${user.children} детей\n/buychild - 100 мыла = 1 ребенок`);
      }
      
      else if (cleanText === '/topchildren') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
        if (sorted.length === 0 || sorted[0].children === 0) {
          await sendMessage(BOT_TOKEN, chatId, '👶 Топ детей пуст!');
        } else {
          let reply = '👶 ТОП ДЕТОВОДОВ 👶\n\n';
          sorted.forEach((u, i) => {
            if (u.children > 0) reply += `${i+1}. ${u.username} — ${u.children} 👶\n`;
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/promo') {
        let reply = `🎫 *ВВЕДИ ПРОМОКОД*\n\nОтправь команду:\n/promo КОД\n\nПример: /promo SUPEREPSTAIN67\n\n📋 *ДОСТУПНЫЕ ПРОМОКОДЫ:*\n`;
        for (const [code, data] of Object.entries(PROMOCODES)) {
          const remaining = data.maxUses - data.usedCount;
          if (remaining > 0) {
            reply += `• ${code.toUpperCase()} — ${data.reward} 🧼 (осталось ${remaining} активаций)\n`;
          }
        }
        await sendMessage(BOT_TOKEN, chatId, reply);
      }
      
      else if (cleanText.startsWith('/promo ')) {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Напиши промокод: /promo КОД`);
          return res.status(200).json({ ok: true });
        }
        
        const promoCode = parts[1].toLowerCase();
        const promo = PROMOCODES[promoCode];
        
        if (!promo) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" не найден!`);
          return res.status(200).json({ ok: true });
        }
        
        if (promo.usedBy.includes(userId)) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже активировал этот промокод!`);
          return res.status(200).json({ ok: true });
        }
        
        if (promo.usedCount >= promo.maxUses) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" больше не активен! Все ${promo.maxUses} активаций использованы.`);
          return res.status(200).json({ ok: true });
        }
        
        promo.usedCount++;
        promo.usedBy.push(userId);
        
        user.balance += promo.reward;
        data.users[userId] = user;
        data.promocodes = PROMOCODES;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId,
          `🎉 *ПРОМОКОД АКТИВИРОВАН!* 🎉\n\n` +
          `Код: ${parts[1].toUpperCase()}\n` +
          `Награда: +${promo.reward} 🧼\n\n` +
          `📊 Твой баланс: ${user.balance} 🧼\n` +
          `👶 Детей: ${user.children || 0}\n\n` +
          `Осталось активаций промокода: ${promo.maxUses - promo.usedCount}`
        );
      }
      
      else if (cleanText.startsWith('/sendsoap')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /sendsoap @username 50`);
          return res.status(200).json({ ok: true });
        }
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
          return res.status(200).json({ ok: true });
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        if (targetId === userId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить мыло самому себе!`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0, username: targetName };
        if (user.balance < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Есть: ${user.balance}, нужно: ${amount}`);
          return res.status(200).json({ ok: true });
        }
        user.balance -= amount;
        targetUser.balance += amount;
        data.users[userId] = user;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId,
          `💰 ПЕРЕВОД МЫЛА 💰\nОт: ${username}\nКому: @${targetName}\nСумма: ${amount} 🧼\n\n📊 У ${username} осталось: ${user.balance} 🧼\n📊 У @${targetName} теперь: ${targetUser.balance} 🧼`);
      }
      
      else if (cleanText.startsWith('/sendchild')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /sendchild @username 2`);
          return res.status(200).json({ ok: true });
        }
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число!`);
          return res.status(200).json({ ok: true });
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        if (targetId === userId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить детей самому себе!`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0, username: targetName };
        const userChildren = user.children || 0;
        if (userChildren < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает детей! Есть: ${userChildren}, нужно: ${amount}`);
          return res.status(200).json({ ok: true });
        }
        user.children = userChildren - amount;
        targetUser.children = (targetUser.children || 0) + amount;
        data.users[userId] = user;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId,
          `👶 ПЕРЕВОД ДЕТЕЙ 👶\nОт: ${username}\nКому: @${targetName}\nКоличество: ${amount} 👶\n\n📊 У ${username} осталось: ${user.children} 👶\n📊 У @${targetName} теперь: ${targetUser.children} 👶\n🍼 Берегите детей! 🍼`);
      }
      
      else if (cleanText.startsWith('/duel')) {
        const parts = rawText.split(' ');
        let targetUsername = parts[1];
        let bet = 3;
        
        if (!targetUsername) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /duel @username или /duel @username 10`);
          return res.status(200).json({ ok: true });
        }
        
        if (parts.length >= 3) {
          const parsedBet = parseInt(parts[2]);
          if (!isNaN(parsedBet) && parsedBet > 0) {
            bet = parsedBet;
          } else {
            await sendMessage(BOT_TOKEN, chatId, `❌ Ставка должна быть положительным числом!`);
            return res.status(200).json({ ok: true });
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
          return res.status(200).json({ ok: true });
        }
        
        if (user.balance < bet) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У тебя не хватает мыла! Есть: ${user.balance}, нужно: ${bet}`);
          return res.status(200).json({ ok: true });
        }
        
        const opponent = data.users[opponentId] || { balance: 0 };
        if (opponent.balance < bet) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У @${opponentName} не хватает мыла! Есть: ${opponent.balance}, нужно: ${bet}`);
          return res.status(200).json({ ok: true });
        }
        
        for (const duel of Object.values(duels)) {
          if (duel.player1Id === userId || duel.player2Id === userId) {
            await sendMessage(BOT_TOKEN, chatId, `❌ Ты уже в дуэли!`);
            return res.status(200).json({ ok: true });
          }
        }
        
        const duelId = Date.now().toString();
        duels[duelId] = {
          id: duelId, player1Id: userId, player1Name: username,
          player2Id: opponentId, player2Name: opponentName,
          bet: bet, status: 'waiting', turn: null, aim1: 0, aim2: 0
        };
        
        const keyboard = {
          inline_keyboard: [[
            { text: `⚔️ ПРИНЯТЬ ДУЭЛЬ (ставка ${bet} 🧼)`, callback_data: `accept_${duelId}` },
            { text: '❌ ОТМЕНА', callback_data: 'cancel' }
          ]]
        };
        
        await sendMessage(BOT_TOKEN, chatId,
          `⚔️ ДУЭЛЬ!\n${username} вызывает @${opponentName}!\n💰 СТАВКА: ${bet} 🧼\n🏆 Победитель забирает ${bet} мыла!\n⏳ 60 секунд на принятие!`,
          keyboard
        );
        
        setTimeout(() => {
          if (duels[duelId] && duels[duelId].status === 'waiting') {
            delete duels[duelId];
            sendMessage(BOT_TOKEN, chatId, `⏰ Дуэль между ${username} и @${opponentName} отменена.`);
          }
        }, 60000);
      }
      
      else if (cleanText === '/farm') {
        const now = Math.floor(Date.now() / 1000);
        if (user.lastFarm && (now - user.lastFarm) < 3600) {
          const minutes = Math.ceil((3600 - (now - user.lastFarm)) / 60);
          await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, жди ${minutes} мин!`);
        } else {
          const soap = Math.floor(Math.random() * 30) + 1;
          user.balance += soap;
          user.lastFarm = now;
          user.username = username;
          
          let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей\n/buychild - 100 мыла = ребенок`;
          
          if (Math.random() * 100 < PIDIDI_STEAL_CHANCE) {
            const stolen = Math.floor(Math.random() * (PIDIDI_STEAL_MAX - PIDIDI_STEAL_MIN + 1)) + PIDIDI_STEAL_MIN;
            if (user.balance - stolen <= 0) {
              user.balance = 0;
              message = `😡👶 ПИДИДИ УКРАЛ ВСЁ!\n${username}, осталось 0 мыла!`;
            } else {
              user.balance -= stolen;
              message = `😡👶 ПИДИДИ УКРАЛ ${stolen} МЫЛА!\n🧼 Осталось: ${user.balance}`;
            }
          }
          
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId, message);
        }
      }
      
      else if (cleanText === '/balance') {
        await sendMessage(BOT_TOKEN, chatId, `📊 ${username}\n🧼 Мыла: ${user.balance}\n👶 Детей: ${user.children || 0}\n/buychild - 100 мыла = ребенок`);
      }
      
      else if (cleanText === '/top') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
        let reply = '🏆 ТОП МЫЛА 🏆\n\n';
        sorted.forEach((u, i) => {
          reply += `${i+1}. ${u.username} — ${u.balance} 🧼 (${u.children || 0}👶)\n`;
        });
        await sendMessage(BOT_TOKEN, chatId, reply);
      }
      
      else if (cleanText === '/start') {
        let adminCommands = '';
        if (isAdmin) {
          adminCommands = `\n\n👑 *АДМИН-КОМАНДЫ:*\n` +
            `/addsoap @user 50 — добавить мыло\n` +
            `/removesoap @user 50 — снять мыло\n` +
            `/addchild @user 2 — добавить детей\n` +
            `/removechild @user 2 — снять детей\n` +
            `/createpromo КОД 100 10 — создать промокод\n` +
            `/deletepromo КОД — удалить промокод\n` +
            `/promolist — список промокодов\n`;
        }
        
        // Подсчет доступных промокодов
        let promoText = '';
        let hasActive = false;
        for (const [code, pdata] of Object.entries(PROMOCODES)) {
          const remaining = pdata.maxUses - pdata.usedCount;
          if (remaining > 0) {
            promoText += `• ${code.toUpperCase()} — ${pdata.reward} 🧼 (осталось ${remaining})\n`;
            hasActive = true;
          }
        }
        
        if (!hasActive) {
          promoText = 'Нет активных промокодов\n';
        }
        
        await sendMessage(BOT_TOKEN, chatId,
          `🧼 *ОСТРОВ ЭПШТЕЙНА* 🏝️\n\nПривет, ${username}!\n\n` +
          `🎯 *КОМАНДЫ:*\n` +
          `/farm — фарм мыла (1-30, раз в час)\n` +
          `/balance — баланс\n` +
          `/top — топ по мылу\n` +
          `/children — мои дети\n` +
          `/topchildren — топ по детям\n` +
          `/buychild — купить ребенка (100 мыла)\n` +
          `/sendsoap @user 50 — перевести мыло\n` +
          `/sendchild @user 2 — перевести детей\n` +
          `/duel @user [ставка] — дуэль\n` +
          `/promo — ввести промокод\n` +
          adminCommands +
          `\n🎫 *АКТИВНЫЕ ПРОМОКОДЫ:*\n${promoText}\n` +
          `⚠️ Пидиди крадет мыло (5%)\n👶 1 ребенок = 100 мыла`
        );
      }
      
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).json({ ok: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};

async function loadData() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    const data = await res.json();
    return data.record;
  } catch (e) {
    return { users: {} };
  }
}

async function saveData(data) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
      body: JSON.stringify(data)
    });
  } catch (e) {}
}

async function sendMessage(token, chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function editMessage(token, chatId, messageId, text, keyboard = null) {
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function deleteMessage(token, chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

async function answerCallback(callbackId, text = null) {
  const body = { callback_query_id: callbackId };
  if (text) body.text = text;
  await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}
