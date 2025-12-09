import React, { useEffect, useState } from 'react';
import { Skeleton, SkeletonProps } from '@patternfly/react-core/dist/esm/components/Skeleton';
import { useBrowserStorage } from 'mod-arch-core';

type WithValidImageProps = {
  imageSrc: string | undefined | null;
  fallback: React.ReactNode;
  children: (validImageSrc: string) => React.ReactNode;
  skeletonWidth?: SkeletonProps['width'];
  skeletonShape?: SkeletonProps['shape'];
  storageKey?: string;
};

const DEFAULT_SKELETON_WIDTH = '32px';
const DEFAULT_SKELETON_SHAPE: SkeletonProps['shape'] = 'square';

type LoadState = 'loading' | 'valid' | 'invalid';

const WithValidImage: React.FC<WithValidImageProps> = ({
  imageSrc,
  fallback,
  children,
  skeletonWidth = DEFAULT_SKELETON_WIDTH,
  skeletonShape = DEFAULT_SKELETON_SHAPE,
  storageKey = '',
}) => {
  const [status, setStatus] = useState<LoadState>('loading');
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [image, setImage] = useBrowserStorage(storageKey, '');
  useEffect(() => {
    let cancelled = false;

    if (!imageSrc) {
      setStatus('invalid');
      return;
    }

    const fetchImage = async () => {
      // Check if we have a cached base64 data URL
      if (image.length > 0) {
        setResolvedSrc(image);
        setStatus('valid');
        return;
      }
      try {
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelled && reader.result) {
            const dataUrl = reader.result as string;
            setResolvedSrc(dataUrl);
            setStatus('valid');
            setImage(dataUrl);
          }
        };
        reader.onerror = () => {
          console.error('Failed to convert image to data URL');
          if (!cancelled) {
            setStatus('invalid');
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Failed to fetch image:', error);
        if (!cancelled) {
          setStatus('invalid');
        }
      }
    };

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [imageSrc, setImage, image]);

  if (status === 'loading') {
    return (
      <Skeleton shape={skeletonShape} width={skeletonWidth} screenreaderText="Loading image" />
    );
  }

  if (status === 'invalid') {
    return <>{fallback}</>;
  }

  return <>{children(resolvedSrc)}</>;
};

export default WithValidImage;
