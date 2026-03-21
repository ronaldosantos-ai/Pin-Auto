import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyableTextProps {
  label?: string;
  text: string;
  className?: string;
  multiline?: boolean;
}

export function CopyableText({ label, text, className, multiline = false }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label ? `${label} copiado!` : "Copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar texto");
    }
  };

  return (
    <div className={cn("group relative flex flex-col gap-2", className)}>
      {label && <span className="text-sm font-semibold text-muted-foreground">{label}</span>}
      <div className="relative">
        <div 
          className={cn(
            "w-full rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm",
            "transition-colors duration-200 group-hover:border-border group-hover:bg-secondary/70",
            multiline ? "p-4 whitespace-pre-wrap" : "px-4 py-3 pr-12 truncate"
          )}
        >
          {text}
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            "absolute flex items-center justify-center rounded-lg transition-all duration-200",
            "hover:bg-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/50",
            multiline ? "top-3 right-3 p-2 bg-background/80 border border-border" : "top-1.5 right-1.5 bottom-1.5 aspect-square bg-background/50",
            copied ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 hover:text-green-500" : "text-muted-foreground"
          )}
          aria-label="Copiar texto"
          title="Copiar texto"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
