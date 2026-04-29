const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const conversionSection = document.getElementById('conversionSection');
const progressSection = document.getElementById('progressSection');
const completeSection = document.getElementById('completeSection');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const fileIconEl = document.getElementById('fileIcon');
const removeBtn = document.getElementById('removeBtn');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const convertAgainBtn = document.getElementById('convertAgainBtn');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');
const formatOptionsEl = document.querySelector('.format-options');
const metadataEditorEl = document.getElementById('metadataEditor');
const metaInputs = {
    title: document.getElementById('metaTitle'),
    creator: document.getElementById('metaCreator'),
    language: document.getElementById('metaLanguage'),
    publisher: document.getElementById('metaPublisher'),
    description: document.getElementById('metaDescription'),
    identifier: document.getElementById('metaIdentifier'),
};

const resourcesSectionEl = document.getElementById('resourcesSection');
const extraImagesRowEl = document.getElementById('extraImagesRow');
const coverInputEl = document.getElementById('coverInput');
const coverBtnEl = document.getElementById('coverBtn');
const coverInfoEl = document.getElementById('coverInfo');
const coverClearEl = document.getElementById('coverClear');
const extraImagesInputEl = document.getElementById('extraImagesInput');
const extraImagesBtnEl = document.getElementById('extraImagesBtn');
const extraImagesInfoEl = document.getElementById('extraImagesInfo');
const extraImagesClearEl = document.getElementById('extraImagesClear');

const EXTENSION_ALIASES = {
    htm: 'html',
    markdown: 'md',
};

const SUPPORTED_INPUTS = ['txt', 'epub', 'html', 'md'];
const TARGETS_BY_INPUT = {
    txt: ['epub', 'html'],
    epub: ['epub', 'txt', 'html'],
    html: ['epub', 'txt'],
    md: ['epub', 'html'],
};

const FORMAT_LABELS = {
    epub: 'EPUB',
    txt: 'TXT',
    html: 'HTML',
    md: 'Markdown',
};

const FORMAT_ICONS = {
    epub: '📖',
    txt: '📄',
    html: '🌐',
    md: '📝',
};

const HISTORY_KEY = 'ebookHistory';
const HISTORY_LIMIT = 10;

let currentFile = null;
let currentSourceFormat = '';
let currentEpubMeta = null;
let selectedCover = null;
let selectedExtraImages = [];
let convertedBlob = null;
let convertedName = '';
let conversionHistory = readHistory();

updateHistoryDisplay();

function readHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getFileExtension(filename) {
    const idx = filename.lastIndexOf('.');
    if (idx < 0) return '';
    const ext = filename.slice(idx + 1).toLowerCase();
    return EXTENSION_ALIASES[ext] || ext;
}

function getBaseName(filename) {
    const idx = filename.lastIndexOf('.');
    return idx > 0 ? filename.slice(0, idx) : filename;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[ch]));
}

function escapeXml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
    }[ch]));
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateUuid() {
    if (crypto && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

async function handleFile(file) {
    const extension = getFileExtension(file.name);

    if (!SUPPORTED_INPUTS.includes(extension)) {
        alert('当前仅支持 TXT、Markdown、HTML、EPUB 文件，其他格式将在后续版本逐步支持。');
        return;
    }

    currentFile = file;
    currentSourceFormat = extension;
    currentEpubMeta = null;
    clearResourceSelections();

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatFileSize(file.size);
    fileIconEl.textContent = FORMAT_ICONS[extension] || '📄';

    renderFormatOptions(extension);
    updateMetadataEditorVisibility();

    uploadSection.classList.add('hidden');
    conversionSection.classList.remove('hidden');
    fileInput.value = '';

    if (extension === 'epub') {
        try {
            const meta = await readEpubMetadata(file);
            currentEpubMeta = meta;
            prefillMetadataForm(meta);
        } catch (err) {
            console.warn('读取 EPUB 元数据失败：', err);
        }
    }
}

function renderFormatOptions(inputExt) {
    const targets = TARGETS_BY_INPUT[inputExt] || [];
    formatOptionsEl.innerHTML = targets
        .map((fmt, i) => {
            const label =
                inputExt === 'epub' && fmt === 'epub' ? 'EPUB（修改元数据）' : FORMAT_LABELS[fmt];
            return `
        <label class="format-option">
            <input type="radio" name="format" value="${fmt}"${i === 0 ? ' checked' : ''}>
            <span>${label}</span>
        </label>`;
        })
        .join('');

    formatOptionsEl.querySelectorAll('input[name="format"]').forEach((input) => {
        input.addEventListener('change', updateMetadataEditorVisibility);
    });
}

function updateMetadataEditorVisibility() {
    const target = document.querySelector('input[name="format"]:checked')?.value;
    const shouldShowMeta = currentSourceFormat === 'epub' && target === 'epub';
    metadataEditorEl.classList.toggle('hidden', !shouldShowMeta);

    const shouldShowResources = target === 'epub' && currentSourceFormat !== '';
    resourcesSectionEl.classList.toggle('hidden', !shouldShowResources);

    const shouldShowExtraImages = shouldShowResources && (currentSourceFormat === 'html' || currentSourceFormat === 'md');
    extraImagesRowEl.classList.toggle('hidden', !shouldShowExtraImages);
}

coverBtnEl.addEventListener('click', () => coverInputEl.click());
coverInputEl.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectedCover = file;
    coverInfoEl.textContent = `${file.name} (${formatFileSize(file.size)})`;
    coverClearEl.classList.remove('hidden');
});
coverClearEl.addEventListener('click', () => {
    selectedCover = null;
    coverInputEl.value = '';
    coverInfoEl.textContent = '未选择（可选）';
    coverClearEl.classList.add('hidden');
});

