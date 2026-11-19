import {eventEndDate} from './event-dates.ts';
export function eventStartDate(item:any):string|null {
 const text=String(item.eventStart||item.eventstartdate||item.op_st_dt||item.startDate||item.USAGE_DAY_WEEK_AND_TIME||'');
 const m=text.match(/(20\d{2})[.\-/년]?\s*(\d{2}|\d{1})[.\-/월]?\s*(\d{2}|\d{1})/);
 if(!m)return null;
 const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
 const parsed=new Date(d+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===d?d:null;
}
export function eventDayGroup(item:any,now=new Date()):'today'|'upcoming'|'other'{
 const day=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
 const start=eventStartDate(item),end=eventEndDate(item);
 if(start&&start>day)return 'upcoming';
 if(start&&start<=day&&end&&end>=day)return 'today';
 return 'other';
}
