// api/webhook.js — минимальная рабочая версия
module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  // На любой GET запрос просто говорим что живы
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'alive', time: Date.now() });
  }
  
  // Только POST от Telegram
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      // Если есть текст от пользователя
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const username = update.message.from.first_name;
        
        let reply = '';
        
        if (text === '/start') {
          reply = `Привет, ${username}! 🧼\n\n/farm — фарм мыла\n/balance — баланс`;
        } else if (text === '/farm') {
          const soap = Math.floor(Math.random() * 30) + 1;
          reply = `🧼 Ты нафармил ${soap} мыла!\n(Баланс пока не сохраняется)`;
        } else if (text === '/balance') {
          reply = `📊 ${username}, у тебя пока 0 мыла (база не подключена)`;
        } else {
          reply = `Используй команды: /start, /farm, /balance`;
        }
        
        // Отправляем ответ
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: reply })
        });
      }
      
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Error:', err);
      return res.status(200).json({ ok: false });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
