import { useRef, useState, type FormEvent } from 'react';
import { Badge, Button, Card, Checkbox, DataTable, FormField, Input, Select, Textarea } from './ui';
import { activityCount, awardCoins, COIN_ACTIVITIES, COIN_POLICY, issuedCoins, policyDate, policyYear, type CoinActivity } from '../domain/coins';
import type { Employee, State } from '../domain/model';
const fmt = (n: number) => n.toLocaleString('ru-RU');

export function CoinRules() {
  return <Card><div className="section-heading"><h2>За что начисляются коины</h2><Badge tone="lime">5 коинов = 1 ₽</Badge></div>
    <DataTable headings={['Подтверждённое событие', 'Тариф', 'Лимит']}>
      {COIN_ACTIVITIES.map(a => <tr key={a.id}><td><strong>{a.name}</strong></td><td className="number">+{fmt(a.amount)}</td><td>{a.limit} {a.period === 'year' ? 'в год' : 'за всё время'}</td></tr>)}
    </DataTable><p className="table-note">За заполнение профиля суммарно 3 500 коинов. Вступление в сообщество и обязательные курсы не оплачиваются. События подтверждает HR.</p>
    <p className="table-note">За подтверждённое достижение R1–R5 начисляются баллы и коины: базовый сценарий — 373 коина за балл. Уровень выбирает проверяющий в заявке на достижение. Коины не сгорают со временем; покупки не меняют рейтинг.</p></Card>;
}
export function CoinBudget({ state }: { state: State }) {
  const issued = issuedCoins(state);
  return <Card><Badge>{policyYear()} год</Badge><h3>Лимит новых коинов</h3><p><strong>{fmt(issued)}</strong> из {fmt(COIN_POLICY.annualCeiling)}</p><p className="muted small">Осталось {fmt(Math.max(0, COIN_POLICY.annualCeiling - issued))} коинов. Покупки не восстанавливают лимит выпуска.</p><p className="small muted">Накопленный баланс сохраняется. Для нового начисления должна быть доступна вся сумма в пределах годового лимита.</p></Card>;
}
export function CoinGrantForm({ state, actor, update, onSuccess }: { state: State; actor: Employee; update: (fn: (s: State) => State) => void; onSuccess: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [activity, setActivity] = useState<CoinActivity>('birthday');
  const [eventId, setEventId] = useState(''), [eventDate, setEventDate] = useState(policyDate());
  const [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [error, setError] = useState('');
  const id = useRef(crypto.randomUUID());
  const rule = COIN_ACTIVITIES.find(a => a.id === activity)!;
  const used = activityCount(state, recipient, activity);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!confirmed) { setError('Подтвердите проверку события.'); return; }
    try {
      update(s => awardCoins(s, { id: id.current, actorId: actor.id, employeeId: recipient, activity, eventId, eventDate, reason }));
      id.current = crypto.randomUUID(); setEventId(''); setReason(''); setConfirmed(false); setError(''); onSuccess();
    } catch (err) { setError((err as Error).message); }
  }
  return <form className="grant-form" onSubmit={submit}>
    <FormField id="coin-recipient" label="Получатель"><Select id="coin-recipient" required value={recipient} onChange={e => { setRecipient(e.target.value); setConfirmed(false); }}><option value="" disabled>Выберите сотрудника</option>{state.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></FormField>
    <FormField id="coin-activity" label="Основание начисления"><Select id="coin-activity" value={activity} onChange={e => { setActivity(e.target.value as CoinActivity); setConfirmed(false); }}>{COIN_ACTIVITIES.map(a => <option key={a.id} value={a.id}>{a.name} · {fmt(a.amount)}</option>)}</Select></FormField>
    <p className="notice">К начислению: <strong>{fmt(rule.amount)} коинов</strong><br/>{recipient ? `Использовано ${used} из ${rule.limit} ${rule.period === 'year' ? 'в этом году' : 'за всё время'}.` : 'Выберите получателя для проверки лимита.'} Рейтинг останется прежним.</p>
    <FormField id="coin-event" label="Идентификатор события" hint="Один и тот же ID для всех участников события. Например, community-design-2026-10-30."><Input id="coin-event" required maxLength={200} value={eventId} onChange={e => { setEventId(e.target.value); setConfirmed(false); }} aria-describedby="coin-event-hint"/></FormField>
    <FormField id="coin-date" label="Дата события" hint="Начисления за текущий год"><Input id="coin-date" type="date" required min={`${policyYear()}-01-01`} max={policyDate()} value={eventDate} onChange={e => { setEventDate(e.target.value); setConfirmed(false); }}/></FormField>
    <FormField id="coin-reason" label="Подтверждение и обоснование" hint="Укажите, как проверено событие. Для опроса достаточно факта участия, ответы не нужны."><Textarea id="coin-reason" required maxLength={1000} value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} aria-describedby="coin-reason-hint"/></FormField>
    <Checkbox label="Событие и право сотрудника на начисление проверены" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button type="submit" disabled={!confirmed || !recipient || used >= rule.limit || issuedCoins(state) + rule.amount > COIN_POLICY.annualCeiling}>Начислить {fmt(rule.amount)} коинов</Button>
  </form>;
}
