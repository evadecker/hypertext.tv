import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/edge-functions";

const VISITORS_KEY = "visitor_counts";
const CACHE_TTL = 30;
const MAX_HISTORY_POINTS = 8;
const SITE_ID = "EPXKTQED";

interface VisitorData {
  timestamp: number;
  count: number;
}

interface VisitorResponse {
  total: number;
  history: number[];
}

/**
 * Creates an array of default visitor data points
 * @param index Optional index to create a single data point at a specific position
 * @returns Array of VisitorData objects with timestamps and zero counts, or a single object if index is provided
 */
function createDefaultVisitorData(index?: number): VisitorData | VisitorData[] {
  if (index !== undefined) {
    return {
      timestamp: Date.now() - CACHE_TTL * 1000 * (MAX_HISTORY_POINTS - index),
      count: 0,
    };
  }

  return Array(MAX_HISTORY_POINTS)
    .fill(null)
    .map((_, i) => ({
      timestamp: Date.now() - CACHE_TTL * 1000 * (MAX_HISTORY_POINTS - i),
      count: 0,
    }));
}

/**
 * Creates a JSON response with the appropriate headers
 */
function createJsonResponse<T>(
  data: T,
  status = 200,
  cacheControl = "public, max-age=15",
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
    },
  });
}

/**
 * Creates an error response
 */
function createErrorResponse(message: string, status = 500): Response {
  return createJsonResponse({ error: message }, status);
}

/**
 * Fetches visitor data from the Fathom API
 */
async function fetchFathomData(): Promise<number> {
  const apiKey = Netlify.env.get("FATHOM_API_KEY");

  if (!apiKey) {
    throw new Error("Fathom API key is not configured");
  }

  const response = await fetch(
    `https://api.usefathom.com/v1/current_visitors?site_id=${SITE_ID}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch data from Fathom API: ${response.status}`);
  }

  const data = await response.json();

  if (!data || typeof data.total === "undefined") {
    throw new Error("Invalid response from Fathom API");
  }

  return data.total;
}

/**
 * Updates visitor data with a new count
 */
async function updateVisitorData(
  store: ReturnType<typeof getStore>,
  visitorData: VisitorData[],
  newCount: number,
): Promise<VisitorData[]> {
  const now = Date.now();

  // Create a new array with the updated data
  const updatedData = [
    ...visitorData,
    {
      timestamp: now,
      count: newCount,
    },
  ];

  // Keep only the most recent MAX_HISTORY_POINTS
  const trimmedData =
    updatedData.length > MAX_HISTORY_POINTS
      ? updatedData.slice(-MAX_HISTORY_POINTS)
      : updatedData;

  // Store the updated visitor data
  await store.setJSON(VISITORS_KEY, trimmedData, {
    metadata: {
      timestamp: now,
      ttl: CACHE_TTL,
    },
  });

  return trimmedData;
}

/**
 * Retrieves visitor data from the store or initializes with defaults
 */
async function getVisitorData(
  store: ReturnType<typeof getStore>,
): Promise<VisitorData[]> {
  const storedData = await store.get(VISITORS_KEY, { type: "json" });

  if (!storedData) {
    return createDefaultVisitorData() as VisitorData[];
  }

  try {
    // Check if storedData is already an array
    if (Array.isArray(storedData)) {
      // Convert null values to proper VisitorData objects
      return storedData.map((item, index) => {
        if (item === null) {
          return createDefaultVisitorData(index) as VisitorData;
        }
        return item;
      });
    }

    // Parse if it's a string
    return JSON.parse(storedData);
  } catch (e) {
    console.error("Error parsing visitor data:", e);
    return createDefaultVisitorData() as VisitorData[];
  }
}

/**
 * Checks if we have recent data and returns it if available
 */
function getRecentData(visitorData: VisitorData[]): VisitorResponse | null {
  const now = Date.now();
  const recentData = visitorData.find(
    (data) => now - data.timestamp < CACHE_TTL * 1000,
  );

  if (recentData) {
    return {
      total: recentData.count,
      history: visitorData.map((data) => data.count),
    };
  }

  return null;
}

/**
 * Creates a response with visitor data
 */
function createVisitorResponse(
  visitorData: VisitorData[],
  total: number,
): VisitorResponse {
  return {
    total,
    history: visitorData.map((data) => data.count),
  };
}

/**
 * Handles Server-Sent Events (SSE) for real-time visitor updates
 */
async function handleSSE(request: Request): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const store = getStore("visitors-cache");

  const sendStats = async () => {
    try {
      const visitorData = await getVisitorData(store);
      const recentResponse = getRecentData(visitorData);

      if (recentResponse) {
        writer.write(
          new TextEncoder().encode(
            `data: ${JSON.stringify(recentResponse)}\n\n`,
          ),
        );
        return;
      }

      // If no recent data, fetch from Fathom API
      try {
        const total = await fetchFathomData();
        const updatedData = await updateVisitorData(store, visitorData, total);
        const response = createVisitorResponse(updatedData, total);

        writer.write(
          new TextEncoder().encode(`data: ${JSON.stringify(response)}\n\n`),
        );
      } catch (error) {
        // If Fathom errors, just send existing data
        const response = {
          total: visitorData[visitorData.length - 1]?.count ?? 0,
          history: visitorData.map((data) => data.count),
        };

        writer.write(
          new TextEncoder().encode(`data: ${JSON.stringify(response)}\n\n`),
        );
      }
    } catch (error) {
      console.error("Error in SSE handler:", error);
      writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ total: 0, history: Array(MAX_HISTORY_POINTS).fill(0) })}\n\n`,
        ),
      );
    }
  };

  // Send initial data
  await sendStats();

  // Update every 30 seconds
  const timer = setInterval(sendStats, 30000);

  request.signal.addEventListener("abort", () => {
    clearInterval(timer as unknown as number);
    writer.close();
  });

  return new Response(stream.readable, { headers });
}

export default async (request: Request, _context: Context) => {
  // Check if this is an SSE request
  const acceptHeader = request.headers.get("accept");
  if (acceptHeader?.includes("text/event-stream")) {
    return handleSSE(request);
  }

  // Regular JSON request handling
  try {
    const store = getStore("visitors-cache");
    const visitorData = await getVisitorData(store);

    // Check if we have recent data
    const recentResponse = getRecentData(visitorData);
    if (recentResponse) {
      return createJsonResponse(recentResponse);
    }

    // If no recent data, fetch from Fathom API
    try {
      const total = await fetchFathomData();
      const updatedData = await updateVisitorData(store, visitorData, total);
      const response = createVisitorResponse(updatedData, total);
      return createJsonResponse(response);
    } catch (error: unknown) {
      // If Fathom errors we have probably exceeded the rate limit, just return existing
      return createJsonResponse(visitorData);
    }
  } catch (error: unknown) {
    console.error("Internal server error:", error);
    return createErrorResponse("Internal server error");
  }
};

export const config: Config = {
  path: "/api/visitors",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowSize: 100,
  },
};
