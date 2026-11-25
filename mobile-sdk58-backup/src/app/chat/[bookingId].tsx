import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useBooking, useMe, useMessages, useSendMessage } from "@/api/hooks";
import type { Message } from "@/api/types";
import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Banner, EmptyState, ErrorState, LoadingState } from "@/components/States";
import { TopBar } from "@/components/TopBar";
import { useLocale } from "@/i18n/locale";
import { textDirection } from "@/lib/bidi";
import { errorMessage } from "@/lib/errors";
import { formatMessageTime } from "@/lib/format";
import { realtime } from "@/realtime/store";
import { color, font, radius, space } from "@/theme";

const MAX_LENGTH = 1000;
const CHAT_OPEN = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

export default function ChatScreen() {
  const { t } = useTranslation();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data: me } = useMe();
  const booking = useBooking(bookingId);
  const messages = useMessages(bookingId);

  // While this chat is on screen, its messages aren't "unread".
  useFocusEffect(
    useCallback(() => {
      realtime.openChat(bookingId);
      return () => realtime.closeChat(bookingId);
    }, [bookingId]),
  );

  const isCustomer = booking.data?.customer.id === me?.user.id;
  const other = isCustomer ? booking.data?.technician : booking.data?.customer;
  const fallbackName = isCustomer ? t("booking.technician") : t("booking.customer");
  const open = !!booking.data && CHAT_OPEN.includes(booking.data.status);

  const header = (
    <TopBar
      title={other?.name ?? fallbackName}
      end={
        other && open ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${other.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={t("booking.call")}
            hitSlop={8}
            style={({ pressed }) => [styles.call, pressed && styles.pressed]}
          >
            <Icon name="call-outline" size={22} color={color.oasis} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (messages.isPending || booking.isPending) {
    return (
      <Screen header={header} scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (messages.isError || booking.isError) {
    return (
      <Screen header={header} scroll={false}>
        <ErrorState
          error={messages.error ?? booking.error}
          onRetry={() => {
            void messages.refetch();
            void booking.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      scroll={false}
      contentStyle={styles.content}
      footer={
        open ? (
          <Composer bookingId={bookingId} />
        ) : (
          <Banner>{booking.data.status === "PENDING" ? t("chat.notOpenYet") : t("chat.closed")}</Banner>
        )
      }
    >
      <MessageList messages={messages.data.messages} myId={me?.user.id} />
    </Screen>
  );
}

function MessageList({ messages, myId }: { messages: Message[]; myId: string | undefined }) {
  const { t } = useTranslation();
  // Inverted list: newest at the bottom, and it stays pinned there as messages arrive.
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);

  if (messages.length === 0) {
    return <EmptyState icon="chatbubbles-outline" title={t("chat.emptyTitle")} hint={t("chat.emptyHint")} />;
  }
  return (
    <FlatList
      testID="messages"
      data={newestFirst}
      inverted
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <Bubble message={item} mine={item.senderId === myId} />}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
    />
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  return (
    <View
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
      accessible
      accessibilityLabel={`${mine ? t("chat.you") : ""} ${message.body}, ${formatMessageTime(message.createdAt, lang)}`}
    >
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <AppText color={mine ? color.white : color.ink} textDirection={textDirection(message.body)}>
          {message.body}
        </AppText>
      </View>
      <AppText variant="caption" color={color.inkFaint}>
        {formatMessageTime(message.createdAt, lang)}
      </AppText>
    </View>
  );
}

function Composer({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const { dir } = useLocale();
  const send = useSendMessage(bookingId);
  const [draft, setDraft] = useState("");
  const body = draft.trim();
  const canSend = body.length > 0 && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    send.mutate(body, { onSuccess: () => setDraft("") });
  };

  return (
    <View style={styles.composerWrap}>
      {send.isError && <Banner tone="error">{errorMessage(t, send.error)}</Banner>}
      <View style={styles.composer}>
        <TextInput
          testID="message-input"
          {...(Platform.OS === "web" ? ({ dir } as object) : null)}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={color.inkFaint}
          accessibilityLabel={t("chat.placeholder")}
          selectionColor={color.oasis}
          multiline
          maxLength={MAX_LENGTH}
          style={styles.input}
          onSubmitEditing={submit}
          submitBehavior={Platform.OS === "web" ? "submit" : "newline"}
        />
        <Pressable
          testID="send-message"
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t("chat.send")}
          accessibilityState={{ disabled: !canSend, busy: send.isPending }}
          style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && styles.sendPressed]}
        >
          <Icon name="send" size={20} color={color.white} directional />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, paddingBottom: 0, gap: 0 },
  list: { padding: space.lg, gap: space.md },
  row: { maxWidth: "82%", gap: 2 },
  rowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  mine: { backgroundColor: color.oasis, borderBottomEndRadius: radius.sm },
  theirs: { backgroundColor: color.surface, borderBottomStartRadius: radius.sm },
  composerWrap: { gap: space.sm },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    backgroundColor: color.ground,
    outlineWidth: 0,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.oasis,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendPressed: { backgroundColor: color.oasisPressed },
  call: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: color.oasisTint },
});
