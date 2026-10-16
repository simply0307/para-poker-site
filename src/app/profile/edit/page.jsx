import { notFound, redirect } from "next/navigation";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { pageConsumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { AccountUnavailable } from "@/components/eggs/AccountFrame";
import { roomRepository } from "@/lib/rooms/repository.mjs";
import { hubRepository } from "@/lib/hub/repository.mjs";
import { RoomEditor } from "@/components/rooms/RoomEditor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Edit My Page",
  robots: { index: false, follow: false },
};
export default async function EditRoom() {
  if (!roomsEnabled()) notFound();
  let context, error;
  try {
    context = await pageConsumerContext();
    await requireEggsUser(context);
  } catch (e) {
    error = e;
  }
  if ([401, 403].includes(error?.status)) redirect("/login");
  if (error) return <AccountUnavailable />;
  const profile = await context.client.rpc("get_my_eggs_profile");
  if (profile.error) return <AccountUnavailable />;
  if (!profile.data?.[0]) redirect("/profile");
  let data;
  try {
    data = await Promise.all([
      roomRepository(context.client).mine(),
      hubRepository(context.client).published(),
      roomRepository(context.client).works(),
    ]);
  } catch {
    return <AccountUnavailable />;
  }
  return (
    <RoomEditor initialRoom={data[0]} projects={data[1]} works={data[2]} />
  );
}
