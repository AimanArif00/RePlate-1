import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeDisplayProps {
  orderNumber: string;
  pickupCode: string;
}

export function QrCodeDisplay({ orderNumber, pickupCode }: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const payload = JSON.stringify({ orderNumber, pickupCode });

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, {
      width: 180,
      margin: 1,
      color: { dark: '#166534', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <div className="flex flex-col items-center rounded-xl border border-[#E5EBE3] bg-white p-4 text-center">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`Pickup QR code for order ${orderNumber}`}
          className="h-36 w-36 rounded-lg border border-[#EEF3EC]"
        />
      ) : (
        <div className="flex h-36 w-36 items-center justify-center rounded-lg bg-[#F8FAF7] text-xs text-gray-500">
          QR Ready
        </div>
      )}
      <p className="mt-3 text-xs font-medium text-gray-500">Pickup Verification Code</p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-[#166534] tabular-nums">
        {pickupCode}
      </p>
    </div>
  );
}
