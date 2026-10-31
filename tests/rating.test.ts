import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, purchase, seed } from '../src/domain/model';
import { appealAchievement, applyOpportunity, decideAchievement, decideOpportunity, expiryDay, moscowDay, ratingProfile, recentRating, reviewerFor, revokeAchievement, saveAchievement, sendThanks, teamIndex, type RequestInput } from '../src/domain/rating';
const input:RequestInput={id:'achievement',actorId:'e1',employeeId:'e1',kind:'professional',title:'Автоматизация отчёта',action:'Создала инструмент',benefit:'Время подготовки сократилось',personalRole:'Спроектировала и проверила',participants:'Команда аналитики',source:'Замеры до и после',resultDate:moscowDay(),contributionId:'report-e1',publicConsent:true,submit:true};
const approve={id:'approval',actorId:'e2',requestId:'achievement',decision:'approved' as const,reason:'Проверены замеры и личный вклад',amount:150};
test('draft does not award; submit, clarify, resubmit and approve form one audited workflow',()=>{
  let s=saveAchievement(seed(),{...input,submit:false});
  assert.equal(s.employees[0].rating,780); assert.equal(s.recognition.requests[0].status,'draft');
  s=saveAchievement(s,{...input,id:'submit',requestId:'achievement'});
  s=decideAchievement(s,{...approve,id:'clarify',decision:'clarification',reason:'Нужны замеры'});
  assert.equal(s.employees[0].rating,780);
  s=saveAchievement(s,{...input,id:'resubmit',requestId:'achievement'});
  s=decideAchievement(s,approve);
  assert.equal(s.employees[0].rating,930);assert.equal(s.employees[0].coins,4250);
  assert.equal(s.recognition.requests[0].audit.length,5);
  assert.equal(s.entries[0].effectiveDate,moscowDay());assert.equal(s.entries[0].roleAtAward,'employee');
  assert.equal(decideAchievement(s,approve),s);assert.deepEqual(loadState(JSON.stringify(s)),s);
});
test('routing uses direct manager, HR social stream and higher manager for a lead',()=>{
  const s=seed();assert.equal(reviewerFor(s,'e1','professional'),'e2');assert.equal(reviewerFor(s,'e1','social'),'e3');assert.equal(reviewerFor(s,'e2','management'),'e9');
  assert.throws(()=>reviewerFor(s,'e1','management'));
  assert.throws(()=>reviewerFor(s,'e9','management'),/не назначен/);
  assert.throws(()=>reviewerFor(s,'e3','social'),/не назначен/);
  const n=saveAchievement(s,{...input,actorId:'e2',employeeId:'e2',kind:'management'});
  assert.throws(()=>decideAchievement(n,approve),/прав/);
  assert.doesNotThrow(()=>decideAchievement(n,{...approve,actorId:'e9'}));
  assert.notEqual(ratingProfile(s.employees[0]).group,ratingProfile(s.employees[1]).group);
});
test('unassigned reviewers and self decisions cannot issue points; social goes only to HR',()=>{
  const n=saveAchievement(seed(),input);
  for(const actorId of ['e1','e3','e9','e12']) assert.throws(()=>decideAchievement(n,{...approve,actorId}),/прав/);
  const social=saveAchievement(seed(),{...input,kind:'social'});
  assert.throws(()=>decideAchievement(social,approve),/прав/);
  assert.doesNotThrow(()=>decideAchievement(social,{...approve,actorId:'e3'}));
});
test('required evidence, dates, positive integral points and unique personal contribution',()=>{
  for(const patch of [{source:''},{benefit:''},{personalRole:''},{contributionId:''},{resultDate:'2026-02-30'},{actorId:'e12'}])assert.throws(()=>saveAchievement(seed(),{...input,...patch}));
  const n=saveAchievement(seed(),input);assert.equal(saveAchievement(n,input),n);
  assert.throws(()=>saveAchievement(n,{...input,id:'duplicate'}),/уже/);
  for(const amount of [0,-1,1.2,Infinity,NaN,Number.MAX_SAFE_INTEGER])assert.throws(()=>decideAchievement(n,{...approve,amount}));
  const a=decideAchievement(n,approve);
  assert.throws(()=>decideAchievement(a,{...approve,id:'second'}),/рассмотрена/);
  assert.throws(()=>saveAchievement(a,{...input,id:'duplicate'}),/уже/);
  assert.throws(()=>saveAchievement(a,{...input,id:'edit',requestId:'achievement'}),/редактировать/);
});
test('different personal roles in one result may be recognized, nomination does not fabricate consent',()=>{
  let s=saveAchievement(seed(),input);
  s=saveAchievement(s,{...input,id:'other',employeeId:'e4',actorId:'e2',contributionId:'report-e4'});
  assert.equal(s.recognition.requests[0].publicConsent,false);
  assert.equal(s.recognition.requests[1].publicConsent,true);
});
test('rolling window excludes future and expired entries without reducing accumulated total',()=>{
  const s=seed();s.entries=[
    {id:'old',employeeId:'e1',authorId:'e2',kind:'rating',amount:40,reason:'old',date:'2025-10-31T09:00:00Z'},
    {id:'included',employeeId:'e1',authorId:'e2',kind:'rating',amount:300,reason:'new',date:'2025-11-01T09:00:00Z'},
    {id:'future',employeeId:'e1',authorId:'e2',kind:'rating',amount:20,reason:'future',date:'2026-11-01T09:00:00Z'},
  ];
  assert.equal(recentRating(s,'e1','2026-10-31'),300);assert.equal(recentRating(s,'e1','2026-11-01'),20);assert.equal(s.employees[0].rating,780);
  assert.equal(expiryDay('2024-02-29'),'2025-02-28');assert.equal(expiryDay('2025-02-28'),'2026-02-28');
  assert.equal(expiryDay('2025-10-30T22:30:00Z'),'2026-10-31');
});
test('appeal preserves points until a reasoned correction; correction is audited and idempotent',()=>{
  let s=decideAchievement(saveAchievement(seed(),input),approve);
  s=appealAchievement(s,{id:'appeal',actorId:'e1',requestId:'achievement',reason:'Проверить авторство'});
  assert.equal(s.employees[0].rating,930);
  assert.throws(()=>revokeAchievement(s,{id:'wrong',actorId:'e2',requestId:'achievement',reason:'Ошибка'}),/HR/);
  const revoke={id:'correct',actorId:'e3',requestId:'achievement',reason:'Повторный учёт личного вклада'};
  s=revokeAchievement(s,revoke);assert.equal(s.employees[0].rating,780);assert.equal(recentRating(s,'e1'),recentRating(seed(),'e1'));
  assert.equal(s.entries[0].reversalOf,'approval');assert.equal(revokeAchievement(s,revoke),s);
  assert.throws(()=>revokeAchievement(s,{...revoke,id:'again'}));
  s=appealAchievement(s,{id:'answer',actorId:'e3',requestId:'achievement',reason:'Исправлено',resolve:true});
  assert.equal(s.recognition.requests[0].appealResolution,'Исправлено');
});
test('simple thanks is private to participants and does not mint rating or coins',()=>{
  const s=seed(),n=sendThanks(s,{id:'thanks',actorId:'e1',employeeId:'e4',message:'Помог с запуском'});
  assert.deepEqual(n.employees,s.employees);assert.equal(n.recognition.thanks.length,1);
  assert.equal(sendThanks(n,{id:'thanks',actorId:'e1',employeeId:'e4',message:'Повтор'}),n);
  assert.throws(()=>sendThanks(n,{id:'self',actorId:'e1',employeeId:'e1',message:'Себе'}));
});
test('opportunities accept either delta or a confirmed personal achievement; no spending',()=>{
  const s=seed();assert.throws(()=>applyOpportunity(s,{id:'a',employeeId:'e1',programId:'pilot',path:'delta',motivation:'Хочу учиться'}),/порог/);
  let n=decideAchievement(saveAchievement(s,input),{...approve,amount:20});
  const apply={id:'application',employeeId:'e1',programId:'pilot',path:'achievement' as const,achievementId:'achievement',motivation:'Мой результат релевантен'};
  n=applyOpportunity(n,apply);assert.equal(applyOpportunity(n,apply),n);
  assert.throws(()=>applyOpportunity(n,{...apply,id:'duplicate'}),/уже подали/);
  n=decideOpportunity(n,{id:'accept',actorId:'e3',applicationId:'application',decision:'accepted',reason:'Подходит опыт'});
  assert.equal(n.employees[0].coins,s.employees[0].coins);assert.equal(n.employees[0].rating,800);
  assert.equal(n.recognition.applications[0].status,'accepted');
  n=revokeAchievement(n,{id:'correct',actorId:'e3',requestId:'achievement',reason:'Ошибка начисления'});
  assert.equal(n.recognition.applications[0].status,'accepted');
});
test('an unconfirmed, foreign or corrected achievement cannot qualify an application',()=>{
  let s=saveAchievement(seed(),input);
  const a={id:'apply',employeeId:'e1',programId:'pilot',path:'achievement' as const,achievementId:'achievement',motivation:'Хочу участвовать'};
  assert.throws(()=>applyOpportunity(s,a));
  s=decideAchievement(s,approve);assert.throws(()=>applyOpportunity(s,{...a,employeeId:'e4'}));
  s=applyOpportunity(s,a);s=revokeAchievement(s,{id:'correct',actorId:'e3',requestId:'achievement',reason:'Ошибка'});
  assert.throws(()=>decideOpportunity(s,{id:'accept',actorId:'e3',applicationId:'apply',decision:'accepted',reason:'Проверено'}),/не действует/);
});
test('opportunity seats cannot be oversubscribed and own application cannot be approved',()=>{
  let s=seed();
  for(let i=0;i<3;i++){
    const employeeId=['e1','e4','e5'][i];s.employees.find(e=>e.id===employeeId)!.rating=1000;
    s.entries.push({id:`recent${i}`,employeeId,authorId:'e3',kind:'rating',amount:1000,reason:'Демо',date:new Date().toISOString()});
    s=applyOpportunity(s,{id:`app${i}`,employeeId,programId:'pilot',path:'delta',motivation:'Хочу участвовать'});
    const decision={id:`accept${i}`,actorId:'e3',applicationId:`app${i}`,decision:'accepted' as const,reason:'Релевантный опыт'};
    if(i<2)s=decideOpportunity(s,decision);else assert.throws(()=>decideOpportunity(s,decision),/мест/);
  }
  s.entries.push({id:'hr',employeeId:'e3',authorId:'e9',kind:'rating',amount:1000,reason:'Результат',date:new Date().toISOString()});
  s=applyOpportunity(s,{id:'hr-app',employeeId:'e3',programId:'expert',path:'delta',motivation:'Запрос'});
  assert.throws(()=>decideOpportunity(s,{id:'self',actorId:'e3',applicationId:'hr-app',decision:'accepted',reason:'Себе'}));
});
test('team calculator follows the PDF example, caps outliers and returns no score for missing data',()=>{
  const metrics=[{target:80,actual:84,direction:'more' as const,reliable:true},{target:100,actual:95,direction:'more' as const,reliable:true},{target:4,actual:4,direction:'more' as const,reliable:true}];
  assert.equal(teamIndex(metrics)?.total,101);assert.equal(teamIndex(metrics.map(m=>({...m,actual:1e9})))?.total,120);
  for(const change of [{actual:null},{actual:NaN},{target:0},{reliable:false},{direction:'less' as const,actual:0}])assert.equal(teamIndex(metrics.map((m,i)=>i===0?{...m,...change}:m)),null);
  assert.equal(teamIndex([]),null);
});
test('old saves migrate without inventing dated history, losing coins or orders',()=>{
  const s=purchase(seed(),{id:'buy',employeeId:'e1',productId:'p1'});const {recognition:_,...old}=s;
  const n=loadState(JSON.stringify(old));assert.equal(n.employees[0].rating,780);assert.equal(n.employees[0].coins,750);assert.equal(n.orders.length,1);
  assert.deepEqual(n.recognition,{requests:[],thanks:[],applications:[]});assert.equal(recentRating(n,'e1'),recentRating(s,'e1'));
  assert.deepEqual(loadState(JSON.stringify({...s,recognition:{requests:[{}],thanks:[],applications:[]}})),seed());
});
