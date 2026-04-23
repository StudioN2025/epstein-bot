const { sendMessage, saveData, escapeMarkdown } = require('./helpers');
const config = require('./config');

// ========== МАГАЗИН (БАРАХОЛКА) ==========

// Получить магазин из данных
function getShop(data) {
  if (!data.shop) data.shop = {};
  if (!data.shop.listings) data.shop.listings = {};
  if (!data.shop.nextId) data.shop.nextId = 1;
  return data.shop;
}

// Сохранить магазин
async function saveShop(data, shop) {
  data.shop = shop;
  await saveData(data);
}

// Создать объявление
async function handleCreateListing(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/sell')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId,
      `🛒 *СОЗДАНИЕ ОБЪЯВЛЕНИЯ* 🛒\n\n` +
      `Использование: /sell [тип] [количество] [цена]\n\n` +
      `Типы:\n` +
      `🧼 мыло — продать мыло\n` +
      `👶 дети — продать детей\n` +
      `🏚️ подвалы — продать подвалы\n\n` +
      `Примеры:\n` +
      `/sell мыло 50 100 — продать 50 мыла за 100 мыла\n` +
      `/sell дети 5 500 — продать 5 детей за 500 мыла\n` +
      `/sell подвалы 2 800 — продать 2 подвала за 800 мыла`);
    return true;
  }
  
  const type = parts[1].toLowerCase();
  let amount = parseInt(parts[2]);
  let price = parseInt(parts[3]);
  
  if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Количество и цена должны быть положительными числами!`);
    return true;
  }
  
  let userAmount = 0;
  let typeName = '';
  let typeEmoji = '';
  
  if (type === 'мыло' || type === 'soap') {
    userAmount = user.balance || 0;
    typeName = 'мыло';
    typeEmoji = '🧼';
  } else if (type === 'дети' || type === 'children') {
    userAmount = user.children || 0;
    typeName = 'детей';
    typeEmoji = '👶';
  } else if (type === 'подвалы' || type === 'basements') {
    userAmount = user.basements || 0;
    typeName = 'подвалов';
    typeEmoji = '🏚️';
  } else {
    await sendMessage(BOT_TOKEN, chatId, `❌ Неизвестный тип! Доступно: мыло, дети, подвалы`);
    return true;
  }
  
  if (userAmount < amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ${amount} ${typeName}! Есть: ${userAmount}`);
    return true;
  }
  
  const shop = getShop(data);
  const listingId = shop.nextId++;
  
  shop.listings[listingId] = {
    id: listingId,
    sellerId: userId,
    sellerName: username,
    type: typeName,
    typeEmoji: typeEmoji,
    amount: amount,
    price: price,
    createdAt: Date.now()
  };
  
  await saveShop(data, shop);
  
  await sendMessage(BOT_TOKEN, chatId,
    `✅ *ОБЪЯВЛЕНИЕ СОЗДАНО!* ✅\n\n` +
    `🆔 ID: ${listingId}\n` +
    `${typeEmoji} Товар: ${amount} ${typeName}\n` +
    `💰 Цена: ${price} 🧼\n\n` +
    `Купить: /buy ${listingId}\n` +
    `Снять: /remove ${listingId}`);
  return true;
}

