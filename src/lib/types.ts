export type Profile = {
  id: string;
  apelido: string;
  avatar_url: string | null;
  google_avatar_url: string | null;
  apelido_definido: boolean;
  is_member: boolean;
  is_admin: boolean;
  is_blocked: boolean;
  convite_tentativas: number;
  joined_at: string | null;
  created_at: string;
};

/** Linha da view restaurants_with_stats */
export type Restaurant = {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  endereco: string | null;
  tags: string[];
  faixa_preco: number | null;
  criado_por: string | null;
  created_at: string;
  media: number | null;
  num_avaliadores: number;
  num_avaliacoes: number;
  preco_medio: number | null;
  ultima_visita: string | null;
  eu_fui: boolean;
  num_quero_ir: number;
  eu_quero: boolean;
};

export type Voltaria = "sim" | "nao" | "talvez";

export type Review = {
  id: string;
  restaurant_id: string;
  user_id: string;
  nota_geral: number;
  nota_comida: number | null;
  nota_atendimento: number | null;
  nota_custo_beneficio: number | null;
  preco_pago: number | null;
  o_que_pediu: string | null;
  pontos_positivos: string | null;
  pontos_negativos: string | null;
  comentario: string | null;
  data_visita: string;
  voltaria: Voltaria | null;
  created_at: string;
  updated_at: string;
  review_photos?: { id: string; path: string }[];
};

export type SortKey = "nota" | "avaliados" | "barato" | "recente" | "perto";

export type Filters = {
  busca: string;
  tags: string[];
  precos: number[];
  notaMin: number | null;
  naoFui: boolean;
  queroIr: boolean;
};

export const EMPTY_FILTERS: Filters = {
  busca: "",
  tags: [],
  precos: [],
  notaMin: null,
  naoFui: false,
  queroIr: false,
};

export type LatLng = { lat: number; lng: number };
