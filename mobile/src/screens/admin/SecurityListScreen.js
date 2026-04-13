import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSecurityStaff, getNeighborhoods, deactivateSecurityStaff, assignOperator } from '../../services/api';
import SecurityCard from '../../components/SecurityCard';
import { COLORS } from '../../config/constants';

export default function SecurityListScreen({ navigation }) {
  const [staff, setStaff] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, [selectedNeighborhood]);

  async function loadData() {
    try {
      const [staffRes, neighborRes] = await Promise.all([
        getSecurityStaff(selectedNeighborhood),
        getNeighborhoods(),
      ]);
      setStaff(staffRes.data);
      setNeighborhoods(neighborRes.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function confirmAssignOperator(id, name) {
    Alert.alert(
      'Asignar operador',
      `¿Asignar a ${name} como operador? Esto le dará control sobre el estado de los guardias activos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Asignar',
          onPress: async () => {
            try {
              await assignOperator(id);
              setStaff((prev) =>
                prev.map((s) => ({ ...s, isOperator: s.id === id }))
              );
              Alert.alert('Operador asignado', `${name} es ahora el operador activo.`);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || err.message);
            }
          },
        },
      ]
    );
  }

  function confirmDeactivate(id, name) {
    Alert.alert('Dar de baja', `¿Dar de baja a ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Dar de baja', style: 'destructive',
        onPress: async () => {
          try {
            await deactivateSecurityStaff(id);
            setStaff((prev) => prev.filter((s) => s.id !== id));
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  const filtered = staff.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const filterData = [{ id: null, name: 'Todos' }, ...neighborhoods];

  return (
    <View style={styles.container}>
      {/* Buscador */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar guardia..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtro por barrio — carousel horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        style={styles.filterScroll}
      >
        {filterData.map((item) => {
          const active = selectedNeighborhood === item.id;
          return (
            <TouchableOpacity
              key={String(item.id)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedNeighborhood(item.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Espacio extra al final para que el último chip se vea parcialmente */}
        <View style={{ width: 24 }} />
      </ScrollView>

      {/* Lista de guardias */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No hay guardias{selectedNeighborhood ? ' en este barrio' : ''}
          </Text>
        }
        renderItem={({ item }) => (
          <SecurityCard
            staff={item}
            onEdit={() => navigation.navigate('EditSecurity', { staff: item })}
            onHistory={() =>
              navigation.navigate('AttendanceHistory', {
                staffId: item.id,
                name: `${item.firstName} ${item.lastName}`,
              })
            }
            onDeactivate={() =>
              confirmDeactivate(item.id, `${item.firstName} ${item.lastName}`)
            }
            onAssignOperator={() =>
              confirmAssignOperator(item.id, `${item.firstName} ${item.lastName}`)
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 16, marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    gap: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.white },

  filterScroll: { flexGrow: 0 },
  filterList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceBorder,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },

  list:  { paddingHorizontal: 16, paddingBottom: 30 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 60, fontSize: 14 },
});
