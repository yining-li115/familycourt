import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Animated,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import colors from '../theme/colors';

// Safely attempt to import Voice; may not be available until pod install
let Voice = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch (_e) {
  Voice = null;
}

const MAX_CHARS = 500;
const WARN_THRESHOLD = 400; // show soft warning when chars >= this

export default function VoiceInputModal({ visible, onClose, onConfirm, initialText = '' }) {
  const [text, setText] = useState(initialText);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [androidFallback, setAndroidFallback] = useState(false);

  // Animated values for the pulsing recording indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  // ─── Init / Cleanup Voice ────────────────────────────────────────────────

  useEffect(() => {
    if (!Voice) {
      // Library not installed yet
      if (Platform.OS === 'android') setAndroidFallback(true);
      return;
    }

    setVoiceAvailable(true);

    Voice.onSpeechPartialResults = (e) => {
      const partial = e.value?.[0] ?? '';
      setText(partial);
    };

    Voice.onSpeechResults = (e) => {
      const final = e.value?.[0] ?? '';
      setText(final);
      setIsRecording(false);
      stopPulse();
    };

    Voice.onSpeechError = (_e) => {
      setIsRecording(false);
      stopPulse();
      // On Android: if speech recognition fails, fall back to text-only mode
      if (Platform.OS === 'android') {
        setAndroidFallback(true);
        setVoiceAvailable(false);
      }
    };

    return () => {
      if (Voice) {
        Voice.destroy().then(() => Voice.removeAllListeners()).catch(() => {});
      }
    };
  }, []);

  // Reset text when modal opens with new initialText
  useEffect(() => {
    if (visible) {
      setText(initialText);
    }
  }, [visible, initialText]);

  // Stop recording if modal closes unexpectedly
  useEffect(() => {
    if (!visible && isRecording) {
      handleStopRecording();
    }
  }, [visible]);

  // ─── Pulse animation ─────────────────────────────────────────────────────

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  // ─── Recording handlers ──────────────────────────────────────────────────

  async function handleStartRecording() {
    if (!Voice || !voiceAvailable) return;
    try {
      setText('');
      setIsRecording(true);
      startPulse();
      await Voice.start('zh-Hans-CN');
    } catch (_e) {
      setIsRecording(false);
      stopPulse();
      if (Platform.OS === 'android') {
        setAndroidFallback(true);
        setVoiceAvailable(false);
      }
    }
  }

  async function handleStopRecording() {
    if (!Voice || !isRecording) return;
    try {
      await Voice.stop();
    } catch (_e) {
      // ignore
    }
    setIsRecording(false);
    stopPulse();
  }

  function handleReset() {
    if (isRecording) handleStopRecording();
    setText('');
  }

  function handleConfirm() {
    if (isRecording) handleStopRecording();
    onConfirm(text.trim());
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  const charCount = text.length;
  const showCharWarn = charCount >= WARN_THRESHOLD;
  const remaining = MAX_CHARS - charCount;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kvWrapper}
        >
          <SafeAreaView style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>语音 / 文字输入</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Text area */}
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textArea}
                value={text}
                onChangeText={(t) => setText(t.slice(0, MAX_CHARS))}
                placeholder={androidFallback ? '请在此输入陈述内容……' : '长按下方按钮录音，转写结果显示在这里，可直接编辑……'}
                placeholderTextColor={colors.stone}
                multiline
                textAlignVertical="top"
              />
              {/* Char count / warning */}
              <View style={styles.charCountRow}>
                {showCharWarn && (
                  <Text style={styles.charWarn}>⚠️ 剩余 {remaining} 字</Text>
                )}
                <Text style={[styles.charCount, charCount >= MAX_CHARS && styles.charCountOver]}>
                  {charCount} / {MAX_CHARS}
                </Text>
              </View>
            </View>

            {/* Voice recording button (hidden on Android fallback) */}
            {!androidFallback && (
              <View style={styles.recordSection}>
                {isRecording && (
                  <View style={styles.waveRow}>
                    {[0.6, 1, 0.8, 1.2, 0.7].map((scale, i) => (
                      <Animated.View
                        key={i}
                        style={[
                          styles.waveDot,
                          {
                            transform: [{ scale: Animated.multiply(pulseAnim, scale) }],
                            backgroundColor: colors.error,
                          },
                        ]}
                      />
                    ))}
                    <Text style={styles.recordingLabel}>正在录音…</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                  onPressIn={handleStartRecording}
                  onPressOut={handleStopRecording}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.recordBtnText, isRecording && styles.recordBtnTextActive]}>
                    {isRecording ? '松开停止' : '长按录音'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.recordHint}>
                  {voiceAvailable ? '按住不动录音，松手自动识别' : '语音功能初始化中…'}
                </Text>
              </View>
            )}

            {/* Bottom actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>重新录音</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !text.trim() && styles.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={!text.trim()}
              >
                <Text style={styles.confirmBtnText}>确认</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  kvWrapper: {
    width: '100%',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.black,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.stone,
  },
  textAreaWrapper: {
    backgroundColor: colors.stoneLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  textArea: {
    fontSize: 16,
    color: colors.black,
    lineHeight: 26,
    minHeight: 120,
    maxHeight: 200,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  charWarn: {
    fontSize: 12,
    color: colors.warning,
  },
  charCount: {
    fontSize: 12,
    color: colors.stone,
  },
  charCountOver: {
    color: colors.error,
  },
  recordSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  waveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingLabel: {
    fontSize: 13,
    color: colors.error,
    marginLeft: 8,
  },
  recordBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 50,
    width: 140,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryMid,
  },
  recordBtnActive: {
    backgroundColor: '#FDECEA',
    borderColor: colors.error,
  },
  recordBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  recordBtnTextActive: {
    color: colors.error,
  },
  recordHint: {
    fontSize: 12,
    color: colors.stone,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: colors.stoneLight,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 15,
    color: colors.stone,
    fontWeight: '500',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.primaryMid,
  },
  confirmBtnText: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '600',
  },
});
