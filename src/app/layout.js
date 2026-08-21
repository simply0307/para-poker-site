import localFont from "next/font/local";
import "./globals.css";

const robotoFlex = localFont({
  src: "./fonts/RobotoFlex-Variable.ttf",
  variable: "--font-roboto-flex",
  display: "swap",
  weight: "100 1000",
});

export const metadata = {
  title: "Para-Poker League",
  description: "Official Para-Poker League newsroom, standings, sessions, and player archive.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${robotoFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
