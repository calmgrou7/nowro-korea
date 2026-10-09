import { useEffect, useState } from "react";
import { api } from "./api";
import { parseAuthLink } from "../shared/auth-link";
import type { Lang } from "../shared/types";

// Strip sensitive fragments before rendering or any outbound app requests; keep tokens only in memory.
let captured = parseAuthLink(location.hash);
if (captured)
  history.replaceState(null, "", location.pathname + location.search);

export function EmailLinkSignIn({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: () => Promise<void>;
}) {
  const ko = lang === "ko";
  const [link, setLink] = useState(captured);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(!!link?.error);
  const dismiss = () => {
    captured = null;
    setLink(null);
  };
  useEffect(() => {
    if (!link || link.error) return;
    let active = true;
    api("auth/link-preview", link)
      .then((v) => {
        if (active) setEmail(v.email);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [link]);
  if (!link) return null;
  return (
    <div className="overlay">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={ko ? "이메일 로그인" : "Email sign-in"}
      >
        <h2>{ko ? "이메일 로그인" : "Email sign-in"}</h2>
        {error ? (
          <p role="alert">
            {ko
              ? "로그인 링크가 만료되었거나 확인할 수 없습니다. 닫은 뒤 설정에서 새 메일을 요청해주세요."
              : "This sign-in link is expired or unavailable. Close this window and request a new email in settings."}
          </p>
        ) : (
          <>
            <p>
              {ko
                ? "이 계정으로 나우로에 로그인할까요?"
                : "Sign in to NOWRO with this account?"}
            </p>
            <p>
              <strong>
                {email || (ko ? "계정 확인 중…" : "Checking account…")}
              </strong>
            </p>
            <p>
              {ko
                ? "이 브라우저의 비회원 기록이 표시된 계정으로 옮겨집니다. 본인 계정인지 확인해주세요."
                : "Guest records in this browser will move to the account shown. Check that this is your account."}
            </p>
            <button
              className="primary"
              disabled={!email || busy}
              onClick={async () => {
                if (link.error) return;
                setBusy(true);
                try {
                  await api("auth/link-confirm", { ...link, email });
                  dismiss();
                  await onChange();
                } catch {
                  setError(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? ko
                  ? "로그인 중…"
                  : "Signing in…"
                : ko
                  ? "이 계정으로 로그인"
                  : "Sign in with this account"}
            </button>
          </>
        )}
        <button className="secondary" disabled={busy} onClick={dismiss}>
          {ko ? "닫기" : "Close"}
        </button>
      </section>
    </div>
  );
}
