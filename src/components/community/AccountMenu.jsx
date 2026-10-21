"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const validHandle = (value) =>
  typeof value === "string" && /^[a-z0-9_]{3,30}$/u.test(value);

export function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const details = useRef(null);
  const [account, setAccount] = useState({ status: "loading", profile: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const response = await fetch("/api/eggs/profile", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (controller.signal.aborted || request !== sequence) return;
        if (response.ok) {
          const profile = data?.profile;
          setAccount({
            status: "signed-in",
            profile: validHandle(profile?.handle)
              ? { handle: profile.handle }
              : null,
          });
        } else {
          setAccount({
            status: [401, 403].includes(response.status)
              ? "signed-out"
              : "unavailable",
            profile: null,
          });
        }
      } catch {
        if (!controller.signal.aborted && request === sequence)
          setAccount({ status: "unavailable", profile: null });
      }
    }
    function visibility() {
      if (document.visibilityState === "visible") void refresh();
    }
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("eggs-auth", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("eggs-auth", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pathname]);

  function close() {
    if (details.current) details.current.open = false;
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/eggs/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        setError("We couldn’t finish signing you out. Please try again.");
        window.dispatchEvent(new Event("eggs-auth"));
        return;
      }
      setAccount({ status: "signed-out", profile: null });
      close();
      window.dispatchEvent(new Event("eggs-auth"));
      router.refresh();
    } catch {
      setError("We couldn’t finish signing you out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (["loading", "unavailable"].includes(account.status))
    return (
      <Link
        className="community-account-fallback"
        href="/profile"
        prefetch={false}
      >
        My account ↗
      </Link>
    );

  return (
    <details
      className="community-account"
      ref={details}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
          details.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>
        <span>
          {account.profile ? "@" + account.profile.handle : "My account"}
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <nav className="community-account-panel" aria-label="Your EGGS account">
        {account.status === "signed-in" ? (
          <>
            {account.profile ? (
              <>
                <Link
                  href={"/profile/" + account.profile.handle}
                  onClick={close}
                >
                  My page <span aria-hidden="true">↗</span>
                </Link>
                <Link href="/profile/edit" onClick={close} prefetch={false}>
                  Edit my page
                </Link>
              </>
            ) : (
              <Link href="/profile" onClick={close} prefetch={false}>
                Choose my handle
              </Link>
            )}
            <Link href="/profile" onClick={close} prefetch={false}>
              Account &amp; connections
            </Link>
            <button type="button" onClick={logout} disabled={busy}>
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={close} prefetch={false}>
              Sign in
            </Link>
            <Link href="/login" onClick={close} prefetch={false}>
              Create an EGGS account
            </Link>
          </>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </nav>
    </details>
  );
}
