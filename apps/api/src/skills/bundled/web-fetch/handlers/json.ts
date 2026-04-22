export default async function fetchJson(params: {
  url: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}): Promise<any> {
  const { url, method = 'GET', body, headers = {} } = params;

  const fetchOptions: any = {
    method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
      ...headers
    }
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    success: true,
    url,
    method,
    status: response.status,
    data
  };
}
