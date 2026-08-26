import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../../config/constants';
import { getMyPatrolDetail } from '../../services/api';
import PatrolSessionDetailView from '../../components/PatrolSessionDetailView';

/**
 * Detalle de una ronda del historial propio del guardia.
 * Solo lectura — no permite registrar checkpoints ni finalizar (eso es
 * exclusivo de la ronda EN CURSO, en PatrolScreen).
 */
export default function PatrolHistoryDetailScreen({ route }) {
  const { patrolSessionId } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [patrolSessionId]);

  async function load() {
    setError('');
    try {
      const { data } = await getMyPatrolDetail(patrolSessionId);
      setData(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cargar el detalle de la ronda');
    }
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PatrolSessionDetailView data={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryDark, padding: 24 },
  errorText: { fontSize: 14, color: COLORS.danger, textAlign: 'center' },
});
