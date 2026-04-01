import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# Включаем логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Обработчик команды /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отправляет приветственное сообщение при команде /start"""
    user = update.effective_user
    await update.message.reply_text(
        f"Привет, {user.first_name}! 👋\n"
        f"Я простой бот. Спасибо что запустил меня!"
    )
    logger.info(f"User {user.first_name} started the bot")

# Обработчик команды /help
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отправляет сообщение с помощью"""
    await update.message.reply_text(
        "Доступные команды:\n"
        "/start - Приветствие\n"
        "/help - Помощь"
    )

def main():
    """Запуск бота"""
    # Получаем токен из переменных окружения
    token = os.environ.get("8547334993:AAFhm0SWgI7oLxBJ3W9cBXdHtSlv1qqa6Fg")
    
    if not token:
        logger.error("Токен не найден! Установите переменную окружения TELEGRAM_BOT_TOKEN")
        return
    
    # Создаем приложение
    application = Application.builder().token(token).build()
    
    # Добавляем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    
    # Запускаем бота
    logger.info("Бот запущен и готов к работе!")
    
    # Для Render используем polling
    application.run_polling()

if __name__ == '__main__':
    main()
