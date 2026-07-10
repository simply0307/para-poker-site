import { redirect } from "next/navigation";

export default function LegacyPlayersRedirect() {
  redirect("/players-v2");
}
