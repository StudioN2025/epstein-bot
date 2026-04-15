import { sendMessage, escapeMarkdown } from './helpers.js';
import config from './config.js';

export async function handleStartCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId, isAdmin) {
  if (cleanText !== '/start') return false;
  
  let adminCommands = '';
  if (isAdmin) {
    adminCommands = `\n\n👑 *АДМИН-КОМАНДЫ:*\n` +
      `/addsoap @user 50\n/removesoap @user 50\n/addchild @user 2\n/removechild @user 2\n` +
      `/addbasement @user 2\n/removebasement @user 2\n/addmobilized @user 2\n/removemobilized @user 2\n` +
      `/createpromo КОД 100 10\n/deletepromo КОД\n/promolist\n/removenuke @user\n`;
  }
  
  let nukeCommands = '';
  if (Date.now() >= config.NUKE_ACTIVATE_DATE) {
    nukeCommands = `\n\n💣 *СЕКРЕТНОЕ ОРУЖИЕ:*\n` +
      `/buynuke — купить бомбу (${config.NUKE_PRICE} 🧼)\n/launchnuke @user — запустить бомбу\n/mynukes — мои бомбы\n`;
  }
  
  await sendMessage(BOT_TOKEN, chatId,
    `🧼 *ОСТРОВ ЭПШТЕЙНА* 🏝️\n\nПривет, ${escapeMarkdown(username)}!\n\n` +
    `🎯 *КОМАНДЫ:*\n` +
    `/farm — фарм мыла (1-30, раз в час)\n` +
    `/balance — баланс\n/top — топ по мылу\n/topchildren — топ по детям\n` +
    `/topbasements — топ по подвалам\n/topmobilized — топ по мобилизованным\n` +
    `/children — мои дети\n/basements — мои подвалы\n` +
    `/buybasement [количество] — купить подвалы (${config.BASEMENT_COST} 🧼/шт)\n` +
    `/buychild [количество] — купить детей (${config.CHILD_COST} 🧼/шт)\n` +
    `/sendsoap @user 50 — перевести мыло\n/sendchild @user 2 — перевести детей\n/sendbasement @user 2 — перевести подвалы\n` +
    `/duel @user [ставка] — дуэль\n/casino [ставка] [число] — казино (x2 при победе)\n` +
    `/promo — ввести промокод\n/activity — моя статистика\n/topactivity [hour/day/week] — топ активности\n\n` +
    `⚔️ *ИВЕНТ СВО (до 18.04.2026):*\n` +
    `/svo — информация\n/mobilize [количество] — мобилизовать детей (${config.MOBILIZATION_COST} 🧼/шт)\n` +
    `/attack @user [количество] — атаковать\n/free @user — освободить подвалы\n/myarmy — моя армия\n/mycaptured — захваченные подвалы` +
    nukeCommands + adminCommands +
    `\n\n📈 Дети приносят ${config.CHILD_INCOME} 🧼/час\n⚠️ Пидиди крадет мыло (5%)\n` +
    `👶 1 ребенок = ${config.CHILD_COST} мыла\n🏚️ 1 подвал = ${config.BASEMENT_COST} мыла\n🔑 1 подвал = ${config.CHILDREN_PER_BASEMENT} детей`);
  return true;
}
