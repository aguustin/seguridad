import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getClientChat } from '../../services/api';
import { getSocket, sendMessage, joinClientChat } from '../../services/socket';
import { COLORS } from '../../config/constants';

export default function ClientChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const socket = getSocket();
    if (!socket) return;

    joinClientChat(user.id);

    socket.on('new_message', (msg) => {
      if (msg.roomType === 'client_admin' && msg.roomId === user.id) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => socket.off('new_message');
  }, []);

  async function loadMessages() {
    try {
      const { data } = await getClientChat({ limit: 50 });
      setMessages(data.rows);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
  }

  function handleSend() {
    const content = text.trim();
    if (!content) return;
    sendMessage('client_admin', user.id, content);
    setText('');
  }

  const renderMsg = ({ item }) => {
    const isMe = item.senderType === 'client';
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        {!isMe && (
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.white} />
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleAdmin]}>
          {!isMe && <Text style={styles.adminName}>Seguridad</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
        </View>
        <Text style={[styles.msgTime, isMe ? styles.msgTimeRight : styles.msgTimeLeft]}>
          {new Date(item.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Seguridad del barrio</Text>
          <Text style={styles.headerSub}>Comunicación directa con administración</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMsg}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={50} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyTitle}>Sin mensajes aún</Text>
            <Text style={styles.emptyText}>Podés escribirle a los administradores del barrio</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escribí tu consulta..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  header: {
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  list:       { padding: 16, paddingBottom: 8, gap: 8, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  emptyText:  { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  msgWrapper: { maxWidth: '80%' },
  msgLeft:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  msgRight:   { alignSelf: 'flex-end' },

  adminBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.info,
    justifyContent: 'center', alignItems: 'center',
  },
  bubble:      { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:    { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleAdmin: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  adminName:   { fontSize: 11, fontWeight: '700', color: COLORS.info, marginBottom: 2 },
  msgText:     { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  msgTextMe:   { color: COLORS.primary, fontWeight: '500' },
  msgTime:     { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  msgTimeRight:{ alignSelf: 'flex-end' },
  msgTimeLeft: { marginLeft: 30 },

  inputBar: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: COLORS.surface,
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.white,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  sendBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.surfaceBorder },
});
