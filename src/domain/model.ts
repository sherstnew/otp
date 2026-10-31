import { emptyRecognition, moscowDay, ratingProfile, validRecognition, type RecognitionState } from './rating';
import type { CoinAward } from './coins';
export type Role = 'employee' | 'lead' | 'hr';
export type Employee = { id: string; name: string; title: string; department: string; role: Role; coins: number; rating: number };
export type Entry = { id: string; employeeId: string; authorId: string; kind: 'coins' | 'rating'; amount: number; reason: string; date: string; effectiveDate?: string; resultDate?: string; title?: string; contributionId?: string; category?: string; groupAtAward?: string; roleAtAward?: Role; reversalOf?: string };
export type Category = 'Мерч' | 'Сертификаты' | 'Привилегии';
export type Product = { id: string; name: string; description: string; category: Category; price: number; stock: number; art: 'hoodie' | 'bag' | 'bottle' | 'certificate' | 'parking' | 'guest' | 'room'; tone: string };
export type Order = { id: string; employeeId: string; productId: string; name: string; price: number; date: string };
export type State = { version: 1; employees: Employee[]; entries: Entry[]; products: Product[]; orders: Order[]; processed: string[]; coinAwards: CoinAward[]; recognition: RecognitionState };
export const STORAGE_KEY = 'otp-mania-v1';
export function seed(): State {
  const people: [string,string,string,Role,number,number][] = [
    ['Александра Морозова','Продуктовый дизайнер','Цифровые продукты','employee',4250,780],
    ['Михаил Соколов','Руководитель продукта','Цифровые продукты','lead',6800,1120],
    ['Анна Волкова','HR-партнёр','Люди и культура','hr',3200,960],
    ['Иван Лебедев','Frontend-разработчик','Цифровые продукты','employee',1800,840],
    ['Мария Орлова','Бизнес-аналитик','Цифровые продукты','employee',5100,780],
    ['Дмитрий Смирнов','Инженер по качеству','Цифровые продукты','employee',950,620],
    ['Екатерина Белова','Специалист по развитию','Люди и культура','employee',2400,1080],
    ['Артём Козлов','Рекрутер','Люди и культура','employee',3600,540],
    ['Софья Новикова','Куратор обучения','Люди и культура','lead',7200,1240],
    ['Максим Попов','Клиентский менеджер','Клиентский сервис','employee',1200,720],
    ['Полина Васильева','Эксперт поддержки','Клиентский сервис','employee',2900,890],
    ['Андрей Павлов','Руководитель сервиса','Клиентский сервис','lead',4300,1020],
  ];
  const employees = people.map((p,i)=>({id:`e${i+1}`,name:p[0],title:p[1],department:p[2],role:p[3],coins:p[4],rating:p[5]}));
  const products: Product[] = [
    {id:'p1',name:'Худи «ОТличный день»',description:'Мягкое худи свободного кроя в фирменном лайме. Универсальный размер для уютных дней в офисе и за его пределами.',category:'Мерч',price:3500,stock:12,art:'hoodie',tone:'lime'},
    {id:'p2',name:'Шопер на каждый день',description:'Вместительный хлопковый шопер с фирменной графикой ОТП.',category:'Мерч',price:1200,stock:24,art:'bag',tone:'blue'},
    {id:'p3',name:'Термобутылка ОТП',description:'Сохраняет любимый напиток прохладным или горячим. Объём 500 мл.',category:'Мерч',price:1800,stock:0,art:'bottle',tone:'purple'},
    {id:'p4',name:'Сертификат «Книги»',description:'Новая история или полезное знание — выбор за вами. Демонстрационный сертификат на 1 000 ₽.',category:'Сертификаты',price:5000,stock:30,art:'certificate',tone:'blue'},
    {id:'p5',name:'Сертификат «Впечатления»',description:'Для небольшого приключения в выходные. Демонстрационный сертификат на 2 000 ₽.',category:'Сертификаты',price:10000,stock:8,art:'certificate',tone:'orange'},
    {id:'p6',name:'Сертификат «Кофе»',description:'Пауза с любимым напитком. Демонстрационный сертификат на 500 ₽.',category:'Сертификаты',price:2500,stock:40,art:'certificate',tone:'purple'},
    {id:'p7',name:'Парковка на неделю',description:'Выделенное место у офиса на одну рабочую неделю. Даты согласовываются после заказа.',category:'Привилегии',price:2500,stock:3,art:'parking',tone:'blue'},
    {id:'p8',name:'Гостевой билет',description:'Пригласите близкого человека на открытый семейный день банка.',category:'Привилегии',price:1500,stock:10,art:'guest',tone:'lime'},
    {id:'p9',name:'Переговорка с вашим именем',description:'Ваше имя на переговорной на месяц — небольшой повод улыбнуться всей команде.',category:'Привилегии',price:5000,stock:2,art:'room',tone:'orange'},
  ];
  const entries: Entry[] = [
    {id:'initial-1',employeeId:'e1',authorId:'e2',kind:'rating',amount:120,reason:'Создала гайд по дизайн-системе и помогла двум командам внедрить новые компоненты.',date:'2026-10-28T12:00:00Z'},
    {id:'initial-2',employeeId:'e1',authorId:'e3',kind:'coins',amount:1000,reason:'Годовщина работы в ОТП — спасибо, что вы с нами!',date:'2026-10-26T09:00:00Z'},
    {id:'initial-3',employeeId:'e1',authorId:'e3',kind:'rating',amount:80,reason:'Провела мастер-класс для начинающих дизайнеров в сообществе банка.',date:'2026-10-23T11:30:00Z'},
    {id:'initial-4',employeeId:'e1',authorId:'e3',kind:'coins',amount:250,reason:'Участие во встрече сообщества «Дизайн вместе».',date:'2026-10-22T14:00:00Z'},
  ];
  return {version:1,employees,products,entries,orders:[],processed:[],coinAwards:[],recognition:emptyRecognition()};
}
export function grant(state: State, input: {id:string; actorId:string; employeeId:string; kind:Entry['kind']; amount:number; reason:string}): State {
  if (!input.id.trim()) throw new Error('Укажите идентификатор операции.');
  if (state.processed.includes(input.id)) return state;
  const actor = state.employees.find(e=>e.id===input.actorId);
  const employee = state.employees.find(e=>e.id===input.employeeId);
  if (!actor || !employee) throw new Error('Сотрудник не найден.');
  if (actor.id===employee.id || actor.role==='employee' || (actor.role==='lead' && (input.kind==='coins' || ratingProfile(employee).managerId!==actor.id || actor.id===employee.id))) throw new Error('Недостаточно прав для этого начисления.');
  if (input.kind === 'coins') throw new Error('Выберите подтверждённое событие для начисления коинов.');
  if (!Number.isSafeInteger(input.amount) || input.amount<=0 || !Number.isSafeInteger(employee[input.kind]+input.amount)) throw new Error('Укажите положительное целое число баллов.');
  if (!input.reason.trim()) throw new Error('Добавьте обоснование начисления.');
  return {...state,employees:state.employees.map(e=>e.id===employee.id?{...e,[input.kind]:e[input.kind]+input.amount}:e),entries:[{id:input.id,employeeId:employee.id,authorId:actor.id,kind:input.kind,amount:input.amount,reason:input.reason.trim(),date:new Date().toISOString(),effectiveDate:moscowDay(),groupAtAward:ratingProfile(employee).group,roleAtAward:employee.role},...state.entries],processed:[...state.processed,input.id]};
}
export function purchase(state: State, input:{id:string; employeeId:string; productId:string}): State {
  if (!input.id.trim()) throw new Error('Укажите идентификатор операции.');
  if (state.processed.includes(input.id)) return state;
  const employee=state.employees.find(e=>e.id===input.employeeId), product=state.products.find(p=>p.id===input.productId);
  if (!employee || !product) throw new Error('Товар или сотрудник не найден.');
  if (product.stock<1) throw new Error('Товар закончился. Выберите другую награду.');
  if (employee.coins<product.price) throw new Error('Пока не хватает коинов для этой покупки.');
  return {...state,employees:state.employees.map(e=>e.id===employee.id?{...e,coins:e.coins-product.price}:e),products:state.products.map(p=>p.id===product.id?{...p,stock:p.stock-1}:p),orders:[{id:input.id,employeeId:employee.id,productId:product.id,name:product.name,price:product.price,date:new Date().toISOString()},...state.orders],entries:[{id:input.id,employeeId:employee.id,authorId:employee.id,kind:'coins',amount:-product.price,reason:`Покупка: ${product.name}`,date:new Date().toISOString()},...state.entries],processed:[...state.processed,input.id]};
}
export const rank = (employees:Employee[], rating:number)=>1+employees.filter(e=>e.rating>rating).length;
export function loadState(raw: string | null): State {
  if (!raw) return seed();
  try { const s=JSON.parse(raw) as State; if(s.version!==1 || !Array.isArray(s.employees) || s.employees.length!==12 || !Array.isArray(s.products) || !Array.isArray(s.entries) || !Array.isArray(s.orders) || !Array.isArray(s.processed) || s.employees.some(e=>!Number.isSafeInteger(e.coins)||e.coins<0||!Number.isSafeInteger(e.rating)||e.rating<0) || s.products.some(p=>!Number.isSafeInteger(p.stock)||p.stock<0||!Number.isSafeInteger(p.price)||p.price<=0)) return seed(); s.recognition ??= emptyRecognition(); if (!validRecognition(s.recognition)) return seed(); const peopleIds=new Set(s.employees.map(e=>e.id)); if (s.recognition.requests.some(r=>[r.employeeId,r.authorId,r.reviewerId].some(id=>!peopleIds.has(id)) || (r.entryId && !s.entries.some(e=>e.id===r.entryId&&e.employeeId===r.employeeId))) || s.recognition.thanks.some(t=>!peopleIds.has(t.fromId)||!peopleIds.has(t.toId)) || s.recognition.applications.some(a=>!peopleIds.has(a.employeeId))) return seed(); s.coinAwards ??= []; if (!Array.isArray(s.coinAwards) || s.coinAwards.some(a => !a || typeof a.id !== 'string' || typeof a.employeeId !== 'string' || typeof a.eventId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.eventDate) || !Number.isSafeInteger(a.amount) || a.amount <= 0) || s.entries.some(e => !Number.isSafeInteger(e.amount) || !Number.isFinite(Date.parse(e.date)))) return seed(); const certificatePrices: Record<string, number> = {p4:5000,p5:10000,p6:2500}; s.products = s.products.map(p => certificatePrices[p.id] ? {...p,price:certificatePrices[p.id]} : p); return s; } catch {return seed();}
}
