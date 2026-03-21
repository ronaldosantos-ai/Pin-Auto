import { Link } from "wouter";
import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-rose-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">PinAuto <span className="text-muted-foreground font-normal text-sm ml-1">v1.0</span></span>
        </Link>
      </div>
    </header>
  );
}
