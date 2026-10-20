// Public origin the browser used to reach this route. Behind the reverse proxy
// request.nextUrl.origin is the container's own bind address (e.g. 0.0.0.0:3000),
// which must never be put in a redirect - use the forwarded Host/proto instead.
export function resolveRequestOrigin(request) {
  const host = request.headers?.get?.('x-forwarded-host') || request.headers?.get?.('host') || request.nextUrl.host;
  const protocol = (request.headers?.get?.('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')).split(',')[0].trim();
  return `${protocol}://${host}`;
}
