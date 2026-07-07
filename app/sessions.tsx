import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sessionAgentLabel } from "@codeoid/core";
import { PROTOCOL_VERSION, type SessionInfo } from "@codeoid/protocol";

import { clearCredentials } from "@/lib/auth";
import { closeConnection, getConnection } from "@/lib/connection";
import { useConnectionStatus, useSessions } from "@/lib/hooks";
import { palette, statusColor } from "@/lib/theme";

// Fleet view (design doc §8): the session list. Attach-on-select opens the
// transcript; the conductor home surface arrives in P5.
export default function Sessions() {
  const conn = getConnection();
  if (!conn) return <Redirect href="/" />;
  return <SessionList conn={conn} />;
}

function SessionList({ conn }: { conn: NonNullable<ReturnType<typeof getConnection>> }) {
  const insets = useSafeAreaInsets();
  const status = useConnectionStatus(conn);
  const { sessions, error, refresh } = useSessions(conn);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const daemonHost = conn.daemonUrl.replace(/^https?:\/\//, "");
  const protocolMismatch =
    status.kind === "connected" &&
    status.auth.protocolVersion !== undefined &&
    status.auth.protocolVersion !== PROTOCOL_VERSION;

  const signOut = async () => {
    closeConnection();
    await clearCredentials();
    router.replace("/");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Sessions</Text>
          <Text style={styles.daemon} numberOfLines={1}>
            {daemonHost} · {connectionLabel(status.kind)}
          </Text>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {status.kind === "reconnecting" ? (
        <Banner text={`Reconnecting (attempt ${status.attempt})…`} />
      ) : null}
      {protocolMismatch && status.kind === "connected" ? (
        <Banner
          text={`Daemon speaks protocol v${status.auth.protocolVersion}, app speaks v${PROTOCOL_VERSION}.`}
        />
      ) : null}
      {error ? <Banner text={error} tone="error" /> : null}

      <FlatList
        data={sessions ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SessionRow session={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={palette.textDim}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {sessions === null ? "Loading sessions…" : "No sessions on this daemon."}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      />
    </View>
  );
}

function SessionRow({ session }: { session: SessionInfo }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        router.push({
          pathname: "/session/[id]",
          params: { id: session.id, name: session.name },
        })
      }
    >
      <View style={[styles.statusDot, { backgroundColor: statusColor(session.status) }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {session.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {sessionAgentLabel(session)} · {session.workdir}
        </Text>
      </View>
      <Text style={styles.rowStatus}>{session.status}</Text>
    </Pressable>
  );
}

function Banner({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  return (
    <View style={[styles.banner, tone === "error" && styles.bannerError]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function connectionLabel(kind: string): string {
  switch (kind) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting…";
    case "reconnecting":
      return "reconnecting…";
    default:
      return kind;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: palette.text },
  daemon: { fontSize: 13, color: palette.textDim, marginTop: 2 },
  signOut: { fontSize: 14, color: palette.accent },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  bannerError: { borderColor: palette.red },
  bannerText: { fontSize: 13, color: palette.textDim },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  rowPressed: { backgroundColor: palette.surface },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: "600", color: palette.text },
  rowMeta: { fontSize: 13, color: palette.textDim, marginTop: 2 },
  rowStatus: { fontSize: 12, color: palette.textDim },
  empty: { textAlign: "center", color: palette.textDim, marginTop: 48, fontSize: 14 },
});
