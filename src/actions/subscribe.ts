import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '';

if (!SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  throw new Error('Missing required Google Sheets credentials');
}

const jwt = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ],
});

export async function subscribe(email: string) {
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['emails'];
    if (!sheet) {
      sheet = await doc.addSheet({ title: 'emails', headerValues: ['email'] });
    } else {
      const rows = await sheet.getRows();
      if (rows.length === 0) {
        await sheet.setHeaderRow(['email']);
      }
    }

    const updatedRows = await sheet.getRows();
    const existingEmail = updatedRows.find(row => row.get('email') === email);

    if (existingEmail) {
      return { success: false, message: 'Email já cadastrado!' };
    }

    await sheet.addRow({ 'email': email });
    return { success: true, message: 'Email cadastrado com sucesso!' };
  } catch (error) {
    console.error('Error subscribing email:', error);
    return { success: false, message: 'Erro ao cadastrar email. Tente novamente.' };
  }
} 