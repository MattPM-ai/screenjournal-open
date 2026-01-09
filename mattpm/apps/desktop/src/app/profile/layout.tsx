/**
 * Profile Layout
 * 
 * Minimal layout for the profile window. Uses CSS to hide the splash screen
 * rather than modifying DOM directly (which causes hydration mismatches).
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile - MattPM Tracker",
  description: "View your profile information",
};

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* CSS-based splash screen hiding - avoids hydration mismatch */}
      <style dangerouslySetInnerHTML={{
        __html: `#splash-screen { display: none !important; }`
      }} />
      {children}
    </>
  );
}

