import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, locals }) => {
  const VisitorTrackerNamespace = locals.runtime.env.VisitorTracker;

  if (!VisitorTrackerNamespace) {
    return new Response("Durable Object not available", { status: 500 });
  }

  // Get the Durable Object instance (single global instance for all visitors)
  const id = VisitorTrackerNamespace.idFromName("global");
  const stub = VisitorTrackerNamespace.get(id);

  // Forward the request to the Durable Object
  // The DO will handle the WebSocket upgrade
  return stub.fetch(request);
};
