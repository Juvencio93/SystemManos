import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { submitPreSale } from "@/lib/pre-sales.functions";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#070c15] px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10";

export function PreSaleForm() {
  const send = useServerFn(submitPreSale);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await send({
        data: {
          companyName: String(form.get("companyName") || ""),
          cnpj: String(form.get("cnpj") || ""),
          contactName: String(form.get("contactName") || ""),
          email: String(form.get("email") || ""),
          phone: String(form.get("phone") || ""),
          city: String(form.get("city") || ""),
          summary: String(form.get("summary") || ""),
          consent: form.get("consent") === "on",
          website: String(form.get("website") || ""),
        },
      });
      setSent(true);
      formElement.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="contato" className="border-y border-white/[.07] bg-[#080e18]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Pré-venda</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Conte como funciona seu negócio
          </h2>
          <p className="mt-4 leading-7 text-slate-400">
            Envie os dados básicos da empresa e o que você precisa. A equipe Manos Tech recebe a
            solicitação no sistema e entra em contato para entender a operação e preparar a proposta.
          </p>
          <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.04] p-4 text-sm leading-6 text-slate-300">
            Sem compromisso: esta mensagem inicia uma conversa comercial. A contratação e os valores
            são definidos depois de entendermos sua necessidade.
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-[#0b1220] p-5 shadow-2xl shadow-black/25 sm:p-7">
          {sent ? (
            <div className="grid min-h-[420px] content-center justify-items-center text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 className="size-7" />
              </span>
              <h3 className="mt-5 text-xl font-bold">Solicitação recebida</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                Seus dados foram registrados. A equipe Manos Tech vai analisar o resumo e falar com você.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100"
              >
                Enviar outra solicitação <ArrowRight className="size-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">Solicite uma conversa</h3>
                <p className="mt-1 text-sm text-slate-400">Os campos marcados com * são necessários.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                  Empresa ou nome do negócio *
                  <input className={fieldClass} name="companyName" autoComplete="organization" required minLength={2} maxLength={160} />
                </label>
                <label className="text-sm font-medium text-slate-200">
                  CNPJ <span className="font-normal text-slate-500">(opcional)</span>
                  <input className={fieldClass} name="cnpj" inputMode="numeric" maxLength={24} placeholder="00.000.000/0000-00" />
                </label>
                <label className="text-sm font-medium text-slate-200">
                  Cidade <span className="font-normal text-slate-500">(opcional)</span>
                  <input className={fieldClass} name="city" autoComplete="address-level2" maxLength={100} placeholder="Cidade - UF" />
                </label>
                <label className="text-sm font-medium text-slate-200">
                  Seu nome *
                  <input className={fieldClass} name="contactName" autoComplete="name" required minLength={2} maxLength={120} />
                </label>
                <label className="text-sm font-medium text-slate-200">
                  WhatsApp para contato *
                  <input className={fieldClass} name="phone" type="tel" autoComplete="tel" required minLength={8} maxLength={32} placeholder="(00) 00000-0000" />
                </label>
                <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                  E-mail *
                  <input className={fieldClass} name="email" type="email" autoComplete="email" required maxLength={160} />
                </label>
                <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                  O que você precisa? *
                  <textarea
                    className={`${fieldClass} min-h-32 resize-y py-3 leading-6`}
                    name="summary"
                    required
                    minLength={20}
                    maxLength={3000}
                    placeholder="Conte um pouco sobre o estabelecimento, quantos espaços precisam de Wi-Fi e o que gostaria de oferecer aos clientes."
                  />
                </label>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-400">
                <input className="mt-1 size-4 shrink-0 accent-cyan-400" type="checkbox" name="consent" required />
                <span>
                  Autorizo a Manos Tech a usar estes dados para responder a esta solicitação e entrar em
                  contato sobre a proposta. Consulte a <a className="text-cyan-200 underline underline-offset-2" href="/politica-de-privacidade">Política de Privacidade</a>.
                </span>
              </label>

              <input
                className="pointer-events-none absolute -left-[10000px] h-px w-px opacity-0"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {error ? (
                <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[.06] px-4 py-3 text-sm text-rose-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                {busy ? "Enviando solicitação…" : "Enviar para a Manos Tech"}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                Seus dados serão usados para atender este contato. O envio não cria uma contratação nem uma cobrança.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

