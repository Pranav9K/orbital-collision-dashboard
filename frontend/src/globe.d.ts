declare module 'react-globe.gl' {
  import { Component, RefObject } from 'react';

  export interface GlobeMethods {
    pointOfView: (
      pov: { lat?: number; lng?: number; altitude?: number },
      transitionMs?: number
    ) => void;
    controls: () => {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableDamping: boolean;
      dampingFactor: number;
    };
    scene: () => object;
    camera: () => object;
    renderer: () => object;
  }

  interface GlobeProps {
    ref?: RefObject<GlobeMethods | undefined>;
    // Globe appearance
    globeImageUrl?: string;
    bumpImageUrl?: string;
    backgroundImageUrl?: string;
    atmosphereColor?: string;
    atmosphereAltitude?: number;
    animateIn?: boolean;
    width?: number;
    height?: number;

    // Points layer
    pointsData?: object[];
    pointLat?: string | ((d: object) => number);
    pointLng?: string | ((d: object) => number);
    pointAltitude?: string | number | ((d: object) => number);
    pointColor?: string | ((d: object) => string);
    pointRadius?: string | number | ((d: object) => number);
    pointsMerge?: boolean;
    pointLabel?: string | ((d: object) => string);
    onPointClick?: (point: object) => void;

    // Arcs layer
    arcsData?: object[];
    arcStartLat?: string | ((d: object) => number);
    arcStartLng?: string | ((d: object) => number);
    arcEndLat?: string | ((d: object) => number);
    arcEndLng?: string | ((d: object) => number);
    arcColor?: string | ((d: object) => string);
    arcDashLength?: number;
    arcDashGap?: number;
    arcDashAnimateTime?: number;
    arcStroke?: number | ((d: object) => number);
    arcLabel?: string | ((d: object) => string);

    // Rings layer
    ringsData?: object[];
    ringLat?: string | ((d: object) => number);
    ringLng?: string | ((d: object) => number);
    ringColor?: string | ((d: object) => string | string[]);
    ringMaxRadius?: number | ((d: object) => number);
    ringPropagationSpeed?: number | ((d: object) => number);
    ringRepeatPeriod?: number | ((d: object) => number);

    [key: string]: unknown;
  }

  const Globe: React.ForwardRefExoticComponent<GlobeProps & React.RefAttributes<GlobeMethods>>;
  export default Globe;
}
