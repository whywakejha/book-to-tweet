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
   * Helper to render the content of a card element. Cards may contain
   * either plain text (string) or an object with an `image` field
   * representing a Data URI. This function clears any existing child
   * nodes on the given card element and inserts either a text node or
   * an image element accordingly.
   *
   * @param {HTMLElement} cardEl - The card DOM element to populate.
   * @param {string|Object} data - The card data to render.
   */
  function renderCardContent(cardEl, data) {
    // Remove existing content
    while (cardEl.firstChild) {
      cardEl.removeChild(cardEl.firstChild);
    }
    if (typeof data === 'string') {
      cardEl.textContent = data;
    } else if (data && typeof data === 'object' && data.image) {
      const img = document.createElement('img');
      img.src = data.image;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      cardEl.appendChild(img);
    }
  }

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
    renderCardContent(cardEl, cards[currentIndex] || '');
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
    // Render appropriate content into the new card (text or image)
    renderCardContent(newCard, cards[index] || '');
    // Choose starting rotation based on navigation direction. Next cards
    // rotate up from behind (-90deg), previous cards rotate down (90deg).
    const startRotation = (direction === 'next') ? 'rotateX(-90deg)' : 'rotateX(90deg)';
    newCard.style.transform = `translate(-50%, -50%) ${startRotation}`;
    newCard.style.opacity = '0';
    cardContainer.appendChild(newCard);
    // Force layout so that starting styles are applied before transition
    newCard.getBoundingClientRect();
    requestAnimationFrame(() => {
      // Smooth rotation and fade for both new and old cards
      newCard.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      oldCard.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      newCard.style.transform = 'translate(-50%, -50%) rotateX(0deg)';
      newCard.style.opacity = '1';
      const endRotation = (direction === 'next') ? 'rotateX(90deg)' : 'rotateX(-90deg)';
      oldCard.style.transform = `translate(-50%, -50%) ${endRotation}`;
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
    // Determine the file type by extension and delegate accordingly. The
    // application now supports EPUB, PDF and plain text/markdown files.
    const name = file.name.toLowerCase();
    if (name.endsWith('.epub')) {
      await handleEpub(file);
    } else if (name.endsWith('.pdf')) {
      await handlePdf(file);
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      await handleTextFile(file);
    } else {
      alert('Unsupported file type. Please upload an EPUB, PDF, TXT or MD file.');
    }
  }

  /*
   * Handle EPUB files using JSZip. This function parses the EPUB
   * container to locate the OPF file, iterates through the spine to
   * collect textual content, extracts any images referenced in the
   * chapters and uses a simple heuristic to skip front matter before
   * Chapter 1. The resulting text is split into cards and the images
   * appended as separate cards at the end.
   *
   * @param {File} file - The uploaded EPUB file.
   */
  async function handleEpub(file) {
    try {
      const zip = await JSZip.loadAsync(file);
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
      const imageCards = [];
      // Utility to derive MIME type from file extension
      function getMimeFromExt(ext) {
        switch (ext.toLowerCase()) {
          case 'jpg':
          case 'jpeg':
            return 'image/jpeg';
          case 'png':
            return 'image/png';
          case 'gif':
            return 'image/gif';
          case 'svg':
            return 'image/svg+xml';
          default:
            return 'image/*';
        }
      }
      // Iterate through each itemref in the spine to gather book text and images
      for (const ref of spineItemRefs) {
        const idref = ref.getAttribute('idref');
        const href = manifestMap[idref];
        if (!href) continue;
        const filePath = opfDir + href;
        const fileContent = await zip.file(filePath).async('string');
        const contentDoc = parser.parseFromString(fileContent, 'application/xhtml+xml');
        let bodyEl = contentDoc.querySelector('body');
        let text = '';
        if (bodyEl) {
          text = bodyEl.textContent || '';
        } else {
          text = contentDoc.textContent || '';
        }
        aggregatedText += ' ' + text;
        // Extract images within this chapter
        const imgs = contentDoc.querySelectorAll('img[src]');
        for (const imgEl of imgs) {
          const src = imgEl.getAttribute('src');
          if (!src) continue;
          // Resolve relative paths relative to the chapter file
          let imgPath = src;
          // Remove leading './' if present
          if (imgPath.startsWith('./')) {
            imgPath = imgPath.substring(2);
          }
          let resolvedPath = '';
          if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
            // External images are ignored for security reasons
            continue;
          } else {
            // Relative to chapter location
            const chapterDirIdx = filePath.lastIndexOf('/');
            const chapterDir = chapterDirIdx >= 0 ? filePath.substring(0, chapterDirIdx + 1) : '';
            resolvedPath = chapterDir + imgPath;
          }
          const extMatch = imgPath.match(/\.([a-zA-Z0-9]+)$/);
          const ext = extMatch ? extMatch[1] : '';
          try {
            const base64 = await zip.file(resolvedPath).async('base64');
            const mime = getMimeFromExt(ext);
            const dataUri = `data:${mime};base64,${base64}`;
            imageCards.push({ image: dataUri });
          } catch (e) {
            // If reading fails, skip this image
            console.warn('Failed to extract image from EPUB:', resolvedPath, e);
          }
        }
      }
      aggregatedText = aggregatedText.replace(/\s+/g, ' ').trim();
      // Attempt to skip front matter by finding the first occurrence of Chapter 1
      const chapterRegexes = [/chapter\s+1\b/i, /chapter\s+one\b/i, /chapter\s+i\b/i];
      for (const re of chapterRegexes) {
        const idx = aggregatedText.search(re);
        if (idx > 0) {
          aggregatedText = aggregatedText.substring(idx);
          break;
        }
      }
      // Split aggregated text into card-sized chunks and append images
      let newCards = splitIntoCards(aggregatedText);
      // Append extracted images as separate cards
      newCards = newCards.concat(imageCards);
      // Initialise state and update UI
      cards = newCards;
      currentIndex = 0;
      updateLocalStorage();
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
   * Handle PDF files using the pdf.js library. This function reads the
   * uploaded PDF into an ArrayBuffer, processes each page to extract text
   * and images (where possible), splits the resulting text into cards and
   * appends extracted images as image cards. The pdf.js worker is
   * configured to load from the CDN referenced in index.html【170093146784270†L256-L264】.
   *
   * @param {File} file - The uploaded PDF file.
   */
  async function handlePdf(file) {
    try {
      // Configure the pdf.js worker script. Without this the default
      // worker may attempt to load from an invalid relative path.
      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let aggregatedText = '';
      const imageCards = [];
      // Helper to extract images from a page
      async function extractImagesFromPage(page) {
        const images = [];
        const opList = await page.getOperatorList();
        const fnArray = opList.fnArray;
        const argsArray = opList.argsArray;
        for (let i = 0; i < fnArray.length; i++) {
          const fn = fnArray[i];
          if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
            const imgName = argsArray[i][0];
            try {
              const imgData = await new Promise(resolve => {
                page.objs.get(imgName, img => resolve(img));
              });
              let canvas = document.createElement('canvas');
              if (imgData instanceof ImageData) {
                canvas.width = imgData.width;
                canvas.height = imgData.height;
                const ctx = canvas.getContext('2d');
                ctx.putImageData(imgData, 0, 0);
              } else if (imgData && imgData.width && imgData.height) {
                canvas.width = imgData.width;
                canvas.height = imgData.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgData, 0, 0);
              } else {
                continue;
              }
              const dataURL = canvas.toDataURL();
              images.push({ image: dataURL });
            } catch (e) {
              console.warn('Failed to extract image from PDF page:', e);
            }
          }
        }
        return images;
      }
      // Iterate through each page
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        textContent.items.forEach(item => {
          aggregatedText += item.str + ' ';
        });
        // Extract images if possible
        const imgs = await extractImagesFromPage(page);
        imageCards.push(...imgs);
      }
      aggregatedText = aggregatedText.replace(/\s+/g, ' ').trim();
      let newCards = splitIntoCards(aggregatedText);
      newCards = newCards.concat(imageCards);
      cards = newCards;
      currentIndex = 0;
      updateLocalStorage();
      landing.classList.add('hidden');
      reader.classList.remove('hidden');
      renderInitialCard();
      updateCounter();
    } catch (err) {
      console.error('Error reading PDF:', err);
      alert('Failed to load PDF file. Please ensure the file is a valid PDF.');
    }
  }

  /*
   * Handle plain text and Markdown files. Reads the file contents as a
   * string, collapses whitespace, splits into cards and updates the
   * reader state accordingly.
   *
   * @param {File} file - The uploaded plain text or Markdown file.
   */
  async function handleTextFile(file) {
    try {
      const text = await file.text();
      let cleaned = text.replace(/\s+/g, ' ').trim();
      cards = splitIntoCards(cleaned);
      currentIndex = 0;
      updateLocalStorage();
      landing.classList.add('hidden');
      reader.classList.remove('hidden');
      renderInitialCard();
      updateCounter();
    } catch (err) {
      console.error('Error reading text file:', err);
      alert('Failed to load text file.');
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
   * Mobile swipe navigation. On touch devices we allow users to swipe
   * vertically to move between cards: swiping up advances to the next
   * card while swiping down goes to the previous card. A small threshold
   * avoids accidental navigation when tapping on the card.
   */
  let touchStartY = null;
  cardContainer.addEventListener('touchstart', event => {
    if (event.touches && event.touches.length === 1) {
      touchStartY = event.touches[0].clientY;
    }
  });
  cardContainer.addEventListener('touchend', event => {
    if (touchStartY === null) return;
    const endY = event.changedTouches[0].clientY;
    const diffY = endY - touchStartY;
    // Require a significant vertical movement to trigger navigation
    if (Math.abs(diffY) > 50) {
      if (diffY < 0) {
        nextCard();
      } else {
        prevCard();
      }
    }
    touchStartY = null;
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