const { loadData, saveData, sendMessage, cleanCommand, isAdminPrivate, collectChildIncome, collectCapturedBasementsIncome } = require('./modules/helpers');
const config = require('./modules/config');
const { handleDuelCallback, handleDuelCommand } = require('./modules/duels');
const { handleBasementCommand } = require('./modules/basements');
const { handleChildCommand } = require('./modules/children');
const { handleSvoCommand } = require('./modules/svo');
const { handleCasinoCommand } = require('./modules/casino');
const { handlePromoCommand } = require('./modules/promo');
const { handleAdminCommand } = require('./modules/admin');
const { handleNukeCommand } = require('./modules/nuke');
const { handleFarmCommand } = require('./modules/farm');
const { handleBalanceCommand, handleTopCommand, handleTopChildrenCommand, handleTopBasementsCommand, handleTopMobilizedCommand, handleStartCommand } = require('./modules/commands');

let duels = {};

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼' });
  }
  
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      // Обработка callback кнопок
      if (update.callback_query) {
        const callback = update.callback_query;
        const cbData = callback.data;
        
        // Дуэли
        if (cbData.startsWith('accept_') || cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
          return await handleDuelCallback(update, BOT_TOKEN, duels);
        }
      }
      
      // Обработка обычных сообщений
      if (!update.message || !update.message.text) {
        return res.status(200).json({ ok: true });
      }
      
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const username = update.message.from.username || update.message.from.first_name;
      const rawText = update.message.text;
      const cleanText = cleanCommand(rawText);
      
      // Проверка прав доступа
      const isAdminPrivateChat = isAdminPrivate(userId, update.message.chat.type);
      if (chatId !== config.ALLOWED_CHAT_ID && !isAdminPrivateChat) {
        await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
        return res.status(200).json({ ok: true });
      }
      
      // Загружаем данные
      let data = await loadData();
      if (!data.users) data.users = {};
      
      let user = data.users[userId] || { 
        balance: 0, children: 0, basements: 0, username: username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now(),
        nukes: 0
      };
      if (user.children === undefined) user.children = 0;
      if (user.basements === undefined) user.basements = 0;
      if (user.mobilized === undefined) user.mobilized = 0;
      if (user.capturedBasements === undefined) user.capturedBasements = 0;
      if (!user.capturedBasementsDetails) user.capturedBasementsDetails = [];
      if (user.nukes === undefined) user.nukes = 0;
      if (!user.lastChildIncome) user.lastChildIncome = Date.now();
      if (!user.lastCapturedIncome) user.lastCapturedIncome = Date.now();
      
      // Начисляем пассивный доход
      const now = Date.now();
      const childIncome = await collectChildIncome(user, now);
      if (childIncome > 0) {
        user.lastChildIncome = now;
        data.users[userId] = user;
        await saveData(data);
      }
      
      const capturedIncome = await collectCapturedBasementsIncome(user, now);
      if (capturedIncome > 0) {
        user.lastCapturedIncome = now;
        data.users[userId] = user;
        await saveData(data);
      }
      
      // Проверка мута
      if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
        const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
        await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
        return res.status(200).json({ ok: true });
      }
      
      // Проверка на админа
      const isAdmin = await isUserAdmin(BOT_TOKEN, chatId, userId);
      
      // Обработка команд
      if (await handleAdminCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleNukeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleBasementCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleChildCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleSvoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleCasinoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handlePromoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleDuelCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, duels)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleFarmCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleBalanceCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleTopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleTopChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleTopBasementsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleTopMobilizedCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username)) {
        return res.status(200).json({ ok: true });
      }
      else if (await handleStartCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) {
        return res.status(200).json({ ok: true });
      }
      
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).json({ ok: false, error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};

async function isUserAdmin(botToken, chatId, userId) {
  if (userId === config.ADMIN_USER_ID) return true;
  if (chatId === config.ALLOWED_CHAT_ID) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, user_id: userId })
      });
      const data = await response.json();
      if (data.ok && data.result) {
        const status = data.result.status;
        return status === 'creator' || status === 'administrator';
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  return false;
}
