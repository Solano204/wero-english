import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, Header, Screen } from '@/components/base';
import { EntryRow } from '@/components/list';
import { getStuckEntries } from '@/db/queries';
import { useAuthStore } from '@/store';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-14, las que se atoran.
 *
 * Sin cronómetro y sin calificación: aquí el usuario solo lee y escucha.
 * Convertir esto en otro examen es exactamente lo contrario de lo que
 * necesita alguien que ya falló la frase cinco veces.
 */
export function StuckScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<{ entry: Entry; fallos: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getStuckEntries(user.id, 3, 30).then(setItems);
    }, [user])
  );

  if (items.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Se me atoran" />
        <EmptyState
          icon="check"
          title="Ninguna por ahora"
          body="Cuando falles la misma frase tres veces, aparecerá aquí para que la repases con calma."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title="Se me atoran"
        subtitle={`${items.length} frases`}
      />
      <Text style={styles.intro}>
        Sin cronómetro ni calificación. Léelas, escúchalas y ya.
      </Text>

      <View style={styles.list}>
        {items.map(({ entry, fallos }, i) => (
          <View key={entry.id} style={styles.slot}>
            <EntryRow
              entry={entry}
              index={i}
              showSpanishAudio
              onPress={(e) => nav.navigate('Detail', { entryId: e.id })}
            />
            <Text style={styles.count}>{fallos} fallos</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  list: { gap: space.sm },
  slot: { gap: 2 },
  count: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.riskWarn,
    marginLeft: space.md,
  },
});
