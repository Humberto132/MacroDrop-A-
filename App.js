import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

/* ============================================================
   PARTE 1 - LÓGICA (a mesma do código Python, em JavaScript)
   ============================================================ */
// INICIO_LOGICA

// Velocidade máxima da moto: 30 km/h = 500 metros por minuto
const VELOCIDADE_MAX = 500;

// Os 16 locais do mapa (nome curto + tipo, usado para pintar o mapa)
const LOCAIS = {
  1: { nome: 'Fit Prime', tipo: 'cozinha' },
  2: { nome: 'Marmitaria', tipo: 'cozinha' },
  3: { nome: 'Zero Açúcar', tipo: 'cozinha' },
  4: { nome: 'Iron Gym', tipo: 'entrega' },
  5: { nome: 'Pulse', tipo: 'entrega' },
  6: { nome: 'Box CrossFit', tipo: 'entrega' },
  7: { nome: 'Campus Portaria', tipo: 'entrega' },
  8: { nome: 'Campus Biblioteca', tipo: 'entrega' },
  9: { nome: 'Praça Central', tipo: 'passagem' },
  10: { nome: 'Terminal', tipo: 'passagem' },
  11: { nome: 'Shopping', tipo: 'passagem' },
  12: { nome: 'Parque', tipo: 'passagem' },
  13: { nome: 'Posto', tipo: 'passagem' },
  14: { nome: 'Residencial', tipo: 'passagem' },
  15: { nome: 'Mercado', tipo: 'passagem' },
  16: { nome: 'Base', tipo: 'passagem' },
};

// Posição de cada local no mapa: [x, y] em metros
const COORDENADAS = {
  1: [0, 0],
  2: [800, 600],
  3: [1500, -200],
  4: [400, 900],
  5: [1200, 300],
  6: [2000, 800],
  7: [1000, 1500],
  8: [1400, 1800],
  9: [600, 200],
  10: [300, -400],
  11: [1700, 400],
  12: [200, 500],
  13: [1000, -300],
  14: [2200, 0],
  15: [1300, 1000],
  16: [-200, 300],
};

// As 29 ruas (mão dupla): [local A, local B, distância em metros, trânsito]
const RUAS = [
  [1, 9, 650, 0.9],
  [1, 10, 520, 1.0],
  [1, 12, 560, 0.8],
  [1, 16, 380, 1.0],
  [16, 12, 460, 0.9],
  [12, 4, 470, 0.7],
  [12, 9, 510, 0.6],
  [9, 2, 450, 0.5],
  [9, 5, 620, 0.4],
  [9, 13, 660, 0.9],
  [10, 13, 720, 1.0],
  [13, 3, 530, 0.9],
  [13, 5, 650, 0.8],
  [3, 14, 750, 1.0],
  [3, 11, 640, 0.6],
  [5, 11, 520, 0.5],
  [5, 2, 510, 0.7],
  [5, 15, 720, 0.8],
  [2, 4, 520, 0.9],
  [2, 15, 650, 0.6],
  [4, 7, 870, 0.8],
  [15, 7, 600, 0.7],
  [7, 8, 510, 1.0],
  [15, 6, 740, 0.9],
  [15, 8, 820, 0.9],
  [11, 6, 520, 0.8],
  [11, 14, 660, 1.0],
  [6, 14, 840, 1.0],
  [6, 8, 1200, 0.9],
];

// Quanto cada empecilho multiplica o trânsito da rua (0 = rua bloqueada)
const MULTIPLICADOR = {
  livre: 1,
  obra: 0.5,
  alagada: 0.25,
  acidente: 0.6,
  bloqueada: 0,
};

// Nome único para uma rua, não importa a ordem: (12, 9) e (9, 12) viram "9-12"
const chave = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Tempo de uma rua em minutos: distância / (velocidade máxima x trânsito)
function custoDaRua(distancia, transito) {
  return distancia / (VELOCIDADE_MAX * transito);
}

// Palpite h: tempo em linha reta até o destino, na velocidade máxima
function heuristica(no, destino) {
  const [x1, y1] = COORDENADAS[no];
  const [x2, y2] = COORDENADAS[destino];
  return Math.hypot(x2 - x1, y2 - y1) / VELOCIDADE_MAX;
}

// Monta o grafo aplicando os empecilhos. Rua bloqueada não entra.
function montarGrafo(empecilhos) {
  const grafo = {};
  Object.keys(LOCAIS).forEach((id) => {
    grafo[id] = [];
  });
  RUAS.forEach(([a, b, distancia, transito]) => {
    const tipo = empecilhos[chave(a, b)];
    const transitoFinal = transito * (tipo ? MULTIPLICADOR[tipo] : 1);
    if (transitoFinal === 0) return;
    grafo[a].push([b, distancia, transitoFinal]);
    grafo[b].push([a, distancia, transitoFinal]);
  });
  return grafo;
}

// Quantos pontos diferentes estão esperando na fila (sem contar os já analisados)
function contarEspera(fila, visitados) {
  return new Set(fila.filter((c) => !visitados.has(c.no)).map((c) => c.no)).size;
}

// Algoritmo A*: devolve o tempo, o caminho, quantos pontos analisou e os passos
// Cada passo guarda: o ponto, g, h, f, de onde ele veio e quantos esperam na fila
function aEstrela(grafo, origem, destino) {
  let fila = [{ f: heuristica(origem, destino), g: 0, no: origem, caminho: [] }];
  const visitados = new Set();
  const passos = [];

  while (fila.length > 0) {
    // Escolhe da fila o candidato de menor f (empate: menor g, depois menor número)
    let melhor = 0;
    for (let i = 1; i < fila.length; i++) {
      const a = fila[i];
      const b = fila[melhor];
      if (a.f < b.f || (a.f === b.f && (a.g < b.g || (a.g === b.g && a.no < b.no)))) {
        melhor = i;
      }
    }
    const atual = fila.splice(melhor, 1)[0];

    // Se esse ponto já foi analisado, pula
    if (visitados.has(atual.no)) continue;
    visitados.add(atual.no);

    const caminho = [...atual.caminho, atual.no];
    const passo = {
      passo: passos.length + 1,
      no: atual.no,
      g: atual.g,
      h: heuristica(atual.no, destino),
      f: atual.f,
      de: atual.caminho.length > 0 ? atual.caminho[atual.caminho.length - 1] : null,
      fila: 0,
    };
    passos.push(passo);

    // Chegou ao destino: terminou
    if (atual.no === destino) {
      passo.fila = contarEspera(fila, visitados);
      return { tempo: atual.g, caminho, expandidos: visitados.size, passos };
    }

    // Coloca na fila os vizinhos que ainda não foram analisados
    for (const [vizinho, distancia, transito] of grafo[atual.no]) {
      if (!visitados.has(vizinho)) {
        const g = atual.g + custoDaRua(distancia, transito);
        fila.push({ f: g + heuristica(vizinho, destino), g, no: vizinho, caminho });
      }
    }
    passo.fila = contarEspera(fila, visitados);
  }
  return { tempo: Infinity, caminho: [], expandidos: visitados.size, passos };
}

