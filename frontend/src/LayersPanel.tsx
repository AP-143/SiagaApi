import Collapsible from "./Collapsible";
import { LayersIcon } from "./icons";
import { formatSatelliteDate } from "./satellite";
import Switch from "./Switch";
import { type Basemap, LAYER_INFO, LAYER_NAMES, type MapViewState } from "./view";

type Props = {
  view: MapViewState;
  onViewChange: (view: MapViewState) => void;
  satelliteDate: string;
  open: boolean;
  onToggle: () => void;
};

const BASEMAPS: Array<{ value: Basemap; label: string }> = [
  { value: "map", label: "Peta" },
  { value: "satellite", label: "Satelit" },
];

/** What the map draws besides Hotspots: boundaries, peatland, and which background to use. */
export default function LayersPanel({ view, onViewChange, satelliteDate, open, onToggle }: Props) {
  return (
    <section className="card layers-panel">
      <Collapsible label="Lapisan" icon={<LayersIcon />} open={open} onToggle={onToggle}>
        <form className="layers-form" onSubmit={(event) => event.preventDefault()}>
          {LAYER_NAMES.map((name) => (
            <Switch
              key={name}
              label={LAYER_INFO[name].label}
              checked={view.layers[name]}
              onChange={(shown) => onViewChange({ ...view, layers: { ...view.layers, [name]: shown } })}
            />
          ))}

          <div className="field">
            <span className="field-label" id="basemap-label">
              Peta dasar
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="basemap-label">
              {BASEMAPS.map((basemap) => (
                <label key={basemap.value} className="segment">
                  <input
                    type="radio"
                    name="basemap"
                    value={basemap.value}
                    checked={view.basemap === basemap.value}
                    onChange={() => onViewChange({ ...view, basemap: basemap.value })}
                  />
                  <span>{basemap.label}</span>
                </label>
              ))}
            </div>
            {view.basemap === "satellite" && (
              <p className="field-note">
                Citra satelit harian NASA GIBS, {formatSatelliteDate(satelliteDate)}. Awan dan asap ikut
                terlihat; citra ini kurang tajam untuk jalan kecil.
              </p>
            )}
          </div>
        </form>
      </Collapsible>
    </section>
  );
}
