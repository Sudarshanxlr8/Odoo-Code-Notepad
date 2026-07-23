// Webview javascript logic for Odoo Code Notepad Task Editor
const vscode = acquireVsCodeApi();

console.log("Webview scripts starting to load. taskData:", window.taskData);

// State caching
let task = window.taskData || {
  id: '',
  title: 'Error loading task data',
  description: 'Task was not passed correctly or Content Security Policy blocked injection.',
  status: 'Todo',
  tags: [],
  notes: '',
  images: [],
  snippets: []
};
let taskResolved = window.taskResolvedData || task;
const autosaveIntervalMs = window.autosaveInterval || 5000;
let hasChanges = false;
let autosaveTimer = null;

// DOM Elements
const elTitle = document.getElementById('task-title');
const elStatus = document.getElementById('task-status');
const elDesc = document.getElementById('task-desc');
const elNotes = document.getElementById('task-notes');
const elDates = document.getElementById('task-dates');
const elTagsList = document.getElementById('tags-list');
const elInputTag = document.getElementById('input-new-tag');
const elSaveStatus = document.getElementById('save-status');
const elGitBox = document.getElementById('git-box');
const elGitRepo = document.getElementById('git-repo');
const elGitBranch = document.getElementById('git-branch');
const elGitCommit = document.getElementById('git-commit');
const elGitRunbot = document.getElementById('git-runbot');

const elBtnOpenCommit = document.getElementById('btn-open-commit');
const elBtnOpenRunbot = document.getElementById('btn-open-runbot');

const elErrCommit = document.getElementById('err-commit');
const elErrRunbot = document.getElementById('err-runbot');

const elBtnFavorite = document.getElementById('btn-favorite');
const elBtnPdf = document.getElementById('btn-pdf');
const elBtnDelete = document.getElementById('btn-delete');
const elBtnAddImage = document.getElementById('btn-add-image');
const elImageDropZone = document.getElementById('image-drop-zone');
const elImageGrid = document.getElementById('image-preview-grid');
const elSnippetContainer = document.getElementById('snippet-container');
const elSnippetCount = document.getElementById('snippet-count');

// Modal Elements
const elImageModal = document.getElementById('image-modal');
const elModalImg = document.getElementById('modal-img');
const elModalFilename = document.getElementById('modal-filename');
const elModalDimensions = document.getElementById('modal-dimensions');
const elBtnModalClose = document.getElementById('btn-modal-close');
const elModalCloseTimes = document.getElementById('modal-close-times');
const elBtnModalDownload = document.getElementById('btn-modal-download');

// Init function
function init() {
  console.log("Initializing webview. Task ID:", task.id);
  console.log("Task details loaded in Webview:", task);

  // Save state for serialization
  if (task.id) {
    vscode.setState({ id: task.id });
  }

  // Populate Fields
  elTitle.value = task.title || '';
  elStatus.value = task.status || 'Todo';
  elDesc.value = task.description || '';
  elNotes.value = task.notes || '';
  
  // Format Dates
  const createdDate = new Date(task.createdDate).toLocaleDateString();
  const updatedDate = new Date(task.updatedDate).toLocaleDateString();
  elDates.textContent = `Created: ${createdDate} | Updated: ${updatedDate}`;
  
  // Favorite state
  updateFavoriteState(task.favorite);

  // Git Info
  elGitRepo.value = task.repository?.repositoryName || '';
  elGitBranch.value = task.repository?.branch || '';
  elGitCommit.value = task.repository?.commitUrl || '';
  elGitRunbot.value = task.repository?.runbotUrl || '';
  elGitBox.style.display = 'block'; // Always display so users can manually edit!
  
  validateCommit();
  validateRunbot();

  // Draw Dynamic elements
  drawTags();
  drawImages();
  drawSnippets();

  // Setup Event Listeners
  setupListeners();
  
  // Start Autosave Loop
  startAutosave();
}

