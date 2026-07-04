import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

// Placeholder connect screen. See docs/mobile-app-design.md §5 (Connection & auth):
// enter daemon URL -> GET /config to discover ZeroID -> API key or Google OAuth ->
// store token in the device keychain (expo-secure-store) -> WS attach.
export default function Connect() {
  const [daemonUrl, setDaemonUrl] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Codeoid</Text>
      <Text style={styles.subtitle}>Connect to your daemon</Text>
      <TextInput
        style={styles.input}
        placeholder="https://myserver.example.com  ·  http://192.168.1.x:7400"
        placeholderTextColor="#8a8f98"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={daemonUrl}
        onChangeText={setDaemonUrl}
      />
      <Text style={styles.hint}>Scaffold only — not yet functional.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 34, fontWeight: "700" },
  subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 12 },
  input: {
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: "#3a3f47",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  hint: { fontSize: 13, opacity: 0.5, marginTop: 8 },
});
