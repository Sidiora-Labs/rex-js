import Button from "../../../../../components/Button.tsx";
import Card from "../../../../../components/Card.tsx";

export interface LocaleOption {
  readonly code: string;
  readonly name: string;
}

export interface LocaleSwitchProps {
  readonly heading: string;
  readonly current: string;
  readonly options: readonly LocaleOption[];
  readonly onSelect: (locale: string) => void;
}

export default function LocaleSwitch({ heading, current, options, onSelect }: LocaleSwitchProps) {
  return (
    <Card title={heading}>
      <div className="flex gap-2" data-demo-locale={current}>
        {options.map((option) => (
          <Button
            key={option.code}
            lang={option.code}
            aria-pressed={option.code === current}
            onClick={() => onSelect(option.code)}
          >
            {option.name}
          </Button>
        ))}
      </div>
    </Card>
  );
}
