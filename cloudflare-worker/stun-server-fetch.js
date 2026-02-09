/**
 * Cloudflare Worker for fetching STUN server information
 * 
 * This worker fetches Twilio ICE servers and returns only STUN servers,
 * filtering out TURN servers to avoid bandwidth costs.
 * 
 * This is an example of how your existing worker at
 * https://cold-scene-fe82.rayking1988.workers.dev/ could be modified
 * to work with the new STUN-only approach.
 * 
 * Note: You don't need to deploy this if your existing worker already
 * returns the full server list - the client will filter out TURN servers.
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handles CORS preflight requests for the worker.
 *
 * @param {Request} request - Incoming request to inspect.
 * @returns {Response|null} A preflight response, or null if not applicable.
 */
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  return null;
}

/**
 * Fetches ICE server configuration from Twilio.
 *
 * @param {Record<string, string>} env - Worker environment with Twilio credentials.
 * @returns {Promise<any>} Parsed Twilio response payload.
 */
async function fetchTwilioServers(env) {
  // Replace with your actual Twilio credentials and endpoint
  // This is just an example - use your existing implementation
    const auth = btoa(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Tokens.json`,
      { 
        method: 'POST', 
        headers: { 
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'Ttl=86400' // 24hours TTL
      }
    );

  if (!response.ok) {
    throw new Error(`Twilio API failed: ${response.status}`);
  }

  return await response.json();
}

/**
 * Filters a list of ICE servers down to STUN-only entries.
 *
 * @param {Array<{ urls?: string[] | string; url?: string }>} servers - ICE server list.
 * @returns {Array<{ urls?: string[] | string; url?: string }>} STUN-only server list.
 */
function filterStunServers(servers) {
  return servers.filter(server => {
    const urls = server.urls || server.url || '';
    const urlStr = Array.isArray(urls) ? urls[0] : urls;
    return urlStr?.startsWith('stun:');
  });
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    try {
      // Fetch servers from Twilio (use your existing implementation)
      const twilioData = await fetchTwilioServers(env);
      
      // Extract servers from response
      const allServers = twilioData.ice_servers || [];
      
      // Filter to STUN servers only
      const stunServers = filterStunServers(allServers);
      
      // Return response in the same format as your existing worker
      // but with TURN servers filtered out
      const response = {
        success: true,
        location: twilioData.location || null,
        network: twilioData.network || null,
        turnServers: stunServers, // Only STUN servers now
        rawServers: stunServers,  // Only STUN servers now
        recommendedServer: {
          domain: "stun.l.google.com", // Use public STUN as recommended
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302"
          ],
          region: twilioData.recommendedServer?.region || "US",
          reason: "STUN-only configuration for cost optimization"
        },
        timestamp: new Date().toISOString(),
        expiresIn: 86400 // 24 hours
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });

    } catch (error) {
      console.error('Error fetching STUN servers:', error);
      
      // Return fallback STUN servers
      const fallbackResponse = {
        success: true,
        location: null,
        network: null,
        turnServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        rawServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        recommendedServer: {
          domain: "stun.l.google.com",
          urls: ["stun:stun.l.google.com:19302"],
          region: "US",
          reason: "Fallback STUN servers"
        },
        timestamp: new Date().toISOString(),
        expiresIn: 86400
      };

      return new Response(JSON.stringify(fallbackResponse), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};
