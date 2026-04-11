const { sendMessage, saveData } = require('./helpers');
const config = require('./config');

async function handleFarmCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
  if (cleanText !== '/farm') return false;
  
  const nowSec = Math.floor(Date.now() / 1000);
  if (user.lastFarm && (nowSec - user.lastFarm) < 3600) {
    const minutes = Math.ceil((3600 - (nowSec - user.lastFarm)) / 60);
    await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, жди ${minutes} мин!`);
    return true;
  }
  
  const soap = Math.floor(Math.random() * 30) + 1;
  user.balance += soap;
  user.lastFarm = nowSec;
  user.username = username;
  let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей, ⚔️ ${user.mobilized || 0} мобилизовано, 🏚️ ${user.basements || 0} подвалов\n📈 Обычные дети приносят ${user.children * config.CHILD_INCOME} 🧼/час`;
  
  if (Math.random() * 100 < config.PIDIDI_STEAL_CHANCE) {
    const stolen = Math.floor(Math.random() * (config.PIDIDI_STEAL_MAX - config.PIDIDI_STEAL_MIN + 1)) + config.PIDIDI_STEAL_MIN;
    if (user.balance - stolen <= 0) {
      user.balance = 0;
      message = `😡👶 ПИДИДИ УКРАЛ ВСЁ!\n${username}, осталось 0 мыла!`;
    } else {
      user.balance -= stolen;
      message = `😡👶 ПИДИДИ УКРАЛ ${stolen} МЫЛА!\n🧼 Осталось: ${user.balance}`;
    }
  }
  
  data.users[userId] = user;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, message);
  return true;
}

module.exports = { handleFarmCommand };