extraImagesBtnEl.addEventListener('click', () => extraImagesInputEl.click());
extraImagesInputEl.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    selectedExtraImages = files;
    extraImagesInfoEl.textContent = `已选 ${files.length} 张图片`;
    extraImagesClearEl.classList.remove('hidden');
});
extraImagesClearEl.addEventListener('click', () => {
    selectedExtraImages = [];
    extraImagesInputEl.value = '';
    extraImagesInfoEl.textContent = '未选择（可选）';
    extraImagesClearEl.classList.add('hidden');
});

function clearResourceSelections() {
    selectedCover = null;
    selectedExtraImages = [];
    coverInputEl.value = '';
    extraImagesInputEl.value = '';
    coverInfoEl.textContent = '未选择（可选）';
    extraImagesInfoEl.textContent = '未选择（可选）';
    coverClearEl.classList.add('hidden');
    extraImagesClearEl.classList.add('hidden');
}

function prefillMetadataForm(meta) {
    metaInputs.title.value = meta.title || '';
    metaInputs.creator.value = meta.creator || '';
    metaInputs.language.value = meta.language || '';
    metaInputs.publisher.value = meta.publisher || '';
    metaInputs.description.value = meta.description || '';
    metaInputs.identifier.value = meta.identifier || '';
}

function collectMetadataFromForm() {
    return {
        title: metaInputs.title.value.trim(),
        creator: metaInputs.creator.value.trim(),
        language: metaInputs.language.value.trim(),
        publisher: metaInputs.publisher.value.trim(),
        description: metaInputs.description.value.trim(),
        identifier: metaInputs.identifier.value.trim(),
    };
}

removeBtn.addEventListener('click', resetToUpload);

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const targetFormat = document.querySelector('input[name="format"]:checked')?.value;
    if (!targetFormat) return;

    const sourceFormat = currentSourceFormat;

    conversionSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    setProgress(0, '准备文件...');

    try {
        const result = await convertFile(currentFile, sourceFormat, targetFormat, setProgress);
        convertedBlob = result.blob;
        convertedName = `${getBaseName(currentFile.name)}.${targetFormat}`;

        await delay(200);
        progressSection.classList.add('hidden');
        completeSection.classList.remove('hidden');

        addToHistory(currentFile.name, sourceFormat, targetFormat, convertedName);
    } catch (err) {
        console.error(err);
        progressSection.classList.add('hidden');
        conversionSection.classList.remove('hidden');
        alert('转换失败：' + (err && err.message ? err.message : err));
    }
});

function setProgress(percent, status) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    progressBar.style.width = p + '%';
    progressPercent.textContent = p;
    if (status) progressStatus.textContent = status;
}

downloadBtn.addEventListener('click', () => {
    if (!convertedBlob || !convertedName) return;
    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = convertedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

convertAgainBtn.addEventListener('click', resetToUpload);

function resetToUpload() {
    currentFile = null;
    currentSourceFormat = '';
    currentEpubMeta = null;
    convertedBlob = null;
    convertedName = '';
    metadataEditorEl.classList.add('hidden');
    resourcesSectionEl.classList.add('hidden');
    Object.values(metaInputs).forEach((el) => {
        if (el) el.value = '';
    });
    clearResourceSelections();
    uploadSection.classList.remove('hidden');
    conversionSection.classList.add('hidden');
    progressSection.classList.add('hidden');
    completeSection.classList.add('hidden');
    setProgress(0, '正在处理...');
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!progressSection.classList.contains('hidden')) return;
    resetToUpload();
});

async function convertFile(file, source, target, onProgress) {
    const extras = {
        cover: selectedCover,
        extraImages: selectedExtraImages,
    };

    if (source === 'txt' && target === 'epub') return txtToEpub(file, extras, onProgress);
    if (source === 'txt' && target === 'html') return txtToHtml(file, onProgress);

    if (source === 'html' && target === 'epub') return htmlFileToEpub(file, extras, onProgress);
    if (source === 'html' && target === 'txt') return htmlFileToText(file, onProgress);

    if (source === 'md' && target === 'epub') return markdownToEpub(file, extras, onProgress);
    if (source === 'md' && target === 'html') return markdownToHtml(file, onProgress);

    if (source === 'epub' && target === 'txt') return epubToText(file, onProgress);
    if (source === 'epub' && target === 'html') return epubToHtml(file, onProgress);
    if (source === 'epub' && target === 'epub') {
        return editEpubFile(file, collectMetadataFromForm(), extras, onProgress);
    }

    throw new Error(`暂不支持 ${source.toUpperCase()} → ${target.toUpperCase()}`);
}

