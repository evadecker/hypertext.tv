import { DurableObject } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import type { SSRManifest } from "astro";
import { App } from "astro/app";

export interface Env {
  VIEWER_COUNT: DurableObjectNamespace<ViewerCount>;
}

export class ViewerCount extends DurableObject<Env> {
  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use Hibernatable WebSocket API
    this.ctx.acceptWebSocket(server);

    // Send initial count and broadcast to all
    const count = Math.max(1, this.ctx.getWebSockets().length);
    server.send(count.toString());
    this.broadcast();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    this.broadcast();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    this.broadcast();
  }

  private broadcast(): void {
    // getWebSockets() always returns only active connections
    const connections = this.ctx.getWebSockets();
    const count = Math.max(1, connections.length);
    const message = count.toString();

    for (const conn of connections) {
      try {
        conn.send(message);
      } catch {
        // Cloudflare will automatically clean up failed connections
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
    ViewerCount: ViewerCount,
  };
}
