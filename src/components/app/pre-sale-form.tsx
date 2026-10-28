import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { completePreSale, savePreSalePartial } from "@/lib/pre-sales.functions";

const OPEN_PRE_SALE_EVENT = "manostech:open-pre-sale";

export function openPreSaleChat() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_PRE_SALE_EVENT));
}

type Answers = {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
};

type Reply = { question: string; answer: string };

const emptyAnswers: Answers = {
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  summary: "",
};

type ScreenField = {
  field: keyof Answers;
  question: string;
  label: string;
  placeholder: string;
  type: "text" | "tel" | "email" | "textarea";
  required: boolean;
  autoComplete: string;
  maxLength: number;
};

type Screen = {
  question: string;
  fields: ScreenField[];
};

const screens: Screen[] = [
  {
    question: "Vamos lá: qual é o seu WhatsApp, seu nome e o nome da empresa?",
    fields: [
      {
        field: "phone",
        question: "Qual WhatsApp podemos usar para conversar sobre a proposta?",
        label: "WhatsApp para contato",
        placeholder: "(00) 00000-0000",
        type: "tel",
        required: true,
        autoComplete: "tel",
        maxLength: 32,
      },
      {
        field: "contactName",
        question: "E como posso chamar você?",
        label: "Seu nome",
        placeholder: "Seu nome",
        type: "text",
        required: true,
        autoComplete: "name",
        maxLength: 120,
      },
      {
        field: "companyName",
        question: "Qual é o nome da sua empresa ou estabelecimento?",
        label: "Empresa ou estabelecimento",
        placeholder: "Ex.: Padaria Central",
        type: "text",
        required: true,
        autoComplete: "organization",
        maxLength: 160,
      },
    ],
  },
  {
    question: "E sobre o espaço: onde fica, qual e-mail para os detalhes e o que você precisa?",
    fields: [
      {
        field: "city",
        question: "Em qual cidade fica o estabelecimento?",
        label: "Cidade (opcional)",
        placeholder: "Cidade - UF",
        type: "text",
        required: false,
        autoComplete: "address-level2",
        maxLength: 100,
      },
      {
        field: "email",
        question: "Qual é o melhor e-mail para enviar os detalhes?",
        label: "E-mail (opcional)",
        placeholder: "voce@empresa.com.br",
        type: "email",
        required: false,
        autoComplete: "email",
        maxLength: 160,
      },
      {
        field: "summary",
        question: "O que você precisa? Conte um pouco sobre o espaço e como gostaria de oferecer Wi-Fi aos seus clientes.",
        label: "Resumo da necessidade (opcional)",
        placeholder: "Ex.: temos salão e área externa; queremos oferecer Wi-Fi e divulgar as promoções...",
        type: "textarea",
        required: false,
        autoComplete: "off",
        maxLength: 3000,
      },
    ],
  },
];

const TOTAL_STEPS = screens.length + 1;

const SUMMARY_SUGGESTIONS = ["Salão + área externa", "Só salão", "Vários ambientes"];

