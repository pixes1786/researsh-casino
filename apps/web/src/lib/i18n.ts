import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ru: { translation: {
    tagline: 'Research prototype. Virtual currency only. No real-money gambling.',
    play: 'Играть', login: 'Войти', register: 'Регистрация', logout: 'Выйти',
    lobby: 'Лобби', games: 'Игры', promotions: 'Промо', vip: 'VIP',
    balance: 'Баланс', roulette: 'Европейская рулетка', spin: 'Крутить',
    place_bet: 'Сделать ставку', clear: 'Очистить', repeat: 'Повтор', double: 'x2', max: 'Макс',
    history: 'История', last_results: 'Последние результаты',
    provably_fair: 'Честная игра', server_seed: 'Серверный seed', client_seed: 'Клиентский seed',
    verify: 'Проверить', win: 'Выигрыш', bet: 'Ставка', red: 'Красное', black: 'Чёрное',
    odd: 'Нечёт', even: 'Чёт', low: '1-18', high: '19-36',
    dozen1: '1-я дюжина', dozen2: '2-я дюжина', dozen3: '3-я дюжина',
    deposit: 'Пополнить', withdraw: 'Вывести',
    payments_disabled: 'В исследовательском макете платежи отключены.',
    responsible: 'Ответственная игра', help: 'Помощь',
  }},
  en: { translation: {
    tagline: 'Research prototype. Virtual currency only. No real-money gambling.',
    play: 'Play', login: 'Login', register: 'Register', logout: 'Logout',
    lobby: 'Lobby', games: 'Games', promotions: 'Promotions', vip: 'VIP',
    balance: 'Balance', roulette: 'European Roulette', spin: 'Spin',
    place_bet: 'Place bet', clear: 'Clear', repeat: 'Repeat', double: 'x2', max: 'Max',
    history: 'History', last_results: 'Last results',
    provably_fair: 'Provably fair', server_seed: 'Server seed', client_seed: 'Client seed',
    verify: 'Verify', win: 'Win', bet: 'Bet', red: 'Red', black: 'Black',
    odd: 'Odd', even: 'Even', low: '1-18', high: '19-36',
    dozen1: '1st dozen', dozen2: '2nd dozen', dozen3: '3rd dozen',
    deposit: 'Deposit', withdraw: 'Withdraw',
    payments_disabled: 'Payments are disabled in the research prototype.',
    responsible: 'Responsible Gaming', help: 'Help',
  }},
  zh: { translation: {
    tagline: '研究原型。仅限虚拟货币。非真实赌博。',
    play: '开始游戏', login: '登录', register: '注册', logout: '退出',
    lobby: '大厅', games: '游戏', promotions: '优惠', vip: 'VIP',
    balance: '余额', roulette: '欧式轮盘', spin: '旋转',
    place_bet: '下注', clear: '清除', repeat: '重复', double: '双倍', max: '最大',
    history: '历史', last_results: '最近结果',
    provably_fair: '公平可验证', server_seed: '服务器种子', client_seed: '客户端种子',
    verify: '验证', win: '赢得', bet: '下注', red: '红', black: '黑',
    odd: '奇', even: '偶', low: '1-18', high: '19-36',
    dozen1: '第一打', dozen2: '第二打', dozen3: '第三打',
    deposit: '充值', withdraw: '提现',
    payments_disabled: '研究原型中已禁用支付。',
    responsible: '负责任博彩', help: '帮助',
  }},
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: typeof window !== 'undefined' ? (localStorage.getItem('locale') ?? 'ru') : 'ru',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}
export default i18n;
