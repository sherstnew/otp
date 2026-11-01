import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, purchase, seed } from '../src/domain/model';
import { appealAchievement, leaderboardGroup, ratingLeaderboard, confirmedAchievements, applyOpportunity, decideAchievement, decideOpportunity, expiryDay, moscowDay, ratingProfile, recentRating, reviewerFor, revokeAchievement, saveAchievement, sendThanks, thanksPreview, teamIndex, type RequestInput } from '../src/domain/rating';
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


test('legacy confirmed entries qualify for programs; duplicates and reversed entries do not',()=>{
  let s=seed();const entry=ratingEntriesForTest(s)[0];
  assert.ok(entry);
  assert.ok(confirmedAchievements(s,'e1').some(a=>a.id===entry.id));
  const applied=applyOpportunity(s,{id:'legacy-program',employeeId:'e1',programId:'pilot',path:'achievement',achievementId:entry.id,motivation:'Применить опыт в пилоте'});
  assert.equal(applied.recognition.applications[0].achievementId,entry.id);
  assert.equal(applyOpportunity(applied,{id:'legacy-program',employeeId:'e1',programId:'pilot',path:'achievement',achievementId:entry.id,motivation:'Опыт'}),applied);
  s={...s,entries:[{...entry,id:'reversal-legacy',amount:-entry.amount,reversalOf:entry.id},...s.entries]};
  assert.ok(!confirmedAchievements(s,'e1').some(a=>a.id===entry.id));
  assert.throws(()=>applyOpportunity(s,{id:'invalid-legacy',employeeId:'e1',programId:'pilot',path:'achievement',achievementId:entry.id,motivation:'Опыт'}));
  assert.throws(()=>decideOpportunity({...s,recognition:applied.recognition},{id:'decide-legacy',actorId:'e3',applicationId:'legacy-program',decision:'accepted',reason:'Проверка'}));
  const approved=decideAchievement(saveAchievement(seed(),input),approve);
  assert.equal(confirmedAchievements(approved,'e1').filter(a=>a.id==='achievement'||a.id==='approval').length,1);
});
function ratingEntriesForTest(s:ReturnType<typeof seed>){return s.entries.filter(e=>e.kind==='rating'&&e.employeeId==='e1'&&e.amount>0)}

test('HR can nominate across teams while assigned reviewer still confirms and consent stays private',()=>{
  const s=saveAchievement(seed(),{...input,id:'hr-nomination',actorId:'e3',employeeId:'e10'});
  assert.equal(s.recognition.requests[0].reviewerId,'e12');
  assert.equal(s.recognition.requests[0].publicConsent,false);
  assert.throws(()=>decideAchievement(s,{...approve,actorId:'e3',requestId:'hr-nomination'}));
  assert.doesNotThrow(()=>decideAchievement(s,{...approve,actorId:'e12',requestId:'hr-nomination'}));
});


