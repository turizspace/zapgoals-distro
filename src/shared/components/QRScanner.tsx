import React, { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (value: string) => void;
  onError?: (err: any) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    let scanInterval: any = null;
    const constraints = { video: { facingMode: 'environment' } };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        // QR scan loop
        scanInterval = setInterval(async () => {
          if (!videoRef.current) return;
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, canvas.width, canvas.height);
              if (code && code.data) {
                if (onScan) onScan(code.data);
                clearInterval(scanInterval);
              }
            }
          }
        }, 500);
      })
      .catch(err => {
        if (onError) onError(err);
      });
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scanInterval) clearInterval(scanInterval);
    };
  }, [onError, onScan]);

  // For demo: just show the video, real scan logic can be added with jsQR or similar
  return (
    <div style={{ width: '100%', maxWidth: 320 }}>
      <video ref={videoRef} style={{ width: '100%' }} />
      {/* Add scan logic or library integration here */}
      <div style={{ color: 'gray', fontSize: 12 }}>QR scanning coming soon...</div>
    </div>
  );
};
