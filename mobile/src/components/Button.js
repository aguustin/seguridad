import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { COLORS } from '../config/constants';

export default function Button({ title, onPress, loading, variant = 'primary', style, textStyle, disabled, icon }) {
  const variants = {
    primary:   { bg: COLORS.accent,        text: COLORS.textOnAccent, border: 'transparent' },
    secondary: { bg: COLORS.primaryLight,  text: COLORS.white,        border: 'transparent' },
    danger:    { bg: COLORS.danger,        text: COLORS.white,        border: 'transparent' },
    outline:   { bg: 'transparent',        text: COLORS.accent,       border: COLORS.accent },
    ghost:     { bg: 'rgba(252,211,77,.1)', text: COLORS.accent,      border: 'transparent' },
  };
  const v = variants[variant] || variants.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border !== 'transparent' ? 1.5 : 0 },
        (loading || disabled) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: v.text }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.5 },
});
