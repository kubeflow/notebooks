import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkspaceKindImage from '~/app/components/WorkspaceKindImage';
import * as imageUtils from '~/shared/utilities/imageUtils';

const mockGetWorkspaceKindIcon = jest.fn();
const mockGetWorkspaceKindLogo = jest.fn();

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({
    api: {
      workspaceKinds: {
        getWorkspaceKindIcon: mockGetWorkspaceKindIcon,
        getWorkspaceKindLogo: mockGetWorkspaceKindLogo,
      },
    },
  }),
}));

let capturedFetchImage: ((src: string) => Promise<Blob>) | undefined;

jest.mock('~/shared/components/WithValidImage', () => {
  const MockWithValidImage: React.FC<{
    imageSrc: string | undefined | null;
    fallback: React.ReactNode;
    children: (src: string) => React.ReactNode;
    fetchImage?: (src: string) => Promise<Blob>;
    skeletonWidth?: string;
  }> = ({ imageSrc, fallback, children, fetchImage, skeletonWidth }) => {
    capturedFetchImage = fetchImage;
    return (
      <div
        data-testid="with-valid-image"
        data-image-src={imageSrc ?? ''}
        data-skeleton-width={skeletonWidth ?? ''}
      >
        <div data-testid="fallback">{fallback}</div>
        <div data-testid="children">{children('resolved-src')}</div>
      </div>
    );
  };
  return { __esModule: true, default: MockWithValidImage };
});

describe('WorkspaceKindImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedFetchImage = undefined;
  });

  it('passes props through to WithValidImage', () => {
    render(
      <WorkspaceKindImage
        imageSrc="https://example.com/icon.png"
        kindName="jupyter"
        assetType="icon"
        fallback={<span>fallback</span>}
        skeletonWidth="40px"
      >
        {(src) => <img src={src} alt="test" />}
      </WorkspaceKindImage>,
    );

    const wrapper = screen.getByTestId('with-valid-image');
    expect(wrapper).toHaveAttribute('data-image-src', 'https://example.com/icon.png');
    expect(wrapper).toHaveAttribute('data-skeleton-width', '40px');
    expect(screen.getByTestId('fallback')).toHaveTextContent('fallback');
    expect(screen.getByTestId('children').querySelector('img')).toHaveAttribute(
      'src',
      'resolved-src',
    );
  });

  describe('fetchImage callback', () => {
    it('uses fetchImageAsBlob for absolute URLs', async () => {
      const mockBlob = new Blob(['png'], { type: 'image/png' });
      jest.spyOn(imageUtils, 'fetchImageAsBlob').mockResolvedValue(mockBlob);

      render(
        <WorkspaceKindImage
          imageSrc="https://example.com/icon.png"
          kindName="jupyter"
          assetType="icon"
          fallback={<span>fallback</span>}
        >
          {(src) => <img src={src} alt="test" />}
        </WorkspaceKindImage>,
      );

      expect(capturedFetchImage).toBeDefined();
      const result = await capturedFetchImage!('https://example.com/icon.png');
      expect(imageUtils.fetchImageAsBlob).toHaveBeenCalledWith('https://example.com/icon.png');
      expect(result).toBe(mockBlob);
    });

    it('calls getWorkspaceKindIcon for relative URLs with assetType "icon"', async () => {
      const mockBlob = new Blob(['icon'], { type: 'image/png' });
      mockGetWorkspaceKindIcon.mockResolvedValue(mockBlob);

      render(
        <WorkspaceKindImage
          imageSrc="/assets/icon"
          kindName="jupyter"
          assetType="icon"
          fallback={<span>fallback</span>}
        >
          {(src) => <img src={src} alt="test" />}
        </WorkspaceKindImage>,
      );

      const result = await capturedFetchImage!('/assets/icon');
      expect(mockGetWorkspaceKindIcon).toHaveBeenCalledWith('jupyter');
      expect(result).toBe(mockBlob);
    });

    it('calls getWorkspaceKindLogo for relative URLs with assetType "logo"', async () => {
      const mockBlob = new Blob(['logo'], { type: 'image/svg+xml' });
      mockGetWorkspaceKindLogo.mockResolvedValue(mockBlob);

      render(
        <WorkspaceKindImage
          imageSrc="/assets/logo"
          kindName="jupyter"
          assetType="logo"
          fallback={<span>fallback</span>}
        >
          {(src) => <img src={src} alt="test" />}
        </WorkspaceKindImage>,
      );

      const result = await capturedFetchImage!('/assets/logo');
      expect(mockGetWorkspaceKindLogo).toHaveBeenCalledWith('jupyter');
      expect(result).toBe(mockBlob);
    });

    it('wraps string API responses in a Blob with detected MIME type', async () => {
      const svgString = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      mockGetWorkspaceKindIcon.mockResolvedValue(svgString);

      render(
        <WorkspaceKindImage
          imageSrc="/assets/icon"
          kindName="jupyter"
          assetType="icon"
          fallback={<span>fallback</span>}
        >
          {(src) => <img src={src} alt="test" />}
        </WorkspaceKindImage>,
      );

      const result = await capturedFetchImage!('/assets/icon');
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/svg+xml');
      expect(result.size).toBe(svgString.length);
    });
  });
});
