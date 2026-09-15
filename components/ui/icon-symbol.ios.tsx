import { SymbolView, SymbolViewProps } from 'expo-symbols';

export function IconSymbol({
  name,
  size = 24,
  color,
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
}) {
  return (
    <SymbolView
      weight="regular"
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
