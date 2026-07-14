export function errorHandler(error, req, res, next) {
  console.error(error);
  const status = error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
  });
}
