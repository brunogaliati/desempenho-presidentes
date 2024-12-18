import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

interface President {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  foto: string;
}

interface Indicator {
  presidente: string;
  inflacaoAcumulada: number;
  dataFinalIPCA: string;
  valorInicialIPCA: number;
  valorFinalIPCA: number;
  variacaoCambial: number;
  dataFinalDolar: string;
  valorInicialDolar: number;
  valorFinalDolar: number;
  variacaoSelic: number;
  dataFinalSelic: string;
  valorInicialSelic: number;
  valorFinalSelic: number;
  variacaoDesemprego: number | null;
  dataFinalDesemprego: string | null;
  valorInicialDesemprego: number | null;
  valorFinalDesemprego: number | null;
  historicoIPCA: { date: string; value: number }[];
  historicoCambio: { date: string; value: number }[];
  historicoSelic: { date: string; value: number }[];
  historicoDesemprego: { date: string; value: number }[];
}

interface SheetRow {
  get(columnName: string): string;
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!SPREADSHEET_ID) {
  throw new Error('Missing GOOGLE_SPREADSHEET_ID in environment variables');
}

if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  throw new Error('Missing required Google Sheets credentials');
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  return parseFloat(value.replace(',', '.'));
}

const jwt = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
  ],
});

async function getSheetData() {
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
    await doc.loadInfo();

    const periodsSheet = doc.sheetsByTitle['periodos_presidenciais'];
    const indicatorsSheet = doc.sheetsByTitle['indicadores'];
    const historicoSheet = doc.sheetsByTitle['historico'];

    if (!periodsSheet || !indicatorsSheet || !historicoSheet) {
      throw new Error('Required sheets not found');
    }

    const periodsRows = await periodsSheet.getRows();
    const indicatorsRows = await indicatorsSheet.getRows();
    const historicoRows = await historicoSheet.getRows();

    // Function to find the closest date value
    function findValueByDate(rows: SheetRow[], dateColumn: string, valueColumn: string, targetDate: string): number | null {
      const date = new Date(targetDate);
      
      // For exchange rate, ignore dates before July 1994
      if (dateColumn === 'Data Câmbio' && date < new Date('1994-07-01')) {
        return null;
      }

      // For monthly data (IPCA, SELIC, Desemprego), set to first day of month
      const isMonthly = ['Data IPCA', 'Data SELIC', 'Data Desemprego'].includes(dateColumn);
      if (isMonthly) {
        date.setDate(1);
      }

      const closest = rows.reduce((prev, curr) => {
        const currDate = new Date(curr.get(dateColumn));
        const prevDate = new Date(prev.get(dateColumn));
        return Math.abs(currDate.getTime() - date.getTime()) < Math.abs(prevDate.getTime() - date.getTime()) ? curr : prev;
      });

      return parseNumber(closest.get(valueColumn));
    }

    const presidents = periodsRows
      .map(row => ({
        id: row.get('presidente'),
        nome: row.get('Nome'),
        inicio: row.get('inicio'),
        fim: row.get('fim'),
        foto: row.get('Foto') || '',
      }))
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

    const indicators = indicatorsRows.map(row => {
      const presidentId = row.get('Presidente');
      const president = presidents.find(p => p.id === presidentId);
      if (!president) return null;

      return {
        presidente: presidentId,
        inflacaoAcumulada: parseNumber(row.get('Inflação Acumulada (%)')) || 0,
        dataFinalIPCA: row.get('Data Final IPCA'),
        valorInicialIPCA: findValueByDate(historicoRows, 'Data IPCA', 'IPCA', president.inicio),
        valorFinalIPCA: findValueByDate(historicoRows, 'Data IPCA', 'IPCA', row.get('Data Final IPCA')),
        variacaoCambial: parseNumber(row.get('Variação Cambial (%)')) || 0,
        dataFinalDolar: row.get('Data Final Dólar'),
        valorInicialDolar: findValueByDate(historicoRows, 'Data Câmbio', 'Câmbio', president.inicio),
        valorFinalDolar: findValueByDate(historicoRows, 'Data Câmbio', 'Câmbio', row.get('Data Final Dólar')),
        variacaoSelic: parseNumber(row.get('Variação Nominal SELIC (%)')) || 0,
        dataFinalSelic: row.get('Data Final SELIC'),
        valorInicialSelic: findValueByDate(historicoRows, 'Data SELIC', 'SELIC', president.inicio),
        valorFinalSelic: findValueByDate(historicoRows, 'Data SELIC', 'SELIC', row.get('Data Final SELIC')),
        variacaoDesemprego: parseNumber(row.get('Variação Nominal Desemprego (%)')),
        dataFinalDesemprego: row.get('Data Final Desemprego'),
        valorInicialDesemprego: row.get('Data Final Desemprego') ? 
          findValueByDate(historicoRows, 'Data Desemprego', 'Desemprego', president.inicio) : null,
        valorFinalDesemprego: row.get('Data Final Desemprego') ? 
          findValueByDate(historicoRows, 'Data Desemprego', 'Desemprego', row.get('Data Final Desemprego')) : null,
        historicoIPCA: getHistoricalData(
          historicoRows,
          'Data IPCA',
          'IPCA',
          president.inicio,
          row.get('Data Final IPCA')
        ),
        historicoCambio: getHistoricalData(
          historicoRows,
          'Data Câmbio',
          'Câmbio',
          president.inicio,
          row.get('Data Final Dólar')
        ),
        historicoSelic: getHistoricalData(
          historicoRows,
          'Data SELIC',
          'SELIC',
          president.inicio,
          row.get('Data Final SELIC')
        ),
        historicoDesemprego: getHistoricalData(
          historicoRows,
          'Data Desemprego',
          'Desemprego',
          president.inicio,
          row.get('Data Final Desemprego')
        ),
      };
    }).filter(Boolean);

    return { presidents, indicators };
  } catch (error) {
    console.error('Error accessing Google Sheets:', error);
    throw error;
  }
}

function getHistoricalData(rows: SheetRow[], dateColumn: string, valueColumn: string, startDate: string, endDate: string) {
  return rows
    .filter(row => {
      const date = new Date(row.get(dateColumn));
      return date >= new Date(startDate) && date <= new Date(endDate);
    })
    .map(row => ({
      date: row.get(dateColumn),
      value: parseNumber(row.get(valueColumn)) || 0
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default getSheetData;
export type { President, Indicator }; 
