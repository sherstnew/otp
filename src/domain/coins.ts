import type { State } from './model';

// Planning snapshot supplied by Nikita on 31 October 2026; not a bank commitment.
export const COIN_POLICY = { coinsPerRuble: 5, annualCeiling: 56_731_591, forecast: 55_583_000 } as const;
export const COIN_ACTIVITIES = [
  { id: 'birthday', name: 'День рождения', amount: 1000, limit: 1, period: 'year' },
  { id: 'tenure', name: 'Годовщина работы', amount: 1500, limit: 1, period: 'year' },
  { id: 'first-login', name: 'Первый вход новичка', amount: 750, limit: 1, period: 'lifetime' },
  { id: 'profile-blocks', name: 'Основные разделы профиля', amount: 2000, limit: 1, period: 'lifetime' },
  { id: 'profile-contact', name: 'Телефон и фото в профиле', amount: 1500, limit: 1, period: 'lifetime' },
  { id: 'enps-1', name: 'Onboarding eNPS · первый месяц', amount: 250, limit: 1, period: 'lifetime' },
  { id: 'enps-3', name: 'Onboarding eNPS · третий месяц', amount: 250, limit: 1, period: 'lifetime' },
  { id: 'probation', name: 'Завершение испытательного срока', amount: 2500, limit: 1, period: 'lifetime' },
  { id: 'annual-survey', name: 'Годовой опрос', amount: 1000, limit: 1, period: 'year' },
  { id: 'community', name: 'Подтверждённое посещение сообщества', amount: 1000, limit: 4, period: 'year' },
] as const;
export type CoinActivity = typeof COIN_ACTIVITIES[number]['id'];
export type CoinAward = { id: string; employeeId: string; activity: CoinActivity; eventId: string; eventDate: string; date: string; amount: number };
export const policyYear = (date = new Date()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', year: 'numeric' }).format(date));
export const policyDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
export function issuedCoins(state: State, year = policyYear()) {
  // Include old manual/demo grants; purchases never restore the issuance quota.
  return state.entries.filter(e => e.kind === 'coins' && e.amount > 0 && policyYear(new Date(e.date)) === year).reduce((sum, e) => sum + e.amount, 0);
}
export function activityCount(state: State, employeeId: string, activity: CoinActivity, year = policyYear()) {
  const rule = COIN_ACTIVITIES.find(a => a.id === activity)!;
  return state.coinAwards.filter(a => a.employeeId === employeeId && a.activity === activity && (rule.period === 'lifetime' || Number(a.eventDate.slice(0,4)) === year)).length;
}
export function awardCoins(state: State, input: { id: string; actorId: string; employeeId: string; activity: CoinActivity; eventId: string; eventDate: string; reason: string }): State {
  if (!input.id.trim()) throw new Error('Укажите идентификатор операции.');
  if (state.processed.includes(input.id)) return state;
  const actor = state.employees.find(e => e.id === input.actorId);
  const employee = state.employees.find(e => e.id === input.employeeId);
  if (!actor || !employee) throw new Error('Сотрудник не найден.');
  if (actor.role !== 'hr') throw new Error('Недостаточно прав для начисления коинов.');
  const rule = COIN_ACTIVITIES.find(a => a.id === input.activity);
  if (!rule) throw new Error('Выберите основание из правил начисления.');
  if (!input.reason.trim() || !input.eventId.trim()) throw new Error('Добавьте обоснование и идентификатор подтверждённого события.');
  const eventTime = new Date(input.eventDate + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) || !Number.isFinite(eventTime.getTime()) || eventTime.toISOString().slice(0,10) !== input.eventDate || Number(input.eventDate.slice(0,4)) !== policyYear() || input.eventDate > policyDate()) throw new Error('Укажите прошедшую дату события в текущем году.');
  if (state.coinAwards.some(a => a.employeeId === employee.id && a.eventId === input.eventId.trim())) throw new Error('Это событие уже оплачено сотруднику.');
  if (activityCount(state, employee.id, rule.id) >= rule.limit) throw new Error('Лимит начислений по этому основанию исчерпан.');
  if (issuedCoins(state) + rule.amount > COIN_POLICY.annualCeiling) throw new Error('Годовой лимит выпуска исчерпан. Начисление не выполнено.');
  if (!Number.isSafeInteger(employee.coins + rule.amount)) throw new Error('Баланс превышает допустимое значение.');
  const date = new Date().toISOString();
  return { ...state,
    employees: state.employees.map(e => e.id === employee.id ? { ...e, coins: e.coins + rule.amount } : e),
    entries: [{ id: input.id, employeeId: employee.id, authorId: actor.id, kind: 'coins', amount: rule.amount, reason: `${rule.name}: ${input.reason.trim()}`, date }, ...state.entries],
    coinAwards: [{ id: input.id, employeeId: employee.id, activity: rule.id, eventId: input.eventId.trim(), eventDate: input.eventDate, date, amount: rule.amount }, ...state.coinAwards],
    processed: [...state.processed, input.id],
  };
}
