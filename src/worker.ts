/**
 * Custom Cloudflare Worker entrypoint that integrates:
 * 1. Durable Object for visitor tracking
 * 2. Astro's generated worker for the main site
 */

import { DurableObject } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import type { SSRManifest } from "astro";
import { App } from "astro/app";

interface Env {
  VISITOR_TRACKER: DurableObjectNamespace;
}

interface VisitorMessage {
  type: "count" | "history";
  total?: number;
  history?: number[];
}

/**
 * Durable Object that maintains WebSocket connections and broadcasts visitor counts
 */
class VisitorTracker extends DurableObject<Env> {
  private connections: Set<WebSocket>;
  private history: number[];
  private readonly MAX_HISTORY = 8;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.connections = new Set();
    this.history = new Array(this.MAX_HISTORY).fill(1);
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
        history: this.history,
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

    // Update history with new count
    this.updateHistory(this.connections.size);

    // Send initial count to the new connection (minimum 1)
    this.sendToClient(websocket, {
      type: "count",
      total: Math.max(1, this.connections.size),
      history: this.history,
    });

    // Broadcast updated count to all connections
    this.broadcastCount();

    // Handle disconnection
    websocket.addEventListener("close", () => {
      this.connections.delete(websocket);
      this.updateHistory(this.connections.size);
      this.broadcastCount();
    });

    websocket.addEventListener("error", () => {
      this.connections.delete(websocket);
      this.updateHistory(this.connections.size);
      this.broadcastCount();
    });
  }

  /**
   * Updates the history array with a new count
   * Ensures minimum of 1 for display purposes
   */
  private updateHistory(count: number): void {
    this.history.push(Math.max(1, count));
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }

  /**
   * Broadcasts the current visitor count to all connected clients
   * Ensures minimum of 1 (if someone is viewing, there's at least one visitor)
   */
  private broadcastCount(): void {
    const actualCount = Math.max(1, this.connections.size);
    const message: VisitorMessage = {
      type: "count",
      total: actualCount,
      history: this.history,
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

  /**
   * Sends a message to a specific client
   */
  private sendToClient(ws: WebSocket, message: VisitorMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (e) {
      this.connections.delete(ws);
    }
  }
}

/**
 * Worker entrypoint - exports the Durable Object for Astro to use
 */
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
