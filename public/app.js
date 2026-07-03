const form = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const contentInput = document.getElementById('content-input');
const notesList = document.getElementById('notes-list');
const errorBox = document.getElementById('error-box');

let editingId = null;

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.classList.add('hidden');
}

function resetForm() {
  form.reset();
  editingId = null;
  form.querySelector('button').textContent = 'Add Note';
}

function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function fetchNotes() {
  const res = await fetchWithTimeout('/notes');
  const notes = await res.json();
  renderNotes(notes);
}

function renderNotes(notes) {
  notesList.innerHTML = '';
  notes.forEach(note => {
    const div = document.createElement('div');
    div.className = 'note';
    div.innerHTML = `
      <h3>${escapeHtml(note.title)}</h3>
      <div class="meta">Updated ${new Date(note.updated_at).toLocaleString()}</div>
      <p>${escapeHtml(note.content || '')}</p>
      <div class="note-actions">
        <button class="edit-btn" data-id="${note.id}">Edit</button>
        <button class="delete-btn" data-id="${note.id}">Delete</button>
      </div>
    `;
    notesList.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const submitBtn = form.querySelector('button');
  const originalLabel = submitBtn.textContent;

  const url = editingId ? `/notes/${editingId}` : '/notes';
  const method = editingId ? 'PUT' : 'POST';

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const res = await fetchWithTimeout(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 404) {
        showError('This note no longer exists. It may have been deleted.');
        resetForm();
        fetchNotes();
        return;
      }
      showError(data.errors ? data.errors.join(', ') : (data.error || 'Something went wrong'));
      return;
    }

    resetForm();
    fetchNotes();
  } catch (err) {
    if (err.name === 'AbortError') {
      showError('Request timed out — the database connection may be slow. Please try again.');
    } else {
      showError('Network error — please try again');
    }
  } finally {
    submitBtn.disabled = false;
    if (submitBtn.textContent === 'Saving...') submitBtn.textContent = originalLabel;
  }
});

notesList.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('delete-btn')) {
    if (!confirm('Delete this note?')) return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    try {
      const res = await fetchWithTimeout(`/notes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        showError('Failed to delete note. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Delete';
        return;
      }
      if (editingId === Number(id)) resetForm();
      fetchNotes();
    } catch (err) {
      if (err.name === 'AbortError') {
        showError('This is taking longer than usual. Refreshing the list to check...');
        fetchNotes();
      } else {
        showError('Network error — please try again');
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    }
  }

  if (e.target.classList.contains('edit-btn')) {
    clearError();
    const btn = e.target;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Loading...';
    try {
      const res = await fetchWithTimeout(`/notes/${id}`);
      if (!res.ok) {
        showError('This note no longer exists. It may have been deleted.');
        fetchNotes();
        return;
      }
      const note = await res.json();
      titleInput.value = note.title;
      contentInput.value = note.content || '';
      editingId = note.id;
      form.querySelector('button').textContent = 'Update Note';
      titleInput.focus();
    } catch (err) {
      showError(err.name === 'AbortError' ? 'Request timed out — please try again.' : 'Network error — please try again');
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
});

fetchNotes();
