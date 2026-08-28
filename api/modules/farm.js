import { sendMessage, saveData } from './helpers.js';
import config from './config.js';

export async function handleFarmCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/farm') return false;

  const nowSec = Math.floor(Date.now() / 1000);

  // Проверяем, что lastFarm — число и разница меньше часа
  if (user.lastFarm && typeof user.lastFarm === 'number') {
    const diff = nowSec - user.lastFarm;
    if (diff < 3600) {
      const minutes = Math.ceil((3600 - diff) / 60);
      await sendMessage(BOT_TOKEN, chatId, `⏰ ${username}, жди ${minutes} мин!`);
      return true;
    }
  }

  // Если таймер не сработал — выдаём мыло
  const soap = Math.floor(Math.random() * 30) + 1;
  user.balance += soap;
  user.lastFarm = nowSec;
  user.username = username;

  let message = `🧼 ${username}, +${soap} мыла!\n🧼 ${user.balance} мыла, 👶 ${user.children} детей, ⚔️ ${user.mobilized || 0} мобилизовано, 🏚️ ${user.basements || 0} подвалов\n📈 Дети приносят ${user.children * config.CHILD_INCOME} 🧼/час`;

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
