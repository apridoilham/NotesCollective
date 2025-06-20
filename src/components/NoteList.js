import './NoteItem.js';

const EMPTY_MESSAGE_CLASS = 'empty-notes-message';
const NO_NOTES_FOUND_TEXT = 'No notes found.';

class NoteList extends HTMLElement {
  _notes = [];
  _onDelete = null;
  _onArchive = null;
  _onUnarchive = null;

  constructor() {
    super();
  }
  connectedCallback() {
    this.render();
  }

  set notes(newNotes) {
    const validNotes = Array.isArray(newNotes) ? newNotes : [];
    this._notes = validNotes;
    this.render();
  }
  get notes() {
    return this._notes;
  }

  setOnDelete(cb) {
    this._onDelete = typeof cb === 'function' ? cb : null;
  }
  setOnArchive(cb) {
    this._onArchive = typeof cb === 'function' ? cb : null;
  }
  setOnUnarchive(cb) {
    this._onUnarchive = typeof cb === 'function' ? cb : null;
  }

  render() {
    this.innerHTML = '';

    if (!this._notes || this._notes.length === 0) {
      this.innerHTML = `<p class="${EMPTY_MESSAGE_CLASS}">${NO_NOTES_FOUND_TEXT}</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    this._notes.forEach((note) => {
      if (!note || typeof note !== 'object' || !note.id) {
        console.warn('Skipping invalid note data:', note);
        return;
      }

      const noteItem = document.createElement('note-item');

      // Set atribut 'note-id' (contoh custom attribute)
      noteItem.setAttribute('note-id', note.id);
      // Anda bisa set atribut lain di sini jika didefinisikan di observedAttributes NoteItem
      // noteItem.setAttribute('highlight-on-hover', ''); // Contoh jika ingin aktifkan highlight

      if (note.style && note.style['--animation-order'] !== undefined) {
        noteItem.style.setProperty(
          '--animation-order',
          note.style['--animation-order']
        );
      }

      if (this._onDelete) noteItem.setOnDelete(this._onDelete);
      if (this._onArchive) noteItem.setOnArchive(this._onArchive);
      if (this._onUnarchive) noteItem.setOnUnarchive(this._onUnarchive);

      const { style, ...noteData } = note; // Kirim data note tanpa style
      noteItem.note = noteData;

      fragment.appendChild(noteItem);
    });
    this.appendChild(fragment);
  }
}

if (!customElements.get('note-list')) {
  customElements.define('note-list', NoteList);
}
export default NoteList;
