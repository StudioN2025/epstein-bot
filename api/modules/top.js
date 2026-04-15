import { sendMessage, escapeMarkdown } from './helpers.js';
import config from './config.js';

export async function handleTopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/top') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].balance === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏆 Топ пуст! Нафарми мыло первым 🧼');
    return true;
  }
  
  let reply = '🏆 *ТОП МЫЛА НА ОСТРОВЕ* 🏆\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.balance || 0} 🧼 (👶 ${u.children || 0}, ⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0}, +${(u.children || 0) * config.CHILD_INCOME}/ч)\n`;
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

export async function handleTopChildrenCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topchildren') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.children || 0) - (a.children || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].children === 0) {
    await sendMessage(BOT_TOKEN, chatId, '👶 Топ детей пуст!');
    return true;
  }
  
  let reply = '👶 *ТОП ДЕТОВОДОВ* 👶\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    if (u.children > 0) {
      reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.children} 👶 (⚔️ ${u.mobilized || 0}, 🏚️ ${u.basements || 0})\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

export async function handleTopBasementsCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topbasements') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.basements || 0) - (a.basements || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].basements === 0) {
    await sendMessage(BOT_TOKEN, chatId, '🏚️ Топ подвалов пуст!');
    return true;
  }
  
  let reply = '🏚️ *ТОП ПОДВАЛОВ* 🏚️\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    if (u.basements > 0) {
      reply += `${i+1}. ${escapeMarkdown(u.username)} — ${u.basements} 🏚️ (👶 ${u.children || 0})\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}

export async function handleTopMobilizedCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/topmobilized') return false;
  
  const users = Object.values(data.users);
  const sorted = users.sort((a, b) => (b.mobilized || 0) - (a.mobilized || 0)).slice(0, 10);
  
  if (!sorted.length || sorted[0].mobilized === 0) {
    await sendMessage(BOT_TOKEN, chatId, '⚔️ Топ мобилизованных пуст!');
    return true;
  }
  
  let reply = '⚔️ *ТОП МОБИЛИЗОВАННЫХ* ⚔️\n\n';
  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    if (u.mobilized > 0) {
      reply += `${i+1}. ${escapeMarkdown(u.username)} — ⚔️ ${u.mobilized} (👶 ${u.children || 0})\n`;
    }
  }
  await sendMessage(BOT_TOKEN, chatId, reply);
  return true;
}
