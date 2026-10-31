import type { Employee, Entry, State } from './model';

export type ContributionKind = 'professional' | 'social' | 'management';
export type RequestStatus = 'draft' | 'pending' | 'clarification' | 'approved' | 'rejected' | 'corrected';
export type Audit = { date: string; actorId: string; action: string; reason: string };
export type AchievementRequest = {
  id: string; employeeId: string; authorId: string; reviewerId: string; kind: ContributionKind;
  title: string; action: string; benefit: string; personalRole: string; participants: string;
  source: string; resultDate: string; contributionId: string; publicConsent: boolean;
  status: RequestStatus; audit: Audit[]; entryId?: string; appeal?: string; appealResolution?: string;
};
export type Thanks = { id: string; fromId: string; toId: string; message: string; date: string };
export type OpportunityApplication = { id: string; employeeId: string; programId: string; path: 'delta' | 'achievement'; achievementId?: string; motivation: string; status: 'pending' | 'accepted' | 'rejected'; audit: Audit[] };
export type RecognitionState = { requests: AchievementRequest[]; thanks: Thanks[]; applications: OpportunityApplication[] };
export const emptyRecognition = (): RecognitionState => ({ requests: [], thanks: [], applications: [] });
export function validRecognition(value: unknown): value is RecognitionState {
  if (!value || typeof value!=='object') return false;
  const s=value as RecognitionState;
  const str=(v:unknown)=>typeof v==='string';
  const audit=(v:unknown)=>Array.isArray(v)&&v.every(a=>a&&str(a.actorId)&&str(a.action)&&str(a.reason)&&str(a.date)&&Number.isFinite(Date.parse(a.date)));
  return Array.isArray(s.requests)&&Array.isArray(s.thanks)&&Array.isArray(s.applications)
    &&s.requests.every(r=>r&&[r.id,r.employeeId,r.authorId,r.reviewerId,r.title,r.action,r.benefit,r.personalRole,r.participants,r.source,r.resultDate,r.contributionId].every(str)&&['professional','social','management'].includes(r.kind)&&['draft','pending','clarification','approved','rejected','corrected'].includes(r.status)&&typeof r.publicConsent==='boolean'&&audit(r.audit))
    &&s.thanks.every(t=>t&&[t.id,t.fromId,t.toId,t.message,t.date].every(str)&&Number.isFinite(Date.parse(t.date)))
    &&s.applications.every(a=>a&&[a.id,a.employeeId,a.programId,a.motivation].every(str)&&['delta','achievement'].includes(a.path)&&['pending','accepted','rejected'].includes(a.status)&&PROGRAMS.some(p=>p.id===a.programId)&&audit(a.audit));
}
const managers: Record<string, string> = { e1:'e2', e4:'e2', e5:'e2', e6:'e2', e2:'e9', e3:'e9', e7:'e9', e8:'e9', e10:'e12', e11:'e12', e12:'e9' };
export function ratingProfile(employee: Employee) {
  return { managerId: managers[employee.id], group: `${employee.department} · ${employee.role === 'lead' ? 'руководители' : 'специалисты'}`, newcomer: employee.id === 'e6' || employee.id === 'e8' };
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
export type RequestInput = Pick<AchievementRequest,'employeeId'|'kind'|'title'|'action'|'benefit'|'personalRole'|'participants'|'source'|'resultDate'|'contributionId'|'publicConsent'> & {id:string;actorId:string;requestId?:string;submit:boolean};
export function saveAchievement(state: State, input: RequestInput): State {
  if(operation(state,input.id)) return state;
  const actor = person(state,input.actorId), employee=person(state,input.employeeId);
  const old = input.requestId ? state.recognition.requests.find(r=>r.id===input.requestId) : undefined;
  if (input.requestId && !old) throw new Error('Заявка не найдена.');
  if (old && (old.authorId!==actor.id || old.employeeId!==employee.id || !['draft','clarification'].includes(old.status))) throw new Error('Эту заявку нельзя редактировать.');
  const reviewerId = reviewerFor(state,employee.id,input.kind);
  if (actor.id!==employee.id && actor.id!==reviewerId) throw new Error('Можно предложить свой вклад или вклад непосредственного сотрудника в своём потоке.');
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
  return commit(state,input.id,{...state.recognition,requests:old?state.recognition.requests.map(r=>r.id===old.id?request:r):[request,...state.recognition.requests]});
}
export function decideAchievement(state:State,input:{id:string;actorId:string;requestId:string;decision:'approved'|'rejected'|'clarification';reason:string;amount?:number}):State {
  if(operation(state,input.id)) return state;
  const r=state.recognition.requests.find(r=>r.id===input.requestId);
  if(!r || r.status!=='pending') throw new Error('Заявка уже рассмотрена или не отправлена.');
  person(state,input.actorId);
  if(r.reviewerId!==input.actorId || r.employeeId===input.actorId) throw new Error('Недостаточно прав: решение принимает назначенный ответственный, кроме самого получателя.');
  if(!input.reason.trim()) throw new Error('Объясните решение.');
  let next=state;
  if(input.decision==='approved') {
    const amount=input.amount??0, employee=person(state,r.employeeId);
    if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(employee.rating+amount)) throw new Error('Укажите положительное целое число баллов. Общая шкала ещё калибруется.');
    if(ratingEntries(state,r.employeeId).some(e=>e.contributionId===r.contributionId)) throw new Error('Этот личный вклад уже признан.');
    const date=new Date().toISOString();
    const entry:Entry={id:input.id,employeeId:r.employeeId,authorId:input.actorId,kind:'rating',amount,reason:input.reason.trim(),date,effectiveDate:moscowDay(),resultDate:r.resultDate,title:r.title,contributionId:r.contributionId,category:r.kind,groupAtAward:ratingProfile(employee).group,roleAtAward:employee.role};
    next={...state,employees:state.employees.map(e=>e.id===r.employeeId?{...e,rating:e.rating+amount}:e),entries:[entry,...state.entries]};
  }
  return commit(next,input.id,{...state.recognition,requests:state.recognition.requests.map(x=>x.id===r.id?{...x,status:input.decision,entryId:input.decision==='approved'?input.id:undefined,audit:[...x.audit,note(input.actorId,statusLabel[input.decision],input.reason.trim())]}:x)});
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
  if(!entry || person(state,r.employeeId).rating<entry.amount) throw new Error('Начисление не найдено или баланс не позволяет исправление.');
  const next={...state,employees:state.employees.map(e=>e.id===r.employeeId?{...e,rating:e.rating-entry.amount}:e),entries:[{...entry,id:input.id,authorId:actor.id,amount:-entry.amount,reason:input.reason.trim(),date:new Date().toISOString(),reversalOf:entry.id},...state.entries]};
  return commit(next,input.id,{...state.recognition,requests:state.recognition.requests.map(x=>x.id===r.id?{...x,status:'corrected',audit:[...x.audit,note(actor.id,'Начисление отменено',input.reason.trim())]}:x)});
}
export function sendThanks(state:State,input:{id:string;actorId:string;employeeId:string;message:string}):State {
  if(operation(state,input.id)) return state;
  person(state,input.actorId); person(state,input.employeeId);
  if(input.actorId===input.employeeId || !input.message.trim()) throw new Error('Выберите коллегу и напишите благодарность.');
  return commit(state,input.id,{...state.recognition,thanks:[{id:input.id,fromId:input.actorId,toId:input.employeeId,message:input.message.trim(),date:new Date().toISOString()},...state.recognition.thanks]});
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
  else if(input.path==='achievement') {if(!state.recognition.requests.some(r=>r.id===input.achievementId&&r.employeeId===input.employeeId&&r.status==='approved')) throw new Error('Выберите своё подтверждённое достижение.');}
  else throw new Error('Выберите путь подачи.');
  return commit(state,input.id,{...state.recognition,applications:[{...input,status:'pending',audit:[note(input.employeeId,'Подано',input.motivation.trim())]},...state.recognition.applications]});
}
export function decideOpportunity(state:State,input:{id:string;actorId:string;applicationId:string;decision:'accepted'|'rejected';reason:string}):State {
  if(operation(state,input.id)) return state;
  const actor=person(state,input.actorId),a=state.recognition.applications.find(a=>a.id===input.applicationId);
  if(!a||a.status!=='pending'||actor.role!=='hr'||a.employeeId===actor.id) throw new Error('Решение принимает другой HR по ожидающей заявке.');
  if(!input.reason.trim()) throw new Error('Объясните решение.');
  const p=PROGRAMS.find(p=>p.id===a.programId)!;
  if(input.decision==='accepted' && (a.path==='delta' ? recentRating(state,a.employeeId)<p.threshold : !state.recognition.requests.some(r=>r.id===a.achievementId&&r.status==='approved'&&r.employeeId===a.employeeId))) throw new Error('Основание подачи больше не действует. Нужна повторная проверка или новая заявка.');
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
