"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Upload, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/upload", label: "上传", icon: Upload },
    { href: "/meetings", label: "会议列表", icon: List },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <FileText className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">会议纪要</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Button
                    key={link.href}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    asChild
                  >
                    <Link href={link.href} className="gap-2">
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  </Button>
                );
              })}
            </nav>

            {/* Mobile Navigation */}
            <nav className="md:hidden flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Button
                    key={link.href}
                    variant={isActive ? "secondary" : "ghost"}
                    size="icon-sm"
                    asChild
                  >
                    <Link href={link.href} aria-label={link.label}>
                      <Icon className="h-4 w-4" />
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
        </div>
        <Separator />
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          会议纪要生成系统 © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}