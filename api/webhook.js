const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

const PIDIDI_STEAL_CHANCE = 5;
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

const CHILD_COST = 100;
const CHILD_INCOME = 3; // Каждый ребенок дает 3 мыла в час
const CHILD_INCOME_INTERVAL = 3600000; // 1 час в миллисекундах

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

// Проверка является ли пользователь админом (по ID или по группе)
const ADMIN_USER_ID = 6644638703;

async function isUserAdmin(botToken, chatId, userId) {
  if (userId === ADMIN_USER_ID) return true;
  
  if (chatId === ALLOWED_CHAT_ID) {
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
  return false;
}

// Функция для начисления пассивного дохода от детей
async function collectChildIncome(user, now) {
  if (!user.children || user.children === 0) return 0;
  if (!user.lastChildIncome) {
    user.lastChildIncome = now;
    return 0;
  }
  
  const hoursPassed = Math.floor((now - user.lastChildIncome) / CHILD_INCOME_INTERVAL);
  if (hoursPassed > 0) {
    const income = user.children * CHILD_INCOME * hoursPassed;
    user.balance += income;
    user.lastChildIncome = now;
    return income;
  }
  return 0;
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
        
        // ========== КАЗИНО ТРАМПА ==========
        else if (cbData.startsWith('casino_num_')) {
          const parts = cbData.split('_');
          const userNumber = parseInt(parts[2]);
          const bet = parseInt(parts[3]);
          
          const casinoNumber = Math.floor(Math.random() * 5) + 1;
          
          let data = await loadData();
          if (!data.users) data.users = {};
          
          let userData = data.users[userId] || { balance: 0, children: 0, username: username };
          
          if (userData.balance < bet) {
            await editMessage(BOT_TOKEN, chatId, messageId,
              `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
              `❌ ${username}, у тебя уже нет ${bet} мыла! Твой баланс: ${userData.balance} 🧼\n\nИгра отменена.`,
              null
            );
            await answerCallback(callback.id);
            return res.status(200).json({ ok: true });
          }
          
          const win = (userNumber === casinoNumber);
          let resultText = '';
          let newBalance = userData.balance;
          
          if (win) {
            const winAmount = bet * 2;
            newBalance = userData.balance + winAmount;
            resultText = 
              `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
              `🎲 Твоё число: ${userNumber}\n` +
              `🎲 Число казино: ${casinoNumber}\n\n` +
              `✨ *ТЫ ВЫИГРАЛ!* ✨\n` +
              `💰 +${winAmount} 🧼\n\n` +
              `📊 Твой баланс: ${newBalance} 🧼\n` +
              `👶 Детей: ${userData.children || 0}\n\n` +
              `🇺🇸 *Трамп говорит: YOU'RE WINNER!* 🦅`;
          } else {
            newBalance = userData.balance - bet;
            resultText = 
              `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
              `🎲 Твоё число: ${userNumber}\n` +
              `🎲 Число казино: ${casinoNumber}\n\n` +
              `💀 *ТЫ ПРОИГРАЛ!* 💀\n` +
              `💸 -${bet} 🧼\n\n` +
              `📊 Твой баланс: ${newBalance} 🧼\n` +
              `👶 Детей: ${userData.children || 0}\n\n` +
              `🇺🇸 *Трамп говорит: YOU'RE FIRED!* 🔥`;
          }
          
          userData.balance = newBalance;
          data.users[userId] = userData;
          await saveData(data);
          
          await editMessage(BOT_TOKEN, chatId, messageId, resultText, null);
          await answerCallback(callback.id);
        }
        
        else if (cbData === 'casino_cancel') {
          await editMessage(BOT_TOKEN, chatId, messageId,
            `🎰 *КАЗИНО ТРАМПА* 🎰\n\n❌ Игра отменена.\n\nВозвращайся поиграть! 🎲`,
            null      // ========== КАЗИНО ТРАМПА ==========
      else if (cleanText.startsWith('/casino')) {
        const parts = rawText.split(' ');
        
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, 
            `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
            `Использование: /casino [ставка] [число]\n\n` +
            `Ты ставишь мыло на число от 1 до 5\n` +
            `Компьютер выбирает случайное число\n` +
            `Если угадал — получаешь СТАВКА × 2\n` +
            `Если нет — ставка сгорает!\n\n` +
            `Пример: /casino 50 3\n\n` +
            `🍼 Детей ставить нельзя! Только мыло!`);
          return res.status(200).json({ ok: true });
        }
        
        const bet = parseInt(parts[1]);
        const userNumber = parseInt(parts[2]);
        
        if (isNaN(bet) || bet <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ставка должна быть положительным числом! Пример: /casino 50 3`);
          return res.status(200).json({ ok: true });
        }
        
        if (isNaN(userNumber) || userNumber < 1 || userNumber > 5) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, число должно быть от 1 до 5! Пример: /casino 50 3`);
          return res.status(200).json({ ok: true });
        }
        
        if (user.balance < bet) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, у тебя не хватает мыла! Есть: ${user.balance} 🧼, нужно: ${bet} 🧼`);
          return res.status(200).json({ ok: true });
        }
        
        // Генерируем случайное число от 1 до 5
        const casinoNumber = Math.floor(Math.random() * 5) + 1;
        const win = (userNumber === casinoNumber);
        
        let resultText = '';
        let newBalance = user.balance;
        
        if (win) {
          const winAmount = bet * 2;
          newBalance = user.balance + winAmount;
          resultText = 
            `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
            `🎲 Твоя ставка: ${bet} 🧼\n` +
            `🎲 Твоё число: ${userNumber}\n` +
            `🎲 Число казино: ${casinoNumber}\n\n` +
            `✨ *ТЫ ВЫИГРАЛ!* ✨\n` +
            `💰 +${winAmount} 🧼\n\n` +
            `📊 Твой баланс: ${newBalance} 🧼\n` +
            `👶 Детей: ${user.children || 0}\n\n` +
            `🇺🇸 *Трамп говорит: YOU'RE WINNER!* 🦅`;
        } else {
          newBalance = user.balance - bet;
          resultText = 
            `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
            `🎲 Твоя ставка: ${bet} 🧼\n` +
            `🎲 Твоё число: ${userNumber}\n` +
            `🎲 Число казино: ${casinoNumber}\n\n` +
            `💀 *ТЫ ПРОИГРАЛ!* 💀\n` +
            `💸 -${bet} 🧼\n\n` +
            `📊 Твой баланс: ${newBalance} 🧼\n` +
            `👶 Детей: ${user.children || 0}\n\n` +
            `🇺🇸 *Трамп говорит: YOU'RE FIRED!* 🔥`;
        }
        
        user.balance = newBalance;
        data.users[userId] = user;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId, resultText);
      }
      // Разрешенные чаты: только группа ИЛИ личка с админом
      const isAdminPrivate = (userId === ADMIN_USER_ID && update.message.chat.type === 'private');
      
      if (chatId !== ALLOWED_CHAT_ID && !isAdminPrivate) {
        await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${GROUP_INVITE_LINK}`);
        return res.status(200).json({ ok: true });
      }
      
      let data = await loadData();
      if (!data.users) data.users = {};
      
      let user = data.users[userId] || { 
        balance: 0, 
        children: 0, 
        username: username, 
        lastFarm: 0, 
        mutedUntil: 0,
        lastChildIncome: Date.now()
      };
      if (user.children === undefined) user.children = 0;
      if (!user.lastChildIncome) user.lastChildIncome = Date.now();
      
      // Загружаем промокоды из сохраненных данных
      if (data.promocodes) {
        PROMOCODES = data.promocodes;
      }
      
      // Начисляем пассивный доход от детей
      const now = Date.now();
      const childIncome = await collectChildIncome(user, now);
      if (childIncome > 0) {
        user.lastChildIncome = now;
        data.users[userId] = user;
        await saveData(data);
        // Не отправляем сообщение, чтобы не спамить, но можно раскомментировать если нужно
        // await sendMessage(BOT_TOKEN, chatId, `👶 Твои дети принесли +${childIncome} мыла!\n📊 Баланс: ${user.balance} 🧼`);
      }
      
      if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
        const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
        await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
        return res.status(200).json({ ok: true });
      }
      
      const isAdmin = await isUserAdmin(BOT_TOKEN, chatId, userId);
      
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /createpromo КОД 100 10`);
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
        
        data.promocodes = PROMOCODES;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId,
          `✅ *ПРОМОКОД СОЗДАН!* ✅\n\n` +
          `Код: ${code.toUpperCase()}\n` +
          `Награда: ${reward} 🧼\n` +
          `Макс активаций: ${maxUses}`);
      }
      
      else if (isAdmin && cleanText === '/promolist') {
        let reply = `📋 *СПИСОК ПРОМОКОДОВ* 📋\n\n`;
        if (Object.keys(PROMOCODES).length === 0) {
          reply += `Нет активных промокодов.`;
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
          await sendMessage(BOT_TOKEN, chatId, 
            `👶 ${username} купил ребенка!\n🧼 ${user.balance} мыла\n👶 ${user.children} детей\n\n📈 Каждый ребенок приносит ${CHILD_INCOME} мыла в час!`);
        } else {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${CHILD_COST}, есть ${user.balance}`);
        }
      }
      
      else if (cleanText === '/children') {
        const hourlyIncome = (user.children || 0) * CHILD_INCOME;
        await sendMessage(BOT_TOKEN, chatId, 
          `👶 *ДЕТИ ${username}* 👶\n\n` +
          `🧼 Мыла: ${user.balance}\n` +
          `👶 Детей: ${user.children}\n` +
          `📈 Пассивный доход: ${hourlyIncome} 🧼/час\n\n` +
          `/buychild - 100 мыла = 1 ребенок`);
      }
      
      else if (cleanText === '/topchildren') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
        if (sorted.length === 0 || sorted[0].children === 0) {
          await sendMessage(BOT_TOKEN, chatId, '👶 Топ детей пуст!');
        } else {
          let reply = '👶 ТОП ДЕТОВОДОВ 👶\n\n';
          sorted.forEach((u, i) => {
            if (u.children > 0) {
              const income = u.children * CHILD_INCOME;
              reply += `${i+1}. ${u.username} — ${u.children} 👶 (${income} 🧼/час)\n`;
            }
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/promo') {
        await sendMessage(BOT_TOKEN, chatId, 
          `🎫 *ВВЕДИ ПРОМОКОД*\n\nОтправь команду:\n/promo КОД\n\nПример: /promo SUPEREPSTAIN67\n\nℹ️ Промокоды публикуются в нашем канале. Следи за новостями!`);
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Промокод "${parts[1]}" больше не активен!`);
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
          `👶 Детей: ${user.children || 0}`);
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
      
      else if (cleanText === '/casino') {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, 
            `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
            `Использование: /casino [ставка]\n\n` +
            `Ты загадываешь число от 1 до 5\n` +
            `Компьютер тоже выбирает число\n` +
            `Если угадал — получаешь СТАВКА × 2\n` +
            `Если нет — ставка сгорает!\n\n` +
            `Пример: /casino 50\n\n` +
            `🍼 Детей ставить нельзя! Только мыло!`);
          return res.status(200).json({ ok: true });
        }
        
        const bet = parseInt(parts[1]);
        
        if (isNaN(bet) || bet <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ставка должна быть положительным числом! Пример: /casino 50`);
          return res.status(200).json({ ok: true });
        }
        
        if (user.balance < bet) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, у тебя не хватает мыла! Есть: ${user.balance} 🧼, нужно: ${bet} 🧼`);
          return res.status(200).json({ ok: true });
        }
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '1️⃣', callback_data: `casino_num_1_${bet}` },
              { text: '2️⃣', callback_data: `casino_num_2_${bet}` },
              { text: '3️⃣', callback_data: `casino_num_3_${bet}` },
              { text: '4️⃣', callback_data: `casino_num_4_${bet}` },
              { text: '5️⃣', callback_data: `casino_num_5_${bet}` }
            ],
            [
              { text: '❌ ОТМЕНА', callback_data: 'casino_cancel' }
            ]
          ]
        };
        
        await sendMessage(BOT_TOKEN, chatId,
          `🎰 *КАЗИНО ТРАМПА* 🎰\n\n` +
          `${username}, ты ставишь ${bet} 🧼\n\n` +
          `💰 При победе: +${bet * 2} 🧼\n` +
          `💀 При проигрыше: -${bet} 🧼\n\n` +
          `*Выбери число от 1 до 5:*`,
          keyboard
        );
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
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (user.lastFarm && (nowSeconds - user.lastFarm) < 3600) {
          const minutes = Math.ceil((3600 - (nowSeconds - user.lastFarm)) / 60);
          await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, жди ${minutes} мин!`);
        } else {
          const soap = Math.floor(Math.random() * 30) + 1;
          user.balance += soap;
          user.lastFarm = nowSeconds;
          user.username = username;
          
          let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей\n📈 Дети приносят ${user.children * CHILD_INCOME} 🧼/час\n/buychild - 100 мыла = ребенок`;
          
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
        const hourlyIncome = (user.children || 0) * CHILD_INCOME;
        await sendMessage(BOT_TOKEN, chatId, 
          `📊 *${username}*\n\n` +
          `🧼 Мыла: ${user.balance}\n` +
          `👶 Детей: ${user.children || 0}\n` +
          `📈 Пассивный доход: ${hourlyIncome} 🧼/час\n\n` +
          `/buychild - 100 мыла = ребенок`);
      }
      
      else if (cleanText === '/top') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
        let reply = '🏆 ТОП МЫЛА 🏆\n\n';
        sorted.forEach((u, i) => {
          const income = (u.children || 0) * CHILD_INCOME;
          reply += `${i+1}. ${u.username} — ${u.balance} 🧼 (${u.children || 0}👶, +${income}/ч)\n`;
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
          `/casino [ставка] — казино Трампа (x2 при победе)\n` +
          `/promo — ввести промокод\n` +
          adminCommands +
          `\n📈 *БОНУС:* Каждый ребенок приносит ${CHILD_INCOME} 🧼 в час!\n` +
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
