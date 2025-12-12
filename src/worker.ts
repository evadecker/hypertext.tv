import { DurableObject } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import type { VisitorData } from "@types";
import type { SSRManifest } from "astro";
import { App } from "astro/app";

export interface Env {
  VISITOR_TRACKER: DurableObjectNamespace<VisitorTracker>;
}

export class VisitorTracker extends DurableObject<Env> {
  private connections: Set<WebSocket>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.connections = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server);

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
        },
      },
    );
  }

  async handleSession(websocket: WebSocket): Promise<void> {
    // Accept the WebSocket connection
    websocket.accept();

    // Add to connections set
    this.connections.add(websocket);

    // Send initial count to the new connection (minimum 1)
    this.sendToClient(websocket, {
      total: Math.max(1, this.connections.size),
    });

    // Broadcast updated count to all connections
    this.broadcastCount();

    // Handle disconnection
    websocket.addEventListener("close", () => {
      this.connections.delete(websocket);
      this.broadcastCount();
    });

    websocket.addEventListener("error", () => {
      this.connections.delete(websocket);
      this.broadcastCount();
    });
  }

  private broadcastCount(): void {
    const actualCount = Math.max(1, this.connections.size);
    const message: VisitorData = {
      total: actualCount,
    };

    const messageStr = JSON.stringify(message);

    for (const ws of this.connections) {
      try {
        ws.send(messageStr);
      } catch (e) {
        // Remove failed connection
        this.connections.delete(ws);
      }
    }
  }

  private sendToClient(ws: WebSocket, message: VisitorData): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (e) {
      this.connections.delete(ws);
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
