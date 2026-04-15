const { loadData, saveData, sendMessage, cleanCommand, isAdminPrivate, startWarmup } = require('./modules/helpers');
const config = require('./modules/config');
const { handleAdminCommand } = require('./modules/admin');
const { handleFarmCommand } = require('./modules/farm');
const { handleChildrenCommand, handleBasementCommand } = require('./modules/children');
const { handleDuelCallback, handleDuelCommand } = require('./modules/duel');
const { handleSvoCommand } = require('./modules/svo');
const { handleCasinoCommand } = require('./modules/casino');
const { handlePromoCommand, handleCreatePromo, handlePromoList, handleDeletePromo } = require('./modules/promo');
const { handleNukeCommand } = require('./modules/nuke');
const { handleSendSoap, handleSendChild, handleSendBasement } = require('./modules/trade');
const { handleActivityCommand, handleTopActivityCommand, updateActivityStats } = require('./modules/activity');
const { handleStartCommand } = require('./modules/start');
const { handleStartCommand, handleTopCommand, handleTopChildrenCommand, handleTopBasementsCommand, handleTopMobilizedCommand } = require('./modules/start');

let duels = {};
let adminCache = {};
let adminCacheTime = {};

async function isAdminCheck(botToken, chatId, userId) {
  if (userId === config.ADMIN_USER_ID) return true;
  const cacheKey = `${chatId}_${userId}`;
  if (adminCache[cacheKey] && (Date.now() - adminCacheTime[cacheKey]) < 60000) return adminCache[cacheKey];
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
    
    if (chatId !== config.ALLOWED_CHAT_ID && !isAdminPrivate(userId, update.message.chat.type)) {
      await sendMessage(BOT_TOKEN, chatId, `🧼 Детское мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return res.status(200).json({ ok: true });
    }
    
    let data = await loadData();
    if (!data.users) data.users = {};
    
    data = await updateActivityStats(userId, username, data);
    await saveData(data);
    
    let user = data.users[userId];
    if (!user) {
      user = { 
        balance: 0, children: 0, basements: 0, username, lastFarm: 0, mutedUntil: 0, lastChildIncome: Date.now(),
        mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], lastCapturedIncome: Date.now(),
        nukes: 0
      };
      data.users[userId] = user;
      await saveData(data);
    }
    
    if (user.children === undefined) user.children = 0;
    if (user.basements === undefined) user.basements = 0;
    if (user.mobilized === undefined) user.mobilized = 0;
    if (user.capturedBasements === undefined) user.capturedBasements = 0;
    if (!user.capturedBasementsDetails) user.capturedBasementsDetails = [];
    if (user.nukes === undefined) user.nukes = 0;
    
    if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
      const remaining = user.mutedUntil - Math.floor(Date.now() / 1000);
      await sendMessage(BOT_TOKEN, chatId, `🔇 ${username}, мут ${Math.ceil(remaining / 60)} мин!`);
      return res.status(200).json({ ok: true });
    }
    
    const isAdmin = await isAdminCheck(BOT_TOKEN, chatId, userId);
    const cmd = cleanText.split(' ')[0];
    
    // Последовательная проверка команд (без switch из-за динамических require)
    if (await handleAdminCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) return res.status(200).json({ ok: true });
    if (await handleCreatePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) return res.status(200).json({ ok: true });
    if (await handlePromoList(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) return res.status(200).json({ ok: true });
    if (await handleDeletePromo(cmd, rawText, user, data, BOT_TOKEN, chatId, username, isAdmin)) return res.status(200).json({ ok: true });
    if (await handleNukeCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) return res.status(200).json({ ok: true });
    if (await handleBasementCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleSvoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleCasinoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleSendSoap(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleSendChild(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleSendBasement(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handlePromoCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleDuelCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, duels)) return res.status(200).json({ ok: true });
    if (await handleFarmCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleTopActivityCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleTopCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleTopChildrenCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleTopBasementsCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleTopMobilizedCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId)) return res.status(200).json({ ok: true });
    if (await handleStartCommand(cmd, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin)) return res.status(200).json({ ok: true });
    
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};
