
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';

type AppButtonProps = {
  title?: string;
  label?: string;
  icon?: string;
  onPress: () => unknown;
  theme?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AppButton({
  title,
  label,
  icon,
  onPress,
  theme = 'secondary',
  disabled = false,
  loading = false,
  style,
}: AppButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const buttonTitle = title ?? label ?? '';
  const isDisabled = disabled || loading;
  const isPrimary = theme === 'primary';
  const isOutline = theme === 'outline';

  const backgroundColor = isPrimary
    ? COLORS.primary
    : isOutline
      ? COLORS.transparent
      : COLORS.cardElevated;

  const borderColor = isPrimary
    ? COLORS.primary
    : COLORS.border;

  const textColor = isPrimary
    ? COLORS.textOnPrimary
    : COLORS.textPrimary;

  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 28,
      bounciness: 2,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonTitle}
        accessibilityState={{
          disabled: isDisabled,
          busy: loading,
        }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => animateScale(0.98)}
        onPressOut={() => animateScale(1)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor,
            borderColor,
            opacity: isDisabled ? 0.5 : 1,
          },
          pressed && !isDisabled && styles.pressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={textColor}
            size="small"
          />
        ) : (
          <>
            {icon ? (
              <Ionicons
                name={icon as any}
                size={19}
                color={textColor}
              />
            ) : null}

            <Text
              style={[
                styles.label,
                { color: textColor },
              ]}
            >
              {buttonTitle}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },

  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  pressed: {
    opacity: 0.88,
  },

  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
