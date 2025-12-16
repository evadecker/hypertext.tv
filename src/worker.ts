import { DurableObject } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import type { SSRManifest } from "astro";
import { App } from "astro/app";

export interface Env {
  VISITOR_TRACKER: DurableObjectNamespace<VisitorTracker>;
}

export class VisitorTracker extends DurableObject<Env> {
  private connections: Set<WebSocket>;
  private broadcastTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastBroadcastTime = 0;
  private readonly MIN_BROADCAST_INTERVAL_MS = 500; // Limit broadcasts to max 2 per second

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.connections = new Set();

    // Enable WebSocket hibernation to reduce CPU usage
    // Hibernation automatically manages connection state without keeping event listeners active
    this.ctx.blockConcurrencyWhile(async () => {
      // Allow hibernation when no active processing
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      // Handle WebSocket upgrade
      if (request.headers.get("Upgrade") === "websocket") {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Use hibernatable WebSocket API
        this.ctx.acceptWebSocket(server);
        this.connections.add(server);

        // Send initial count
        const count = Math.max(1, this.connections.size);
        server.send(JSON.stringify({ total: count }));

        // Schedule broadcast with rate limiting
        this.scheduleBroadcast();

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }

      // HTTP fallback - return current count (minimum 1)
      return new Response(
        JSON.stringify({
          total: Math.max(1, this.connections.size),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
          },
        },
      );
    } catch (error) {
      return new Response("Error", { status: 500 });
    }
  }

  async webSocketMessage(
    _ws: WebSocket,
    _message: string | ArrayBuffer,
  ): Promise<void> {
    // Handle any incoming messages if needed (currently not used)
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Clean up connection
    this.connections.delete(ws);
    ws.close(code, reason);

    // Rate-limited broadcast
    this.scheduleBroadcast();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.connections.delete(ws);
    ws.close(1011, "WebSocket error");
  }

  private scheduleBroadcast(): void {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcastTime;

    // Rate limiting: don't broadcast more than once per MIN_BROADCAST_INTERVAL_MS
    if (timeSinceLastBroadcast < this.MIN_BROADCAST_INTERVAL_MS) {
      // Schedule for later if we haven't already
      if (!this.broadcastTimeout) {
        const delay = this.MIN_BROADCAST_INTERVAL_MS - timeSinceLastBroadcast;
        this.broadcastTimeout = setTimeout(() => {
          this.broadcastCount();
          this.broadcastTimeout = null;
        }, delay);
      }
      return;
    }

    // Broadcast immediately if enough time has passed
    if (this.broadcastTimeout) {
      clearTimeout(this.broadcastTimeout);
      this.broadcastTimeout = null;
    }
    this.broadcastCount();
  }

  private broadcastCount(): void {
    this.lastBroadcastTime = Date.now();

    const count = Math.max(1, this.connections.size);
    const messageStr = JSON.stringify({ total: count });

    // Get active WebSockets and clean up closed ones
    const activeConnections = this.ctx.getWebSockets();

    // Update our connections set to match reality
    this.connections.clear();

    for (const ws of activeConnections) {
      this.connections.add(ws);
      try {
        ws.send(messageStr);
      } catch {
        // Failed connections are automatically cleaned up by hibernation API
      }
    }
  }
}

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);

  return {
    default: {
      async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext,
      ): Promise<Response> {
        // Pass all requests to Astro
        // @ts-expect-error - Type mismatch between Workers Request and Astro Request
        return handle(manifest, app, request, env, ctx);
      },
    } satisfies ExportedHandler<Env>,
    VisitorTracker: VisitorTracker,
  };
}
