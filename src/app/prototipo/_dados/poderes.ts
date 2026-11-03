/**
 * Datas institucionais do governo atual.
 *
 * A partir das eleições de 2026, a EC 111/2021 moveu a posse do presidente
 * para 5 de janeiro e a dos governadores para 6 de janeiro. Por isso o mandato
 * atual não termina em 31/12: quem governa até a posse ainda é o governo
 * eleito em 2022. O backend ainda grava 31/12/2026 como fim de Lula 3
 * (`backend/desempenho/periodos.py`); aqui vale a data constitucional.
 *
 * A legislatura é a mesma para Câmara e Senado: a 58ª começa em 01/02/2027,
 * com a Câmara inteira e 54 das 81 cadeiras do Senado escolhidas em 2026.
 */

export const POSSE_PRESIDENTE = "2027-01-05";
export const POSSE_GOVERNADORES = "2027-01-06";
export const INICIO_MANDATO_EXECUTIVO = "2023-01-01";

export const LEGISLATURA = {
  numero: 57,
  inicio: "2023-02-01",
  fim: "2027-01-31",
  proxima: "2027-02-01",
};

export const CADEIRAS = {
  camara: 513,
  senado: 81,
  senadoRenovadas2026: 54,
  governadores: 27,
};
