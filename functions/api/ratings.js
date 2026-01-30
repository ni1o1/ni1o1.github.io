// Ratings API - Cloudflare Pages Functions
// Handles likes with D1 database

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

// POST /api/ratings - like or batch get ratings
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    // Batch get ratings
    if (body.itemIds && Array.isArray(body.itemIds)) {
      const itemIds = body.itemIds;
      if (itemIds.length === 0) {
        return jsonResponse({});
      }

      const placeholders = itemIds.map(() => '?').join(',');
      const results = await env.DB.prepare(
        `SELECT id, item_id, likes FROM ratings WHERE item_id IN (${placeholders})`
      ).bind(...itemIds).all();

      const map = {};
      results.results.forEach(row => {
        map[row.item_id] = {
          id: row.id,
          likes: row.likes
        };
      });

      return jsonResponse(map);
    }

    // Like action
    if (body.itemId && body.action === 'like') {
      const { itemId } = body;

      // Use UPSERT for atomic increment
      const result = await env.DB.prepare(`
        INSERT INTO ratings (item_id, likes) VALUES (?, 1)
        ON CONFLICT(item_id) DO UPDATE SET
          likes = likes + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, item_id, likes
      `).bind(itemId).first();

      return jsonResponse({
        id: result.id,
        itemId: result.item_id,
        likes: result.likes
      });
    }

    // Get single rating
    if (body.itemId) {
      const { itemId } = body;
      const result = await env.DB.prepare(
        'SELECT id, item_id, likes FROM ratings WHERE item_id = ?'
      ).bind(itemId).first();

      return jsonResponse({
        id: result ? result.id : null,
        itemId,
        likes: result ? result.likes : 0
      });
    }

    return jsonResponse({ error: 'Invalid request' }, 400);

  } catch (error) {
    console.error('Ratings API error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// GET /api/ratings?itemId=xxx - get single rating
export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const itemId = url.searchParams.get('itemId');

    if (!itemId) {
      return jsonResponse({ error: 'itemId required' }, 400);
    }

    const result = await env.DB.prepare(
      'SELECT id, item_id, likes FROM ratings WHERE item_id = ?'
    ).bind(itemId).first();

    return jsonResponse({
      id: result ? result.id : null,
      itemId,
      likes: result ? result.likes : 0
    });

  } catch (error) {
    console.error('Ratings API error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}
