import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, loadState, purchase } from '../src/domain/model';
import { saveAchievement, decideAchievement, revokeAchievement, recentRating, confirmedAchievements } from '../src/domain/rating';
import { achievementReward, ACHIEVEMENT_LEVELS, type AchievementLevel } from '../src/domain/achievements';
import { COIN_POLICY, issuedCoins } from '../src/domain/coins';
const request={id:'a',actorId:'e1',employeeId:'e1',kind:'professional' as const,achievementType:'idea' as const,title:'Упростила подготовку отчёта',action:'Внедрила инструмент',benefit:'Сократила время подготовки',personalRole:'Спроектировала и проверила',participants:'Аналитики',source:'Замеры до и после',resultDate:'2025-01-15',contributionId:'report',publicConsent:true,submit:true};
const decision={id:'approve',actorId:'e2',requestId:'a',decision:'approved' as const,reason:'Проверен результат и личная роль',level:'R3' as AchievementLevel};
test('all five manually selected levels award fixed paired rewards once; old result stays outside recent window',()=>{
 for(const level of Object.keys(ACHIEVEMENT_LEVELS) as AchievementLevel[]){
  const original=seed(),pending=saveAchievement(original,request),s=decideAchievement(pending,{...decision,level,amount:9999}),reward=achievementReward(level);
  assert.equal(pending.employees[0].rating,original.employees[0].rating);
  assert.equal(s.employees[0].rating,original.employees[0].rating+reward.points);
  assert.equal(s.employees[0].coins,original.employees[0].coins+reward.coins);
  assert.equal(s.entries[0].effectiveDate,request.resultDate);
  assert.equal(recentRating(s,'e1','2026-11-02'),recentRating(original,'e1','2026-11-02'));
  assert.equal(confirmedAchievements(s,'e1').filter(a=>a.id==='a').length,1);
  assert.equal(decideAchievement(s,{...decision,level}),s);
  assert.deepEqual(loadState(JSON.stringify(s)),s);
  assert.equal(issuedCoins(s)-issuedCoins(original),reward.coins);
  assert.equal(purchase(s,{id:'purchase',employeeId:'e1',productId:'p1'}).employees[0].rating,s.employees[0].rating);
 }
});
test('wrong type, missing or invalid level and insufficient issuance quota reject atomically',()=>{
 assert.throws(()=>saveAchievement(seed(),{...request,kind:'social'}),/категории/);
 const s=saveAchievement(seed(),request),before=JSON.stringify(s);
 for(const level of [undefined,'R6','toString'] as unknown as AchievementLevel[]) assert.throws(()=>decideAchievement(s,{...decision,level}));
 assert.throws(()=>decideAchievement(s,{...decision,actorId:'e1'}),/прав/);
 assert.throws(()=>decideAchievement(s,{...decision,reason:''}));
 const full={...s,entries:[...s.entries,{id:'full',employeeId:'e1',authorId:'e3',kind:'coins' as const,amount:COIN_POLICY.annualCeiling,reason:'Лимит',date:new Date().toISOString()}]};
 assert.throws(()=>decideAchievement(full,decision),/Лимит/);
 assert.equal(JSON.stringify(s),before);
});
test('paired correction restores both balances, retains issuance usage and survives reload',()=>{
 const original=seed(),s=decideAchievement(saveAchievement(original,request),decision);
 const correction={id:'correct',actorId:'e3',requestId:'a',reason:'Подтверждён дубль'};
 const n=revokeAchievement(s,correction);
 assert.deepEqual(n.employees,original.employees);
 assert.equal(issuedCoins(n),issuedCoins(s));
 assert.ok(!confirmedAchievements(n,'e1').some(a=>a.id==='a'));
 assert.equal(revokeAchievement(n,correction),n);
 assert.deepEqual(loadState(JSON.stringify(n)),n);
 const spent={...s,employees:s.employees.map(e=>e.id==='e1'?{...e,coins:0}:e)};
 assert.throws(()=>revokeAchievement(spent,correction),/потрачены/);
 assert.equal(spent.recognition.requests[0].status,'approved');
});
