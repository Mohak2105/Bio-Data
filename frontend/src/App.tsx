import { ChangeEvent, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { VoiceTyping } from './VoiceTyping';
import { toJpeg } from 'html-to-image';
import { uploadPreview } from './api';
import { blankStructuredFields, defaultTemplateSettings, TemplateSettings, type StructuredFields } from './types';
import { transliterate } from './transliterate';

type EditablePreviewField = {
  section: keyof StructuredFields;
  key: string;
  label: string;
  multiline?: boolean;
  accent?: boolean;
};

const editablePreviewFields: EditablePreviewField[] = [
  { section: 'personal', key: 'fullName', label: 'मुलाचे नाव', multiline: true, accent: true },
  { section: 'personal', key: 'birthDate', label: 'जन्मतारीख' },
  { section: 'personal', key: 'birthTime', label: 'जन्म वेळ', multiline: true },
  { section: 'personal', key: 'birthDay', label: 'जन्म वार' },
  { section: 'personal', key: 'birthPlace', label: 'जन्म ठिकाण' },
  { section: 'personal', key: 'height', label: 'उंची' },
  { section: 'horoscope', key: 'rashi', label: 'रास' },
  { section: 'horoscope', key: 'nadi', label: 'नाडी' },
  { section: 'horoscope', key: 'bloodGroup', label: 'रक्तगट' },
  { section: 'personal', key: 'education', label: 'शिक्षण' },
  { section: 'personal', key: 'occupation', label: 'नोकरी', multiline: true },
  { section: 'personal', key: 'income', label: 'उत्पन्न' },
  { section: 'personal', key: 'caste', label: 'जात' },
  { section: 'preferences', key: 'expectation', label: 'अपेक्षा', multiline: true },
  { section: 'contacts', key: 'parentContact', label: 'पालक संपर्क', multiline: true },
  { section: 'contacts', key: 'officeContact', label: 'ऑफिस संपर्क' },
];

export type EditableTextHandle = {
  appendText: (text: string) => void;
};

type EditableTextProps = {
  value: string;
  onChange: (value: string) => void;
  className: string;
  multiline?: boolean;
  transliterateEnabled?: boolean;
  onFocusField?: () => void;
};

const EditableText = forwardRef<EditableTextHandle, EditableTextProps>(function EditableText({ value, onChange, className, multiline = false, transliterateEnabled = false, onFocusField }, fwdRef) {
  const ref = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionCtxRef = useRef<{ marathiWord: string; before: string; after: string } | null>(null);

  useImperativeHandle(fwdRef, () => ({
    appendText(text: string) {
      const element = ref.current;
      if (!element) return;
      const current = element.innerText;
      const separator = current && !current.endsWith(' ') ? ' ' : '';
      setContent(current + separator + text);
    },
  }));

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const current = element.innerText.replace(/\r/g, '');
    if (!isComposingRef.current && document.activeElement !== element && current !== value) {
      element.innerText = value;
    }
  }, [value]);

  function syncValue() {
    const element = ref.current;
    if (!element || isComposingRef.current) return;
    // Remove stray full stops that voice typing inserts after each word
    // Keep valid dots: decimals (5.6), abbreviations (चि.), dates (12.05.2000)
    let text = element.innerText.replace(/\r/g, '');
    // Remove "word. word" → "word word" (period followed by space+letter)
    text = text.replace(/(\p{L})\.\s+(?=\p{L})/gu, '$1 ');
    // Remove trailing lone period
    text = text.replace(/\s+\.\s*$/, '');
    if (text !== element.innerText.replace(/\r/g, '')) {
      const sel = window.getSelection();
      const hadFocus = document.activeElement === element;
      element.innerText = text;
      if (hadFocus && sel && element.firstChild) {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    onChange(text);
  }

  function setContent(text: string) {
    const element = ref.current;
    if (!element) return;
    element.innerText = text;
    onChange(text.replace(/\r/g, ''));
    // Move cursor to end
    const sel = window.getSelection();
    if (sel && element.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    element.focus();
  }

  function pickSuggestion(picked: string) {
    const ctx = suggestionCtxRef.current;
    if (!ctx) return;
    setContent(ctx.before + picked + ' ' + ctx.after);
    suggestionCtxRef.current = null;
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function handleTransliteration(textBeforeSpace: string) {
    if (!transliterateEnabled) return;

    // Find last English word
    const match = textBeforeSpace.match(/^([\s\S]*?)([a-zA-Z]+)$/);
    if (!match) return;

    const before = match[1];
    const englishWord = match[2];

    // Remember the snapshot length before the async call
    const snapshotLength = textBeforeSpace.length;

    const results = await transliterate(englishWord);
    if (!results.length || (results.length === 1 && results[0] === englishWord)) return;

    // Re-read the DOM text AFTER the async call – user may have typed more
    const element = ref.current;
    if (!element) return;
    const currentFull = element.innerText;

    // Everything the user typed after the space while we were waiting
    const typedAfter = currentFull.substring(snapshotLength).replace(/^\s/, '');

    // Replace with first suggestion, preserving anything typed during the wait
    setContent(before + results[0] + ' ' + typedAfter);

    suggestionCtxRef.current = { marathiWord: results[0], before, after: typedAfter };

    if (results.length > 1) {
      setSuggestions(results);
      setShowSuggestions(true);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'contents' }}>
      <div
        ref={ref}
        className={className}
        contentEditable
        role="textbox"
        spellCheck={false}
        suppressContentEditableWarning
        onInput={syncValue}
        onFocus={onFocusField}
        onBlur={() => {
          syncValue();
          setTimeout(() => { setShowSuggestions(false); setSuggestions([]); }, 200);
        }}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; syncValue(); }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        onKeyDown={(event) => {
          if (!isComposingRef.current && !multiline && event.key === 'Enter') {
            event.preventDefault();
          }
          if (transliterateEnabled && !isComposingRef.current && event.key === ' ') {
            const element = ref.current;
            if (!element) return;
            const text = element.innerText;
            if (/[a-zA-Z]$/.test(text)) {
              event.preventDefault();
              handleTransliteration(text);
            }
          }
        }}
      />
      {showSuggestions && suggestions.length > 1 && (
        <div className="transliterate-suggestions">
          {suggestions.map((s, i) => (
            <button key={i} className="transliterate-suggestion" onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

function App() {
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [structuredFields, setStructuredFields] = useState<StructuredFields>(blankStructuredFields);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(defaultTemplateSettings);
  const [error, setError] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [hasLoadedPreview, setHasLoadedPreview] = useState(true);
  const [transliterateOn] = useState(true);

  const editablePreviewRef = useRef<HTMLDivElement>(null);
  const documentPreviewUrlRef = useRef<string>('');
  const fieldRefsMap = useRef<Map<string, EditableTextHandle>>(new Map());
  const lastFocusedFieldRef = useRef<string | null>(null);
  const centerNameRef = useRef<EditableTextHandle>(null);
  const idValueRef = useRef<EditableTextHandle>(null);

  const handleVoiceTranscript = useCallback((text: string) => {
    // Add newline after every full stop (Devanagari purna viram & English period)
    const processed = text.replace(/([।.])\s*/g, '$1\n');
    const key = lastFocusedFieldRef.current;
    if (key === '__centerName__') {
      centerNameRef.current?.appendText(processed);
    } else if (key === '__idValue__') {
      idValueRef.current?.appendText(processed);
    } else if (key) {
      const handle = fieldRefsMap.current.get(key);
      handle?.appendText(processed);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (documentPreviewUrlRef.current) {
        URL.revokeObjectURL(documentPreviewUrlRef.current);
      }
    };
  }, []);

  const canProcess = useMemo(() => true, []);

  async function handlePreviewGenerate() {
    if (!documentFile) {
      // No document — just ensure the preview is visible for manual entry
      setHasLoadedPreview(true);
      return;
    }

    try {
      setError('');
      setBusyMessage('Wait...');
      const response = await uploadPreview(documentFile, photoFile);

      setStructuredFields(response.structuredFields);
      setTemplateSettings(response.templateSettings ?? defaultTemplateSettings());
      setPhotoDataUrl(response.photoDataUrl ?? null);
      setHasLoadedPreview(true);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Document scan पूर्ण झाले नाही.');
    } finally {
      setBusyMessage('');
    }
  }

  async function handleExport() {
    try {
      setError('');
      setBusyMessage('Final JPG तयार करत आहोत...');
      const node = editablePreviewRef.current;
      if (!node) {
        throw new Error('Editable preview सापडला नाही.');
      }

      if ('fonts' in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }

      node.classList.add('exporting');
      
      const editableElements = node.querySelectorAll<HTMLElement>('.react-editor-title, .react-editor-id-value, .react-editor-value');
      editableElements.forEach(el => {
        el.style.setProperty('border', '1px solid rgba(255,255,255,0)', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('outline', 'none', 'important');
      });

      // Wait a bit longer to securely ensure browser repaints
      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        const dataUrl = await toJpeg(node, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#fffdfa',
          cacheBust: true,
        });

        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        const idValue = templateSettings.idValue.trim();
        anchor.download = idValue ? `Id No - ${idValue}.jpg` : 'Id No.jpg';
        anchor.click();
      } finally {
        editableElements.forEach(el => {
          el.style.removeProperty('border');
          el.style.removeProperty('background-color');
          el.style.removeProperty('outline');
        });
        node.classList.remove('exporting');
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'JPG export failed.');
    } finally {
      setBusyMessage('');
    }
  }

  function handlePhotoReplace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);

    if (!file) {
      setPhotoDataUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  function handleDocumentReplace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setDocumentFile(file);

    if (documentPreviewUrlRef.current) {
      URL.revokeObjectURL(documentPreviewUrlRef.current);
      documentPreviewUrlRef.current = '';
    }

    if (!file) {
      setDocumentPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    documentPreviewUrlRef.current = nextUrl;
    setDocumentPreviewUrl(nextUrl);
  }

  function updateStructuredField(section: keyof StructuredFields, key: string, value: string) {
    setStructuredFields((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }) as StructuredFields);
  }

  function updateCenterName(value: string) {
    setTemplateSettings((current) => ({
      ...current,
      centerName: value,
      watermarkText: value,
      footerText: value,
    }));
  }

  function updateIdValue(value: string) {
    setTemplateSettings((current) => ({
      ...current,
      idValue: value,
    }));
  }

  function getStructuredValue(section: keyof StructuredFields, key: string): string {
    const sectionValue = structuredFields[section] as Record<string, string>;
    return sectionValue[key] ?? '';
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Personal Biodata</h1>
          <p className="hero-credit">Built with ❤️ by Finlec Technologies</p>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Upload Documents</h2>
          <div className="upload-grid">
            <div className="upload-pair">
              <div className="upload-card file-card">
                <span>बायोडाटा</span>
                <input
                  id="biodata-file-input"
                  className="hidden-file-input"
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleDocumentReplace}
                />
                <label className="file-upload-btn" htmlFor="biodata-file-input">
                  Upload File
                </label>
                <small>{documentFile ? documentFile.name : 'PDF, JPG, PNG'}</small>
              </div>

              <div className="upload-card preview-card">
                <div className="mini-preview">
                  {documentPreviewUrl ? (
                    documentFile?.type === 'application/pdf' ? (
                      <object className="mini-preview-media" data={documentPreviewUrl} type="application/pdf">
                        PDF preview unavailable
                      </object>
                    ) : (
                      <img className="mini-preview-media" src={documentPreviewUrl} alt="Uploaded biodata preview" />
                    )
                  ) : (
                    <span className="preview-empty" />
                  )}
                </div>
              </div>
            </div>

            <div className="upload-divider" aria-hidden="true" />

            <div className="upload-pair">
              <div className="upload-card file-card">
                <span>प्रोफाइल फोटो</span>
                <input
                  id="profile-photo-input"
                  className="hidden-file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handlePhotoReplace}
                />
                <label className="file-upload-btn" htmlFor="profile-photo-input">
                  Upload File
                </label>
                <small>{photoFile ? photoFile.name : 'JPG, PNG'}</small>
              </div>

              <div className="upload-card preview-card">
                <div className="mini-preview">
                  {photoDataUrl ? (
                    <img className="mini-preview-media" src={photoDataUrl} alt="Uploaded profile mini preview" />
                  ) : (
                    <span className="preview-empty" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="primary" onClick={handlePreviewGenerate} disabled={!canProcess || Boolean(busyMessage)}>
              Create Biodata
            </button>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="preview-header">
            <h2>Editable Preview</h2>
            <VoiceTyping onTranscript={handleVoiceTranscript} />
          </div>
          {hasLoadedPreview ? (
            <div className="inline-preview-block">
              <div className="react-editor-canvas" ref={editablePreviewRef}>
                <div className="react-editor-ornament react-editor-ornament-left" aria-hidden="true" />
                <div className="react-editor-ornament react-editor-ornament-right" aria-hidden="true" />
                <div className="react-editor-watermarks">
                  <div>{templateSettings.centerName}</div>
                  <div>{templateSettings.centerName}</div>
                  <div>{templateSettings.centerName}</div>
                </div>
                <div className="react-editor-footer">{templateSettings.footerText || templateSettings.centerName}</div>

                <div className="react-editor-title">{templateSettings.centerName}</div>
                <div className="react-editor-ornament react-editor-ornament-top" aria-hidden="true" />

                <div className="react-editor-grid">
                  <div className="react-editor-left">
                    {editablePreviewFields.map((field) => (
                      <div className={`react-editor-row ${field.accent ? 'react-editor-row-accent' : ''}`} key={`${field.section}-${field.key}`}>
                        <div className="react-editor-label"><span>{field.label}</span><span className="react-editor-colon">:</span></div>
                        <EditableText
                          ref={(handle) => { if (handle) fieldRefsMap.current.set(`${field.section}-${field.key}`, handle); else fieldRefsMap.current.delete(`${field.section}-${field.key}`); }}
                          value={getStructuredValue(field.section, field.key)}
                          onChange={(value) => updateStructuredField(field.section, field.key, value)}
                          className={`react-editor-value ${field.multiline ? 'react-editor-value-multiline' : ''}`}
                          multiline={field.multiline}
                          transliterateEnabled={transliterateOn}
                          onFocusField={() => { lastFocusedFieldRef.current = `${field.section}-${field.key}`; }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="react-editor-right">
                    <div className="react-editor-meta">
                      <div className="react-editor-id">
                        <span>आयडी क्रमांक :- </span>
                        <EditableText ref={idValueRef} value={templateSettings.idValue} onChange={updateIdValue} className="react-editor-id-value" transliterateEnabled={transliterateOn} onFocusField={() => { lastFocusedFieldRef.current = '__idValue__'; }} />
                      </div>
                    </div>
                    
                    <div className="react-editor-photo-wrap">
                      {photoDataUrl ? (
                        <img className="react-editor-photo" src={photoDataUrl} alt="Editable preview profile" />
                      ) : (
                        <div className="react-editor-photo react-editor-photo-empty">फोटो</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="download-actions">
                <button className="primary" onClick={handleExport} disabled={Boolean(busyMessage)}>
                  Download
                </button>
              </div>
            </div>
          ) : (
            <div className="preview-frame" />
          )}
        </section>

        {busyMessage ? <div className="banner busy"><span className="spinner" /></div> : null}
        {error ? <div className="banner error">{error}</div> : null}
      </main>
    </div>
  );
}

export default App;
