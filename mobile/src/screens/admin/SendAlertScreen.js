import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendAlert, getNeighborhoods, getSecurityStaff } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

export default function SendAlertScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [staff, setStaff] = useState([]);
  const [targetNeighborhoodId, setTargetNeighborhoodId] = useState(null);
  const [targetSecurityId, setTargetSecurityId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getNeighborhoods().then((r) => setNeighborhoods(r.data)).catch(() => {});
    getSecurityStaff().then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  function selectNeighborhood(id) {
    setTargetNeighborhoodId((prev) => (prev === id ? null : id));
    setTargetSecurityId(null);
  }

  function selectGuard(id) {
    setTargetSecurityId((prev) => (prev === id ? null : id));
    setTargetNeighborhoodId(null);
  }

  async function handleSend() {
    if (!title || !message) {
      return Alert.alert('Error', 'Completá título y mensaje');
    }

    Alert.alert(
      'Confirmar alerta',
      '¿Enviar alerta? Los guardias recibirán una notificación con sonido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await sendAlert({ title, message, targetNeighborhoodId, targetSecurityId });
              Alert.alert('Enviada', 'Alerta enviada correctamente');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const filteredStaff = targetNeighborhoodId
    ? staff.filter((s) => s.neighborhoodId === targetNeighborhoodId)
    : staff;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Ionicons name="megaphone" size={32} color={COLORS.white} />
        <Text style={styles.bannerText}>Los guardias recibirán una notificación sonora</Text>
      </View>

      <Input dark label="Título de la alerta" value={title} onChangeText={setTitle} placeholder="Ej: Atención guardia" />
      <Input
        dark
        label="Mensaje"
        value={message}
        onChangeText={setMessage}
        placeholder="Descripción de la alerta..."
        multiline
        numberOfLines={4}
        style={{ height: 100 }}
      />

      <Text style={styles.sectionLabel}>Destino (opcional)</Text>
      <Text style={styles.hint}>Si no seleccionás, la alerta va a todos los guardias</Text>

      <Text style={styles.subLabel}>Por barrio:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {neighborhoods.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.chip, targetNeighborhoodId === n.id && styles.chipActive]}
              onPress={() => selectNeighborhood(n.id)}
            >
              <Text style={[styles.chipText, targetNeighborhoodId === n.id && styles.chipTextActive]}>
                {n.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.subLabel}>Guardia individual:</Text>
      {filteredStaff.slice(0, 10).map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.guardRow, targetSecurityId === s.id && styles.guardRowActive]}
          onPress={() => selectGuard(s.id)}
        >
          <Ionicons
            name={targetSecurityId === s.id ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={targetSecurityId === s.id ? COLORS.accent : 'rgba(255,255,255,0.3)'}
          />
          <Text style={styles.guardName}>{s.firstName} {s.lastName}</Text>
          {s.neighborhood && (
            <Text style={styles.guardNeighborhood}>{s.neighborhood.name}</Text>
          )}
        </TouchableOpacity>
      ))}

      <Button
        title="Enviar alerta"
        onPress={handleSend}
        loading={loading}
        style={[styles.btn, { backgroundColor: COLORS.danger }]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content: { padding: 20, paddingBottom: 40 },
  banner: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  bannerText:       { color: COLORS.white, fontWeight: '600', flex: 1 },
  sectionLabel:     { fontSize: 15, fontWeight: '700', color: COLORS.white, marginTop: 8 },
  hint:             { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12, marginTop: 2 },
  subLabel:         { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: 8, marginTop: 10 },
  chipRow:          { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive:       { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:         { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  chipTextActive:   { color: COLORS.primary, fontWeight: '700' },
  guardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
  },
  guardRowActive:      { borderColor: COLORS.accent, backgroundColor: 'rgba(252,211,77,0.08)' },
  guardName:           { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.white },
  guardNeighborhood:   { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  btn: { marginTop: 20 },
});
