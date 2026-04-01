const { Telegraf } = require('telegraf');

// Проверяем наличие токена
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN not set in environment variables');
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Обработчик команды /start
bot.start((ctx) => {
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
  try {
    // Получаем обновление от Telegram
    const update = req.body;
    
    // Обрабатываем обновление через Telegraf
    await bot.handleUpdate(update);
    
    // Отвечаем успехом
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error handling update:', error);
    res.status(200).json({ ok: false, error: error.message });
  }
};
