import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';

export default function Input({ label, secureTextEntry, error, icon, style, dark, ...props }) {
  const [hidden, setHidden] = useState(secureTextEntry);
  const [focused, setFocused] = useState(false);

  const bg     = dark ? COLORS.surface      : COLORS.white;
  const border = error  ? COLORS.danger
               : focused ? COLORS.accent
               : dark    ? COLORS.surfaceBorder
               :           COLORS.border;
  const textClr = dark ? COLORS.white   : COLORS.textPrimary;
  const labelClr = dark ? 'rgba(255,255,255,0.55)' : COLORS.textSecondary;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: labelClr }]}>{label}</Text>}
      <View style={[styles.inputWrapper, { backgroundColor: bg, borderColor: border }]}>
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.accent : COLORS.textLight}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, { color: textClr }]}
          secureTextEntry={hidden}
          placeholderTextColor={dark ? 'rgba(255,255,255,0.3)' : COLORS.textLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.eyeBtn}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={COLORS.textLight}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { marginBottom: 14 },
  label:        { fontSize: 12, fontWeight: '600', marginBottom: 7, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    minHeight: 52,
  },
  icon:     { marginRight: 10 },
  input:    { flex: 1, fontSize: 15 },
  eyeBtn:   { padding: 4 },
  errorText:{ fontSize: 12, color: COLORS.danger, marginTop: 5 },
});
