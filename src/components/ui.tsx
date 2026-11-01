import { Children, isValidElement, useId, useLayoutEffect, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type RefObject, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
export function Icon({name=1,size=24}:{name?:number;size?:number}) { const [svg,setSvg]=useState(''); useEffect(()=>{let active=true;fetch(`/assets/icons/icon-${name}.svg`).then(r=>r.text()).then(s=>{if(active)setSvg(s)}).catch(()=>{});return()=>{active=false}},[name]);return <span aria-hidden="true" className="icon" style={{width:size,height:size}} dangerouslySetInnerHTML={{__html:svg}}/>; }
export function Button({variant='primary',busy=false,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'dark';busy?:boolean}) {return <button {...props} disabled={props.disabled||busy} aria-busy={busy} className={`button button-${variant} ${props.className||''}`}>{busy?'Подождите…':children}</button>}
export function IconButton({label,icon,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string;icon:number}) {return <button {...props} className="icon-button" aria-label={label}><Icon name={icon}/></button>}
export function Input(props:InputHTMLAttributes<HTMLInputElement>) {return <input {...props} className={`control ${props.className||''}`}/>}
export function Textarea(props:TextareaHTMLAttributes<HTMLTextAreaElement>) {return <textarea {...props} className={`control textarea ${props.className||''}`}/>}
export function Select({children,id,value,defaultValue,onChange,...props}:SelectHTMLAttributes<HTMLSelectElement>) {
  const generated=useId(), listId=`${id||generated}-options`, root=useRef<HTMLDivElement>(null), native=useRef<HTMLSelectElement>(null), trigger=useRef<HTMLButtonElement>(null);
  const options=Children.toArray(children).filter(isValidElement<{value?:string;disabled?:boolean;children:ReactNode}>).map(o=>({value:String(o.props.value??o.props.children),label:o.props.children,disabled:o.props.disabled}));
  const [local,setLocal]=useState(String(defaultValue??options[0]?.value??'')),[open,setOpen]=useState(false),[active,setActive]=useState(0);
  const selected=String(value??local), index=options.findIndex(o=>o.value===selected);
  useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open]);
  useEffect(()=>{if(open)document.getElementById(`${listId}-${active}`)?.scrollIntoView({block:'nearest'})},[open,active,listId]);
  function choose(i:number){const option=options[i];if(!option||option.disabled)return;setLocal(option.value);const element=native.current!;Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(element,option.value);element.dispatchEvent(new Event('change',{bubbles:true}));setOpen(false);trigger.current?.focus()}
  function move(step:number){let next=active;for(let i=0;i<options.length;i++){next=(next+step+options.length)%options.length;if(!options[next].disabled){setActive(next);break}}}
  return <div ref={root} className={`custom-select ${props.className||''}`} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}>
    <select {...props} id={undefined} ref={native} value={selected} onChange={e=>onChange?.(e)} tabIndex={-1} aria-hidden="true" className="select-native" onInvalid={e=>{e.preventDefault();trigger.current?.focus()}}>{children}</select>
    <button ref={trigger} id={id} type="button" role="combobox" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={open?`${listId}-${active}`:undefined} aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-invalid={props['aria-invalid']} disabled={props.disabled} className="control select-trigger" onClick={()=>{setActive(Math.max(0,index));setOpen(!open)}} onKeyDown={e=>{
      if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){setOpen(false);e.stopPropagation()}else if(e.key==='Enter'||e.key===' '){if(open)choose(active);else{setActive(Math.max(0,index));setOpen(true)}}else{setOpen(true);if(e.key==='Home')setActive(options.findIndex(o=>!o.disabled));else if(e.key==='End')setActive(options.map(o=>!o.disabled).lastIndexOf(true));else if(open)move(e.key==='ArrowDown'?1:-1);else setActive(Math.max(0,index))}}else if(e.key.length===1){const next=options.findIndex(o=>!o.disabled&&String(o.label).toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()));if(next>=0){setActive(next);setOpen(true)}}
    }}><span>{options[index]?.label||'Выберите значение'}</span><span className={`select-chevron ${open?'is-open':''}`} aria-hidden="true"/></button>
    {open&&<div id={listId} role="listbox" className="select-menu" aria-label={props['aria-label']} >{options.map((o,i)=><div key={o.value} id={`${listId}-${i}`} role="option" aria-selected={i===index} aria-disabled={o.disabled||undefined} className={`select-option ${i===active?'is-active':''}`} onPointerMove={()=>{if(!o.disabled)setActive(i)}} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(i)}>{o.label}{i===index&&<span aria-hidden="true">✓</span>}</div>)}</div>}
  </div>;
}
function useSlidingPosition(ref:RefObject<HTMLDivElement|null>,value:string) {
  const [position,setPosition]=useState({x:0,width:0});
  useLayoutEffect(()=>{
    const root=ref.current;if(!root)return;
    let mounted=true;
    const measure=()=>{if(!mounted)return;const button=root.querySelector<HTMLButtonElement>('[aria-pressed="true"]');setPosition(button?{x:button.offsetLeft,width:button.offsetWidth}:{x:0,width:0})};
    measure();const observer=new ResizeObserver(measure);observer.observe(root);root.querySelectorAll('button').forEach(button=>observer.observe(button));document.fonts.ready.then(measure);
    return()=>{mounted=false;observer.disconnect()};
  },[ref,value]);
  return {transform:`translateX(${position.x}px)`,width:position.width,opacity:position.width?1:0};
}
export function Checkbox({label,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}) {return <label className="choice"><input {...props} type="checkbox"/>{label}</label>}
export function Radio({label,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}) {return <label className="choice"><input {...props} type="radio"/>{label}</label>}
export function FormField({label,id,hint,error,children}:{label:string;id:string;hint?:string;error?:string;children:ReactNode}) {return <div className="field"><label htmlFor={id}>{label}</label>{children}{(error||hint)&&<span id={`${id}-hint`} className={error?'field-error':'field-hint'}>{error||hint}</span>}</div>}
export function Card({children,className=''}:{children:ReactNode;className?:string}) {return <section className={`card ${className}`}>{children}</section>}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}) {return <span className={`badge badge-${tone}`}>{children}</span>}
export function Avatar({name,large=false}:{name:string;large?:boolean}) {return <span className={`avatar ${large?'avatar-large':''}`} aria-hidden="true">{name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>}
export function Tabs({items,value,onChange,label='Разделы'}:{items:{id:string;label:string}[];value:string;onChange:(id:string)=>void;label?:string}) {
  const ref=useRef<HTMLDivElement>(null),position=useSlidingPosition(ref,value);
  useEffect(()=>{const root=ref.current,button=root?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');if(root&&button&&(button.offsetLeft<root.scrollLeft||button.offsetLeft+button.offsetWidth>root.scrollLeft+root.clientWidth))root.scrollTo({left:button.offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})},[value]);
  return <div ref={ref} className="tabs" aria-label={label}><span className="tabs-fill" aria-hidden="true" style={position}/>{items.map(i=><button key={i.id} className={value===i.id?'active':''} aria-pressed={value===i.id} onClick={()=>onChange(i.id)}>{i.label}</button>)}</div>
}
export function EmptyState({title,children}:{title:string;children?:ReactNode}) {return <div className="empty"><span className="empty-orbit"/><h3>{title}</h3><p>{children}</p></div>}
export function Toast({message,onClose}:{message:string;onClose:()=>void}) {useEffect(()=>{const t=setTimeout(onClose,6000);return()=>clearTimeout(t)},[message,onClose]);return <div className="toast" role="status"><span>{message}</span><button aria-label="Закрыть уведомление" onClick={onClose}>×</button></div>}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current!;dialog.showModal();const cancel=(e:Event)=>{e.preventDefault();closeRef.current()};dialog.addEventListener('cancel',cancel);return()=>{dialog.removeEventListener('cancel',cancel);dialog.close();previous?.focus({preventScroll:true})}},[]);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="close-button" onClick={onClose} aria-label="Закрыть окно">×</button></div>{children}</dialog>
}
export function DataTable({headings,children}:{headings:string[];children:ReactNode}) {return <div className="table-scroll"><table><thead><tr>{headings.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
