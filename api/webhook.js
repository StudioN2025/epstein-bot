const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

const PIDIDI_STEAL_CHANCE = 5;
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

const CHILD_COST = 100;

let duels = {};

function cleanCommand(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/@\w+/, '').trim();
}

// Проверка является ли пользователь админом группы
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
            
            const keyboard = {
              inline_keyboard: [[
                { text: `🎯 ПРИЦЕЛ (+10%) [${currentAim}/30]`, callback_data: `aim_${duelId}` },
                { text: `🔫 СБИТЬ`, callback_data: `break_${duelId}` }
              ], [
                { text: `💥 ВЫСТРЕЛ (${currentChance}%)`, callback_data: `shoot_${duelId}` }
              ]]
            };
            
            await editMessage(BOT_TOKEN, chatId, messageId,
              `⚔️ ДУЭЛЬ!\n${duel.player1Name} VS ${duel.player2Name}\nТочность: ${currentChance}%\nСтавка: 3 мыла\nХОД: ${currentPlayer}`,
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
            
            let data = await loadData();
            if (!data.users) data.users = {};
            
            let targetData = data.users[targetId] || { balance: 0, children: 0 };
            let shooterData = data.users[userId] || { balance: 0, children: 0 };
            
            resultText = `🎲 ${username} стреляет! Точность: ${hitChance}%, выпало: ${hitRoll.toFixed(1)}%\n\n`;
            
            if (hit) {
              resultText += `💥 ПОПАДАНИЕ!\n${username} попал в ${targetName}!\n`;
              
              if (targetData.balance < 3) {
                targetData.mutedUntil = Math.floor(Date.now() / 1000) + 60;
                targetData.balance = 0;
                resultText += `😵 У ${targetName} не было 3 мыла! МУТ 1 мин!`;
              } else {
                targetData.balance -= 3;
                shooterData.balance += 3;
                resultText += `🧼 ${username} забрал 3 мыла!\n📊 ${username}: ${shooterData.balance} 🧼, ${shooterData.children || 0} 👶\n📊 ${targetName}: ${targetData.balance} 🧼, ${targetData.children || 0} 👶`;
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
              `⚔️ ДУЭЛЬ!\n${duel.player1Name} VS ${duel.player2Name}\n${resultText}\nТочность ${nextName}: ${nextChance}%\nХОД: ${nextName}`,
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
      
      // Проверка мута
      if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
        const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
        await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
        return res.status(200).json({ ok: true });
      }
      
      // Проверка на админа группы
      const isAdmin = await isGroupAdmin(BOT_TOKEN, chatId, userId);
      
      // ========== АДМИН-КОМАНДЫ ==========
      
      // /addsoap @user 50 - добавить мыло (только админ)
      if (isAdmin && cleanText.startsWith('/addsoap')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, пример: /addsoap @username 50`);
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
        
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 🧼 пользователю @${targetUsername}\n📊 Теперь у него: ${targetUser.balance} 🧼`);
      }
      
      // /removesoap @user 50 - снять мыло (только админ)
      else if (isAdmin && cleanText.startsWith('/removesoap')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, пример: /removesoap @username 50`);
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
        
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 🧼 у пользователя @${targetUsername}\n📊 Теперь у него: ${targetUser.balance} 🧼`);
      }
      
      // /addchild @user 2 - добавить детей (только админ)
      else if (isAdmin && cleanText.startsWith('/addchild')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, пример: /addchild @username 2`);
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
        
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 👶 пользователю @${targetUsername}\n📊 Теперь у него: ${targetUser.children} 👶`);
      }
      
      // /removechild @user 2 - снять детей (только админ)
      else if (isAdmin && cleanText.startsWith('/removechild')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, пример: /removechild @username 2`);
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
        
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 👶 у пользователя @${targetUsername}\n📊 Теперь у него: ${targetUser.children} 👶`);
      }
      
      // /buychild
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
      
      // /children
      else if (cleanText === '/children') {
        await sendMessage(BOT_TOKEN, chatId, `👶 ДЕТИ ${username}:\n🧼 ${user.balance} мыла\n👶 ${user.children} детей\n/buychild - 100 мыла = 1 ребенок`);
      }
      
      // /topchildren
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
      
      // /sendsoap
      else if (cleanText.startsWith('/sendsoap')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, пример: /sendsoap @username 50`);
          return res.status(200).json({ ok: true });
        }
        
        let targetUsername = parts[1].replace('@', '');
        const amount = parseInt(parts[2]);
        
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, укажи положительное число!`);
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
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, не найден игрок @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        
        if (targetId === userId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, нельзя переводить мыло самому себе!`);
          return res.status(200).json({ ok: true });
        }
        
        let targetUser = data.users[targetId] || { balance: 0, children: 0, username: targetName };
        
        if (user.balance < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, не хватает мыла! Есть: ${user.balance}, нужно: ${amount}`);
          return res.status(200).json({ ok: true });
        }
        
        user.balance -= amount;
        targetUser.balance += amount;
        
        data.users[userId] = user;
        data.users[targetId] = targetUser;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, ch