const WHATSAPP_URL = `https://wa.me/5547997049730?text=${encodeURIComponent(
  "Olá! Quero saber como o ManosTech System pode funcionar no meu negócio.",
)}`;

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-[#070c15] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10";

export function PreSaleForm() {
  const savePartial = useServerFn(savePreSalePartial);
  const complete = useServerFn(completePreSale);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [leadId, setLeadId] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const activeScreen = screens[step];
  const lastStep = step === screens.length;

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_PRE_SALE_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_PRE_SALE_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    if (!sent && !lastStep) window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open, replies, step, sent, lastStep]);

  function resetConversation() {
    setStep(0);
    setAnswers(emptyAnswers);
    setReplies([]);
    setDrafts({});
    setLeadId("");
    setConsent(false);
    setBusy(false);
    setSent(false);
    setError("");
  }

  function goBack() {
    if (step <= 0 || sent || busy) return;
    const previousScreen = screens[step - 1];
    if (!previousScreen) return;
    setReplies((current) => current.slice(0, -previousScreen.fields.length));
    const restored: Record<string, string> = {};
    for (const field of previousScreen.fields) restored[field.field] = answers[field.field] ?? "";
    setDrafts(restored);
    setStep((current) => current - 1);
    setError("");
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent) return;

    if (lastStep) {
      if (!consent) {
        setError("Marque a autorização para a equipe responder a esta solicitação.");
        return;
      }
      if (!leadId) {
        setError("Não foi possível localizar esta solicitação. Recomece o atendimento.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await complete({
          data: {
            id: leadId,
            email: answers.email,
            city: answers.city,
            summary: answers.summary,
            consent: true,
            website: "",
          },
        });
        setReplies((current) => [
          ...current,
          { question: "Você autoriza o uso desses dados para responder ao pedido?", answer: "Sim, autorizo." },
        ]);
        setSent(true);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar. Tente novamente.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!activeScreen) return;
    const formData = new FormData(event.currentTarget);
    const values: Partial<Answers> = {};
    for (const field of activeScreen.fields) {
      values[field.field] = String(formData.get(field.field) || "").trim();
    }
    for (const field of activeScreen.fields) {
      const value = values[field.field] ?? "";
      if (field.required && !value) {
        setError("Preencha os campos obrigatórios para continuar.");
        return;
      }
      if (field.field === "phone" && value.length < 8) {
        setError("Informe um WhatsApp válido.");
        return;
      }
      if ((field.field === "contactName" || field.field === "companyName") && value.length < 2) {
        setError("Informe seu nome e o nome da empresa.");
        return;
      }
      if (field.field === "email" && value && !value.includes("@")) {
        setError("Informe um e-mail válido ou deixe o campo em branco.");
        return;
      }
    }

    const answer = { ...answers, ...values } as Answers;
    const newReplies: Reply[] = activeScreen.fields.map((field) => ({
      question: field.question,
      answer: values[field.field] || "Prefiro informar depois.",
    }));

    // O contato é salvo já no primeiro passo: se o visitante parar aqui,
    // a equipe já tem o WhatsApp e pode chamar de volta.
    if (step === 0) {
      setBusy(true);
      setError("");
      try {
        const saved = await savePartial({
          data: {
            companyName: answer.companyName,
            contactName: answer.contactName,
            phone: answer.phone,
            website: "",
          },
        });
        setLeadId(saved.id);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Não foi possível registrar. Tente novamente.");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    setAnswers(answer);
    setReplies((current) => [...current, ...newReplies]);
    setDrafts({});
    setError("");
    setStep((current) => current + 1);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[150] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6 print:hidden print-hide">
      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Pré-venda Manos Tech"
          className="flex max-h-[min(740px,calc(100dvh-6rem))] w-[calc(100vw-2rem)] max-w-[420px] animate-in slide-in-from-bottom-3 fade-in flex-col overflow-hidden rounded-[1.5rem] border border-cyan-300/20 bg-[#0b1220] shadow-[0_28px_90px_rgba(0,0,0,.62)] duration-200"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/[.08] bg-[#0c1726] px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <MessageCircle className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">Manos Tech · Pré-venda</h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  Atendimento inicial pelo site
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/[.07] hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"
              aria-label="Fechar pré-venda"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,.05),transparent_55%)] p-4 sm:p-5">
            <div className="flex items-end gap-2">
              <span className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                <MessageCircle className="size-3.5" />
              </span>
              <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/[.07] bg-[#141e2d] px-3.5 py-3 text-sm leading-6 text-slate-200">
                Oi! 👋 Quer saber como o ManosTech System pode funcionar no seu negócio? São só 3 passos rápidos — menos de 1 minuto.
              </div>
            </div>

            {replies.map((reply, index) => (
              <div key={`${reply.question}-${index}`} className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                    <MessageCircle className="size-3.5" />
                  </span>
                  <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/[.07] bg-[#141e2d] px-3.5 py-2.5 text-sm leading-6 text-slate-200">
                    {reply.question}
                  </p>
                </div>
                <div className="flex justify-end">
                  <p className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-cyan-300/15 bg-cyan-300/[.12] px-3.5 py-2.5 text-sm leading-6 text-cyan-50">
                    {reply.answer}
                  </p>
                </div>
              </div>
            ))}

            {!sent && !lastStep && activeScreen ? (
              <div className="flex items-end gap-2">
                <span className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                  <MessageCircle className="size-3.5" />
                </span>
                <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/[.07] bg-[#141e2d] px-3.5 py-2.5 text-sm leading-6 text-slate-200">
                  {activeScreen.question}
                </p>
              </div>
            ) : null}

            {lastStep && !sent ? (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                    <MessageCircle className="size-3.5" />
                  </span>
                  <p className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/[.07] bg-[#141e2d] px-3.5 py-2.5 text-sm leading-6 text-slate-200">
                    Você autoriza o uso desses dados para responder a esta solicitação e entrar em contato sobre a proposta?
                  </p>
                </div>
                <div className="ml-9 rounded-2xl border border-white/[.07] bg-[#101a29] p-3.5">
                  <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-cyan-400"
                    />
                    <span>
                      Sim, autorizo. Consulte a{" "}
                      <a className="text-cyan-200 underline underline-offset-2" href="/politica-de-privacidade" target="_blank" rel="noreferrer">
                        Política de Privacidade
                      </a>.
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {sent ? (
              <div className="flex items-end gap-2">
                <span className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-200">
                  <CheckCircle2 className="size-4" />
                </span>
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-emerald-300/15 bg-emerald-300/[.08] px-3.5 py-3 text-sm leading-6 text-emerald-50">
                  Pronto! Sua solicitação chegou para a equipe Manos Tech. Vamos analisar o que você contou e entrar em contato. Obrigado pela conversa! ✨
                  <button
                    type="button"
                    onClick={resetConversation}
                    className="mt-2 block text-xs font-semibold text-cyan-200 underline underline-offset-2 hover:text-white"
                  >
                    Iniciar uma nova conversa
                  </button>
                </div>
              </div>
            ) : null}
            <div className="h-px" />
          </div>

          {!sent ? (
            <form onSubmit={handleReply} className="border-t border-white/[.08] bg-[#0c1421] p-3.5 sm:p-4">
              {lastStep ? (
                <>
                  <div className="flex gap-2">
                    {step > 0 ? (
                      <button type="button" onClick={goBack} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[.06]">
                        Voltar
                      </button>
                    ) : null}
                    <button type="submit" disabled={busy || !consent} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {busy ? "Enviando…" : "Enviar solicitação"}
                    </button>
                  </div>
                  <div className="mt-2 flex min-h-5 items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-500">Passo {step + 1} de {TOTAL_STEPS}</span>
                    <span className="text-[10px] text-slate-500">menos de 1 minuto</span>
                  </div>
                </>
              ) : activeScreen ? (
                <>
                  <div className="space-y-3">
                    {activeScreen.fields.map((field, fieldIndex) => (
                      <div key={field.field}>
                        <label htmlFor={`pre-sale-${field.field}`} className="mb-1.5 block text-[11px] font-medium text-slate-400">
                          {field.label}{field.required ? " *" : ""}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            ref={fieldIndex === 0 ? (inputRef as RefObject<HTMLTextAreaElement>) : undefined}
                            id={`pre-sale-${field.field}`}
                            name={field.field}
                            value={drafts[field.field] ?? answers[field.field] ?? ""}
                            onChange={(event) => setDrafts((current) => ({ ...current, [field.field]: event.target.value }))}
                            className={`${inputClass} min-h-[88px] resize-y py-3 leading-5`}
                            placeholder={field.placeholder}
                            required={field.required}
                            maxLength={field.maxLength}
                            autoComplete={field.autoComplete}
                          />
                        ) : (
                          <input
                            ref={fieldIndex === 0 ? (inputRef as RefObject<HTMLInputElement>) : undefined}
                            id={`pre-sale-${field.field}`}
                            name={field.field}
                            type={field.type}
                            value={drafts[field.field] ?? answers[field.field] ?? ""}
                            onChange={(event) => setDrafts((current) => ({ ...current, [field.field]: event.target.value }))}
                            className={`${inputClass} min-h-11`}
                            placeholder={field.placeholder}
                            required={field.required}
                            minLength={field.required ? (field.field === "phone" ? 8 : 2) : undefined}
                            maxLength={field.maxLength}
                            autoComplete={field.autoComplete}
                          />
                        )}
                        {field.field === "summary" ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {SUMMARY_SUGGESTIONS.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setDrafts((current) => ({ ...current, summary: suggestion }))}
                                className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button type="submit" disabled={busy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                    {busy ? "Salvando…" : "Continuar"}
                  </button>
                  <div className="mt-2 flex min-h-5 items-center justify-between gap-3">
                    {step > 0 ? (
                      <button type="button" onClick={goBack} className="text-xs font-medium text-slate-400 transition hover:text-white">
                        Voltar
                      </button>
                    ) : <span />}
                    <span className="text-[10px] text-slate-500">Passo {step + 1} de {TOTAL_STEPS} · menos de 1 minuto</span>
                  </div>
                </>
              ) : null}
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="mt-1 block text-center text-xs font-semibold text-cyan-200 transition hover:text-white">
                Prefiro falar direto no WhatsApp →
              </a>
              {error ? <p role="alert" className="mt-2 rounded-lg border border-rose-400/20 bg-rose-400/[.06] px-3 py-2 text-xs text-rose-200">{error}</p> : null}
              <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">
                Seus dados serão usados somente para responder a esta solicitação. Não há contratação nem cobrança pelo envio.
              </p>
            </form>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Fechar pré-venda" : "Abrir pré-venda"}
        title="Pré-venda Manos Tech"
        className="group grid size-14 place-items-center rounded-full border border-cyan-200/30 bg-cyan-400 text-slate-950 shadow-[0_12px_40px_rgba(0,194,204,.3)] transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-[0_14px_44px_rgba(0,194,204,.4)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5 transition-transform group-hover:scale-110" /> }
      </button>
    </div>
  );
}
