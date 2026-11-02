// Base scenario from presentation, slides 6.2–6.3. A person selects the level.
export const ACHIEVEMENT_LEVELS = { R1: 5, R2: 15, R3: 30, R4: 60, R5: 100 } as const;
export type AchievementLevel = keyof typeof ACHIEVEMENT_LEVELS;
export const ACHIEVEMENT_COEFFICIENT = 373;
export const ACHIEVEMENT_TYPES = [
  {id:'incident', name:'Решение в критический момент', kind:'professional'},
  {id:'idea', name:'Внедрение новой идеи', kind:'professional'},
  {id:'help', name:'Помощь другому отделу', kind:'professional'},
  {id:'expertise', name:'Профессиональное достижение', kind:'professional'},
  {id:'mentoring', name:'Наставничество', kind:'professional'},
  {id:'teaching', name:'Обучение коллег и полезные материалы', kind:'professional'},
  {id:'learning', name:'Значимое обучение с высоким результатом', kind:'professional'},
  {id:'review', name:'Высокие результаты ревью', kind:'professional'},
  {id:'team', name:'Командный результат', kind:'management'},
  {id:'community', name:'Развитие сообщества', kind:'social'},
  {id:'ambassador', name:'Представительство банка', kind:'social'},
  {id:'volunteer', name:'Волонтёрство на мероприятиях', kind:'social'},
  {id:'conference', name:'Конференция с пользой для работы', kind:'social'},
] as const;
export type AchievementType = typeof ACHIEVEMENT_TYPES[number]['id'];
export function achievementReward(level:AchievementLevel) {
  if(!Object.hasOwn(ACHIEVEMENT_LEVELS,level)) throw new Error('Выберите уровень вклада R1–R5.');
  const points=ACHIEVEMENT_LEVELS[level];
  if(!points) throw new Error('Выберите уровень вклада R1–R5.');
  return {points,coins:points*ACHIEVEMENT_COEFFICIENT};
}
