import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const apiKey = import.meta.env.FATHOM_API_KEY;
    const siteId = "EPXKTQED";
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Fathom API key is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://api.usefathom.com/v1/current_visitors?site_id=${siteId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch data from Fathom API", 
          details: errorData 
        }),
        { 
          status: response.status, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        } 
      }
    );
  } catch (error) {
    console.error("Error fetching current visitors:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}; 