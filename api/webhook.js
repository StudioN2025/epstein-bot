// api/webhook.js — финальная версия с Google Sheets
module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const SHEET_ID = '1AtFXRO85k3E7TyJ3GW7kogiejMUhFpeLXHgMcoARNSw';
  
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
          const now = Math.floor(Date.now() / 1000);
          
          if (userData.lastFarm && (now - userData.lastFarm) < 3600) {
            const remaining = Math.ceil(3600 - (now - userData.lastFarm));
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            await sendMessage(BOT_TOKEN, chatId, `⏰ Подожди еще ${minutes} мин ${seconds} сек!`);
          } else {
            const soap = Math.floor(Math.random() * 30) + 1;
            userData.balance += soap;
            userData.lastFarm = now;
            userData.username = username;
            
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
            await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Нафарми первый 🧼');
          } else {
            let reply = '🏆 ТОП МЫЛОВАРОВ 🧼\n\n';
            sorted.forEach((user, i) => {
              reply += `${i+1}. ${user.username} — ${user.balance} 🧼\n`;
            });
            await sendMessage(BOT_TOKEN, chatId, reply);
          }
        }
        
        // /start
        else if (text === '/start') {
          await sendMessage(BOT_TOKEN, chatId, 
            `Привет, ${username}! 🧼\n\n` +
            `/farm — нафармить мыло (1-30, раз в час)\n` +
            `/balance — проверить баланс\n` +
            `/top — топ игроков`
          );
        }
      }
      
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error:', error);
      await sendMessage(BOT_TOKEN, req.body?.message?.chat?.id, `❌ Ошибка: ${error.message}`);
      return res.status(200).json({ ok: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};

// ========== ФУНКЦИИ GOOGLE SHEETS ==========

async function loadUserData(sheetId, userId) {
  try {
    const url = `https://opensheet.elk.sh/${sheetId}/Sheet1`;
    const response = await fetch(url);
    const data = await response.json();
    
    const userRow = data.find(row => row.user_id == userId);
    
    if (userRow) {
      return {
        balance: parseInt(userRow.balance) || 0,
        username: userRow.username,
        lastFarm: parseInt(userRow.last_farm) || 0
      };
    }
    return null;
  } catch (error) {
    console.error('Load error:', error);
    return null;
  }
}

async function saveUserData(sheetId, userId, data) {
  try {
    // Получаем все данные
    const url = `https://opensheet.elk.sh/${sheetId}/Sheet1`;
    const response = await fetch(url);
    const rows = await response.json();
    
    // Находим индекс строки пользователя
    const rowIndex = rows.findIndex(row => row.user_id == userId);
    
    if (rowIndex !== -1) {
      // Обновляем существующую строку
      const updateUrl = `https://opensheet.elk.sh/${sheetId}/Sheet1/${rowIndex + 2}`;
      await fetch(updateUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username,
          balance: data.balance,
          last_farm: data.lastFarm
        })
      });
    } else {
      // Добавляем новую строку
      await fetch(`https://opensheet.elk.sh/${sheetId}/Sheet1`, {
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
  } catch (error) {
    console.error('Save error:', error);
  }
}

async function getAllUsers(sheetId) {
  try {
    const url = `https://opensheet.elk.sh/${sheetId}/Sheet1`;
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
    console.error('Get all error:', error);
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
