// Worker entry point - handles API routes and static assets

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

// Views API handlers
async function handleViewsPost(request, env) {
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
}

async function handleViewsGet(request, env) {
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
}

// Ratings API handlers
async function handleRatingsPost(request, env) {
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
}

async function handleRatingsGet(request, env) {
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
}

// Comments API handlers
async function handleCommentsPost(request, env) {
  const body = await request.json();
  const { itemId, nickname, content } = body;

  if (!itemId || !nickname || !content) {
    return jsonResponse({ error: 'itemId, nickname, and content are required' }, 400);
  }

  const result = await env.DB.prepare(`
    INSERT INTO comments (item_id, nickname, content)
    VALUES (?, ?, ?)
    RETURNING id, item_id, nickname, content, created_at
  `).bind(itemId, nickname, content).first();

  return jsonResponse({
    id: result.id,
    itemId: result.item_id,
    nickname: result.nickname,
    content: result.content,
    createdAt: result.created_at
  });
}

async function handleCommentsGet(request, env) {
  const url = new URL(request.url);
  const itemId = url.searchParams.get('itemId');

  if (!itemId) {
    return jsonResponse({ error: 'itemId required' }, 400);
  }

  const results = await env.DB.prepare(`
    SELECT id, item_id, nickname, content, created_at
    FROM comments
    WHERE item_id = ?
    ORDER BY created_at DESC
  `).bind(itemId).all();

  const comments = results.results.map(row => ({
    id: row.id,
    itemId: row.item_id,
    nickname: row.nickname,
    content: row.content,
    createdAt: row.created_at
  }));

  return jsonResponse(comments);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API routes
      if (path === '/api/views') {
        if (request.method === 'POST') {
          return await handleViewsPost(request, env);
        } else if (request.method === 'GET') {
          return await handleViewsGet(request, env);
        }
      }

      if (path === '/api/ratings') {
        if (request.method === 'POST') {
          return await handleRatingsPost(request, env);
        } else if (request.method === 'GET') {
          return await handleRatingsGet(request, env);
        }
      }

      if (path === '/api/comments') {
        if (request.method === 'POST') {
          return await handleCommentsPost(request, env);
        } else if (request.method === 'GET') {
          return await handleCommentsGet(request, env);
        }
      }

      // For all other requests, let the assets handler take over
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('API error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};
