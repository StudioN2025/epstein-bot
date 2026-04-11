const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

const PIDIDI_STEAL_CHANCE = 5;
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

const CHILD_COST = 100;
const CHILD_INCOME = 1;

// Система подвалов Стивена Хокинга
const BASEMENT_COST = 500;
const CHILDREN_PER_BASEMENT = 10;

// Ивент СВО
const EVENT_END = new Date('2026-04-18T00:00:00+03:00').getTime();
const MOBILIZATION_COST = 50;
const BASEMENT_CAPTURE_REWARD = 10;
const FREE_COST = 200;

// Ядерная бомба (секретно!)
const NUKE_PRICE = 15000;
const NUKE_ACTIVATE_DATE = new Date('2026-04-23T00:00:00+03:00').getTime();

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

async function collectCapturedBasementsIncome(user, now) {
  if (!user.capturedBasements || user.capturedBasements === 0) return 0;
  if (!user.lastCapturedIncome) {
    user.lastCapturedIncome = now;
    return 0;
  }
  const hoursPassed = Math.floor((now - user.lastCapturedIncome) / 3600000);
  if (hoursPassed > 0) {
    const income = user.capturedBasements * BASEMENT_CAPTURE_REWARD * hoursPassed;
    user.balance += income;
    user.lastCapturedIncome = now;
    return income;
  }
  return 0;
}

function addCapturedBasement(user, ownerId, ownerName) {
  if (!user.capturedBasementsDetails) user.capturedBasementsDetails = [];
  
  const existing = user.capturedBasementsDetails.find(c => c.ownerId === ownerId);
  if (existing) {
    existing.count++;
  } else {
    user.capturedBasementsDetails.push({
      ownerId: ownerId,
      owner: ownerName,
      count: 1
    });
  }
  user.capturedBasements = (user.capturedBasements || 0) + 1;
}

