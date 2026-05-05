/**
 * featureIcons.ts · helper canónico para resolver `icono + label`
 * de cualquier feature (amenity de urbanización, característica de
 * vivienda, zona común, ExtrasV5 categoría, vista, orientación,
 * subtipo de unidad…) a partir de su `value` (id).
 *
 * Centralizado para que la ficha y los listados pinten los chips
 * con el MISMO icono que el wizard usa al seleccionar la feature ·
 * sin divergir y sin repetir mappings en cada componente.
 */

import {
  Star, Waves, Dumbbell, Sparkles, UtensilsCrossed, Laptop, ShieldCheck,
  Car, TreePine, Baby, Umbrella, Bell, Volleyball, Footprints, Dog,
  CookingPot, Eye, PanelTop, Flower2, Cpu, Wind, Heater,
  Archive, Sun, Thermometer, Compass, ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/** Catálogo único · `feature value` → `{ icon, label }`.
 *  Cuando se añade una feature nueva al wizard, basta con sumarla
 *  aquí · todos los consumidores la ven automáticamente. */
const FEATURE_CATALOG: Record<string, { icon: LucideIcon; label: string }> = {
  /* Amenities urbanización */
  piscina:        { icon: Waves,           label: "Piscina" },
  gimnasio:       { icon: Dumbbell,        label: "Gimnasio" },
  spa:            { icon: Sparkles,        label: "Spa" },
  restaurantes:   { icon: UtensilsCrossed, label: "Restaurantes" },
  coworking:      { icon: Laptop,          label: "Co-working" },
  seguridad:      { icon: ShieldCheck,     label: "Seguridad" },
  parking:        { icon: Car,             label: "Parking" },
  jardin:         { icon: TreePine,        label: "Jardín" },
  zona_infantil:  { icon: Baby,            label: "Zona infantil" },
  beach_club:     { icon: Umbrella,        label: "Beach club" },
  conserje:       { icon: Bell,            label: "Conserjería" },

  /* Características de vivienda */
  cocina_equipada:    { icon: CookingPot, label: "Cocina equipada" },
  vistas_mar:         { icon: Eye,        label: "Vistas al mar" },
  terraza:            { icon: PanelTop,   label: "Terraza" },
  jardin_privado:     { icon: Flower2,    label: "Jardín privado" },
  smart_home:         { icon: Cpu,        label: "Smart home" },
  aire_acondicionado: { icon: Wind,       label: "Aire acondicionado" },
  suelo_radiante:     { icon: Heater,     label: "Suelo radiante" },

  /* Zonas comunes (urbanización) · sufijos *_com cuando colisiona
   *  con amenity individual (piscina vs piscina_com). */
  piscina_com:        { icon: Waves,       label: "Piscina comunitaria" },
  jardin_com:         { icon: TreePine,    label: "Jardín comunitario" },
  zona_infantil_com:  { icon: Baby,        label: "Zona infantil" },
  padel:              { icon: Volleyball,  label: "Pista de pádel" },
  gimnasio_com:       { icon: Dumbbell,    label: "Gimnasio" },
  paseos:             { icon: Footprints,  label: "Zonas de paseo" },
  zona_mascotas:      { icon: Dog,         label: "Zona de mascotas" },
  seguridad_com:      { icon: ShieldCheck, label: "Seguridad / Vigilancia" },

  /* ExtrasV5 categorías · valores enabled del WizardState. */
  privatePool:    { icon: Waves,        label: "Piscina privada" },
  storageRoom:    { icon: Archive,      label: "Trastero" },
  plot:           { icon: TreePine,     label: "Parcela" },
  solarium:       { icon: Sun,          label: "Solárium" },
  terraces:       { icon: Sun,          label: "Terrazas" },
  equipment:      { icon: Sparkles,     label: "Equipamiento" },
  security:       { icon: ShieldAlert,  label: "Seguridad" },
  views:          { icon: Eye,          label: "Vistas" },
  orientation:    { icon: Compass,      label: "Orientación" },

  /* Equipamiento sub-flags (ExtrasV5.equipment) */
  airConditioning: { icon: Wind,         label: "Aire acondicionado" },
  heating:         { icon: Thermometer,  label: "Calefacción" },
  domotics:        { icon: Cpu,          label: "Domótica" },
  solarPanels:     { icon: Sun,          label: "Paneles solares" },
  electricBlinds:  { icon: PanelTop,     label: "Persianas eléctricas" },
  doubleGlazing:   { icon: PanelTop,     label: "Doble acristalamiento" },
  equippedKitchen: { icon: CookingPot,   label: "Cocina equipada" },

  /* Vistas (ExtrasV5.views) */
  sea:        { icon: Eye, label: "Vistas al mar" },
  mountain:   { icon: Eye, label: "Vistas a la montaña" },
  golf:       { icon: Eye, label: "Vistas al golf" },
  panoramic:  { icon: Eye, label: "Vistas panorámicas" },

  /* Seguridad (ExtrasV5.security) */
  alarm:              { icon: ShieldAlert, label: "Alarma" },
  reinforcedDoor:     { icon: ShieldAlert, label: "Puerta blindada" },
  videoSurveillance:  { icon: ShieldAlert, label: "Videovigilancia" },

  /* Orientación (ExtrasV5.orientation) */
  north:      { icon: Compass, label: "Norte" },
  northeast:  { icon: Compass, label: "Noreste" },
  east:       { icon: Compass, label: "Este" },
  southeast:  { icon: Compass, label: "Sureste" },
  south:      { icon: Compass, label: "Sur" },
  southwest:  { icon: Compass, label: "Suroeste" },
  west:       { icon: Compass, label: "Oeste" },
  northwest:  { icon: Compass, label: "Noroeste" },
};

/** Devuelve el icono Lucide canónico de una feature por id.
 *  Fallback `Star` cuando no hay match · señal visual de que la
 *  feature aún no está catalogada (añadir aquí). */
export function featureIcon(key: string): LucideIcon {
  return FEATURE_CATALOG[key]?.icon ?? Star;
}

/** Devuelve el label legible de una feature por id · fallback al
 *  propio key cuando no está catalogado. */
export function featureLabel(key: string): string {
  return FEATURE_CATALOG[key]?.label ?? key;
}

/** Devuelve `{ icon, label }` en una sola llamada · útil para
 *  renderizar chips visuales. */
export function feature(key: string): { icon: LucideIcon; label: string } {
  return FEATURE_CATALOG[key] ?? { icon: Star, label: key };
}
