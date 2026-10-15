
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
};

export default function Header({ title }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <MaterialIcons
          name="qr-code-scanner"
          size={34}
          color={COLORS.primary}
        />
      </View>

      <Text style={styles.title}>{title}</Text>

      <Text style={styles.subtitle}>
        School Event Attendance
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
