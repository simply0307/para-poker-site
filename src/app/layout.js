import localFont from "next/font/local";
import "./globals.css";
import "./eggs.css";
import { EggsNav } from "@/components/eggs/EggsNav";

const robotoFlex = localFont({
  src: "./fonts/RobotoFlex-Variable.ttf",
  variable: "--font-roboto-flex",
  display: "swap",
  weight: "100 1000",
});

export const metadata = {
  title: { default: "EGGS — Projects, people & play", template: "%s | EGGS" },
  description: "Explore EGGS projects, Para competition, and the Para Poker League public archive.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${robotoFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <EggsNav />
        {children}
      </body>
    </html>
  );
}
