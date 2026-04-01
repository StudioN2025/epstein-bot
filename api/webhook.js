const { Telegraf } = require('telegraf');

// Проверяем наличие токена
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN not set in environment variables');
}

const bot = new Telegraf(BOT_TOKEN);

// Обработчик команды /start
bot.start((ctx) => {
  console.log('Received /start command from:', ctx.from?.username);
  ctx.reply('Привет! 👋 Я ваш новый бот на Vercel!');
});

// Обработчик команды /help
bot.help((ctx) => {
  ctx.reply('Доступные команды:\n/start - Приветствие\n/help - Помощь');
});

// Обработчик любых текстовых сообщений
bot.on('text', (ctx) => {
  ctx.reply(`Вы написали: ${ctx.message.text}`);
});

// Основная функция для Vercel
module.exports = async (req, res) => {
  console.log('Received request method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  // Обрабатываем только POST запросы от Telegram
  if (req.method === 'POST') {
    try {
      // Проверяем, есть ли тело запроса
      if (!req.body || Object.keys(req.body).length === 0) {
        console.log('Empty body received');
        return res.status(200).json({ ok: false, error: 'Empty body' });
      }
      
      // Проверяем, что это обновление от Telegram
      if (!req.body.update_id) {
        console.log('Invalid update format:', req.body);
        return res.status(200).json({ ok: false, error: 'Invalid update format' });
      }
      
      console.log('Processing update:', req.body.update_id);
      
      // Обрабатываем обновление через Telegraf
      await bot.handleUpdate(req.body);
      
      // Отвечаем успехом
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error handling update:', error);
      res.status(200).json({ ok: false, error: error.message });
    }
  } else if (req.method === 'GET') {
    // Для GET запросов возвращаем информацию
    res.status(200).json({ 
      ok: true, 
      message: 'Bot is running',
      webhook_info: await getWebhookInfo()
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};

// Вспомогательная функция для получения информации о вебхуке
async function getWebhookInfo() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}