async function readFileAsText(file) {
    const buf = await file.arrayBuffer();
    try {
        return new TextDecoder('utf-8', { fatal: false }).decode(buf);
    } catch {
        return new TextDecoder().decode(buf);
    }
}

const CHAPTER_REGEX = /^(?:\s*)(?:第[一二三四五六七八九十百千零〇\d]+[章回卷节篇].*|chapter\s+\d+.*|prologue|epilogue)\s*$/i;

function splitIntoChapters(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const chapters = [];
    let current = { title: '正文', lines: [] };

    for (const line of lines) {
        if (CHAPTER_REGEX.test(line)) {
            const hasContent = current.lines.some((l) => l.trim() !== '');
            if (hasContent) chapters.push(current);
            current = { title: line.trim(), lines: [] };
        } else {
            current.lines.push(line);
        }
    }
    if (current.lines.some((l) => l.trim() !== '') || chapters.length === 0) {
        chapters.push(current);
    }
    return chapters;
}

function paragraphsHtml(lines) {
    const paragraphs = [];
    let buffer = [];
    for (const line of lines) {
        if (line.trim() === '') {
            if (buffer.length) {
                paragraphs.push(buffer.join(' '));
                buffer = [];
            }
        } else {
            buffer.push(line.trim());
        }
    }
    if (buffer.length) paragraphs.push(buffer.join(' '));
    return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
}

function ensureJSZip() {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip 未加载，请检查网络后重试');
    }
}

function ensureMarked() {
    if (typeof marked === 'undefined') {
        throw new Error('Markdown 解析器未加载，请检查网络后重试');
    }
}

const MIME_TO_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
};

const EXT_TO_MIME = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
};

function mimeTypeToExt(mime) {
    if (!mime) return 'bin';
    return MIME_TO_EXT[mime.toLowerCase()] || 'bin';
}

