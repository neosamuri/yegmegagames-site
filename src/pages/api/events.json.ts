import type { APIRoute } from 'astro';
import Papa from 'papaparse';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHPRtqwNjtSJTg_CTgZIdogaYjNfODwXhJdr_5vzCZnv4ASEVw2KvyapsXf8NoqK-lSS7hYC6rtjQ1/pub?gid=0&single=true&output=csv';

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(SHEET_CSV_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csv = await response.text();

    const results = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (results.errors.length > 0) {
      console.error('CSV Parse Errors:', results.errors);
    }

    const events = results.data;

    return new Response(JSON.stringify(events, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Events API Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to load events',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

