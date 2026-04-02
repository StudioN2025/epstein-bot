// api/webhook.js — дуэль с 1 действием за ход
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

const PIDIDI_STEAL_CHANCE = 5;
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
      
      // ========== КНОПКИ ==========
      if (update.callback_query) {
        const callback = update.callback_query;
        const cbData = callback.data;
        const userId = callback.from.id;
        const username = callback.from.username || callback.from.first_name;
        const chatId = callback.message.chat.id;
        const messageId = callback.message.message_id;
        
        // ПРИНЯТЬ ДУЭЛЬ
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
            
            const keyboard = {
              inline_keyboard: [
                [
                  { text: `🎯 ПРИЦЕЛИТЬСЯ (+10%) [${currentAim}/50]`, callback_data: `aim_${duelId}` },
                  { text: `🔫 СБИТЬ ПРИЦЕЛ`, callback_data: `break_${duelId}` }
                ],
                [
                  { text: `💥 ВЫСТРЕЛИТЬ (${20 + currentAim}%)`, callback_data: `shoot_${duelId}` }
                ]
              ]
            };
            
            await editMessage(BOT_TOKEN, chatId, messageId,
              `⚔️ *ДУЭЛЬ!* ⚔️\n\n${duel.player1Name} VS ${duel.player2Name}\n\n🎯 Твой шанс: ${20 + currentAim}%\n💰 Ставка: 3 мыла\n\n👉 *ХОД: ${currentPlayer}*\n(Выбери одно действие)`,
              keyboard
            );
            await answerCallback(callback.id);
          } else {
            await answerCallback(callback.id, '❌ Дуэль недоступна');
          }
        }
        
        // ОТМЕНА
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
        
        // ========== ДЕЙСТВИЯ В ДУЭЛИ ==========
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
          
          // 1. ПРИЦЕЛИТЬСЯ (увеличиваю свой прицел)
          if (action === 'aim') {
            let aimBonus = isPlayer1 ? duel.aim1 : duel.aim2;
            
            if (aimBonus >= 50) {
              await answerCallback(callback.id, '🎯 Уже максимальный прицел!');
              return res.status(200).json({ ok: true });
            }
            
            aimBonus += 10;
            if (isPlayer1) duel.aim1 = aimBonus;
            else duel.aim2 = aimBonus;
            
            resultText = `🎯 ${username} прицелился! +10% к шансу. Теперь шанс: ${20 + aimBonus}%`;
            
            // Меняем ход
            duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
          }
          
          // 2. СБИТЬ ПРИЦЕЛ (обнуляю прицел у противника)
          else if (action === 'break') {
            if (isPlayer1) {
              duel.aim2 = 0;
              resultText = `🔫 ${username} сбил прицел у ${duel.player2Name}! Шанс ${duel.player2Name} вернулся к 20%`;
            } else {
              duel.aim1 = 0;
              resultText = `🔫 ${username} сбил прицел у ${duel.player1Name}! Шанс ${duel.player1Name} вернулся к 20%`;
            }
            
            // Меняем ход
            duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
          }
          
          // 3. ВЫСТРЕЛИТЬ
          else if (action === 'shoot') {
            const aimBonus = isPlayer1 ? duel.aim1 : duel.aim2;
            const hitChance = 20 + aimBonus;
            const hit = Math.random() * 100 < hitChance;
            
            const targetId = isPlayer1 ? duel.player2Id : duel.player1Id;
            const targetName = isPlayer1 ? duel.player2Name : duel.player1Name;
            const shooterName = username;
            
            let data = await loadData();
            if (!data.users) data.users = {};
            
            if (hit) {
              let targetData = data.users[targetId] || { balance: 0, username: targetName };
              let shooterData = data.users[userId] || { balance: 0, username: shooterName };
              
              resultText = `💥 *ПОПАДАНИЕ!* 💥\n\n${shooterName} попал в ${targetName}!\n`;
              
              if (targetData.balance < 3) {
                targetData.mutedUntil = Math.floor(Date.now() / 1000) + 60;
                targetData.balance = 0;
                resultText += `😵 У ${targetName} не было 3 мыла! Он получил МУТ на 1 минуту!`;
              } else {
                targetData.balance -= 3;
                shooterData.balance += 3;
                resultText += `🧼 ${shooterName} забрал 3 мыла!\n📊 ${shooterName}: ${shooterData.balance} 🧼\n📊 ${targetName}: ${targetData.balance} 🧼`;
              }
              
              resultText += `\n\n🏆 *ПОБЕДИТЕЛЬ: ${shooterName}* 🏆`;
              
              data.users[targetId] = targetData;
              data.users[userId] = shooterData;
              await saveData(data);
              
              duelEnded = true;
              delete duels[duelId];
            } else {
              resultText = `💨 *ПРОМАХ!* 💨\n\n${shooterName} промахнулся!`;
              duel.turn = isPlayer1 ? duel.player2Id : duel.player1Id;
            }
          }
          
          if (duelEnded) {
            await editMessage(BOT_TOKEN, chatId, messageId, resultText, null);
            await answerCallback(callback.id, resultText.includes('ПОПАДАНИЕ') ? '💥 Ты победил!' : '❌ Ты проиграл');
          } else {
            const nextPlayerId = duel.turn;
            const nextPlayerName = nextPlayerId === duel.player1Id ? duel.player1Name : duel.player2Name;
            const nextAim = nextPlayerId === duel.player1Id ? duel.aim1 : duel.aim2;
            
            const keyboard = {
              inline_keyboard: [
                [
                  { text: `🎯 ПРИЦЕЛИТЬСЯ (+10%) [${nextAim}/50]`, callback_data: `aim_${duelId}` },
                  { text: `🔫 СБИТЬ ПРИЦЕЛ`, callback_data: `break_${duelId}` }
                ],
                [
                  { text: `💥 ВЫСТРЕЛИТЬ (${20 + nextAim}%)`, callback_data: `shoot_${duelId}` }
                ]
              ]
            };
            
            await editMessage(BOT_TOKEN, chatId, messageId,
              `⚔️ *ДУЭЛЬ!* ⚔️\n\n${duel.player1Name} VS ${duel.player2Name}\n\n${resultText}\n\n🎯 Шанс ${nextPlayerName}: ${20 + nextAim}%\n💰 Ставка: 3 мыла\n\n👉 *ХОД: ${nextPlayerName}*`,
              keyboard
            );
            await answerCallback(callback.id, '✅ Ход передан');
          }
        }
        
        return res.status(200).json({ ok: true });
      }
      
      // ========== СООБЩЕНИЯ ==========
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
      
      let user = data.users[userId] || { balance: 0, lastFarm: 0, username: username, mutedUntil: 0 };
      
      if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
        const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
        await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, ты в муте еще ${Math.ceil(remaining / 60)} мин!`);
        return res.status(200).json({ ok: true });
      }
      
      // /DUEL
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
          await sendMessage(BOT_TOKEN, chatId, `❌ Не найден игрок @${targetUsername}`);
          return res.status(200).json({ ok: true });
        }
        
        const opponent = data.users[opponentId] || { balance: 0 };
        
        for (const duel of Object.values(duels)) {
          if (duel.player1Id === userId || duel.player2Id === userId) {
            await sendMessage(BOT_TOKEN, chatId, `❌ ${username}, ты уже в дуэли!`);
            return res.status(200).json({ ok: true });
          }
        }
        
        const duelId = Date.now().toString();
        
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
            [{ text: '⚔️ ПРИНЯТЬ ДУЭЛЬ', callback_data: `accept_${duelId}` }],
            [{ text: '❌ Отмена', callback_data: 'cancel' }]
          ]
        };
        
        await sendMessage(BOT_TOKEN, chatId,
          `⚔️ *ДУЭЛЬ!* ⚔️\n\n${username} вызывает @${opponentName}!\n\n💰 У ${opponentName}: ${opponent.balance} 🧼\n🏆 Победитель забирает 3 мыла!\n\n⏳ 60 секунд на принятие!`,
          keyboard
        );
        
        setTimeout(() => {
          if (duels[duelId] && duels[duelId].status === 'waiting') {
            delete duels[duelId];
            sendMessage(BOT_TOKEN, chatId, `⏰ Дуэль между ${username} и @${opponentName} отменена.`);
          }
        }, 60000);
      }
      
      // /FARM
      else if (cleanText === '/farm') {
        const now = Math.floor(Date.now() / 1000);
        
        if (user.lastFarm && (now - user.lastFarm) < 3600) {
          const remaining = 3600 - (now - user.lastFarm);
          const minutes = Math.ceil(remaining / 60);
          await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, подожди еще ${minutes} мин!`);
        } else {
          const soap = Math.floor(Math.random() * 30) + 1;
          user.balance += soap;
          user.lastFarm = now;
          user.username = username;
          
          let message = `🧼 ${username}, +${soap} детского мыла!\n📊 Баланс: ${user.balance} 🧼`;
          
          const roll = Math.random() * 100;
          if (roll < PIDIDI_STEAL_CHANCE) {
            const stolen = Math.floor(Math.random() * (PIDIDI_STEAL_MAX - PIDIDI_STEAL_MIN + 1)) + PIDIDI_STEAL_MIN;
            
            if (user.balance - stolen <= 0) {
              user.balance = 0;
              message = `😡👶 *ПИДИДИ УКРАЛ ВСЁ!* 👶😡\n\n${username}, Пидиди украл всё мыло!\n🍼 "Детское мыло только для детей!" 👶`;
            } else {
              user.balance -= stolen;
              message = `😡👶 *ПИДИДИ УКРАЛ МЫЛО!* 👶😡\n\n${username}, Пидиди украл ${stolen} мыла!\n📊 Осталось: ${user.balance} 🧼`;
            }
          }
          
          data.users[userId] = user;
          await saveData(data);
          await sendMessage(BOT_TOKEN, chatId, message);
        }
      }
      
      // /BALANCE
      else if (cleanText === '/balance') {
        await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${user.balance} 🧼 детского мыла`);
      }
      
      // /TOP
      else if (cleanText === '/top') {
        const users = Object.values(data.users);
        const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
        
        if (sorted.length === 0) {
          await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Фарми мыло 🧼');
        } else {
          let reply = '🏆 ТОП МЫЛОВАРОВ 🧼\n\n';
          sorted.forEach((u, i) => {
            reply += `${i+1}. ${u.username} — ${u.balance} 🧼\n`;
          });
          await sendMessage(BOT_TOKEN, chatId, reply);
        }
      }
      
      // /START
      else if (cleanText === '/start') {
        await sendMessage(BOT_TOKEN, chatId,
          `🧼 *Остров Эпштейна* 🏝️\n\nПривет, ${username}!\n\n` +
          `/farm — фарм мыла (1-30, раз в час)\n` +
          `/balance — баланс\n` +
          `/top — топ\n` +
          `/duel @username — дуэль\n\n` +
          `⚠️ Пидиди крадет мыло с шансом 5%!\n` +
          `⚔️ В дуэли: 1 действие за ход. Прицел увеличивает шанс, "Сбить прицел" обнуляет врагу.`
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
