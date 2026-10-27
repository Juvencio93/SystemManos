import { useRef } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BannerAgentDialog, BannerEventObserver } from "@/components/app/ai-agent-card";

/**
 * Casa do gerador de banners em Campanhas (matriz e filial).
 *
 * O assistente vivia dentro do cartao do Gerente Operacional IA, que
 * saiu das capas no PR #105 — e o gerador foi junto. Aqui ele volta
 * como um cartao proprio da pagina de Campanhas, reusando o MESMO
 * dialogo do agente (BannerAgentDialog) e o observador de eventos
 * 'open-banner-agent', sem ressuscitar o cartao antigo.
 */
export function BannerAgentHost() {
  const bannerAgentRef = useRef<{ openWithPrompt: (prompt: string) => void } | null>(null);

  return (
    <Card className="mb-8 border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Criar banner com IA</p>
          <p className="text-xs text-muted-foreground">
            Descreva o banner que você quer e a IA gera a imagem com a logo da sua empresa.
          </p>
        </div>
        <Button onClick={() => bannerAgentRef.current?.openWithPrompt("")}>Começar</Button>
      </CardContent>
      <BannerAgentDialog ref={bannerAgentRef} />
      <BannerEventObserver onOpen={(p) => bannerAgentRef.current?.openWithPrompt(p)} />
    </Card>
  );
}
