import { Link, useLocation } from "wouter";
import { Wrench, Users, LayoutDashboard, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Users, label: "Customers", href: "/customers" },
    { icon: Search, label: "Search", href: "/search" },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-secondary/30">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border/50 bg-sidebar/50">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-foreground text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight text-lg">Bromley Hub</span>
        </div>
        
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href) && item.href !== "/search");
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground/60">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </div>
        </div>
      </aside>

      {/* Mobile Header (simplified for brevity, main app is focus) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="md:hidden flex h-14 items-center justify-between border-b bg-background px-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-bold">Bromley Hub</span>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/" className={location === "/" ? "text-primary" : "text-muted-foreground"}>Dash</Link>
            <Link href="/customers" className={location.startsWith("/customers") ? "text-primary" : "text-muted-foreground"}>Cust</Link>
            <Link href="/search" className={location === "/search" ? "text-primary" : "text-muted-foreground"}>Search</Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
