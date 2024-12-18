import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';

interface AlertModalProps {
  header: string;
  alertMsg: string;
  onClose: () => void;
  isOpen: boolean;
  footer: React.ReactNode;
}

const AlertModal: React.FC<AlertModalProps> = ({ header, alertMsg, onClose, isOpen, footer }) => (
  <Modal
    variant="medium"
    isOpen={isOpen}
    aria-describedby="modal-title-icon-description"
    aria-labelledby="title-icon-modal-title"
    onClose={onClose}
  >
    <ModalHeader title={header} titleIconVariant="warning" />
    <ModalBody>{alertMsg}</ModalBody>
    <ModalFooter>{footer}</ModalFooter>
  </Modal>
);
export default AlertModal;
