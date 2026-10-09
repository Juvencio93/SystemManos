import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileCheck2, Scale } from "lucide-react";
import type { ReactNode } from "react";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  children: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  summary,
  updatedAt,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-[#030812] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.10),transparent_28%)]" />
      <header className="relative border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            to="/auth"
            className="flex items-center gap-3"
            aria-label="Voltar para o acesso ao sistema"
          >
            <img
              src="/favicon.png"
              alt="Manos Tech"
              className="size-10 rounded-lg object-contain"
            />
            <div>
              <p className="font-semibold tracking-tight">Manos Tech</p>
              <p className="text-xs text-slate-400">Central jurídica</p>
            </div>
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
            <Scale className="size-6 text-cyan-300" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Documentos públicos
            </p>
            <nav className="mt-4 space-y-2 text-sm">
              <Link
                to="/termos-de-uso"
                className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Termos de uso
              </Link>
              <Link
                to="/politica-de-privacidade"
                className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Política de privacidade
              </Link>
              <Link
                to="/direitos-do-titular"
                className="block rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Direitos do titular
              </Link>
            </nav>
          </div>
        </aside>

        <article className="min-w-0">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5">
                <FileCheck2 className="size-3.5" /> Atualizado em {updatedAt}
              </span>
              <span>Versão vigente</span>
            </div>
          </div>
          <div className="legal-content space-y-8 rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10 sm:p-9">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-8 border-b border-white/10 pb-8 last:border-0 last:pb-0">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-5">
      {items.map((item) => (
        <li key={item} className="list-disc pl-1 marker:text-cyan-400">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LegalCompanyDetails() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="font-semibold text-white">Manos Tech LTDA</p>
      <p>CNPJ: 52.499.913/0001-06</p>
      <p>
        Rua Corretor Aldo Pereira da Costa, 261, Apto. 02, Meia Praia, Navegantes/SC, CEP 88372-064.
      </p>
      <p>Telefone: (47) 99704-9730</p>
      <p>
        E-mail:{" "}
        <a href="mailto:manostech.suporte@gmail.com" className="text-cyan-300">
          manostech.suporte@gmail.com
        </a>
      </p>
      <p>Encarregado pelo tratamento de dados pessoais: Manos Tech.</p>
    </div>
  );
}
