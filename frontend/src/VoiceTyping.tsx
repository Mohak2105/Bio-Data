import { useState, useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type VoiceTypingProps = {
  onTranscript?: (text: string) => void;
};

export function VoiceTyping({ onTranscript }: VoiceTypingProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Browser not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'mr-IN';

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        }
      }
      if (finalText && onTranscriptRef.current) {
        onTranscriptRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        setError('Mic error: ' + event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setError('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setError('Mic error.');
      }
    }
  }, [isListening]);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={toggleListening}
        title={isListening ? 'Stop Voice Typing' : 'Start Marathi Voice Typing'}
        style={{
          background: isListening ? '#b01910' : 'transparent',
          color: isListening ? '#fff' : '#280300',
          border: '1px solid #280300',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
          fontSize: '16px',
          transition: 'all 0.2s',
          animation: isListening ? 'pulse-mic 1.2s infinite' : 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
          <line x1="8" y1="22" x2="16" y2="22"></line>
        </svg>
      </button>
      {error && (
        <span style={{ color: 'red', fontSize: '12px' }}>{error}</span>
      )}
    </div>
  );
}
