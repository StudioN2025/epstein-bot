const { loadData, saveData, sendMessage, cleanCommand, startWarmup } = require('./modules/helpers');
const config = require('./modules/config');

let duels = {};

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (req.method === 'GET') {
    startWarmup(BOT_TOKEN);
    return res.status(200).json({ ok: true });
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const update = req.body;
    
    // Кнопки дуэлей
    if (update.callback_query) {
      const cbData = update.callback_query.data;
      if (cbData.startsWith('accept_') || cbData.startsWith('aim_') || cbData.startsWith('break_') || cbData.startsWith('shoot_')) {
        const { handleDuelCallback } = require('./modules/duel');
        await handleDuelCallback(update, BOT_TOKEN, duels);
      }
      return res.status(200).json({ ok: true });
    }
    
    if (!update.message?.text) return res.status(200).json({ ok: true });
    
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;
    const username = update.message.from.username || update.message.from.first_name;
    const text = update.message.text;
    const cmd = cleanCommand(text).split(' ')[0];
    
    // Быстрый доступ только в разрешенную группу
    if (chatId !== config.ALLOWED_CHAT_ID && userId !== config.ADMIN_USER_ID) {
      await sendMessage(BOT_TOKEN, chatId, `🧼 Мыло только на острове: ${config.GROUP_INVITE_LINK}`);
      return res.status(200).json({ ok: true });
    }
    
    // Загрузка данных
    let data = await loadData();
    if (!data.users) data.users = {};
    
    let user = data.users[userId];
    if (!user) {
      user = { balance: 0, children: 0, basements: 0, username, lastFarm: 0, mutedUntil: 0, mobilized: 0, capturedBasements: 0, capturedBasementsDetails: [], nukes: 0 };
      data.users[userId] = user;
      await saveData(data);
    }
    
    // Мут
    if (user.mutedUntil && user.mutedUntil > Math.floor(Date.now() / 1000)) {
      await sendMessage(BOT_TOKEN, chatId, `🔇 Мут ${Math.ceil((user.mutedUntil - Math.floor(Date.now() / 1000)) / 60)} мин!`);
      return res.status(200).json({ ok: true });
    }
    
    // Быстрая маршрутизация команд
    const handlers = {
      '/farm': () => require('./modules/farm').handleFarmCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/balance': () => require('./modules/commands').handleBalanceCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/top': () => require('./modules/top').handleTopCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/start': () => require('./modules/start').handleStartCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId, userId === config.ADMIN_USER_ID),
      '/buybasement': () => require('./modules/children').handleBasementCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/buychild': () => require('./modules/children').handleChildrenCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/casino': () => require('./modules/casino').handleCasinoCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/duel': () => require('./modules/duel').handleDuelCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId, duels),
      '/svo': () => require('./modules/svo').handleSvoCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/mobilize': () => require('./modules/svo').handleSvoCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/attack': () => require('./modules/svo').handleSvoCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/promo': () => require('./modules/promo').handlePromoCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
      '/buynuke': () => require('./modules/nuke').handleNukeCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId, userId === config.ADMIN_USER_ID),
      '/launchnuke': () => require('./modules/nuke').handleNukeCommand(cmd, text, user, data, BOT_TOKEN, chatId, username, userId, userId === config.ADMIN_USER_ID),
      '/sendsoap': () => require('./modules/trade').handleSendSoap(cmd, text, user, data, BOT_TOKEN, chatId, username, userId),
    };
    
    if (handlers[cmd]) {
      await handlers[cmd]();
      await saveData(data);
    }
    
    return res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};
