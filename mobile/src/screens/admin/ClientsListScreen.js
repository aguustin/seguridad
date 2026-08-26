import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClients, getNeighborhoods, deactivateClient } from '../../services/api';
import ClientCard from '../../components/ClientCard';
import { COLORS } from '../../config/constants';

/**
 * Gestión administrativa de clientes: listar, buscar, filtrar por barrio,
 * editar y dar de baja. Mismo patrón que SecurityListScreen (buscador +
 * chips de barrio + FlatList + tarjeta con acciones) — el detalle de un
 * cliente se consulta abriendo directamente su formulario de edición
 * (mismo criterio que ya usa "Editar guardia": no hay una pantalla de
 * solo-lectura separada, el formulario precargado ya cumple ese rol).
 */
export default function ClientsListScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Llamada inicial explícita + recarga en cada foco (ej. al volver de
    // "Nuevo cliente" o de editar uno) — mismo patrón que AdminDashboardScreen,
    // ya que el listener de 'focus' solo no dispara con el foco inicial.
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, selectedNeighborhood]);

  async function loadData() {
    try {
      const [clientsRes, neighborRes] = await Promise.all([
        getClients(selectedNeighborhood),
        getNeighborhoods(),
      ]);
      setClients(clientsRes.data);
      setNeighborhoods(neighborRes.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function confirmDeactivate(id, name) {
    Alert.alert('Dar de baja', `¿Dar de baja a ${name}? Ya no va a poder iniciar sesión.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Dar de baja', style: 'destructive',
        onPress: async () => {
          try {
            await deactivateClient(id);
            setClients((prev) => prev.filter((c) => c.id !== id));
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || err.message);
          }
        },
      },
    ]);
  }

  const filtered = clients.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.username}`.toLowerCase().includes(search.toLowerCase())
  );

  const filterData = [{ id: null, name: 'Todos' }, ...neighborhoods];

  return (
    <View style={styles.container}>
      {/* Buscador */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente..."
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

      {/* Filtro por barrio */}
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
        <View style={{ width: 24 }} />
      </ScrollView>

      {/* Lista de clientes */}
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
            No hay clientes{selectedNeighborhood ? ' en este barrio' : ''}
          </Text>
        }
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={() => navigation.navigate('EditClient', { client: item })}
            onEdit={() => navigation.navigate('EditClient', { client: item })}
            onDeactivate={() =>
              confirmDeactivate(item.id, `${item.firstName} ${item.lastName}`)
            }
          />
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('RegisterClient')}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add" size={24} color={COLORS.primary} />
      </TouchableOpacity>
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

  list:  { paddingHorizontal: 16, paddingBottom: 90 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 60, fontSize: 14 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
});
