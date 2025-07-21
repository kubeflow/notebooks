import React, { useEffect, useState } from 'react';
import { Skeleton, SkeletonProps } from '@patternfly/react-core/dist/esm/components/Skeleton';

type WithValidImageProps = {
  imageSrc: string | undefined | null;
  fallback: React.ReactNode;
  children: (validImageSrc: string) => React.ReactNode;
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
  skeletonWidth = DEFAULT_SKELETON_WIDTH,
  skeletonShape = DEFAULT_SKELETON_SHAPE,
}) => {
  const [status, setStatus] = useState<LoadState>('loading');
  const [resolvedSrc, setResolvedSrc] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    if (!imageSrc) {
      setStatus('invalid');
      return;
    }

    const img = new Image();
    img.onload = () => !cancelled && (setResolvedSrc(imageSrc), setStatus('valid'));
    img.onerror = () => !cancelled && setStatus('invalid');
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

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
