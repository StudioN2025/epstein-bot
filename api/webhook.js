import { loadData, saveData, sendMessage, cleanCommand, isAdminPrivate, escapeMarkdown } from './modules/helpers.js';
import config from './modules/config.js';
import { updateActivityStats } from './modules/activity.js';
import { handleDuelCallback, handleDuelCommand } from './modules/duel.js';
import { handleAdminCommand, handleTopCommand, handleTopChildrenCommand, handleTopBasementsCommand, handleStartCommand, handleRankCommand } from './modules/start.js';
import { handleFarmCommand } from './modules/farm.js';
import { handleChildrenCommand, handleBasementCommand, handleSendSoap, handleSendChild, handleSendBasement } from './modules/children.js';
import { handleCasinoCommand } from './modules/casino.js';
import { handlePromoCommand, handleCreatePromo, handlePromoList, handleDeletePromo } from './modules/promo.js';
import { handleActivityCommand, handleTopActivityCommand } from './modules/activity.js';
import { handleCreateListing, handleBuyListing, handleRemoveListing, handleShopCommand, handleSellBasementToBank, handleSellChildToBank } from './modules/shop.js';
import { handleNukeCommand } from './modules/nuke.js';

let duels = {};
let adminCache = {};
let adminCacheTime = {};
let dataChanged = false;

const ADMIN_CACHE_TTL = 5 * 60 * 1000;

async function isAdminCheck(botToken, chatId, userId) {
  if (userId === config.ADMIN_USER_ID) return true;
  
  const cacheKey = `${chatId}_${userId}`;
  const now = Date.now();
  if (adminCache[cacheKey] && (now - adminCacheTime[cacheKey]) < ADMIN_CACHE_TTL) {
    return adminCache[cacheKey];
  }
  
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
    adminCacheTime[cacheKey] = now;
    console.log(`Admin check for ${userId}: ${isAdmin}`);
    return isAdmin;
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

// Функция для /balance
async function handleBalanceCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/balance') return false;
  
  const hourlyIncome = (user.children || 0) * config.CHILD_INCOME;
  const userBasements = user.basements || 0;
  const maxChildrenPossible = userBasements * config.CHILDREN_PER_BASEMENT;
  
  await sendMessage(BOT_TOKEN, chatId,
    `📊 *${escapeMarkdown(username)}*\n\n` +
    `🧼 Мыла: ${user.balance}\n` +
    `🏚️ Подвалов: ${userBasements}\n` +
    `👶 Детей: ${user.children || 0}\n` +
    `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
    `📌 Максимум детей: ${maxChildrenPossible}\n` +
    `📈 Доход от детей: ${hourlyIncome} 🧼/час\n\n` +
    `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
    `/buychild [количество] — купить детей (${config.CHILD_COST} 🧼/шт)\n` +
    `/sellbasement [количество] — продать подвалы\n` +
    `/sellchild [количество] — продать детей`);
  return true;
}

