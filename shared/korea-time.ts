export function koreaInput(iso:string){const stamp=Date.parse(iso);return Number.isFinite(stamp)?new Date(stamp+9*3600000).toISOString().slice(0,16):'';}
export function koreaISO(value:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))return '';
 const date=new Date(value+(value.length===16?':00':'')+'+09:00');
 if(!Number.isFinite(date.getTime()))return '';const iso=date.toISOString();return koreaInput(iso)===value.slice(0,16)?iso:'';
}
