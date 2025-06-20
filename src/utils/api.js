const BASE_URL = 'https://notes-api.dicoding.dev/v2';

const NOTES_ENDPOINT = '/notes';
const ARCHIVED_NOTES_ENDPOINT = '/notes/archived';
const ARCHIVE_NOTE_ENDPOINT = (id) => `/notes/${id}/archive`;
const UNARCHIVE_NOTE_ENDPOINT = (id) => `/notes/${id}/unarchive`;
const NOTE_DETAIL_ENDPOINT = (id) => `/notes/${id}`;

async function fetchApi(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        ...(options.body && { 'Content-Type': 'application/json' }),
      },
    });

    if (!response.ok) {
      let errorMessage =
        `HTTP error! status: ${response.status} ${response.statusText || ''}`.trim();
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorMessage;
      } catch (e) {}
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    if (
      response.status === 204 ||
      response.headers.get('content-length') === '0'
    ) {
      return {
        status: 'success',
        message: 'Operation successful (No Content)',
        data: null,
      };
    }

    try {
      const responseJson = await response.json();
      if (responseJson.status !== 'success') {
        const error = new Error(
          responseJson.message || 'API request failed with status "fail".'
        );
        error.status = response.status;
        throw error;
      }
      return responseJson;
    } catch (jsonError) {
      console.error('Failed to parse JSON response body:', jsonError);
      throw new Error('Failed to parse server response.');
    }
  } catch (networkOrApiError) {
    console.error('API Fetch error details:', networkOrApiError);
    throw networkOrApiError;
  }
}

export async function getNotes() {
  return fetchApi(NOTES_ENDPOINT);
}

export async function getArchivedNotes() {
  return fetchApi(ARCHIVED_NOTES_ENDPOINT);
}

export async function addNote(title, body) {
  if (!title || !body) {
    return Promise.reject(new Error('Title and body cannot be empty'));
  }
  return fetchApi(NOTES_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  });
}

export async function deleteNote(id) {
  if (!id) return Promise.reject(new Error('Note ID is required for deletion'));
  return fetchApi(NOTE_DETAIL_ENDPOINT(id), {
    method: 'DELETE',
  });
}

export async function archiveNote(id) {
  if (!id)
    return Promise.reject(new Error('Note ID is required for archiving'));
  return fetchApi(ARCHIVE_NOTE_ENDPOINT(id), {
    method: 'POST',
  });
}

export async function unarchiveNote(id) {
  if (!id)
    return Promise.reject(new Error('Note ID is required for unarchiving'));
  return fetchApi(UNARCHIVE_NOTE_ENDPOINT(id), {
    method: 'POST',
  });
}
