import Swal from 'sweetalert2';

const FORM_CLASS = 'note-input-form';
const TITLE_INPUT_ID = 'noteTitle';
const BODY_INPUT_ID = 'noteBody';
const ADD_BUTTON_CLASS = 'add-button';
const INPUT_CONTAINER_CLASS = 'note-input-container';
const INPUT_GROUP_CLASS = 'input-group';
const VALIDATION_MESSAGE_CLASS = 'validation-message';
const INVALID_CLASS = 'invalid'; // Class untuk input error

class NoteInput extends HTMLElement {
  _onAddNote = null;
  _disabled = false;

  form = null;
  noteTitleInput = null;
  noteBodyInput = null;
  addButton = null;
  titleErrorElement = null; // Elemen untuk pesan error judul
  bodyErrorElement = null; // Elemen untuk pesan error body

  constructor() {
    super();
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleInputValidation = this.handleInputValidation.bind(this); // Bind validator
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.disabled = this._disabled;
  }

  disconnectedCallback() {
    if (this.form) {
      this.form.removeEventListener('submit', this.handleSubmit);
    }
    // Hapus listener validasi saat elemen dihapus
    if (this.noteTitleInput) {
      this.noteTitleInput.removeEventListener(
        'input',
        this.handleInputValidation
      );
      this.noteTitleInput.removeEventListener(
        'blur',
        this.handleInputValidation
      );
    }
    if (this.noteBodyInput) {
      this.noteBodyInput.removeEventListener(
        'input',
        this.handleInputValidation
      );
      this.noteBodyInput.removeEventListener(
        'blur',
        this.handleInputValidation
      );
    }
  }

  get disabled() {
    return this._disabled;
  }
  set disabled(value) {
    const booleanValue = !!value;
    if (this._disabled === booleanValue) return;
    this._disabled = booleanValue;
    if (this.addButton) this.addButton.disabled = this._disabled;
    if (this.noteTitleInput) this.noteTitleInput.disabled = this._disabled;
    if (this.noteBodyInput) this.noteBodyInput.disabled = this._disabled;
    if (this.form) this.form.toggleAttribute('disabled', this._disabled);
  }

  render() {
    this.innerHTML = `
      <form class="${FORM_CLASS}" aria-label="Add new note form" novalidate>
        <div class="${INPUT_CONTAINER_CLASS}">
            <div class="${INPUT_GROUP_CLASS}">
                <label for="${TITLE_INPUT_ID}" class="visually-hidden">Note Title</label>
                <input type="text" id="${TITLE_INPUT_ID}" name="noteTitle" placeholder="Title" required autocomplete="off" aria-describedby="title-error">
                <span id="title-error" class="${VALIDATION_MESSAGE_CLASS}" aria-live="polite"></span>
            </div>
            <div class="${INPUT_GROUP_CLASS}">
                <label for="${BODY_INPUT_ID}" class="visually-hidden">Note Body</label>
                <textarea id="${BODY_INPUT_ID}" name="noteBody" placeholder="Enter your note here..." required aria-describedby="body-error"></textarea>
                <span id="body-error" class="${VALIDATION_MESSAGE_CLASS}" aria-live="polite"></span>
            </div>
            <button type="submit" class="${ADD_BUTTON_CLASS}">Add Note</button>
        </div>
      </form>
    `;

    this.form = this.querySelector(`.${FORM_CLASS}`);
    this.noteTitleInput = this.querySelector(`#${TITLE_INPUT_ID}`);
    this.noteBodyInput = this.querySelector(`#${BODY_INPUT_ID}`);
    this.addButton = this.querySelector(`.${ADD_BUTTON_CLASS}`);
    this.titleErrorElement = this.querySelector('#title-error'); // Ambil elemen pesan error
    this.bodyErrorElement = this.querySelector('#body-error');

    this.disabled = this._disabled;
  }

  setupEventListeners() {
    if (this.form) this.form.addEventListener('submit', this.handleSubmit);
    else console.error('Note input form not found.');

    // Tambahkan listener untuk validasi realtime
    if (this.noteTitleInput) {
      this.noteTitleInput.addEventListener('input', this.handleInputValidation);
      this.noteTitleInput.addEventListener('blur', this.handleInputValidation); // Validasi juga saat field ditinggalkan
    }
    if (this.noteBodyInput) {
      this.noteBodyInput.addEventListener('input', this.handleInputValidation);
      this.noteBodyInput.addEventListener('blur', this.handleInputValidation);
    }
  }

  validateField(inputElement) {
    const errorElement =
      inputElement === this.noteTitleInput
        ? this.titleErrorElement
        : this.bodyErrorElement;
    let isValid = true;
    let message = '';

    // Cek apakah kosong (validasi required)
    if (!inputElement.value.trim()) {
      isValid = false;
      message = `${inputElement.placeholder || 'This field'} is required.`;
    }
    // Tambahkan validasi lain jika perlu (misal panjang karakter)

    // Tampilkan/sembunyikan pesan error & update style input
    if (!isValid) {
      inputElement.classList.add(INVALID_CLASS);
      if (errorElement) errorElement.textContent = message;
    } else {
      inputElement.classList.remove(INVALID_CLASS);
      if (errorElement) errorElement.textContent = '';
    }
    return isValid;
  }

  handleInputValidation(event) {
    if (
      event.target &&
      (event.target.id === TITLE_INPUT_ID || event.target.id === BODY_INPUT_ID)
    ) {
      this.validateField(event.target);
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    if (this._disabled) return;

    // Jalankan validasi untuk kedua field saat submit
    const isTitleValid = this.validateField(this.noteTitleInput);
    const isBodyValid = this.validateField(this.noteBodyInput);

    // Hanya lanjutkan jika kedua field valid
    if (!isTitleValid || !isBodyValid) {
      // Fokus ke field pertama yang error (opsional)
      if (!isTitleValid) this.noteTitleInput?.focus();
      else if (!isBodyValid) this.noteBodyInput?.focus();
      return;
    }

    const title = this.noteTitleInput.value.trim();
    const body = this.noteBodyInput.value.trim();

    if (this._onAddNote) {
      try {
        this._onAddNote(title, body);
      } catch (error) {
        console.error('Error executing onAddNote callback:', error);
        Swal.fire({
          icon: 'error',
          title: 'Submission Error',
          text: 'An error occurred.',
        });
      }
    } else {
      console.warn('onAddNote callback is not set.');
    }

    // Reset field dan validasi setelah submit berhasil
    this.noteTitleInput.value = '';
    this.noteBodyInput.value = '';
    this.noteTitleInput.classList.remove(INVALID_CLASS);
    this.noteBodyInput.classList.remove(INVALID_CLASS);
    if (this.titleErrorElement) this.titleErrorElement.textContent = '';
    if (this.bodyErrorElement) this.bodyErrorElement.textContent = '';
    this.noteTitleInput?.focus();
  }

  setOnAddNote(callback) {
    if (typeof callback === 'function' || callback === null) {
      this._onAddNote = callback;
    } else {
      console.warn('setOnAddNote expects a function or null.');
    }
  }
}

if (!customElements.get('note-input')) {
  customElements.define('note-input', NoteInput);
}

export default NoteInput;
