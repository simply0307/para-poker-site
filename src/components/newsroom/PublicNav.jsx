"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const publicLinks = [
  ["/sessions", "Sessions"],
  ["/players", "Players"],
  ["/standings", "Standings"],
  ["/moments", "Moments"],
  ["/articles", "Articles"],
];

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNav() {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end overflow-x-auto sm:overflow-visible">
      <div className="flex min-w-max items-center gap-1 text-xs text-stone-300 sm:gap-2 md:text-sm">
        {publicLinks.map(([href, label]) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-sm border px-2.5 py-2 uppercase tracking-[0.1em] transition md:px-3 ${
                active
                  ? "border-[#d8c087]/45 bg-[#d8c087]/12 text-[#fff1bf]"
                  : "border-transparent hover:border-[#d8c087]/30 hover:text-white"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
