import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (value: string) => void;
  onError?: (err: any) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
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
                setOpen(false);
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
  }, [onError, onScan, open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ padding: '0.5em 1.2em', borderRadius: 8, background: '#3182ce', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
        Scan QR
      </button>
      {open && (
        <div style={{ position: 'fixed', zIndex: 1000, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(30,32,46,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', maxWidth: 360, width: '90vw', position: 'relative' }}>
            <button onClick={() => setOpen(false)} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }} title="Close">×</button>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 8, background: '#222' }} />
            <div style={{ color: '#666', fontSize: 13, marginTop: 8, textAlign: 'center' }}>Point your camera at a QR code</div>
          </div>
        </div>
      )}
    </>
  );
};