function updateFavoriteState(isFav) {
  if (isFav) {
    elBtnFavorite.classList.add('active');
    elBtnFavorite.querySelector('.icon-star').textContent = '★';
  } else {
    elBtnFavorite.classList.remove('active');
    elBtnFavorite.querySelector('.icon-star').textContent = '☆';
  }
}

// Safe event listener registration helper
function safeAddListener(element, event, callback, name = 'unknown element') {
  console.log(`Looking for element "${name}":`, element);
  if (element) {
    element.addEventListener(event, callback);
  } else {
    console.error("Missing element:", name);
  }
}

// Setup Event Listeners
function setupListeners() {
  // Track changes to trigger autosave
  const markChanged = () => {
    hasChanges = true;
    elSaveStatus.textContent = 'Unsaved changes';
  };

  safeAddListener(elTitle, 'input', markChanged, 'task-title');
  safeAddListener(elStatus, 'change', markChanged, 'task-status');
  safeAddListener(elDesc, 'input', markChanged, 'task-desc');
  safeAddListener(elNotes, 'input', markChanged, 'task-notes');

  // Repository input changes
  const markGitChanged = () => {
    validateCommit();
    validateRunbot();
    markChanged();
  };
  safeAddListener(elGitRepo, 'input', markGitChanged, 'git-repo');
  safeAddListener(elGitBranch, 'input', markGitChanged, 'git-branch');
  safeAddListener(elGitCommit, 'input', markGitChanged, 'git-commit');
  safeAddListener(elGitRunbot, 'input', markGitChanged, 'git-runbot');

  // External links opening
  safeAddListener(elBtnOpenCommit, 'click', () => {
    const url = elGitCommit.value.trim();
    if (validateUrl(url) && url !== '') {
      vscode.postMessage({ command: 'openExternalUrl', url });
    }
  }, 'btn-open-commit');

  safeAddListener(elBtnOpenRunbot, 'click', () => {
    const url = elGitRunbot.value.trim();
    if (validateUrl(url) && url !== '') {
      vscode.postMessage({ command: 'openExternalUrl', url });
    }
  }, 'btn-open-runbot');

  // Fullscreen modal close listeners
  safeAddListener(elBtnModalClose, 'click', closeImageModal, 'btn-modal-close');
  safeAddListener(elModalCloseTimes, 'click', closeImageModal, 'modal-close-times');
  safeAddListener(elImageModal, 'click', (e) => {
    if (e.target === elImageModal) {
      closeImageModal();
    }
  }, 'image-modal');

  // Window key listener (window is always present)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImageModal();
    }
  });

  // Tabs toggle
  document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
    const tabId = btn.getAttribute('data-tab');
    safeAddListener(btn, 'click', (e) => {
      // Toggle button active state
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle content panel
      document.querySelectorAll('.tab-content').forEach(pane => pane.classList.add('hidden'));
      const contentPane = document.getElementById(tabId);
      if (contentPane) {
        contentPane.classList.remove('hidden');
      }
      
      // Toggle formatting toolbar visibility
      const elTools = document.getElementById('editor-tools');
      if (elTools) {
        if (tabId === 'tab-write') {
          elTools.style.display = 'flex';
        } else {
          elTools.style.display = 'none';
          renderMarkdownPreview();
        }
      }
    }, `tab-btn-${tabId || idx}`);
  });

  // Formatting tools actions (only for buttons with data-format)
  document.querySelectorAll('.tool-btn[data-format]').forEach((btn, idx) => {
    const formatType = btn.getAttribute('data-format');
    safeAddListener(btn, 'click', (e) => {
      applyMarkdownFormatting(formatType);
      markChanged();
    }, `tool-btn-${formatType}`);
  });

  // Emoji Picker toggle and option selection listeners
  const btnEmojiPicker = document.getElementById('btn-emoji-picker');
  const emojiDropdown = document.getElementById('emoji-dropdown');
  if (btnEmojiPicker && emojiDropdown) {
    safeAddListener(btnEmojiPicker, 'click', (e) => {
      e.stopPropagation();
      emojiDropdown.classList.toggle('hidden');
    }, 'btn-emoji-picker');

    // Close dropdown on click outside
    document.addEventListener('click', () => {
      emojiDropdown.classList.add('hidden');
    });

    document.querySelectorAll('.emoji-option').forEach(btn => {
      safeAddListener(btn, 'click', (e) => {
        e.stopPropagation();
        const emoji = btn.getAttribute('data-emoji');
        insertEmoji(emoji);
        emojiDropdown.classList.add('hidden');
        markChanged();
      }, `emoji-option-${btn.getAttribute('data-emoji')}`);
    });
  }

  // Keyboard Shortcuts inside the notes editor
  safeAddListener(elNotes, 'keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyMarkdownFormatting('bold');
      markChanged();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyMarkdownFormatting('italic');
      markChanged();
    } else if (e.ctrlKey && e.shiftKey && (e.key === '8' || e.key === '*')) {
      e.preventDefault();
      applyMarkdownFormatting('bullet-list');
      markChanged();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabIndent(e.shiftKey);
      markChanged();
    }
  }, 'task-notes');

  // Action Buttons
  safeAddListener(elBtnFavorite, 'click', () => {
    vscode.postMessage({ command: 'toggleFavorite' });
  }, 'btn-favorite');

  safeAddListener(elBtnPdf, 'click', () => {
    vscode.postMessage({ command: 'exportPdf' });
  }, 'btn-pdf');

  safeAddListener(elBtnDelete, 'click', () => {
    vscode.postMessage({ command: 'deleteTask' });
  }, 'btn-delete');

  safeAddListener(elBtnAddImage, 'click', () => {
    vscode.postMessage({ command: 'uploadImage' });
  }, 'btn-add-image');

  // Tag Adding
  safeAddListener(elInputTag, 'keydown', (e) => {
    if (e.key === 'Enter') {
      const tagText = elInputTag.value.trim();
      if (tagText && !task.tags.includes(tagText)) {
        task.tags.push(tagText);
        elInputTag.value = '';
        drawTags();
        markChanged();
      }
    }
  }, 'input-new-tag');

  // Image Paste Listener (Global)
  document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          elSaveStatus.textContent = 'Saving image...';
          vscode.postMessage({
            command: 'pasteImage',
            base64Data: event.target.result,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      }
    }
  });

  // Image Drag and Drop
  safeAddListener(elImageDropZone, 'dragover', (e) => {
    e.preventDefault();
    elImageDropZone.classList.add('dragover');
  }, 'image-drop-zone');

  safeAddListener(elImageDropZone, 'dragleave', () => {
    elImageDropZone.classList.remove('dragover');
  }, 'image-drop-zone');

  safeAddListener(elImageDropZone, 'drop', (e) => {
    e.preventDefault();
    elImageDropZone.classList.remove('dragover');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.indexOf('image') === 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
          elSaveStatus.textContent = 'Saving image...';
          vscode.postMessage({
            command: 'pasteImage',
            base64Data: event.target.result,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      }
    }
  }, 'image-drop-zone');

  // Listen to messages from the Extension
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'updateImages':
        task.images = message.images;
        taskResolved.images = message.resolvedImages;
        drawImages();
        break;
      case 'updateSnippets':
        task.snippets = message.snippets;
        drawSnippets();
        break;
      case 'updateFavorite':
        updateFavoriteState(message.favorite);
        break;
    }
  });

}

