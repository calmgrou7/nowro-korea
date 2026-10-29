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
    <button className="primary" onClick={save}>Save homepage changes</button>{message && <p role="status">{message}</p>}
  </section>;
}
