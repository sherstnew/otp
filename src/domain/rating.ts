import type { Employee, Entry, State } from './model';
import { ACHIEVEMENT_TYPES, ACHIEVEMENT_LEVELS, achievementReward, type AchievementLevel, type AchievementType } from './achievements';
import { COIN_POLICY, issuedCoins } from './coins';

export type ContributionKind = 'professional' | 'social' | 'management';
export type RequestStatus = 'draft' | 'pending' | 'clarification' | 'approved' | 'rejected' | 'corrected';
export type Audit = { date: string; actorId: string; action: string; reason: string };
export type AchievementRequest = {
  id: string; employeeId: string; authorId: string; reviewerId: string; kind: ContributionKind;
  title: string; action: string; benefit: string; personalRole: string; participants: string;
  source: string; resultDate: string; contributionId: string; publicConsent: boolean;
  status: RequestStatus; audit: Audit[]; entryId?: string; appeal?: string; appealResolution?: string;
  achievementType?: AchievementType; level?: AchievementLevel; coinEntryId?: string;
};
export type ThanksValue = 'result'|'learning'|'enjoyment';
export type Thanks = { id: string; fromId: string; toId: string; message: string; date: string; kind?:'simple'|'weighted'; value?:ThanksValue; points?:number; entryId?:string; ratingNote?:string };
export const thanksValues:Record<ThanksValue,string>={result:'Result — полезный результат',learning:'Learning — новые знания',enjoyment:'Enjoyment — поддержка и удовольствие от работы'};
export type OpportunityApplication = { id: string; employeeId: string; programId: string; path: 'delta' | 'achievement'; achievementId?: string; motivation: string; status: 'pending' | 'accepted' | 'rejected'; audit: Audit[] };
export type RecognitionState = { requests: AchievementRequest[]; thanks: Thanks[]; applications: OpportunityApplication[] };
export const emptyRecognition = (): RecognitionState => ({ requests: [], thanks: [], applications: [] });
export function validRecognition(value: unknown): value is RecognitionState {
  if (!value || typeof value!=='object') return false;
  const s=value as RecognitionState;
  const str=(v:unknown)=>typeof v==='string';
  const audit=(v:unknown)=>Array.isArray(v)&&v.every(a=>a&&str(a.actorId)&&str(a.action)&&str(a.reason)&&str(a.date)&&Number.isFinite(Date.parse(a.date)));
  return Array.isArray(s.requests)&&Array.isArray(s.thanks)&&Array.isArray(s.applications)
    &&s.requests.every(r=>r&&[r.id,r.employeeId,r.authorId,r.reviewerId,r.title,r.action,r.benefit,r.personalRole,r.participants,r.source,r.resultDate,r.contributionId].every(str)&&['professional','social','management'].includes(r.kind)&&['draft','pending','clarification','approved','rejected','corrected'].includes(r.status)&&typeof r.publicConsent==='boolean'&&audit(r.audit)&&(r.achievementType===undefined||ACHIEVEMENT_TYPES.some(t=>t.id===r.achievementType&&t.kind===r.kind))&&(r.level===undefined||Object.hasOwn(ACHIEVEMENT_LEVELS,r.level))&&(r.coinEntryId===undefined||str(r.coinEntryId)))
    &&s.thanks.every(t=>t&&[t.id,t.fromId,t.toId,t.message,t.date].every(str)&&Number.isFinite(Date.parse(t.date))&&(t.kind===undefined||t.kind==='simple'||t.kind==='weighted')&&(t.points===undefined||[0,1,2].includes(t.points))&&(t.kind!=='weighted'||!!t.message.trim()&&!!t.value&&Object.hasOwn(thanksValues,t.value))&&(t.entryId===undefined||str(t.entryId)))
    &&s.applications.every(a=>a&&[a.id,a.employeeId,a.programId,a.motivation].every(str)&&['delta','achievement'].includes(a.path)&&['pending','accepted','rejected'].includes(a.status)&&PROGRAMS.some(p=>p.id===a.programId)&&audit(a.audit));
}
const managers: Record<string, string> = { e1:'e2', e4:'e2', e5:'e2', e6:'e2', e2:'e9', e3:'e9', e7:'e9', e8:'e9', e10:'e12', e11:'e12', e12:'e9' };
export function ratingProfile(employee: Employee) {
  return { managerId: managers[employee.id], group: `${employee.department} · ${employee.role === 'lead' ? 'руководители' : 'специалисты'}`, newcomer: employee.id === 'e6' || employee.id === 'e8' };
}
export function leaderboardGroup(employee:Employee) {
  return `${employee.department} · ${employee.role==='lead'?'руководители':employee.role==='hr'?'HR':'специалисты'}`;
}
export function ratingLeaderboard(state:State,group:string,period:'all'|'recent'='all',today=moscowDay()) {
  const scored=state.employees.filter(e=>leaderboardGroup(e)===group).map(employee=>({employee,score:period==='all'?employee.rating:recentRating(state,employee.id,today)})).sort((a,b)=>b.score-a.score||a.employee.name.localeCompare(b.employee.name,'ru'));
  return scored.map(row=>({...row,place:1+scored.filter(other=>other.score>row.score).length}));
}
export const kindLabel: Record<ContributionKind,string> = { professional:'Профессиональный вклад', social:'Социальный вклад', management:'Управленческий вклад' };
export const statusLabel: Record<RequestStatus,string> = { draft:'Черновик', pending:'На проверке', clarification:'Нужно уточнение', approved:'Подтверждено', rejected:'Отклонено', corrected:'Начисление отменено' };
export const moscowDay = (date = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(date);
export function expiryDay(date: string): string {
  const value = date.length>10?moscowDay(new Date(date)):date, [year, month, day] = value.split('-').map(Number);
  const maxDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return `${year+1}-${String(month).padStart(2,'0')}-${String(Math.min(day,maxDay)).padStart(2,'0')}`;
}
export function ratingEntries(state: State, employeeId: string) {
  const reversed = new Set(state.entries.filter(e => e.reversalOf).map(e => e.reversalOf));
  return state.entries.filter(e => e.employeeId === employeeId && e.kind === 'rating' && e.amount > 0 && !reversed.has(e.id));
}
export function confirmedAchievements(state:State, employeeId:string) {
  const requests=state.recognition.requests.filter(r=>r.employeeId===employeeId&&r.status==='approved');
  const linked=new Set(requests.map(r=>r.entryId));
  return [...requests.map(r=>({id:r.id,title:r.title})),...ratingEntries(state,employeeId).filter(e=>e.category!=='thanks'&&!linked.has(e.id)&&!state.recognition.requests.some(r=>r.entryId===e.id)).map(e=>({id:e.id,title:e.title||e.reason}))];
}
export function recentRating(state: State, employeeId: string, today = moscowDay()) {
  return ratingEntries(state,employeeId).filter(e => {const d = e.effectiveDate || moscowDay(new Date(e.date));return d <= today && today < expiryDay(d);}).reduce((n,e)=>n+e.amount,0);
}
function operation(state: State, id: string) {
  if (!id.trim()) throw new Error('Нужен идентификатор операции.');
  return state.processed.includes(id);
}
function person(state: State, id: string) {
  const p = state.employees.find(e=>e.id===id);
  if (!p) throw new Error('Сотрудник не найден.');
  return p;
}
function note(actorId:string,action:string,reason:string): Audit {return {actorId,action,reason,date:new Date().toISOString()};}
function commit(state:State,id:string,recognition:RecognitionState):State {return {...state,recognition,processed:[...state.processed,id]};}
export function reviewerFor(state: State, employeeId: string, kind: ContributionKind) {
  if (!['professional','social','management'].includes(kind)) throw new Error('Выберите категорию вклада.');
  const employee = person(state,employeeId);
  if (kind === 'management' && employee.role !== 'lead') throw new Error('Управленческий вклад доступен руководителям.');
  const reviewerId = kind === 'social' ? state.employees.find(e=>e.role==='hr' && e.id!==employeeId)?.id : ratingProfile(employee).managerId;
  if (!reviewerId) throw new Error('Ответственный не назначен. Нужен маршрут замещения HR.');
  return reviewerId;
}
export type RequestInput = Pick<AchievementRequest,'employeeId'|'kind'|'title'|'action'|'benefit'|'personalRole'|'participants'|'source'|'resultDate'|'contributionId'|'publicConsent'|'achievementType'> & {id:string;actorId:string;requestId?:string;submit:boolean};
export function saveAchievement(state: State, input: RequestInput): State {
  if(operation(state,input.id)) return state;
  const actor = person(state,input.actorId), employee=person(state,input.employeeId);
  const old = input.requestId ? state.recognition.requests.find(r=>r.id===input.requestId) : undefined;
  if (input.requestId && !old) throw new Error('Заявка не найдена.');
  if (old && (old.authorId!==actor.id || old.employeeId!==employee.id || !['draft','clarification'].includes(old.status))) throw new Error('Эту заявку нельзя редактировать.');
  const reviewerId = reviewerFor(state,employee.id,input.kind);
  if(input.achievementType && !ACHIEVEMENT_TYPES.some(t=>t.id===input.achievementType&&t.kind===input.kind)) throw new Error('Вид достижения не соответствует категории вклада.');
  if(old?.achievementType && !input.achievementType) throw new Error('Выберите вид достижения.');
  if (actor.id!==employee.id && actor.id!==reviewerId && actor.role!=='hr') throw new Error('Можно предложить свой вклад или вклад непосредственного сотрудника в своём потоке.');
  if (!input.title.trim()) throw new Error('Добавьте название достижения.');
  if (input.submit) {
    if ([input.action,input.benefit,input.personalRole,input.source,input.contributionId].some(x=>!x.trim())) throw new Error('Опишите действие, пользу, личную роль, источник и ID вклада.');
    const date=new Date(input.resultDate+'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.resultDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==input.resultDate || input.resultDate>moscowDay()) throw new Error('Укажите действительную дату результата не позднее сегодня.');
    if (state.recognition.requests.some(r=>r.id!==old?.id && r.employeeId===employee.id && r.contributionId===input.contributionId.trim() && ['pending','approved'].includes(r.status))) throw new Error('Этот личный вклад уже подан или признан.');
    if (ratingEntries(state,employee.id).some(e=>e.contributionId===input.contributionId.trim())) throw new Error('Этот личный вклад уже признан.');
  }
  const request:AchievementRequest={id:old?.id||input.id,employeeId:employee.id,authorId:actor.id,reviewerId,kind:input.kind,title:input.title.trim(),action:input.action.trim(),benefit:input.benefit.trim(),personalRole:input.personalRole.trim(),participants:input.participants.trim(),source:input.source.trim(),resultDate:input.resultDate,contributionId:input.contributionId.trim(),publicConsent:input.publicConsent,status:input.submit?'pending':'draft',audit:[...(old?.audit||[]),note(actor.id,input.submit?'Подано на проверку':'Сохранён черновик',input.title.trim())]};
  request.publicConsent = actor.id===employee.id && request.publicConsent;
  if(input.achievementType) request.achievementType=input.achievementType;
  return commit(state,input.id,{...state.recognition,requests:old?state.recognition.requests.map(r=>r.id===old.id?request:r):[request,...state.recognition.requests]});
}
export function decideAchievement(state:State,input:{id:string;actorId:string;requestId:string;decision:'approved'|'rejected'|'clarification';reason:string;amount?:number;level?:AchievementLevel}):State {
  if(operation(state,input.id)) return state;
  const r=state.recognition.requests.find(r=>r.id===input.requestId);
  if(!r || r.status!=='pending') throw new Error('Заявка уже рассмотрена или не отправлена.');
  person(state,input.actorId);
  if(r.reviewerId!==input.actorId || r.employeeId===input.actorId) throw new Error('Недостаточно прав: решение принимает назначенный ответственный, кроме самого получателя.');
  if(!input.reason.trim()) throw new Error('Объясните решение.');
  let next=state;
  if(input.decision==='approved') {
    const reward=r.achievementType?achievementReward(input.level!):undefined;
    const amount=reward?.points??input.amount??0, employee=person(state,r.employeeId);
    if(reward && (issuedCoins(state)+reward.coins>COIN_POLICY.annualCeiling || !Number.isSafeInteger(employee.coins+reward.coins))) throw new Error('Лимит выпуска или баланса коинов исчерпан. Начисление не выполнено.');
    if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(employee.rating+amount)) throw new Error('Укажите положительное целое число баллов.');
    if(ratingEntries(state,r.employeeId).some(e=>e.contributionId===r.contributionId)) throw new Error('Этот личный вклад уже признан.');
    const date=new Date().toISOString();
    const entry:Entry={id:input.id,employeeId:r.employeeId,authorId:input.actorId,kind:'rating',amount,reason:input.reason.trim(),date,effectiveDate:reward?r.resultDate:moscowDay(),resultDate:r.resultDate,title:r.title,contributionId:r.contributionId,category:r.kind,groupAtAward:ratingProfile(employee).group,roleAtAward:employee.role};
    next={...state,employees:state.employees.map(e=>e.id===r.employeeId?{...e,rating:e.rating+amount,coins:e.coins+(reward?.coins||0)}:e),entries:[entry,...(reward?[{...entry,id:`${input.id}:coins`,kind:'coins' as const,amount:reward.coins}]:[]),...state.entries]};
  }
  return commit(next,input.id,{...state.recognition,requests:state.recognition.requests.map(x=>x.id===r.id?{...x,status:input.decision,entryId:input.decision==='approved'?input.id:undefined,...(input.decision==='approved'&&r.achievementType?{level:input.level,coinEntryId:`${input.id}:coins`}:{}),audit:[...x.audit,note(input.actorId,statusLabel[input.decision],input.reason.trim())]}:x)});
}
export function appealAchievement(state:State,input:{id:string;actorId:string;requestId:string;reason:string;resolve?:boolean}):State {
  if(operation(state,input.id)) return state;
  const r=state.recognition.requests.find(r=>r.id===input.requestId),actor=person(state,input.actorId);
  if(!r || !['approved','rejected','corrected'].includes(r.status)) throw new Error('Обращение возможно после решения.');
  if(!input.reason.trim()) throw new Error('Добавьте причину обращения.');
  if(input.resolve ? actor.role!=='hr'||actor.id===r.employeeId||!r.appeal||!!r.appealResolution : actor.id!==r.employeeId||!!r.appeal) throw new Error('Недостаточно прав или обращение уже обработано.');
  return commit(state,input.id,{...state.recognition,requests:state.recognition.requests.map(x=>x.id===r.id?{...x,...(input.resolve?{appealResolution:input.reason.trim()}:{appeal:input.reason.trim()}),audit:[...x.audit,note(actor.id,input.resolve?'Ответ HR':'Обращение',input.reason.trim())]}:x)});
}
export function revokeAchievement(state:State,input:{id:string;actorId:string;requestId:string;reason:string}):State {
  if(operation(state,input.id)) return state;
  const r=state.recognition.requests.find(r=>r.id===input.requestId), actor=person(state,input.actorId);
  if(!r || r.status!=='approved' || actor.role!=='hr' || actor.id===r.employeeId) throw new Error('Исправление доступно другому HR для подтверждённой карточки.');
  if(!input.reason.trim()) throw new Error('Добавьте причину исправления.');
  const entry=state.entries.find(e=>e.id===r.entryId)!;
  const coinEntry=r.coinEntryId?state.entries.find(e=>e.id===r.coinEntryId):undefined;
  if(r.coinEntryId && (!coinEntry || person(state,r.employeeId).coins<coinEntry.amount)) throw new Error('Коины за достижение уже потрачены. Для отмены необходимо восстановить доступный баланс.');
  if(!entry || person(state,r.employeeId).rating<entry.amount) throw new Error('Начисление не найдено или баланс не позволяет исправление.');
  const reversal={authorId:actor.id,reason:input.reason.trim(),date:new Date().toISOString()};
  const next={...state,employees:state.employees.map(e=>e.id===r.employeeId?{...e,rating:e.rating-entry.amount,coins:e.coins-(coinEntry?.amount||0)}:e),entries:[{...entry,...reversal,id:input.id,amount:-entry.amount,reversalOf:entry.id},...(coinEntry?[{...coinEntry,...reversal,id:`${input.id}:coins`,amount:-coinEntry.amount,reversalOf:coinEntry.id}]:[]),...state.entries]};
  return commit(next,input.id,{...state.recognition,requests:state.recognition.requests.map(x=>x.id===r.id?{...x,status:'corrected',audit:[...x.audit,note(actor.id,'Начисление отменено',input.reason.trim())]}:x)});
}
// Team membership follows the direct manager; a lead belongs to the team they lead.
function thanksTeam(e:Employee){return e.role==='lead'?e.id:ratingProfile(e).managerId||e.id;}
export function thanksPreview(state:State,actorId:string,employeeId:string,now=new Date()) {
  const actor=person(state,actorId),recipient=person(state,employeeId),day=moscowDay(now),month=day.slice(0,7);
  const weighted=state.recognition.thanks.filter(t=>t.kind==='weighted');
  const current=weighted.filter(t=>moscowDay(new Date(t.date)).slice(0,7)===month);
  const remaining=Math.max(0,4-current.filter(t=>t.fromId===actorId).length);
  const weight=thanksTeam(actor)===thanksTeam(recipient)?1:2;
  const received=current.filter(t=>t.toId===employeeId).reduce((sum,t)=>sum+(t.points||0),0);
  const start=Math.floor((Number(day.slice(5,7))-1)/3)*3+1;
  const months=Array.from({length:3},(_,i)=>`${day.slice(0,4)}-${String(start+i).padStart(2,'0')}`);
  const pair=[...weighted,{fromId:actorId,toId:employeeId,date:now.toISOString()}];
  const mutual=months.every(m=>pair.some(t=>t.fromId===actorId&&t.toId===employeeId&&moscowDay(new Date(t.date)).startsWith(m))&&pair.some(t=>t.fromId===employeeId&&t.toId===actorId&&moscowDay(new Date(t.date)).startsWith(m)));
  const note=actorId===employeeId?'Нельзя отправить благодарность себе.':!remaining?'В этом месяце использованы все 4 весомых «Спасибо». Можно отправить простое.':mutual?'Регулярные взаимные благодарности: до конца квартала баллы внутри этой пары не начисляются.':current.some(t=>t.fromId===actorId&&t.toId===employeeId)?'В этом месяце вы уже отправляли весомое «Спасибо» этому коллеге. Благодарность придёт без новых баллов.':received>=10?'Коллега уже получил 10 баллов от благодарностей за месяц. Благодарность придёт без новых баллов.':'';
  return {weight,remaining,points:note?0:Math.min(weight,10-received),note};
}
export function sendThanks(state:State,input:{id:string;actorId:string;employeeId:string;message:string;kind?:'simple'|'weighted';value?:ThanksValue},now=new Date()):State {
  if(operation(state,input.id)) return state;
  const actor=person(state,input.actorId),recipient=person(state,input.employeeId),kind=input.kind||'simple';
  if(actor.id===recipient.id) throw new Error('Нельзя отправить благодарность себе.');
  if(kind!=='simple'&&kind!=='weighted')throw new Error('Выберите вид благодарности.');
  if(input.message.length>1500)throw new Error('Комментарий должен быть не длиннее 1500 символов.');
  let points=0,ratingNote='';
  if(kind==='weighted'){
    if(!input.message.trim()||!input.value||!Object.hasOwn(thanksValues,input.value))throw new Error('Опишите, за что благодарите, и выберите ценность.');
    const preview=thanksPreview(state,actor.id,recipient.id,now);
    if(!preview.remaining)throw new Error(preview.note);
    points=preview.points;ratingNote=preview.note;
    if(!Number.isSafeInteger(recipient.rating+points))throw new Error('Превышен допустимый рейтинг.');
  }
  const date=now.toISOString(),entryId=points?input.id:undefined;
  const thanks:Thanks={id:input.id,fromId:actor.id,toId:recipient.id,message:input.message.trim(),date,kind,points,...(entryId?{entryId}:{}),ratingNote,...(kind==='weighted'?{value:input.value}:{})};
  const next=points?{...state,employees:state.employees.map(e=>e.id===recipient.id?{...e,rating:e.rating+points}:e),entries:[{id:input.id,employeeId:recipient.id,authorId:actor.id,kind:'rating' as const,amount:points,reason:input.message.trim(),date,effectiveDate:moscowDay(now),title:'Весомое «Спасибо»',category:'thanks',groupAtAward:ratingProfile(recipient).group,roleAtAward:recipient.role},...state.entries]}:state;
  return commit(next,input.id,{...state.recognition,thanks:[thanks,...state.recognition.thanks]});
}
// Explicit demo program terms, not bank thresholds. Never charge coins or rating.
export const PROGRAMS=[
  {id:'expert',name:'Встреча с экспертом',result:'Обсудить свой проект и получить обратную связь.',threshold:300,seats:4,alternative:true,owner:'HR',selection:'Релевантность запроса и подтверждённого опыта; решение HR'},
  {id:'mentor',name:'Программа наставничества',result:'Составить план развития с наставником.',threshold:150,seats:6,alternative:true,owner:'HR',selection:'Соответствие цели программы и доступность наставника'},
  {id:'pilot',name:'Внутренний пилот',result:'Попробовать новую роль в небольшой проектной команде.',threshold:600,seats:2,alternative:true,owner:'HR',selection:'Навыки и релевантный вклад; решение владельца программы'},
] as const;
export function applyOpportunity(state:State,input:{id:string;employeeId:string;programId:string;path:'delta'|'achievement';achievementId?:string;motivation:string}):State {
  if(operation(state,input.id)) return state;
  person(state,input.employeeId);
  const program=PROGRAMS.find(p=>p.id===input.programId);
  if(!program||!input.motivation.trim()) throw new Error('Выберите программу и опишите цель участия.');
  if(state.recognition.applications.some(a=>a.employeeId===input.employeeId&&a.programId===program.id&&a.status!=='rejected')) throw new Error('Вы уже подали заявку на эту программу.');
  if(input.path==='delta') {if(recentRating(state,input.employeeId)<program.threshold) throw new Error('Пока не достигнут порог. Можно податься по достижению.');}
  else if(input.path==='achievement') {if(!confirmedAchievements(state,input.employeeId).some(r=>r.id===input.achievementId)) throw new Error('Выберите своё подтверждённое достижение.');}
  else throw new Error('Выберите путь подачи.');
  return commit(state,input.id,{...state.recognition,applications:[{...input,status:'pending',audit:[note(input.employeeId,'Подано',input.motivation.trim())]},...state.recognition.applications]});
}
export function decideOpportunity(state:State,input:{id:string;actorId:string;applicationId:string;decision:'accepted'|'rejected';reason:string}):State {
  if(operation(state,input.id)) return state;
  const actor=person(state,input.actorId),a=state.recognition.applications.find(a=>a.id===input.applicationId);
  if(!a||a.status!=='pending'||actor.role!=='hr'||a.employeeId===actor.id) throw new Error('Решение принимает другой HR по ожидающей заявке.');
  if(!input.reason.trim()) throw new Error('Объясните решение.');
  const p=PROGRAMS.find(p=>p.id===a.programId)!;
  if(input.decision==='accepted' && (a.path==='delta' ? recentRating(state,a.employeeId)<p.threshold : !confirmedAchievements(state,a.employeeId).some(r=>r.id===a.achievementId))) throw new Error('Основание подачи больше не действует. Нужна повторная проверка или новая заявка.');
  if(input.decision==='accepted'&&state.recognition.applications.filter(x=>x.programId===p.id&&x.status==='accepted').length>=p.seats) throw new Error('Свободных мест больше нет.');
  return commit(state,input.id,{...state.recognition,applications:state.recognition.applications.map(x=>x.id===a.id?{...x,status:input.decision,audit:[...x.audit,note(actor.id,input.decision==='accepted'?'Место подтверждено':'Отклонено',input.reason.trim())]}:x)});
}
export type TeamMetric = {target:number|null;actual:number|null;direction:'more'|'less';reliable:boolean};
export function teamIndex(metrics:TeamMetric[]) {
  if(metrics.length!==3) return null;
  const values=metrics.map(m=>{
    if(!m.reliable||m.target===null||m.actual===null||!Number.isFinite(m.target)||!Number.isFinite(m.actual)||m.target<=0||m.actual<0||(m.direction==='less'&&m.actual===0)) return null;
    return Math.min(120,(m.direction==='more'?m.actual/m.target:m.target/m.actual)*100);
  });
  if(values.some(v=>v===null)) return null;
  return {indices:values as number[],total:values[0]!*0.5+values[1]!*0.3+values[2]!*0.2};
}
