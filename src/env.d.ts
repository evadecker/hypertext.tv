/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type DurableObjectNamespace = import("@cloudflare/workers-types").DurableObjectNamespace;

type ENV = {
  VIEWER_COUNT: DurableObjectNamespace;
};

type Runtime = import("@astrojs/cloudflare").Runtime<ENV>;

declare namespace App {
  interface Locals extends Runtime {
    // Add custom locals here
  }
}
