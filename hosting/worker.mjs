import { createERPHandler } from "../shared/api.mjs";
import { requireSiteUser } from "./sites-auth.mjs";
const api = createERPHandler(requireSiteUser);
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/"))
      return api(request, env);
    if (!env.ASSETS)
      return new Response("Assets não configurados.", { status: 503 });
    return env.ASSETS.fetch(request);
  },
};
