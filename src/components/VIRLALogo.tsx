import React, { useState } from 'react';

interface VIRLALogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
  variant?: 'badge' | 'plain';
}

export const VIRLALogo: React.FC<VIRLALogoProps> = ({
  size = 'md',
  className = '',
  alt = 'Logo VIRLA — Guardiões do Cuidado',
  variant = 'badge',
}) => {
  const [imgSrc, setImgSrc] = useState('/logo-virla.png');

  // Responsive size presets
  const sizeMap = {
    xs: { container: 'w-7 h-7 rounded-md p-0.5', img: 'w-7 h-7' },
    sm: { container: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl p-1', img: 'w-9 h-9 sm:w-10 sm:h-10' },
    md: { container: 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-1.5', img: 'w-12 h-12 sm:w-14 sm:h-14' },
    lg: { container: 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-2.5', img: 'w-20 h-20 sm:w-24 sm:h-24' },
    xl: { container: 'w-28 h-28 sm:w-36 sm:h-36 rounded-3xl p-3', img: 'w-28 h-28 sm:w-36 sm:h-36' },
  };

  const selected = sizeMap[size] || sizeMap.md;

  const handleImgError = () => {
    if (imgSrc !== '/assets/aistudio/Logo_VIRLA_736902c0.png') {
      setImgSrc('/assets/aistudio/Logo_VIRLA_736902c0.png');
    }
  };

  if (variant === 'plain') {
    return (
      <img
        src={imgSrc}
        alt={alt}
        onError={handleImgError}
        className={`object-contain shrink-0 ${selected.img} ${className}`}
        loading="eager"
      />
    );
  }

  return (
    <div
      className={`shrink-0 bg-[#6B0075] border-2 border-[#FE91FE]/50 shadow-xl flex items-center justify-center overflow-hidden ${selected.container} ${className}`}
    >
      <img
        src={imgSrc}
        alt={alt}
        onError={handleImgError}
        className="w-full h-full object-contain filter drop-shadow-md"
        loading="eager"
      />
    </div>
  );
};
