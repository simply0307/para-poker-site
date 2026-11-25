import localFont from "next/font/local";
import "./globals.css";

const robotoFlex = localFont({
  src: "./fonts/RobotoFlex-Variable.ttf",
  variable: "--font-roboto-flex",
  display: "swap",
  weight: "100 1000",
});

export const metadata = {
  title: "Para League",
  description: "Official Para League coverage of competitive SuitFire and Poker, with season records and reporting from Reath.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${robotoFlex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<footer aria-label="Para League signature" className="flex items-center justify-center gap-4 bg-black px-4 py-5 text-white"><a href="/" aria-label="Para League home"><img src="/images/para-signature-reverse.svg" alt="PARA" width="96" height="27"/></a><a href="/images/para-signature-sheet.svg" className="text-xs tracking-wide underline">League identity</a></footer></body>
    </html>
  );
}