// A entrega completa: entregador -> cozinha -> cliente (dois trechos)
function planejar(empecilhos, entregador, cozinha, destino) {
  const grafo = montarGrafo(empecilhos);
  const trecho1 = aEstrela(grafo, entregador, cozinha);
  const trecho2 = aEstrela(grafo, cozinha, destino);
  const ok = trecho1.caminho.length > 0 && trecho2.caminho.length > 0;
  return { trecho1, trecho2, ok, total: trecho1.tempo + trecho2.tempo, grafo };
}

// Quebra a rota em pedaços (uma rua por vez), cada um com o tempo que leva.
// É isso que permite animar o entregador andando pelo grafo.
function montarSegmentos(plano) {
  const lista = [];
  [plano.trecho1, plano.trecho2].forEach((trecho, leg) => {
    for (let i = 1; i < trecho.caminho.length; i++) {
      const a = trecho.caminho[i - 1];
      const b = trecho.caminho[i];
      const rua = plano.grafo[a].find((r) => r[0] === b); // [vizinho, distância, trânsito]
      lista.push({ a, b, leg, tempo: custoDaRua(rua[1], rua[2]) });
    }
  });
  return lista;
}

// FIM_LOGICA

/* ============================================================
   PARTE 2 - APARÊNCIA (cores, textos e pequenos componentes)
   ============================================================ */

const cor = {
  papel: '#F1F3EC',
  tinta: '#12251C',
  folha: '#2F7D52',
  cenoura: '#F28A3C',
  mirtilo: '#7AA2FF',
  pedra: '#5E6B63',
  linha: '#D7DCD0',
  menta: '#5CC48C',
  alerta: '#D64545',
  aviso: '#E0A100',
  branco: '#FFFFFF',
  analisado: '#F2C14E', // anel dos pontos que o A* só analisou
};

const serifa = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// Cor de cada tipo de local (usada no mapa e na tabela de locais)
const COR_TIPO = { cozinha: cor.cenoura, entrega: cor.mirtilo, passagem: '#2A4A3A' };
const GRUPOS = [
  { tipo: 'cozinha', titulo: 'Cozinhas' },
  { tipo: 'entrega', titulo: 'Pontos de entrega' },
  { tipo: 'passagem', titulo: 'Pontos de passagem' },
];

// VELOCIDADE DA ANIMAÇÃO: agora é escolhida dentro do app.
// Valor = quantos segundos reais dura 1 minuto simulado. Menor = mais rápido.
const VELOCIDADE_INICIAL = 1;
const VELOCIDADE_MIN = 0.25;
const VELOCIDADE_MAX_SEG = 5;
const PASSO_VELOCIDADE = 0.25;
const VELOCIDADES_RAPIDAS = [0.5, 1, 1.5, 2, 3];

