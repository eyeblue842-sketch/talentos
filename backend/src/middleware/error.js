export function errorHandler(error, req, res, next) {
  console.error({
    message: error.message,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
  });
  const status = error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
  });
}
