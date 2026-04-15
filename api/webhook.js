// ========== EDGE RUNTIME ДЛЯ МАКСИМАЛЬНОЙ СКОРОСТИ ==========
export const runtime = 'edge';
export const preferredRegion = 'fra1'; // Frankfurt - ближе к России

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

// Кэш для дуэлей (в памяти)
let duels = {};

// Главный обработчик
export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  // GET запрос — проверка жизни и self-ping
  if (req.method === 'GET') {
    startWarmup(BOT_TOKEN);
    return new Response(JSON.stringify({ ok: true, message: 'Epstain Bot 🧼', time: Date.now() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Только POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const update = await req.json();
    
    // ========== CALLBACK КНОПКИ (ДУЭЛИ) ==========
    if (update.callback_query) {
      const cbData = update.callback_query.data;
      if (cbData.startsWith('accept_') || cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
        await handleDuelCallback(update, BOT_TOKEN, duels);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    // ========== ОБЫЧНЫЕ СООБЩЕНИЯ ==========
    if (!update.message?.text) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const username = update.message.from.username || update.message.from.first_name;
    const rawText = update.message.text;
    const cleanText = cleanCommand(rawText);
    
    // Проверка прав доступа
    if (chatId !== config.ALLOWED_CHAT_ID && !isAdminPrivate(userId, update.message.chat.type)) {
      await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
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
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    
    // Проверка админа
    const isAdmin = await isAdminCheck(BOT_TOKEN, chatId, userId);
    
    // ========== ОБРАБОТКА КОМАНД (быстрый switch через объект) ==========
    const cmd = cleanText.split(' ')[0];
    
    const handlers = {
      // Админ-команды
      '/addsoap': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/removesoap': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/addchild': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/removechild': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/addbasement': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/removebasement': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/addmobilized': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/removemobilized': () => handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/createpromo': () => handleCreatePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/deletepromo': () => handleDeletePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/promolist': () => handlePromoList(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin),
      '/removenuke': () => handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin),
      
      // Основные команды
      '/farm': () => handleFarmCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/buybasement': () => handleBasementCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/basements': () => handleBasementCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/buychild': () => handleChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/children': () => handleChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Дуэли
      '/duel': () => handleDuelCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, duels),
      
      // СВО
      '/svo': () => handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/mobilize': () => handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/attack': () => handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/free': () => handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/myarmy': () => handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/mycaptured': () => handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Казино
      '/casino': () => handleCasinoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Переводы
      '/sendsoap': () => handleSendSoap(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/sendchild': () => handleSendChild(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/sendbasement': () => handleSendBasement(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Промокоды
      '/promo': () => handlePromoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Ядерка
      '/buynuke': () => handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin),
      '/launchnuke': () => handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin),
      '/mynukes': () => handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin),
      
      // Статистика
      '/activity': () => handleActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/topactivity': () => handleTopActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Топы
      '/top': () => handleTopCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/topchildren': () => handleTopChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/topbasements': () => handleTopBasementsCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      '/topmobilized': () => handleTopMobilizedCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId),
      
      // Старт
      '/start': () => handleStartCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)
    };
    
    const handler = handlers[cmd];
    if (handler) {
      await handler();
    }
    
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200 });
  }
}

// Кэшированная проверка админа
let adminCache = {};
let adminCacheTime = {};

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
