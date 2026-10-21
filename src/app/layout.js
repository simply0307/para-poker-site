import localFont from "next/font/local";
import "./globals.css";
import "./eggs.css";
import "./hub.css";
import "./rooms.css";
import "./reath.css";
import "./people.css";
import "./community.css";
import "./product.css";
import { EggsNav } from "@/components/eggs/EggsNav";
import { roomsEnabled } from "@/lib/rooms/core.mjs";

const robotoFlex = localFont({
  src: "./fonts/RobotoFlex-Variable.ttf",
  variable: "--font-roboto-flex",
  display: "swap",
  weight: "100 1000",
});

export const metadata = {
  title: { default: "EGGS — Projects, people & play", template: "%s | EGGS" },
  description:
    "Independent games, Reath Digest, things we make, and the people who bring EGGS to life.",
  icons: { icon: { url: "/brand/eggs-initial.svg", type: "image/svg+xml" } },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${robotoFlex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <EggsNav personal={roomsEnabled()} />
        {children}
      </body>
    </html>
  );
}
