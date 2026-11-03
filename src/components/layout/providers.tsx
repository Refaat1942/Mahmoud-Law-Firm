"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children, locale }: { children: React.ReactNode; locale: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
      <Toaster richColors position={locale === "ar" ? "top-left" : "top-right"} dir={locale === "ar" ? "rtl" : "ltr"} />
    </ThemeProvider>
  );
}
