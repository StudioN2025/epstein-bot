const { sendMessage, saveData } = require('./helpers');

async function handleCasinoCommand(cleanText, rawText, user, data, BOT_TOKEN, chatId, username) {
  if (!cleanText.startsWith('/casino')) return false;
  
  const parts = rawText.split(' ');
  if (parts.length < 3) {
    await sendMessage(BOT_TOKEN, chatId, `🎰 КАЗИНО ТРАМПА 🎰\n\nИспользование: /casino [ставка] [число]\n\nПример: /casino 50 3\nСтавишь 50 мыла на число 3. При победе получаешь x2!`);
    return true;
  }
  const bet = parseInt(parts[1]);
  const userNumber = parseInt(parts[2]);
  if (isNaN(bet) || bet <= 0) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Ставка должна быть положительным числом!`);
    return true;
  }
  if (isNaN(userNumber) || userNumber < 1 || userNumber > 5) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Число должно быть от 1 до 5!`);
    return true;
  }
  if (user.balance < bet) {
    await sendMessage(BOT_TOKEN, chatId, `❌ Не хватает мыла! Есть: ${user.balance}, нужно: ${bet}`);
    return true;
  }
  const casinoNumber = Math.floor(Math.random() * 5) + 1;
  const win = (userNumber === casinoNumber);
  let newBalance = user.balance;
  let resultText = `🎰 КАЗИНО ТРАМПА 🎰\n\n🎲 Ставка: ${bet} 🧼\n🎲 Твоё число: ${userNumber}\n🎲 Число казино: ${casinoNumber}\n\n`;
  if (win) {
    const winAmount = bet * 2;
    newBalance = user.balance + winAmount;
    resultText += `✨ ТЫ ВЫИГРАЛ! ✨\n💰 +${winAmount} 🧼\n\n📊 Баланс: ${newBalance} 🧼\n\n🇺🇸 Трамп говорит: YOU'RE WINNER! 🦅`;
  } else {
    newBalance = user.balance - bet;
    resultText += `💀 ТЫ ПРОИГРАЛ! 💀\n💸 -${bet} 🧼\n\n📊 Баланс: ${newBalance} 🧼\n\n🇺🇸 Трамп говорит: YOU'RE FIRED! 🔥`;
  }
  user.balance = newBalance;
  data.users[userId] = user;
  await saveData(data);
  await sendMessage(BOT_TOKEN, chatId, resultText);
  return true;
}

module.exports = { handleCasinoCommand };
