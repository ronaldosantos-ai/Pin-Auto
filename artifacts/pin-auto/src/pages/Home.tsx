import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useGeneratePinAssets, useGetHistory } from "@workspace/api-client-react";
import { Bot, Tag, Image as ImageIcon, Loader2, ArrowRight, Link2 } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/Header";

export default function Home() {
  const [, navigate] = useLocation();
  const [url, setUrl] = useState("");
  
  const generateMutation = useGeneratePinAssets({
    mutation: {
      onSuccess: (data) => {
        navigate(`/results/${data.id}`);
      }
    }
  });

  const { data: history, isLoading: isHistoryLoading } = useGetHistory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    generateMutation.mutate({ data: { url: url.trim() } });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative isolate pt-24 pb-20 overflow-hidden">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Hero Background" 
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30 mix-blend-screen mask-image-gradient"
            style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/0 via-background/80 to-background" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                Pins de Alta Conversão <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-400">
                  em Segundos
                </span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Cole a URL, a IA faz o resto. Imagem lifestyle, títulos SEO, descrições com gatilhos e hashtags prontos para postar.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="mt-10"
            >
              <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto flex items-center group">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                <div className="absolute left-6 text-muted-foreground pointer-events-none">
                  <Link2 className="w-5 h-5" />
                </div>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Cole a URL do produto aqui..."
                  className="w-full bg-secondary/40 backdrop-blur-xl border border-white/10 rounded-full py-4 pl-14 pr-[160px] sm:pr-[180px] text-base sm:text-lg focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 text-white placeholder:text-muted-foreground transition-all shadow-2xl shadow-black/50"
                  disabled={generateMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="absolute right-2 top-2 bottom-2 px-4 sm:px-6 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:to-primary text-white font-semibold transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="hidden sm:inline">Gerando...</span>
                    </>
                  ) : (
                    <>
                      Gerar Ativos
                      <ArrowRight className="w-4 h-4 hidden sm:block" />
                    </>
                  )}
                </button>
              </form>

              {generateMutation.isError && (
                <p className="mt-4 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg inline-block border border-destructive/20">
                  {generateMutation.error?.message || "Ocorreu um erro ao gerar os ativos. Tente novamente."}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="mt-12 flex flex-wrap justify-center gap-4 sm:gap-6"
            >
              <FeatureBadge icon={<Bot className="w-4 h-4" />} title="Extração Automática" subtitle="Scraping inteligente" />
              <FeatureBadge icon={<Tag className="w-4 h-4" />} title="SEO Otimizado" subtitle="Títulos e tags" />
              <FeatureBadge icon={<ImageIcon className="w-4 h-4" />} title="Imagem Lifestyle" subtitle="Gerada por IA" />
            </motion.div>
          </div>
        </section>

        {/* History Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex-1">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Histórico</h2>
          </div>

          {isHistoryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-card/50 animate-pulse rounded-2xl border border-border" />
              ))}
            </div>
          ) : history?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((item) => (
                <Link key={item.id} href={`/results/${item.id}`} className="block group">
                  <div className="bg-card hover:bg-card/80 border border-border hover:border-primary/50 transition-all duration-300 p-4 rounded-2xl flex gap-4 items-center shadow-lg shadow-black/20 group-hover:-translate-y-1">
                    {item.productImageUrl ? (
                      <img src={item.productImageUrl} alt={item.productTitle} className="w-20 h-20 rounded-xl object-cover bg-secondary" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{item.productTitle}</h4>
                      <p className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
                        <Link2 className="w-3 h-3 flex-shrink-0" />
                        {new URL(item.originalUrl).hostname}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3 font-mono">
                        {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 px-4 bg-card/30 border border-border border-dashed rounded-3xl">
              <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhum pin gerado</h3>
              <p className="text-muted-foreground mt-2">Os produtos que você gerar aparecerão aqui.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FeatureBadge({ icon, title, subtitle }: { icon: React.ReactNode, title: string, subtitle: string }) {
  return (
    <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border px-4 py-3 rounded-2xl shadow-xl shadow-black/20">
      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div className="text-left">
        <p className="text-sm font-bold text-foreground leading-none">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
