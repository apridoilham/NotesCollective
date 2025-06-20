const DELETE_BUTTON_SELECTOR = '.delete-button';
const ARCHIVE_BUTTON_SELECTOR = '.archive-button';
const UNARCHIVE_BUTTON_SELECTOR = '.unarchive-button';
const NOTE_ITEM_CLASS = 'note-item';
const NOTE_TIMESTAMP_CLASS = 'note-timestamp';
const OPTIMISTIC_CLASS = 'is-optimistic';
const HIGHLIGHT_CLASS = 'highlight-border'; // Class untuk custom attribute

class NoteItem extends HTMLElement {
  _note = null;
  _onDelete = null;
  _onArchive = null;
  _onUnarchive = null;

  // Mendefinisikan atribut apa saja yang ingin diobservasi perubahannya
  static get observedAttributes() {
    return ['note-id', 'highlight-on-hover'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    // Baca nilai awal atribut saat elemen terhubung ke DOM
    this.applyHighlightAttribute(); // Contoh penerapan
    this.render();
  }

  // Dipanggil ketika salah satu atribut di observedAttributes berubah
  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} changed from ${oldValue} to ${newValue}`);
    // React terhadap perubahan atribut
    if (name === 'highlight-on-hover') {
      this.applyHighlightAttribute();
    }
    // Jika note-id berubah, mungkin perlu update state internal (jika digunakan)
    // if (name === 'note-id') { /* ... */ }
  }

  applyHighlightAttribute() {
    // Contoh: tambahkan class jika atribut highlight-on-hover ada (valuenya tidak penting)
    if (this.hasAttribute('highlight-on-hover')) {
      this.classList.add(HIGHLIGHT_CLASS);
    } else {
      this.classList.remove(HIGHLIGHT_CLASS);
    }
    // Di CSS, Anda bisa menambahkan style untuk .note-item.highlight-border:hover { ... }
  }

  set note(newNote) {
    if (newNote && typeof newNote === 'object' && newNote.id) {
      const hasChanged =
        !this._note ||
        this._note.id !== newNote.id ||
        this._note.archived !== newNote.archived ||
        this._note.isOptimistic !== newNote.isOptimistic;
      if (hasChanged) {
        this._note = newNote;
        // Set atribut note-id secara otomatis saat data note di-set
        this.setAttribute('note-id', this._note.id);
        this.render();
      }
    } else {
      if (this._note !== null) {
        this._note = null;
        this.removeAttribute('note-id'); // Hapus atribut jika note tidak valid
        this.render();
      }
      if (newNote !== null) {
        console.warn('Invalid note data passed to NoteItem:', newNote);
      }
    }
  }

  get note() {
    return this._note;
  }

  formatDate(isoString) {
    if (!isoString) return '';
    try {
      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };
      return new Date(isoString).toLocaleString(undefined, options);
    } catch (e) {
      console.error('Failed to format date:', isoString, e);
      return 'Invalid Date';
    }
  }

  render() {
    // Pastikan class utama selalu ada sebelum render innerHTML
    if (!this.classList.contains(NOTE_ITEM_CLASS)) {
      this.classList.add(NOTE_ITEM_CLASS);
    }
    this.classList.toggle(OPTIMISTIC_CLASS, this._note?.isOptimistic || false);

    if (!this._note || !this._note.id) {
      this.innerHTML = '';
      this.classList.remove(OPTIMISTIC_CLASS);
      // Jangan hapus class NOTE_ITEM_CLASS agar style dasar tetap ada jika perlu
      return;
    }

    const {
      id,
      title = 'Untitled',
      body = '',
      archived = false,
      createdAt,
      style,
    } = this._note;
    const formattedDate = this.formatDate(createdAt);

    if (style && style['--animation-order'] !== undefined) {
      this.style.setProperty('--animation-order', style['--animation-order']);
    }

    const deleteButtonLabel = `Delete note titled '${title}'`;
    const archiveButtonLabel = `Archive note titled '${title}'`;
    const unarchiveButtonLabel = `Unarchive note titled '${title}'`;

    this.innerHTML = `
      <article aria-labelledby="note-title-${id}">
        <div class="note-header">
            <h3 id="note-title-${id}">${title}</h3>
            ${formattedDate ? `<time class="${NOTE_TIMESTAMP_CLASS}" datetime="${createdAt}">${formattedDate}</time>` : ''}
        </div>
        <p class="note-body">${body}</p>
        <div class="note-actions">
          <button class="${DELETE_BUTTON_SELECTOR.substring(1)}" data-id="${id}" aria-label="${deleteButtonLabel}">Delete</button>
          ${
            archived
              ? `<button class="${UNARCHIVE_BUTTON_SELECTOR.substring(1)}" data-id="${id}" aria-label="${unarchiveButtonLabel}">Unarchive</button>`
              : `<button class="${ARCHIVE_BUTTON_SELECTOR.substring(1)}" data-id="${id}" aria-label="${archiveButtonLabel}">Archive</button>`
          }
        </div>
      </article>
    `;
    this.setupButtonEvents();
  }

  setupButtonEvents() {
    const deleteButton = this.querySelector(DELETE_BUTTON_SELECTOR);
    if (deleteButton) {
      const newButton = deleteButton.cloneNode(true);
      deleteButton.replaceWith(newButton);
      newButton.addEventListener('click', () => {
        if (this._onDelete && this._note) this._onDelete(this._note.id);
        else console.error('Cb/note missing');
      });
    }
    const archiveButton = this.querySelector(ARCHIVE_BUTTON_SELECTOR);
    if (archiveButton) {
      const newButton = archiveButton.cloneNode(true);
      archiveButton.replaceWith(newButton);
      newButton.addEventListener('click', () => {
        if (this._onArchive && this._note) this._onArchive(this._note.id);
        else console.error('Cb/note missing');
      });
    }
    const unarchiveButton = this.querySelector(UNARCHIVE_BUTTON_SELECTOR);
    if (unarchiveButton) {
      const newButton = unarchiveButton.cloneNode(true);
      unarchiveButton.replaceWith(newButton);
      newButton.addEventListener('click', () => {
        if (this._onUnarchive && this._note) this._onUnarchive(this._note.id);
        else console.error('Cb/note missing');
      });
    }
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
}

if (!customElements.get('note-item')) {
  customElements.define('note-item', NoteItem);
}
export default NoteItem;