function extToMime(ext) {
    return EXT_TO_MIME[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

function base64ToUint8(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function fileToImageEntry(file, baseName) {
    const data = new Uint8Array(await file.arrayBuffer());
    let ext = mimeTypeToExt(file.type);
    if (ext === 'bin') {
        const fromName = (file.name.split('.').pop() || '').toLowerCase();
        if (EXT_TO_MIME[fromName]) ext = fromName;
    }
    const mimeType = file.type || extToMime(ext);
    return {
        filename: `${baseName}.${ext === 'bin' ? 'png' : ext}`,
        mimeType,
        data,
    };
}

function extractDataUriImages(doc) {
    const images = [];
    let counter = 0;
    doc.querySelectorAll('img[src^="data:"]').forEach((img) => {
        const src = img.getAttribute('src') || '';
        const match = src.match(/^data:([^;,]+)(?:;([^,]*))?,(.*)$/);
        if (!match) return;
        const mimeType = match[1];
        const meta = match[2] || '';
        const payload = match[3] || '';
        let bytes;
        try {
            if (/base64/i.test(meta)) {
                bytes = base64ToUint8(payload);
            } else {
                const decoded = decodeURIComponent(payload);
                bytes = new TextEncoder().encode(decoded);
            }
        } catch (err) {
            console.warn('解析 data URI 失败：', err);
            return;
        }
        const ext = mimeTypeToExt(mimeType);
        const filename = `inline-${++counter}.${ext === 'bin' ? 'png' : ext}`;
        images.push({ filename, mimeType: mimeType || extToMime(ext), data: bytes });
        img.setAttribute('src', `images/${filename}`);
    });
    return images;
}

function buildExtraImagesMap(files) {
    const map = new Map();
    if (!files || files.length === 0) return map;
    for (const file of files) {
        const name = file.name;
        if (!name) continue;
        map.set(name, file);
        map.set(name.toLowerCase(), file);
        const idx = name.lastIndexOf('/');
        if (idx >= 0) {
            const base = name.slice(idx + 1);
            map.set(base, file);
            map.set(base.toLowerCase(), file);
        }
    }
    return map;
}

async function embedReferencedImages(doc, extraMap, images) {
    if (!extraMap || extraMap.size === 0) return;
    const used = new Map();
    let counter = images.length;

    const imgs = Array.from(doc.querySelectorAll('img'));
    for (const img of imgs) {
        const src = img.getAttribute('src') || '';
        if (!src) continue;
        if (/^(?:data:|https?:|blob:|file:)/i.test(src)) continue;
        if (src.startsWith('images/')) continue;

        const cleaned = src.replace(/[?#].*$/, '');
        const candidate = cleaned.split('/').pop();
        if (!candidate) continue;

        const file =
            extraMap.get(cleaned) ||
            extraMap.get(cleaned.toLowerCase()) ||
            extraMap.get(candidate) ||
            extraMap.get(candidate.toLowerCase());
        if (!file) {
            img.setAttribute('alt', img.getAttribute('alt') || '图片缺失');
            continue;
        }

        let entry = used.get(file);
        if (!entry) {
            counter += 1;
            entry = await fileToImageEntry(file, `image-${counter}`);
            images.push(entry);
            used.set(file, entry);
        }
        img.setAttribute('src', `images/${entry.filename}`);
    }
}

async function txtToEpub(file, extras, onProgress) {
    onProgress(10, '读取文本...');
    const text = await readFileAsText(file);

    onProgress(25, '识别章节...');
    const chapters = splitIntoChapters(text).map((ch, i) => ({
        title: ch.title || `第 ${i + 1} 章`,
        body: paragraphsHtml(ch.lines),
    }));

    const cover = extras?.cover ? await fileToImageEntry(extras.cover, 'cover') : null;

    return buildEpubFromChapters(
        chapters,
        { title: getBaseName(file.name), language: 'zh-CN' },
        { cover },
        onProgress,
    );
}

async function txtToHtml(file, onProgress) {
    onProgress(20, '读取文本...');
    const text = await readFileAsText(file);
    const title = getBaseName(file.name);

    onProgress(60, '生成 HTML...');
    const chapters = splitIntoChapters(text);
    const body = chapters
        .map(
            (ch, i) =>
                `<section>\n<h2>${escapeHtml(ch.title || `第 ${i + 1} 章`)}</h2>\n${paragraphsHtml(ch.lines)}\n</section>`,
        )
        .join('\n');

    const html = wrapStandaloneHtml(title, `<h1>${escapeHtml(title)}</h1>\n${body}`);
    onProgress(100, '完成');
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }) };
}

async function htmlFileToEpub(file, extras, onProgress) {
    onProgress(10, '读取 HTML...');
    const html = await readFileAsText(file);
    onProgress(25, '解析 HTML...');
    const { title, chapters, images } = await parseHtmlForEpub(
        html,
        file.name,
        undefined,
        extras?.extraImages,
    );

    const cover = extras?.cover ? await fileToImageEntry(extras.cover, 'cover') : null;

    return buildEpubFromChapters(
        chapters,
        { title, language: 'zh-CN' },
        { images, cover },
        onProgress,
    );
}

async function htmlFileToText(file, onProgress) {
    onProgress(20, '读取 HTML...');
    const html = await readFileAsText(file);
    onProgress(60, '提取文本...');

    const text = extractTextFromXhtml(html);
    onProgress(100, '完成');
    return { blob: new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' }) };
}

async function markdownToHtml(file, onProgress) {
    ensureMarked();
    onProgress(20, '读取 Markdown...');
    const md = await readFileAsText(file);
    onProgress(50, '转换 Markdown...');
    const inner = marked.parse(md);

    const title = extractMarkdownTitle(md) || getBaseName(file.name);
    const html = wrapStandaloneHtml(title, inner);
    onProgress(100, '完成');
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }) };
}

async function markdownToEpub(file, extras, onProgress) {
    ensureMarked();
    onProgress(10, '读取 Markdown...');
    const md = await readFileAsText(file);
    onProgress(25, '解析 Markdown...');
    const html = marked.parse(md);

    const fallbackTitle = extractMarkdownTitle(md) || getBaseName(file.name);
    const fakeHtml = `<!doctype html><html><head><title>${escapeHtml(fallbackTitle)}</title></head><body>${html}</body></html>`;
    const { title, chapters, images } = await parseHtmlForEpub(
        fakeHtml,
        file.name,
        fallbackTitle,
        extras?.extraImages,
    );

    const cover = extras?.cover ? await fileToImageEntry(extras.cover, 'cover') : null;

    return buildEpubFromChapters(
        chapters,
        { title, language: 'zh-CN' },
        { images, cover },
        onProgress,
    );
}

