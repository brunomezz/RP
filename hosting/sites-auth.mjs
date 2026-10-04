// Replace ONLY this adapter with the official starter's server-side helper.
// Do not read user identity from client headers, form fields or localStorage.
export async function requireSiteUser(_request, _env) {
  const error = new Error(
    "Autenticação do Sites ainda não conectada ao helper oficial do starter.",
  );
  error.status = 503;
  throw error;
}