const weighted=(id:string,actorId='e1',employeeId='e4')=>({id,actorId,employeeId,kind:'weighted' as const,value:'result' as const,message:'Помог с результатом проекта'});
const november=new Date('2026-11-01T12:00:00Z');
test('weighted thanks uses team weight, awards once, preserves coins and does not become a qualifying achievement',()=>{
 const original=seed();const s=sendThanks(original,weighted('weighted'),november);
 assert.equal(s.employees.find(e=>e.id==='e4')!.rating,original.employees.find(e=>e.id==='e4')!.rating+1);
 assert.deepEqual(s.employees.map(e=>e.coins),original.employees.map(e=>e.coins));
 assert.equal(s.recognition.thanks[0].points,1);assert.equal(s.entries[0].category,'thanks');
 assert.equal(recentRating(s,'e4','2026-11-01'),1);
 assert.ok(!confirmedAchievements(s,'e4').some(a=>a.id==='weighted'));
 assert.equal(sendThanks(s,weighted('weighted'),november),s);
 assert.deepEqual(loadState(JSON.stringify(s)),s);
 const cross=sendThanks(original,weighted('cross','e1','e10'),november);
 assert.equal(cross.recognition.thanks[0].points,2);
 assert.equal(thanksPreview(original,'e2','e1',november).weight,1);
});
test('weighted thanks requires a reason and a value, rejects self and invalid type, simple thanks allows no message',()=>{
 for(const patch of [{message:''},{value:undefined},{value:'bad' as 'result'},{kind:'bad' as 'weighted'},{employeeId:'e1'}])assert.throws(()=>sendThanks(seed(),{...weighted('invalid'),...patch},november));
 const s=sendThanks(seed(),{id:'warm',actorId:'e1',employeeId:'e4',message:''},november);
 assert.equal(s.recognition.thanks[0].points,0);assert.equal(s.entries.length,seed().entries.length);
 const legacy=seed();legacy.recognition.thanks=[{id:'legacy',fromId:'e1',toId:'e4',message:'Спасибо',date:november.toISOString()}];
 assert.deepEqual(loadState(JSON.stringify(legacy)),legacy);
});
test('repeat thanks arrives without points and counts toward four monthly weighted sends; simple stays available',()=>{
 let s=sendThanks(seed(),weighted('one'),november);s=sendThanks(s,weighted('repeat'),november);
 assert.equal(s.recognition.thanks[0].points,0);assert.match(s.recognition.thanks[0].ratingNote!,/уже отправляли/);
 s=sendThanks(s,weighted('three','e1','e5'),november);s=sendThanks(s,weighted('four','e1','e6'),november);
 assert.throws(()=>sendThanks(s,weighted('five','e1','e7'),november),/все 4/);
 assert.doesNotThrow(()=>sendThanks(s,{id:'simple-after',actorId:'e1',employeeId:'e7',message:''},november));
 const december=sendThanks(s,weighted('december'),new Date('2026-11-30T21:00:00Z'));
 assert.equal(december.recognition.thanks[0].points,1);assert.equal(december.entries[0].effectiveDate,'2026-12-01');
});
test('receiver monthly ceiling is ten; last award is capped and further thanks still arrive',()=>{
 let s=sendThanks(seed(),weighted('same-team','e7','e8'),november);
 for(const actor of ['e1','e4','e5','e6'])s=sendThanks(s,weighted('cap-'+actor,actor,'e8'),november);
 assert.equal(s.recognition.thanks.reduce((sum,t)=>sum+(t.points||0),0),9);
 s=sendThanks(s,weighted('last','e10','e8'),november);assert.equal(s.recognition.thanks[0].points,1);
 s=sendThanks(s,weighted('over','e11','e8'),november);assert.equal(s.recognition.thanks[0].points,0);
 assert.equal(s.recognition.thanks.reduce((sum,t)=>sum+(t.points||0),0),10);
});
test('quarterly reciprocal pattern stops new pair points, preserves previous awards and resets in new quarter',()=>{
 let s=seed();
 for(const month of ['10','11']){
  const date=new Date(`2026-${month}-15T12:00:00Z`);
  s=sendThanks(s,weighted('a-'+month),date);s=sendThanks(s,weighted('b-'+month,'e4','e1'),date);
  assert.equal(s.recognition.thanks[0].points,1);
 }
 s=sendThanks(s,weighted('a-12'),new Date('2026-12-15T12:00:00Z'));
 const before=s.employees.map(e=>e.rating);
 s=sendThanks(s,weighted('b-12','e4','e1'),new Date('2026-12-15T12:00:00Z'));
 assert.equal(s.recognition.thanks[0].points,0);assert.match(s.recognition.thanks[0].ratingNote!,/квартала/);assert.deepEqual(s.employees.map(e=>e.rating),before);
 assert.equal(thanksPreview(s,'e1','e4',new Date('2026-12-20T12:00:00Z')).points,0);
 s=sendThanks(s,weighted('new-quarter','e4','e1'),new Date('2027-01-01T12:00:00Z'));assert.equal(s.recognition.thanks[0].points,1);
});


test('leaderboard compares one role group, shares tied places and supports recent period without mutating balances',()=>{
 const s=seed(),snapshot=JSON.stringify(s),group=leaderboardGroup(s.employees[0]);
 const all=ratingLeaderboard(s,group,'all','2026-11-01');
 assert.deepEqual(all.map(r=>[r.employee.id,r.score,r.place]),[['e4',840,1],['e1',780,2],['e5',780,2],['e6',620,4]]);
 assert.ok(all.every(r=>r.employee.role==='employee'&&r.employee.department==='Цифровые продукты'));
 assert.ok(!ratingLeaderboard(s,leaderboardGroup(s.employees[2])).some(r=>r.employee.role!=='hr'));
 const recent=ratingLeaderboard(s,group,'recent','2026-11-01');
 assert.equal(recent[0].employee.id,'e1');assert.equal(recent[0].score,200);
 assert.deepEqual(recent.slice(1).map(r=>r.place),[2,2,2]);
 assert.deepEqual(ratingLeaderboard(s,'missing'),[]);assert.equal(JSON.stringify(s),snapshot);
});
