/**
 * Web Speech API Speech-to-Text Recognition Helper for AgriConnect.
 * Supports Telugu (te-IN), Hindi (hi-IN), and English (en-IN).
 * Gracefully degrades if Web Speech is unavailable.
 */

import { SPEECH_LANG_MAP, DEFAULT_LANGUAGE } from '../i18n/index.js'
import { getSelectedLanguage } from './onboarding.js'

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createSpeechRecognizer({ onResult, onError, onEnd, onStart, lang }) {
  if (!isSpeechRecognitionSupported()) {
    onError?.('Speech recognition is not supported in this browser. Please type manually.')
    return null
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()

  const currentLang = lang || getSelectedLanguage()
  // Map language codes to regional speech recognition locales
  const langLocale =
    currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN'

  recognition.lang = langLocale
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    onStart?.()
  }

  recognition.onresult = (event) => {
    let interim = ''
    let final = ''

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
            final += transcript
        } else {
            interim += transcript
        }
    }

    onResult?.({
        final: final.trim(),
        interim: interim.trim(),
        text: (final || interim).trim()
    })
  }

  recognition.onerror = (event) => {
    let msg = 'Voice recognition error'
    if (event.error === 'not-allowed') {
      msg = 'Microphone permission denied. Please allow microphone access or type manually.'
    } else if (event.error === 'no-speech') {
      msg = 'No speech detected. Please try speaking again.'
    } else if (event.error === 'network') {
      msg = 'Network issue with voice recognition. You can type manually.'
    }
    const errObj = new String(msg)
    errObj.type = event.error
    errObj.message = msg
    onError?.(errObj, event)
  }

  recognition.onend = () => {
    onEnd?.()
  }

  return recognition
}
