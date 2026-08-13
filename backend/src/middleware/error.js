export function errorHandler(error, req, res, next) {
  void next;
  const status = error.statusCode
    || (error.code === 'LIMIT_FILE_SIZE' ? 413 : undefined)
    || (error.name === 'MulterError' ? 422 : undefined)
    || 500;
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

  const safeMessage = status >= 500
    ? 'Internal server error'
    : (error.message
        || (error.code === 'LIMIT_FILE_SIZE'
          ? 'Uploaded file exceeds the allowed size.'
          : 'Request failed'));
  res.status(status).json({
    success: false,
    message: safeMessage,
  });
}
