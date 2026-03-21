import { useRoute, Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { useGetGenerationById } from "@workspace/api-client-react";
import { ArrowLeft, ExternalLink, Box, Sparkles, Image as ImageIcon, Type, ShoppingBag, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { CopyableText } from "@/components/CopyableText";
import { cn } from "@/lib/utils";

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const id = params?.id ? Number(params.id) : 0;

  const { data: result, isLoading, isError } = useGetGenerationById(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground animate-pulse">Carregando resultados...</p>
        </div>
      </div>
    );
  }

  if (isError || !result) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Resultado não encontrado</h2>
          <p className="text-muted-foreground mb-8">Não foi possível carregar os dados desta geração.</p>
          <Link href="/" className="px-6 py-3 bg-card hover:bg-secondary border border-border rounded-xl font-medium transition-colors">
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors py-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="mt-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">{result.product.title}</h1>
            <a href={result.product.originalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline mt-2 text-sm">
              <ExternalLink className="w-4 h-4" />
              {new URL(result.product.originalUrl).hostname}
            </a>
          </div>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Section 1: Product Extracted */}
          <motion.section variants={itemVariants}>
            <SectionHeader icon={<ShoppingBag className="w-5 h-5" />} title="Produto Extraído" />
            <div className="mt-4 bg-card rounded-3xl border border-border overflow-hidden shadow-lg shadow-black/10 flex flex-col sm:flex-row">
              {result.product.imageUrl && (
                <div className="w-full sm:w-1/3 bg-secondary min-h-[250px] sm:min-h-full relative">
                  <img 
                    src={result.product.imageUrl} 
                    alt={result.product.title} 
                    className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity"
                  />
                </div>
              )}
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
                <h3 className="text-xl font-bold">{result.product.title}</h3>
                {result.product.price && (
                  <p className="text-2xl font-display font-semibold text-primary mt-2">{result.product.price}</p>
                )}
                {result.product.description && (
                  <div className="mt-4 text-sm text-muted-foreground leading-relaxed bg-background/50 p-4 rounded-xl border border-border/50 max-h-32 overflow-y-auto">
                    {result.product.description}
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          {/* Section 2: AI Vision Analysis */}
          <motion.section variants={itemVariants}>
            <SectionHeader icon={<Sparkles className="w-5 h-5" />} title="Análise de Visão IA" subtitle="Descrição técnica para fidelidade na geração" />
            <div className="mt-4 bg-card p-6 rounded-3xl border border-border shadow-lg shadow-black/10">
              <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                {result.visionAnalysis.technicalDescription}
              </p>
            </div>
          </motion.section>

          {/* Section 3: Lifestyle Image */}
          <motion.section variants={itemVariants}>
            <SectionHeader icon={<ImageIcon className="w-5 h-5" />} title="Imagem Lifestyle" subtitle="Prompt e imagem gerada por IA" />
            <div className="mt-4 bg-card rounded-3xl border border-border overflow-hidden shadow-lg shadow-black/10">
              {result.lifestyleImageUrl ? (
                <div className="aspect-[4/5] sm:aspect-video w-full bg-secondary relative">
                  <img 
                    src={result.lifestyleImageUrl} 
                    alt="Lifestyle gerado" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-secondary flex items-center justify-center flex-col text-muted-foreground p-6 text-center">
                  <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                  <p>A imagem lifestyle não pôde ser gerada ou está indisponível.</p>
                </div>
              )}
              <div className="p-6 border-t border-border">
                <CopyableText 
                  label="Prompt de Imagem" 
                  text={result.visionAnalysis.imagePrompt} 
                  multiline 
                />
              </div>
            </div>
          </motion.section>

          {/* Section 4: SEO Pack */}
          <motion.section variants={itemVariants}>
            <SectionHeader icon={<Type className="w-5 h-5" />} title="SEO Pack" subtitle="Títulos, descrição, alt text e hashtags otimizados" />
            <div className="mt-4 bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-lg shadow-black/10 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none rounded-full" />
              
              <div className="space-y-4 relative">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Títulos do Pin
                </h4>
                <div className="grid gap-3">
                  {result.seoPack.titles.map((title, idx) => (
                    <CopyableText key={idx} text={title} />
                  ))}
                </div>
              </div>

              <div className="space-y-4 relative">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Descrição do Pin
                </h4>
                <CopyableText text={result.seoPack.description} multiline />
              </div>

              <div className="space-y-4 relative">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Alt Text
                </h4>
                <CopyableText text={result.seoPack.altText} multiline />
              </div>

              <div className="grid sm:grid-cols-2 gap-8 relative">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Overlays de Urgência
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.seoPack.urgencyOverlays.map((overlay, idx) => (
                      <div key={idx} className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-medium">
                        {overlay}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Hashtags
                  </h4>
                  <CopyableText text={result.seoPack.hashtags} multiline className="[&>div>div]:text-primary/90" />
                </div>
              </div>

            </div>
          </motion.section>
        </motion.div>

        <div className="h-20" />
      </main>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode, title: string, subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground border border-border shadow-sm">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
