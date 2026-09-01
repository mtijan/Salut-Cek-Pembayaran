// DOM Helpers & State Manipulation
// UT SALUT Awwabin Tangerang

/**
 * Append a child element with text content and class name.
 * @param {HTMLElement} parent
 * @param {string} tagName
 * @param {string} className
 * @param {string} text
 * @returns {HTMLElement}
 */
export function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  parent.appendChild(element);
  return element;
}

/**
 * Set or clear message inside a form alert container.
 * @param {HTMLElement} container
 * @param {string} text
 * @param {string} [type=""]
 */
export function setMessage(container, text, type = "") {
  if (!container) return;
  if (!text) {
    container.textContent = "";
    container.className = "form-alert hidden";
    return;
  }
  container.textContent = text;
  container.className = `form-alert ${type}`.trim();
  container.classList.remove("hidden");
}

/**
 * Show empty placeholder state and hide result state.
 * @param {HTMLElement} emptyEl
 * @param {HTMLElement} resultEl
 */
export function showEmptyState(emptyEl, resultEl) {
  if (emptyEl) emptyEl.classList.remove("hidden");
  if (resultEl) resultEl.classList.add("hidden");
}

/**
 * Show result state and hide empty placeholder state.
 * @param {HTMLElement} emptyEl
 * @param {HTMLElement} resultEl
 */
export function showResultState(emptyEl, resultEl) {
  if (emptyEl) emptyEl.classList.add("hidden");
  if (resultEl) resultEl.classList.remove("hidden");
}

/**
 * Smoothly scroll to result element on mobile/smaller viewports.
 * @param {HTMLElement} resultEl
 */
export function scrollToResultOnMobile(resultEl) {
  if (resultEl && window.innerWidth < 860) {
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