// Купить объявление
async function handleBuyListing(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/buy')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 2) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /buy 123`);
    return true;
  }
  
  const listingId = parseInt(parts[1]);
  if (isNaN(listingId)) {
    await sendMessage(BOT_TOKEN, chatId, `❌ ID должен быть числом!`);
    return true;
  }
  
  const shop = getShop(data);
  const listing = shop.listings[listingId];
  
  if (!listing) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Объявление с ID ${listingId} не найдено!`);
    return true;
  }
  
  if (listing.sellerId === userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Нельзя купить свой собственный товар!`);
    return true;
  }
  
  if (user.balance < listing.price) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Нужно: ${listing.price} 🧼, есть: ${user.balance} 🧼`);
    return true;
  }
  
  // Получаем продавца
  let seller = data.users[listing.sellerId];
  if (!seller) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Продавец не найден в базе!`);
    return true;
  }
  
  // Проверяем, что у продавца еще есть товар
  let sellerHasAmount = 0;
  if (listing.type === 'мыло') sellerHasAmount = seller.balance || 0;
  else if (listing.type === 'детей') sellerHasAmount = seller.children || 0;
  else if (listing.type === 'подвалов') sellerHasAmount = seller.basements || 0;
  
  if (sellerHasAmount < listing.amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ У продавца больше нет ${listing.amount} ${listing.type}! Объявление удалено.`);
    delete shop.listings[listingId];
    await saveShop(data, shop);
    return true;
  }
  
  // Совершаем сделку
  user.balance -= listing.price;
  seller.balance += listing.price;
  
  if (listing.type === 'мыло') {
    seller.balance -= listing.amount;
    user.balance += listing.amount;
  } else if (listing.type === 'детей') {
    seller.children -= listing.amount;
    user.children += listing.amount;
  } else if (listing.type === 'подвалов') {
    seller.basements -= listing.amount;
    user.basements += listing.amount;
  }
  
  data.users[userId] = user;
  data.users[listing.sellerId] = seller;
  
  // Удаляем объявление
  delete shop.listings[listingId];
  await saveShop(data, shop);
  
  await sendMessage(BOT_TOKEN, chatId,
    `🎉 *ПОКУПКА СОВЕРШЕНА!* 🎉\n\n` +
    `🛒 Товар: ${listing.amount} ${listing.typeEmoji} ${listing.type}\n` +
    `💰 Цена: ${listing.price} 🧼\n\n` +
    `👤 Продавец: ${escapeMarkdown(listing.sellerName)}\n` +
    `👤 Покупатель: ${escapeMarkdown(username)}\n\n` +
    `📊 Твой баланс: ${user.balance} 🧼`);
  return true;
}

// Снять объявление
async function handleRemoveListing(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/remove')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 2) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Пример: /remove 123`);
    return true;
  }
  
  const listingId = parseInt(parts[1]);
  if (isNaN(listingId)) {
    await sendMessage(BOT_TOKEN, chatId, `❌ ID должен быть числом!`);
    return true;
  }
  
  const shop = getShop(data);
  const listing = shop.listings[listingId];
  
  if (!listing) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Объявление с ID ${listingId} не найдено!`);
    return true;
  }
  
  if (listing.sellerId !== userId) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Это не твое объявление!`);
    return true;
  }
  
  delete shop.listings[listingId];
  await saveShop(data, shop);
  
  await sendMessage(BOT_TOKEN, chatId, `✅ Объявление #${listingId} удалено!`);
  return true;
}

// Просмотр магазина
async function handleShopCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (!cleanText.startsWith('/shop')) return false;
  
  const parts = rawText.split(' ');
  const shop = getShop(data);
  const listings = Object.values(shop.listings);
  
  if (listings.length === 0) {
    await sendMessage(BOT_TOKEN, chatId,
      `🛒 *ПУБЛИЧНЫЙ МАГАЗИН* 🛒\n\n` +
      `Здесь пока нет товаров.\n\n` +
      `/sell [тип] [количество] [цена] — выставить товар\n` +
      `/buy [ID] — купить товар\n` +
      `/shop [ID] — посмотреть товар\n` +
      `/shop list — все товары\n` +
      `/shop my — мои товары`);
    return true;
  }
  
  // Просмотр конкретного товара
  if (parts.length >= 2 && !isNaN(parseInt(parts[1]))) {
    const listingId = parseInt(parts[1]);
    const listing = shop.listings[listingId];
    
    if (!listing) {
      await sendMessage(BOT_TOKEN, chatId, `❌ Товар #${listingId} не найден!`);
      return true;
    }
    
    await sendMessage(BOT_TOKEN, chatId,
      `🛒 *ТОВАР #${listing.id}* 🛒\n\n` +
      `${listing.typeEmoji} Тип: ${listing.type}\n` +
      `📦 Количество: ${listing.amount}\n` +
      `💰 Цена: ${listing.price} 🧼\n` +
      `👤 Продавец: ${escapeMarkdown(listing.sellerName)}\n` +
      `📅 Создано: ${new Date(listing.createdAt).toLocaleString()}\n\n` +
      `/buy ${listing.id} — купить`);
    return true;
  }
  
  // Мои товары
  if (parts[1] === 'my') {
    const myListings = listings.filter(l => l.sellerId === userId);
    
    if (myListings.length === 0) {
      await sendMessage(BOT_TOKEN, chatId, `У тебя нет активных объявлений. Создай: /sell`);
      return true;
    }
    
    let reply = `🛒 *МОИ ТОВАРЫ* 🛒\n\n`;
    for (const l of myListings) {
      reply += `🔹 #${l.id} — ${l.amount} ${l.typeEmoji} ${l.type} за ${l.price} 🧼\n`;
    }
    reply += `\n/remove [ID] — снять объявление`;
    await sendMessage(BOT_TOKEN, chatId, reply);
    return true;
  }
  
  // Список всех товаров
  if (parts[1] === 'list' || !parts[1]) {
    const page = parseInt(parts[2]) || 1;
    const perPage = 10;
    const start = (page - 1) * perPage;
    const paginated = listings.slice(start, start + perPage);
    
    if (paginated.length === 0) {
      await sendMessage(BOT_TOKEN, chatId, `📭 На этой странице нет товаров.`);
      return true;
    }
    
    let reply = `🛒 *ПУБЛИЧНЫЙ МАГАЗИН* 🛒\n📄 Страница ${page}\n\n`;
    for (const l of paginated) {
      reply += `🔹 #${l.id} — ${l.amount} ${l.typeEmoji} ${l.type} — ${l.price} 🧼\n`;
      reply += `   👤 ${escapeMarkdown(l.sellerName)}\n`;
    }
    reply += `\n/buy [ID] — купить\n/shop [ID] — подробнее\n/shop list ${page + 1} — след. страница`;
    await sendMessage(BOT_TOKEN, chatId, reply);
    return true;
  }
  
  return false;
}

