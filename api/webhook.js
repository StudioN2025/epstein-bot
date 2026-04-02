// api/webhook.js — финальная версия с JSONBin
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼' });
  }
  
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const userId = update.message.from.id;
        const username = update.message.from.username || update.message.from.first_name;
        const text = update.message.text;
        
        // Загружаем данные
        let data = await loadData();
        if (!data.users) data.users = {};
        
        const user = data.users[userId] || { balance: 0, lastFarm: 0, username: username };
        
        // /farm
        if (text === '/farm') {
          const now = Math.floor(Date.now() / 1000);
          
          if (user.lastFarm && (now - user.lastFarm) < 3600) {
            const remaining = 3600 - (now - user.lastFarm);
            const minutes = Math.floor(remaining / 60);
            await sendMessage(BOT_TOKEN, chatId, `⏰ Подожди еще ${minutes} минут!`);
          } else {
            const soap = Math.floor(Math.random() * 30) + 1;
            user.balance += soap;
            user.lastFarm = now;
            user.username = username;
            
            data.users[userId] = user;
            await saveData(data);
            
            await sendMessage(BOT_TOKEN, chatId, `🧼 +${soap} мыла!\n📊 Баланс: ${user.balance} 🧼`);
          }
        }
        
        // /balance
        else if (text === '/balance') {
          await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${user.balance} 🧼`);
        }
        
        // /top
        else if (text === '/top') {
          const users = Object.values(data.users);
          const sorted = users.sort((a, b) => b.balance - a.balance).slice(0, 10);
          
          if (sorted.length === 0) {
            await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Нафарми первый 🧼');
          } else {
            let reply = '🏆 ТОП МЫЛОВАРОВ 🧼\n\n';
            sorted.forEach((u, i) => {
              reply += `${i+1}. ${u.username} — ${u.balance} 🧼\n`;
            });
            await sendMessage(BOT_TOKEN, chatId, reply);
          }
        }
        
        // /start
        else if (text === '/start') {
          await sendMessage(BOT_TOKEN, chatId, 
            `Привет, ${username}! 🧼\n\n/farm — нафармить мыло (1-30, раз в час)\n/balance — баланс\n/top — топ игроков`
          );
        }
      }
      
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).json({ ok: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};

// Функции работы с JSONBin
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

async function sendMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
