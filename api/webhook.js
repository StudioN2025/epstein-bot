const { loadData, saveData, sendMessage, cleanCommand, isAdminPrivate, startWarmup } = require('./modules/helpers');
const config = require('./modules/config');
const { updateActivityStats } = require('./modules/activity');
const { handleDuelCallback, handleDuelCommand } = require('./modules/duel');

// Импорты команд
const { handleAdminCommand, handleTopCommand, handleTopChildrenCommand, handleTopBasementsCommand, handleTopMobilizedCommand, handleStartCommand } = require('./modules/start');
const { handleFarmCommand } = require('./modules/farm');
const { handleChildrenCommand, handleBasementCommand, handleSendSoap, handleSendChild, handleSendBasement } = require('./modules/children');
const { handleSvoCommand } = require('./modules/svo');
const { handleCasinoCommand } = require('./modules/casino');
const { handlePromoCommand, handleCreatePromo, handlePromoList, handleDeletePromo } = require('./modules/promo');
const { handleNukeCommand } = require('./modules/nuke');
const { handleActivityCommand, handleTopActivityCommand } = require('./modules/activity');

let duels = {};
let adminCache = {};
let adminCacheTime = {};

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

let dataChanged = false;

// Функция для /balance
async function handleBalanceCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/balance') return false;
  
  const hourlyIncome = (user.children || 0) * config.CHILD_INCOME;
  const capturedIncome = (user.capturedBasements || 0) * config.BASEMENT_CAPTURE_REWARD;
  const userBasements = user.basements || 0;
  const maxChildrenPossible = userBasements * config.CHILDREN_PER_BASEMENT;
  
  let nukeInfo = '';
  if (Date.now() >= config.NUKE_ACTIVATE_DATE && (user.nukes || 0) > 0) {
    nukeInfo = `\n\n💣 Ядерных бомб: ${user.nukes}\n/mynukes — подробнее`;
  }
  
  // Функция экранирования
  const escapeMd = (text) => {
    if (!text) return 'Unknown';
    return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  };
  
  await sendMessage(BOT_TOKEN, chatId,
    `📊 *${escapeMd(username)}*\n\n` +
    `🧼 Мыла: ${user.balance}\n` +
    `🏚️ Своих подвалов: ${userBasements}\n` +
    `🏚️ Захваченных подвалов: ${user.capturedBasements || 0}\n` +
    `👶 Обычных детей: ${user.children || 0}\n` +
    `⚔️ Мобилизовано: ${user.mobilized || 0}\n` +
    `📌 Максимум обычных детей: ${maxChildrenPossible}\n` +
    `📈 Доход от обычных детей: ${hourlyIncome} 🧼/час\n` +
    `📈 Доход от захваченных подвалов: ${capturedIncome} 🧼/час${nukeInfo}\n\n` +
    `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
    `/buychild [количество] — купить детей (${config.CHILD_COST} 🧼/шт)\n` +
    `/mobilize [количество] — мобилизовать детей (${config.MOBILIZATION_COST} 🧼/шт)`);
  return true;
}

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    startWarmup(BOT_TOKEN);
    return res.status(200).json({ ok: true, message: 'Epstain Bot 🧼', time: Date.now() });
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
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
    
    if (chatId !== config.ALLOWED_CHAT_ID && !isAdminPrivate(userId, update.message.chat.type)) {
      await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return res.status(200).json({ ok: true });
    }
    
    let data = await loadData();
    if (!data.users) data.users = {};
    dataChanged = false;
    
    data = await updateActivityStats(userId, username, data);
    
    let user = data.users[userId];
    if (!user) {
      user = { 
        balance: 0, children: 0, basements: 0, username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now(),
        nukes: 0
      };
      data.users[userId] = user;
      dataChanged = true;
    } else {
      if (user.children === undefined) { user.children = 0; dataChanged = true; }
      if (user.basements === undefined) { user.basements = 0; dataChanged = true; }
      if (user.mobilized === undefined) { user.mobilized = 0; dataChanged = true; }
      if (user.capturedBasements === undefined) { user.capturedBasements = 0; dataChanged = true; }
      if (!user.capturedBasementsDetails) { user.capturedBasementsDetails = []; dataChanged = true; }
      if (user.nukes === undefined) { user.nukes = 0; dataChanged = true; }
    }
    
    if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
      const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
      await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
      if (dataChanged) await saveData(data);
      return res.status(200).json({ ok: true });
    }
    
    const adminRequiredCommands = ['/addsoap', '/removesoap', '/addchild', '/removechild', '/addbasement', '/removebasement', '/addmobilized', '/removemobilized', '/createpromo', '/deletepromo', '/promolist', '/removenuke'];
    let isAdmin = false;
    if (adminRequiredCommands.includes(cmd)) {
      isAdmin = await isAdminCheck(BOT_TOKEN, chatId, userId);
    }
    
    // Обработка команд
    let handled = false;
    
    // Админ-команды
    if (!handled && adminRequiredCommands.includes(cmd)) {
      handled = await handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin);
    }
    // Промокоды
    if (!handled && await handleCreatePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) handled = true;
    if (!handled && await handlePromoList(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) handled = true;
    if (!handled && await handleDeletePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) handled = true;
    if (!handled && await handlePromoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Ядерка
    if (!handled && await handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) handled = true;
    // Подвалы и дети
    if (!handled && await handleBasementCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Переводы
    if (!handled && await handleSendSoap(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleSendChild(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleSendBasement(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // СВО
    if (!handled && await handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Казино
    if (!handled && await handleCasinoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Дуэли
    if (!handled && await handleDuelCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, duels)) handled = true;
    // Фарм
    if (!handled && await handleFarmCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Активность
    if (!handled && await handleActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Баланс
    if (!handled && await handleBalanceCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Топы
    if (!handled && await handleTopCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopBasementsCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    if (!handled && await handleTopMobilizedCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) handled = true;
    // Старт
    if (!handled && await handleStartCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) handled = true;
    
    if (dataChanged) {
      await saveData(data);
    }
    
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};

module.exports.setDataChanged = (value) => { dataChanged = value; };
