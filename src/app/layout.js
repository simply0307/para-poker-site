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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
