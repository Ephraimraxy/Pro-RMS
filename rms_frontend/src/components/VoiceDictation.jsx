import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { aiAPI } from '../lib/api';

// Check browser support
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const VoiceDictation = ({ onTranscript, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveText, setLiveText] = useState('');
  const [mode, setMode] = useState(null); // 'native' | 'whisper'
  
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const accumulatedRef = useRef('');

  // Detect which mode we can use
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    setMode(SpeechRecognition ? 'native' : 'whisper');
  }, []);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Native Web Speech API ──
  const startNativeRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    accumulatedRef.current = '';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      if (final) {
        accumulatedRef.current += final;
      }
      setLiveText(accumulatedRef.current + interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // Ignore silence
      console.error('Speech recognition error:', event.error);
      toast.error(`Voice error: ${event.error}`);
      stopRecording();
    };

    recognition.onend = () => {
      // Auto-restart if still recording (browser may stop after silence)
      if (isRecording && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (_) {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording]);

  // ── Whisper Fallback (MediaRecorder → Backend) ──
  const startWhisperRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });
      
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect in 1s chunks
      setLiveText('🎤 Recording audio for AI transcription...');
    } catch (err) {
      toast.error('Microphone access denied. Please allow microphone permissions.');
      setIsRecording(false);
    }
  }, []);

  const stopWhisperRecording = useCallback(async () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(null); return; }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Stop all tracks
        recorder.stream?.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  // ── Unified Start/Stop ──
  const startRecording = useCallback(() => {
    if (disabled || isRecording) return;
    setIsRecording(true);
    setLiveText('');
    accumulatedRef.current = '';
    startTimer();

    if (mode === 'native') {
      startNativeRecognition();
    } else {
      startWhisperRecording();
    }
  }, [disabled, isRecording, mode, startTimer, startNativeRecognition, startWhisperRecording]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    stopTimer();

    if (mode === 'native') {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent auto-restart
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      const finalText = accumulatedRef.current.trim();
      if (finalText) {
        onTranscript(finalText);
        toast.success('Voice transcription added to your draft.');
      } else {
        toast.error('No speech detected. Please try again.');
      }
      setLiveText('');
    } else {
      // Whisper: send audio to backend
      setIsProcessing(true);
      setLiveText('Processing audio with AI...');
      try {
        const audioBlob = await stopWhisperRecording();
        if (!audioBlob || audioBlob.size < 1000) {
          toast.error('Recording too short. Please try again.');
          setIsProcessing(false);
          setLiveText('');
          return;
        }
        const result = await aiAPI.transcribeAudio(audioBlob);
        if (result.text?.trim()) {
          onTranscript(result.text.trim());
          toast.success('Voice transcription added to your draft.');
        } else {
          toast.error('Could not transcribe audio. Please try again.');
        }
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Transcription failed.');
      } finally {
        setIsProcessing(false);
        setLiveText('');
      }
    }
  }, [mode, stopTimer, stopWhisperRecording, onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { 
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
        } catch (_) {}
      }
    };
  }, [stopTimer]);

  const isActive = isRecording || isProcessing;

  return (
    <div className="space-y-3">
      {/* Recording Controls */}
      <div className="flex items-center gap-3">
        {!isActive ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 uppercase tracking-wider"
            title="Click to start voice dictation"
          >
            <Mic size={14} className="group-hover:scale-110 transition-transform" />
            Voice Dictation
          </button>
        ) : isProcessing ? (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 font-bold text-xs rounded-2xl uppercase tracking-wider">
            <Loader2 size={14} className="animate-spin" />
            Transcribing…
          </div>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-red-500/30 active:scale-95 uppercase tracking-wider animate-pulse"
          >
            <Square size={12} fill="currentColor" /> 
            Stop · {formatTime(elapsed)}
          </button>
        )}

        {isRecording && !isProcessing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* Live pulse indicator */}
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute opacity-30" />
              <div className="w-2 h-2 bg-red-500 rounded-full relative z-10" />
            </div>
            {/* Waveform visualization */}
            <div className="flex items-center gap-[2px] h-5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-rose-400 rounded-full"
                  style={{
                    animation: `voiceWave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                    height: '40%'
                  }}
                />
              ))}
            </div>
            <span className="font-mono font-bold text-foreground/70">{formatTime(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Live Transcription Preview */}
      {liveText && (
        <div className="relative bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200/60 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/80">
              {isProcessing ? 'AI Processing' : 'Live Preview'}
            </span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {liveText}
            {isRecording && !isProcessing && <span className="inline-block w-0.5 h-4 bg-rose-500 ml-0.5 animate-blink align-middle" />}
          </p>
        </div>
      )}

      {/* CSS Animations (injected inline) */}
      <style>{`
        @keyframes voiceWave {
          0%   { height: 20%; }
          100% { height: 100%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        .animate-blink { animation: blink 0.8s step-end infinite; }
      `}</style>
    </div>
  );
};

export default VoiceDictation;
