export function buildSearchParams(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '' || value === false) continue;

    if (Array.isArray(value)) {
      if (!value.length) continue;
      search.set(key, value.join(','));
      continue;
    }

    search.set(key, String(value));
  }

  return search;
}

export function buildPathWithQuery(path, params = {}) {
  const search = buildSearchParams(params).toString();
  return search ? `${path}?${search}` : path;
}

export function withPage(params = {}, page) {
  const next = { ...params };
  if (page <= 1) {
    delete next.page;
  } else {
    next.page = String(page);
  }
  return next;
}