function extractMarkdownTitle(md) {
    const match = md.match(/^\s*#\s+(.+?)\s*$/m);
    return match ? match[1].trim() : '';
}

function wrapStandaloneHtml(title, innerHtml) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
body { max-width: 760px; margin: 2em auto; padding: 0 1em; font-family: -apple-system, "PingFang SC", sans-serif; line-height: 1.7; color: #1f2937; }
h1 { font-size: 1.6em; margin: 1.2em 0 0.6em; }
h2 { font-size: 1.3em; margin: 1em 0 0.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
h3 { font-size: 1.1em; margin: 0.8em 0 0.4em; }
p { margin: 0.6em 0; }
img { max-width: 100%; height: auto; }
pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.95em; }
blockquote { border-left: 4px solid #e5e7eb; margin: 0.8em 0; padding: 0.2em 1em; color: #4b5563; }
</style>
</head>
<body>
${innerHtml}
</body>
</html>`;
}

async function parseHtmlForEpub(html, filename, fallbackTitle, extraImageFiles) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const titleFromDoc = doc.querySelector('title')?.textContent?.trim();
    const firstH1 = doc.body?.querySelector('h1')?.textContent?.trim();
    const title = titleFromDoc || firstH1 || fallbackTitle || getBaseName(filename || 'document');

    sanitizeForEpub(doc);

    const images = extractDataUriImages(doc);
    const extraMap = buildExtraImagesMap(extraImageFiles);
    if (extraMap.size > 0) {
        await embedReferencedImages(doc, extraMap, images);
    }

    const chapters = splitDomIntoChapters(doc.body, title);
    return { title, chapters, images };
}

function sanitizeForEpub(doc) {
    doc.querySelectorAll('script, style, link, meta[http-equiv], iframe, object, embed').forEach(
        (el) => el.remove(),
    );
    doc.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
        }
    });
}

function splitDomIntoChapters(bodyEl, fallbackTitle) {
    if (!bodyEl) return [{ title: fallbackTitle, body: '' }];

    const h1Count = bodyEl.querySelectorAll('h1').length;
    const h2Count = bodyEl.querySelectorAll('h2').length;
    let splitTag = null;
    if (h1Count >= 2) splitTag = 'H1';
    else if (h1Count <= 1 && h2Count >= 2) splitTag = 'H2';

    if (!splitTag) {
        return [{ title: fallbackTitle, body: serializeBodyChildren(bodyEl) }];
    }

    const chapters = [];
    let current = { title: fallbackTitle, nodes: [] };

    Array.from(bodyEl.childNodes).forEach((node) => {
        if (node.nodeType === 1 && node.tagName === splitTag) {
            if (current.nodes.length > 0) chapters.push(current);
            current = {
                title: (node.textContent || '').trim() || `第 ${chapters.length + 1} 章`,
                nodes: [],
            };
        } else {
            current.nodes.push(node);
        }
    });
    chapters.push(current);

    return chapters.map((ch, i) => ({
        title: ch.title || `第 ${i + 1} 章`,
        body: serializeNodes(ch.nodes),
    }));
}

function serializeBodyChildren(bodyEl) {
    return serializeNodes(Array.from(bodyEl.childNodes));
}

function serializeNodes(nodes) {
    const serializer = new XMLSerializer();
    return nodes
        .map((n) => {
            if (n.nodeType === 3) return escapeHtml(n.nodeValue);
            if (n.nodeType !== 1) return '';
            try {
                return serializer.serializeToString(n);
            } catch {
                return n.outerHTML || '';
            }
        })
        .join('\n');
}

async function buildEpubFromChapters(chapters, meta, options, onProgress) {
    ensureJSZip();
    onProgress(45, '生成 XHTML...');

    options = options || {};
    const images = Array.isArray(options.images) ? options.images : [];
    const cover = options.cover || null;

    const safeChapters = chapters.length
        ? chapters
        : [{ title: meta.title || '正文', body: '' }];

    const chapterFiles = safeChapters.map((ch, i) => ({
        id: `chapter${i + 1}`,
        href: `chapter${i + 1}.xhtml`,
        title: ch.title || `第 ${i + 1} 章`,
        body: `<h1>${escapeHtml(ch.title || `第 ${i + 1} 章`)}</h1>\n${ch.body || ''}`,
    }));

    const uuid = generateUuid();
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const language = meta.language || 'zh-CN';
    const title = meta.title || '未命名';

    const navItems = chapterFiles
        .map((c) => `      <li><a href="${c.href}">${escapeHtml(c.title)}</a></li>`)
        .join('\n');

    const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;

    const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${chapterFiles
    .map(
        (c, i) => `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${c.href}"/>
    </navPoint>`,
    )
    .join('\n')}
  </navMap>
</ncx>`;

    const imageItems = images.map(
        (img, i) =>
            `    <item id="img${i + 1}" href="images/${img.filename}" media-type="${escapeXml(img.mimeType)}"/>`,
    );

    let coverManifestItems = [];
    let coverMetaXml = '';
    let coverSpineItem = '';
    if (cover) {
        coverManifestItems = [
            `    <item id="cover-image" href="images/${cover.filename}" media-type="${escapeXml(cover.mimeType)}" properties="cover-image"/>`,
            `    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
        ];
        coverMetaXml = `\n    <meta name="cover" content="cover-image"/>`;
        coverSpineItem = `    <itemref idref="cover" linear="yes"/>\n`;
    }

    const manifestItems = [
        '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '    <item id="css" href="style.css" media-type="text/css"/>',
        ...coverManifestItems,
        ...imageItems,
        ...chapterFiles.map(
            (c) => `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`,
        ),
    ].join('\n');

    const spineItems =
        coverSpineItem +
        chapterFiles.map((c) => `    <itemref idref="${c.id}"/>`).join('\n');

    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:creator>${escapeXml(meta.creator || 'ebook-converter')}</dc:creator>
    <meta property="dcterms:modified">${modified}</meta>${coverMetaXml}
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;

    const containerXml = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const css = `body { font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; line-height: 1.7; padding: 1em; }
h1 { font-size: 1.4em; margin: 1em 0 0.6em; }
h2 { font-size: 1.2em; margin: 0.9em 0 0.5em; }
p { margin: 0.6em 0; text-indent: 2em; }
img { max-width: 100%; height: auto; }
pre { background: #f3f4f6; padding: 8px; border-radius: 4px; overflow-x: auto; }
code { font-family: ui-monospace, monospace; }
blockquote { border-left: 3px solid #d1d5db; margin: 0.6em 0; padding: 0.2em 0.8em; color: #4b5563; }`;

    onProgress(70, '打包 EPUB...');
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.folder('META-INF').file('container.xml', containerXml);
    const oebps = zip.folder('OEBPS');
    oebps.file('content.opf', opf);
    oebps.file('toc.ncx', ncx);
    oebps.file('nav.xhtml', navXhtml);
    oebps.file('style.css', css);

    if (images.length || cover) {
        const imagesFolder = oebps.folder('images');
        for (const img of images) {
            imagesFolder.file(img.filename, img.data);
        }
        if (cover) {
            imagesFolder.file(cover.filename, cover.data);
            const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8" />
  <title>封面</title>
  <style>
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <div><img src="images/${cover.filename}" alt="${escapeHtml(title)}" /></div>
</body>
</html>`;
            oebps.file('cover.xhtml', coverXhtml);
        }
    }

    for (const c of chapterFiles) {
        const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(c.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${c.body}
</body>
</html>`;
        oebps.file(c.href, xhtml);
    }

    const blob = await zip.generateAsync(
        { type: 'blob', mimeType: 'application/epub+zip' },
        (m) => onProgress(70 + (m.percent || 0) * 0.3, '打包 EPUB...'),
    );
    onProgress(100, '完成');
    return { blob };
}

async function loadEpub(file, onProgress) {
    ensureJSZip();
    onProgress(15, '解压 EPUB...');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('EPUB 缺少 META-INF/container.xml');
    const containerXml = await containerFile.async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const rootfile = containerDoc.querySelector('rootfile');
    const opfPath = rootfile?.getAttribute('full-path');
    if (!opfPath) throw new Error('EPUB container 中缺少 rootfile');

    onProgress(30, '解析 OPF...');
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error(`未找到 OPF 文件 ${opfPath}`);
    const opfXml = await opfFile.async('string');
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

    const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

    const manifest = {};
    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type');
        if (id && href) manifest[id] = { href, mediaType };
    });

    const spine = [];
    opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
        const idref = ref.getAttribute('idref');
        if (idref && manifest[idref]) spine.push(manifest[idref]);
    });

    const titleEl = opfDoc.getElementsByTagName('dc:title')[0] || opfDoc.querySelector('title');
    const title = titleEl?.textContent?.trim() || getBaseName(file.name);

    return { zip, baseDir, spine, title, opfPath, opfDoc };
}

async function readEpubMetadata(file) {
    ensureJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('EPUB 缺少 META-INF/container.xml');
    const containerXml = await containerFile.async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
    if (!opfPath) throw new Error('EPUB container 中缺少 rootfile');
    const opfXml = await zip.file(opfPath).async('string');
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

    const text = (tag) => opfDoc.getElementsByTagName(tag)[0]?.textContent?.trim() || '';

    return {
        title: text('dc:title'),
        creator: text('dc:creator'),
        language: text('dc:language'),
        publisher: text('dc:publisher'),
        description: text('dc:description'),
        identifier: text('dc:identifier'),
    };
}

async function editEpubFile(file, meta, extras, onProgress) {
    ensureJSZip();
    onProgress(15, '解压 EPUB...');
    const sourceZip = await JSZip.loadAsync(await file.arrayBuffer());

    const containerXml = await sourceZip.file('META-INF/container.xml').async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
    if (!opfPath) throw new Error('EPUB container 中缺少 rootfile');

    const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

    onProgress(30, '修改元数据...');
    const opfXml = await sourceZip.file(opfPath).async('string');
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
    updateOpfMetadata(opfDoc, meta);

    let newCoverPath = null;
    let newCoverData = null;
    if (extras?.cover) {
        onProgress(40, '处理封面...');
        const coverEntry = await fileToImageEntry(extras.cover, 'cover');
        const result = applyCoverReplacement(opfDoc, baseDir, coverEntry);
        newCoverPath = result.path;
        newCoverData = coverEntry.data;
    }

    const newOpfXml = new XMLSerializer().serializeToString(opfDoc);

    onProgress(55, '重新打包 EPUB...');
    const outZip = new JSZip();

    const mimetypeRaw = await sourceZip.file('mimetype').async('string');
    outZip.file('mimetype', (mimetypeRaw || '').trim() || 'application/epub+zip', {
        compression: 'STORE',
    });

    const entries = Object.values(sourceZip.files);
    const writtenPaths = new Set();
    for (const entry of entries) {
        if (entry.dir) continue;
        if (entry.name === 'mimetype') continue;
        if (entry.name === opfPath) {
            outZip.file(entry.name, newOpfXml);
        } else if (newCoverPath && entry.name === newCoverPath) {
            outZip.file(entry.name, newCoverData);
        } else {
            const data = await entry.async('uint8array');
            outZip.file(entry.name, data);
        }
        writtenPaths.add(entry.name);
    }
    if (newCoverPath && !writtenPaths.has(newCoverPath)) {
        outZip.file(newCoverPath, newCoverData);
    }

    const blob = await outZip.generateAsync(
        { type: 'blob', mimeType: 'application/epub+zip' },
        (m) => onProgress(55 + (m.percent || 0) * 0.45, '重新打包 EPUB...'),
    );
    onProgress(100, '完成');
    return { blob };
}

function applyCoverReplacement(opfDoc, baseDir, coverEntry) {
    const manifest = opfDoc.querySelector('manifest') || opfDoc.getElementsByTagName('manifest')[0];
    const metadataEl = opfDoc.querySelector('metadata') || opfDoc.getElementsByTagName('metadata')[0];
    if (!manifest || !metadataEl) throw new Error('OPF 缺少 manifest 或 metadata');

    let coverItem = Array.from(manifest.getElementsByTagName('item')).find((item) => {
        const props = item.getAttribute('properties') || '';
        return /\bcover-image\b/.test(props);
    });

    if (!coverItem) {
        const metaCover = Array.from(metadataEl.getElementsByTagName('meta')).find(
            (m) => m.getAttribute('name') === 'cover',
        );
        if (metaCover) {
            const id = metaCover.getAttribute('content');
            coverItem = Array.from(manifest.getElementsByTagName('item')).find(
                (item) => item.getAttribute('id') === id,
            );
        }
    }

    if (coverItem) {
        const oldHref = coverItem.getAttribute('href');
        coverItem.setAttribute('media-type', coverEntry.mimeType);
        const props = (coverItem.getAttribute('properties') || '').split(/\s+/).filter(Boolean);
        if (!props.includes('cover-image')) props.push('cover-image');
        coverItem.setAttribute('properties', props.join(' '));
        ensureMetaCover(opfDoc, metadataEl, coverItem.getAttribute('id') || 'cover-image');
        if (!coverItem.getAttribute('id')) coverItem.setAttribute('id', 'cover-image');
        return { path: baseDir + oldHref };
    }

    const href = `images/${coverEntry.filename}`;
    const item = createOpfElement(opfDoc, 'item');
    item.setAttribute('id', 'cover-image');
    item.setAttribute('href', href);
    item.setAttribute('media-type', coverEntry.mimeType);
    item.setAttribute('properties', 'cover-image');
    manifest.appendChild(item);
    ensureMetaCover(opfDoc, metadataEl, 'cover-image');
    return { path: baseDir + href };
}

function ensureMetaCover(opfDoc, metadataEl, contentId) {
    let meta = Array.from(metadataEl.getElementsByTagName('meta')).find(
        (m) => m.getAttribute('name') === 'cover',
    );
    if (!meta) {
        meta = createOpfElement(opfDoc, 'meta');
        meta.setAttribute('name', 'cover');
        metadataEl.appendChild(meta);
    }
    meta.setAttribute('content', contentId);
}

const DC_NS = 'http://purl.org/dc/elements/1.1/';
const OPF_NS = 'http://www.idpf.org/2007/opf';

function createOpfElement(opfDoc, tag) {
    const ns = opfDoc.documentElement?.namespaceURI || OPF_NS;
    return opfDoc.createElementNS(ns, tag);
}

function updateOpfMetadata(opfDoc, meta) {
    const metadataEl = opfDoc.querySelector('metadata') || opfDoc.getElementsByTagName('metadata')[0];
    if (!metadataEl) throw new Error('OPF 缺少 metadata 节点');

    const setDc = (tag, value, options = {}) => {
        const el = opfDoc.getElementsByTagName(tag)[0];
        if (!value) {
            if (el && options.removeIfEmpty) el.parentNode?.removeChild(el);
            return;
        }
        if (el) {
            el.textContent = value;
        } else {
            const created = opfDoc.createElementNS(DC_NS, tag);
            created.textContent = value;
            metadataEl.appendChild(created);
        }
    };

    setDc('dc:title', meta.title);
    setDc('dc:creator', meta.creator);
    setDc('dc:language', meta.language);
    setDc('dc:publisher', meta.publisher, { removeIfEmpty: true });
    setDc('dc:description', meta.description, { removeIfEmpty: true });

    if (meta.identifier) {
        const idEl = opfDoc.getElementsByTagName('dc:identifier')[0];
        if (idEl) {
            idEl.textContent = meta.identifier;
        } else {
            const created = opfDoc.createElementNS(DC_NS, 'dc:identifier');
            created.setAttribute('id', 'bookid');
            created.textContent = meta.identifier;
            metadataEl.appendChild(created);
        }
    }

    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    let modifiedEl = Array.from(metadataEl.getElementsByTagName('meta')).find(
        (m) => m.getAttribute('property') === 'dcterms:modified',
    );
    if (modifiedEl) {
        modifiedEl.textContent = modified;
    } else {
        const created = createOpfElement(opfDoc, 'meta');
        created.setAttribute('property', 'dcterms:modified');
        created.textContent = modified;
        metadataEl.appendChild(created);
    }
}

async function epubToText(file, onProgress) {
    const { zip, baseDir, spine, title } = await loadEpub(file, onProgress);
    onProgress(50, '提取文本...');

    const parts = [title, '='.repeat(Math.max(2, title.length)), ''];

    for (let i = 0; i < spine.length; i++) {
        const item = spine[i];
        const path = baseDir + item.href.split('#')[0];
        const entry = zip.file(path);
        if (!entry) continue;
        const html = await entry.async('string');
        parts.push(extractTextFromXhtml(html));
        parts.push('');
        onProgress(50 + ((i + 1) / spine.length) * 45, `提取章节 ${i + 1}/${spine.length}`);
    }

    onProgress(100, '完成');
    const text = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) };
}

async function epubToHtml(file, onProgress) {
    const { zip, baseDir, spine, title } = await loadEpub(file, onProgress);
    onProgress(50, '合并章节...');

    const sections = [];
    for (let i = 0; i < spine.length; i++) {
        const item = spine[i];
        const path = baseDir + item.href.split('#')[0];
        const entry = zip.file(path);
        if (!entry) continue;
        const xhtml = await entry.async('string');
        sections.push(`<section class="chapter">\n${extractBodyHtml(xhtml)}\n</section>`);
        onProgress(50 + ((i + 1) / spine.length) * 45, `合并章节 ${i + 1}/${spine.length}`);
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
body { max-width: 760px; margin: 2em auto; padding: 0 1em; font-family: -apple-system, "PingFang SC", sans-serif; line-height: 1.7; color: #1f2937; }
.chapter { margin-bottom: 2em; padding-bottom: 1em; border-bottom: 1px solid #e5e7eb; }
.chapter:last-child { border-bottom: none; }
img { max-width: 100%; height: auto; }
h1, h2, h3 { line-height: 1.3; }
p { margin: 0.6em 0; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${sections.join('\n')}
</body>
</html>`;

    onProgress(100, '完成');
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }) };
}

function extractTextFromXhtml(xhtml) {
    let doc;
    try {
        doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            doc = new DOMParser().parseFromString(xhtml, 'text/html');
        }
    } catch {
        doc = new DOMParser().parseFromString(xhtml, 'text/html');
    }
    const body = doc.body || doc.documentElement;
    if (!body) return '';

    body.querySelectorAll('script, style').forEach((el) => el.remove());

    const blocks = [];
    body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, br, div').forEach((el) => {
        if (el.tagName.toLowerCase() === 'br') {
            blocks.push('');
        } else {
            const text = el.textContent.replace(/\s+/g, ' ').trim();
            if (text) blocks.push(text);
        }
    });

    if (blocks.length === 0) {
        return body.textContent.replace(/\s+/g, ' ').trim();
    }
    return blocks.join('\n');
}

function extractBodyHtml(xhtml) {
    let doc;
    try {
        doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            doc = new DOMParser().parseFromString(xhtml, 'text/html');
        }
    } catch {
        doc = new DOMParser().parseFromString(xhtml, 'text/html');
    }
    doc.querySelectorAll('script, link, style').forEach((el) => el.remove());
    const body = doc.body || doc.documentElement;
    return body ? body.innerHTML : '';
}

function addToHistory(originalName, sourceFormat, targetFormat, convertedFileName) {
    const item = {
        originalName,
        from: sourceFormat.toUpperCase(),
        to: targetFormat.toUpperCase(),
        convertedName: convertedFileName,
        date: new Date().toLocaleString('zh-CN'),
    };
    conversionHistory.unshift(item);
    if (conversionHistory.length > HISTORY_LIMIT) {
        conversionHistory = conversionHistory.slice(0, HISTORY_LIMIT);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(conversionHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    if (!conversionHistory.length) {
        historyList.innerHTML = '<p class="empty-history">暂无转换记录</p>';
        return;
    }

    historyList.innerHTML = conversionHistory
        .map(
            (item) => `
        <div class="history-item">
            <div class="history-info">
                <span>${FORMAT_ICONS[(item.to || '').toLowerCase()] || '📄'}</span>
                <div>
                    <div class="history-name">${escapeHtml(item.originalName || '')}</div>
                    <div class="history-meta">${escapeHtml(item.date || '')}</div>
                </div>
            </div>
            <span class="history-badge">${escapeHtml(item.from || '')} → ${escapeHtml(item.to || '')}</span>
        </div>`,
        )
        .join('');
}

clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('确定要清空所有转换记录吗？')) return;
    conversionHistory = [];
    localStorage.removeItem(HISTORY_KEY);
    updateHistoryDisplay();
});

