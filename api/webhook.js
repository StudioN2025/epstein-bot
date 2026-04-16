const { updateActivityStats } = require('./modules/activity');
const { loadData, saveData, sendMessage, cleanCommand, isAdminPrivate, startWarmup } = require('./modules/helpers');
const config = require('./modules/config');

// Импорты команд – теперь все в одном объекте для быстрого доступа
const commands = {
  // Админские и промо-команды
  '/admin': require('./modules/start').handleAdminCommand,
  '/promo': require('./modules/promo').handlePromoCommand,
  '/createpromo': require('./modules/promo').handleCreatePromo,
  '/promolist': require('./modules/promo').handlePromoList,
  '/deletepromo': require('./modules/promo').handleDeletePromo,
  '/nuke': require('./modules/nuke').handleNukeCommand,

  // Игровые команды
  '/farm': require('./modules/farm').handleFarmCommand,
  '/children': require('./modules/children').handleChildrenCommand,
  '/basement': require('./modules/children').handleBasementCommand,
  '/svo': require('./modules/svo').handleSvoCommand,
  '/casino': require('./modules/casino').handleCasinoCommand,
  '/duel': require('./modules/duel').handleDuelCommand,
  '/activity': require('./modules/activity').handleActivityCommand,

  // Топы
  '/top': require('./modules/start').handleTopCommand,
  '/topchildren': require('./modules/start').handleTopChildrenCommand,
  '/topbasements': require('./modules/start').handleTopBasementsCommand,
  '/topmobilized': require('./modules/start').handleTopMobilizedCommand,
  '/topactivity': require('./modules/activity').handleTopActivityCommand,

  // Стартовая
  '/start': require('./modules/start').handleStartCommand,

  // Переводы мыла/детей/бункеров – предполагается, что они экспортируются из соответствующих модулей
  '/sendsoap': require('./modules/children').handleSendSoap,
  '/sendchild': require('./modules/children').handleSendChild,
  '/sendbasement': require('./modules/children').handleSendBasement,
};

let duels = {};
let adminCache = {};
let adminCacheTime = {};

// Увеличенное время кэша админ-статуса (10 минут)
const ADMIN_CACHE_TTL = 10 * 60 * 1000;

async function isAdminCheck(botToken, chatId, userId) {
  if (userId === config.ADMIN_USER_ID) return true;
  const cacheKey = `${chatId}_${userId}`;
  const now = Date.now();
  if (adminCache[cacheKey] && (now - adminCacheTime[cacheKey]) < ADMIN_CACHE_TTL) {
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
    adminCacheTime[cacheKey] = now;
    return isAdmin;
  } catch (error) {
    return false;
  }
}

// Флаг для отслеживания, были ли реальные изменения данных
let dataChanged = false;

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    startWarmup(BOT_TOKEN);
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼', time: Date.now() });
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const update = req.body;
    
    // Обработка callback-запросов (быстро, без лишней логики)
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
    const cmd = cleanText.split(' ')[0].toLowerCase(); // Приводим к нижнему регистру для поиска
    
    // Проверка чата (кроме личных сообщений админу)
    if (chatId !== config.ALLOWED_CHAT_ID && !isAdminPrivate(userId, update.message.chat.type)) {
      await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return res.status(200).json({ ok: true });
    }
    
    // Загружаем данные один раз
    let data = await loadData();
    if (!data.users) data.users = {};
    dataChanged = false; // сбрасываем флаг
    
    // Обновляем статистику активности (но НЕ сохраняем сразу)
    data = await updateActivityStats(userId, username, data);
    
    // Получаем или создаём пользователя
    let user = data.users[userId];
    if (!user) {
      user = { 
        balance: 0, children: 0, basements: 0, username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now(),
        nukes: 0
      };
      data.users[userId] = user;
      dataChanged = true; // отметим, что данные изменились (новый пользователь)
    } else {
      // Убедимся, что все поля есть (миграция)
      if (user.children === undefined) { user.children = 0; dataChanged = true; }
      if (user.basements === undefined) { user.basements = 0; dataChanged = true; }
      if (user.mobilized === undefined) { user.mobilized = 0; dataChanged = true; }
      if (user.capturedBasements === undefined) { user.capturedBasements = 0; dataChanged = true; }
      if (!user.capturedBasementsDetails) { user.capturedBasementsDetails = []; dataChanged = true; }
      if (user.nukes === undefined) { user.nukes = 0; dataChanged = true; }
    }
    
    // Проверка мута
    if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
      const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
      await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
      // Сохраняем только если были изменения (например, активность), но мута — не критично
      if (dataChanged) await saveData(data);
      return res.status(200).json({ ok: true });
    }
    
    // Проверяем, нужен ли админ-статус для этой команды (список команд, требующих прав)
    const adminRequiredCommands = ['/admin', '/createpromo', '/deletepromo', '/nuke', '/promolist'];
    let isAdmin = false;
    if (adminRequiredCommands.includes(cmd)) {
      isAdmin = await isAdminCheck(BOT_TOKEN, chatId, userId);
    }
    
    // Ищем обработчик в словаре
    const handler = commands[cmd];
    let handled = false;
    if (handler) {
      // Передаём isAdmin только если команда его требует; для остальных передаём false (или можно undefined)
      const adminParam = adminRequiredCommands.includes(cmd) ? isAdmin : false;
      handled = await handler(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, adminParam, duels);
      // Обработчик мог изменить data или user – мы отследим изменения через dataChanged (ручное управление в обработчиках)
      // Либо можно сделать так: после обработчика сравнить data с исходной копией. Но проще – пусть обработчики сами устанавливают dataChanged = true.
      // Для упрощения добавим глобальную переменную dataChanged в область видимости модуля.
    }
    
    // Если команда не найдена или не обработана – просто ничего не делаем
    // Сохраняем данные, если они были изменены
    if (dataChanged) {
      await saveData(data);
    }
    
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};

// Экспортируем dataChanged, чтобы обработчики могли его устанавливать
module.exports.setDataChanged = (value) => { dataChanged = value; };
