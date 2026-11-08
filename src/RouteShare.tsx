import { useState } from "react";
import type { Route, Place } from "../shared/types";
import { track } from "./analytics";
export function RouteShare({
  route,
  places,
  lang,
}: {
  route: Route;
  places: Place[];
  lang: string;
}) {
  const [status, setStatus] = useState("");
  const ko = lang === "ko";
  const text = [
    ko ? "NOWRO 나의 부산 여행코스" : "My Busan route · NOWRO",
    new Intl.DateTimeFormat(lang, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(new Date(route.startAt)) + " (Korea / UTC+9)",
    ...route.stops.map((s, i) => {
      const p = places.find((p) => p.id === s.placeId);
      return `${i + 1}. ${p?.name[lang as keyof typeof p.name] || p?.name.en || s.placeId}\n${p?.address || ""}`;
    }),
    `${route.minutes} min · ${ko ? "예상 비용 상한" : "Estimated cost ceiling"} KRW ${route.costMax}`,
    ko
      ? "방문 전 운영시간·요금·예약 여부를 확인하세요."
      : "Confirm hours, prices and reservations before visiting.",
    "https://nowrokorea.com/?tab=ROUTES",
  ].join("\n\n");
  const labels: Record<string, [string, string, string, string, string]> = {
    ko: [
      "이 코스 공유·보관",
      "내용 복사",
      "텍스트 다운로드",
      "이메일 앱에서 보내기",
      "공유할 내용을 확인하고 직접 보내세요. 나우로가 이메일 주소를 저장하거나 자동 발송하지 않습니다.",
    ],
    en: [
      "Share or keep this route",
      "Copy itinerary",
      "Download text",
      "Send with your email app",
      "Review the itinerary and send it yourself. NOWRO does not collect email addresses or send automatically.",
    ],
    ja: [
      "コースを共有・保存",
      "内容をコピー",
      "テキストを保存",
      "メールアプリで送る",
      "内容を確認してご自身で送信してください。NOWROはメールアドレスを保存せず、自動送信もしません。",
    ],
    "zh-CN": [
      "分享或保存路线",
      "复制行程",
      "下载文本",
      "用邮件应用发送",
      "确认行程后自行发送。NOWRO不保存邮箱地址，也不会自动发送。",
    ],
    "zh-TW": [
      "分享或儲存路線",
      "複製行程",
      "下載文字",
      "用郵件應用傳送",
      "確認行程後自行傳送。NOWRO不儲存電郵地址，也不會自動傳送。",
    ],
  };
  const w = labels[lang] || labels.en;
  return (
    <section className="route-share">
      <h3>{w[0]}</h3>
      <div className="place-map-links">
        <button
          className="action-link"
          onClick={() =>
            navigator.clipboard
              .writeText(text)
              .then(() => {
                setStatus(ko ? "코스를 복사했습니다." : "Itinerary copied.");
                track("share_route");
              })
              .catch(() =>
                setStatus(
                  ko
                    ? "아래 다운로드를 이용해주세요."
                    : "Use the download option below.",
                ),
              )
          }
        >
          {w[1]}
        </button>
        <button
          className="action-link"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/plain;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "nowro-busan-route.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            track("share_route");
          }}
        >
          {w[2]}
        </button>
        <a
          className="action-link"
          href={
            "mailto:?subject=" +
            encodeURIComponent(
              ko ? "NOWRO 부산 여행코스" : "My Busan itinerary · NOWRO",
            ) +
            "&body=" +
            encodeURIComponent(text)
          }
          onClick={() => track("share_route")}
        >
          {w[3]}
        </a>
        {typeof navigator.share === "function" && (
          <button
            className="action-link"
            onClick={() =>
              navigator
                .share({ title: "NOWRO Busan", text })
                .then(() => track("share_route"))
                .catch(() => {})
            }
          >
            {ko ? "다른 앱으로 공유" : "Share to another app"}
          </button>
        )}
      </div>
      <p className="muted">{w[4]}</p>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