// Safe tab indent/outdent helper
function handleTabIndent(isOutdent) {
  const textarea = elNotes;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const savedScrollTop = textarea.scrollTop;
  
  const beforeText = text.substring(0, start);
  const selectedText = text.substring(start, end);
  const afterText = text.substring(end);
  
  const startLineIndex = beforeText.lastIndexOf('\n') + 1;
  const endLineIndex = end + (afterText.indexOf('\n') === -1 ? afterText.length : afterText.indexOf('\n'));
  
  const affectedText = text.substring(startLineIndex, endLineIndex);
  const lines = affectedText.split('\n');
  
  let newAffectedText = '';
  let shiftCount = 0;
  
  if (start !== end && lines.length > 1) {
    newAffectedText = lines.map(line => {
      if (isOutdent) {
        if (line.startsWith('    ')) {
          shiftCount -= 4;
          return line.substring(4);
        } else if (line.startsWith('\t')) {
          shiftCount -= 1;
          return line.substring(1);
        }
        const spaceCount = line.match(/^ */)[0].length;
        if (spaceCount > 0) {
          const toRemove = Math.min(spaceCount, 4);
          shiftCount -= toRemove;
          return line.substring(toRemove);
        }
        return line;
      } else {
        shiftCount += 4;
        return '    ' + line;
      }
    }).join('\n');
    
    textarea.value = text.substring(0, startLineIndex) + newAffectedText + text.substring(endLineIndex);
    textarea.setSelectionRange(start + (isOutdent ? Math.max(shiftCount, -4) : 4), end + shiftCount);
  } else {
    if (isOutdent) {
      const lineStart = beforeText.lastIndexOf('\n') + 1;
      const currentLine = text.substring(lineStart, start);
      if (currentLine.startsWith('    ')) {
        textarea.value = text.substring(0, lineStart) + currentLine.substring(4) + text.substring(start);
        textarea.setSelectionRange(start - 4, start - 4);
      } else if (currentLine.startsWith('\t')) {
        textarea.value = text.substring(0, lineStart) + currentLine.substring(1) + text.substring(start);
        textarea.setSelectionRange(start - 1, start - 1);
      } else {
        const spaceCount = currentLine.match(/^ */)[0].length;
        if (spaceCount > 0) {
          const toRemove = Math.min(spaceCount, 4);
          textarea.value = text.substring(0, lineStart) + currentLine.substring(toRemove) + text.substring(start);
          textarea.setSelectionRange(start - toRemove, start - toRemove);
        }
      }
    } else {
      textarea.value = beforeText + '    ' + afterText;
      textarea.setSelectionRange(start + 4, start + 4);
    }
  }
  
  textarea.scrollTop = savedScrollTop;
}

