import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type SnackbarType = 'info' | 'success' | 'error';

export interface SnackbarOptions {
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number; // default 2500ms
  type?: SnackbarType;
}

interface SnackbarContextValue {
  showSnackbar: (message: string, options?: SnackbarOptions) => void;
  hideSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

export const useSnackbar = (): SnackbarContextValue => {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return ctx;
};

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<SnackbarType>('info');
  const [actionLabel, setActionLabel] = useState<string | undefined>(undefined);
  const actionRef = useRef<(() => void) | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hideAnimated = useCallback((immediate = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: immediate ? 0 : 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 40, duration: immediate ? 0 : 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start(() => setVisible(false));
  }, [opacity, translateY]);

  const showSnackbar = useCallback((msg: string, options?: SnackbarOptions) => {
    // Reset existing timer/animation
    hideAnimated(true);

    setMessage(msg);
    setType(options?.type ?? 'info');
    setActionLabel(options?.actionLabel);
    actionRef.current = options?.onAction;
    setVisible(true);

    // Animate in
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    const duration = options?.durationMs ?? 2500;
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => hideAnimated(false), duration);
    }
  }, [hideAnimated, opacity, translateY]);

  const hideSnackbar = useCallback(() => hideAnimated(false), [hideAnimated]);

  const value = useMemo(() => ({ showSnackbar, hideSnackbar }), [showSnackbar, hideSnackbar]);

  const bgColor = type === 'success' ? '#03A903' : type === 'error' ? '#FF3B30' : '#333';

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {visible && (
        <View pointerEvents="box-none" style={styles.overlayContainer}>
          <Animated.View style={[styles.snackbar, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}> 
            <Text style={styles.message} numberOfLines={2}>{message}</Text>
            {actionLabel ? (
              <TouchableOpacity
                onPress={() => {
                  actionRef.current?.();
                  hideAnimated(false);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.action}>{actionLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        </View>
      )}
    </SnackbarContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: Platform.select({ ios: 24, android: 16, default: 16 }),
  },
  snackbar: {
    maxWidth: 600,
    width: '92%',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  action: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
