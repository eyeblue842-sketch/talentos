export function apiResponse(data, meta = undefined) {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function apiError(message, details = undefined) {
  return details ? { success: false, message, details } : { success: false, message };
}

export function sendSuccess(res, statusCode, data, meta = undefined) {
  return res.status(statusCode).json(apiResponse(data, meta));
}
