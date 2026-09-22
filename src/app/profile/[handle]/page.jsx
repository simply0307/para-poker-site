import { notFound } from "next/navigation";

// Reserved for real, visibility-filtered EGGS records after the schema and RLS
// review. Never infer an EGGS profile from a Poker slug or an arbitrary handle.
export default function ProfilePage() {
  notFound();
}