// Emoji insertion helper
function insertEmoji(emoji) {
  const textarea = elNotes;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const savedScrollTop = textarea.scrollTop;
  
  textarea.value = text.substring(0, start) + emoji + text.substring(end);
  const newPos = start + emoji.length;
  textarea.focus();
  textarea.setSelectionRange(newPos, newPos);
  textarea.scrollTop = savedScrollTop;
}

// Markdown formatting helper
function applyMarkdownFormatting(type) {
  const textarea = elNotes;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);
  const savedScrollTop = textarea.scrollTop;
  
  let prefix = '';
  let suffix = '';
  let cursorOffset = 0;
  let linePrefix = '';
  
  switch (type) {
    case 'bold':
      prefix = '**';
      suffix = '**';
      cursorOffset = selectedText ? 0 : 2;
      break;
    case 'italic':
      prefix = '*';
      suffix = '*';
      cursorOffset = selectedText ? 0 : 1;
      break;
    case 'strikethrough':
      prefix = '~~';
      suffix = '~~';
      cursorOffset = selectedText ? 0 : 2;
      break;
    case 'inline-code':
      prefix = '`';
      suffix = '`';
      cursorOffset = selectedText ? 0 : 1;
      break;
    case 'highlight':
      prefix = '<mark>';
      suffix = '</mark>';
      cursorOffset = selectedText ? 0 : 7;
      break;
    case 'h1':
      linePrefix = '# ';
      break;
    case 'h2':
      linePrefix = '## ';
      break;
    case 'h3':
      linePrefix = '### ';
      break;
    case 'bullet-list':
      linePrefix = '* ';
      break;
    case 'task-list':
      linePrefix = '- [ ] ';
      break;
    case 'quote':
      linePrefix = '> ';
      break;
    case 'link':
      prefix = '[';
      suffix = '](http://)';
      cursorOffset = selectedText ? 9 : 1;
      break;
    case 'code-block':
      prefix = '\n```python\n';
      suffix = '\n```\n';
      cursorOffset = selectedText ? 0 : 5;
      break;
    case 'table':
      prefix = '\n| Column 1 | Column 2 |\n| -------- | -------- |\n| ';
      suffix = ' |          |\n';
      cursorOffset = selectedText ? 0 : 12;
      break;
    case 'hr':
      prefix = '\n---\n';
      break;
  }

  if (linePrefix) {
    // Line-based formatting
    const beforeText = text.substring(0, start);
    const lineStart = beforeText.lastIndexOf('\n') + 1;
    const currentLine = text.substring(lineStart, start);
    
    // Check if line prefix is already present, if so, toggle it off
    if (currentLine.startsWith(linePrefix)) {
      textarea.value = text.substring(0, lineStart) + currentLine.substring(linePrefix.length) + text.substring(start);
      textarea.focus();
      textarea.setSelectionRange(start - linePrefix.length, end - linePrefix.length);
    } else {
      // Toggle off other headings if inserting h1/h2/h3
      let cleanLine = currentLine;
      let removedLength = 0;
      if (type === 'h1' || type === 'h2' || type === 'h3') {
        const headingMatch = currentLine.match(/^(#{1,3}\s+)/);
        if (headingMatch) {
          cleanLine = currentLine.substring(headingMatch[0].length);
          removedLength = headingMatch[0].length;
        }
      }
      
      textarea.value = text.substring(0, lineStart) + linePrefix + cleanLine + text.substring(start);
      textarea.focus();
      textarea.setSelectionRange(start + linePrefix.length - removedLength, end + linePrefix.length - removedLength);
    }
  } else {
    // Inline / Block formatting
    const formatted = prefix + (selectedText || '') + suffix;
    textarea.value = text.substring(0, start) + formatted + text.substring(end);
    textarea.focus();
    
    if (selectedText) {
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    } else {
      const newCursorPos = start + formatted.length - cursorOffset;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }
  }
  
  textarea.scrollTop = savedScrollTop;
}

// Render Markdown notes preview
function renderMarkdownPreview() {
  const notesText = elNotes.value;
  const previewDiv = document.getElementById('notes-preview');
  
  try {
    let m = null;
    if (typeof marked !== 'undefined') {
      m = marked;
    } else if (typeof window !== 'undefined' && typeof window.marked !== 'undefined') {
      m = window.marked;
    } else if (typeof exports !== 'undefined' && typeof exports.parse === 'function') {
      m = exports;
    }
    
    if (m) {
      if (typeof m.use === 'function') {
        m.use({ gfm: true, breaks: true });
      } else if (typeof m.setOptions === 'function') {
        m.setOptions({ gfm: true, breaks: true });
      }
      
      const parseFn = typeof m.parse === 'function' ? m.parse : (typeof m === 'function' ? m : null);
      if (parseFn) {
        previewDiv.innerHTML = parseFn(notesText || '*No notes recorded. Write some notes in the Write tab!*');
      } else {
        previewDiv.innerHTML = notesText || '';
      }
    } else {
      previewDiv.innerHTML = notesText || '';
    }
    
    // Trigger Prism Highlight
    if (typeof Prism !== 'undefined' && Prism.highlightAllUnder) {
      Prism.highlightAllUnder(previewDiv);
    }
  } catch (e) {
    previewDiv.innerHTML = `<span style="color:#d32f2f">Error parsing markdown: ${e}</span>`;
  }
}

// Draw Tag Pills
function drawTags() {
  elTagsList.innerHTML = '';
  task.tags.forEach(tag => {
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.textContent = tag;
    
    const removeBtn = document.createElement('span');
    removeBtn.className = 'btn-tag-remove';
    removeBtn.innerHTML = ' &times;';
    removeBtn.addEventListener('click', () => {
      task.tags = task.tags.filter(t => t !== tag);
      drawTags();
      hasChanges = true;
      elSaveStatus.textContent = 'Unsaved changes';
    });
    
    pill.appendChild(removeBtn);
    elTagsList.appendChild(pill);
  });
}

// Draw Images Grid
function drawImages() {
  elImageGrid.innerHTML = '';
  
  const imagesToDraw = taskResolved.images || [];
  
  imagesToDraw.forEach((resolvedPath, index) => {
    const imgRelPath = task.images[index]; // Send back the actual relative path when deleting
    
    const card = document.createElement('div');
    card.className = 'image-card';
    
    const img = document.createElement('img');
    img.src = resolvedPath;
    img.loading = 'lazy';
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-img-delete';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Delete image';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent zoom trigger
      vscode.postMessage({ command: 'deleteImage', imagePath: imgRelPath });
    });

    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'btn-img-zoom';
    zoomBtn.innerHTML = '🔍';
    zoomBtn.title = 'View Fullscreen';
    zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openImageModal(resolvedPath, imgRelPath);
    });
    
    card.appendChild(img);
    card.appendChild(zoomBtn);
    card.appendChild(delBtn);
    elImageGrid.appendChild(card);
  });
}

