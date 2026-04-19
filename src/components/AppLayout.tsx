import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop header */}
        <AppHeader />

        {/* Mobile header */}
        <MobileHeader />

        <main className="flex-1 overflow-auto pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
