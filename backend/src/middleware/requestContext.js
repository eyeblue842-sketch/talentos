import crypto from 'crypto';

export function requestContext(req, res, next) {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  req.requestId = requestId;
  req.requestStartedAt = startedAt;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    console.info(JSON.stringify({
      level: 'info',
      event: 'http.request.completed',
      requestId,
      organisationId: req.get('x-organisation-id') || req.user?.activeMembership?.organisationId || null,
      userId: req.user?.id || null,
      route: req.originalUrl,
      method: req.method,
      status: res.statusCode,
      latencyMs: Date.now() - startedAt,
    }));
  });

  next();
}
