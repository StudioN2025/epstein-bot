// api/webhook.js — версия с Google Sheets
module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const SHEET_ID = process.env.SHEET_ID; // ID твоей таблицы
  
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
        
        // Загружаем данные из Google Sheets
        let userData = await loadUserData(SHEET_ID, userId);
        
        if (!userData) {
          userData = { balance: 0, username: username, lastFarm: 0 };
        }
        
        // /farm
        if (text === '/farm') {
          const now = Math.floor(Date.now() / 1000); // в секундах
          
          if (userData.lastFarm && (now - userData.lastFarm) < 3600) {
            const remaining = Math.ceil(3600 - (now - userData.lastFarm));
            await sendMessage(BOT_TOKEN, chatId, `⏰ Подожди еще ${remaining} секунд!`);
          } else {
            const soap = Math.floor(Math.random() * 30) + 1;
            userData.balance += soap;
            userData.lastFarm = now;
            userData.username = username;
            
            // Сохраняем в Google Sheets
            await saveUserData(SHEET_ID, userId, userData);
            
            await sendMessage(BOT_TOKEN, chatId, `🧼 +${soap} мыла!\n📊 Баланс: ${userData.balance} 🧼`);
          }
        }
        
        // /balance
        else if (text === '/balance') {
          await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${userData.balance} 🧼`);
        }
        
        // /top
        else if (text === '/top') {
          const allUsers = await getAllUsers(SHEET_ID);
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

// Функции работы с Google Sheets
async function loadUserData(sheetId, userId) {
  try {
    const url = `https://opensheet.elk.sh/${sheetId}/Лист1?user_id=${userId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.length > 0) {
      const row = data[0];
      return {
        balance: parseInt(row.balance) || 0,
        username: row.username,
        lastFarm: parseInt(row.last_farm) || 0
      };
    }
    return null;
  } catch (error) {
    console.log('User not found:', userId);
    return null;
  }
}

async function saveUserData(sheetId, userId, data) {
  // Сначала удаляем старую запись
  await fetch(`https://opensheet.elk.sh/${sheetId}/Лист1/user_id/${userId}/delete`, {
    method: 'DELETE'
  });
  
  // Добавляем новую
  await fetch(`https://opensheet.elk.sh/${sheetId}/Лист1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      user_id: userId,
      username: data.username,
      balance: data.balance,
      last_farm: data.lastFarm
    }])
  });
}

async function getAllUsers(sheetId) {
  try {
    const url = `https://opensheet.elk.sh/${sheetId}/Лист1`;
    const response = await fetch(url);
    const rows = await response.json();
    
    const users = {};
    rows.forEach(row => {
      if (row.user_id) {
        users[row.user_id] = {
          balance: parseInt(row.balance) || 0,
          username: row.username,
          lastFarm: parseInt(row.last_farm) || 0
        };
      }
    });
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
