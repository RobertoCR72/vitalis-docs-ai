import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/governanca")({
  head: () => ({
    meta: [
      { title: "Governança e Ética — Nexo" },
      {
        name: "description",
        content: "Princípios de governança, privacidade e uso responsável de IA no projeto Nexo.",
      },
    ],
  }),
  component: Governanca,
});

function Governanca() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Governança, ética e privacidade</h1>
        <p className="mt-3 text-muted-foreground">
          O Nexo é um protótipo acadêmico. Este documento resume as diretrizes que orientam seu desenvolvimento e uso.
        </p>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Escopo e limites</h2>
          <Card className="p-5 text-sm text-muted-foreground">
            O copiloto responde exclusivamente com base em documentos previamente publicados na base. Não utiliza conhecimento externo, busca na internet ou memória entre sessões. Quando a evidência é insuficiente, o copiloto informa isso ao usuário.
          </Card>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Uso responsável</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li>Nenhum dado pessoal, confidencial ou regulado deve ser carregado nesta publicação.</li>
            <li>Os documentos incluídos são fictícios e servem apenas para demonstração acadêmica.</li>
            <li>Respostas devem ser conferidas pelo usuário antes de qualquer decisão.</li>
            <li>Em conflitos entre documentos vigentes, o Nexo aponta o conflito, não decide.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Privacidade e retenção</h2>
          <Card className="p-5 text-sm text-muted-foreground">
            As conversas são armazenadas para permitir histórico pessoal e auditoria mínima. Cada usuário só vê suas próprias conversas (RLS). Documentos são privados por padrão.
          </Card>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">Segurança</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li>Autenticação obrigatória; separação de papéis <b>user</b> e <b>admin</b>.</li>
            <li>Row-Level Security em todas as tabelas de dados pessoais.</li>
            <li>Prompts do sistema tratam conteúdo de documento como <em>dado</em>, nunca como instrução.</li>
            <li>Rate-limit por usuário para mitigar abuso e custo excessivo de IA.</li>
          </ul>
        </section>

        <div className="mt-10">
          <Button asChild variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}