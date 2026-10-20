import { useEffect, useState } from "react";
import { api } from "./api";
import { parseAuthLink } from "../shared/auth-link";
import type { Lang } from "../shared/types";
import { Modal } from "./Modal";

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
  const [confirmed, setConfirmed] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const dismiss = () => {
    captured = null;
    setLink(null);
    setConfirmed(false);
  };
  const loadAccount = async () => {
    setBusy(true);
    setRefreshError(false);
    try {
      await onChange();
      dismiss();
    } catch {
      setRefreshError(true);
    } finally {
      setBusy(false);
    }
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
  if (!link && !confirmed) return null;
  return (
    <Modal
      title={ko ? "이메일 로그인" : "Email sign-in"}
      close={dismiss}
      closeDisabled={busy}
    >
      {confirmed ? (
        <>
          <p role="status">
            {ko
              ? "로그인은 완료되었습니다. 계정 기록을 불러옵니다."
              : "You are signed in. Loading your account records."}
          </p>
          {refreshError && (
            <p role="alert">
              {ko
                ? "기록을 불러오지 못했습니다. 로그인 메일을 다시 누르지 말고 아래에서 다시 확인해주세요."
                : "Your records could not load. Retry below; you do not need to open the email link again."}
            </p>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() => void loadAccount()}
          >
            {ko ? "계정 기록 다시 불러오기" : "Reload account records"}
          </button>
        </>
      ) : error ? (
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
              if (!link || link.error) return;
              setBusy(true);
              try {
                await api("auth/link-confirm", { ...link, email });
                captured = null;
                setLink(null);
                setConfirmed(true);
                await loadAccount();
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
    </Modal>
  );
}
