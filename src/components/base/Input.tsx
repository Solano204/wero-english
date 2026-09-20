import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { color, font, layout, radius, space } from '@/theme';
import { Presionable } from './Presionable';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  secureToggle?: boolean;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, secureToggle, style, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureToggle));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.focused,
          Boolean(error) && styles.errored,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={color.textFaint}
          selectionColor={color.accent}
          secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {secureToggle ? (
          <Presionable
            onPress={() => setHidden((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Text style={styles.toggle}>{hidden ? 'Ver' : 'Ocultar'}</Text>
          </Presionable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: {
    fontSize: font.size.sm,
    color: color.textMuted,
    fontFamily: font.family.body,
    marginLeft: space.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tapMin,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  focused: { borderColor: color.accent },
  errored: { borderColor: color.riskStrong },
  input: {
    flex: 1,
    color: color.text,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    paddingVertical: space.md,
  },
  toggle: {
    color: color.accent,
    fontSize: font.size.sm,
    fontFamily: font.family.bodyStrong,
  },
  error: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.riskStrong, marginLeft: space.xs },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint, marginLeft: space.xs },
});
