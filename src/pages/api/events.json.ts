import type { APIRoute } from 'astro';
import Papa from 'papaparse';

export const prerender = false;

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHPRtqwNjtSJTg_CTgZIdogaYjNfODwXhJdr_5vzCZnv4ASEVw2KvyapsXf8NoqK-lSS7hYC6rtjQ1/pub?gid=0&single=true&output=csv';

type EventRow = {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  rsvp_url?: string;
  max_players?: string;
  status?: string;
  featured?: string;
  visible?: string;
  image?: string;
  playerCountApi?: string;
  [key: string]: unknown;
};

type CountApiResponse = {
  count?: number | string;
  player_count?: number | string;
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

function parseCount(value: unknown): number {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.floor(count);
}

async function getPlayerCount(playerCountApi?: string): Promise<number> {
  const url = String(playerCountApi ?? '').trim();

  if (!url) {
    return 0;
  }

  try {
    // Prevent Cloudflare, Google Apps Script, or an intermediate cache from
    // returning an older player count. Apps Script ignores the extra query
    // parameter, while each request receives a unique URL.
    const countUrl = new URL(url);
    countUrl.searchParams.set('_', Date.now().toString());

    const response = await fetch(countUrl.toString(), {
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      console.warn(`Player count API failed: ${response.status}`);
      return 0;
    }

    const text = await response.text();
    const data = JSON.parse(text) as CountApiResponse;

    return parseCount(data.count ?? data.player_count);
  } catch (error) {
    console.error('Player count fetch failed:', error);
    return 0;
  }
}

export const GET: APIRoute = async () => {
  try {
    // Google Sheets published CSV responses can remain cached after an edit.
    // Add a unique query value and explicit no-cache headers so every API call
    // retrieves the latest published sheet data.
    const sheetUrl = `${SHEET_CSV_URL}&_=${Date.now()}`;
    const response = await fetch(sheetUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events sheet: ${response.status}`);
    }

    const csv = await response.text();
    const events = parseCsv<EventRow>(csv);

    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const count = await getPlayerCount(event.playerCountApi);

        return {
          ...event,
          player_count: String(count),
        };
      })
    );

    return new Response(JSON.stringify(eventsWithCounts, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
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
          'Cache-Control': 'no-store',
        },
      }
    );
  }
};