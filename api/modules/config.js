// Конфигурация бота
const ALLOWED_CHAT_ID = -1003608269453;
const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

// Пидиди вор
const PIDIDI_STEAL_CHANCE = 5;
const PIDIDI_STEAL_MIN = 1;
const PIDIDI_STEAL_MAX = 10;

// Дети
const CHILD_COST = 100;
const CHILD_INCOME = 1;

// Подвалы
const BASEMENT_COST = 500;
const CHILDREN_PER_BASEMENT = 10;

// Ивент СВО
const EVENT_END = new Date('2026-04-18T00:00:00+03:00').getTime();
const MOBILIZATION_COST = 50;
const BASEMENT_CAPTURE_REWARD = 10;

// Ядерная бомба
const NUKE_PRICE = 15000;
const NUKE_ACTIVATE_DATE = new Date('2026-04-23T00:00:00+03:00').getTime();

// Админ
const ADMIN_USER_ID = 6644638703;

// Промокоды (начальные)
const INITIAL_PROMOCODES = {
  'superepstain67': {
    reward: 67,
    maxUses: 5,
    usedCount: 0,
    usedBy: []
  }
};

module.exports = {
  ALLOWED_CHAT_ID,
  GROUP_INVITE_LINK,
  PIDIDI_STEAL_CHANCE,
  PIDIDI_STEAL_MIN,
  PIDIDI_STEAL_MAX,
  CHILD_COST,
  CHILD_INCOME,
  BASEMENT_COST,
  CHILDREN_PER_BASEMENT,
  EVENT_END,
  MOBILIZATION_COST,
  BASEMENT_CAPTURE_REWARD,
  NUKE_PRICE,
  NUKE_ACTIVATE_DATE,
  ADMIN_USER_ID,
  INITIAL_PROMOCODES
};
