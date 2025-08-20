import React from 'react';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';

type ImageFallbackProps = {
  extended?: boolean;
  imageSrc: string | undefined | null;
  message?: string;
};

const ImageFallback: React.FC<ImageFallbackProps> = ({
  extended = false,
  imageSrc,
  message = `Cannot load image: ${imageSrc || 'no image source provided'}`,
}) => {
  if (extended) {
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <ExclamationCircleIcon />
        </FlexItem>
        <FlexItem>
          <Content component={ContentVariants.small}>
            <i>{message}</i>
          </Content>
        </FlexItem>
      </Flex>
    );
  }

  return (
    <Tooltip content={message} position="top">
      <ExclamationCircleIcon />
    </Tooltip>
  );
};

export default ImageFallback;
