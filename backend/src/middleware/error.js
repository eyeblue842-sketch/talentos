export function errorHandler(error, req, res, next) {
  void next;
  const status = error.statusCode || 500;
  console.error(JSON.stringify({
    level: 'error',
    event: 'http.request.error',
    requestId: req.requestId || null,
    organisationId: req.get('x-organisation-id') || req.user?.activeMembership?.organisationId || null,
    userId: req.user?.id || null,
    message: error.message,
    code: error.code || null,
    statusCode: status,
    path: req.path,
    method: req.method,
    latencyMs: req.requestStartedAt ? Date.now() - req.requestStartedAt : null,
  }));

  const safeMessage = status >= 500 ? 'Internal server error' : (error.message || 'Request failed');
  res.status(status).json({
    success: false,
    message: safeMessage,
  });
}
