const { put } = require('@vercel/blob');

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
        
        let userData = await loadUserData(userId);
        
        if (!userData) {
          userData = { balance: 0, username: username, lastFarm: 0 };
        }
        
        if (text === '/farm') {
          const now = Date.now();
          
          if (userData.lastFarm && (now - userData.lastFarm) < 3600000) {
            const remaining = Math.ceil((3600000 - (now - userData.lastFarm)) / 60000);
            await sendMessage(BOT_TOKEN, chatId, `⏰ Подожди еще ${remaining} минут!`);
          } else {
            const soap = Math.floor(Math.random() * 30) + 1;
            userData.balance += soap;
            userData.lastFarm = now;
            await saveUserData(userId, userData);
            await sendMessage(BOT_TOKEN, chatId, `🧼 +${soap} мыла! Баланс: ${userData.balance}`);
          }
        }
        else if (text === '/balance') {
          await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${userData.balance} 🧼`);
        }
        else if (text === '/top') {
          const allUsers = await getAllUsers();
          const sorted = Object.values(allUsers)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 10);
          
          if (sorted.length === 0) {
            await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Фарми мыло 🧼');
          } else {
            let reply = '🏆 ТОП мыловаров 🧼\n\n';
            sorted.forEach((user, i) => {
              reply += `${i+1}. ${user.username} — ${user.balance} 🧼\n`;
            });
            await sendMessage(BOT_TOKEN, chatId, reply);
          }
        }
        else if (text === '/start') {
          await sendMessage(BOT_TOKEN, chatId, 
            `Привет, ${username}! 🧼\n\n/farm — нафармить мыло\n/balance — баланс\n/top — топ`
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

async function loadUserData(userId) {
  try {
    const url = `https://${process.env.BLOB_READ_WRITE_TOKEN}.blob.vercel-storage.com/users/${userId}.json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function saveUserData(userId, data) {
  const { url } = await put(`users/${userId}.json`, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
  });
  return url;
}

async function getAllUsers() {
  try {
    const response = await fetch(`https://${process.env.BLOB_READ_WRITE_TOKEN}.blob.vercel-storage.com/users/`);
    const blobs = await response.json();
    
    const users = {};
    for (const blob of blobs.blobs) {
      const userData = await fetch(blob.url).then(r => r.json());
      const userId = blob.pathname.replace('users/', '').replace('.json', '');
      users[userId] = userData;
    }
    return users;
  } catch (error) {
    return {};
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
