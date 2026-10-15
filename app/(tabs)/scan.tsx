
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons
          name="camera-outline"
          size={34}
          color={COLORS.primary}
        />
        <Text style={styles.subtitle}>
          Checking camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Ionicons
            name="camera-outline"
            size={34}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.title}>
          Camera Permission Needed
        </Text>

        <Text style={styles.subtitle}>
          Allow camera access so QR Attendance can scan
          event codes and record your attendance.
        </Text>

        <AppButton
          theme="primary"
          title="Grant Permission"
          icon="camera-outline"
          onPress={requestPermission}
        />
      </View>
    );
  }

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    setScanned(true);
    setLastData(data);
    setMessage(null);

    try {
      const studentId = user?.id ?? 'unknown';
      const result = await registerAttendance(data, studentId);

      setMessage(result.message);
      setSuccess(result.success);
    } catch (error) {
      console.error('Attendance registration failed:', error);

      setMessage(
        'Something went wrong while recording attendance.'
      );
      setSuccess(false);
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setSuccess(false);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned ? undefined : handleBarcodeScanned
        }
      />

      <View style={styles.topLabel}>
        <View style={styles.liveDot} />
        <Text style={styles.topLabelText}>
          QR SCANNER
        </Text>
      </View>

      {!scanned ? (
        <View style={styles.scanGuide}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>
      ) : null}

      <View style={styles.overlay}>
        <View
          style={[
            styles.resultIcon,
            scanned && success
              ? styles.resultIconSuccess
              : null,
            scanned && !success
              ? styles.resultIconError
              : null,
          ]}
        >
          <Ionicons
            name={
              !scanned
                ? 'scan-outline'
                : success
                  ? 'checkmark-circle-outline'
                  : 'alert-circle-outline'
            }
            size={26}
            color={
              !scanned
                ? COLORS.primary
                : success
                  ? COLORS.success
                  : COLORS.error
            }
          />
        </View>

        <Text style={styles.overlayTitle}>
          {scanned
            ? success
              ? 'Attendance Recorded'
              : 'Scan Result'
            : 'Ready to Scan?'}
        </Text>

        <Text style={styles.overlayText}>
          {scanned
            ? message || 'Your QR code has been processed.'
            : 'Point your camera at the event QR code to check in.'}
        </Text>

        {scanned && lastData ? (
          <View style={styles.dataContainer}>
            <Text style={styles.dataLabel}>
              SCANNED DATA
            </Text>
            <Text
              style={styles.scanData}
              numberOfLines={3}
              selectable
            >
              {lastData}
            </Text>
          </View>
        ) : null}

        {scanned ? (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh-outline"
            onPress={handleScanAgain}
            style={styles.actionButton}
          />
        ) : (
          <Text style={styles.scanHint}>
            Keep the QR code inside the camera frame.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  permissionIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  title: {
    color: COLORS.textPrimary,
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },

  topLabel: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.overlay,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },

  topLabelText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  scanGuide: {
    width: 230,
    height: 230,
    position: 'absolute',
    top: '25%',
  },

  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 38,
    height: 38,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderTopLeftRadius: 14,
  },

  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 38,
    height: 38,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderTopRightRadius: 14,
  },

  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 38,
    height: 38,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 14,
  },

  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 38,
    height: 38,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderBottomRightRadius: 14,
  },

  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 23,
    padding: 20,
    alignItems: 'center',
  },

  resultIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  resultIconSuccess: {
    backgroundColor: COLORS.successBackground,
  },

  resultIconError: {
    backgroundColor: COLORS.errorBackground,
  },

  overlayTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 7,
  },

  overlayText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  dataContainer: {
    alignSelf: 'stretch',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  dataLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  scanData: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  actionButton: {
    marginTop: 18,
  },

  scanHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
