import type { APIRoute } from 'astro';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHPRtqwNjtSJTg_CTgZIdogaYjNfODwXhJdr_5vzCZnv4ASEVw2KvyapsXf8NoqK-lSS7hYC6rtjQ1/pub?gid=0&single=true&output=csv';

function parseCSV(text: string) {
  const rows = text.trim().split('\n').map((row) =>
    row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
  );

  const headers = rows.shift() ?? [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  );
}

export const GET: APIRoute = async () => {
  const response = await fetch(SHEET_CSV_URL);
  const csv = await response.text();

  const events = parseCSV(csv).filter((event: any) => {
    return event.visible?.toLowerCase() !== 'false';
  });

  return new Response(JSON.stringify(events), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
};