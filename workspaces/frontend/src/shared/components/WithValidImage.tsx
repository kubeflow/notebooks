import React, { useEffect, useState } from 'react';
import { Skeleton, SkeletonProps } from '@patternfly/react-core/dist/esm/components/Skeleton';
import { useBrowserStorage } from 'mod-arch-core';
import { fetchImageAsBlob } from '~/shared/utilities/imageUtils';

type WithValidImageProps = {
  imageSrc: string | undefined | null;
  fallback: React.ReactNode;
  children: (validImageSrc: string) => React.ReactNode;
  fetchImage?: (src: string) => Promise<Blob>;
  skeletonWidth?: SkeletonProps['width'];
  skeletonShape?: SkeletonProps['shape'];
};

const DEFAULT_SKELETON_WIDTH = '32px';
const DEFAULT_SKELETON_SHAPE: SkeletonProps['shape'] = 'square';

type LoadState = 'loading' | 'valid' | 'invalid';

const WithValidImage: React.FC<WithValidImageProps> = ({
  imageSrc,
  fallback,
  children,
  fetchImage = fetchImageAsBlob,
  skeletonWidth = DEFAULT_SKELETON_WIDTH,
  skeletonShape = DEFAULT_SKELETON_SHAPE,
}) => {
  const [status, setStatus] = useState<LoadState>('loading');
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const shouldCache = !!imageSrc;
  const [image, setImage] = useBrowserStorage(imageSrc || 'temp', '');
  useEffect(() => {
    let cancelled = false;

    if (!imageSrc) {
      setStatus('invalid');
      return;
    }

    const loadImage = async () => {
      if (shouldCache && image.length > 0) {
        setResolvedSrc(image);
        setStatus('valid');
        return;
      }

      try {
        const blob = await fetchImage(imageSrc);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelled && reader.result) {
            const dataUrl = reader.result as string;
            setResolvedSrc(dataUrl);
            setStatus('valid');
            if (shouldCache) {
              setImage(dataUrl);
            }
          }
        };
        reader.onerror = () => {
          if (!cancelled) {
            setStatus('invalid');
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (!cancelled) {
          setStatus('invalid');
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [imageSrc, setImage, image, shouldCache, fetchImage]);

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
