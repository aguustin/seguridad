import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSecurityChat } from '../../services/api';
import { getSocket, sendMessage } from '../../services/socket';
import { COLORS } from '../../config/constants';

export default function SecurityChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const socket = getSocket();
    if (!socket) return;

    socket.on('new_message', (msg) => {
      if (msg.roomType === 'security_chat' && msg.roomId === user.neighborhoodId) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => socket.off('new_message');
  }, []);

  async function loadMessages() {
    try {
      const { data } = await getSecurityChat({ limit: 50 });
      setMessages(data.rows);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err) {
      console.error(err);
    }
  }

  function handleSend() {
    const content = text.trim();
    if (!content) return;
    sendMessage('security_chat', user.neighborhoodId, content);
    setText('');
  }

  const renderMsg = ({ item }) => {
    const isMe = item.senderId === user.id;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
        </View>
        <Text style={styles.msgTime}>
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
        <Ionicons name="people" size={22} color={COLORS.white} />
        <Text style={styles.headerTitle}>Chat del barrio</Text>
        <Text style={styles.headerSub}>Solo guardias activos en turno</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMsg}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay mensajes aún. ¡Saludá a tus compañeros!</Text>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          onSubmitEditing={handleSend}
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
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  list:  { padding: 16, paddingBottom: 8, gap: 8 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40, fontSize: 14 },

  msgWrapper:  { maxWidth: '80%' },
  msgLeft:     { alignSelf: 'flex-start' },
  msgRight:    { alignSelf: 'flex-end' },
  senderName:  { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2, marginLeft: 4 },

  bubble:      { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:    { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  msgText:    { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  msgTextMe:  { color: COLORS.primary, fontWeight: '500' },
  msgTime:    { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, alignSelf: 'flex-end' },

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
