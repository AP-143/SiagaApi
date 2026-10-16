type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** A labelled on/off switch; underneath it is a real checkbox, so keyboards and screen readers work. */
export default function Switch({ label, checked, onChange }: Props) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-label">{label}</span>
    </label>
  );
}
