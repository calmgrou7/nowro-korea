import { useEffect, useState } from "react";
import { api } from "./api";
import { BoardAdmin } from './Boards';
import {GrowthPanel} from './GrowthPanel';

export function AdminDashboard() {
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
  return <section className="panel admin-dashboard">
    <div className="section-heading"><div><span className="eyebrow">MASTER CMS</span><h2>Homepage control center</h2></div></div>
    <p className="muted">Edit the public homepage copy and hero image. Changes are recorded in the admin audit log.</p>
    <div className="operator-grid">
      <label>Hero title (English)<input value={form.hero_title_en || ""} onChange={e => set("hero_title_en", e.target.value)} /></label>
      <label>Hero title (Korean)<input value={form.hero_title_ko || ""} onChange={e => set("hero_title_ko", e.target.value)} /></label>
      <label>Intro (English)<textarea value={form.hero_intro_en || ""} onChange={e => set("hero_intro_en", e.target.value)} /></label>
      <label>Intro (Korean)<textarea value={form.hero_intro_ko || ""} onChange={e => set("hero_intro_ko", e.target.value)} /></label>
    </div>
    <label>Hero image URL<input value={form.hero_image || ""} onChange={e => set("hero_image", e.target.value)} placeholder="https://..." /></label>
    <label>Or upload an image<input type="file" accept="image/*" onChange={e => uploadImage(e.target.files?.[0])} /></label>
    {form.hero_image && <img className="admin-image-preview" src={form.hero_image} alt="Homepage preview" />}
    <GrowthPanel />
    <BoardAdmin />
    <section className="panel"><h3>공연 API 연결</h3><p>부산문화포털 공연번호를 한 줄에 하나씩 입력하세요. 최대 5건의 상세정보를 조회하며 종료된 공연은 숨깁니다. 예시 번호를 실제 공연으로 등록하지 마세요.</p><textarea rows={5} value={performanceIds} onChange={e=>setPerformanceIds(e.target.value)} /><button onClick={async()=>{try{await api('operator/performance-ids',{ids:performanceIds.split(/\s+/).filter(Boolean)});setMessage('공연번호 저장 완료. 실제 공개 여부는 API 응답에 따라 달라집니다.');}catch{setMessage('공연번호 형식·개수 또는 관리자 로그인을 확인해주세요.');}}}>공연 API 연결 저장</button></section>
    <h3>새로운 소식 · 공지사항</h3>
    <label>공지 제목<input value={form.news_title || ''} onChange={e => set('news_title', e.target.value)} /></label>
    <label>공지 내용<textarea value={form.news_body || ''} onChange={e => set('news_body', e.target.value)} /></label>
    <label>공지 이미지 URL<input value={form.news_image || ''} onChange={e => set('news_image', e.target.value)} placeholder="https://..." /></label>
    <div className="button-row"><button className="secondary" onClick={saveDraft}>Save draft</button><button className="secondary" onClick={() => setPreview(v => !v)}>{preview ? "Close preview" : "Preview"}</button><button className="primary" onClick={save}>Publish changes</button></div>
    {preview && <div className="panel admin-preview"><span className="eyebrow">HOMEPAGE PREVIEW</span><h2>{form.hero_title_en || "Your Korea. Right Now."}</h2><p>{form.hero_intro_en || "Discover Busan with NOWRO."}</p>{form.hero_image && <img src={form.hero_image} alt="Preview" />}</div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