// Продажа подвалов обратно в мыло
async function handleSellBasementToBank(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/sellbasement') return false;
  
  const parts = rawText.split(' ');
  let amount = 1;
  if (parts.length >= 2) {
    const parsed = parseInt(parts[1]);
    if (!isNaN(parsed) && parsed > 0) amount = parsed;
  }
  
  const userBasements = user.basements || 0;
  if (userBasements < amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ${amount} подвалов! Есть: ${userBasements}`);
    return true;
  }
  
  const totalRefund = amount * config.BASEMENT_COST;
  
  user.basements -= amount;
  user.balance += totalRefund;
  data.users[userId] = user;
  await saveData(data);
  
  await sendMessage(BOT_TOKEN, chatId,
    `🏚️ *ПРОДАЖА ПОДВАЛОВ* 🏚️\n\n` +
    `Продано: ${amount} 🏚️\n` +
    `Получено: ${totalRefund} 🧼\n\n` +
    `📊 Баланс: ${user.balance} 🧼\n` +
    `🏚️ Осталось подвалов: ${user.basements}`);
  return true;
}

// Продажа детей обратно в мыло
async function handleSellChildToBank(cleanText, rawText, user, data, BOT_TOKEN, chatId, username, userId) {
  if (cleanText !== '/sellchild') return false;
  
  const parts = rawText.split(' ');
  let amount = 1;
  if (parts.length >= 2) {
    const parsed = parseInt(parts[1]);
    if (!isNaN(parsed) && parsed > 0) amount = parsed;
  }
  
  const userChildren = user.children || 0;
  if (userChildren < amount) {
    await sendMessage(BOT_TOKEN, chatId, `❌ У тебя нет ${amount} детей! Есть: ${userChildren}`);
    return true;
  }
  
  const totalRefund = amount * config.CHILD_COST;
  
  user.children -= amount;
  user.balance += totalRefund;
  data.users[userId] = user;
  await saveData(data);
  
  await sendMessage(BOT_TOKEN, chatId,
    `👶 *ПРОДАЖА ДЕТЕЙ* 👶\n\n` +
    `Продано: ${amount} 👶\n` +
    `Получено: ${totalRefund} 🧼\n\n` +
    `📊 Баланс: ${user.balance} 🧼\n` +
    `👶 Осталось детей: ${user.children}`);
  return true;
}

module.exports = {
  handleCreateListing,
  handleBuyListing,
  handleRemoveListing,
  handleShopCommand,
  handleSellBasementToBank,
  handleSellChildToBank
};
