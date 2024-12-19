'use server';

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
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function subscribeEmail(formData: FormData) {
  const email = formData.get('email') as string;
  
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['emails'];
    if (!sheet) {
      sheet = await doc.addSheet({ title: 'emails' });
    }

    await sheet.loadCells('A1:A1000');
    
    let existingEmail = false;
    let rowIndex = 0;
    
    while (sheet.getCell(rowIndex, 0).value !== null) {
      if (sheet.getCell(rowIndex, 0).value === email) {
        existingEmail = true;
        break;
      }
      rowIndex++;
    }

    if (existingEmail) {
      return { success: false, message: 'Email já cadastrado!' };
    }

    const cell = sheet.getCell(rowIndex, 0);
    cell.value = email;
    await sheet.saveUpdatedCells();
    
    return { success: true, message: 'Email cadastrado com sucesso!' };

  } catch (error) {
    console.error('Error subscribing email:', error);
    return { success: false, message: 'Erro ao cadastrar email. Tente novamente.' };
  }
} 