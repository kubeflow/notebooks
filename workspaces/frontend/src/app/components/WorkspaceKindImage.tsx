import React, { useCallback } from 'react';
import { SkeletonProps } from '@patternfly/react-core/dist/esm/components/Skeleton';
import WithValidImage from '~/shared/components/WithValidImage';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import {
  isAbsoluteUrl,
  detectImageMimeType,
  fetchImageAsBlob,
} from '~/shared/utilities/imageUtils';

type WorkspaceKindImageProps = {
  imageSrc: string | undefined | null;
  kindName: string;
  assetType: 'icon' | 'logo';
  fallback: React.ReactNode;
  children: (validImageSrc: string) => React.ReactNode;
  skeletonWidth?: SkeletonProps['width'];
  skeletonShape?: SkeletonProps['shape'];
};

const WorkspaceKindImage: React.FC<WorkspaceKindImageProps> = ({
  imageSrc,
  kindName,
  assetType,
  fallback,
  children,
  skeletonWidth,
  skeletonShape,
}) => {
  const { api } = useNotebookAPI();

  const fetchImage = useCallback(
    async (src: string): Promise<Blob> => {
      if (isAbsoluteUrl(src)) {
        return fetchImageAsBlob(src);
      }

      const response =
        assetType === 'icon'
          ? await api.workspaceKinds.getWorkspaceKindIcon(kindName)
          : await api.workspaceKinds.getWorkspaceKindLogo(kindName);

      if (typeof response === 'string') {
        return new Blob([response], { type: detectImageMimeType(response) });
      }
      return response;
    },
    [api.workspaceKinds, assetType, kindName],
  );

  return (
    <WithValidImage
      imageSrc={imageSrc}
      fallback={fallback}
      fetchImage={fetchImage}
      skeletonWidth={skeletonWidth}
      skeletonShape={skeletonShape}
    >
      {children}
    </WithValidImage>
  );
};

export default WorkspaceKindImage;
