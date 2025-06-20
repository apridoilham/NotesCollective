export function showLoading(element) {
  if (element instanceof HTMLElement) {
    element.style.display = 'block';
    element.setAttribute('aria-busy', 'true');
  } else if (element) {
    console.warn('showLoading called with a non-HTMLElement:', element);
  }
}

export function hideLoading(element) {
  if (element instanceof HTMLElement) {
    element.style.display = 'none';
    element.setAttribute('aria-busy', 'false');
  } else if (element) {
    console.warn('hideLoading called with a non-HTMLElement:', element);
  }
}
