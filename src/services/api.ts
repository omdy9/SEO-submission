/**
 * Helper utility for making fetch API requests safely with JSON parsing
 * and human-readable error fallback for non-JSON or HTML responses (e.g. 404/500/proxy errors).
 */
export async function safeFetchJson(url: string, options?: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(`Unable to connect to backend server. Please verify the server is running on port 3001. (${netErr.message})`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  let data: any = null;
  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      data = JSON.parse(text);
    } catch {
      // Ignore JSON parse error if fallback needed
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || (text.length < 150 ? text : `Server error (${response.status} ${response.statusText})`);
    throw new Error(errorMsg);
  }

  if (data !== null) {
    return data;
  }

  throw new Error(`Unexpected non-JSON response received from server. Make sure the backend server on port 3001 is active.`);
}