// Draw Snippet Cards
function drawSnippets() {
  elSnippetContainer.innerHTML = '';
  
  const snippets = task.snippets || [];
  elSnippetCount.textContent = `${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`;

  snippets.forEach(snip => {
    const card = document.createElement('div');
    card.className = 'snippet-card';

    // Header
    const header = document.createElement('div');
    header.className = 'snippet-card-header';
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'snippet-title-input';
    titleInput.value = snip.title || 'Untitled Snippet';
    titleInput.addEventListener('change', (e) => {
      const newTitle = e.target.value;
      vscode.postMessage({
        command: 'updateSnippet',
        snippetId: snip.id,
        title: newTitle,
        description: snip.description
      });
    });

    const langPill = document.createElement('span');
    langPill.className = 'snippet-lang-pill';
    langPill.textContent = snip.language || 'text';

    header.appendChild(titleInput);
    header.appendChild(langPill);
    card.appendChild(header);

    // Description Input
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'snippet-desc-input';
    descInput.placeholder = 'Add snippet description...';
    descInput.value = snip.description || '';
    descInput.addEventListener('change', (e) => {
      const newDesc = e.target.value;
      vscode.postMessage({
        command: 'updateSnippet',
        snippetId: snip.id,
        title: snip.title,
        description: newDesc
      });
    });
    card.appendChild(descInput);

    // Details info
    const details = document.createElement('div');
    details.className = 'snippet-details';
    
    const fileLabel = document.createElement('span');
    fileLabel.textContent = `File: ${snip.file}`;
    
    const linesLabel = document.createElement('span');
    linesLabel.textContent = `Lines: ${snip.startLine} - ${snip.endLine}`;

    details.appendChild(fileLabel);
    details.appendChild(linesLabel);
    card.appendChild(details);

    // Code container with syntax highlighting
    const codeContainer = document.createElement('div');
    codeContainer.className = 'snippet-code-container';
    
    const pre = document.createElement('pre');
    pre.className = `language-${snip.language || 'text'}`;
    
    const code = document.createElement('code');
    code.className = `language-${snip.language || 'text'}`;
    code.textContent = snip.selectedCode;
    
    pre.appendChild(code);
    codeContainer.appendChild(pre);
    card.appendChild(codeContainer);

    // Action Buttons
    const actions = document.createElement('div');
    actions.className = 'snippet-card-actions';

    const btnOpen = document.createElement('button');
    btnOpen.className = 'btn-open-snippet';
    btnOpen.textContent = 'Jump to Code';
    btnOpen.addEventListener('click', () => {
      vscode.postMessage({ command: 'jumpToCode', snippet: snip });
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete-snippet';
    btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', () => {
      vscode.postMessage({ command: 'deleteSnippet', snippetId: snip.id });
    });

    actions.appendChild(btnOpen);
    actions.appendChild(btnDelete);
    card.appendChild(actions);

    elSnippetContainer.appendChild(card);
  });
  
  // Highlight newly injected code snippets using Prism
  Prism.highlightAllUnder(elSnippetContainer);
}

