import type { APIRoute } from 'astro';
import Papa from 'papaparse';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHPRtqwNjtSJTg_CTgZIdogaYjNfODwXhJdr_5vzCZnv4ASEVw2KvyapsXf8NoqK-lSS7hYC6rtjQ1/pub?gid=0&single=true&output=csv';

type EventRow = {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  rsvp_url?: string;
  player_count?: string;
  max_players?: string;
  status?: string;
  featured?: string;
  visible?: string;
  image?: string;
  rsvpResponseCsv?: string;
  [key: string]: unknown;
};

type ResponseRow = {
  Email?: string;
  email?: string;
  [key: string]: unknown;
};

function parseCsv<T>(csv: string): T[] {
  const results = Papa.parse<T>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (results.errors.length > 0) {
    console.warn('CSV parse warnings:', results.errors);
  }

  return results.data;
}

function normalizeCsvUrl(url: string): string {
  const trimmed = String(url ?? '').trim();

  if (!trimmed) {
    return '';
  }

  // If someone pastes a Google published HTML URL, convert it to CSV.
  if (trimmed.includes('/pubhtml')) {
    return trimmed.replace('/pubhtml', '/pub').replace(/([?&])output=[^&]+/, '$1output=csv') +
      (trimmed.includes('output=') ? '' : '&output=csv');
  }

  // If someone pastes a Google published URL without output=csv, add it.
  if (trimmed.includes('/pub?') && !trimmed.includes('output=csv')) {
    return `${trimmed}&output=csv`;
  }

  return trimmed;
}

async function getUniquePlayerCount(rsvpResponseCsv?: string): Promise<number> {
  const csvUrl = normalizeCsvUrl(String(rsvpResponseCsv ?? ''));

  if (!csvUrl) {
    return 0;
  }

  try {
    const response = await fetch(csvUrl);

    if (!response.ok) {
      console.warn(`RSVP response CSV failed to load: ${response.status}`);
      return 0;
    }

    const csv = await response.text();
    const rows = parseCsv<ResponseRow>(csv);

    const uniqueEmails = new Set<string>();

    for (const row of rows) {
      const email = String(row.Email ?? row.email ?? '')
        .trim()
        .toLowerCase();

      if (email) {
        uniqueEmails.add(email);
      }
    }

    return uniqueEmails.size;
  } catch (error) {
    console.warn('RSVP response CSV could not be counted:', error);
    return 0;
  }
}

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(SHEET_CSV_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch events sheet: ${response.status}`);
    }

    const csv = await response.text();
    const events = parseCsv<EventRow>(csv);

    const eventsWithPlayerCounts = await Promise.all(
      events.map(async (event) => {
        const playerCount = await getUniquePlayerCount(event.rsvpResponseCsv);

        return {
          ...event,
          player_count: String(playerCount),
        };
      })
    );

    return new Response(JSON.stringify(eventsWithPlayerCounts, null, 2), {
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
