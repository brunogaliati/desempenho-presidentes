/** Grafias publicadas pelas casas em arquivos de diferentes legislaturas. */
export function orientacaoDoGoverno(bancada, orientacao) {
  if (!["GOV", "GOVERNO"].includes(String(bancada ?? "").trim().toUpperCase().replace(/\.$/, ""))) return null;
  const voto = String(orientacao ?? "").trim().toUpperCase();
  return voto === "SIM" ? "Sim" : voto === "NÃO" ? "Não" : null;
}
