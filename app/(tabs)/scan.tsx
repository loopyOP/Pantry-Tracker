import React, { useState, useEffect, useRef } from "react";
import { Text, View, StyleSheet, Button } from "react-native";
import { CameraView, Camera } from "expo-camera";

export default function Scan() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState<any>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  const handleBarcodeScanned = ({ type, data, bounds }: { type: string; data: string; bounds?: any }) => {
    // Prevent multiple scans if already processed
    if (scanned) return;
    
    // Clear any existing timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    // Set scanned state immediately to prevent further scans
    setScanned(true);
    setBarcodeData({ type, data, bounds });
    
    // Show alert after a brief delay to ensure UI state is updated
    scanTimeoutRef.current = setTimeout(() => {
      alert(`Bar code with type ${type} and data ${data} has been scanned!`);
    }, 100);
  };

  const resetScanner = () => {
    // Clear any pending timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    setScanned(false);
    setBarcodeData(null);
  };

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            "upc_a",      // Most common on US/Canada food products
            "upc_e",      // Compact UPC for smaller products
            "ean13",      // European standard, used worldwide
            "ean8",       // Short EAN for small products
            "code128",    // Used for various food products
            "code39",     // Sometimes used on food packaging
            "qr",         // QR codes
            "pdf417",     // PDF417
          ],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Barcode Outline Indicator */}
      {barcodeData?.bounds && (
        <View
          style={[
            styles.barcodeOutline,
            {
              left: barcodeData.bounds.origin.x,
              top: barcodeData.bounds.origin.y,
              width: barcodeData.bounds.size.width,
              height: barcodeData.bounds.size.height,
            },
          ]}
        />
      )}

      {/* Scanning Guide Overlay */}
      {!scanned && (
        <View style={styles.scanningGuide}>
          <View style={styles.scanFrame} />
          <Text style={styles.instructionText}>
            Point camera at barcode
          </Text>
        </View>
      )}

      {/* Scan Results */}
      {scanned && (
        <View style={styles.resultContainer}>
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Barcode Scanned!</Text>
            <Text style={styles.resultType}>Type: {barcodeData?.type}</Text>
            <Text style={styles.resultData}>Data: {barcodeData?.data}</Text>
            <Button title="Scan Again" onPress={resetScanner} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  barcodeOutline: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#00FF00',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  scanningGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resultContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  resultBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  resultType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  resultData: {
    fontSize: 12,
    color: '#888',
    marginBottom: 15,
    textAlign: 'center',
  },
});