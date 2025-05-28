import React, { createContext, useCallback, useContext, useEffect } from 'react';

export interface BrowserStorageContextType {
  getValue: (key: string) => unknown;
  setValue: (key: string, value: string) => void;
}

export interface BrowserStorageContextProviderProps {
  children: React.ReactNode;
}

const BrowserStorageContext = createContext<BrowserStorageContextType>({
  getValue: () => null,
  setValue: () => undefined,
});

export const BrowserStorageContextProvider: React.FC<BrowserStorageContextProviderProps> = ({
  children,
}) => {
  const [values, setValues] = React.useState<{ [key: string]: unknown }>({});
  const valuesRef = React.useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const storageEventCb = useCallback(() => {
    const keys = Object.keys(values);
    setValues(Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])));
  }, [values, setValues]);

  useEffect(() => {
    window.addEventListener('storage', storageEventCb);
    return () => {
      window.removeEventListener('storage', storageEventCb);
    };
  }, [storageEventCb]);

  const getValue = useCallback<BrowserStorageContextType['getValue']>(
    (key: string) => localStorage.getItem(key),
    [],
  );

  const setValue = useCallback<BrowserStorageContextType['setValue']>(
    (key: string, value: string) => {
      localStorage.setItem(key, value);
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contextValue = React.useMemo(() => ({ getValue, setValue }), [getValue, setValue, values]);

  return (
    <BrowserStorageContext.Provider value={contextValue}>{children}</BrowserStorageContext.Provider>
  );
};

export const useStorage = <T,>(
  storageKey: string,
  defaultValue: T,
): [T, (key: string, value: string) => void] => {
  const context = useContext(BrowserStorageContext);
  const { getValue, setValue } = context;
  const value = (getValue(storageKey) as T) ?? defaultValue;
  return [value, setValue];
};
