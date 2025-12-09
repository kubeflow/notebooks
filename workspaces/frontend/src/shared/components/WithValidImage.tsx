import React, { useEffect, useState } from 'react';
import { Skeleton, SkeletonProps } from '@patternfly/react-core/dist/esm/components/Skeleton';
import { useBrowserStorage } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

type WithValidImageProps = {
  imageSrc: string | undefined | null;
  fallback: React.ReactNode;
  children: (validImageSrc: string) => React.ReactNode;
  assetType: 'icon' | 'logo';
  skeletonWidth?: SkeletonProps['width'];
  skeletonShape?: SkeletonProps['shape'];
  kindName: string;
};

const DEFAULT_SKELETON_WIDTH = '32px';
const DEFAULT_SKELETON_SHAPE: SkeletonProps['shape'] = 'square';

type LoadState = 'loading' | 'valid' | 'invalid';

const isAbsoluteUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return !!urlObj.protocol;
  } catch {
    // If URL constructor throws, it's not a valid absolute URL
    return false;
  }
};

const WithValidImage: React.FC<WithValidImageProps> = ({
  imageSrc,
  fallback,
  children,
  skeletonWidth = DEFAULT_SKELETON_WIDTH,
  skeletonShape = DEFAULT_SKELETON_SHAPE,
  assetType,
  kindName,
}) => {
  const [status, setStatus] = useState<LoadState>('loading');
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const { api } = useNotebookAPI();
  const shouldCache = !!imageSrc;
  const [image, setImage] = useBrowserStorage(imageSrc || 'temp', '');
  useEffect(() => {
    let cancelled = false;

    if (!imageSrc) {
      setStatus('invalid');
      return;
    }

    const fetchImage = async () => {
      // Check if we have a cached base64 data URL
      if (shouldCache && image.length > 0) {
        setResolvedSrc(image);
        setStatus('valid');
        return;
      }

      let blob: Blob;
      try {
        // Check if the URL is absolute (e.g., https://example.com/image.png)
        if (isAbsoluteUrl(imageSrc)) {
          const response = await fetch(imageSrc);
          blob = await response.blob();
        } else {
          // Use API for relative URL (e.g., /api/v1/workspacekinds/jupyter/assets/icon.svg)
          const response =
            assetType === 'icon'
              ? await api.workspaceKinds.getWorkspaceKindIcon(kindName)
              : await api.workspaceKinds.getWorkspaceKindLogo(kindName);
          if (typeof response === 'string') {
            // If response is a string, create blob from string
            blob = new Blob([response]);
          } else {
            blob = response;
          }
        }
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
  }, [imageSrc, setImage, image, shouldCache, assetType, api.workspaceKinds, kindName]);

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
