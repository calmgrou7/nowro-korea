import {useEffect,useState} from 'react';
import {api} from './api';
type Check={id:string;ready:boolean;title:string;detail:string};
export function OperationsPanel(){
 const [checks,setChecks]=useState<Check[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{const data=await api('operator/operations');setChecks(data.checks);setMessage('');}catch{setMessage('운영 상태를 불러오지 못했습니다. 관리자 로그인을 확인하세요.');}}
 useEffect(()=>{void refresh();},[]);
 async function download(){setBusy(true);try{const data=await api('operator/content-backup');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='nowro-content-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('콘텐츠 파일을 내려받았습니다. 운영 DB 전체 백업은 별도로 필요합니다.');}catch{setMessage('백업 파일을 내려받지 못했습니다. 관리자 로그인을 확인하세요.');}finally{setBusy(false);}}
 return <section className="panel"><div className="section-heading"><h3>운영 준비·백업</h3><button className="secondary" onClick={refresh}>상태 새로고침</button></div>
 <p className="muted">설정 유무와 외부 확인이 필요한 작업을 구분합니다. 설정이 있어도 실제 서비스 성공을 보장하지 않습니다.</p>
 <div className="operator-grid">{checks.map(c=><article className="panel" key={c.id}><strong>{c.title}</strong><p>{c.ready?'설정 있음 · 외부 확인 필요':'추가 작업 필요'}</p><small className="muted">{c.detail}</small></article>)}</div>
 <h4>홈페이지 콘텐츠 내려받기</h4><p className="muted">소개·공지·게시판·제휴·검색 설정을 JSON 파일로 보관합니다. 회원·로그인 토큰·결제·예약·이미지 저장소 파일은 포함하지 않습니다. 이 파일만으로 전체 서비스를 복원할 수 없습니다.</p>
 <button className="secondary" disabled={busy} onClick={download}>{busy?'준비 중…':'콘텐츠 백업 내려받기'}</button><p role="status">{message}</p></section>;
}
