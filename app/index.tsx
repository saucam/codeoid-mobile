import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { discoverDaemon, loadCredentials, saveCredentials } from "@/lib/auth";
import { openConnection } from "@/lib/connection";
import { palette } from "@/lib/theme";

// Connect screen (design doc §5): daemon URL entry → /health + /config
// discovery → ZeroID API-key exchange → token in the device keychain →
// WS attach → session list. Google OAuth is P3 (gated on codeoid #42).
export default function Connect() {
  const [daemonUrl, setDaemonUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  // "restoring" = probing stored credentials on launch, before showing the form.
  const [phase, setPhase] = useState<"restoring" | "idle" | "connecting">("restoring");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (url: string, key: string) => {
    setPhase("connecting");
    setError(null);
    try {
      const info = await discoverDaemon(url);
      await openConnection({ daemonUrl: info.daemonUrl, apiKey: key });
      await saveCredentials({ daemonUrl: info.daemonUrl, apiKey: key });
      router.replace("/sessions");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Auto-connect with stored credentials; fall back to the form on any failure.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const creds = await loadCredentials();
      if (cancelled) return;
      if (!creds) {
        setPhase("idle");
        return;
      }
      setDaemonUrl(creds.daemonUrl);
      setApiKey(creds.apiKey);
      await connect(creds.daemonUrl, creds.apiKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [connect]);

  const busy = phase !== "idle";
  const canSubmit = !busy && daemonUrl.trim().length > 0 && apiKey.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Codeoid</Text>
      <Text style={styles.subtitle}>Connect to your daemon</Text>

      <TextInput
        style={styles.input}
        placeholder="https://myserver.example.com  ·  http://192.168.1.x:7400"
        placeholderTextColor={palette.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={!busy}
        value={daemonUrl}
        onChangeText={setDaemonUrl}
      />
      <TextInput
        style={styles.input}
        placeholder="ZeroID API key (zid_sk_…)"
        placeholderTextColor={palette.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        editable={!busy}
        value={apiKey}
        onChangeText={setApiKey}
        onSubmitEditing={() => canSubmit && void connect(daemonUrl, apiKey)}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={() => void connect(daemonUrl, apiKey)}
      >
        {busy ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <Text style={styles.buttonLabel}>Connect</Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        {phase === "restoring"
          ? "Checking saved connection…"
          : "The API key is stored in the device keychain and exchanged for a short-lived token."}
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: palette.bg,
  },
  title: { fontSize: 34, fontWeight: "700", color: palette.text },
  subtitle: { fontSize: 16, color: palette.textDim, marginBottom: 12 },
  input: {
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
  },
  button: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: palette.accent,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontSize: 16, fontWeight: "600", color: palette.bg },
  error: { fontSize: 13, color: palette.red, maxWidth: 480 },
  hint: { fontSize: 13, color: palette.textDim, marginTop: 8, textAlign: "center", maxWidth: 480 },
});
