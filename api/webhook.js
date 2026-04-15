// ========== OPTIMIZED NODE.JS RUNTIME ==========
import { loadData, saveData, sendMessage, cleanCommand, isAdminPrivate, startWarmup } from './modules/helpers.js';
import config from './modules/config.js';

// Импорт обработчиков команд
import { handleAdminCommand } from './modules/admin.js';
import { handleFarmCommand } from './modules/farm.js';
import { handleChildrenCommand, handleBasementCommand } from './modules/children.js';
import { handleDuelCallback, handleDuelCommand } from './modules/duel.js';
import { handleSvoCommand } from './modules/svo.js';
import { handleCasinoCommand } from './modules/casino.js';
import { handlePromoCommand, handleCreatePromo, handlePromoList, handleDeletePromo } from './modules/promo.js';
import { handleNukeCommand } from './modules/nuke.js';
import { handleSendSoap, handleSendChild, handleSendBasement } from './modules/trade.js';
import { handleActivityCommand, handleTopActivityCommand, updateActivityStats } from './modules/activity.js';
import { handleStartCommand } from './modules/start.js';
import { handleTopCommand, handleTopChildrenCommand, handleTopBasementsCommand, handleTopMobilizedCommand } from './modules/top.js';

// Кэш для дуэлей и админов
let duels = {};
let adminCache = {};
let adminCacheTime = {};

// Кэшированная проверка админа
async function isAdminCheck(botToken, chatId, userId) {
  if (userId === config.ADMIN_USER_ID) return true;
  
  const cacheKey = `${chatId}_${userId}`;
  if (adminCache[cacheKey] && (Date.now() - adminCacheTime[cacheKey]) < 60000) {
    return adminCache[cacheKey];
  }
  
  if (chatId !== config.ALLOWED_CHAT_ID) return false;
  
  try {
    const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId })
    });
    const data = await response.json();
    const isAdmin = data.ok && (data.result.status === 'creator' || data.result.status === 'administrator');
    adminCache[cacheKey] = isAdmin;
    adminCacheTime[cacheKey] = Date.now();
    return isAdmin;
  } catch (error) {
    return false;
  }
}

export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  // GET запрос — проверка жизни и self-ping
  if (req.method === 'GET') {
    startWarmup(BOT_TOKEN);
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼', time: Date.now() });
  }
  
  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const update = req.body;
    
    // ========== CALLBACK КНОПКИ (ДУЭЛИ) ==========
    if (update.callback_query) {
      const cbData = update.callback_query.data;
      if (cbData.startsWith('accept_') || cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
        await handleDuelCallback(update, BOT_TOKEN, duels);
      }
      return res.status(200).json({ ok: true });
    }
    
    // ========== ОБЫЧНЫЕ СООБЩЕНИЯ ==========
    if (!update.message?.text) {
      return res.status(200).json({ ok: true });
    }
    
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const username = update.message.from.username || update.message.from.first_name;
    const rawText = update.message.text;
    const cleanText = cleanCommand(rawText);
    
    // Проверка прав доступа
    if (chatId !== config.ALLOWED_CHAT_ID && !isAdminPrivate(userId, update.message.chat.type)) {
      await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return res.status(200).json({ ok: true });
    }
    
    // Загрузка данных с кэшем
    let data = await loadData();
    if (!data.users) data.users = {};
    
    // Обновление статистики активности
    data = await updateActivityStats(userId, username, data);
    await saveData(data);
    
    // Создание/загрузка пользователя
    let user = data.users[userId];
    if (!user) {
      user = { 
        balance: 0, children: 0, basements: 0, username: username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now(),
        nukes: 0
      };
      data.users[userId] = user;
      await saveData(data);
    }
    
    // Инициализация полей
    user.children ??= 0;
    user.basements ??= 0;
    user.mobilized ??= 0;
    user.capturedBasements ??= 0;
    user.capturedBasementsDetails ??= [];
    user.nukes ??= 0;
    
    // Проверка мута
    if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
      const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
      await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
      return res.status(200).json({ ok: true });
    }
    
    // Проверка админа (с кэшем)
    const isAdmin = await isAdminCheck(BOT_TOKEN, chatId, userId);
    
    // ========== ОБРАБОТКА КОМАНД ==========
    const cmd = cleanText.split(' ')[0];
    
    // Админ-команды
    if (await handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleCreatePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) {
      return res.status(200).json({ ok: true });
    }
    if (await handlePromoList(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleDeletePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) {
      return res.status(200).json({ ok: true });
    }
    
    // Ядерка
    if (await handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) {
      return res.status(200).json({ ok: true });
    }
    
    // Подвалы и дети
    if (await handleBasementCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // СВО
    if (await handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Казино
    if (await handleCasinoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Переводы
    if (await handleSendSoap(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleSendChild(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleSendBasement(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Промокоды
    if (await handlePromoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Дуэли
    if (await handleDuelCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, duels)) {
      return res.status(200).json({ ok: true });
    }
    
    // Фарм
    if (await handleFarmCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Статистика
    if (await handleActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleTopActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Топы
    if (await handleTopCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleTopChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleTopBasementsCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    if (await handleTopMobilizedCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) {
      return res.status(200).json({ ok: true });
    }
    
    // Старт
    if (await handleStartCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) {
      return res.status(200).json({ ok: true });
    }
    
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
