"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CENTRO, CENTRO_ZOOM, COR_FAIXA, faixaDaNota, formatNota } from "@/lib/format";
import type { LatLng, Restaurant } from "@/lib/types";
import { useApp } from "../AppProvider";

function iconeDoPin(r: Restaurant, selecionado: boolean) {
  const cor = COR_FAIXA[faixaDaNota(r.media)];
  const texto = r.media == null ? "?" : formatNota(r.media);
  return L.divIcon({
    className: "",
    html: `<div class="rango-pin${selecionado ? " selecionado" : ""}" style="--pin:${cor.bg};--pin-fg:${cor.fg}"><span>${texto}</span>${
      r.eu_quero && !r.eu_fui ? '<b class="quero" aria-hidden="true">⭐</b>' : ""
    }</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 42],
    // Guardado no ícone para o agrupamento calcular a cor média.
    media: r.media,
  } as L.DivIconOptions);
}

const iconeVoce = L.divIcon({ className: "", html: '<div class="voce-esta-aqui"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

/** Recebe pedidos de "focar" do resto do app e move o mapa. */
function Foco() {
  const map = useMap();
  const { foco } = useApp();
  useEffect(() => {
    if (!foco) return;
    const zoom = foco.zoom ?? Math.max(map.getZoom(), 17);
    // Desloca um pouco pra cima: o painel de baixo cobre a metade inferior da tela.
    const ponto = map.project([foco.lat, foco.lng], zoom).add([0, map.getSize().y * 0.22]);
    map.flyTo(map.unproject(ponto, zoom), zoom, { duration: 0.6 });
  }, [foco, map]);
  return null;
}

/** Segurar o dedo no mapa (ou clique direito) = marcar novo restaurante ali. */
function Eventos({ onSegurar }: { onSegurar: (p: LatLng) => void }) {
  useMapEvents({
    contextmenu(e) {
      onSegurar({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Expõe o centro do mapa pro modo "escolher no mapa". */
function CentroRef({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onMap(map), [map, onMap]);
  return null;
}

export default function RangoMap({
  restaurantes,
  onMapa,
}: {
  restaurantes: Restaurant[];
  onMapa: (m: L.Map) => void;
}) {
  const { selecionadoId, abrirRestaurante, abrirAdicionar, minhaPos, escolhendoNoMapa } = useApp();

  // A cor do grupo de pins segue a média das notas de dentro dele.
  const iconeDoGrupo = useMemo(
    () => (cluster: L.MarkerCluster) => {
      const notas = cluster
        .getAllChildMarkers()
        .map((m) => (m.options.icon?.options as { media?: number | null } | undefined)?.media)
        .filter((n): n is number => n != null);
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
      return L.divIcon({
        className: "",
        html: `<div class="rango-cluster" style="--pin:${COR_FAIXA[faixaDaNota(media)].bg}">${cluster.getChildCount()}</div>`,
        iconSize: [46, 46],
      });
    },
    [],
  );

  return (
    <MapContainer
      center={[CENTRO.lat, CENTRO.lng]}
      zoom={CENTRO_ZOOM}
      minZoom={12}
      maxZoom={19}
      zoomControl={false}
      className="absolute inset-0 z-0"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Foco />
      <CentroRef onMap={onMapa} />
      {!escolhendoNoMapa ? <Eventos onSegurar={(pos) => abrirAdicionar({ pos })} /> : null}
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={45}
        disableClusteringAtZoom={17}
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        iconCreateFunction={iconeDoGrupo}
      >
        {restaurantes.map((r) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={iconeDoPin(r, r.id === selecionadoId)}
            title={r.nome}
            alt={r.nome}
            keyboard
            zIndexOffset={r.id === selecionadoId ? 1000 : 0}
            eventHandlers={{ click: () => abrirRestaurante(r.id, true) }}
          />
        ))}
      </MarkerClusterGroup>
      {minhaPos ? <Marker position={[minhaPos.lat, minhaPos.lng]} icon={iconeVoce} interactive={false} /> : null}
    </MapContainer>
  );
}
