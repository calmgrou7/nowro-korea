import { useEffect, useState } from "react";
import { api } from "./api";
import { BoardAdmin } from './Boards';
import {GrowthPanel} from './GrowthPanel';
import {AffiliateAdmin} from './AffiliateAdmin';
import {OperationsPanel} from './OperationsPanel';

export function AdminDashboard({page}:{page:import('./AdminWorkspace').AdminPage}) {
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [performanceIds, setPerformanceIds] = useState('');
  useEffect(()=>{api('operator/performance-ids').then(v=>setPerformanceIds(v.ids.join('\n'))).catch(()=>{});},[]);
  useEffect(() => { api("site-content").then((v) => { const draft = localStorage.getItem("nowro-site-draft"); setForm(draft ? { ...v.content, ...JSON.parse(draft) } : v.content); }).catch(() => {}); }, []);
  const set = (key: string, value: string) => setForm((v: any) => ({ ...v, [key]: value }));
  function saveDraft() { localStorage.setItem("nowro-site-draft", JSON.stringify(form)); setMessage("Draft saved on this device."); }
  function uploadImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 6_000_000) { setMessage("Choose an image under 6 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        set("hero_image", canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }
  async function save() {
    try { await api("operator/site-content", form); setMessage("Saved. The homepage content is now updated."); }
    catch (error: any) { setMessage(error?.message === "TOO_LARGE" ? "Image is too large. Choose a smaller image." : "Could not save. Please sign in again as the master administrator."); }
  }
  return <section className="admin-dashboard" hidden={!['hero','news','boards','operations','growth','affiliates','performances'].includes(page)}>
    <div hidden={page!=='hero'} className="panel">
    <div className="section-heading"><div><span className="eyebrow">MASTER CMS</span><h2>메인 화면 편집</h2></div></div>
    <p className="muted">메인 제목·소개·대표 이미지를 수정합니다. 변경 내용을 확인한 뒤 게시해주세요.</p>
    <div className="operator-grid">
      <label>메인 제목 · 영문<input value={form.hero_title_en || ""} onChange={e => set("hero_title_en", e.target.value)} /></label>
      <label>메인 제목 · 국문<input value={form.hero_title_ko || ""} onChange={e => set("hero_title_ko", e.target.value)} /></label>
      <label>소개 문구 · 영문<textarea value={form.hero_intro_en || ""} onChange={e => set("hero_intro_en", e.target.value)} /></label>
      <label>소개 문구 · 국문<textarea value={form.hero_intro_ko || ""} onChange={e => set("hero_intro_ko", e.target.value)} /></label>
    </div>
    <label>대표 이미지 주소<input value={form.hero_image || ""} onChange={e => set("hero_image", e.target.value)} placeholder="https://..." /></label>
    <label>이미지 파일 올리기<input type="file" accept="image/*" onChange={e => uploadImage(e.target.files?.[0])} /></label>
    {form.hero_image && <img className="admin-image-preview" src={form.hero_image} alt="Homepage preview" />}
    </div>
    <div hidden={page!=='operations'}><OperationsPanel /></div>
    <div hidden={page!=='growth'}><GrowthPanel /></div>
    <div hidden={page!=='affiliates'}><AffiliateAdmin /></div>
    <div hidden={page!=='boards'}><BoardAdmin /></div>
    <section hidden={page!=='performances'} className="panel"><h3>공연 API 연결</h3><p>부산문화포털 공연번호를 한 줄에 하나씩 입력하세요. 최대 5건의 상세정보를 조회하며 종료된 공연은 숨깁니다. 예시 번호를 실제 공연으로 등록하지 마세요.</p><textarea rows={5} value={performanceIds} onChange={e=>setPerformanceIds(e.target.value)} /><button onClick={async()=>{try{await api('operator/performance-ids',{ids:performanceIds.split(/\s+/).filter(Boolean)});setMessage('공연번호 저장 완료. 실제 공개 여부는 API 응답에 따라 달라집니다.');}catch{setMessage('공연번호 형식·개수 또는 관리자 로그인을 확인해주세요.');}}}>공연 API 연결 저장</button></section>
    <div hidden={page!=='news'} className="panel"><h3>새로운 소식 · 공지사항</h3>
    <label>공지 제목<input value={form.news_title || ''} onChange={e => set('news_title', e.target.value)} /></label>
    <label>공지 내용<textarea value={form.news_body || ''} onChange={e => set('news_body', e.target.value)} /></label>
    <label>공지 이미지 URL<input value={form.news_image || ''} onChange={e => set('news_image', e.target.value)} placeholder="https://..." /></label>
    </div>
    <div hidden={page!=='hero' && page!=='news'} className="admin-publish-area"><p className="muted">메인 화면과 공지사항의 수정 내용을 함께 저장합니다.</p><div className="button-row"><button className="secondary" onClick={saveDraft}>임시 저장</button><button className="secondary" onClick={() => setPreview(v => !v)}>{preview ? "미리보기 닫기" : "미리보기"}</button><button className="primary" onClick={save}>변경 내용 게시</button></div>
    {preview && <div className="panel admin-preview"><span className="eyebrow">HOMEPAGE PREVIEW</span><h2>{form.hero_title_en || "Your Korea. Right Now."}</h2><p>{form.hero_intro_en || "Discover Busan with NOWRO."}</p>{form.hero_image && <img src={form.hero_image} alt="Preview" />}</div>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