// Функция для /events
async function handleEventsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/events') return false;
  
  let reply = `📅 *ИСТОРИЯ ИВЕНТОВ* 📅\n\n`;
  
  if (config.EVENTS.length === 0) {
    reply += `Пока не было ни одного ивента.`;
  } else {
    for (const event of config.EVENTS) {
      reply += `🔸 *${event.name}*\n`;
      reply += `   📆 ${event.period}\n`;
      reply += `   📝 ${event.description}\n`;
      reply += `   🎁 Награды: ${event.rewards}\n\n`;
    }
  }
  
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼', time: Date.now() });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const update = req.body;
    
    if (update.callback_query) {
      const cbData = update.callback_query.data;
      if (cbData.startsWith('accept_') || cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
        await handleDuelCallback(update, BOT_TOKEN, duels);
      }
      return res.status(200).json({ ok: true });
    }
    
    if (!update.message?.text) return res.status(200).json({ ok: true });
    
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const username = update.message.from.username || update.message.from.first_name;
    const rawText = update.message.text;
    const cleanText = cleanCommand(rawText);
    const cmd = cleanText.split(' ')[0];
    
    console.log(`📩 Command: ${cmd} from ${username} (${userId}) in chat ${chatId}`);
    
    // ======== УПРОЩЕННАЯ ПРОВЕРКА ДОСТУПА ========
    const isPrivate = update.message.chat.type === 'private';
    const isAllowedGroup = chatId === config.ALLOWED_CHAT_ID;
    const isAdminUser = userId === config.ADMIN_USER_ID;
    
    console.log(`isPrivate: ${isPrivate}, isAllowedGroup: ${isAllowedGroup}, isAdminUser: ${isAdminUser}`);
    
    // Если это НЕ разрешенная группа И НЕ личка с админом - блокируем
    if (!isAllowedGroup && !(isPrivate && isAdminUser)) {
      console.log(`⛔ Blocked: not allowed group and not admin private`);
      await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return res.status(200).json({ ok: true });
    }
    // =============================================
    
    // Загрузка данных
    let data = await loadData();
    if (!data.users) data.users = {};
    dataChanged = false;
    
    // Обновление активности
    data = await updateActivityStats(userId, username, data);
    
    // Создание пользователя
    let user = data.users[userId];
    if (!user) {
      user = { 
        balance: 0, children: 0, basements: 0, username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now()
      };
      data.users[userId] = user;
      dataChanged = true;
    } else {
      if (user.children === undefined) { user.children = 0; dataChanged = true; }
      if (user.basements === undefined) { user.basements = 0; dataChanged = true; }
      if (user.mobilized === undefined) { user.mobilized = 0; dataChanged = true; }
      if (user.capturedBasements === undefined) { user.capturedBasements = 0; dataChanged = true; }
      if (!user.capturedBasementsDetails) { user.capturedBasementsDetails = []; dataChanged = true; }
    }
    
    // Проверка мута
    if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
      const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
      await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
      if (dataChanged) await saveData(data);
      return res.status(200).json({ ok: true });
    }
    
    // ======== ПРОВЕРКА АДМИНА ТОЛЬКО ДЛЯ АДМИН-КОМАНД ========
    const adminCommands = ['/addsoap', '/removesoap', '/addchild', '/removechild', '/addbasement', '/removebasement', '/addmobilized', '/removemobilized', '/createpromo', '/deletepromo', '/promolist', '/removenuke'];
    let isAdmin = false;
    
    // Проверяем админа ТОЛЬКО если это админ-команда
    if (adminCommands.includes(cmd)) {
      isAdmin = await isAdminCheck(BOT_TOKEN, chatId, userId);
      console.log(`🔐 Admin check for ${cmd}: ${isAdmin}`);
      if (!isAdmin) {
        await sendMessage(BOT_TOKEN, chatId, `❌ Только для админов!`);
        return res.status(200).json({ ok: true });
      }
    }
    // ========================================================
    
    // Обработка команд
    let handled = false;
    
    console.log(`🔄 Processing command: ${cmd}`);
    
    // Админ-команды
    if (!handled && adminCommands.includes(cmd)) {
      handled = await handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin);
    }
    // Промокоды (админские)
    if (!handled && await handleCreatePromo(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) handled = true;
    if (!handled && await handlePromoList(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) handled = true;
    if (!handled && await handleDeletePromo(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) handled = true;
    // Промокоды (обычные)
    if (!handled && await handlePromoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Ядерная бомба
    if (!handled && await handleNukeCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) handled = true;
    // Подвалы и дети
    if (!handled && await handleBasementCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Переводы
    if (!handled && await handleSendSoap(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleSendChild(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleSendBasement(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Казино
    if (!handled && await handleCasinoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Дуэли
    if (!handled && await handleDuelCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, duels)) handled = true;
    // Фарм
    if (!handled && await handleFarmCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Активность
    if (!handled && await handleActivityCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopActivityCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Баланс
    if (!handled && await handleBalanceCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Топы
    if (!handled && await handleTopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopBasementsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Рейтинг
    if (!handled && await handleRankCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Ивенты
    if (!handled && await handleEventsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Магазин
    if (!handled && await handleCreateListing(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleBuyListing(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleRemoveListing(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleShopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Продажа в банк
    if (!handled && await handleSellBasementToBank(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleSellChildToBank(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Старт
    if (!handled && await handleStartCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) handled = true;
    
    if (!handled) {
      console.log(`⚠️ Command ${cmd} not handled`);
    } else {
      console.log(`✅ Command ${cmd} handled successfully`);
    }
    
    // Сохранение изменений
    if (dataChanged) {
      await saveData(data);
    }
    
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
