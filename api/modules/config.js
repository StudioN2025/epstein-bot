// Конфигурация бота
export const ALLOWED_CHAT_ID = -1003608269453;
export const GROUP_INVITE_LINK = 'https://t.me/epstainisland';

// Пидиди вор
export const PIDIDI_STEAL_CHANCE = 5;
export const PIDIDI_STEAL_MIN = 1;
export const PIDIDI_STEAL_MAX = 10;

// Дети
export const CHILD_COST = 100;
export const CHILD_INCOME = 1;

// Подвалы
export const BASEMENT_COST = 500;
export const CHILDREN_PER_BASEMENT = 10;

// Ивент СВО
export const EVENT_END = new Date('2026-04-18T00:00:00+03:00').getTime();
export const MOBILIZATION_COST = 50;
export const BASEMENT_CAPTURE_REWARD = 10;

// Ядерная бомба
export const NUKE_PRICE = 15000;
export const NUKE_ACTIVATE_DATE = new Date('2026-04-16T00:00:00+03:00').getTime();

// Админ
export const ADMIN_USER_ID = 6644638703;

// Промокоды (начальные)
export const INITIAL_PROMOCODES = {
  'superepstain67': {
    reward: 67,
    maxUses: 5,
    usedCount: 0,
    usedBy: []
  }
};

export default {
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