function removeCapturedBasement(user, ownerId, amount = 1) {
  if (!user.capturedBasementsDetails) return 0;
  
  const existing = user.capturedBasementsDetails.find(c => c.ownerId === ownerId);
  if (existing) {
    const removed = Math.min(existing.count, amount);
    existing.count -= removed;
    user.capturedBasements = (user.capturedBasements || 0) - removed;
    
    if (existing.count <= 0) {
      user.capturedBasementsDetails = user.capturedBasementsDetails.filter(c => c.ownerId !== ownerId);
    }
    return removed;
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
            let targetData = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
            let shooterData = data.users[userId] || { balance: 0, children: 0, basements: 0 };
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
                resultText += `🧼 ${username} забрал ${bet} мыла!\n📊 ${username}: ${shooterData.balance} 🧼, ${shooterData.children || 0} 👶, ${shooterData.basements || 0} 🏚️\n📊 ${targetName}: ${targetData.balance} 🧼, ${targetData.children || 0} 👶, ${targetData.basements || 0} 🏚️`;
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
        balance: 0, children: 0, basements: 0, username: username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now(),
        nukes: 0
      };
      if (user.children === undefined) user.children = 0;
      if (user.basements === undefined) user.basements = 0;
      if (user.mobilized === undefined) user.mobilized = 0;
      if (user.capturedBasements === undefined) user.capturedBasements = 0;
      if (!user.capturedBasementsDetails) user.capturedBasementsDetails = [];
      if (user.nukes === undefined) user.nukes = 0;
      if (!user.lastChildIncome) user.lastChildIncome = Date.now();
      if (!user.lastCapturedIncome) user.lastCapturedIncome = Date.now();
      
      if (data.promocodes) PROMOCODES = data.promocodes;
      
      const now = Date.now();
      
      const childIncome = await collectChildIncome(user, now);
      if (childIncome > 0) {
        user.lastChildIncome = now;
        data.users[userId] = user;
        await saveData(data);
      }
      
      const capturedIncome = await collectCapturedBasementsIncome(user, now);
      if (capturedIncome > 0) {
        user.lastCapturedIncome = now;
        data.users[userId] = user;
        await saveData(data);
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
        targetUser.children = Math.max(0, (targetUser.children || 0) - amount);
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 👶 у @${targetUsername}\n📊 Теперь: ${targetUser.children} 👶`);
      }
      else if (isAdmin && cleanText.startsWith('/addbasement')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /addbasement @username 2`);
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
        targetUser.basements = (targetUser.basements || 0) + amount;
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} 🏚️ @${targetUsername}\n📊 Теперь: ${targetUser.basements} 🏚️`);
      }
      else if (isAdmin && cleanText.startsWith('/removebasement')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /removebasement @username 2`);
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0 };
        targetUser.basements = Math.max(0, (targetUser.basements || 0) - amount);
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} 🏚️ у @${targetUsername}\n📊 Теперь: ${targetUser.basements} 🏚️`);
      }
      else if (isAdmin && cleanText.startsWith('/addmobilized')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /addmobilized @username 2`);
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, mobilized: 0 };
        targetUser.mobilized = (targetUser.mobilized || 0) + amount;
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} добавил ${amount} ⚔️ мобилизованных @${targetUsername}\n📊 Теперь: ${targetUser.mobilized} ⚔️`);
      }
      else if (isAdmin && cleanText.startsWith('/removemobilized')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ /removemobilized @username 2`);
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, mobilized: 0 };
        targetUser.mobilized = Math.max(0, (targetUser.mobilized || 0) - amount);
        targetUser.username = targetUsername;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `✅ Админ ${username} снял ${amount} ⚔️ мобилизованных у @${targetUsername}\n📊 Теперь: ${targetUser.mobilized} ⚔️`);
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
      
      // ========== ПОДВАЛЫ СТИВЕНА ХОКИНГА ==========
      else if (cleanText === '/basements') {
        const userBasements = user.basements || 0;
        const userChildren = user.children || 0;
        const maxChildrenPossible = userBasements * CHILDREN_PER_BASEMENT;
        const canBuyNewChild = userChildren < maxChildrenPossible;
        const remainingSlots = maxChildrenPossible - userChildren;
        
        let statusEmoji = canBuyNewChild ? '✅' : '❌';
        let statusText = canBuyNewChild ? `Можно купить еще ${remainingSlots} детей` : 'Нет свободных мест!';
        
        await sendMessage(BOT_TOKEN, chatId,
          `🏚️ *ПОДВАЛЫ СТИВЕНА ХОКИНГА* 🏚️\n\n` +
          `🧼 Цена одного подвала: ${BASEMENT_COST} мыла\n` +
          `📊 Твои подвалы: ${userBasements}\n` +
          `👶 Твои обычные дети: ${userChildren}\n` +
          `🏚️ 1 подвал = ${CHILDREN_PER_BASEMENT} детей\n` +
          `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
          `📌 Свободных мест: ${remainingSlots}\n` +
          `📌 Статус: ${statusEmoji} ${statusText}\n\n` +
          `${canBuyNewChild ? '✅ Ты можешь купить ребенка! /buychild' : '❌ Тебе нужно больше подвалов! /buybasement'}\n\n` +
          `/buybasement [количество] — купить подвалы (${BASEMENT_COST} 🧼/шт)`);
      }
      
      else if (cleanText.startsWith('/buybasement')) {
        let amount = 1;
        const parts = rawText.split(' ');
        if (parts.length >= 2) {
          const parsedAmount = parseInt(parts[1]);
          if (!isNaN(parsedAmount) && parsedAmount > 0) {
            amount = parsedAmount;
          } else {
            await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /buybasement 5`);
            return res.status(200).json({ ok: true });
          }
        }
        
        const totalCost = BASEMENT_COST * amount;
        
        if (user.balance >= totalCost) {
          user.balance -= totalCost;
          user.basements = (user.basements || 0) + amount;
          data.users[userId] = user;
          await saveData(data);
          
          const maxChildrenPossible = (user.basements || 0) * CHILDREN_PER_BASEMENT;
          const remainingSlots = maxChildrenPossible - (user.children || 0);
          
          let message = `🏚️ ${username} купил ${amount} подвал(ов) у Стивена Хокинга!\n\n` +
            `🧼 -${totalCost} мыла\n` +
            `🏚️ Всего подвалов: ${user.basements}\n` +
            `👶 Обычных детей: ${user.children || 0}\n` +
            `📌 Теперь можно иметь до ${maxChildrenPossible} обычных детей\n` +
            `📌 Свободных мест: ${remainingSlots}\n\n`;
          
          if (remainingSlots > 0) {
            message += `✅ Ты можешь купить ребенка! /buychild [количество]`;
          } else {
            message += `⚠️ Нужно больше подвалов для новых детей`;
          }
          
          await sendMessage(BOT_TOKEN, chatId, message);
        } else {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! ${amount} подвал(ов) стоят ${totalCost} 🧼\nУ тебя: ${user.balance} 🧼`);
        }
      }
      
      // ========== ИВЕНТ СВО ==========
      else if (cleanText === '/svo') {
        const nowTime = Date.now();
        if (nowTime > EVENT_END) {
          await sendMessage(BOT_TOKEN, chatId, `⚔️ *СВО ЗАВЕРШЕНО!* ⚔️\n\nИвент закончился 18 апреля 2026.\nСледующий ивент будет позже!`);
          return res.status(200).json({ ok: true });
        }
        
        const timeLeft = EVENT_END - nowTime;
        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        await sendMessage(BOT_TOKEN, chatId,
          `⚔️ *СВО НА ОСТРОВЕ!* ⚔️\n\n` +
          `📅 Ивент до: 18 апреля 2026, 00:00\n` +
          `⏰ Осталось: ${daysLeft} д ${hoursLeft} ч\n\n` +
          `🎯 *Механика:*\n` +
          `• Обычные дети сидят в подвалах и приносят доход (${CHILD_INCOME} 🧼/час)\n` +
          `• Мобилизуй детей за ${MOBILIZATION_COST} 🧼 — они пойдут в армию\n` +
          `• Мобилизованные дети могут АТАКОВАТЬ и ЗАЩИЩАТЬ\n` +
          `• 10 мобилизованных детей = захват 1 подвала\n` +
          `• Захваченный подвал приносит ${BASEMENT_CAPTURE_REWARD} 🧼/час\n` +
          `• Освободить свой подвал: /free @user [количество] (${FREE_COST} 🧼/шт)\n` +
          `• При атаке можно перехватить захваченные подвалы\n\n` +
          `/mobilize [количество] — мобилизовать детей\n` +
          `/attack @user [количество] — атаковать\n` +
          `/free @user [количество] — освободить свои подвалы\n` +
          `/myarmy — моя армия\n` +
          `/mycaptured — мои захваченные подвалы`);
      }
      
      else if (cleanText.startsWith('/mobilize')) {
        const nowTime = Date.now();
        if (nowTime > EVENT_END) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Ивент СВО завершен! Мобилизация больше недоступна.`);
          return res.status(200).json({ ok: true });
        }
        
        let amount = 1;
        const parts = rawText.split(' ');
        if (parts.length >= 2) {
          const parsedAmount = parseInt(parts[1]);
          if (!isNaN(parsedAmount) && parsedAmount > 0) {
            amount = parsedAmount;
          } else {
            await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /mobilize 5`);
            return res.status(200).json({ ok: true });
          }
        }
        
        const availableChildren = user.children || 0;
        if (availableChildren < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ${amount} обычных детей для мобилизации! У тебя: ${availableChildren} 👶\n\nМобилизовать можно только обычных детей, которые не в армии.`);
          return res.status(200).json({ ok: true });
        }
        
        const totalCost = MOBILIZATION_COST * amount;
        if (user.balance < totalCost) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла для мобилизации! Нужно: ${totalCost} 🧼, есть: ${user.balance} 🧼`);
          return res.status(200).json({ ok: true });
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
      }
      
      else if (cleanText.startsWith('/attack')) {
        const nowTime = Date.now();
        if (nowTime > EVENT_END) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Ивент СВО завершен! Атаки больше недоступны.`);
          return res.status(200).json({ ok: true });
        }
        
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /attack @username 5`);
          return res.status(200).json({ ok: true });
        }
        
        let targetUsername = parts[1].replace('@', '');
        let amount = parseInt(parts[2]);
        
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /attack @username 5`);
          return res.status(200).json({ ok: true });
        }
        
        if ((user.mobilized || 0) < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У тебя мобилизовано только ${user.mobilized || 0} детей! Нужно: ${amount}`);
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
        
        if (!targetId || targetId === userId) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername} или это ты сам!`);
          return res.status(200).json({ ok: true });
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
        
        // Сначала отбиваем свои подвалы, если они есть у цели
        if (targetUser.capturedBasementsDetails && targetUser.capturedBasementsDetails.length > 0) {
          const myCapturedFromTarget = targetUser.capturedBasementsDetails.find(c => c.ownerId === userId);
          if (myCapturedFromTarget && myCapturedFromTarget.count > 0) {
            const canRecapture = Math.min(myCapturedFromTarget.count, Math.floor(attackers / CHILDREN_PER_BASEMENT));
            if (canRecapture > 0) {
              recapturedBasements = canRecapture;
              const removed = removeCapturedBasement(targetUser, userId, canRecapture);
              if (removed > 0) {
                attackers -= removed * CHILDREN_PER_BASEMENT;
                user.basements = (user.basements || 0) + removed;
                message += `🔄 *ВОЗВРАЩЕНЫ СВОИ ПОДВАЛЫ!* 🔄\n` +
                  `🏚️ Возвращено подвалов: ${removed}\n\n`;
              }
            }
          }
        }
        
        if (attackers > defenders) {
          // Победа
          const survivors = attackers - defenders;
          killedAttackers = defenders;
          killedDefenders = defenders;
          
          message += `🗡️ Убито защитников: ${killedDefenders}\n` +
            `💀 Потери атакующих: ${killedAttackers}\n\n`;
          
          // Захват подвалов оставшимися атакующими
          if (survivors > 0) {
            const targetBasements = targetUser.basements || 0;
            capturedBasements = Math.min(Math.floor(survivors / CHILDREN_PER_BASEMENT), targetBasements);
            
            if (capturedBasements > 0) {
              targetUser.basements = targetBasements - capturedBasements;
              for (let i = 0; i < capturedBasements; i++) {
                addCapturedBasement(user, targetId, targetName);
              }
              
              const remainingAttackers = survivors % CHILDREN_PER_BASEMENT;
              message += `💥 *ЗАХВАТ ПОДВАЛОВ!* 💥\n` +
                `🏚️ Захвачено подвалов: ${capturedBasements}\n` +
                `💰 Каждый захваченный подвал приносит ${BASEMENT_CAPTURE_REWARD} 🧼/час!\n`;
              
              if (remainingAttackers > 0) {
                message += `\n⚔️ Осталось атакующих: ${remainingAttackers} (возвращаются домой)`;
              }
            } else {
              message += `❌ У ${targetName} нет подвалов для захвата!\n` +
                `\n⚔️ Осталось атакующих: ${survivors} (возвращаются домой)`;
            }
          }
        } else {
          // Поражение
          killedAttackers = attackers;
          killedDefenders = attackers;
          
          message += `🛡️ *АТАКА ОТБИТА!* 🛡️\n` +
            `🗡️ Убито защитников: ${killedDefenders}\n` +
            `💀 Потери атакующих: ${killedAttackers}\n` +
            `❌ Не удалось захватить ни одного подвала!\n\n` +
            `🏚️ У ${targetName} осталось подвалов: ${targetUser.basements || 0}`;
        }
        
        // Обновляем мобилизованных
        user.mobilized = (user.mobilized || 0) - killedAttackers;
        if (user.mobilized < 0) user.mobilized = 0;
        
        targetUser.mobilized = (targetUser.mobilized || 0) - killedDefenders;
        if (targetUser.mobilized < 0) targetUser.mobilized = 0;
        
        data.users[userId] = user;
        data.users[targetId] = targetUser;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId, message);
      }
      
      else if (cleanText.startsWith('/free')) {
        const nowTime = Date.now();
        if (nowTime > EVENT_END) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Ивент СВО завершен! Освобождение больше недоступно.`);
          return res.status(200).json({ ok: true });
        }
        
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /free @username 2\nОсвободить свои подвалы, захваченные этим пользователем`);
          return res.status(200).json({ ok: true });
        }
        
        let targetUsername = parts[1].replace('@', '');
        let amount = parseInt(parts[2]);
        
        if (isNaN(amount) || amount <= 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /free @username 2`);
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        
        let targetUser = data.users[targetId];
        if (!targetUser || !targetUser.capturedBasementsDetails) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У @${targetName} нет твоих захваченных подвалов!`);
          return res.status(200).json({ ok: true });
        }
        
        const myCaptured = targetUser.capturedBasementsDetails.find(c => c.ownerId === userId);
        if (!myCaptured || myCaptured.count === 0) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У @${targetName} нет твоих захваченных подвалов!`);
          return res.status(200).json({ ok: true });
        }
        
        const canFree = Math.min(amount, myCaptured.count);
        const totalCost = FREE_COST * canFree;
        
        if (user.balance < totalCost) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла для освобождения! Нужно: ${totalCost} 🧼, есть: ${user.balance} 🧼`);
          return res.status(200).json({ ok: true });
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
      }
      
      else if (cleanText === '/myarmy') {
        const hourlyIncome = (user.children || 0) * CHILD_INCOME;
        
        await sendMessage(BOT_TOKEN, chatId,
          `⚔️ *АРМИЯ ${username}* ⚔️\n\n` +
          `👶 Обычных детей: ${user.children || 0} (дают доход ${hourlyIncome} 🧼/час)\n` +
          `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
          `🏚️ Своих подвалов: ${user.basements || 0}\n` +
          `📊 Баланс: ${user.balance} 🧼\n\n` +
          `/mobilize [количество] — мобилизовать детей (${MOBILIZATION_COST} 🧼/шт)\n` +
          `/attack @user [количество] — атаковать`);
      }
      
      else if (cleanText === '/mycaptured') {
        if (!user.capturedBasementsDetails || user.capturedBasementsDetails.length === 0) {
          await sendMessage(BOT_TOKEN, chatId, `🏚️ У тебя нет захваченных подвалов.\n\nЗахватить подвал можно атакой: /attack @user`);
          return res.status(200).json({ ok: true });
        }
        
        let reply = `🏚️ *ЗАХВАЧЕННЫЕ ПОДВАЛЫ ${username}* 🏚️\n\n`;
        let total = 0;
        for (const cap of user.capturedBasementsDetails) {
          reply += `🎯 У @${cap.owner}: ${cap.count} 🏚️ (дает ${cap.count * BASEMENT_CAPTURE_REWARD} 🧼/час)\n`;
          total += cap.count;
        }
        reply += `\n📊 Всего захвачено: ${total} 🏚️\n` +
          `💰 Общий доход: ${total * BASEMENT_CAPTURE_REWARD} 🧼/час\n\n` +
          `/free @user [количество] — освободить свои подвалы`;
        
        await sendMessage(BOT_TOKEN, chatId, reply);
      }
      
      // ========== СЕКРЕТНАЯ ЯДЕРНАЯ БОМБА ==========
      else if (cleanText === '/buynuke') {
        const nowTime = Date.now();
        if (nowTime < NUKE_ACTIVATE_DATE) {
          return res.status(200).json({ ok: true });
        }
        
        if (user.balance < NUKE_PRICE) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно ${NUKE_PRICE} 🧼, есть ${user.balance} 🧼`);
          return res.status(200).json({ ok: true });
        }
        
        user.balance -= NUKE_PRICE;
        user.nukes = (user.nukes || 0) + 1;
        data.users[userId] = user;
        await saveData(data);
        
        await sendMessage(BOT_TOKEN, chatId,
          `💣 *СЕКРЕТНОЕ ОРУЖИЕ ПРИОБРЕТЕНО* 💣\n\n` +
          `🧼 -${NUKE_PRICE} мыла\n` +
          `💣 Ядерных бомб: ${user.nukes}\n\n` +
          `Использовать: /launchnuke @username\n\n` +
          `🔒 Никому не говори!`);
      }
      
      else if (cleanText === '/mynukes') {
        const nowTime = Date.now();
        if (nowTime < NUKE_ACTIVATE_DATE) {
          return res.status(200).json({ ok: true });
        }
        
        await sendMessage(BOT_TOKEN, chatId,
          `💣 *ТВОЕ СЕКРЕТНОЕ ОРУЖИЕ* 💣\n\n` +
          `💣 Ядерных бомб: ${user.nukes || 0}\n\n` +
          `/buynuke — купить бомбу (${NUKE_PRICE} 🧼)\n` +
          `/launchnuke @user — запустить бомбу\n\n` +
          `🔒 Это секрет! Никому не рассказывай.`);
      }
      
      else if (cleanText.startsWith('/launchnuke')) {
        const nowTime = Date.now();
        if (nowTime < NUKE_ACTIVATE_DATE) {
          return res.status(200).json({ ok: true });
        }
        
        const parts = rawText.split(' ');
        if (parts.length < 2) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /launchnuke @username`);
          return res.status(200).json({ ok: true });
        }
        
        if ((user.nukes || 0) < 1) {
          await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ядерных бомб! Купи: /buynuke`);
          return res.status(200).json({ ok: true });
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
          return res.status(200).json({ ok: true });
        }
        
        let targetUser = data.users[targetId];
        if (!targetUser) {
          return res.status(200).json({ ok: true });
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
      }
      
      // ========== ОБЫЧНЫЕ КОМАНДЫ ==========
      else if (cleanText.startsWith('/buychild')) {
        let amount = 1;
        const parts = rawText.split(' ');
        if (parts.length >= 2) {
          const parsedAmount = parseInt(parts[1]);
          if (!isNaN(parsedAmount) && parsedAmount > 0) {
            amount = parsedAmount;
          } else {
            await sendMessage(BOT_TOKEN, chatId, `❌ Укажи положительное число! Пример: /buychild 3`);
            return res.status(200).json({ ok: true });
          }
        }
        
        const userBasements = user.basements || 0;
        const userChildren = user.children || 0;
        const maxChildrenPossible = userBasements * CHILDREN_PER_BASEMENT;
        const availableSlots = maxChildrenPossible - userChildren;
        
        if (availableSlots < amount) {
          await sendMessage(BOT_TOKEN, chatId,
            `❌ ${username}, у тебя не хватает подвалов для ${amount} детей!\n\n` +
            `🏚️ Твои подвалы: ${userBasements}\n` +
            `👶 Твои дети: ${userChildren}\n` +
            `📌 1 подвал = ${CHILDREN_PER_BASEMENT} детей\n` +
            `📌 Максимум детей: ${maxChildrenPossible}\n` +
            `📌 Свободных мест: ${availableSlots}\n` +
            `⚠️ Нужно еще подвалов: ${Math.ceil((userChildren + amount) / CHILDREN_PER_BASEMENT) - userBasements}\n\n` +
            `/buybasement [количество] — купить подвалы (${BASEMENT_COST} 🧼/шт)`);
          return res.status(200).json({ ok: true });
        }
        
        const totalCost = CHILD_COST * amount;
        
        if (user.balance >= totalCost) {
          user.balance -= totalCost;
          user.children += amount;
          data.users[userId] = user;
          await saveData(data);
          
          const remainingSlots = (user.basements || 0) * CHILDREN_PER_BASEMENT - user.children;
          
          await sendMessage(BOT_TOKEN, chatId,
            `👶 ${username} купил ${amount} ребенка(ей)!\n` +
            `🧼 -${totalCost} мыла\n` +
            `🧼 Баланс: ${user.balance} мыла\n` +
            `👶 Обычных детей: ${user.children}\n` +
            `🏚️ Подвалов: ${user.basements || 0}\n` +
            `📌 Осталось мест для детей: ${remainingSlots}\n` +
            `📈 Каждый ребенок приносит ${CHILD_INCOME} мыло в час!`);
        } else {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! ${amount} ребенок(ей) стоят ${totalCost} 🧼\nУ тебя: ${user.balance} 🧼`);
        }
      }
      
      else if (cleanText === '/children') {
        const hourlyIncome = (user.children || 0) * CHILD_INCOME;
        const userBasements = user.basements || 0;
        const userChildren = user.children || 0;
        const maxChildrenPossible = userBasements * CHILDREN_PER_BASEMENT;
        const canBuyNew = userChildren < maxChildrenPossible;
        const remainingSlots = maxChildrenPossible - userChildren;
        
        await sendMessage(BOT_TOKEN, chatId,
          `👶 *ОБЫЧНЫЕ ДЕТИ ${username}* 👶\n\n` +
          `🧼 Мыла: ${user.balance}\n` +
          `🏚️ Подвалов: ${userBasements}\n` +
          `👶 Обычных детей: ${userChildren}\n` +
          `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
          `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
          `📌 Свободных мест: ${remainingSlots}\n` +
          `📈 Пассивный доход: ${hourlyIncome} 🧼/час\n\n` +
          `${canBuyNew ? '✅ Ты можешь купить ребенка! /buychild [количество]' : '❌ Нужно больше подвалов! /buybasement [количество]'}\n\n` +
          `/buybasement [количество] — купить подвалы (${BASEMENT_COST} 🧼/шт)\n` +
          `/basements — информация о подвалах\n` +
          `/mobilize [количество] — мобилизовать детей в армию`);
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
            reply += `${i+1}. ${u.username} — ${u.balance} 🧼 (👶 ${u.children || 0}, ⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0}, +${childIncome}/ч)\n`;
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/topchildren') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
        
        if (sorted.length === 0 || sorted[0].children === 0) {
          await sendMessage(BOT_TOKEN, chatId, '👶 Топ обычных детей пуст! Купи ребенка через /buychild');
        } else {
          let reply = '👶 *ТОП ОБЫЧНЫХ ДЕТЕЙ* 👶\n\n';
          sorted.forEach((u, i) => {
            if (u.children > 0) {
              reply += `${i+1}. ${u.username} — ${u.children} 👶 (⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0})\n`;
            }
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/topbasements') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => (b.basements || 0) - (a.basements || 0)).slice(0, 10);
        
        if (sorted.length === 0 || sorted[0].basements === 0) {
          await sendMessage(BOT_TOKEN, chatId, '🏚️ Топ подвалов пуст! Купи подвал через /buybasement');
        } else {
          let reply = '🏚️ *ТОП ПОДВАЛОВ* 🏚️\n\n';
          sorted.forEach((u, i) => {
            if (u.basements > 0) {
              reply += `${i+1}. ${u.username} — ${u.basements} 🏚️ (👶 ${u.children || 0}, ⚔️ ${u.mobilized || 0})\n`;
            }
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/topmobilized') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => (b.mobilized || 0) - (a.mobilized || 0)).slice(0, 10);
        
        if (sorted.length === 0 || sorted[0].mobilized === 0) {
          await sendMessage(BOT_TOKEN, chatId, '⚔️ Топ мобилизованных пуст! Мобилизуй детей через /mobilize');
        } else {
          let reply = '⚔️ *ТОП МОБИЛИЗОВАННЫХ* ⚔️\n\n';
          sorted.forEach((u, i) => {
            if (u.mobilized > 0) {
              reply += `${i+1}. ${u.username} — ⚔️ ${u.mobilized} (👶 ${u.children || 0}, 🏚️ ${u.basements || 0})\n`;
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, username: targetName };
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
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, username: targetName };
        const userChildren = user.children || 0;
        if (userChildren < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает обычных детей! Есть: ${userChildren}, нужно: ${amount}`);
          return res.status(200).json({ ok: true });
        }
        user.children = userChildren - amount;
        targetUser.children = (targetUser.children || 0) + amount;
        data.users[userId] = user;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `👶 ПЕРЕВОД ОБЫЧНЫХ ДЕТЕЙ\nОт: ${username}\nКому: @${targetName}\nКоличество: ${amount} 👶\n\n📊 У ${username} осталось: ${user.children} 👶\n📊 У @${targetName} теперь: ${targetUser.children} 👶`);
      }
      
      else if (cleanText.startsWith('/sendbasement')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /sendbasement @username 2`);
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя переводить подвалы самому себе!`);
          return res.status(200).json({ ok: true });
        }
        let targetUser = data.users[targetId] || { balance: 0, children: 0, basements: 0, username: targetName };
        const userBasements = user.basements || 0;
        if (userBasements < amount) {
          await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает подвалов! Есть: ${userBasements}, нужно: ${amount}`);
          return res.status(200).json({ ok: true });
        }
        user.basements = userBasements - amount;
        targetUser.basements = (targetUser.basements || 0) + amount;
        data.users[userId] = user;
        data.users[targetId] = targetUser;
        await saveData(data);
        await sendMessage(BOT_TOKEN, chatId, `🏚️ ПЕРЕВОД ПОДВАЛОВ\nОт: ${username}\nКому: @${targetName}\nКоличество: ${amount} 🏚️\n\n📊 У ${username} осталось: ${user.basements} 🏚️\n📊 У @${targetName} теперь: ${targetUser.basements} 🏚️`);
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
          let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей, ⚔️ ${user.mobilized || 0} мобилизовано, 🏚️ ${user.basements || 0} подвалов\n📈 Обычные дети приносят ${user.children * CHILD_INCOME} 🧼/час`;
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
        const capturedIncome = (user.capturedBasements || 0) * BASEMENT_CAPTURE_REWARD;
        const userBasements = user.basements || 0;
        const maxChildrenPossible = userBasements * CHILDREN_PER_BASEMENT;
        
        let nukeInfo = '';
        if (Date.now() >= NUKE_ACTIVATE_DATE && (user.nukes || 0) > 0) {
          nukeInfo = `\n\n💣 Ядерных бомб: ${user.nukes}\n/mynukes — подробнее`;
        }
        
        await sendMessage(BOT_TOKEN, chatId,
          `📊 *${username}*\n\n` +
          `🧼 Мыла: ${user.balance}\n` +
          `🏚️ Своих подвалов: ${userBasements}\n` +
          `🏚️ Захваченных подвалов: ${user.capturedBasements || 0}\n` +
          `👶 Обычных детей: ${user.children || 0}\n` +
          `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
          `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
          `📈 Доход от обычных детей: ${hourlyIncome} 🧼/час\n` +
          `📈 Доход от захваченных подвалов: ${capturedIncome} 🧼/час${nukeInfo}\n\n` +
          `/buybasement [количество] — купить подвалы (${BASEMENT_COST} 🧼/шт)\n` +
          `/buychild [количество] — купить детей (${CHILD_COST} 🧼/шт)\n` +
          `/mobilize [количество] — мобилизовать детей (${MOBILIZATION_COST} 🧼/шт)`);
      }
      
      else if (cleanText === '/start') {
        let adminCommands = '';
        if (isAdmin) {
          adminCommands = `\n\n👑 *АДМИН-КОМАНДЫ:*\n` +
            `/addsoap @user 50\n` +
            `/removesoap @user 50\n` +
            `/addchild @user 2\n` +
            `/removechild @user 2\n` +
            `/addbasement @user 2\n` +
            `/removebasement @user 2\n` +
            `/addmobilized @user 2\n` +
            `/removemobilized @user 2\n` +
            `/createpromo КОД 100 10\n` +
            `/deletepromo КОД\n` +
            `/promolist\n`;
        }
        
        let nukeCommands = '';
        if (Date.now() >= NUKE_ACTIVATE_DATE) {
          nukeCommands = `\n\n💣 *СЕКРЕТНОЕ ОРУЖИЕ:*\n` +
            `/buynuke — купить бомбу (${NUKE_PRICE} 🧼)\n` +
            `/launchnuke @user — запустить бомбу\n` +
            `/mynukes — мои бомбы\n`;
        }
        
        await sendMessage(BOT_TOKEN, chatId,
          `🧼 *ОСТРОВ ЭПШТЕЙНА* 🏝️\n\nПривет, ${username}!\n\n` +
          `🎯 *КОМАНДЫ:*\n` +
          `/farm — фарм мыла (1-30, раз в час)\n` +
          `/balance — баланс\n` +
          `/top — топ по мылу\n` +
          `/topchildren — топ по обычным детям\n` +
          `/topbasements — топ по подвалам\n` +
          `/topmobilized — топ по мобилизованным\n` +
          `/children — мои обычные дети\n` +
          `/basements — мои подвалы\n` +
          `/buybasement [количество] — купить подвалы (${BASEMENT_COST} 🧼/шт)\n` +
          `/buychild [количество] — купить обычных детей (${CHILD_COST} 🧼/шт)\n` +
          `/sendsoap @user 50 — перевести мыло\n` +
          `/sendchild @user 2 — перевести обычных детей\n` +
          `/sendbasement @user 2 — перевести подвалы\n` +
          `/duel @user [ставка] — дуэль\n` +
          `/casino [ставка] [число] — казино (x2 при победе)\n` +
          `/promo — ввести промокод\n\n` +
          `⚔️ *ИВЕНТ СВО (до 18.04.2026):*\n` +
          `/svo — информация об ивенте\n` +
          `/mobilize [количество] — мобилизовать детей (${MOBILIZATION_COST} 🧼/шт)\n` +
          `/attack @user [количество] — атаковать\n` +
          `/free @user [количество] — освободить свои подвалы (${FREE_COST} 🧼/шт)\n` +
          `/myarmy — моя армия\n` +
          `/mycaptured — мои захваченные подвалы` +
          nukeCommands +
          adminCommands +
          `\n\n📈 Обычные дети приносят ${CHILD_INCOME} 🧼 в час!\n` +
          `⚠️ Пидиди крадет мыло (5%)\n` +
          `👶 1 обычный ребенок = ${CHILD_COST} мыла\n` +
          `🏚️ 1 подвал = ${BASEMENT_COST} мыла\n` +
          `🔑 1 подвал = ${CHILDREN_PER_BASEMENT} обычных детей\n` +
          `🔑 Без подвалов нельзя купить обычных детей!\n` +
          `⚔️ Мобилизованные дети участвуют в СВО (атакуют и защищают)`);
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