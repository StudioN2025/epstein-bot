// api/webhook.js — полная версия с детским мылом и Пидиди
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

// Константы вора Пидиди (без пробелов!)
const PIDIDI_STEAL_CHANCE = 5;  // 5% шанс кражи
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

let duels = {};

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
      
      // ========== ОБРАБОТКА КНОПОК ==========
      if (update.callback_query) {
        const callback = update.callback_query;
        const data = callback.data;
        const userId = callback.from.id;
        const username = callback.from.username || callback.from.first_name;
        const chatId = callback.message.chat.id;
        const messageId = callback.message.message_id;
        
        // Принять дуэль
        if (data.startsWith('duel_accept_')) {
          const duelId = data.split('_')[2];
          const duel = duels[duelId];
          
          if (duel && duel.status === 'waiting' && duel.player2Id === userId) {
            duel.status = 'active';
            duel.turn = duel.player1Id;
            duel.aim1 = 0;
            duel.aim2 = 0;
            
            await editMessage(BOT_TOKEN, chatId, messageId,
              `⚔️ *ДУЭЛЬ НАЧАЛАСЬ!* ⚔️\n\n${duel.player1Name} VS ${username}\n\n🎯 *Базовый шанс: 20%*\n🎯 Каждый "Прицел" +10% (макс 70%)\n💰 При попадании забираешь 3 детского мыла\n\n👉 *Ход ${duel.player1Name}*`,
              getDuelKeyboard(duel.player1Id, duel.player2Id, duel.turn, duel.aim1, duel.aim2)
            );
            
            await answerCallback(callback.id);
          } else {
            await answerCallback(callback.id, '❌ Дуэль уже отменена или начата!');
          }
        }
        
        // Отмена дуэли
        else if (data === 'duel_cancel') {
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
        
        // ДЕЙСТВИЯ В ДУЭЛИ
        else if (data.startsWith('duel_action_')) {
          const parts = data.split('_');
          const action = parts[2];
          const duelId = parts[3];
          const duel = duels[duelId];
          
          if (!duel || duel.status !== 'active') {
            await answerCallback(callback.id, '❌ Дуэль уже завершена!');
            await deleteMessage(BOT_TOKEN, chatId, messageId);
            return res.status(200).json({ ok: true });
          }
          
          if (duel.turn !== userId) {
            const waitingName = duel.turn === duel.player1Id ? duel.player1Name : duel.player2Name;
            await answerCallback(callback.id, `⏳ Сейчас ход ${waitingName}!`);
            return res.status(200).json({ ok: true });
          }
          
          const isPlayer1 = (userId === duel.player1Id);
          let aimBonus = isPlayer1 ? duel.aim1 : duel.aim2;
          
          // AIM
          if (action === 'aim') {
            if (aimBonus >= 50) {
              await answerCallback(callback.id, '🎯 Уже максимальный прицел!');
              return res.status(200).json({ ok: true });
            }
            
            aimBonus += 10;
            if (isPlayer1) {
              duel.aim1 = aimBonus;
            } else {
              duel.aim2 = aimBonus;
            }
            
            await editMessage(BOT_TOKEN, chatId, messageId,
              `⚔️ *ДУЭЛЬ!* ⚔️\n\n${duel.player1Name} VS ${duel.player2Name}\n\n🎯 *Шанс ${username}: ${20 + aimBonus}%* (база 20% + ${aimBonus}% от прицела)\n💰 При попадании забираешь 3 детского мыла\n\n👉 *Ход ${username}*`,
              getDuelKeyboard(duel.player1Id, duel.player2Id, duel.turn, duel.aim1, duel.aim2)
            );
            
            await answerCallback(callback.id, `🎯 Прицел +10%! Шанс: ${20 + aimBonus}%`);
          }
          
          // UNAIM
          else if (action === 'unaim') {
            if (isPlayer1) {
              duel.aim1 = 0;
            } else {
              duel.aim2 = 0;
            }
            
            await editMessage(BOT_TOKEN, chatId, messageId,
              `⚔️ *ДУЭЛЬ!* ⚔️\n\n${duel.player1Name} VS ${duel.player2Name}\n\n🎯 *Шанс ${username}: 20%* (прицел сброшен)\n💰 При попадании забираешь 3 детского мыла\n\n👉 *Ход ${username}*`,
              getDuelKeyboard(duel.player1Id, duel.player2Id, duel.turn, duel.aim1, duel.aim2)
            );
            
            await answerCallback(callback.id, `🔫 Прицел сброшен! Шанс: 20%`);
          }
          
          // SHOOT
          else if (action === 'shoot') {
            const hitChance = 20 + aimBonus;
            const hitRoll = Math.random() * 100;
            const hit = hitRoll < hitChance;
            
            const targetId = isPlayer1 ? duel.player2Id : duel.player1Id;
            const targetName = isPlayer1 ? duel.player2Name : duel.player1Name;
            const shooterName = username;
            
            let resultText = `🎲 *${shooterName} стреляет!* Шанс: ${hitChance}%, выпало: ${hitRoll.toFixed(1)}%\n\n`;
            
            let data = await loadData();
            if (!data.users) data.users = {};
            
            if (hit) {
              let targetData = data.users[targetId] || { balance: 0, username: targetName };
              let shooterData = data.users[userId] || { balance: 0, username: shooterName };
              
              if (targetData.balance < 3) {
                targetData.mutedUntil = Math.floor(Date.now() / 1000) + 60;
                targetData.balance = 0;
                resultText += `💥 *ПОПАДАНИЕ!* 💥\n\n😵 У ${targetName} не было 3 детского мыла! Он получил МУТ на 1 минуту!\n\n🏆 *ПОБЕДИТЕЛЬ: ${shooterName}* 🏆`;
                delete duels[duel.id];
              } else {
                targetData.balance -= 3;
                shooterData.balance += 3;
                resultText += `💥 *ПОПАДАНИЕ!* 💥\n\n🧼 ${shooterName} забрал 3 детского мыла у ${targetName}!\n📊 ${shooterName}: ${shooterData.balance} 🧼\n📊 ${targetName}: ${targetData.balance} 🧼\n\n🏆 *ПОБЕДИТЕЛЬ: ${shooterName}* 🏆`;
                delete duels[duel.id];
              }
              
              data.users[targetId] = targetData;
              data.users[userId] = shooterData;
              await saveData(data);
              
              await editMessage(BOT_TOKEN, chatId, messageId, resultText, null);
              await answerCallback(callback.id, `💥 ПОПАДАНИЕ! Ты победил!`);
            } else {
              resultText += `💨 *ПРОМАХ!* 💨\n\n👉 *Теперь ход ${targetName}!*`;
              
              if (isPlayer1) {
                duel.aim1 = 0;
                duel.turn = duel.player2Id;
              } else {
                duel.aim2 = 0;
                duel.turn = duel.player1Id;
              }
              
              await editMessage(BOT_TOKEN, chatId, messageId,
                `⚔️ *ДУЭЛЬ!* ⚔️\n\n${duel.player1Name} VS ${duel.player2Name}\n\n${resultText}\n🎯 Шанс ${duel.turn === duel.player1Id ? duel.player1Name : duel.player2Name}: 20%`,
                getDuelKeyboard(duel.player1Id, duel.player2Id, duel.turn, duel.aim1, duel.aim2)
              );
              await answerCallback(callback.id, `💨 ПРОМАХ! Ход переходит ${targetName}`);
            }
          }
        }
        
        return res.status(200).json({ ok: true });
      }
      
      // ========== ОБЫЧНЫЕ СООБЩЕНИЯ ==========
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
        let reply = `🧼 Детское мыло только на острове: ${GROUP_INVITE_LINK}`;
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
      
      // ========== /DUEL ==========
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
        
        for (const duel of Object.values(duels)) {
          if (duel.player1Id === userId || duel.player2Id === userId) {
            await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже участвуешь в дуэли!`);
            return res.status(200).json({ ok: true });
          }
        }
        
        const duelId = `duel_${Date.now()}`;
        
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
          `⚔️ *ДУЭЛЬ!* ⚔️\n\n${username} вызывает на дуэль @${opponentName}!\n\n📊 У противника ${opponent.balance} 🧼 детского мыла.\n💰 Победитель забирает 3 детского мыла!\n🎯 Базовый шанс: 20% | Кнопка "Прицел" +10%\n\n⏳ У тебя 60 секунд, чтобы принять!`,
          keyboard
        );
        
        setTimeout(() => {
          if (duels[duelId] && duels[duelId].status === 'waiting') {
            delete duels[duelId];
            sendMessage(BOT_TOKEN, chatId, `⏰ Дуэль между ${username} и @${opponentName} отменена (таймаут).`);
          }
        }, 60000);
      }
      
      // ========== /FARM с Пидиди ==========
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
          
          let message = `🧼 ${username}, ты нафармил +${soap} детского мыла!\n📊 Баланс: ${user.balance} 🧼`;
          
          // Шанс 5% на вора Пидиди
          const roll = Math.random() * 100;
          if (roll < PIDIDI_STEAL_CHANCE) {
            const stolen = Math.floor(Math.random() * (PIDIDI_STEAL_MAX - PIDIDI_STEAL_MIN + 1)) + PIDIDI_STEAL_MIN;
            const newBalance = user.balance - stolen;
            
            if (newBalance < 0) {
              user.balance = 0;
              message = `😡👶 *ПИДИДИ УКРАЛ ДЕТСКОЕ МЫЛО!* 👶😡\n\n${username}, ты нафармил +${soap} мыла, НО Пидиди украл всё! У тебя было ${user.balance + stolen}, осталось 0!\n\n🍼 *ПИДИДИ СКАЗАЛ:* "Детское мыло только для детей! Не трожь!" 👶🧼`;
            } else {
              user.balance = newBalance;
              message = `😡👶 *ПИДИДИ УКРАЛ ДЕТСКОЕ МЫЛО!* 👶😡\n\n${username}, ты нафармил +${soap} мыла, НО Пидиди украл ${stolen} мыла!\n📊 Было: ${user.balance + stolen}, стало: ${user.balance} 🧼\n\n🍼 *ПИДИДИ СКАЗАЛ:* "Это мое мыло!" 👶🧼`;
            }
          }
          
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId, message);
        }
      }
      
      // ========== /BALANCE ==========
      else if (cleanText === '/balance') {
        await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${user.balance} 🧼 детского мыла`);
      }
      
      // ========== /TOP ==========
      else if (cleanText === '/top') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
        
        if (sorted.length === 0) {
          await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Нафарми детское мыло первым 🧼');
        } else {
          let reply = '🏆 ТОП МЫЛОВАРОВ ОСТРОВА 🧼\n\n';
          sorted.forEach((u, i) => {
            reply += `${i+1}. ${u.username} — ${u.balance} 🧼 детского мыла\n`;
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      // ========== /START ==========
      else if (cleanText === '/start') {
        await sendMessage(BOT_TOKEN, chatId, 
          `🧼 *Остров Эпштейна* 🏝️\n\nПривет, ${username}!\n\n` +
          `🎯 *Команды:*\n` +
          `/farm — нафармить детское мыло (1-30, раз в час)\n` +
          `/balance — баланс детского мыла\n` +
          `/top — топ мыловаров\n` +
          `/duel @username — вызвать на дуэль\n\n` +
          `⚠️ *ВНИМАНИЕ!* Пидиди с вероятностью 5% может украсть твое мыло (1-10 штук)!\n\n` +
          `⚔️ *Дуэль:* Все действия через кнопки! Базовый шанс 20%, каждая кнопка "Прицел" +10% (макс 70%). При попадании забираешь 3 детского мыла.`
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

function getDuelKeyboard(player1Id, player2Id, turnId, aim1, aim2) {
  const isPlayer1Turn = (turnId === player1Id);
  const currentAim = isPlayer1Turn ? aim1 : aim2;
  
  return {
    inline_keyboard: [
      [
        { text: `🎯 ПРИЦЕЛ (+10%) [${currentAim}/50]`, callback_data: `duel_action_aim_${Date.now()}` },
        { text: `🔫 СБРОСИТЬ`, callback_data: `duel_action_unaim_${Date.now()}` }
      ],
      [
        { text: `💥 ВЫСТРЕЛИТЬ (${20 + currentAim}%)`, callback_data: `duel_action_shoot_${Date.now()}` }
      ]
    ]
  };
}

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

async function editMessage(token, chatId, messageId, text, keyboard = null) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown' };
  if (keyboard) body.reply_markup = keyboard;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function deleteMessage(token, chatId, messageId) {
  const url = `https://api.telegram.org/bot${token}/deleteMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
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
