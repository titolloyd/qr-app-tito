import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '@/constants/colors';

type AppButtonProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({
  title,
  icon,
  theme,
  onPress,
  disabled = false,
}: AppButtonProps) {
  const isPrimary = theme === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && styles.pressedButton,
      ]}
    >
      <View style={styles.buttonInner}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={
              isPrimary
                ? COLORS.textOnPrimary
                : COLORS.textPrimary
            }
          />
        ) : null}

        <Text
          style={[
            styles.text,
            isPrimary ? styles.primaryText : styles.secondaryText,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    overflow: 'hidden',
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  buttonInner: {
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  text: {
    fontSize: 15,
  },

  primaryText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },

  secondaryText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  disabledButton: {
    opacity: 0.5,
  },

  pressedButton: {
    opacity: 0.75,
  },
});