/*
 * Main application logic for the EPUB Card Reader.
 *
 * This script handles: parsing the selected EPUB file using JSZip, splitting
 * the extracted text into appropriately sized cards without cutting words or
 * sentences, presenting the cards with a slide animation, persisting the
 * current reading position and theme in localStorage, handling keyboard
 * navigation and jump functionality, and toggling between light and dark
 * modes. The intent is to keep the user experience smooth while giving
 * enough control through minimal UI elements.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Element references
  const body = document.body;
  const landing = document.getElementById('landing-page');
  const reader = document.getElementById('reader-section');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const cardContainer = document.getElementById('card-container');
  const navCounter = document.getElementById('nav-counter');
  const jumpInput = document.getElementById('jumpInput');
  const themeSwitcher = document.getElementById('themeSwitcher');
  const resetBtn = document.getElementById('resetBtn');

  // State variables
  let cards = [];
  let currentIndex = 0;

  /*
   * Apply saved theme from localStorage. When switching themes, update
   * localStorage accordingly. The `.dark` class on the body controls
   * colour variables defined in the CSS.
   */
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    body.classList.add('dark');
    themeSwitcher.checked = true;
  }

  themeSwitcher.addEventListener('change', () => {
    if (themeSwitcher.checked) {
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  });

  /*
   * Restore a previous reading session if cards and an index are stored in
   * localStorage. If valid data is found, skip the landing page and render
   * the stored card immediately. Errors in parsing stored data are logged but
   * ignored otherwise.
   */
  const savedCards = localStorage.getItem('cards');
  const savedIndex = localStorage.getItem('currentIndex');
  if (savedCards && savedIndex !== null) {
    try {
      cards = JSON.parse(savedCards);
      currentIndex = parseInt(savedIndex, 10) || 0;
      if (Array.isArray(cards) && cards.length > 0) {
        landing.classList.add('hidden');
        reader.classList.remove('hidden');
        renderInitialCard();
        updateCounter();
      }
    } catch (err) {
      console.error('Failed to load stored session:', err);
    }
  }

  /*
   * Render the first card on load or resume. Clears any existing card
   * container contents and inserts the current card. This is used both on
   * initial render and after uploading a new book.
   */
  function renderInitialCard() {
    cardContainer.innerHTML = '';
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = cards[currentIndex] || '';
    cardContainer.appendChild(cardEl);
  }

  /*
   * Update the navigation counter text and ensure it's synchronised with the
   * current state. Example: "3 / 120".
   */
  function updateCounter() {
    // When no cards are loaded, display 0/0 rather than 1/0
    if (!cards || cards.length === 0) {
      navCounter.textContent = '0 / 0';
    } else {
      navCounter.textContent = `${currentIndex + 1} / ${cards.length}`;
    }
  }

  /*
   * Persist the current cards array and index in localStorage. Storing
   * progress between sessions allows readers to resume where they left off.
   */
  function updateLocalStorage() {
    localStorage.setItem('cards', JSON.stringify(cards));
    localStorage.setItem('currentIndex', currentIndex);
  }

  /*
   * Slide animation when moving between cards. A new card element is
   * generated and inserted above or below the current card depending on the
   * direction (next or prev). CSS transitions handle the smooth slide.
   * After the animation completes, the old card is removed.
   *
   * @param {number} index - Index of the card to display.
   * @param {string} direction - Either 'next' or 'prev'.
   */
  function showCard(index, direction) {
    const oldCard = cardContainer.querySelector('.card');
    const newCard = document.createElement('div');
    newCard.className = 'card';
    newCard.textContent = cards[index] || '';
    // Start position depends on navigation direction
    if (direction === 'next') {
      newCard.style.transform = 'translate(-50%, calc(-50% + 100%))';
    } else {
      newCard.style.transform = 'translate(-50%, calc(-50% - 100%))';
    }
    newCard.style.opacity = '0';
    cardContainer.appendChild(newCard);
    // Force reflow before starting animation
    newCard.getBoundingClientRect();
    // Animate both old and new cards
    requestAnimationFrame(() => {
      newCard.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
      oldCard.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
      newCard.style.transform = 'translate(-50%, -50%)';
      newCard.style.opacity = '1';
      if (direction === 'next') {
        oldCard.style.transform = 'translate(-50%, calc(-50% - 100%))';
      } else {
        oldCard.style.transform = 'translate(-50%, calc(-50% + 100%))';
      }
      oldCard.style.opacity = '0';
    });
    newCard.addEventListener('transitionend', () => {
      if (oldCard && oldCard.parentElement) {
        oldCard.remove();
      }
    }, { once: true });
  }

  /*
   * Advance to the next card if available. Updates localStorage and
   * navigation counter. When the last card is reached, no action is taken.
   */
  function nextCard() {
    if (!cards || cards.length === 0) return;
    if (currentIndex < cards.length - 1) {
      currentIndex += 1;
      showCard(currentIndex, 'next');
      updateCounter();
      updateLocalStorage();
    }
  }

  /*
   * Move to the previous card if available. Updates localStorage and
   * navigation counter. When the first card is reached, no action is taken.
   */
  function prevCard() {
    if (!cards || cards.length === 0) return;
    if (currentIndex > 0) {
      currentIndex -= 1;
      showCard(currentIndex, 'prev');
      updateCounter();
      updateLocalStorage();
    }
  }

  /*
   * Handle file uploads. Utilises JSZip to open the EPUB archive, parse
   * `META-INF/container.xml` to locate the OPF file, then reads the spine in
   * order to aggregate the book's text. Extracted text is cleaned and
   * passed through the splitter to create an array of cards. Finally,
   * updates the UI and persists the session.
   *
   * @param {File} file - The uploaded EPUB file.
   */
  async function handleFile(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      // Locate the OPF file via container.xml
      const containerXml = await zip.file('META-INF/container.xml').async('string');
      const parser = new DOMParser();
      const containerDoc = parser.parseFromString(containerXml, 'application/xml');
      const rootfile = containerDoc.querySelector('rootfile');
      const fullPath = rootfile ? rootfile.getAttribute('full-path') : null;
      if (!fullPath) throw new Error('Unable to locate content OPF in EPUB.');
      const opfXml = await zip.file(fullPath).async('string');
      const opfDoc = parser.parseFromString(opfXml, 'application/xml');
      // Build manifest map: id -> href
      const manifestItems = opfDoc.querySelectorAll('manifest > item');
      const manifestMap = {};
      manifestItems.forEach(item => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        manifestMap[id] = href;
      });
      const spineItemRefs = opfDoc.querySelectorAll('spine > itemref');
      // Determine directory of the OPF for resolving relative paths
      let opfDir = '';
      const slashIdx = fullPath.lastIndexOf('/');
      if (slashIdx >= 0) {
        opfDir = fullPath.substring(0, slashIdx + 1);
      }
      let aggregatedText = '';
      // Iterate through each itemref in the spine to gather book text
      for (const ref of spineItemRefs) {
        const idref = ref.getAttribute('idref');
        const href = manifestMap[idref];
        if (!href) continue;
        const filePath = opfDir + href;
        const fileContent = await zip.file(filePath).async('string');
        const contentDoc = parser.parseFromString(fileContent, 'application/xhtml+xml');
        let body = contentDoc.querySelector('body');
        let text = '';
        if (body) {
          text = body.textContent || '';
        } else {
          text = contentDoc.textContent || '';
        }
        aggregatedText += ' ' + text;
      }
      aggregatedText = aggregatedText.replace(/\s+/g, ' ').trim();
      // Split aggregated text into card-sized chunks
      cards = splitIntoCards(aggregatedText);
      currentIndex = 0;
      updateLocalStorage();
      // Switch UI from landing to reader
      landing.classList.add('hidden');
      reader.classList.remove('hidden');
      renderInitialCard();
      updateCounter();
    } catch (err) {
      console.error('Error reading EPUB:', err);
      alert('Failed to load EPUB file. Please ensure the file is a valid EPUB.');
    }
  }

  /*
   * Split the full book text into an array of strings not exceeding 160
   * characters. Prefer to end on sentence boundaries (., !, ?) if they
   * occur before the 160‑character limit; otherwise break at the last
   * whitespace. Words are never split mid‑word. Subsequent chunks skip
   * trailing spaces to avoid empty leading spaces in cards.
   *
   * @param {string} text - The full book text as a single string.
   * @returns {string[]} An array of card-sized text segments.
   */
  function splitIntoCards(text) {
    const cardsArray = [];
    let pos = 0;
    const maxLength = 260;
    while (pos < text.length) {
      const end = Math.min(pos + maxLength, text.length);
      let sub = text.slice(pos, end);
      let cutIndex = -1;
      // Find the last sentence-ending punctuation within the substring
      for (let i = sub.length - 1; i >= 0; i--) {
        const ch = sub[i];
        if (ch === '.' || ch === '!' || ch === '?') {
          cutIndex = i + 1;
          break;
        }
      }
      if (cutIndex === -1) {
        // If no punctuation, find the last whitespace
        const lastSpace = sub.lastIndexOf(' ');
        if (lastSpace > 0) {
          cutIndex = lastSpace;
        } else {
          // No spaces found within maxLength, so break at maxLength
          cutIndex = sub.length;
        }
      }
      const cardText = sub.slice(0, cutIndex).trim();
      if (cardText.length > 0) {
        cardsArray.push(cardText);
      }
      pos += cutIndex;
      // Skip any additional spaces after the cut
      while (text[pos] === ' ') {
        pos += 1;
      }
    }
    return cardsArray;
  }

  /*
   * Event listeners
   */
  // Trigger file selection when the styled button is clicked
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  // When a file is selected, process the EPUB
  fileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) {
      handleFile(file);
    }
    // Reset input value to allow re-uploading the same file if needed
    fileInput.value = '';
  });
  // Keyboard navigation: space/d for next, a for previous
  document.addEventListener('keydown', event => {
    // When on reader screen only
    if (reader.classList.contains('hidden')) return;
    // Do not intercept when focus is on the jump input
    if (document.activeElement === jumpInput) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'd') {
      event.preventDefault();
      nextCard();
    } else if (key === 'a') {
      event.preventDefault();
      prevCard();
    }
  });
  // Jump to a specific card when pressing Enter inside the jump input
  jumpInput.addEventListener('keyup', event => {
    if (event.key === 'Enter') {
      const target = parseInt(jumpInput.value, 10);
      if (!isNaN(target) && target >= 1 && target <= cards.length) {
        const direction = (target - 1 > currentIndex) ? 'next' : 'prev';
        currentIndex = target - 1;
        showCard(currentIndex, direction);
        updateCounter();
        updateLocalStorage();
      }
      // Clear input after jumping
      jumpInput.value = '';
    }
  });

  /*
   * Reset button handler: clears stored session and returns to the landing
   * upload screen. Also cleans up the reader view.
   */
  resetBtn.addEventListener('click', () => {
    // Clear stored progress
    localStorage.removeItem('cards');
    localStorage.removeItem('currentIndex');
    cards = [];
    currentIndex = 0;
    // Reset UI elements
    cardContainer.innerHTML = '';
    updateCounter();
    // Switch back to landing page
    reader.classList.add('hidden');
    landing.classList.remove('hidden');
  });
});