// Relações e nós do OpenStreetMap usados pelo site (compartilhado por fetch-osm e build-data).

// Uma relação por linha (um sentido basta para geometria e ordem das estações).
// A Linha 8 tem a extensão Itapevi–Amador Bueno em relação separada.
export const ROUTE_RELATIONS = {
  1: [2144052],
  2: [419276],
  3: [419274],
  4: [3613476],
  5: [3539819],
  6: [21066133],
  7: [2557151],
  8: [2174505, 2886302],
  9: [419411],
  10: [420129],
  11: [2872092],
  12: [2877631],
  13: [14093037],
  15: [5887354],
  17: [20402219],
};

// Estações que não estão nas relações de rota: em obras (Linha 6), paradas que faltam na relação da 10,
// ramal novo da 17 e ponta da 15.
export const EXTRA_STATION_NODES = {
  6: [7717251061, 7717250451, 7717251135, 7717251178, 7717251203, 7717251204, 7717251209, 7717251216, 7717251221],
  10: [6684992821, 4119710092, 2280117742],
  15: [14294028393],
  17: [2790912202],
};
