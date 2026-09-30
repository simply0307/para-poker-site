import Link from "next/link";
import { AccountFrame, AccountUnavailable } from "@/components/eggs/AccountFrame";
import { AuthForm } from "@/components/eggs/AuthForm";
import { consumerConfiguration } from "@/lib/eggs/consumerCore.mjs";

export const metadata = { title: "Log in with EGGS" };
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }) {
  if (!consumerConfiguration()) return <AccountUnavailable />;
  return <AccountFrame title="Your place in EGGS." intro="Sign in, or create an account and choose a handle. Start small; your profile is yours to share.">
    <AuthForm confirmationFailed={(await searchParams).confirmation === "failed"} />
    <p className="eggs-help eggs-account-footer">League operator? <Link className="eggs-text-link" href="/operator-login">Open operator sign-in</Link>.</p>
  </AccountFrame>;
}
