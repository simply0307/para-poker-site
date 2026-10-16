import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { StudioShell } from "@/components/rooms/StudioShell";
export default function ProjectsLayout({ children }) {
  return roomsEnabled() ? <StudioShell>{children}</StudioShell> : children;
}
