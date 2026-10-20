// Arquivos .geojson de /data são importados como JSON (ver turbopack.rules em next.config.ts).
declare module "*.geojson" {
  const value: unknown;
  export default value;
}