const ENTREGADOR_IDS = [16, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const COZINHA_IDS = [1, 2, 3];
const DESTINO_IDS = [4, 5, 6, 7, 8];

// Ruas que o usuário pode "estragar" para ver a rota mudar
const RUAS_MONITORADAS = [
  [12, 9],
  [4, 2],
  [15, 8],
  [9, 2],
];
const ORDEM_ESTADOS = ['livre', 'obra', 'alagada', 'acidente', 'bloqueada'];

// Formatadores
const min = (n) => `${n.toFixed(1).replace('.', ',')} min`;
const num = (n) => n.toFixed(2).replace('.', ',');
const seg = (n) => `${String(n).replace('.', ',')} s`;
const hora = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const nomes = (caminho) => caminho.map((id) => LOCAIS[id].nome).join(' → ');

/* ---------- Folha: janelinha que sobe de baixo da tela ---------- */
function Folha({ visivel, titulo, aoFechar, children }) {
  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={estilos.folhaFundo}>
        <TouchableOpacity
          style={estilos.folhaSombra}
          activeOpacity={1}
          onPress={aoFechar}
          accessibilityLabel="Fechar a janela"
        />
        <View style={estilos.folha}>
          <View style={estilos.folhaTopo}>
            <Text style={estilos.folhaTitulo}>{titulo}</Text>
            <TouchableOpacity
              onPress={aoFechar}
              style={estilos.folhaFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Text style={estilos.folhaFecharTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Lista de locais para escolher (dentro da janelinha) ---------- */
function ListaLocais({ ids, valor, aoEscolher }) {
  return (
    <>
      {ids.map((id) => {
        const ativo = id === valor;
        const tipo = LOCAIS[id].tipo;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => aoEscolher(id)}
            style={[estilos.opcao, ativo && estilos.opcaoAtiva]}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
          >
            <View style={[estilos.opcaoNumero, { backgroundColor: COR_TIPO[tipo] }]}>
              <Text
                style={[estilos.opcaoNumeroTexto, { color: tipo === 'passagem' ? cor.papel : cor.tinta }]}
              >
                {id}
              </Text>
            </View>
            <Text style={[estilos.opcaoNome, ativo && estilos.opcaoNomeAtivo]}>{LOCAIS[id].nome}</Text>
            {ativo ? <Text style={estilos.opcaoMarca}>Escolhido</Text> : null}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

/* ---------- Uma linha do resumo do pedido: mostra o valor e abre a janelinha ---------- */
function LinhaPedido({ rotulo, valor, aoAbrir, semBorda }) {
  return (
    <TouchableOpacity
      onPress={aoAbrir}
      style={[estilos.linhaPedido, semBorda && { borderBottomWidth: 0 }]}
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${valor}. Toque para alterar`}
    >
      <View style={{ flex: 1 }}>
        <Text style={estilos.linhaRotulo}>{rotulo}</Text>
        <Text style={estilos.linhaValor}>{valor}</Text>
      </View>
      <Text style={estilos.linhaAcao}>Alterar</Text>
    </TouchableOpacity>
  );
}

/* ---------- Mapa desenhado com SVG ---------- */
function Mapa({ largura, segmentos, andamento, empecilhos, pontos, analise }) {
  // O desenho usa os próprios metros como unidade (viewBox) e o SVG ajusta ao tamanho da tela
  const VB = { x: -350, y: -200, w: 2750, h: 2600 };
  const altura = (largura * VB.h) / VB.w;
  // Em SVG o y cresce para baixo, então invertemos (1800 = maior y do mapa)
  const ponto = (id) => ({ x: COORDENADAS[id][0], y: 1800 - COORDENADAS[id][1] });

  // Cada rua da rota ganha o minuto em que o entregador entra e o minuto em que sai dela
  let relogio = 0;
  const faixas = segmentos.map((s) => {
    const inicio = relogio;
    relogio += s.tempo;
    return { ...s, inicio, fim: relogio };
  });

  // Onde o entregador está agora: dentro da rua em que ele se encontra neste minuto
  let moto = null;
  if (faixas.length > 0) {
    const atual = faixas.find((s) => andamento < s.fim) || faixas[faixas.length - 1];
    const frac = Math.min(Math.max((andamento - atual.inicio) / atual.tempo, 0), 1);
    const p = ponto(atual.a);
    const q = ponto(atual.b);
    moto = { x: p.x + (q.x - p.x) * frac, y: p.y + (q.y - p.y) * frac, leg: atual.leg };
  }

  return (
    <Svg width={largura} height={altura} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
      {/* Todas as ruas (as com empecilho ficam tracejadas) */}
      {RUAS.map(([a, b]) => {
        const p = ponto(a);
        const q = ponto(b);
        const tipo = empecilhos[chave(a, b)];
        return (
          <Line
            key={`rua-${a}-${b}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={tipo ? (tipo === 'bloqueada' ? cor.alerta : cor.aviso) : '#3C5A4B'}
            strokeWidth={tipo ? 30 : 16}
            strokeDasharray={tipo ? '50 40' : undefined}
          />
        );
      })}

      {/* Rota: o traço fraco é o caminho planejado; o forte é o que o entregador já percorreu */}
      {faixas.map((s) => {
        const p = ponto(s.a);
        const q = ponto(s.b);
        const corRota = s.leg === 0 ? cor.cenoura : cor.mirtilo;
        const frac = Math.min(Math.max((andamento - s.inicio) / s.tempo, 0), 1);
        return (
          <React.Fragment key={`rota-${s.leg}-${s.a}-${s.b}`}>
            <Line
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke={corRota}
              strokeOpacity={0.28}
              strokeWidth={46}
              strokeLinecap="round"
            />
            {frac > 0 && (
              <Line
                x1={p.x}
                y1={p.y}
                x2={p.x + (q.x - p.x) * frac}
                y2={p.y + (q.y - p.y) * frac}
                stroke={corRota}
                strokeWidth={46}
                strokeLinecap="round"
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Pontos do mapa */}
      {Object.keys(LOCAIS).map((chaveId) => {
        const id = Number(chaveId);
        const p = ponto(id);
        const escolhido = pontos.includes(id);
        const tipo = LOCAIS[id].tipo;
        const foiAnalisado = analise && analise.expandidos.has(id);
        const noCaminho = analise && analise.caminho.has(id);
        return (
          <React.Fragment key={`no-${id}`}>
            {/* Anel da análise do A*: verde = ficou no caminho, amarelo = só foi analisado */}
            {foiAnalisado && (
              <Circle
                cx={p.x}
                cy={p.y}
                r={escolhido ? 156 : 140}
                fill="none"
                stroke={noCaminho ? cor.menta : cor.analisado}
                strokeWidth={18}
              />
            )}
            <Circle
              cx={p.x}
              cy={p.y}
              r={escolhido ? 96 : 78}
              fill={COR_TIPO[tipo]}
              stroke={escolhido ? cor.papel : '#6E8F7D'}
              strokeWidth={escolhido ? 18 : 8}
            />
            <SvgText
              x={p.x}
              y={p.y + 28}
              fontSize={escolhido ? 92 : 84}
              fontWeight="700"
              textAnchor="middle"
              fill={tipo === 'passagem' ? cor.papel : cor.tinta}
            >
              {id}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* O entregador (por cima de tudo): laranja indo à cozinha, azul levando ao cliente */}
      {moto && (
        <>
          <Circle cx={moto.x} cy={moto.y} r={132} fill={cor.papel} />
          <Circle cx={moto.x} cy={moto.y} r={84} fill={moto.leg === 0 ? cor.cenoura : cor.mirtilo} />
        </>
      )}
    </Svg>
  );
}

/* ---------- Tabela: qual número é qual local ---------- */
const COR_TITULO_GRUPO = { cozinha: '#B25E14', entrega: '#3E64C9', passagem: cor.pedra };

function TabelaLocais({ papeis }) {
  return (
    <View>
      {GRUPOS.map((grupo) => (
        <View key={grupo.tipo} style={estilos.grupo}>
          <Text style={[estilos.grupoTitulo, { color: COR_TITULO_GRUPO[grupo.tipo] }]}>
            {grupo.titulo}
          </Text>
          <View style={estilos.grupoItens}>
            {Object.keys(LOCAIS)
              .map(Number)
              .filter((id) => LOCAIS[id].tipo === grupo.tipo)
              .map((id) => (
                <View key={id} style={estilos.item}>
                  <View style={[estilos.itemNumero, { backgroundColor: COR_TIPO[grupo.tipo] }]}>
                    <Text
                      style={[
                        estilos.itemNumeroTexto,
                        { color: grupo.tipo === 'passagem' ? cor.papel : cor.tinta },
                      ]}
                    >
                      {id}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.itemNome}>{LOCAIS[id].nome}</Text>
                    {papeis[id] ? <Text style={estilos.itemPapel}>{papeis[id]}</Text> : null}
                  </View>
                </View>
              ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---------- Controle da velocidade da animação ---------- */
function Velocidade({ valor, aoMudar }) {
  const ajustar = (delta) => {
    const novo = Math.round((valor + delta) * 100) / 100;
    aoMudar(Math.min(VELOCIDADE_MAX_SEG, Math.max(VELOCIDADE_MIN, novo)));
  };
  return (
    <View>
      <Text style={estilos.dica}>
        Quanto tempo real dura 1 minuto da entrega. Menos segundos, animação mais rápida.
      </Text>
      <View style={estilos.velocidadeLinha}>
        <TouchableOpacity
          onPress={() => ajustar(-PASSO_VELOCIDADE)}
          style={estilos.velocidadeBotao}
          accessibilityRole="button"
          accessibilityLabel="Deixar a animação mais rápida"
        >
          <Text style={estilos.velocidadeBotaoTexto}>−</Text>
        </TouchableOpacity>
        <Text style={estilos.velocidadeValor}>{seg(valor)}</Text>
        <TouchableOpacity
          onPress={() => ajustar(PASSO_VELOCIDADE)}
          style={estilos.velocidadeBotao}
          accessibilityRole="button"
          accessibilityLabel="Deixar a animação mais lenta"
        >
          <Text style={estilos.velocidadeBotaoTexto}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={estilos.velocidadeAtalhos}>
        {VELOCIDADES_RAPIDAS.map((v) => {
          const ativo = v === valor;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => aoMudar(v)}
              style={[estilos.atalho, ativo && estilos.atalhoAtivo]}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
            >
              <Text style={[estilos.atalhoTexto, ativo && estilos.atalhoTextoAtivo]}>{seg(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- Legenda das cores da análise do A* ---------- */
function LegendaAnalise({ escuro }) {
  const texto = { color: escuro ? cor.papel : cor.tinta };
  return (
    <View style={estilos.legendaAnalise}>
      <View style={estilos.legendaLinha}>
        <View style={[estilos.anel, { borderColor: cor.menta }]} />
        <Text style={[estilos.legendaTexto, texto]}>
          Escolhido: faz parte do caminho final
        </Text>
      </View>
      <View style={estilos.legendaLinha}>
        <View style={[estilos.anel, { borderColor: cor.analisado }]} />
        <Text style={[estilos.legendaTexto, texto]}>
          Só analisado: o A* olhou, mas não usou na rota
        </Text>
      </View>
    </View>
  );
}

/* ---------- Um trecho do resultado (retirada ou entrega) ---------- */
function Trecho({ titulo, corBarra, dados }) {
  return (
    <View style={estilos.trecho}>
      <View style={[estilos.trechoBarra, { backgroundColor: corBarra }]} />
      <View style={{ flex: 1 }}>
        <View style={estilos.trechoLinha}>
          <Text style={estilos.trechoTitulo}>{titulo}</Text>
          <Text style={estilos.trechoTempo}>{min(dados.tempo)}</Text>
        </View>
        <Text style={estilos.trechoCaminho}>{nomes(dados.caminho)}</Text>
      </View>
    </View>
  );
}

/* ---------- Passo a passo do A* ---------- */
function Passos({ titulo, dados }) {
  const noCaminho = new Set(dados.caminho);
  const escolhidos = dados.passos.filter((p) => noCaminho.has(p.no)).length;
  const soAnalisados = dados.passos.length - escolhidos;
  return (
    <View style={estilos.passosGrupo}>
      <Text style={estilos.passosTitulo}>{titulo}</Text>
      <Text style={estilos.passosResumo}>
        {dados.passos.length} pontos analisados: {escolhidos} ficaram no caminho e {soAnalisados}{' '}
        foram só analisados.
      </Text>
      {dados.passos.map((p, i) => {
        const escolhido = noCaminho.has(p.no);
        const ultimo = i === dados.passos.length - 1;
        return (
          <View
            key={p.passo}
            style={[
              estilos.passo,
              { borderLeftColor: escolhido ? cor.menta : cor.analisado },
            ]}
          >
            <View style={estilos.passoTopo}>
              <Text style={estilos.passoNome}>
                {p.passo}. {LOCAIS[p.no].nome}
              </Text>
              <View style={[estilos.pilula, escolhido ? estilos.pilulaOk : estilos.pilulaSo]}>
                <Text
                  style={[estilos.pilulaTexto, escolhido ? estilos.pilulaTextoOk : estilos.pilulaTextoSo]}
                >
                  {escolhido ? 'Escolhido' : 'Só analisado'}
                </Text>
              </View>
            </View>
            <Text style={estilos.passoDetalhe}>
              {p.de ? `Veio de ${LOCAIS[p.de].nome}.` : 'Ponto de partida.'}{' '}
              {ultimo ? 'Chegou ao destino.' : `Fila de espera: ${p.fila}.`}
            </Text>
            <Text style={estilos.passoNumeros}>
              g {num(p.g)}   h {num(p.h)}   f {num(p.f)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ============================================================
   PARTE 3 - TELAS (início, mapa e passo a passo) E JANELINHAS
   ============================================================ */
export default function App() {
  const { width } = useWindowDimensions();
  const larguraMapa = width - 40 - 32; // margem da tela e margem interna do painel

  // Qual tela está aberta: 'inicio', 'mapa' ou 'passos'
  const [tela, setTela] = useState('inicio');
  // Qual janelinha está aberta (e se está aberta)
  const [folha, setFolha] = useState('entregador');
  const [folhaAberta, setFolhaAberta] = useState(false);

  // O que o usuário escolheu
  const [entregador, setEntregador] = useState(16);
  const [cozinha, setCozinha] = useState(2);
  const [destino, setDestino] = useState(8);
  const [empecilhos, setEmpecilhos] = useState({});
  const [segPorMinuto, setSegPorMinuto] = useState(VELOCIDADE_INICIAL);

  // O que o programa calculou
  const [plano, setPlano] = useState(null);
  const [semEmpecilhos, setSemEmpecilhos] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [mostrarAnalise, setMostrarAnalise] = useState(false); // anéis do A* no mapa
  const [chegada, setChegada] = useState(null);
  const [segmentos, setSegmentos] = useState([]); // a rota quebrada em ruas
  const [andamento, setAndamento] = useState(0); // minutos simulados já percorridos
  const [animando, setAnimando] = useState(false); // o entregador está andando?

  const abrirFolha = (nome) => {
    setFolha(nome);
    setFolhaAberta(true);
  };
  const fecharFolha = () => setFolhaAberta(false);

  // Ao mudar qualquer escolha, o resultado antigo deixa de valer
  const limpar = () => {
    setPlano(null);
    setSegmentos([]);
    setMostrarAnalise(false);
    setAnimando(false);
    setAndamento(0);
  };
  const escolherLocal = (setter) => (valor) => {
    setter(valor);
    limpar();
    fecharFolha();
  };

  // Toque em uma rua: passa para o próximo estado (livre, obra, alagada...)
  const mudarRua = (a, b) => {
    const k = chave(a, b);
    const atual = empecilhos[k] || 'livre';
    const proximo = ORDEM_ESTADOS[(ORDEM_ESTADOS.indexOf(atual) + 1) % ORDEM_ESTADOS.length];
    const novo = { ...empecilhos };
    if (proximo === 'livre') delete novo[k];
    else novo[k] = proximo;
    setEmpecilhos(novo);
    limpar();
  };

  // Botão "Calcular estimativa de entrega"
  const calcular = () => {
    setCalculando(true);
    setMostrarAnalise(false);
    // Uma pequena pausa só para parecer um sistema real buscando a rota
    setTimeout(() => {
      const resultado = planejar(empecilhos, entregador, cozinha, destino);
      setPlano(resultado);
      setSemEmpecilhos(planejar({}, entregador, cozinha, destino));
      setChegada(new Date(Date.now() + resultado.total * 60000));
      setSegmentos(resultado.ok ? montarSegmentos(resultado) : []);
      setAndamento(0);
      setAnimando(false); // a animação começa quando o usuário abrir o mapa
      setCalculando(false);
    }, 700);
  };

  const okPlano = Boolean(plano && plano.ok);
  const total = okPlano ? plano.total : 0;
  const nProblemas = Object.keys(empecilhos).length;

  // Navegação entre telas
  const abrirMapa = (iniciar) => {
    if (iniciar && okPlano) {
      setAndamento(0);
      setAnimando(true);
    }
    setTela('mapa');
  };
  const voltar = () => {
    setAnimando(false);
    setTela('inicio');
  };

  // Botão "voltar" do Android: volta para o início em vez de fechar o app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tela !== 'inicio') {
        setAnimando(false);
        setTela('inicio');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tela]);

  // Enquanto animando, a cada 40 milissegundos o relógio simulado avança um pouquinho.
  // Se a velocidade mudar no meio da animação, o relógio continua de onde estava.
  useEffect(() => {
    if (!animando) return undefined;
    const intervalo = setInterval(() => {
      setAndamento((atual) => Math.min(atual + 0.04 / segPorMinuto, total));
    }, 40);
    return () => clearInterval(intervalo);
  }, [animando, total, segPorMinuto]);

  // Quando o relógio chega ao fim da rota, a animação para
  useEffect(() => {
    if (animando && total > 0 && andamento >= total) setAnimando(false);
  }, [andamento, animando, total]);

  // Botão do mapa: pausa, continua ou recomeça a entrega
  const terminou = total > 0 && andamento >= total;
  const controlar = () => {
    if (terminou) {
      setAndamento(0);
      setAnimando(true);
    } else {
      setAnimando(!animando);
    }
  };
  const rotuloControle = terminou
    ? 'Acompanhar a entrega de novo'
    : animando
    ? 'Pausar'
    : andamento === 0
    ? 'Iniciar'
    : 'Continuar';

  // Frase que diz em que fase da entrega o entregador está
  let statusTexto = '';
  if (okPlano) {
    if (andamento >= total) {
      statusTexto = 'Pedido entregue.';
    } else if (andamento < plano.trecho1.tempo) {
      statusTexto = `Indo buscar o pedido na cozinha ${LOCAIS[cozinha].nome}. Faltam ${min(total - andamento)}.`;
    } else {
      statusTexto = `A caminho de ${LOCAIS[destino].nome}. Faltam ${min(total - andamento)}.`;
    }
  }

  // Papel de cada ponto escolhido, para aparecer na tabela de locais
  const papeis = {};
  const marcar = (id, texto) => {
    papeis[id] = papeis[id] ? `${papeis[id]} e ${texto}` : texto;
  };
  marcar(entregador, 'entregador');
  marcar(cozinha, 'cozinha do pedido');
  marcar(destino, 'seu destino');

  // Análise do A* no mapa: só aparece quando o usuário liga
  const analise =
    okPlano && mostrarAnalise
      ? {
          caminho: new Set([...plano.trecho1.caminho, ...plano.trecho2.caminho]),
          expandidos: new Set([...plano.trecho1.passos, ...plano.trecho2.passos].map((p) => p.no)),
        }
      : null;

  // A tela do passo a passo só existe se houver um resultado
  const telaAtual = tela === 'passos' && !okPlano ? 'inicio' : tela;

  // Título e conteúdo da janelinha aberta
  const titulosFolha = {
    entregador: 'Onde está o entregador',
    cozinha: 'Cozinha que prepara o pedido',
    destino: 'Onde você quer receber',
    ruas: 'Ruas com problema',
    velocidade: 'Velocidade da animação',
    locais: 'O que cada número significa',
  };

  // Barra de cima das telas internas
  const barraTopo = (titulo) => (
    <View style={estilos.barraTopo}>
      <TouchableOpacity
        onPress={voltar}
        style={estilos.voltar}
        accessibilityRole="button"
        accessibilityLabel="Voltar para o início"
      >
        <Text style={estilos.voltarTexto}>‹ Voltar</Text>
      </TouchableOpacity>
      <Text style={estilos.telaTitulo}>{titulo}</Text>
    </View>
  );

  return (
    <View style={estilos.tela}>
      <StatusBar style="dark" />

      {/* ---------- TELA 1: INÍCIO ---------- */}
      {telaAtual === 'inicio' && (
        <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
          <View style={estilos.topo}>
            <Text style={estilos.logo}>
              Macro<Text style={{ color: cor.folha }}>Drop</Text>
            </Text>
            <View style={estilos.selo}>
              <Text style={estilos.seloTexto}>Simulação do A*</Text>
            </View>
          </View>
          <Text style={estilos.chamada}>Sua refeição chega onde você estiver.</Text>

          {/* Resumo do pedido: cada linha abre uma janelinha para alterar */}
          <View style={estilos.cartao}>
            <Text style={estilos.cartaoTitulo}>Seu pedido</Text>
            <LinhaPedido
              rotulo="Entregador está em"
              valor={`${LOCAIS[entregador].nome} (ponto ${entregador})`}
              aoAbrir={() => abrirFolha('entregador')}
            />
            <LinhaPedido
              rotulo="Cozinha"
              valor={`${LOCAIS[cozinha].nome} (ponto ${cozinha})`}
              aoAbrir={() => abrirFolha('cozinha')}
            />
            <LinhaPedido
              rotulo="Receber em"
              valor={`${LOCAIS[destino].nome} (ponto ${destino})`}
              aoAbrir={() => abrirFolha('destino')}
            />
            <LinhaPedido
              rotulo="Ruas com problema"
              valor={
                nProblemas === 0
                  ? 'Todas as ruas livres'
                  : `${nProblemas} ${nProblemas === 1 ? 'rua com problema' : 'ruas com problema'}`
              }
              aoAbrir={() => abrirFolha('ruas')}
              semBorda
            />
          </View>

          <TouchableOpacity
            onPress={calcular}
            disabled={calculando}
            style={[estilos.botao, calculando && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={estilos.botaoTexto}>
              {calculando ? 'Calculando a melhor rota...' : 'Calcular estimativa de entrega'}
            </Text>
          </TouchableOpacity>

          {/* Antes de calcular, dá para ver só o mapa */}
          {!okPlano && (
            <TouchableOpacity
              onPress={() => abrirMapa(false)}
              style={estilos.botaoSecundario}
              accessibilityRole="button"
            >
              <Text style={estilos.botaoSecundarioTexto}>Ver o mapa da região</Text>
            </TouchableOpacity>
          )}

          {/* Resultado: só o essencial. O resto fica em outras telas */}
          {okPlano && (
            <View style={estilos.resultado}>
              <Text style={estilos.resultadoRotulo}>Chegada estimada</Text>
              <Text style={estilos.hora}>{hora(chegada)}</Text>
              <Text style={estilos.resultadoMinutos}>em {min(plano.total)}</Text>
              {nProblemas > 0 && semEmpecilhos && (
                <Text style={estilos.resultadoNota}>
                  Sem os problemas nas ruas seriam {min(semEmpecilhos.total)} (
                  {plano.total - semEmpecilhos.total > 0.005
                    ? `+${min(plano.total - semEmpecilhos.total)}`
                    : 'sem diferença'}
                  ).
                </Text>
              )}

              <View style={estilos.divisor} />

              <Trecho titulo="Retirada na cozinha" corBarra={cor.cenoura} dados={plano.trecho1} />
              <Trecho titulo="Entrega ao cliente" corBarra={cor.mirtilo} dados={plano.trecho2} />

              <TouchableOpacity
                onPress={() => abrirMapa(true)}
                style={[estilos.botao, { marginTop: 4 }]}
                accessibilityRole="button"
              >
                <Text style={estilos.botaoTexto}>Acompanhar a entrega no mapa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTela('passos')}
                style={estilos.link}
                accessibilityRole="button"
              >
                <Text style={estilos.linkTexto}>Ver como o A* decidiu a rota</Text>
              </TouchableOpacity>
            </View>
          )}

          {plano && !plano.ok && (
            <View style={estilos.resultado}>
              <Text style={estilos.erroTitulo}>Não existe caminho</Text>
              <Text style={estilos.resultadoNota}>
                Os problemas nas ruas isolaram um dos pontos. Deixe uma rua como livre e calcule de
                novo.
              </Text>
            </View>
          )}

          <Text style={estilos.rodape}>
            Base de dados autoral do grupo. Locais, ruas e trânsito são fictícios.
          </Text>
        </ScrollView>
      )}

      {/* ---------- TELA 2: MAPA ---------- */}
      {telaAtual === 'mapa' && (
        <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
          {barraTopo('Mapa da entrega')}

          <View style={estilos.painelMapa}>
            {okPlano && (
              <View style={estilos.andamento}>
                <Text style={estilos.andamentoTexto}>{statusTexto}</Text>
                <View style={estilos.barra}>
                  <View
                    style={[estilos.barraCheia, { width: `${Math.round((andamento / total) * 100)}%` }]}
                  />
                </View>
              </View>
            )}
            <Mapa
              largura={larguraMapa}
              segmentos={segmentos}
              andamento={andamento}
              empecilhos={empecilhos}
              pontos={[entregador, cozinha, destino]}
              analise={analise}
            />
            <Text style={estilos.mapaNota}>
              {okPlano
                ? 'Laranja é o trecho da retirada. Azul é o trecho da entrega. Rua tracejada tem problema.'
                : 'Calcule uma entrega para ver a rota aqui. Rua tracejada tem problema.'}
            </Text>

            {analise && <LegendaAnalise escuro />}

            {okPlano && (
              <TouchableOpacity onPress={controlar} style={estilos.botaoMapa} accessibilityRole="button">
                <Text style={estilos.botaoMapaTexto}>{rotuloControle}</Text>
              </TouchableOpacity>
            )}
            {okPlano && (
              <TouchableOpacity
                onPress={() => setMostrarAnalise(!mostrarAnalise)}
                style={[estilos.chipAnalise, mostrarAnalise && estilos.chipAnaliseAtivo]}
                accessibilityRole="button"
                accessibilityState={{ selected: mostrarAnalise }}
              >
                <Text style={[estilos.chipAnaliseTexto, mostrarAnalise && estilos.chipAnaliseTextoAtivo]}>
                  {mostrarAnalise ? 'Esconder a análise do A* no mapa' : 'Mostrar a análise do A* no mapa'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={estilos.duasAcoes}>
              <TouchableOpacity
                onPress={() => abrirFolha('velocidade')}
                style={estilos.acao}
                accessibilityRole="button"
              >
                <Text style={estilos.acaoRotulo}>Velocidade</Text>
                <Text style={estilos.acaoValor}>{seg(segPorMinuto)} por minuto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => abrirFolha('locais')}
                style={estilos.acao}
                accessibilityRole="button"
              >
                <Text style={estilos.acaoRotulo}>Locais</Text>
                <Text style={estilos.acaoValor}>O que cada número é</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ---------- TELA 3: PASSO A PASSO DO A* ---------- */}
      {telaAtual === 'passos' && okPlano && (
        <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
          {barraTopo('Como o A* decidiu')}

          <View style={estilos.cartao}>
            <Text style={estilos.resultadoNota}>
              O A* analisou {plano.trecho1.expandidos + plano.trecho2.expandidos} de{' '}
              {2 * Object.keys(LOCAIS).length} pontos possíveis.
            </Text>
            <Text style={estilos.explicacao}>
              g é o tempo já gasto até o ponto. h é o palpite do que falta, em linha reta. f é g mais
              h: o A* sempre analisa primeiro o ponto de menor f.
            </Text>
            <LegendaAnalise />
          </View>

          <View style={estilos.cartao}>
            <Passos titulo="Retirada na cozinha" dados={plano.trecho1} />
            <Passos titulo="Entrega ao cliente" dados={plano.trecho2} />
          </View>

          <TouchableOpacity
            onPress={() => {
              setMostrarAnalise(true);
              setTela('mapa');
            }}
            style={estilos.botao}
            accessibilityRole="button"
          >
            <Text style={estilos.botaoTexto}>Ver esses pontos no mapa</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ---------- JANELINHA (serve para todas as escolhas) ---------- */}
      <Folha visivel={folhaAberta} titulo={titulosFolha[folha]} aoFechar={fecharFolha}>
        {folha === 'entregador' && (
          <ListaLocais ids={ENTREGADOR_IDS} valor={entregador} aoEscolher={escolherLocal(setEntregador)} />
        )}
        {folha === 'cozinha' && (
          <ListaLocais ids={COZINHA_IDS} valor={cozinha} aoEscolher={escolherLocal(setCozinha)} />
        )}
        {folha === 'destino' && (
          <ListaLocais ids={DESTINO_IDS} valor={destino} aoEscolher={escolherLocal(setDestino)} />
        )}
        {folha === 'ruas' && (
          <View>
            <Text style={estilos.dica}>Toque em uma rua para mudar o estado dela.</Text>
            {RUAS_MONITORADAS.map(([a, b]) => {
              const estado = empecilhos[chave(a, b)] || 'livre';
              const corEstado =
                estado === 'livre' ? cor.pedra : estado === 'bloqueada' ? cor.alerta : cor.aviso;
              return (
                <TouchableOpacity
                  key={chave(a, b)}
                  onPress={() => mudarRua(a, b)}
                  style={estilos.rua}
                  accessibilityRole="button"
                >
                  <Text style={estilos.ruaNome}>
                    {LOCAIS[a].nome} e {LOCAIS[b].nome}
                  </Text>
                  <View style={[estilos.estado, { borderColor: corEstado }]}>
                    <Text style={[estilos.estadoTexto, { color: corEstado }]}>{estado}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {folha === 'velocidade' && <Velocidade valor={segPorMinuto} aoMudar={setSegPorMinuto} />}
        {folha === 'locais' && <TabelaLocais papeis={papeis} />}
      </Folha>
    </View>
  );
}

/* ============================================================
   PARTE 4 - ESTILOS
   ============================================================ */
const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.papel },
  conteudo: {
    paddingTop: Platform.OS === 'android' ? 52 : 68,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 30, fontWeight: '800', color: cor.tinta, letterSpacing: -0.5 },
  selo: {
    borderWidth: 1,
    borderColor: cor.folha,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  seloTexto: { color: cor.folha, fontSize: 13, fontWeight: '600' },
  chamada: { marginTop: 6, fontSize: 16, color: cor.pedra, lineHeight: 22 },

  barraTopo: { marginBottom: 4 },
  voltar: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  voltarTexto: { fontSize: 17, fontWeight: '700', color: cor.folha },
  telaTitulo: { fontSize: 28, fontWeight: '800', color: cor.tinta, letterSpacing: -0.5 },

  cartao: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    borderRadius: 20,
    backgroundColor: cor.branco,
    borderWidth: 1,
    borderColor: cor.linha,
  },
  cartaoTitulo: { fontSize: 20, fontWeight: '800', color: cor.tinta, marginBottom: 4 },
  dica: { marginTop: 2, marginBottom: 8, fontSize: 14, color: cor.pedra, lineHeight: 20 },

  linhaPedido: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: cor.linha,
  },
  linhaRotulo: { fontSize: 13, color: cor.pedra },
  linhaValor: { marginTop: 2, fontSize: 16, fontWeight: '700', color: cor.tinta },
  linhaAcao: { fontSize: 15, fontWeight: '700', color: cor.folha, paddingLeft: 12 },

  botao: {
    marginTop: 24,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: cor.folha,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  botaoTexto: { color: cor.branco, fontSize: 17, fontWeight: '700' },
  botaoSecundario: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: cor.folha,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  botaoSecundarioTexto: { color: cor.folha, fontSize: 16, fontWeight: '700' },

  resultado: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: cor.branco,
    borderWidth: 1,
    borderColor: cor.linha,
  },
  resultadoRotulo: { fontSize: 15, color: cor.pedra },
  hora: {
    fontFamily: serifa,
    fontSize: 64,
    lineHeight: 72,
    color: cor.tinta,
    fontWeight: '700',
  },
  resultadoMinutos: { fontSize: 18, color: cor.folha, fontWeight: '700' },
  resultadoNota: { marginTop: 4, marginBottom: 8, fontSize: 14, color: cor.pedra, lineHeight: 20 },
  divisor: { height: 1, backgroundColor: cor.linha, marginVertical: 18 },
  erroTitulo: { fontSize: 20, fontWeight: '800', color: cor.alerta },

  trecho: { flexDirection: 'row', marginBottom: 16 },
  trechoBarra: { width: 5, borderRadius: 3, marginRight: 14 },
  trechoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  trechoTitulo: { fontSize: 16, fontWeight: '700', color: cor.tinta },
  trechoTempo: { fontSize: 16, fontWeight: '700', color: cor.tinta },
  trechoCaminho: { marginTop: 3, fontSize: 14, color: cor.pedra, lineHeight: 20 },

  link: { marginTop: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkTexto: { color: cor.folha, fontSize: 15, fontWeight: '700' },

  explicacao: { marginBottom: 4, fontSize: 14, color: cor.pedra, lineHeight: 20 },
  legendaAnalise: { marginTop: 12, marginBottom: 12, gap: 8 },
  legendaLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendaTexto: { fontSize: 14, flex: 1, lineHeight: 19 },
  anel: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },

  passosGrupo: { marginBottom: 14 },
  passosTitulo: { fontSize: 16, fontWeight: '700', color: cor.tinta },
  passosResumo: { marginTop: 2, marginBottom: 10, fontSize: 14, color: cor.pedra, lineHeight: 20 },
  passo: {
    paddingVertical: 8,
    paddingLeft: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderBottomWidth: 1,
    borderBottomColor: cor.linha,
  },
  passoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passoNome: { fontSize: 15, fontWeight: '700', color: cor.tinta, flex: 1, paddingRight: 8 },
  pilula: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pilulaOk: { backgroundColor: '#DDF3E6' },
  pilulaSo: { backgroundColor: '#FBEFC9' },
  pilulaTexto: { fontSize: 13, fontWeight: '700' },
  pilulaTextoOk: { color: '#1F6B43' },
  pilulaTextoSo: { color: '#7A5A00' },
  passoDetalhe: { marginTop: 4, fontSize: 14, color: cor.pedra, lineHeight: 20 },
  passoNumeros: { marginTop: 2, fontSize: 14, color: cor.tinta },

  painelMapa: {
    marginTop: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: cor.tinta,
  },
  mapaNota: { marginTop: 10, fontSize: 14, color: '#B7C6BC', lineHeight: 20 },
  andamento: { marginBottom: 12 },
  andamentoTexto: { fontSize: 15, color: cor.papel, lineHeight: 21 },
  barra: { height: 6, borderRadius: 3, backgroundColor: '#2A4A3A', marginTop: 8 },
  barraCheia: { height: 6, borderRadius: 3, backgroundColor: cor.menta },
  botaoMapa: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: cor.menta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoMapaTexto: { color: cor.tinta, fontSize: 16, fontWeight: '800' },
  chipAnalise: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3C5A4B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  chipAnaliseAtivo: { borderColor: cor.analisado },
  chipAnaliseTexto: { color: cor.papel, fontSize: 15, fontWeight: '600' },
  chipAnaliseTextoAtivo: { color: cor.analisado },
  duasAcoes: { marginTop: 14, flexDirection: 'row', gap: 10 },
  acao: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: '#1B3428',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  acaoRotulo: { fontSize: 15, fontWeight: '700', color: cor.papel },
  acaoValor: { marginTop: 2, fontSize: 13, color: '#B7C6BC' },

  /* janelinha */
  folhaFundo: { flex: 1, justifyContent: 'flex-end' },
  folhaSombra: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,37,28,0.5)' },
  folha: {
    maxHeight: '85%',
    backgroundColor: cor.branco,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  folhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  folhaTitulo: { flex: 1, fontSize: 20, fontWeight: '800', color: cor.tinta, paddingRight: 12 },
  folhaFechar: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  folhaFecharTexto: { fontSize: 16, fontWeight: '700', color: cor.folha },

  opcao: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: cor.linha,
  },
  opcaoAtiva: { backgroundColor: '#E8F3EC' },
  opcaoNumero: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#6E8F7D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  opcaoNumeroTexto: { fontSize: 15, fontWeight: '800' },
  opcaoNome: { flex: 1, fontSize: 16, color: cor.tinta, fontWeight: '500' },
  opcaoNomeAtivo: { fontWeight: '800' },
  opcaoMarca: { fontSize: 14, fontWeight: '700', color: cor.folha },

  rua: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: cor.linha,
  },
  ruaNome: { fontSize: 15, color: cor.tinta, flex: 1, paddingRight: 12 },
  estado: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  estadoTexto: { fontSize: 14, fontWeight: '700' },

  velocidadeLinha: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  velocidadeBotao: {
    width: 64,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: cor.folha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  velocidadeBotaoTexto: { color: cor.folha, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  velocidadeValor: { fontSize: 30, fontWeight: '800', color: cor.tinta },
  velocidadeAtalhos: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  atalho: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: cor.linha,
  },
  atalhoAtivo: { backgroundColor: cor.tinta, borderColor: cor.tinta },
  atalhoTexto: { fontSize: 15, color: cor.tinta, fontWeight: '600' },
  atalhoTextoAtivo: { color: cor.papel, fontWeight: '800' },

  grupo: { marginTop: 8, marginBottom: 4 },
  grupoTitulo: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  grupoItens: { flexDirection: 'row', flexWrap: 'wrap' },
  item: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    marginBottom: 12,
  },
  itemNumero: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6E8F7D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemNumeroTexto: { fontSize: 14, fontWeight: '800' },
  itemNome: { fontSize: 14, color: cor.tinta, fontWeight: '600' },
  itemPapel: { fontSize: 13, color: cor.folha, lineHeight: 17 },

  rodape: { marginTop: 24, fontSize: 13, color: cor.pedra, textAlign: 'center' },
});