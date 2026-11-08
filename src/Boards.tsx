import { visitorText } from "./visitor-copy";
import {analyticsPage,track} from './analytics';
import { useEffect, useState } from "react";
import { api } from "./api";
import { syncPageMetadata } from '../shared/page-metadata';
import { ArrowRight, Compass } from 'lucide-react';
import {boards} from "../shared/board-guides";
export function Boards({
  lang,
  page = false,
}: {
  lang: string;
  page?: boolean;
}) {
  const [posts, setPosts] = useState<any[]>([]),
    [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(
    () => new URLSearchParams(location.search),
  );
  const L = (ko: string, en: string) => visitorText(lang, ko, en);
  useEffect(()=>{if(page)syncPageMetadata();},[query,page]);
  useEffect(() => {
    const back = () => setQuery(new URLSearchParams(location.search));
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    let active = true;
    api("boards")
      .then((v) => {
        if (active) setPosts(v.posts || []);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const board = page
    ? boards.find((b) => b.id === query.get("board"))
    : undefined;
  const selected = posts.find(
    (p) => p.board === board?.id && p.id === query.get("post"),
  );
  useEffect(()=>{if(page){analyticsPage();if(selected)track('view_item','post-'+selected.id);}},[page,query.toString(),selected?.id]);
  const go = (id?: string, post?: string) => {
    const url = new URL(location.href);
    url.searchParams.set("tab", "ABOUT");
    url.searchParams.delete("board");
    url.searchParams.delete("post");
    if (id) url.searchParams.set("board", id);
    if (post) url.searchParams.set("post", post);
    history.pushState(null, "", url);
    setQuery(new URLSearchParams(url.search));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cards = (
    <div className="source-grid">
      {boards.map((b) => (
        <a
          key={b.id}
          className="board-card"
          href={"?tab=ABOUT&board=" + b.id}
          onClick={
            page
              ? (e) => {
                  e.preventDefault();
                  go(b.id);
                }
              : undefined
          }
        >
          <div
            className={"board-cover " + (b.id !== "busan" ? "board-logo" : "")}
          >
            <img src={b.image} alt="" />
          </div>
          <div>
            <h3>{L(b.title, b.en)}</h3>
            <p>{L(b.description, b.enDescription)}</p>
            <span className="board-card-action">{L("게시판 보기", "Open board")}<ArrowRight size={15} aria-hidden="true"/></span>
          </div>
        </a>
      ))}
    </div>
  );
  if (!page)
    return (
      <section id="about-nowro" className="section boards-section">
        <div className="section-heading">
          <h2>{L("나우로 소개", "About NOWRO")}</h2>
          <a className="action-link" href="?tab=ABOUT"><Compass size={16} aria-hidden="true"/>{L("나우로 알아보기", "Meet NOWRO")}<ArrowRight size={15} aria-hidden="true"/></a>
        </div>
        {cards}
      </section>
    );
  return (
    <section className="section about-page">
      <nav
        className="about-breadcrumb"
        aria-label={L("현재 위치", "Breadcrumb")}
      >
        <a href="?">{L("홈", "Home")}</a>
        <span>/</span>
        {board ? (
          <>
            <button className="text-btn" onClick={() => go()}>
              {L("나우로 소개", "About NOWRO")}
            </button>
            <span>/</span>
            <span>{L(board.title, board.en)}</span>
          </>
        ) : (
          <span>{L("나우로 소개", "About NOWRO")}</span>
        )}
      </nav>
      {!board ? (
        <>
          <div className="about-hero">
            <span className="eyebrow">YOUR KOREA. RIGHT NOW.</span>
            <h1>
              {L(
                "한국의 오늘을, 나만의 여행으로.",
                "Your Korea. Your next discovery.",
              )}
            </h1>
            <p>
              {L(
                "나우로는 지금 만날 수 있는 행사와 동네의 매력을 발견하고, 마음에 드는 장소를 모아 나만의 여행 동선을 만드는 여행 가이드입니다.",
                "NOWRO helps you discover local events and neighborhoods, save places you love and plan your own journey.",
              )}
            </p>
            <span>
              {L(
                "부산에서 시작해, 한국 곳곳으로.",
                "Starting in Busan. Growing across Korea.",
              )}
            </span>
          </div>
          <div className="about-values">
            {[
              [
                L("발견", "Discover"),
                L(
                  "축제·공연·전시·체험을 한곳에서",
                  "Events, exhibitions and experiences in one place",
                ),
              ],
              [
                L("연결", "Connect"),
                L(
                  "동네의 관광지부터 주변 맛집과 카페까지",
                  "From local sights to nearby dining and cafés",
                ),
              ],
              [
                L("나만의 여행", "Make it yours"),
                L(
                  "저장한 장소와 시간에 맞춘 코스",
                  "Saved places and routes that fit your time",
                ),
              ],
            ].map(([title, body]) => (
              <article key={title}>
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <h2>{L("나우로와 함께 시작하기", "Start with NOWRO")}</h2>
          {cards}
        </>
      ) : (
        <>
          <header className="board-heading">
            <span className="eyebrow">NOWRO JOURNAL</span>
            <h1>{L(board.title, board.en)}</h1>
            <p>{L(board.description, board.enDescription)}</p>
          </header>
          <nav
            className="quick-categories"
            aria-label={L("게시판 선택", "Choose a board")}
          >
            {boards.map((b) => (
              <button
                key={b.id}
                aria-pressed={b.id === board.id}
                onClick={() => go(b.id)}
              >
                {L(b.title, b.en)}
              </button>
            ))}
          </nav>
          {selected ? (
            <article className="about-post">
              <button className="text-btn" onClick={() => go(board.id)}>
                {L("← 글 목록", "← Posts")}
              </button>
              <h2>{selected.title}</h2>
              <time>{selected.updated?.slice(0, 10)}</time>
              {selected.image && <img src={selected.image} alt="" />}
              <p>{selected.body}</p>
            </article>
          ) : (
            <>
              <article className="about-post">
                <span className="board-pinned">
                  {L("기본 안내", "Getting started")}
                </span>
                <h2>{L(board.title, board.en)}</h2>
                <p>{L(board.body, board.enBody)}</p>
              </article>
              <h2>{L("게시판 소식", "Board updates")}</h2>
              {loading ? (
                <p role="status">
                  {L("게시글을 불러오고 있습니다.", "Loading posts…")}
                </p>
              ) : failed ? (
                <p role="alert">
                  {L(
                    "추가 게시글을 불러오지 못했습니다. 새로고침해주세요.",
                    "Unable to load additional posts. Please reload.",
                  )}
                </p>
              ) : posts.some((p) => p.board === board.id) ? (
                posts
                  .filter((p) => p.board === board.id)
                  .map((p) => (
                    <a
                      className="board-post-row"
                      key={p.id}
                      href={
                        "?tab=ABOUT&board=" +
                        board.id +
                        "&post=" +
                        encodeURIComponent(p.id)
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        go(board.id, p.id);
                      }}
                    >
                      <strong>{p.title}</strong>
                      <time>{p.updated?.slice(0, 10)}</time>
                    </a>
                  ))
              ) : (
                <p className="muted">
                  {L(
                    "새로운 소식이 등록되면 이곳에서 확인할 수 있습니다.",
                    "New updates will appear here when published.",
                  )}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
const empty = {
  id: "",
  board: "guide",
  title: "",
  body: "",
  image: "",
  published: false,
};
export function BoardAdmin() {
  const [posts, setPosts] = useState<any[]>([]),
    [form, setForm] = useState(empty),
    [message, setMessage] = useState("");
  const load = () => api("operator/boards").then((v) => setPosts(v.posts));
  useEffect(() => {
    load().catch(() => setMessage("게시판을 불러오지 못했습니다."));
  }, []);
  return (
    <section className="panel">
      <h2>나우로 소개 · 게시판 관리</h2>
      <button onClick={() => setForm(empty)}>새 글 작성</button>
      <div>
        {posts.map((p) => (
          <button
            className="board-post-row"
            key={p.id}
            onClick={() => setForm(p)}
          >
            {p.title} · {p.published ? "게시 중" : "초안"}
          </button>
        ))}
      </div>
      <label>
        게시판
        <select
          value={form.board}
          onChange={(e) => setForm({ ...form, board: e.target.value })}
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        제목
        <input
          value={form.title}
          maxLength={150}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        본문
        <textarea
          rows={8}
          value={form.body}
          maxLength={12000}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
      </label>
      <label>
        이미지 주소 (선택)
        <input
          value={form.image}
          onChange={(e) => setForm({ ...form, image: e.target.value })}
          placeholder="https://..."
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
        />
        공개 게시 (해제하면 비공개)
      </label>
      <button
        className="primary"
        onClick={async () => {
          try {
            await api("operator/boards/save", {
              ...form,
              id: form.id || undefined,
            });
            await load();
            setForm(empty);
            setMessage("저장되었습니다.");
          } catch {
            setMessage(
              "저장 실패: 제목·본문·이미지 주소와 관리자 로그인을 확인해주세요.",
            );
          }
        }}
      >
        저장
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
