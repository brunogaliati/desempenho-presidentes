"use client";
import { useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { linkCompartilhado, type FiltrosCompartilhados } from "@/lib/compartilhamento";
import { useRecorteCompartilhado } from "./RecortesCompartilhaveis";

const cod = encodeURIComponent;

interface Destino {
  id: string;
  nome: string;
  /** Complemento de "Como chega…". */
  onde: string;
  dica: string;
  cor: string;
  tinta?: string;
  glifo: string;
  tamanho: number;
  /** Facebook e LinkedIn ignoram texto pronto: a frase vai para a área de transferência. */
  soLink?: boolean;
  link?: (texto: string, url: string) => string;
}

const DESTINOS: Destino[] = [
  {
    id: "whatsapp", nome: "WhatsApp", onde: "no WhatsApp", cor: "#1da851", tamanho: 26,
    dica: "Abre a conversa com a frase e o link prontos.",
    glifo: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
    link: (texto, url) => "https://api.whatsapp.com/send?text=" + cod(texto ? texto + "\n\n" + url : url),
  },
  {
    id: "telegram", nome: "Telegram", onde: "no Telegram", cor: "#229ed9", tamanho: 46,
    dica: "Abre a escolha do contato, com a frase e o link.",
    glifo: "M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
    link: (texto, url) => "https://t.me/share/url?url=" + cod(url) + (texto ? "&text=" + cod(texto) : ""),
  },
  {
    id: "x", nome: "X", onde: "no X", cor: "light-dark(#0f1419,#f1f3f5)", tinta: "light-dark(#fff,#0f1419)", tamanho: 19,
    dica: "Abre o post com a frase e o link.",
    glifo: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
    link: (texto, url) => "https://twitter.com/intent/tweet?url=" + cod(url) + (texto ? "&text=" + cod(texto) : ""),
  },
  {
    id: "facebook", nome: "Facebook", onde: "no Facebook", cor: "#1877f2", tamanho: 46, soLink: true,
    dica: "O Facebook só recebe o link. A frase vai copiada para você colar.",
    glifo: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245Z",
    link: (_texto, url) => "https://www.facebook.com/sharer/sharer.php?u=" + cod(url),
  },
  {
    id: "linkedin", nome: "LinkedIn", onde: "no LinkedIn", cor: "#0a66c2", tamanho: 22, soLink: true,
    dica: "O LinkedIn só recebe o link. A frase vai copiada para você colar.",
    glifo: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zM7.119 20.452H3.555V9h3.564v11.452z",
    link: (_texto, url) => "https://www.linkedin.com/sharing/share-offsite/?url=" + cod(url),
  },
  {
    id: "mais", nome: "Mais", onde: "em outros aplicativos", cor: "var(--faixa-ativa)", tinta: "var(--tinta)", tamanho: 22,
    dica: "Abre o menu de compartilhamento do seu aparelho.",
    glifo: "M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  },
];

const NOTA = "Abre neste recorte, com os filtros de agora.";

interface Capa { imagem: string | null; titulo: string; descricao: string }

/** Lê das metatags o que os aplicativos vão ler: a prévia não pode prometer outra coisa. */
function lerCapa(): Capa {
  const meta = (nome: string) => document.querySelector<HTMLMetaElement>(`meta[property="${nome}"]`)?.content ?? "";
  let imagem: string | null = null;
  try {
    const og = meta("og:image");
    if (og) { const u = new URL(og, location.origin); imagem = u.pathname + u.search; }
  } catch { /* Sem capa válida, a prévia fica só com o texto. */ }
  return { imagem, titulo: meta("og:title") || document.title, descricao: meta("og:description") };
}

export function Compartilhar({ mensagem, ancora, compacto = false, filtros = {}, contexto: contextoForcado }: { mensagem: string; ancora?: string; compacto?: boolean; filtros?: FiltrosCompartilhados; contexto?: string }) {
  const ctx = useRecorteCompartilhado(), id = useId();
  const gatilho = useRef<HTMLButtonElement>(null), dialogo = useRef<HTMLDialogElement>(null), botaoCopiar = useRef<HTMLButtonElement>(null), campoUrl = useRef<HTMLSpanElement>(null);
  const relogioCopia = useRef<ReturnType<typeof setTimeout>>(undefined), relogioSaida = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [aberto, setAberto] = useState<{ url: string; original: string; capa: Capa } | null>(null);
  const [texto, setTexto] = useState(""), [alvo, setAlvo] = useState(DESTINOS[0]), [saindo, setSaindo] = useState(false);
  const [copiado, setCopiado] = useState<"link" | "frase" | null>(null), [aviso, setAviso] = useState("");
  const [capaEstado, setCapaEstado] = useState<"carregando" | "pronta" | "erro">("carregando");
  const estaAberto = !!aberto, frase = texto.trim();

  useEffect(() => {
    if (!estaAberto) return;
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    // Abre com o foco na ação principal: Enter copia, e o teclado do celular não sobe sozinho.
    botaoCopiar.current?.focus({ preventScroll: true });
  }, [estaAberto]);
  useEffect(() => () => { clearTimeout(relogioCopia.current); clearTimeout(relogioSaida.current); }, []);

  // O painel sabe o cartão de cada link; fora dele, as metatags da página são o que os aplicativos leem.
  const oQueVai = () => {
    const contexto = ctx?.contexto(), url = linkCompartilhado(location.href, ctx?.registros ?? [], { ...contexto?.filtros, ...filtros }, ancora);
    return { contexto, url, capa: contexto?.capaDoLink?.(url) ?? lerCapa() };
  };
  const preparar = () => { const { imagem } = oQueVai().capa; if (imagem) new Image().src = imagem; };
  const abrir = () => {
    const { contexto, url, capa } = oQueVai();
    const descricao = contextoForcado ?? (contexto?.titulo || document.querySelector("main h1")?.textContent || document.title);
    const original = mensagem + (descricao && descricao !== mensagem ? " · " + descricao : "");
    setTexto(original); setAlvo(DESTINOS[0]); setCopiado(null); setAviso(""); setSaindo(false); setCapaEstado("carregando");
    setAberto({ url, original, capa });
  };
  const encerrar = () => { clearTimeout(relogioSaida.current); setAberto(null); setSaindo(false); gatilho.current?.focus({ preventScroll: true }); };
  const fechar = () => {
    if (saindo) return;
    setSaindo(true);
    relogioSaida.current = setTimeout(() => { dialogo.current?.close(); encerrar(); }, 160);
  };
  const avisar = (qual: "link" | "frase" | null, mensagemAviso: string) => {
    clearTimeout(relogioCopia.current);
    setCopiado(qual); setAviso(mensagemAviso);
    relogioCopia.current = setTimeout(() => { setCopiado(null); setAviso(""); }, 3200);
  };
  const copiar = async (conteudo: string, qual: "link" | "frase", mensagemAviso: string) => {
    try {
      await navigator.clipboard.writeText(conteudo);
      avisar(qual, mensagemAviso);
    } catch {
      if (campoUrl.current) getSelection()?.selectAllChildren(campoUrl.current);
      avisar(null, "Não deu para copiar sozinho. Deixei o link selecionado.");
    }
  };
  const nativo = async () => {
    if (!aberto) return;
    try {
      await navigator.share({ title: frase || aberto.capa.titulo, text: frase, url: aberto.url });
      fechar();
    } catch (e) {
      if ((e as Error).name !== "AbortError") avisar(null, "Não abriu aqui. Use Copiar link.");
    }
  };
  const aoEscrever = (e: ChangeEvent<HTMLTextAreaElement>) => setTexto(e.currentTarget.value);

  const partesUrl = aberto ? new URL(aberto.url) : null;
  const destinos = aberto ? DESTINOS.filter(d => d.link || typeof navigator.share === "function") : [];
  const marca = { "--marca": alvo.id === "mais" ? "var(--serie)" : alvo.cor } as CSSProperties;

  return <>
    <button ref={gatilho} type="button" className="compartilhar-gatilho" aria-label={"Compartilhar " + mensagem} aria-haspopup="dialog" aria-expanded={estaAberto} aria-controls={estaAberto ? id : undefined} title={"Compartilhar " + mensagem} onClick={abrir} onPointerEnter={preparar}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-7 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
      {!compacto && <span>Compartilhar</span>}
    </button>
    {aberto && partesUrl && createPortal(
      <div className="painel-governo compartilhar-portal">
        <dialog
          ref={dialogo}
          id={id}
          aria-labelledby={id + "-titulo"}
          className="compartilhar-dialogo"
          data-saindo={saindo || undefined}
          onCancel={e => { e.preventDefault(); fechar(); }}
          onClose={encerrar}
          // O portal ainda borbulha pela árvore do React: o que se digita e clica aqui não pode acionar o bloco de origem.
          onKeyDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) fechar(); }}
        >
          <div className="vidro compartilhar-menu" style={marca}>
            <div className="compartilhar-rolagem">
              <header className="compartilhar-topo">
                <h2 id={id + "-titulo"}>Compartilhar recorte</h2>
                <button type="button" aria-label="Fechar compartilhamento" onClick={fechar}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </header>

              <figure className="compartilhar-previa">
                <figcaption>
                  <span>Como chega {alvo.onde}</span>
                  {texto !== aberto.original && <button type="button" onClick={() => setTexto(aberto.original)}>Voltar à frase original</button>}
                </figcaption>
                <div className="compartilhar-bolha" data-so-link={alvo.soLink || undefined}>
                  <div className="compartilhar-cartao">
                    {aberto.capa.imagem && capaEstado !== "erro" && (
                      <div className="compartilhar-capa" data-estado={capaEstado}>
                        {/* A capa é gerada pela própria rota do site; não passa pelo otimizador de imagens. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={aberto.capa.imagem} alt="" onLoad={() => setCapaEstado("pronta")} onError={() => setCapaEstado("erro")} />
                      </div>
                    )}
                    <div className="compartilhar-cartao-texto">
                      <strong>{aberto.capa.titulo}</strong>
                      {aberto.capa.descricao && <span>{aberto.capa.descricao}</span>}
                      <small>{partesUrl.host}</small>
                    </div>
                  </div>
                  <label className="compartilhar-frase">
                    <span className="sr-only">Frase que acompanha o link</span>
                    <textarea value={texto} onChange={aoEscrever} rows={2} maxLength={500} placeholder="Escreva uma frase para acompanhar o link" />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
                  </label>
                </div>
              </figure>

              <div className="compartilhar-destinos" role="group" aria-label="Enviar para">
                {destinos.map((d, i) => {
                  const estilo = { "--cor": d.cor, "--cor-tinta": d.tinta ?? "#fff", "--i": i } as CSSProperties;
                  const conteudo = <>
                    <span className="compartilhar-disco"><svg width={d.tamanho} height={d.tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d.glifo} /></svg></span>
                    <span>{d.nome}</span>
                  </>;
                  const foco = { onPointerEnter: () => setAlvo(d), onFocus: () => setAlvo(d) };
                  return d.link
                    ? <a key={d.id} className="compartilhar-destino" style={estilo} {...foco} href={d.link(frase, aberto.url)} target="_blank" rel="noopener noreferrer" onClick={d.soLink && frase ? () => copiar(frase, "frase", `Frase copiada. Cole no post do ${d.nome}.`) : undefined}>{conteudo}</a>
                    : <button key={d.id} type="button" className="compartilhar-destino" style={estilo} {...foco} onClick={nativo}>{conteudo}</button>;
                })}
              </div>
              <p className="compartilhar-dica">{alvo.dica}</p>

              <div className="compartilhar-link" data-copiado={copiado === "link" || undefined}>
                <span ref={campoUrl} className="compartilhar-url" title={aberto.url}><strong>{partesUrl.host}</strong>{partesUrl.pathname + partesUrl.search + partesUrl.hash}</span>
                <a className="compartilhar-abrir" href={aberto.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir o link em outra aba" title="Abrir o link em outra aba">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>
                </a>
                <button ref={botaoCopiar} type="button" className="botao-liquido compartilhar-copiar" onClick={() => copiar(aberto.url, "link", "Link copiado")}>
                  {copiado === "link"
                    ? <><svg className="compartilhar-visto" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>Copiado</>
                    : <>Copiar link</>}
                </button>
              </div>
              <div className="compartilhar-rodape">
                <p data-aviso={aviso ? true : undefined}><span role="status">{aviso}</span>{!aviso && NOTA}</p>
                {frase && <button type="button" onClick={() => copiar(frase + "\n\n" + aberto.url, "frase", "Frase e link copiados")}>{copiado === "frase" ? "Copiado" : "Copiar com a frase"}</button>}
              </div>
            </div>
          </div>
        </dialog>
      </div>,
      document.body,
    )}
  </>;
}
