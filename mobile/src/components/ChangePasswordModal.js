import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { changePassword } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Input from './Input';
import Button from './Button';
import { COLORS } from '../config/constants';

/**
 * Cambio de contraseña — compartido entre AdminDashboardScreen y
 * ClientDashboardScreen (los dos únicos roles con contraseña; los guardias
 * se autentican por reconocimiento facial, ver authController.changePassword).
 * Mismo patrón de modal-hoja-inferior que ya usan otras pantallas
 * (VisitsScreen, VisitInvitationScreen, ClientDashboardScreen → contacto).
 *
 * Al confirmar el cambio, cierra la sesión local y pide volver a loguearse
 * con la contraseña nueva — el JWT vigente en este dispositivo seguiría
 * siendo válido igual (el proyecto no tiene revocación de tokens, ver
 * decisión documentada en el resumen de la etapa), pero al menos este
 * dispositivo queda consistente de inmediato con la contraseña recién
 * puesta, en vez de seguir "logueado" con la vieja hasta que el token
 * expire solo.
 */
export default function ChangePasswordModal({ visible, onClose }) {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSave() {
    if (!currentPassword || !newPassword) {
      return Alert.alert('Error', 'Completá tu contraseña actual y la nueva');
    }
    if (newPassword.length < 6) {
      return Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Error', 'Las contraseñas nuevas no coinciden');
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      reset();
      onClose();
      Alert.alert(
        'Contraseña actualizada',
        'Iniciá sesión de nuevo con tu nueva contraseña.',
        [{ text: 'OK', onPress: logout }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <Input
            dark label="Contraseña actual" value={currentPassword} onChangeText={setCurrentPassword}
            icon="lock-closed-outline" secureTextEntry
          />
          <Input
            dark label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword}
            icon="key-outline" secureTextEntry placeholder="Mínimo 6 caracteres"
          />
          <Input
            dark label="Confirmar nueva contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
            icon="key-outline" secureTextEntry
          />

          <Button title="Guardar" onPress={handleSave} loading={saving} style={{ marginTop: 14 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
});
