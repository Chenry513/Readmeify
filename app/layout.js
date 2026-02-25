import Providers from "./components/Providers";
import "./globals.css";

export const metadata = {
  title: "readmeify",
  description: "Generate beautiful READMEs from your GitHub repos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
