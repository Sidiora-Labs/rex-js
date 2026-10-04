interface TokenFieldProps {
  readonly symbol: string;
}

export default function TokenField({ symbol }: TokenFieldProps) {
  return <input name="token" defaultValue={symbol} />;
}
