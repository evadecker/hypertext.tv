import { DurableObject } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import type { SSRManifest } from "astro";
import { App } from "astro/app";

export interface Env {
  VIEWER_COUNT: DurableObjectNamespace<ViewerCount>;
}

export class ViewerCount extends DurableObject<Env> {
  private lastBroadcastTime = 0;
  private pendingBroadcast: ReturnType<typeof setTimeout> | null = null;
  private readonly BROADCAST_THROTTLE_MS = 100; // Max 10 broadcasts per second

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // When the Durable Object wakes from hibernation, restore WebSocket state
    const existingConnections = this.ctx.getWebSockets();
    if (existingConnections.length > 0) {
      this.scheduleBroadcast();
    }
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use Hibernatable WebSocket API
    this.ctx.acceptWebSocket(server);

    // Schedule throttled broadcast
    this.scheduleBroadcast();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(
    _ws: WebSocket,
    _message: string | ArrayBuffer,
  ): Promise<void> {
    // Handle any messages from clients if needed
    // Currently not used
  }

  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    this.scheduleBroadcast();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    this.scheduleBroadcast();
  }

  private scheduleBroadcast(): void {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcastTime;

    // If enough time has passed, broadcast
    if (timeSinceLastBroadcast >= this.BROADCAST_THROTTLE_MS) {
      this.broadcast();
      return;
    }

    // Otherwise, schedule a broadcast if one isn't already pending
    if (!this.pendingBroadcast) {
      const delay = this.BROADCAST_THROTTLE_MS - timeSinceLastBroadcast;
      this.pendingBroadcast = setTimeout(() => {
        this.pendingBroadcast = null;
        this.broadcast();
      }, delay);
    }
  }

  private broadcast(): void {
    this.lastBroadcastTime = Date.now();

    // getWebSockets() always returns only active connections
    const connections = this.ctx.getWebSockets();
    const count = Math.min(999, Math.max(1, connections.length));
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
