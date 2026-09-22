import Link from "next/link";
import { FuturePage } from "@/components/eggs/FuturePage";

export const metadata = { title: "Log in with EGGS" };
export default function LoginPage() {
  return <FuturePage eyebrow="EGGS / Account" title="One account for EGGS."><p>Account registration and “Log in with EGGS” are coming later. You can explore the public projects today.</p><p>Already a league operator? <Link className="eggs-text-link" href="/operator-login">Open operator sign-in</Link>.</p></FuturePage>;
}
