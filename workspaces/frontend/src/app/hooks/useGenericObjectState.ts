import { useCallback, useRef, useState } from 'react';

export type UpdateObjectAtPropAndValue<T> = <K extends keyof T>(
  propKey: K,
  propValue: T[K],
) => void;

export type GenericObjectState<T> = [
  data: T,
  setData: UpdateObjectAtPropAndValue<T>,
  resetDefault: () => void,
  replace: (newValue: T) => void,
];

const useGenericObjectState = <T>(defaultData: T | (() => T)): GenericObjectState<T> => {
  const [value, setValue] = useState<T>(defaultData);

  const setPropValue = useCallback<UpdateObjectAtPropAndValue<T>>((propKey, propValue) => {
    setValue((oldValue) => {
      if (oldValue[propKey] !== propValue) {
        return { ...oldValue, [propKey]: propValue };
      }
      return oldValue;
    });
  }, []);

  const defaultDataRef = useRef(value);
  const resetToDefault = useCallback(() => {
    setValue(defaultDataRef.current);
  }, []);

  const replace = useCallback((newValue: T) => {
    setValue(newValue);
  }, []);

  return [value, setPropValue, resetToDefault, replace];
};

export default useGenericObjectState;
