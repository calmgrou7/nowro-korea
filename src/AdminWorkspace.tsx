import type { ReactNode } from 'react';
import { LayoutDashboard, FileText, Store, Megaphone, Ticket, Settings } from 'lucide-react';

export const adminGroups = [
  {label:'운영 현황', icon:LayoutDashboard, pages:[['operations','운영 점검']]},
  {label:'홈페이지 콘텐츠', icon:FileText, pages:[['hero','메인 화면'],['news','공지사항'],['boards','소개 게시판']]},
  {label:'업체·콘텐츠 심사', icon:Store, pages:[['businesses','업체 신청'],['listings','등록 콘텐츠']]},
  {label:'홍보·제휴', icon:Megaphone, pages:[['growth','검색·방문 분석'],['affiliates','제휴 상품']]},
  {label:'혜택·현장 운영', icon:Ticket, pages:[['rewards','보상 관리'],['tools','쿠폰·QR·수정 심사']]},
  {label:'데이터 연결', icon:Settings, pages:[['performances','공연 API']]},
] as const;
export type AdminPage = typeof adminGroups[number]['pages'][number][0];
export function AdminWorkspace({page,onPage,children,enabled=true}:{page:AdminPage;onPage:(page:AdminPage)=>void;children:ReactNode;enabled?:boolean}) {
  if (!enabled) return <>{children}</>;
  const group=adminGroups.find(g=>g.pages.some(p=>p[0]===page))!;
  const label=group.pages.find(p=>p[0]===page)?.[1];
  return <div className="admin-workspace">
    <aside className="admin-sidebar"><div className="admin-sidebar-brand">NOWRO <span>관리자</span></div>
      <nav aria-label="관리자 카테고리">{adminGroups.map(g=><button type="button" key={g.label} className={g===group?'active':''} aria-current={g===group?'true':undefined} onClick={()=>onPage(g.pages[0][0])}><g.icon size={18}/><span>{g.label}</span></button>)}</nav>
      <p>카테고리를 선택한 뒤<br/>오른쪽에서 작업하세요.</p>
    </aside>
    <div className="admin-workarea">
      <header className="admin-workarea-header"><p>관리자 / {group.label}</p><h2>{label}</h2>
        <nav aria-label={`${group.label} 하위 메뉴`}>{group.pages.map(([id,title])=><button key={id} type="button" aria-pressed={page===id} onClick={()=>onPage(id)}>{title}</button>)}</nav>
      </header>
      <div className="admin-workarea-body">{children}</div>
    </div>
  </div>;
}
