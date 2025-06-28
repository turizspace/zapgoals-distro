import React, { useEffect, useRef } from 'react';

interface QRScannerProps {
  onScan: (value: string) => void;
  onError?: (err: any) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    const constraints = { video: { facingMode: 'environment' } };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        // Use a simple QR code library or implement a basic scan loop here
        // For hackathon, you can use a placeholder or integrate a library like jsQR
      })
      .catch(err => {
        if (onError) onError(err);
      });
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onError]);

  // For demo: just show the video, real scan logic can be added with jsQR or similar
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <video ref={videoRef} style={{ width: '100%' }} />
      {/* Add scan logic or library integration here */}
      <div style={{ color: 'gray', fontSize: 12 }}>QR scanning coming soon...</div>
    </div>
  );
};
