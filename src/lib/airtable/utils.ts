import Airtable from 'airtable';

// Configuration d'Airtable
export const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID!);

