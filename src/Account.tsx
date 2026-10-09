import { useState } from "react";
import { api } from "./api";
import type { Lang } from "../shared/types";
export function Account({
  lang,
  status,
  onChange,
}: {
  lang: Lang;
  status: any;
  onChange: () => Promise<void>;
}) {
  const ko = lang === "ko";
  const linkMode = status?.authEmailMode === "link";
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const key = (e as Error).message;
      setError(
        key === "ACCOUNT_REWARD_CONFLICT"
          ? ko
            ? "현재 기록과 계정에 동일한 캠페인 보상 신청이 있습니다. 운영자 확인이 필요합니다."
            : "Your guest and account rewards conflict. Contact support before merging."
          : key === "AUTH_PROVIDER_UNAVAILABLE"
            ? ko
              ? "로그인 서버에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해주세요."
              : "The sign-in service is temporarily unavailable. Please try again shortly."
            : key === "RATE_LIMIT"
              ? ko
                ? "요청이 많습니다. 잠시 기다린 뒤 다시 시도해주세요."
                : "Too many attempts. Please wait before trying again."
              : ko
                ? "인증을 완료하지 못했습니다. 연결 상태와 인증번호를 확인해주세요."
                : "Authentication failed. Check your connection and code.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="account-panel">
      <h3>{ko ? "내 계정" : "Your account"}</h3>
      {status?.session.authenticated ? (
        <>
          <p>{status.session.email}</p>
          <p className="muted">
            {ko
              ? "이 계정으로 로그인하면 저장한 코스·쿠폰·스탬프를 이어서 이용할 수 있습니다."
              : "Sign in with this account to access your saved routes, coupons and stamps."}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("auth/logout", {});
                await onChange();
              })
            }
          >
            {ko ? "로그아웃" : "Sign out"}
          </button>
        </>
      ) : !status?.authConfigured ? (
        <p className="notice">
          {ko
            ? "로그인 서버 연결 준비 중입니다. 지금은 가입 없이 이용할 수 있으며, 비회원 기록은 7일간 보관됩니다."
            : "Sign-in connection is being prepared. Continue without an account; guest records are kept for 7 days."}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (sent) {
                await api("auth/verify", { email, code });
                setCode("");
                await onChange();
              } else {
                await api("auth/request", { email });
                setSent(true);
              }
            });
          }}
        >
          <p className="muted">
            {ko
              ? "한국 전화번호 없이 이메일로 로그인하세요. 현재 비회원 기록은 로그인한 계정으로 옮겨집니다."
              : "Sign in by email without a Korean phone number. Your guest records will move to your account."}
          </p>
          <label>
            {ko ? "이메일" : "Email"}
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              disabled={busy || sent}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {sent && (
            <p className="notice">
              {linkMode
                ? ko
                  ? "메일을 보냈습니다. 받은 메일의 확인·로그인 버튼을 눌러 나우로로 돌아온 뒤, 표시되는 계정을 확인하고 로그인하세요. 메일에 인증번호가 있으면 아래에 입력해도 됩니다."
                  : "Email sent. Click the confirmation or sign-in button in your email, then confirm your account in NOWRO. If your email contains a code, you can enter it below."
                : ko
                  ? "메일의 인증번호를 아래에 입력해주세요."
                  : "Enter the code from your email below."}
            </p>
          )}
          {sent && (
            <label>
              {ko ? "이메일로 받은 인증번호" : "Code from your email"}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                minLength={6}
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? ko
                ? "처리 중…"
                : "Working…"
              : sent
                ? ko
                  ? "확인하고 로그인"
                  : "Verify & sign in"
                : linkMode
                  ? ko
                    ? "로그인 메일 받기"
                    : "Send sign-in email"
                  : ko
                    ? "인증번호 받기"
                    : "Send sign-in code"}
          </button>
          {sent && (
            <button
              className="text-btn"
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              {ko ? "이메일 변경 / 다시 받기" : "Change email / resend"}
            </button>
          )}
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
