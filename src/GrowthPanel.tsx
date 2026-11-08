import { useEffect, useState } from "react";
import { api } from "./api";
import { campaignUrl } from "../shared/attribution";
export function GrowthPanel() {
  const [config, setConfig] = useState({
      gaId: "",
      enabled: false,
      naverVerification: "",
      googleVerification: "",
      bingVerification: "",
    }),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [campaign, setCampaign] = useState({
    tab: "NOW",
    source: "instagram",
    medium: "social",
    name: "busan-winter-2026",
    content: "reel-001",
  });
  useEffect(() => {
    api("operator/growth")
      .then((v) => {
        setConfig(v);
        setReady(true);
      })
      .catch(() => setMessage("연결 설정을 불러오지 못했습니다."));
  }, []);
  let link = "";
  try {
    link = campaignUrl(
      campaign.tab,
      campaign.source,
      campaign.medium,
      campaign.name,
      campaign.content,
    );
  } catch {}
  return (
    <section className="panel growth-panel">
      <h3>방문 분석·검색 연결</h3>
      <p className="muted">
        {config.enabled && config.gaId
          ? "GA4 설정 저장됨 · 동의한 방문자만 측정"
          : "GA4 연결 대기 · 현재 Google 애널리틱스로 분석 데이터를 보내지 않습니다."}{" "}
        실제 수신은 GA4 실시간 보고서에서 확인하세요.
      </p>
      <div className="operator-grid">
        <label>
          GA4 측정 ID
          <input
            placeholder="G-XXXXXXXXXX"
            value={config.gaId}
            onChange={(e) =>
              setConfig({ ...config, gaId: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label>
          네이버 소유 확인 코드
          <input
            placeholder="메타태그의 content 값만 입력"
            value={config.naverVerification}
            onChange={(e) =>
              setConfig({ ...config, naverVerification: e.target.value })
            }
          />
        </label>
        <label>
          Google Search Console 확인 코드
          <input
            placeholder="HTML 태그 방식의 content 값"
            value={config.googleVerification}
            onChange={(e) =>
              setConfig({ ...config, googleVerification: e.target.value })
            }
          />
        </label>
        <label>
          Bing Webmaster 확인 코드
          <input
            placeholder="msvalidate.01 태그의 content 값"
            value={config.bingVerification}
            onChange={(e) =>
              setConfig({ ...config, bingVerification: e.target.value })
            }
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />
        GA4 측정 활성화
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        GA4 데이터 스트림의 향상된 측정은 끄고, Google Signals·광고 개인
        최적화도 끈 상태로 설정했습니다. 개인정보 안내와 보관 기간을
        확인했습니다.
      </label>
      <button
        className="primary"
        disabled={!ready || (config.enabled && !confirmed)}
        onClick={async () => {
          try {
            setConfig(await api("operator/growth", config));
            setMessage(
              "저장했습니다. 사이트 확인 코드는 즉시 반영되며, GA4 설정은 방문자가 새로 열 때 적용됩니다.",
            );
          } catch {
            setMessage("ID·확인 코드 형식 또는 관리자 로그인을 확인해주세요.");
          }
        }}
      >
        연결 설정 저장
      </button>
      <p role="status">{message}</p>
      <div className="place-map-links">
        <a
          className="action-link"
          href="https://analytics.google.com/"
          target="_blank"
          rel="noreferrer"
        >
          Google 애널리틱스
        </a>
        <a
          className="action-link"
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noreferrer"
        >
          Google Search Console
        </a>
        <a
          className="action-link"
          href="https://searchadvisor.naver.com/"
          target="_blank"
          rel="noreferrer"
        >
          네이버 서치어드바이저
        </a>
        <a
          className="action-link"
          href="https://www.bing.com/webmasters/"
          target="_blank"
          rel="noreferrer"
        >
          Bing Webmaster
        </a>
      </div>
      <h3>채널·게시물별 홍보 링크 만들기</h3>
      <p className="muted">
        같은 캠페인 이름을 유지하고 채널과 게시물 번호를 구분하세요. 소문자
        영문·숫자·하이픈·밑줄만 사용하며 이름·이메일·전화번호는 넣지 마세요.
      </p>
      <div className="operator-grid">
        <label>
          연결 화면
          <select
            value={campaign.tab}
            onChange={(e) => setCampaign({ ...campaign, tab: e.target.value })}
          >
            <option value="NOW">홈</option>
            <option value="MAP">지역가이드</option>
            <option value="ROUTES">코스</option>
            <option value="ABOUT">나우로 소개</option>
          </select>
        </label>
        {(
          [
            ["source", "채널 (instagram, naver_blog, youtube)"],
            ["medium", "매체 (social, referral, email)"],
            ["name", "캠페인 이름"],
            ["content", "게시물 구분 번호"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={campaign[key]}
              onChange={(e) =>
                setCampaign({ ...campaign, [key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <textarea
        readOnly
        rows={3}
        value={link || "영문 소문자·숫자·하이픈·밑줄로 입력해주세요."}
      />
      <button
        disabled={!link}
        onClick={() =>
          navigator.clipboard
            .writeText(link)
            .then(() => setMessage("홍보 링크를 복사했습니다."))
            .catch(() => setMessage("위 링크를 직접 복사해주세요."))
        }
      >
        홍보 링크 복사
      </button>
      <p className="muted">
        확인할 흐름: 방문 → 상세 보기(view_item) → 장소 저장(save_place) → 코스
        생성(generate_route) → 코스 저장(save_route). Google 보고서의 세션
        소스/매체·세션 캠페인·세션 수동 광고 콘텐츠로 비교하세요. GA4 연결 전
        방문 기록은 나중에 소급 수집할 수 없습니다.
      </p>
    </section>
  );
}
