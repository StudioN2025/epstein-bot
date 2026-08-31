import { sendMessage, saveData } from './helpers.js';
import config from './config.js';

export async function handleFarmCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  console.log(`🏭 handleFarmCommand called`);
  console.log(`🏭 cleanText: "${cleanText}"`);
  console.log(`🏭 rawText: "${rawText}"`);
  console.log(`🏭 username: ${username}, userId: ${userId}`);
  
  if (cleanText !== '/farm') {
    console.log(`❌ Not /farm, returning false`);
    return false;
  }
  
  console.log(`✅ /farm detected, processing...`);
  
  const nowSec = Math.floor(Date.now() / 1000);
  console.log(`🏭 lastFarm: ${user.lastFarm}, nowSec: ${nowSec}`);
  
  if (user.lastFarm && (nowSec - user.lastFarm) < 3600) {
    const minutes = Math.ceil((3600 - (nowSec - user.lastFarm)) / 60);
    console.log(`⏰ ${username} needs to wait ${minutes} min`);
    await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, жди ${minutes} мин!`);
    return true;
  }
  
  const soap = Math.floor(Math.random() * 30) + 1;
  user.balance += soap;
  user.lastFarm = nowSec;
  user.username = username;
  
  console.log(`🧼 ${username} got +${soap} soap, balance: ${user.balance}`);
  
  let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей, ⚔️ ${user.mobilized || 0} мобилизовано, 🏚️ ${user.basements || 0} подвалов\n📈 Дети приносят ${user.children * config.CHILD_INCOME} 🧼/час`;
  
  if (Math.random() * 100 < config.PIDIDI_STEAL_CHANCE) {
    const stolen = Math.floor(Math.random() * (config.PIDIDI_STEAL_MAX - config.PIDIDI_STEAL_MIN + 1)) + config.PIDIDI_STEAL_MIN;
    console.log(`👶 PIDIDI stole ${stolen} soap from ${username}`);
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
  
  console.log(`✅ /farm completed for ${username}`);
  return true;
}
