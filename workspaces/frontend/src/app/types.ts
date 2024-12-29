import { APIOptions } from '~/shared/api/types';

export type ResponseBody<T> = {
  data: T;
  metadata?: Record<string, unknown>;
};

export enum ResponseMetadataType {
  INT = 'MetadataIntValue',
  DOUBLE = 'MetadataDoubleValue',
  STRING = 'MetadataStringValue',
  STRUCT = 'MetadataStructValue',
  PROTO = 'MetadataProtoValue',
  BOOL = 'MetadataBoolValue',
}

export type ResponseCustomPropertyInt = {
  metadataType: ResponseMetadataType.INT;
  int_value: string; // int64-formatted string
};

export type ResponseCustomPropertyDouble = {
  metadataType: ResponseMetadataType.DOUBLE;
  double_value: number;
};

export type ResponseCustomPropertyString = {
  metadataType: ResponseMetadataType.STRING;
  string_value: string;
};

export type ResponseCustomPropertyStruct = {
  metadataType: ResponseMetadataType.STRUCT;
  struct_value: string; // Base64 encoded bytes for struct value
};

export type ResponseCustomPropertyProto = {
  metadataType: ResponseMetadataType.PROTO;
  type: string; // url describing proto value
  proto_value: string; // Base64 encoded bytes for proto value
};

export type ResponseCustomPropertyBool = {
  metadataType: ResponseMetadataType.BOOL;
  bool_value: boolean;
};

export type ResponseCustomProperty =
  | ResponseCustomPropertyInt
  | ResponseCustomPropertyDouble
  | ResponseCustomPropertyString
  | ResponseCustomPropertyStruct
  | ResponseCustomPropertyProto
  | ResponseCustomPropertyBool;

export type ResponseCustomProperties = Record<string, ResponseCustomProperty>;
export type ResponseStringCustomProperties = Record<string, ResponseCustomPropertyString>;

export type Namespace = {
  name: string;
};

export type NamespacesList = Namespace[];

export type GetNamespaces = (opts: APIOptions) => Promise<NamespacesList>;

export type NotebookAPIs = {
  getNamespaces: GetNamespaces;
};
