export type SpeechUtteranceData = {
  text: string;
  lang: string;
};

export type SpeechCallbacks = {
  onStarted?: () => void;
  onFailed?: () => void;
};

export type SpeechRuntime = {
  createUtterance?: (text: string) => SpeechUtteranceData;
  cancel?: () => void;
  speak?: (
    utterance: SpeechUtteranceData,
    callbacks?: SpeechCallbacks
  ) => void;
};

function getBrowserSpeechRuntime(): SpeechRuntime {
  if (
    typeof window === "undefined" ||
    typeof window.SpeechSynthesisUtterance === "undefined" ||
    !window.speechSynthesis
  ) {
    return {};
  }

  return {
    createUtterance: (text) => ({ text, lang: "" }),
    cancel: () => window.speechSynthesis.cancel(),
    speak: (utterance, callbacks) => {
      const browserUtterance = new window.SpeechSynthesisUtterance(utterance.text);
      browserUtterance.lang = utterance.lang;
      browserUtterance.onstart = () => callbacks?.onStarted?.();
      browserUtterance.onerror = () => callbacks?.onFailed?.();
      window.speechSynthesis.speak(browserUtterance);
    }
  };
}

export function speakEnglishWord(
  word: string,
  runtime: SpeechRuntime = getBrowserSpeechRuntime(),
  callbacks: SpeechCallbacks = {}
) {
  let settled = false;
  const notifyStarted = () => {
    if (!settled) {
      settled = true;
      callbacks.onStarted?.();
    }
  };
  const notifyFailed = () => {
    if (!settled) {
      settled = true;
      callbacks.onFailed?.();
    }
  };

  if (!runtime.createUtterance || !runtime.cancel || !runtime.speak) {
    notifyFailed();
    return false;
  }

  try {
    const utterance = runtime.createUtterance(word);
    utterance.lang = "en-US";
    runtime.cancel();
    runtime.speak(utterance, {
      onStarted: notifyStarted,
      onFailed: notifyFailed
    });
    return true;
  } catch {
    notifyFailed();
    return false;
  }
}