// Autosave Timer
function startAutosave() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
  }
  
  autosaveTimer = setInterval(() => {
    if (hasChanges) {
      saveData();
    }
  }, autosaveIntervalMs);
}

// URL validation helpers
function validateUrl(url) {
  if (!url || url.trim() === '') {
    return true; // Empty value is valid (optional field)
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateCommit() {
  const url = elGitCommit.value.trim();
  const isValid = validateUrl(url);
  if (isValid) {
    elErrCommit.style.display = 'none';
    elErrCommit.textContent = '';
    elBtnOpenCommit.disabled = url === '';
  } else {
    elErrCommit.style.display = 'block';
    elErrCommit.textContent = 'Must be a valid http/https URL';
    elBtnOpenCommit.disabled = true;
  }
  return isValid;
}

function validateRunbot() {
  const url = elGitRunbot.value.trim();
  const isValid = validateUrl(url);
  if (isValid) {
    elErrRunbot.style.display = 'none';
    elErrRunbot.textContent = '';
    elBtnOpenRunbot.disabled = url === '';
  } else {
    elErrRunbot.style.display = 'block';
    elErrRunbot.textContent = 'Must be a valid http/https URL';
    elBtnOpenRunbot.disabled = true;
  }
  return isValid;
}

// Fullscreen Modal Helpers
function openImageModal(imgSrc, imgRelPath) {
  elModalImg.src = imgSrc;
  const filename = imgRelPath.split('/').pop() || 'image';
  elModalFilename.textContent = filename;
  
  elModalImg.onload = () => {
    elModalDimensions.textContent = `${elModalImg.naturalWidth} x ${elModalImg.naturalHeight} pixels`;
  };
  elModalImg.onerror = () => {
    elModalDimensions.textContent = 'Error loading image details';
  };

  elBtnModalDownload.onclick = () => {
    vscode.postMessage({ command: 'downloadImage', imagePath: imgRelPath });
  };

  elImageModal.classList.remove('hidden');
}

function closeImageModal() {
  elImageModal.classList.add('hidden');
  elModalImg.src = '';
  elModalFilename.textContent = '';
  elModalDimensions.textContent = '';
}

function saveData() {
  hasChanges = false;
  elSaveStatus.textContent = 'Saving...';
  
  const updatedTask = {
    title: elTitle.value.trim() || 'Untitled Task',
    status: elStatus.value,
    description: elDesc.value.trim(),
    notes: elNotes.value,
    tags: task.tags,
    repository: {
      repositoryName: elGitRepo.value.trim(),
      branch: elGitBranch.value.trim(),
      commitUrl: elGitCommit.value.trim(),
      runbotUrl: elGitRunbot.value.trim()
    }
  };

  console.log("Save operation started in Webview for task:", task.id, updatedTask);

  vscode.postMessage({
    command: 'saveTask',
    task: updatedTask
  });
  
  // Mock immediate visually saved response
  setTimeout(() => {
    if (!hasChanges) {
      elSaveStatus.textContent = 'Saved';
      console.log("Save operation completed in Webview for task:", task.id);
      
      // Update dates label
      const now = new Date().toLocaleDateString();
      const createdDate = new Date(task.createdDate).toLocaleDateString();
      elDates.textContent = `Created: ${createdDate} | Updated: ${now}`;
    }
  }, 400);
}



// Run Initializer
init();
