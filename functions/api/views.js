// Views API - Cloudflare Pages Functions
// Handles view counting with D1 database

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Handle OPTIONS for CORS preflight
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

// POST /api/views - increment view or batch get views
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // Batch get views
    if (body.itemIds && Array.isArray(body.itemIds)) {
      const itemIds = body.itemIds;
      if (itemIds.length === 0) {
        return jsonResponse({});
      }

      const placeholders = itemIds.map(() => '?').join(',');
      const results = await env.DB.prepare(
        `SELECT item_id, count FROM views WHERE item_id IN (${placeholders})`
      ).bind(...itemIds).all();

      const map = {};
      results.results.forEach(row => {
        map[row.item_id] = row.count;
      });

      return jsonResponse(map);
    }

    // Single increment
    if (body.itemId) {
      const { itemId } = body;

      // Use UPSERT for atomic increment
      const result = await env.DB.prepare(`
        INSERT INTO views (item_id, count) VALUES (?, 1)
        ON CONFLICT(item_id) DO UPDATE SET
          count = count + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING item_id, count
      `).bind(itemId).first();

      return jsonResponse({
        itemId: result.item_id,
        count: result.count
      });
    }

    return jsonResponse({ error: 'Invalid request' }, 400);

  } catch (error) {
    console.error('Views API error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// GET /api/views?itemId=xxx - get single view count
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const itemId = url.searchParams.get('itemId');

    if (!itemId) {
      return jsonResponse({ error: 'itemId required' }, 400);
    }

    const result = await env.DB.prepare(
      'SELECT item_id, count FROM views WHERE item_id = ?'
    ).bind(itemId).first();

    return jsonResponse({
      itemId,
      count: result ? result.count : 0
    });

  } catch (error) {
    console.error('Views API error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}
