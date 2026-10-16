// A stand-in for maplibre-gl at the WebGL boundary. jsdom has no WebGL, so tests observe what
// the app asks the map to draw and simulate what a user does on it, rather than pixels.

export type MapOptions = {
  container: HTMLElement | string;
  bounds?: [[number, number], [number, number]];
  [key: string]: unknown;
};

type Handler = (event: unknown) => void;

export const createdMaps: FakeMap[] = [];
export const openPopups: FakePopup[] = [];

export class FakeMap {
  options: MapOptions;
  sources = new Map<string, { type: string; data: GeoJSON.FeatureCollection }>();
  layers: Array<Record<string, unknown>> = [];
  private handlers: Array<{ type: string; layerId?: string; handler: Handler }> = [];

  constructor(options: MapOptions) {
    this.options = options;
    createdMaps.push(this);
  }

  // The real map fires "load" once its style is ready; the fake is ready immediately.
  on(type: string, layerOrHandler: string | Handler, handler?: Handler) {
    if (typeof layerOrHandler === "function") {
      if (type === "load") layerOrHandler({});
      else this.handlers.push({ type, handler: layerOrHandler });
    } else if (handler) {
      this.handlers.push({ type, layerId: layerOrHandler, handler });
    }
    return this;
  }
  addControl() {
    return this;
  }
  addSource(id: string, spec: { type: string; data: GeoJSON.FeatureCollection }) {
    this.sources.set(id, { ...spec });
    return this;
  }
  getSource(id: string) {
    const source = this.sources.get(id);
    if (!source) return undefined;
    return {
      setData: (data: GeoJSON.FeatureCollection) => {
        source.data = data;
      },
    };
  }
  paintCalls: Array<{ layerId: string; property: string; value: unknown }> = [];
  setPaintProperty(layerId: string, property: string, value: unknown) {
    this.paintCalls.push({ layerId, property, value });
    return this;
  }

  layoutCalls: Array<{ layerId: string; property: string; value: unknown }> = [];
  setLayoutProperty(layerId: string, property: string, value: unknown) {
    this.layoutCalls.push({ layerId, property, value });
    return this;
  }

  private specOf(layerId: string): Record<string, any> | undefined {
    const style = this.options.style as { layers?: Array<Record<string, any>> };
    return (
      this.layers.find((layer) => layer.id === layerId) ??
      style.layers?.find((layer) => layer.id === layerId)
    );
  }

  /** A paint value as it stands now: the layer's own, then any later change. */
  paintValue(layerId: string, property: string): unknown {
    const calls = this.paintCalls.filter((c) => c.layerId === layerId && c.property === property);
    if (calls.length) return calls[calls.length - 1].value;
    return this.specOf(layerId)?.paint?.[property];
  }

  basemapPaint(layerId: string, property: string): unknown {
    return this.paintValue(layerId, property);
  }

  /** "visible" or "none", as the map would currently show the layer. */
  layerVisibility(layerId: string): string {
    const calls = this.layoutCalls.filter((c) => c.layerId === layerId && c.property === "visibility");
    if (calls.length) return calls[calls.length - 1].value as string;
    return this.specOf(layerId)?.layout?.visibility ?? "visible";
  }

  layerIds(): string[] {
    return this.layers.map((layer) => layer.id as string);
  }

  styleSource(id: string): Record<string, any> | undefined {
    return (this.options.style as { sources?: Record<string, Record<string, any>> }).sources?.[id];
  }

  addLayer(layer: Record<string, unknown>) {
    this.layers.push(layer);
    return this;
  }
  isStyleLoaded() {
    return true;
  }
  once() {
    return this;
  }
  getCanvas() {
    return { style: {} as CSSStyleDeclaration };
  }
  remove() {}
  resize() {}

  /** Simulate a user tapping a drawn Hotspot, the way MapLibre reports it. */
  tap(layerId: string, id: number, lngLat: [number, number]) {
    for (const entry of this.handlers) {
      if (entry.type === "click" && entry.layerId === layerId) {
        entry.handler({
          // MapLibre flattens nested properties to strings, so only the id is relied upon.
          features: [{ properties: { id } }],
          lngLat: { lng: lngLat[0], lat: lngLat[1] },
        });
      }
    }
  }

  hotspotData(sourceId: string): GeoJSON.Feature[] {
    return this.sources.get(sourceId)?.data.features ?? [];
  }
}

export class FakePopup {
  content: HTMLElement | undefined;
  lngLat: [number, number] | undefined;
  constructor() {
    openPopups.push(this);
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }
  setDOMContent(node: HTMLElement) {
    this.content = node;
    return this;
  }
  addTo() {
    return this;
  }
  remove() {
    openPopups.splice(openPopups.indexOf(this), 1);
    return this;
  }
}

export class FakeNavigationControl {}

export const fakeMapLibreModule = {
  default: { Map: FakeMap, NavigationControl: FakeNavigationControl, Popup: FakePopup },
  Map: FakeMap,
  NavigationControl: FakeNavigationControl,
  Popup: FakePopup,
};
