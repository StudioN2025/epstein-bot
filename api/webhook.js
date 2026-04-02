// api/webhook.js — пошаговая дуэль
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

let duels = {}; // { duelId: { turn, aim1, aim2, player1Id, player2Id, ... } }
let duelCounter = 0;

function cleanCommand(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/@\w+/, '').trim();
}

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼' });
  }
  
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      // Callback от кнопок
      if (update.callback_query) {
        const callback = update.callback_query;
        const callbackData = callback.data;
        const userId = callback.from.id;
        const username = callback.from.username || callback.from.first_name;
        const chatId = callback.message.chat.id;
        
        if (callbackData.startsWith('duel_accept_')) {
          const duelId = callbackData.split('_')[2];
          
          if (duels[duelId] && duels[duelId].status === 'waiting' && duels[duelId].player2Id === userId) {
            duels[duelId].status = 'active';
            duels[duelId].turn = duels[duelId].player1Id;
            duels[duelId].aim1 = 0;
            duels[duelId].aim2 = 0;
            
            await sendMessage(BOT_TOKEN, chatId, 
              `⚔️ *ДУЭЛЬ НАЧАЛАСЬ!* ⚔️\n\n${duels[duelId].player1Name} VS ${username}\n\n🎲 *Базовый шанс попадания: 20%*\n🎯 Каждый /aim +10% (макс 70%)\n🔫 Прицел сбрасывается после выстрела\n\n👉 *Ход ${duels[duelId].player1Name}*`,
              null
            );
            
            await answerCallback(callback.id);
          } else {
            await answerCallback(callback.id, '❌ Дуэль уже отменена или начата!');
          }
        }
        
        else if (callbackData === 'duel_cancel') {
          for (const [id, duel] of Object.entries(duels)) {
            if (duel.player1Id === userId || duel.player2Id === userId) {
              delete duels[id];
              await sendMessage(BOT_TOKEN, chatId, `❌ ${username} отменил дуэль.`);
              break;
            }
          }
          await answerCallback(callback.id);
        }
        
        return res.status(200).json({ ok: true });
      }
      
      // Обычные сообщения
      if (!update.message || !update.message.text) {
        return res.status(200).json({ ok: true });
      }
      
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const username = update.message.from.username || update.message.from.first_name;
      const rawText = update.message.text;
      const cleanText = cleanCommand(rawText);
      
      // Проверка группы
      if (chatId !== ALLOWED_CHAT_ID) {
        let reply = chatId === update.message.chat.id && update.message.chat.type === 'private' 
          ? `🧼 Бот работает только на острове: ${GROUP_INVITE_LINK}`
          : `🧼 Этот бот работает только в группе Epstein Island: ${GROUP_INVITE_LINK}`;
        await sendMessage(BOT_TOKEN, chatId, reply);
        return res.status(200).json({ ok: true });
      }
      
      // Загружаем данные
      let data = await loadData();
      if (!data.users) data.users = {};
      
      let user = data.users[userId] || { balance: 0, lastFarm: 0, username: username, mutedUntil: 0 };
      
      // Проверка мута
      if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
        const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
        await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, ты в муте еще ${Math.ceil(remaining / 60)} минут!`);
        return res.status(200).json({ ok: true });
      }
      
      // ========== НАХОДИМ АКТИВНУЮ ДУЭЛЬ ДЛЯ ИГРОКА ==========
      let currentDuel = null;
      let isPlayer1 = false;
      
      for (const [id, duel] of Object.entries(duels)) {
        if (duel.status === 'active') {
          if (duel.player1Id === userId) {
            currentDuel = duel;
            isPlayer1 = true;
            break;
          } else if (duel.player2Id === userId) {
            currentDuel = duel;
            isPlayer1 = false;
            break;
          }
        }
      }
      
      // ========== КОМАНДА /DUEL ==========
      if (cleanText.startsWith('/duel')) {
        const parts = rawText.split(' ');
        let targetUsername = parts[1];
        
        if (!targetUsername) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, укажи противника! Пример: /duel @username`);
          return res.status(200).json({ ok: true });
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername} или это ты сам!`);
          return res.status(200).json({ ok: true });
        }
        
        const opponent = data.users[opponentId] || { balance: 0, username: opponentName };
        
        if (opponent.mutedUntil && opponent.mutedUntil > Math.floor(Date.now() / 1000)) {
          await sendMessage(BOT_TOKEN, chatId, `🔇 @${opponentName} сейчас в муте и не может участвовать в дуэли!`);
          return res.status(200).json({ ok: true });
        }
        
        // Проверка на уже активную дуэль
        for (const duel of Object.values(duels)) {
          if (duel.player1Id === userId || duel.player2Id === userId) {
            await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже участвуешь в дуэли!`);
            return res.status(200).json({ ok: true });
          }
        }
        
        duelCounter++;
        const duelId = `duel_${duelCounter}`;
        
        duels[duelId] = {
          id: duelId,
          player1Id: userId,
          player1Name: username,
          player2Id: opponentId,
          player2Name: opponentName,
          status: 'waiting',
          turn: null,
          aim1: 0,
          aim2: 0
        };
        
        const keyboard = {
          inline_keyboard: [
            [{ text: '⚔️ ПРИНЯТЬ ДУЭЛЬ', callback_data: `duel_accept_${duelId}` }],
            [{ text: '❌ Отмена', callback_data: 'duel_cancel' }]
          ]
        };
        
        await sendMessage(BOT_TOKEN, chatId, 
          `⚔️ *ДУЭЛЬ!* ⚔️\n\n${username} вызывает на дуэль @${opponentName}!\n\n📊 У противника ${opponent.balance} 🧼 мыла.\n💰 Победитель забирает 3 мыла!\n🎯 Базовый шанс: 20% | /aim +10%\n\n⏳ У тебя 60 секунд, чтобы принять!`,
          keyboard
        );
        
        setTimeout(() => {
          if (duels[duelId] && duels[duelId].status === 'waiting') {
            delete duels[duelId];
            sendMessage(BOT_TOKEN, chatId, `⏰ Дуэль между ${username} и @${opponentName} отменена (таймаут).`);
          }
        }, 60000);
      }
      
      // ========== /AIM (только если твой ход) ==========
      else if (cleanText === '/aim') {
        if (!currentDuel) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты не участвуешь в активной дуэли! Используй /duel @username`);
          return res.status(200).json({ ok: true });
        }
        
        if (currentDuel.turn !== userId) {
          const waitingName = currentDuel.turn === currentDuel.player1Id ? currentDuel.player1Name : currentDuel.player2Name;
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, сейчас ход ${waitingName}! Подожди своей очереди.`);
          return res.status(200).json({ ok: true });
        }
        
        if (isPlayer1) {
          if (currentDuel.aim1 >= 50) {
            await sendMessage(BOT_TOKEN, chatId, `🎯 ${username}, у тебя уже максимальный прицел! Стреляй через /shoot`);
            return res.status(200).json({ ok: true });
          }
          currentDuel.aim1 += 10;
          await sendMessage(BOT_TOKEN, chatId, `🎯 ${username} навел прицел! +10% к шансу. Текущий шанс: ${20 + currentDuel.aim1}%`);
        } else {
          if (currentDuel.aim2 >= 50) {
            await sendMessage(BOT_TOKEN, chatId, `🎯 ${username}, у тебя уже максимальный прицел! Стреляй через /shoot`);
            return res.status(200).json({ ok: true });
          }
          currentDuel.aim2 += 10;
          await sendMessage(BOT_TOKEN, chatId, `🎯 ${username} навел прицел! +10% к шансу. Текущий шанс: ${20 + currentDuel.aim2}%`);
        }
      }
      
      // ========== /UNAIM ==========
      else if (cleanText === '/unaim') {
        if (!currentDuel) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты не участвуешь в активной дуэли!`);
          return res.status(200).json({ ok: true });
        }
        
        if (currentDuel.turn !== userId) {
          const waitingName = currentDuel.turn === currentDuel.player1Id ? currentDuel.player1Name : currentDuel.player2Name;
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, сейчас ход ${waitingName}!`);
          return res.status(200).json({ ok: true });
        }
        
        if (isPlayer1) {
          currentDuel.aim1 = 0;
        } else {
          currentDuel.aim2 = 0;
        }
        
        await sendMessage(BOT_TOKEN, chatId, `🔫 ${username} сбросил прицел. Шанс вернулся к 20%`);
      }
      
      // ========== /SHOOT ==========
      else if (cleanText === '/shoot') {
        if (!currentDuel) {
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты не участвуешь в активной дуэли!`);
          return res.status(200).json({ ok: true });
        }
        
        if (currentDuel.turn !== userId) {
          const waitingName = currentDuel.turn === currentDuel.player1Id ? currentDuel.player1Name : currentDuel.player2Name;
          await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, сейчас ход ${waitingName}! Подожди своей очереди.`);
          return res.status(200).json({ ok: true });
        }
        
        const aimBonus = isPlayer1 ? currentDuel.aim1 : currentDuel.aim2;
        const hitChance = 20 + aimBonus;
        const hitRoll = Math.random() * 100;
        const hit = hitRoll < hitChance;
        
        const targetId = isPlayer1 ? currentDuel.player2Id : currentDuel.player1Id;
        const targetName = isPlayer1 ? currentDuel.player2Name : currentDuel.player1Name;
        const shooterName = username;
        
        let logMessage = `🎲 ${shooterName} стреляет! Шанс: ${hitChance}%, выпало: ${hitRoll.toFixed(1)}%\n`;
        
        if (hit) {
          let targetData = data.users[targetId] || { balance: 0, username: targetName };
          let shooterData = data.users[userId] || { balance: 0, username: shooterName };
          
          if (targetData.balance < 3) {
            targetData.mutedUntil = Math.floor(Date.now() / 1000) + 60;
            targetData.balance = 0;
            logMessage += `💥 *ПОПАДАНИЕ!* 💥\n\n😵 У ${targetName} не было 3 мыла! Он получил МУТ на 1 минуту!\n\n🏆 *ПОБЕДИТЕЛЬ: ${shooterName}* 🏆`;
            delete duels[currentDuel.id];
          } else {
            targetData.balance -= 3;
            shooterData.balance += 3;
            logMessage += `💥 *ПОПАДАНИЕ!* 💥\n\n🧼 ${shooterName} забрал 3 мыла у ${targetName}!\n📊 ${shooterName}: ${shooterData.balance} 🧼\n📊 ${targetName}: ${targetData.balance} 🧼\n\n🏆 *ПОБЕДИТЕЛЬ: ${shooterName}* 🏆`;
            delete duels[currentDuel.id];
          }
          
          data.users[targetId] = targetData;
          data.users[userId] = shooterData;
          await saveData(data);
        } else {
          logMessage += `💨 *ПРОМАХ!* 💨\n\n👉 Теперь ход ${targetName}!`;
          
          // Сбрасываем прицел у стрелявшего
          if (isPlayer1) {
            currentDuel.aim1 = 0;
            currentDuel.turn = currentDuel.player2Id;
          } else {
            currentDuel.aim2 = 0;
            currentDuel.turn = currentDuel.player1Id;
          }
        }
        
        await sendMessage(BOT_TOKEN, chatId, logMessage);
      }
      
      // ========== ОСТАЛЬНЫЕ КОМАНДЫ ==========
      else if (cleanText === '/farm') {
        const now = Math.floor(Date.now() / 1000);
        
        if (user.lastFarm && (now - user.lastFarm) < 3600) {
          const remaining = 3600 - (now - user.lastFarm);
          const minutes = Math.floor(remaining / 60);
          await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, подожди еще ${minutes} минут!`);
        } else {
          const soap = Math.floor(Math.random() * 30) + 1;
          user.balance += soap;
          user.lastFarm = now;
          user.username = username;
          
          data.users[userId] = user;
          await saveData(data);
          
          await sendMessage(BOT_TOKEN, chatId, `🧼 ${username}, ты нафармил +${soap} мыла!\n📊 Баланс: ${user.balance} 🧼`);
        }
      }
      
      else if (cleanText === '/balance') {
        await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${user.balance} 🧼`);
      }
      
      else if (cleanText === '/top') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
        
        if (sorted.length === 0) {
          await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Нафарми первый 🧼');
        } else {
          let reply = '🏆 ТОП МЫЛОВАРОВ ОСТРОВА 🧼\n\n';
          sorted.forEach((u, i) => {
            reply += `${i+1}. ${u.username} — ${u.balance} 🧼\n`;
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      else if (cleanText === '/start') {
        await sendMessage(BOT_TOKEN, chatId, 
          `🧼 *Остров Эпштейна* 🏝️\n\nПривет, ${username}!\n\n` +
          `🎯 *Команды:*\n` +
          `/farm — нафармить мыло (1-30, раз в час)\n` +
          `/balance — баланс\n` +
          `/top — топ мыловаров\n` +
          `/duel @username — вызвать на дуэль\n` +
          `/aim — навести прицел (+10% к шансу, макс +50%)\n` +
          `/unaim — сбросить прицел\n` +
          `/shoot — выстрелить\n\n` +
          `⚔️ *Дуэль:* Пошаговый режим. Базовый шанс 20%. Каждый /aim дает +10%. При попадании забираешь 3 мыла. Если у противника нет мыла — он получает мут на минуту!`
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

async function loadData() {
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    const data = await response.json();
    return data.record;
  } catch (error) {
    console.error('Load error:', error);
    return { users: {} };
  }
}

async function saveData(data) {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Save error:', error);
  }
}

async function sendMessage(token, chatId, text, keyboard = null) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCallback(callbackId, text = null) {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`;
  const body = { callback_query_id: callbackId };
  if (text) body.text = text;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
