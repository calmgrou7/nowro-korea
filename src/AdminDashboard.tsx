import { useEffect, useState } from "react";
import { api } from "./api";

export function AdminDashboard() {
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState("");
  useEffect(() => { api("site-content").then((v) => setForm(v.content)).catch(() => {}); }, []);
  const set = (key: string, value: string) => setForm((v: any) => ({ ...v, [key]: value }));
  function uploadImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 6_000_000) { setMessage("Choose an image under 6 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => set("hero_image", String(reader.result));
    reader.readAsDataURL(file);
  }
  async function save() {
    try { await api("operator/site-content", form); setMessage("Saved. The homepage content is now updated."); }
    catch { setMessage("Only the master administrator can save changes."); }
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
    <button className="primary" onClick={save}>Save homepage changes</button>{message && <p role="status">{message}</p>}
  </section>;
}
