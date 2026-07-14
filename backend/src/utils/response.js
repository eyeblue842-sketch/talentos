export function apiResponse(data, meta = {}) {
  return { success: true, data, meta };
}

export function apiError(message, details = null) {
  return { success: false, message, details };
}
