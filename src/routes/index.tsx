import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, FileSearch, MessageSquareText, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexo — Copiloto Corporativo com IA" },
      {
        name: "description",
        content:
          "Nexo é um copiloto corporativo acadêmico que responde perguntas sobre políticas e procedimentos com citações verificáveis.",
      },
      { property: "og:title", content: "Nexo — Copiloto Corporativo com IA" },
      {
        property: "og:description",
        content:
          "Respostas fundamentadas em documentos vigentes, com citação, versão e página. Protótipo acadêmico.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              N
            </span>
            <span>Nexo</span>
          </Link>
          <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
            <Link to="/governanca" className="hover:text-foreground">Governança</Link>
            <Link to="/sobre" className="hover:text-foreground">Sobre</Link>
          </nav>
          <Button asChild variant="outline">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Protótipo acadêmico · Documentos demonstrativos
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            O copiloto corporativo que responde <span className="text-accent">apenas com base</span> nos seus documentos vigentes.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            O Nexo permite que colaboradores consultem políticas e procedimentos em linguagem natural, recebendo respostas fundamentadas com citação de documento, versão e página. Quando não há evidência, ele diz — não inventa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Acessar o Copiloto <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/sobre">Como funciona</Link>
            </Button>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {[
              { icon: FileSearch, title: "1. Base curada", desc: "Um administrador carrega PDFs e TXTs. Cada versão fica rastreável, com código, vigência e status." },
              { icon: MessageSquareText, title: "2. Pergunta em português", desc: "Colaboradores conversam com o copiloto. A IA busca trechos relevantes por semântica e texto." },
              { icon: ShieldCheck, title: "3. Resposta com citação", desc: "Toda resposta cita documento, versão e página. Sem evidência, o copiloto responde \"não encontrado\"." },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="p-6">
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Rastreabilidade em primeiro lugar</h2>
              <p className="mt-4 text-muted-foreground">
                Backend com autenticação, autorização e RLS. Documentos privados, chunks vetorizados e busca híbrida. As citações são validadas no servidor a partir dos IDs internos — o modelo não pode "inventar" fontes.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>• Papéis <b>user</b> e <b>admin</b>, promoção manual.</li>
                <li>• Limites de consulta por usuário.</li>
                <li>• Auditoria das ações administrativas.</li>
                <li>• Não usa conhecimento externo para completar lacunas.</li>
              </ul>
            </div>
            <Card className="p-6">
              <BookOpen className="h-6 w-6 text-accent" />
              <h3 className="mt-4 text-lg font-semibold">Conteúdo demonstrativo</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Este projeto acompanha três políticas fictícias — Trabalho Híbrido, Reembolso de Despesas e Viagens Corporativas — para demonstração. Nenhum dado real ou confidencial deve ser carregado nesta publicação.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
          © Nexo — projeto acadêmico. Respostas de IA baseadas em documentos demonstrativos. Confirme decisões relevantes com a área responsável.
        </div>
      </footer>
    </div>
  );
}
