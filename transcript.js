/* === STATE === */
const state = {
  apiKey: localStorage.getItem('claude_api_key') || '',
  transcript: '',
  lastResult: '',
};

/* === ELEMENTS === */
const apiKeyInput    = document.getElementById('apiKeyInput');
const saveApiKeyBtn  = document.getElementById('saveApiKey');
const toggleApiBtn   = document.getElementById('toggleApiKey');
const apiStatus      = document.getElementById('apiStatus');
const transcriptInput= document.getElementById('transcriptInput');
const charCount      = document.getElementById('charCount');
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const browseBtn      = document.getElementById('browseBtn');
const generateBtn    = document.getElementById('generateBtn');
const resultCard     = document.getElementById('resultCard');
const resultContent  = document.getElementById('resultContent');
const resultMeta     = document.getElementById('resultMeta');
const copyBtn        = document.getElementById('copyBtn');
const exportBtn      = document.getElementById('exportBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const clientName     = document.getElementById('clientName');
const interviewDate  = document.getElementById('interviewDate');

/* === INIT === */
interviewDate.value = new Date().toISOString().split('T')[0];

if (state.apiKey) {
  apiKeyInput.value = state.apiKey;
  showApiStatus('success', 'Clé API enregistrée');
}

/* === API KEY === */
saveApiKeyBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key.startsWith('sk-ant-')) {
    showApiStatus('error', 'Clé invalide — elle doit commencer par sk-ant-');
    return;
  }
  state.apiKey = key;
  localStorage.setItem('claude_api_key', key);
  showApiStatus('success', 'Clé enregistrée avec succès');
});

toggleApiBtn.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

function showApiStatus(type, msg) {
  apiStatus.textContent = msg;
  apiStatus.className = 'api-status ' + type;
}

/* === TRANSCRIPT INPUT === */
transcriptInput.addEventListener('input', () => {
  const len = transcriptInput.value.length;
  charCount.textContent = len.toLocaleString('fr') + ' caractères';
  state.transcript = transcriptInput.value;
});

/* === DROP ZONE === */
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  if (!file.name.match(/\.(txt|md)$/i)) {
    alert('Format non supporté. Utilisez .txt ou .md');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    transcriptInput.value = e.target.result;
    transcriptInput.dispatchEvent(new Event('input'));
  };
  reader.readAsText(file);
}

/* === BUILD PROMPT === */
function buildPrompt() {
  const options = [];
  if (document.getElementById('opt-points-cles').checked)  options.push('Points clés');
  if (document.getElementById('opt-problemes').checked)    options.push('Problèmes identifiés');
  if (document.getElementById('opt-citations').checked)    options.push('Citations importantes');
  if (document.getElementById('opt-actions').checked)      options.push('Actions à mener');
  if (document.getElementById('opt-sentiment').checked)    options.push('Analyse du sentiment');
  if (document.getElementById('opt-persona').checked)      options.push('Profil utilisateur / persona');

  const sections = options.map(o => `## ${o}`).join('\n[contenu]\n\n');

  return `Tu es un expert en recherche utilisateur et en analyse d'interviews clients.

Analyse le transcript d'interview ci-dessous et génère un résumé structuré en français.

Pour chaque section demandée, sois concis, factuel et utile. Utilise des listes à puces quand c'est pertinent. Pour les citations, utilise des guillemets et mets-les en blockquote markdown.

Sections à inclure : ${options.join(', ')}

Format de sortie : Markdown structuré avec des titres ## pour chaque section.

---
TRANSCRIPT :

${transcriptInput.value.trim()}
---

Génère maintenant le résumé structuré.`;
}

/* === GENERATE === */
generateBtn.addEventListener('click', async () => {
  if (!state.apiKey) {
    showApiStatus('error', 'Veuillez enregistrer votre clé API d\'abord.');
    document.getElementById('apiKeyInput').focus();
    return;
  }
  if (!transcriptInput.value.trim()) {
    alert('Veuillez coller ou importer un transcript.');
    return;
  }

  showLoading(true);
  generateBtn.disabled = true;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-request-browser': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        messages: [{ role: 'user', content: buildPrompt() }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Erreur ${response.status}`);
    }

    const data = await response.json();
    const markdown = data.content[0].text;
    state.lastResult = markdown;

    displayResult(markdown);
  } catch (err) {
    alert('Erreur : ' + err.message);
  } finally {
    showLoading(false);
    generateBtn.disabled = false;
  }
});

/* === DISPLAY RESULT === */
function displayResult(markdown) {
  const name = clientName.value.trim() || 'Interview';
  const date = interviewDate.value
    ? new Date(interviewDate.value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  resultMeta.textContent = [name, date].filter(Boolean).join(' · ');

  resultContent.innerHTML = markdownToHtml(markdown);
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* === SIMPLE MARKDOWN PARSER === */
function markdownToHtml(md) {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, (m) => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hublp])(.+)$/gm, (m) => m.trim() ? `<p>${m}</p>` : '')
    .replace(/<p><\/p>/g, '');
}

/* === COPY === */
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(state.lastResult).then(() => {
    copyBtn.textContent = 'Copié !';
    setTimeout(() => { copyBtn.textContent = 'Copier'; }, 2000);
  });
});

/* === EXPORT PDF === */
exportBtn.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const name = clientName.value.trim() || 'Interview';
  const date = interviewDate.value
    ? new Date(interviewDate.value).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addText = (text, size, style, color, spacing) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    if (y + lines.length * spacing > 280) { doc.addPage(); y = margin; }
    doc.text(lines, margin, y);
    y += lines.length * spacing;
  };

  /* Header */
  doc.setFillColor(196, 105, 42);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('KarimaAI — Résumé d\'interview', margin, 9);
  y = 24;

  addText(name, 18, 'bold', [26, 20, 16], 8);
  y += 2;
  addText(date, 10, 'normal', [122, 106, 90], 6);
  y += 8;

  doc.setDrawColor(232, 221, 210);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  /* Content */
  const lines = state.lastResult.split('\n');
  for (const line of lines) {
    if (!line.trim()) { y += 3; continue; }
    if (line.startsWith('## ')) {
      y += 4;
      addText(line.replace('## ', ''), 13, 'bold', [196, 105, 42], 7);
      y += 2;
    } else if (line.startsWith('> ')) {
      addText('  ' + line.replace('> ', '« ') + ' »', 10, 'italic', [122, 106, 90], 6);
    } else if (line.match(/^[-•] /)) {
      addText('  →  ' + line.replace(/^[-•] /, ''), 10, 'normal', [26, 20, 16], 6);
    } else {
      addText(line.replace(/\*\*(.+?)\*\*/g, '$1'), 10, 'normal', [26, 20, 16], 6);
    }
  }

  const filename = `resume-${name.toLowerCase().replace(/\s+/g, '-')}-${date.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
});

/* === LOADING === */
function showLoading(show) {
  loadingOverlay.style.display = show ? 'flex' : 'none';
}
