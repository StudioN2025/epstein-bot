const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

const PIDIDI_STEAL_CHANCE = 5;
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

const CHILD_COST = 100;
const CHILD_INCOME = 1;

// Кредитная система FPI Bank
const MAX_CREDIT_DAYS = 3; // 3 дня на возврат
const CREDIT_INTEREST_RATE = 10; // 1% в час
const CREDIT_PENALTY_MULTIPLIER = 2; // штраф х2
const MS_IN_DAY = 86400000; // миллисекунд в дне
const MAX_CREDIT_AMOUNT = 1000000000; // Максимальная сумма кредита

let duels = {};
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
      return false;
    }
  }
  return false;
}

async function collectChildIncome(user, now) {
  if (!user.children || user.children === 0) return 0;
  if (!user.lastChildIncome) {
    user.lastChildIncome = now;
    return 0;
  }
  const hoursPassed = Math.floor((now - user.lastChildIncome) / 3600000);
  if (hoursPassed > 0) {
    const income = user.children * CHILD_INCOME * hoursPassed;
    user.balance += income;
    user.lastChildIncome = now;
    return income;
  }
  return 0;
}

// Проверка и обработка кредитных обязательств
async function processCreditDebt(user, now) {
  if (!user.creditAmount || user.creditAmount <= 0) return 0;
  if (!user.creditStartTime) {
    user.creditStartTime = now;
    return 0;
  }
  
  const timePassed = now - user.creditStartTime;
  const daysPassed = timePassed / MS_IN_DAY;
  
  // Если просрочка больше 3 дней
  if (daysPassed > MAX_CREDIT_DAYS) {
    const penaltyAmount = user.creditAmount * CREDIT_PENALTY_MULTIPLIER;
    const remainingDebt = penaltyAmount - (user.creditPaid || 0);
    
    if (remainingDebt > 0) {
      if (user.balance >= remainingDebt) {
        user.balance -= remainingDebt;
        user.creditAmount = 0;
        user.creditStartTime = null;
        user.creditPaid = 0;
        return remainingDebt;
      } else {
        const taken = user.balance;
        user.balance = 0;
        user.creditPaid = (user.creditPaid || 0) + taken;
        return taken;
      }
    }
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
      
      const isAdminPrivate = (userId === ADMIN_USER_ID && update.message.chat.type === 'private');
      if (chatId !== ALLOWED_CHAT_ID && !isAdminPrivate) {
        await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${GROUP_INVITE_LINK}`);
        return res.status(200).json({ ok: true });
      }
      
      let data = await loadData();
      if (!data.users) data.users = {};
      
      let user = data.users[userId] || { 
        balance: 0, children: 0, username: username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        creditAmount: 0, creditStartTime: null, creditPaid: 0
      };
      if (user.children === undefined) user.children = 0;
      if (!user.lastChildIncome) user.lastChildIncome = Date.now();
      if (user.creditAmount === undefined) user.creditAmount = 0;
      if (user.creditPaid === undefined) user.creditPaid = 0;
      
      if (data.promocodes) PROMOCODES = data.promocodes;
      
      const now = Date.now();
      
      const childIncome = await collectChildIncome(user, now);
      if (childIncome > 0) {
        user.lastChildIncome = now;
        data.users[userId] = user;
        await saveData(data);
      }
      
      const debtTaken = await processCreditDebt(user, now);
      if (debtTaken > 0) {
        data.users[userId] = user;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, 
          `🏦 *FPI BANK - ПРОСРОЧКА* 🏦\n\n` +
          `⚠️ Вы не вернули кредит в срок!\n` +
          `💰 Списано ${debtTaken} 🧼 в счет погашения долга x${CREDIT_PENALTY_MULTIPLIER}\n\n` +
          `📊 Остаток долга: ${user.creditAmount - (user.creditPaid || 0)} 🧼`);
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Награда и количество должны быть положительными!`);
          return res.status(200).json({ ok: true });
        }
        PROMOCODES[code] = { reward: reward, maxUses: maxUses, usedCount: 0, usedBy: [] };
        data.promocodes = PROMOCODES;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Промокод ${code.toUpperCase()} создан! Награда: ${reward} 🧼, максимум: ${maxUses} активаций`);
      }
      else if (isAdmin && cleanText === '/promolist') {
        let reply = `📋 СПИСОК ПРОМОКОДОВ 📋\n\n`;
        if (Object.keys(PROMOCODES).length === 0) reply += `Нет промокодов.`;
        else {
          for (const [code, d] of Object.entries(PROMOCODES)) {
            reply += `🔸 ${code.toUpperCase()}\n   Награда: ${d.reward} 🧼\n   Активаций: ${d.usedCount}/${d.maxUses}\n\n`;
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
      
      // АДМИН-КОМАНДА ДЛЯ СБРОСА КРЕДИТА
      else if (isAdmin && cleanText.startsWith('/resetcredit')) {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /resetcredit @username`);
          return res.status(200).json({ ok: true });
        }
        
        let targetUsername = parts[1].replace('@', '');
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
        
        let targetUser = data.users[targetId];
        if (!targetUser) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пользователь не найден в базе!`);
          return res.status(200).json({ ok: true });
        }
        
        targetUser.creditAmount = 0;
        targetUser.creditStartTime = null;
        targetUser.creditPaid = 0;
        data.users[targetId] = targetUser;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} сбросил кредит пользователю @${targetUsername}\n📊 Теперь у него нет активного кредита!`);
      }
      
      // ========== КРЕДИТ FPI BANK ==========
      else if (cleanText.startsWith('/credit')) {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, 
            `🏦 *FPI BANK - КРЕДИТЫ* 🏦\n\n` +
            `Взять кредит: /credit [сумма]\n` +
            `Вернуть кредит: /returncredit [сумма]\n` +
            `Мой кредит: /mycredit\n\n` +
            `📊 *Условия:*\n` +
            `• Процент: ${CREDIT_INTEREST_RATE}% в час\n` +
            `• Срок: ${MAX_CREDIT_DAYS} дня\n` +
            `• Макс сумма: ${MAX_CREDIT_AMOUNT} 🧼\n` +
            `• При невозврате: штраф x${CREDIT_PENALTY_MULTIPLIER}\n` +
            `• За неуплату отбирают весь доход до погашения долга`);
          return res.status(200).json({ ok: true });
        }
        
        const amount = parseInt(parts[1]);
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Сумма кредита должна быть положительным числом!`);
          return res.status(200).json({ ok: true });
        }
        
        if (amount > MAX_CREDIT_AMOUNT) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Максимальная сумма кредита: ${MAX_CREDIT_AMOUNT} 🧼\nВы запросили: ${amount} 🧼`);
          return res.status(200).json({ ok: true });
        }
        
        if (user.creditAmount && user.creditAmount > 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У вас уже есть активный кредит! Погасите его через /returncredit или /mycredit`);
          return res.status(200).json({ ok: true });
        }
        
        user.creditAmount = amount;
        user.creditStartTime = Date.now();
        user.creditPaid = 0;
        user.balance += amount;
        data.users[userId] = user;
        await saveData(data);
        
        const totalFor3Days = Math.floor(amount * (1 + (CREDIT_INTEREST_RATE / 100) * 24 * MAX_CREDIT_DAYS));
        
        await sendMessage(BOT_TOKEN, chatId,
          `🏦 *FPI BANK - КРЕДИТ ОДОБРЕН* 🏦\n\n` +
          `✅ Кредит ${amount} 🧼 выдан!\n` +
          `📊 Ваш баланс: ${user.balance} 🧼\n\n` +
          `⚠️ *Условия возврата:*\n` +
          `• Процент: ${CREDIT_INTEREST_RATE}% в час\n` +
          `• Срок: ${MAX_CREDIT_DAYS} дня\n` +
          `• Если вернете через ${MAX_CREDIT_DAYS} дня: ${totalFor3Days} 🧼\n\n` +
          `💰 /returncredit [сумма] - вернуть кредит\n` +
          `📋 /mycredit - информация о кредите`);
      }
      
      else if (cleanText.startsWith('/returncredit')) {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /returncredit 50\nВернуть весь кредит: /returncredit all`);
          return res.status(200).json({ ok: true });
        }
        
        if (!user.creditAmount || user.creditAmount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У вас нет активного кредита!`);
          return res.status(200).json({ ok: true });
        }
        
        const timePassed = Date.now() - user.creditStartTime;
        const hoursPassed = timePassed / 3600000;
        const totalDebt = Math.floor(user.creditAmount * (1 + (CREDIT_INTEREST_RATE / 100) * hoursPassed));
        const remainingDebt = totalDebt - (user.creditPaid || 0);
        
        let returnAmount = 0;
        if (parts[1].toLowerCase() === 'all') {
          returnAmount = remainingDebt;
        } else {
          returnAmount = parseInt(parts[1]);
          if (isNaN(returnAmount) || returnAmount <= 0) {
            await sendMessage(BOT_TOKEN, chatId, `❌ Сумма должна быть положительным числом или "all"!`);
            return res.status(200).json({ ok: true });
          }
        }
        
        if (returnAmount > remainingDebt) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Вы пытаетесь вернуть больше чем должны! Долг: ${remainingDebt} 🧼`);
          return res.status(200).json({ ok: true });
        }
        
        if (user.balance < returnAmount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Есть: ${user.balance}, нужно: ${returnAmount}`);
          return res.status(200).json({ ok: true });
        }
        
        user.balance -= returnAmount;
        user.creditPaid = (user.creditPaid || 0) + returnAmount;
        
        const newRemainingDebt = totalDebt - user.creditPaid;
        
        if (newRemainingDebt <= 0) {
          user.creditAmount = 0;
          user.creditStartTime = null;
          user.creditPaid = 0;
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId,
            `🏦 *FPI BANK - КРЕДИТ ПОГАШЕН* 🏦\n\n` +
            `✅ Кредит полностью погашен!\n` +
            `📊 Ваш баланс: ${user.balance} 🧼\n\n` +
            `🎉 Спасибо за доверие! Приходите за новым кредитом!`);
        } else {
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId,
            `🏦 *FPI BANK - ЧАСТИЧНОЕ ПОГАШЕНИЕ* 🏦\n\n` +
            `✅ Возвращено: ${returnAmount} 🧼\n` +
            `📊 Ваш баланс: ${user.balance} 🧼\n` +
            `💰 Остаток долга: ${newRemainingDebt} 🧼\n\n` +
            `/returncredit all - погасить полностью`);
        }
      }
      
      else if (cleanText === '/mycredit') {
        if (!user.creditAmount || user.creditAmount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `📋 У вас нет активного кредита. Взять: /credit [сумма]`);
          return res.status(200).json({ ok: true });
        }
        
        const timePassed = Date.now() - user.creditStartTime;
        const hoursPassed = timePassed / 3600000;
        const daysPassed = timePassed / MS_IN_DAY;
        const totalDebt = Math.floor(user.creditAmount * (1 + (CREDIT_INTEREST_RATE / 100) * hoursPassed));
        const remainingDebt = totalDebt - (user.creditPaid || 0);
        const timeLeft = MAX_CREDIT_DAYS - daysPassed;
        
        let statusText = '';
        if (timeLeft <= 0) {
          statusText = `🔴 *ПРОСРОЧЕНО!* Штраф x${CREDIT_PENALTY_MULTIPLIER}`;
        } else {
          statusText = `🟢 Осталось: ${timeLeft.toFixed(1)} дня`;
        }
        
        await sendMessage(BOT_TOKEN, chatId,
          `🏦 *FPI BANK - ИНФОРМАЦИЯ О КРЕДИТЕ* 🏦\n\n` +
          `💰 Сумма кредита: ${user.creditAmount} 🧼\n` +
          `📈 Процент: ${CREDIT_INTEREST_RATE}% в час\n` +
          `⏱ Прошло: ${hoursPassed.toFixed(1)} часов\n` +
          `📊 Общий долг: ${totalDebt} 🧼\n` +
          `💸 Выплачено: ${user.creditPaid || 0} 🧼\n` +
          `⚠️ Остаток долга: ${remainingDebt} 🧼\n` +
          `⏰ ${statusText}\n\n` +
          `/returncredit [сумма] - погасить часть\n` +
          `/returncredit all - погасить полностью`);
      }
      
      // ========== ОБЫЧНЫЕ КОМАНДЫ ==========
      else if (cleanText === '/buychild') {
        if (user.balance >= CHILD_COST) {
          user.balance -= CHILD_COST;
          user.children += 1;
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId, `👶 ${username} купил ребенка!\n🧼 ${user.balance} мыла\n👶 ${user.children} детей\n📈 Каждый ребенок приносит ${CHILD_INCOME} мыло в час!`);
        } else {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${CHILD_COST}, есть ${user.balance}`);
        }
      }
      
      else if (cleanText === '/children') {
        const hourlyIncome = (user.children || 0) * CHILD_INCOME;
        await sendMessage(BOT_TOKEN, chatId, `👶 *ДЕТИ ${username}* 👶\n\n🧼 Мыла: ${user.balance}\n👶 Детей: ${user.children}\n📈 Пассивный доход: ${hourlyIncome} 🧼/час\n\n/buychild - 100 мыла = 1 ребенок`);
      }
      
      else if (cleanText === '/top') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
        
        if (sorted.length === 0 || sorted[0].balance === 0) {
          await sendMessage(BOT_TOKEN, chatId, '🏆 Топ пуст! Нафарми мыло первым 🧼');
        } else {
          let reply = '🏆 *ТОП МЫЛА НА ОСТРОВЕ* 🏆\n\n';
          sorted.forEach((u, i) => {
            const childIncome = (u.children || 0) * CHILD_INCOME;
            reply += `${i+1}. ${u.username} — ${u.balance} 🧼 (👶 ${u.children || 0}, +${childIncome}/ч)\n`;
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/topchildren') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
        
        if (sorted.length === 0 || sorted[0].children === 0) {
          await sendMessage(BOT_TOKEN, chatId, '👶 Топ детей пуст! Купи ребенка через /buychild');
        } else {
          let reply = '👶 *ТОП ДЕТОВОДОВ* 👶\n\n';
          sorted.forEach((u, i) => {
            if (u.children > 0) {
              reply += `${i+1}. ${u.username} — ${u.children} 👶 (${u.children * CHILD_INCOME} 🧼/ч)\n`;
            }
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/promo') {
        await sendMessage(BOT_TOKEN, chatId, `🎫 ВВЕДИ ПРОМОКОД\n\nОтправь: /promo КОД\n\nПример: /promo SUPEREPSTAIN67`);
      }
      
      else if (cleanText.startsWith('/promo ')) {
        const parts = rawText.split(' ');
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
        await sendMessage(BOT_TOKEN, chatId, `🎉 ПРОМОКОД АКТИВИРОВАН!\nКод: ${parts[1].toUpperCase()}\n+${promo.reward} 🧼\n📊 Баланс: ${user.balance} 🧼`);
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
        await sendMessage(BOT_TOKEN, chatId, `💰 ПЕРЕВОД МЫЛА\nОт: ${username}\nКому: @${targetName}\nСумма: ${amount} 🧼\n\n📊 У ${username} осталось: ${user.balance} 🧼\n📊 У @${targetName} теперь: ${targetUser.balance} 🧼`);
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
        await sendMessage(BOT_TOKEN, chatId, `👶 ПЕРЕВОД ДЕТЕЙ\nОт: ${username}\nКому: @${targetName}\nКоличество: ${amount} 👶\n\n📊 У ${username} осталось: ${user.children} 👶\n📊 У @${targetName} теперь: ${targetUser.children} 👶`);
      }
      
      else if (cleanText.startsWith('/casino')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `🎰 КАЗИНО ТРАМПА 🎰\n\nИспользование: /casino [ставка] [число]\n\nПример: /casino 50 3\nСтавишь 50 мыла на число 3. При победе получаешь x2!`);
          return res.status(200).json({ ok: true });
        }
        const bet = parseInt(parts[1]);
        const userNumber = parseInt(parts[2]);
        if (isNaN(bet) || bet <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Ставка должна быть положительным числом!`);
          return res.status(200).json({ ok: true });
        }
        if (isNaN(userNumber) || userNumber < 1 || userNumber > 5) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Число должно быть от 1 до 5!`);
          return res.status(200).json({ ok: true });
        }
        if (user.balance < bet) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Есть: ${user.balance}, нужно: ${bet}`);
          return res.status(200).json({ ok: true });
        }
        const casinoNumber = Math.floor(Math.random() * 5) + 1;
        const win = (userNumber === casinoNumber);
        let newBalance = user.balance;
        let resultText = `🎰 КАЗИНО ТРАМПА 🎰\n\n🎲 Ставка: ${bet} 🧼\n🎲 Твоё число: ${userNumber}\n🎲 Число казино: ${casinoNumber}\n\n`;
        if (win) {
          const winAmount = bet * 2;
          newBalance = user.balance + winAmount;
          resultText += `✨ ТЫ ВЫИГРАЛ! ✨\n💰 +${winAmount} 🧼\n\n📊 Баланс: ${newBalance} 🧼\n\n🇺🇸 Трамп говорит: YOU'RE WINNER! 🦅`;
        } else {
          newBalance = user.balance - bet;
          resultText += `💀 ТЫ ПРОИГРАЛ! 💀\n💸 -${bet} 🧼\n\n📊 Баланс: ${newBalance} 🧼\n\n🇺🇸 Трамп говорит: YOU'RE FIRED! 🔥`;
        }
        user.balance = newBalance;
        data.users[userId] = user;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, resultText);
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
          if (!isNaN(parsedBet) && parsedBet > 0) bet = parsedBet;
          else {
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
        duels[duelId] = { id: duelId, player1Id: userId, player1Name: username, player2Id: opponentId, player2Name: opponentName, bet: bet, status: 'waiting', turn: null, aim1: 0, aim2: 0 };
        const keyboard = { inline_keyboard: [[{ text: `⚔️ ПРИНЯТЬ ДУЭЛЬ (ставка ${bet} 🧼)`, callback_data: `accept_${duelId}` }, { text: '❌ ОТМЕНА', callback_data: 'cancel' }]] };
        await sendMessage(BOT_TOKEN, chatId, `⚔️ ДУЭЛЬ!\n${username} вызывает @${opponentName}!\n💰 СТАВКА: ${bet} 🧼\n⏳ 60 секунд на принятие!`, keyboard);
        setTimeout(() => { if (duels[duelId] && duels[duelId].status === 'waiting') { delete duels[duelId]; sendMessage(BOT_TOKEN, chatId, `⏰ Дуэль отменена`); } }, 60000);
      }
      
      else if (cleanText === '/farm') {
        const nowSec = Math.floor(Date.now() / 1000);
        if (user.lastFarm && (nowSec - user.lastFarm) < 3600) {
          const minutes = Math.ceil((3600 - (nowSec - user.lastFarm)) / 60);
          await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, жди ${minutes} мин!`);
        } else {
          const soap = Math.floor(Math.random() * 30) + 1;
          user.balance += soap;
          user.lastFarm = nowSec;
          user.username = username;
          let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей\n📈 Дети приносят ${user.children * CHILD_INCOME} 🧼/час`;
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
        let creditInfo = '';
        if (user.creditAmount && user.creditAmount > 0) {
          const timePassed = Date.now() - user.creditStartTime;
          const hoursPassed = timePassed / 3600000;
          const totalDebt = Math.floor(user.creditAmount * (1 + (CREDIT_INTEREST_RATE / 100) * hoursPassed));
          const remainingDebt = totalDebt - (user.creditPaid || 0);
          creditInfo = `\n\n🏦 *Активный кредит:* ${remainingDebt} 🧼\n/returncredit - погасить`;
        }
        
        const hourlyIncome = (user.children || 0) * CHILD_INCOME;
        await sendMessage(BOT_TOKEN, chatId, `📊 *${username}*\n\n🧼 Мыла: ${user.balance}\n👶 Детей: ${user.children || 0}\n📈 Пассивный доход: ${hourlyIncome} 🧼/час${creditInfo}\n\n/buychild - 100 мыла = ребенок`);
      }
      
      else if (cleanText === '/start') {
        let adminCommands = '';
        if (isAdmin) {
          adminCommands = `\n\n👑 *АДМИН-КОМАНДЫ:*\n` +
            `/addsoap @user 50\n` +
            `/removesoap @user 50\n` +
            `/addchild @user 2\n` +
            `/removechild @user 2\n` +
            `/createpromo КОД 100 10\n` +
            `/deletepromo КОД\n` +
            `/promolist\n` +
            `/resetcredit @user\n`;
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
          `/casino [ставка] [число] — казино (x2 при победе)\n` +
          `/promo — ввести промокод\n` +
          `/credit [сумма] — взять кредит (макс ${MAX_CREDIT_AMOUNT} 🧼)\n` +
          `/returncredit [сумма/all] — вернуть кредит\n` +
          `/mycredit — информация о кредите` +
          adminCommands +
          `\n\n📈 Каждый ребенок приносит ${CHILD_INCOME} 🧼 в час!\n` +
          `⚠️ Пидиди крадет мыло (5%)\n👶 1 ребенок = 100 мыла\n` +
          `🏦 FPI Bank: кредит ${CREDIT_INTEREST_RATE}% в час, срок ${MAX_CREDIT_DAYS} дня`);
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
