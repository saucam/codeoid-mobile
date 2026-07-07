import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { identityLabel } from "@codeoid/core";
import type { SessionMessage } from "@codeoid/protocol";

import { getConnection, mintClientMsgId, type Connection } from "@/lib/connection";
import { useConnectionStatus, useTranscript } from "@/lib/hooks";
import { palette } from "@/lib/theme";

// Transcript view: attach on entry (incremental resume when a cursor exists),
// live-render via MessageStore.ingest(), detach on leave. Plain-text rows
// first (design doc §10 P1) — FlashList + streaming markdown arrive in P2.
export default function SessionScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const conn = getConnection();
  if (!conn || !id) return <Redirect href="/" />;
  return <Transcript conn={conn} sessionId={id} sessionName={name ?? id} />;
}

function Transcript({
  conn,
  sessionId,
  sessionName,
}: {
  conn: Connection;
  sessionId: string;
  sessionName: string;
}) {
  const insets = useSafeAreaInsets();
  const status = useConnectionStatus(conn);
  const messages = useTranscript(conn, sessionId);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SessionMessage>>(null);

  // (Re-)attach on every `connected` transition — the initial entry and any
  // reconnect (a dropped socket loses the attachment). The resume cursor
  // turns re-attach replays into incremental tails instead of full snapshots.
  useEffect(() => {
    if (status.kind !== "connected") return;
    const resume = conn.cursors.resumeFor(sessionId);
    conn.client
      .request({
        type: "session.attach",
        id: conn.client.nextId(),
        sessionId,
        ...(resume ? { resume } : {}),
      })
      .then(() => setAttachError(null))
      .catch((err) => setAttachError(err instanceof Error ? err.message : String(err)));
  }, [conn, sessionId, status.kind]);

  // Detach on leave so the daemon stops fanning broadcasts to this client.
  useEffect(
    () => () => {
      if (conn.client.status.kind !== "connected") return;
      try {
        conn.client.send({ type: "session.detach", id: conn.client.nextId(), sessionId });
      } catch {
        // Socket raced shut mid-teardown — the daemon reaps dead attachments.
      }
    },
    [conn, sessionId],
  );

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text || conn.client.status.kind !== "connected") return;
    setDraft("");
    conn.client
      .request({
        type: "session.send",
        id: conn.client.nextId(),
        sessionId,
        text,
        clientMsgId: mintClientMsgId(),
      })
      .then(() => setSendError(null))
      .catch((err) => setSendError(err instanceof Error ? err.message : String(err)));
  }, [conn, draft, sessionId]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Sessions</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {sessionName}
        </Text>
        <Text style={styles.status}>{status.kind === "connected" ? "" : status.kind}</Text>
      </View>

      {attachError ? <Text style={styles.error}>attach failed: {attachError}</Text> : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.messageId}
        renderItem={({ item }) => <MessageRow msg={item} />}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.empty}>Waiting for scrollback…</Text>}
      />

      {sendError ? <Text style={styles.error}>send failed: {sendError}</Text> : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder="Message the session…"
          placeholderTextColor={palette.textDim}
          multiline
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable
          style={[styles.sendButton, !draft.trim() && styles.sendDisabled]}
          disabled={!draft.trim()}
          onPress={onSend}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageRow({ msg }: { msg: SessionMessage }) {
  const who = identityLabel(msg.identity);
  if (msg.role === "tool_call" && msg.tool) {
    const { tool } = msg;
    const detail =
      tool.state.phase === "waiting_confirmation"
        ? `awaiting approval — ${tool.state.description}`
        : tool.state.phase === "completed"
          ? tool.state.success
            ? "ok"
            : "failed"
          : tool.state.phase;
    return (
      <View style={styles.row}>
        <Text style={styles.meta}>
          {who} · tool: {tool.name}
        </Text>
        <Text style={styles.toolText}>
          [{detail}]{msg.content ? `\n${msg.content}` : ""}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={styles.meta}>
        {who} · {msg.role}
      </Text>
      <Text style={[styles.content, msg.role === "user" && styles.userContent]}>
        {msg.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  back: { fontSize: 15, color: palette.accent },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: palette.text },
  status: { fontSize: 12, color: palette.amber },
  listContent: { padding: 16, gap: 14 },
  row: { gap: 4 },
  meta: { fontSize: 12, color: palette.textDim },
  content: { fontSize: 15, lineHeight: 21, color: palette.text },
  userContent: { color: palette.accent },
  toolText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.textDim,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  empty: { textAlign: "center", color: palette.textDim, marginTop: 48, fontSize: 14 },
  error: { color: palette.red, fontSize: 12, paddingHorizontal: 16, paddingVertical: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.bg,
  },
  sendButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.accent,
  },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { fontSize: 15, fontWeight: "600", color: palette.bg },
});
