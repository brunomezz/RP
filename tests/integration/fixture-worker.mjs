// Test entrypoint only. Never packaged in the Sites build.
import { createERPHandler } from "../../shared/api.mjs";
const api = createERPHandler(async (request, env) => {
  const r = await env.TEST_AUTH.fetch(
    new Request(request.url, { headers: request.headers }),
  );
  if (!r.ok)
    throw Object.assign(Error("Sessão de teste ausente."), { status: 401 });
  return r.json();
});
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/dev/"))
      return env.TEST_AUTH.fetch(request);
    return api(request, env);
  },
};
