// api/webhook.js — исправленная версия
const GOOGLE_SHEET_ID = '1AtFXRO85k3E7TyJ3GW7kogiejMUhFpeLXHgMcoARNSw';

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
        
        // Читаем данные из таблицы
        let userBalance = await getBalance(userId);
        let lastFarm = await getLastFarm(userId);
        
        // /farm
        if (text === '/farm') {
          const now = Math.floor(Date.now() / 1000);
          
          if (lastFarm && (now - lastFarm) < 3600) {
            const remaining = 3600 - (now - lastFarm);
            const minutes = Math.floor(remaining / 60);
            await sendMessage(BOT_TOKEN, chatId, `⏰ Подожди еще ${minutes} минут!`);
          } else {
            const soap = Math.floor(Math.random() * 30) + 1;
            const newBalance = (userBalance || 0) + soap;
            
            // Сохраняем в таблицу
            await saveToSheet(userId, username, newBalance, now);
            
            await sendMessage(BOT_TOKEN, chatId, `🧼 +${soap} мыла!\n📊 Новый баланс: ${newBalance} 🧼`);
          }
        }
        
        // /balance
        else if (text === '/balance') {
          const balance = await getBalance(userId) || 0;
          await sendMessage(BOT_TOKEN, chatId, `📊 ${username}, у тебя ${balance} 🧼`);
        }
        
        // /top
        else if (text === '/top') {
          const topUsers = await getTopUsers();
          
          if (topUsers.length === 0) {
            await sendMessage(BOT_TOKEN, chatId, 'Топ пуст! Нафарми первый 🧼');
          } else {
            let reply = '🏆 ТОП МЫЛОВАРОВ 🧼\n\n';
            topUsers.forEach((user, i) => {
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
      return res.status(200).json({ ok: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};

// ========== ФУНКЦИИ GOOGLE SHEETS (через sheety.co) ==========

async function getBalance(userId) {
  try {
    const response = await fetch(`https://api.sheety.co/${GOOGLE_SHEET_ID}/sheet1`);
    const data = await response.json();
    const sheet1 = data.sheet1 || [];
    
    const user = sheet1.find(row => row.userId == userId);
    return user ? parseInt(user.balance) : 0;
  } catch (error) {
    console.error('Get balance error:', error);
    return 0;
  }
}

async function getLastFarm(userId) {
  try {
    const response = await fetch(`https://api.sheety.co/${GOOGLE_SHEET_ID}/sheet1`);
    const data = await response.json();
    const sheet1 = data.sheet1 || [];
    
    const user = sheet1.find(row => row.userId == userId);
    return user ? parseInt(user.lastFarm) : 0;
  } catch (error) {
    console.error('Get lastFarm error:', error);
    return 0;
  }
}

async function saveToSheet(userId, username, balance, lastFarm) {
  try {
    // Сначала получаем все данные
    const response = await fetch(`https://api.sheety.co/${GOOGLE_SHEET_ID}/sheet1`);
    const data = await response.json();
    const sheet1 = data.sheet1 || [];
    
    const existingUser = sheet1.find(row => row.userId == userId);
    
    if (existingUser) {
      // Обновляем существующего пользователя
      await fetch(`https://api.sheety.co/${GOOGLE_SHEET_ID}/sheet1/${existingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet1: {
            userId: userId,
            username: username,
            balance: balance,
            lastFarm: lastFarm
          }
        })
      });
    } else {
      // Добавляем нового пользователя
      await fetch(`https://api.sheety.co/${GOOGLE_SHEET_ID}/sheet1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet1: {
            userId: userId,
            username: username,
            balance: balance,
            lastFarm: lastFarm
          }
        })
      });
    }
  } catch (error) {
    console.error('Save error:', error);
  }
}

async function getTopUsers() {
  try {
    const response = await fetch(`https://api.sheety.co/${GOOGLE_SHEET_ID}/sheet1`);
    const data = await response.json();
    const sheet1 = data.sheet1 || [];
    
    return sheet1
      .map(row => ({
        username: row.username,
        balance: parseInt(row.balance) || 0
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);
  } catch (error) {
    console.error('Get top error:', error);
    return [];
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
